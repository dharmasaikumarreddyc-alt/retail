"""Seed one clearly labeled restaurant demo account and historical analytics."""

import asyncio
import argparse
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from agents.base import MERCHANTS
from config import settings
from database.db import async_session
from database.models import (
    MerchantAccountDB,
    MerchantDB,
    MerchantOrderDB,
    MerchantReviewDB,
    UserDB,
    SpendingRulesDB,
)
from services.auth_service import AuthService


MERCHANT_ID = "cafe-verde"
ORDER_COUNT = 780
REVIEW_COUNT = 260
CANCEL_REASONS = (
    "Customer changed their mind",
    "Item unavailable after order placement",
    "Pickup wait time was longer than expected",
    "Payment authorization failed",
    "Duplicate order placed by customer",
)
POSITIVE_REVIEWS = (
    "The latte was smooth and the pickup shelf made collection easy.",
    "Fresh pastry and friendly service. I will order again.",
    "My coffee was ready on time and tasted great.",
    "Great breakfast, carefully packed and still warm.",
    "The oat milk latte was excellent and the staff were welcoming.",
)
NEGATIVE_REVIEWS = (
    "My drink arrived lukewarm and the pickup took much longer than the estimate.",
    "The order was missing an item and nobody checked the bag before handing it over.",
    "The coffee tasted burnt today and the pastry did not seem fresh.",
    "I waited twenty minutes past the ready time and could not get an update.",
    "The customization I requested was ignored, so the drink was not usable for me.",
    "The lid was loose and coffee spilled inside the delivery bag.",
    "The item was marked available but staff said it had sold out after I paid.",
    "The portion was smaller than expected for the price.",
)


def make_order(index: int, now: datetime, products: list[dict], rng: random.Random) -> MerchantOrderDB:
    created_at = now - timedelta(
        days=rng.randrange(0, 365),
        minutes=rng.randrange(0, 1440),
    )
    status = rng.choices(
        ("delivered", "cancelled", "dispatched", "preparing", "confirmed"),
        weights=(72, 10, 9, 5, 4),
        k=1,
    )[0]
    chosen = rng.sample(products, k=rng.randint(1, min(4, len(products))))
    items = []
    total = 0.0
    for product in chosen:
        quantity = rng.choices((1, 2, 3), weights=(76, 20, 4), k=1)[0]
        price = float(product["price"])
        items.append({
            "product_id": product["id"],
            "name": product["name"],
            "quantity": quantity,
            "price": price,
        })
        total += price * quantity

    dispatched_at = None
    cancelled_at = None
    cancellation_reason = None
    if status in ("delivered", "dispatched"):
        dispatched_at = min(created_at + timedelta(minutes=rng.randint(8, 65)), now)
    elif status == "cancelled":
        cancelled_at = min(created_at + timedelta(minutes=rng.randint(2, 120)), now)
        cancellation_reason = rng.choice(CANCEL_REASONS)

    return MerchantOrderDB(
        id=f"DEMO-ORD-{index:05d}",
        merchant_id=MERCHANT_ID,
        items=items,
        total=round(total, 2),
        status=status,
        created_at=created_at,
        dispatched_at=dispatched_at,
        cancelled_at=cancelled_at,
        cancellation_reason=cancellation_reason,
        is_demo=True,
    )


async def seed(data_only: bool = False) -> None:
    email = (settings.DEMO_MERCHANT_EMAIL or "").strip().lower()
    password = settings.DEMO_MERCHANT_PASSWORD or ""
    if not data_only and (not email or not password):
        raise ValueError(
            "Set DEMO_MERCHANT_EMAIL and DEMO_MERCHANT_PASSWORD in the private backend environment before seeding."
        )
    if not data_only and (len(password) < 12 or len(password.encode("utf-8")) > 72):
        raise ValueError("Demo merchant password must be 12-72 UTF-8 bytes.")

    merchant_data = MERCHANTS[MERCHANT_ID]
    products = merchant_data["catalog"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rng = random.Random(20261016)

    async with async_session() as db:
        merchant = await db.get(MerchantDB, MERCHANT_ID)
        if merchant is not None and not merchant.is_demo:
            raise ValueError("The target merchant profile is not marked as demo; refusing to modify it.")

        account_result = await db.execute(
            select(MerchantAccountDB).where(MerchantAccountDB.merchant_id == MERCHANT_ID)
        )
        account = account_result.scalar_one_or_none()
        user = None
        if not data_only:
            user_result = await db.execute(select(UserDB).where(UserDB.email == email))
            user = user_result.scalar_one_or_none()
            if merchant is None and user is not None:
                raise ValueError(
                    "The configured demo merchant email already belongs to an account. "
                    "Use a dedicated, unused merchant email."
                )
            if account is not None and (user is None or account.user_id != user.id):
                raise ValueError("A different account is already linked to this merchant.")
            if merchant is not None and account is None and user is not None:
                raise ValueError(
                    "The configured email already belongs to an unlinked account. "
                    "Use a dedicated merchant email to avoid changing existing account access."
                )

        demo_orders = 0
        demo_reviews = 0
        if merchant is not None:
            demo_orders = await db.scalar(
                select(func.count()).select_from(MerchantOrderDB).where(
                    MerchantOrderDB.merchant_id == MERCHANT_ID,
                    MerchantOrderDB.is_demo.is_(True),
                )
            )
            demo_reviews = await db.scalar(
                select(func.count()).select_from(MerchantReviewDB).where(
                    MerchantReviewDB.merchant_id == MERCHANT_ID,
                    MerchantReviewDB.is_demo.is_(True),
                )
            )
            if (demo_orders or demo_reviews) and (
                demo_orders != ORDER_COUNT or demo_reviews != REVIEW_COUNT
            ):
                raise ValueError(
                    f"Demo seed is incomplete ({demo_orders} orders, {demo_reviews} reviews); "
                    "refusing to add duplicate records."
                )
        if account is None and user is not None:
            raise ValueError("The configured account exists but is not linked to this demo merchant.")

        if merchant is None:
            merchant = MerchantDB(
                id=MERCHANT_ID,
                name=merchant_data["name"],
                address=merchant_data["address"],
                category=merchant_data["category"],
                is_demo=True,
            )
            db.add(merchant)
        if not data_only and account is None:
            user = UserDB(
                email=email,
                name=f"{merchant_data['name']} Merchant",
                password_hash=AuthService.get_password_hash(password),
            )
            db.add(user)
            await db.flush()
            db.add(MerchantAccountDB(user_id=user.id, merchant_id=MERCHANT_ID))
            db.add(SpendingRulesDB(user_id=user.id))

        if demo_orders == ORDER_COUNT and demo_reviews == REVIEW_COUNT:
            await db.commit()
            print(
                f"Demo merchant data is already present ({demo_orders} orders, {demo_reviews} reviews); "
                "no analytics rows were changed."
            )
            if not data_only and account is None:
                print("The dedicated merchant login has now been linked to the existing demo dashboard.")
            return

        orders = [make_order(index, now, products, rng) for index in range(1, ORDER_COUNT + 1)]
        db.add_all(orders)
        await db.flush()

        reviews = []
        for index in range(1, REVIEW_COUNT + 1):
            order = orders[rng.randrange(len(orders))]
            is_negative = index % 4 == 0
            rating = rng.choice((1, 2, 3)) if is_negative else rng.choices((3, 4, 5), (8, 35, 57), k=1)[0]
            review_date = min(order.created_at + timedelta(hours=rng.randint(1, 48)), now)
            reviews.append(
                MerchantReviewDB(
                    id=f"DEMO-REV-{index:05d}",
                    merchant_id=MERCHANT_ID,
                    order_id=order.id,
                    rating=rating,
                    review=rng.choice(NEGATIVE_REVIEWS if rating <= 3 else POSITIVE_REVIEWS),
                    created_at=review_date,
                    is_demo=True,
                )
            )
        db.add_all(reviews)
        await db.commit()

    print(
        f"Seeded demo data for {merchant_data['name']}: "
        f"{ORDER_COUNT} historical orders and {REVIEW_COUNT} reviews."
    )
    if not data_only:
        print("The merchant login was created from private environment values; credentials were not displayed.")
    print("All generated orders and reviews are marked as demo data.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-only",
        action="store_true",
        help="Seed the demo merchant profile, orders, and reviews without creating login credentials.",
    )
    args = parser.parse_args()
    asyncio.run(seed(data_only=args.data_only))
