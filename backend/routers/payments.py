"""Prototype checkout and persistent order fulfillment."""

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.base import MERCHANTS
from database import get_db
from database.models import (
    MerchantAccountDB,
    MerchantDB,
    MerchantOrderDB,
    MerchantReviewDB,
    OrderDB,
    generate_id,
)
from routers.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["Checkout"])


class CheckoutItem(BaseModel):
    productId: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=99)


class CheckoutRequest(BaseModel):
    merchantId: str = Field(min_length=1, max_length=100)
    items: list[CheckoutItem] = Field(min_length=1, max_length=25)
    paymentMethod: Literal["card", "upi", "wallet", "cod"]
    deliveryAddress: str = Field(min_length=1, max_length=1000)
    cookingInstructions: str = Field(default="", max_length=1000)


class MerchantReviewRequest(BaseModel):
    orderId: str = Field(min_length=1, max_length=100)
    rating: int = Field(ge=1, le=5)
    review: str = Field(default="", max_length=2000)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_checkout_items(merchant_id: str, requested_items: list[CheckoutItem]) -> list[dict]:
    merchant_catalog = MERCHANTS.get(merchant_id)
    if merchant_catalog is None:
        raise HTTPException(status_code=404, detail="Merchant not found in the store catalog.")

    catalog = {
        product["id"]: product
        for product in merchant_catalog.get("catalog", [])
        if product.get("available", True)
    }
    checkout_items = []
    for request_item in requested_items:
        product = catalog.get(request_item.productId)
        if product is None:
            raise HTTPException(
                status_code=422,
                detail=f"Product {request_item.productId} is unavailable at this merchant.",
            )
        checkout_items.append(
            {
                "product_id": product["id"],
                "name": product["name"],
                "quantity": request_item.quantity,
                "price": float(product["price"]),
            }
        )
    return checkout_items


def _calculate_pricing(items: list[dict]) -> dict[str, float]:
    subtotal = _money(
        sum(
            Decimal(str(item["price"])) * item["quantity"]
            for item in items
        )
    )
    service_fee = _money(subtotal * Decimal("0.05"))
    delivery_fee = Decimal("2.99")
    tax = _money(subtotal * Decimal("0.0875"))
    total = _money(subtotal + service_fee + delivery_fee + tax)
    return {
        "subtotal": float(subtotal),
        "serviceFee": float(service_fee),
        "deliveryFee": float(delivery_fee),
        "tax": float(tax),
        "loyaltyDiscount": 0.0,
        "total": float(total),
    }


def _payment_result(
    order: OrderDB,
    merchant: MerchantDB,
    pricing: dict[str, float],
    payment_method: str,
) -> dict:
    catalog_ids = {
        product["name"]: product["id"]
        for product in MERCHANTS[merchant.id]["catalog"]
    }
    items = [
        {
            "productId": catalog_ids.get(item["name"], item["name"]),
            "name": item["name"],
            "price": item["price"],
            "quantity": item["qty"],
            "total": round(item["price"] * item["qty"], 2),
            "cookingInstructions": item.get("cookingInstructions", ""),
        }
        for item in order.items
    ]
    cooking_instructions = next(
        (item.get("cookingInstructions", "") for item in order.items if item.get("cookingInstructions")),
        "",
    )
    return {
        "success": True,
        "order": {
            "orderId": order.id,
            "merchantId": merchant.id,
            "merchantName": merchant.name,
            "merchantAddress": merchant.address,
            "items": items,
            "cookingInstructions": cooking_instructions,
            "pricing": pricing,
            "status": "confirmed",
            "estimatedReady": "15-25 min",
        },
        "payment": {
            "method": payment_method,
            "status": "not_collected",
            "tokenized": False,
        },
        "loyalty": {
            "pointsEarned": 0,
            "message": "Loyalty points are not enabled for this checkout.",
        },
    }


async def _create_persistent_order(
    db: AsyncSession,
    user_id: str,
    merchant: MerchantDB,
    items: list[dict],
    pricing: dict[str, float],
    delivery_address: str,
    payment_method: str,
    order_id: str,
    cooking_instructions: str,
) -> dict:
    now = datetime.utcnow()
    serialized_items = [
        {
            **item,
            "image": next(
                (
                    product.get("image", "")
                    for product in MERCHANTS[merchant.id]["catalog"]
                    if product["id"] == item["product_id"]
                ),
                "",
            ),
        }
        for item in items
    ]
    order = OrderDB(
        id=order_id,
        user_id=user_id,
        merchant=merchant.name,
        items=[
            {
                "productId": item["product_id"],
                "name": item["name"],
                "quantity": item["quantity"],
                "qty": item["quantity"],
                "price": item["price"],
                "image": next(
                    (
                        product.get("image", "")
                        for product in MERCHANTS[merchant.id]["catalog"]
                        if product["id"] == item["product_id"]
                    ),
                    "",
                ),
                "cookingInstructions": cooking_instructions,
            }
            for item in items
        ],
        total=pricing["total"],
        savings=0,
        date=now.strftime("%b %d, %Y"),
        status="confirmed",
        agent_task="Customer checkout",
        card=f"{payment_method}:not_collected",
        address=delivery_address,
        steps=[
            {
                "time": now.isoformat(),
                "label": "Order placed",
                "detail": "Order placed successfully.",
                "pricing": pricing,
            },
            *(
                [{
                    "time": now.isoformat(),
                    "label": "Cooking instructions",
                    "detail": cooking_instructions,
                }]
                if cooking_instructions
                else []
            ),
        ],
    )
    if cooking_instructions:
        serialized_items = [
            {**item, "cookingInstructions": cooking_instructions}
            for item in serialized_items
        ]
    merchant_order = MerchantOrderDB(
        id=order_id,
        merchant_id=merchant.id,
        items=serialized_items,
        total=pricing["total"],
        status="confirmed",
        created_at=now,
        is_demo=False,
    )
    db.add_all([order, merchant_order])
    await db.flush()
    return _payment_result(order, merchant, pricing, payment_method)


async def _get_checkout_merchant(
    db: AsyncSession,
    merchant_id: str,
) -> MerchantDB:
    merchant = await db.get(MerchantDB, merchant_id)
    if merchant is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This restaurant is not connected to merchant order storage yet.",
        )
    return merchant


async def _reject_merchant_customer(
    db: AsyncSession,
    user_id: str,
) -> None:
    merchant_account_id = await db.scalar(
        select(MerchantAccountDB.id).where(MerchantAccountDB.user_id == user_id)
    )
    if merchant_account_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Merchant accounts cannot place customer checkout orders.",
        )


@router.post("/checkout")
async def create_checkout(
    request: CheckoutRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _reject_merchant_customer(db, current_user.id)
    merchant = await _get_checkout_merchant(db, request.merchantId)
    items = _build_checkout_items(request.merchantId, request.items)
    pricing = _calculate_pricing(items)

    order_id = generate_id("ORD-")
    result = await _create_persistent_order(
        db,
        current_user.id,
        merchant,
        items,
        pricing,
        request.deliveryAddress,
        request.paymentMethod,
        order_id,
        request.cookingInstructions.strip(),
    )
    await db.commit()
    return result


@router.post("/reviews", status_code=status.HTTP_201_CREATED)
async def submit_merchant_review(
    request: MerchantReviewRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _reject_merchant_customer(db, current_user.id)
    customer_order = await db.scalar(
        select(OrderDB).where(
            OrderDB.id == request.orderId,
            OrderDB.user_id == current_user.id,
        )
    )
    merchant_order = await db.get(MerchantOrderDB, request.orderId)
    if customer_order is None or merchant_order is None:
        raise HTTPException(status_code=404, detail="Order not found for this customer.")

    existing_review = await db.scalar(
        select(MerchantReviewDB.id).where(MerchantReviewDB.order_id == request.orderId)
    )
    if existing_review is not None:
        raise HTTPException(status_code=409, detail="This order has already been reviewed.")

    review = MerchantReviewDB(
        id=generate_id("REV-"),
        merchant_id=merchant_order.merchant_id,
        order_id=merchant_order.id,
        rating=request.rating,
        review=request.review.strip(),
        created_at=datetime.utcnow(),
        is_demo=False,
    )
    db.add(review)
    await db.commit()
    return {"success": True, "reviewId": review.id}
