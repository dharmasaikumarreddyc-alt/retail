"""Wallet and virtual card routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from database import get_db
from database.models import VirtualCardDB, TransactionDB
from models.card import CardCreate
from routers.auth import get_current_user

router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.get("/cards", response_model=List[dict])
async def get_cards(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's virtual cards."""
    result = await db.execute(
        select(VirtualCardDB)
        .where(VirtualCardDB.user_id == current_user.id)
        .order_by(desc(VirtualCardDB.created_at))
    )
    cards = result.scalars().all()

    return [
        {
            "id": card.id,
            "label": card.label,
            "last4": card.last4,
            "type": card.type,
            "limit": card.limit,
            "spent": card.spent,
            "status": card.status,
            "merchant": card.merchant
        }
        for card in cards
    ]


@router.post("/cards", response_model=dict)
async def create_card(
    _card_data: CardCreate,
    _current_user = Depends(get_current_user),
):
    """Create a new virtual card."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Virtual card creation is disabled until integrated with a regulated card/payment provider.",
    )


@router.put("/cards/{card_id}/pause")
async def pause_card(
    card_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pause a virtual card."""
    result = await db.execute(
        select(VirtualCardDB).where(
            VirtualCardDB.id == card_id,
            VirtualCardDB.user_id == current_user.id
        )
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )

    card.status = "paused"
    await db.commit()

    return {"status": "paused", "message": "Card paused"}


@router.put("/cards/{card_id}/resume")
async def resume_card(
    card_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume a paused virtual card."""
    result = await db.execute(
        select(VirtualCardDB).where(
            VirtualCardDB.id == card_id,
            VirtualCardDB.user_id == current_user.id
        )
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )

    if card.status == "destroyed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resume a destroyed card"
        )

    card.status = "active"
    await db.commit()

    return {"status": "active", "message": "Card resumed"}


@router.delete("/cards/{card_id}")
async def destroy_card(
    card_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Destroy a virtual card."""
    result = await db.execute(
        select(VirtualCardDB).where(
            VirtualCardDB.id == card_id,
            VirtualCardDB.user_id == current_user.id
        )
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )

    card.status = "destroyed"
    await db.commit()

    return {"status": "destroyed", "message": "Card destroyed"}


@router.get("/transactions", response_model=List[dict])
async def get_transactions(
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's transactions."""
    # Get user's card IDs
    cards_result = await db.execute(
        select(VirtualCardDB.id, VirtualCardDB.last4)
        .where(VirtualCardDB.user_id == current_user.id)
    )
    cards = {row[0]: row[1] for row in cards_result.all()}

    if not cards:
        return []

    # Get transactions for those cards
    result = await db.execute(
        select(TransactionDB)
        .where(TransactionDB.card_id.in_(cards.keys()))
        .order_by(desc(TransactionDB.created_at))
        .limit(limit)
    )
    transactions = result.scalars().all()

    return [
        {
            "id": txn.id,
            "merchant": txn.merchant,
            "amount": txn.amount,
            "date": txn.date,
            "status": txn.status,
            "card_last4": cards.get(txn.card_id, "****")
        }
        for txn in transactions
    ]


@router.get("/balance")
async def get_balance(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get wallet balance summary."""
    result = await db.execute(
        select(VirtualCardDB)
        .where(
            VirtualCardDB.user_id == current_user.id,
            VirtualCardDB.status == "active"
        )
    )
    cards = result.scalars().all()

    total_limit = sum(card.limit for card in cards)
    total_spent = sum(card.spent for card in cards)
    available = total_limit - total_spent

    return {
        "total_limit": total_limit,
        "total_spent": total_spent,
        "available": available,
        "active_cards": len(cards)
    }
