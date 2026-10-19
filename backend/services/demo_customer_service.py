"""Idempotent demo data for the public customer account."""

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    AgentRunDB,
    ApprovalDB,
    FeedEventDB,
    OrderDB,
    TransactionDB,
    VirtualCardDB,
)


def _pricing(subtotal: float, total: float) -> dict:
    return {
        "subtotal": subtotal,
        "serviceFee": round(subtotal * 0.05, 2),
        "deliveryFee": 2.99,
        "tax": round(max(total - subtotal - 2.99 - subtotal * 0.05, 0), 2),
        "loyaltyDiscount": 0.0,
        "total": total,
    }


async def ensure_demo_customer_data(db: AsyncSession, user_id: str) -> None:
    """Populate the demo customer once without duplicating data on later logins."""
    now = datetime.utcnow()
    address = "3550 Lenox Rd NE, Atlanta, GA 30326"

    order_specs = [
        (
            "DEMO-CUST-001", "Starbucks Coffee Company", 1, 13.18, 1.25,
            [
                {"productId": "cv-2", "name": "Oat Milk Latte", "quantity": 1, "qty": 1, "price": 5.75, "image": "/images/products/latte.jpg"},
                {"productId": "cv-5", "name": "Almond Croissant", "quantity": 1, "qty": 1, "price": 4.25, "image": "/images/products/croissant.jpg"},
            ],
        ),
        (
            "DEMO-CUST-002", "Truffles Cafe", 4, 10.97, 0.80,
            [
                {"productId": "bs-1", "name": "Signature Cold Brew", "quantity": 1, "qty": 1, "price": 5.50, "image": "/images/products/cold-brew.jpg"},
            ],
        ),
        (
            "DEMO-CUST-003", "Tower Cafe", 8, 16.93, 2.10,
            [
                {"productId": "gl-1", "name": "Mediterranean Salad", "quantity": 1, "qty": 1, "price": 11.50, "image": "/images/products/mediterranean-salad.jpg"},
            ],
        ),
        (
            "DEMO-CUST-004", "Starbucks Coffee Company", 14, 18.91, 1.75,
            [
                {"productId": "cv-1", "name": "Vegan Avocado Toast", "quantity": 1, "qty": 1, "price": 8.50, "image": "/images/products/avocado-toast.jpg"},
                {"productId": "cv-4", "name": "Fresh Orange Juice", "quantity": 1, "qty": 1, "price": 4.50, "image": "/images/products/orange-juice.jpg"},
            ],
        ),
        (
            "DEMO-CUST-005", "Peet's Coffee & Tea", 22, 12.84, 0.95,
            [
                {"productId": "df-1", "name": "House Coffee", "quantity": 2, "qty": 2, "price": 4.25, "image": "/images/products/cold-brew.jpg"},
            ],
        ),
    ]

    for order_id, merchant, days_ago, total, savings, items in order_specs:
        if await db.get(OrderDB, order_id) is not None:
            continue
        created = now - timedelta(days=days_ago)
        subtotal = round(sum(float(item["price"]) * int(item["quantity"]) for item in items), 2)
        db.add(
            OrderDB(
                id=order_id,
                user_id=user_id,
                merchant=merchant,
                items=items,
                total=total,
                savings=savings,
                date=created.strftime("%b %d, %Y"),
                status="delivered" if days_ago > 1 else "confirmed",
                agent_task="CartPilot demo order",
                card="upi:captured",
                address=address,
                steps=[
                    {
                        "time": created.isoformat(),
                        "label": "Order placed",
                        "detail": "CartPilot found the best matching merchant and placed the demo order.",
                        "pricing": _pricing(subtotal, total),
                    },
                    {
                        "time": (created + timedelta(minutes=18)).isoformat(),
                        "label": "Order ready",
                        "detail": "Merchant prepared the order successfully.",
                    },
                ],
                created_at=created,
            )
        )

    if await db.get(AgentRunDB, "DEMO-RUN-WATCH-001") is None:
        db.add(
            AgentRunDB(
                id="DEMO-RUN-WATCH-001",
                user_id=user_id,
                task="Watch for coffee deals under $6 nearby",
                status="watching",
                detail="Monitoring local coffee merchants for a better price.",
                time="Watching now",
                steps=[{"label": "Monitoring", "detail": "Checking nearby coffee shops and offers."}],
                result=None,
                created_at=now - timedelta(hours=2),
            )
        )

    if await db.get(ApprovalDB, "DEMO-APR-001") is None:
        db.add(
            ApprovalDB(
                id="DEMO-APR-001",
                user_id=user_id,
                merchant="Sweet Treats Bakery",
                item="Celebration cake",
                qty=1,
                amount=42.0,
                reason="Price is above the demo auto-purchase threshold.",
                comparison=[
                    {"store": "Sweet Treats Bakery", "price": 42.0},
                    {"store": "Local Bakery", "price": 46.5},
                ],
                status="pending",
                expires_at=now + timedelta(hours=8),
                created_at=now - timedelta(minutes=25),
            )
        )

    feed_specs = [
        ("DEMO-EVT-001", "checkout", "Coffee order confirmed", "Oat Milk Latte and Almond Croissant ordered from Starbucks Coffee Company.", "5 min ago", "success"),
        ("DEMO-EVT-002", "compare", "Compared nearby coffee shops", "CartPilot compared price, distance and rating across nearby merchants.", "18 min ago", "info"),
        ("DEMO-EVT-003", "approval", "Approval requested", "Celebration cake requires approval because it exceeds the demo threshold.", "25 min ago", "pending"),
        ("DEMO-EVT-004", "search", "Voice search: coffee", "Chirp-powered voice search understood the coffee request.", "1 hr ago", "success"),
    ]
    for event_id, event_type, title, detail, time_text, event_status in feed_specs:
        if await db.get(FeedEventDB, event_id) is None:
            db.add(
                FeedEventDB(
                    id=event_id,
                    user_id=user_id,
                    type=event_type,
                    title=title,
                    detail=detail,
                    time=time_text,
                    status=event_status,
                    created_at=now - timedelta(minutes=5),
                )
            )

    if await db.get(VirtualCardDB, "DEMO-CARD-001") is None:
        db.add(
            VirtualCardDB(
                id="DEMO-CARD-001",
                user_id=user_id,
                label="Loopora Demo Card",
                last4="4242",
                type="merchant-locked",
                limit=150.0,
                spent=48.75,
                status="active",
                merchant="Local Food & Beverage",
                created_at=now - timedelta(days=30),
            )
        )

    if await db.get(TransactionDB, "DEMO-TXN-001") is None:
        db.add(
            TransactionDB(
                id="DEMO-TXN-001",
                card_id="DEMO-CARD-001",
                merchant="Starbucks Coffee Company",
                amount=13.18,
                date=(now - timedelta(days=1)).strftime("%b %d, %Y"),
                status="completed",
                description="Demo CartPilot order",
                created_at=now - timedelta(days=1),
            )
        )

    await db.commit()
