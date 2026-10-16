"""Persistent cart management API."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.base import MERCHANTS
from database import get_db
from database.models import CartItemDB
from routers.auth import get_current_user

router = APIRouter(prefix="/cart", tags=["cart"])


class AddToCartRequest(BaseModel):
    merchant_id: str
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)


class UpdateCartRequest(BaseModel):
    merchant_id: str
    product_id: str
    quantity: int = Field(ge=0, le=99)


def serialize_items(items: list[CartItemDB]) -> dict:
    serialized = [
        {
            "merchant_id": item.merchant_id,
            "merchant_name": item.merchant_name,
            "product_id": item.product_id,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "image": item.image,
        }
        for item in items
    ]
    subtotal = sum(item["price"] * item["quantity"] for item in serialized)
    count = sum(item["quantity"] for item in serialized)
    return {
        "items": serialized,
        "count": count,
        "subtotal": subtotal,
        "total": subtotal,
    }


async def get_user_cart(db: AsyncSession, user_id: str) -> list[CartItemDB]:
    result = await db.execute(
        select(CartItemDB)
        .where(CartItemDB.user_id == user_id)
        .order_by(CartItemDB.created_at)
    )
    return list(result.scalars().all())


@router.get("")
async def get_cart(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's cart."""
    return {"success": True, **serialize_items(await get_user_cart(db, current_user.id))}


@router.post("/add")
async def add_to_cart(
    request: AddToCartRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a catalog item to the authenticated user's cart."""
    merchant = MERCHANTS.get(request.merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    product = next(
        (item for item in merchant.get("catalog", []) if item["id"] == request.product_id),
        None,
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.get("available", True):
        raise HTTPException(status_code=409, detail="Product is unavailable")

    result = await db.execute(
        select(CartItemDB).where(
            CartItemDB.user_id == current_user.id,
            CartItemDB.merchant_id == request.merchant_id,
            CartItemDB.product_id == request.product_id,
        )
    )
    existing = result.scalar_one_or_none()
    quantity = request.quantity + (existing.quantity if existing else 0)
    if quantity > 99:
        raise HTTPException(status_code=422, detail="Cart item quantity cannot exceed 99")

    if existing:
        existing.quantity = quantity
        existing.price = product["price"]
        existing.name = product["name"]
        existing.image = product.get("image")
    else:
        db.add(
            CartItemDB(
                user_id=current_user.id,
                merchant_id=request.merchant_id,
                merchant_name=merchant["name"],
                product_id=request.product_id,
                name=product["name"],
                price=product["price"],
                quantity=quantity,
                image=product.get("image"),
            )
        )

    await db.commit()
    return {
        "success": True,
        "message": "Item added to cart",
        "cart": serialize_items(await get_user_cart(db, current_user.id)),
    }


@router.put("/update")
async def update_cart_item(
    request: UpdateCartRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update or remove an item in the authenticated user's cart."""
    result = await db.execute(
        select(CartItemDB).where(
            CartItemDB.user_id == current_user.id,
            CartItemDB.merchant_id == request.merchant_id,
            CartItemDB.product_id == request.product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    if request.quantity == 0:
        await db.delete(item)
    else:
        item.quantity = request.quantity

    await db.commit()
    return {
        "success": True,
        "message": "Cart updated",
        "cart": serialize_items(await get_user_cart(db, current_user.id)),
    }


@router.delete("/remove")
async def remove_from_cart(
    merchant_id: str,
    product_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the authenticated user's cart."""
    result = await db.execute(
        select(CartItemDB).where(
            CartItemDB.user_id == current_user.id,
            CartItemDB.merchant_id == merchant_id,
            CartItemDB.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    await db.delete(item)
    await db.commit()
    return {
        "success": True,
        "message": "Item removed from cart",
        "cart": serialize_items(await get_user_cart(db, current_user.id)),
    }


@router.delete("/clear")
async def clear_cart(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the authenticated user's cart."""
    await db.execute(delete(CartItemDB).where(CartItemDB.user_id == current_user.id))
    await db.commit()
    return {
        "success": True,
        "message": "Cart cleared",
        "cart": serialize_items([]),
    }
