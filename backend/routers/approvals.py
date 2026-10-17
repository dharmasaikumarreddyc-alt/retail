"""Approval routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from datetime import datetime

from database import get_db
from database.models import ApprovalDB
from routers.auth import get_current_user

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def format_expires(expires_at: datetime) -> str:
    """Format expiration time as human-readable string."""
    now = datetime.utcnow()
    diff = expires_at - now

    if diff.total_seconds() <= 0:
        return "Expired"

    hours = int(diff.total_seconds() // 3600)
    minutes = int((diff.total_seconds() % 3600) // 60)

    return f"Expires in {hours}h {minutes}m"


@router.get("", response_model=List[dict])
async def get_approvals(
    status_filter: str = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's pending approvals."""
    query = select(ApprovalDB).where(ApprovalDB.user_id == current_user.id)

    if status_filter:
        query = query.where(ApprovalDB.status == status_filter)
    else:
        # Default to pending
        query = query.where(ApprovalDB.status == "pending")

    query = query.order_by(desc(ApprovalDB.created_at))

    result = await db.execute(query)
    approvals = result.scalars().all()

    # Check for expired approvals
    now = datetime.utcnow()
    for approval in approvals:
        if approval.status == "pending" and approval.expires_at < now:
            approval.status = "expired"
            await db.commit()

    return [
        {
            "id": a.id,
            "merchant": a.merchant,
            "item": a.item,
            "qty": a.qty,
            "amount": a.amount,
            "reason": a.reason,
            "expires": format_expires(a.expires_at),
            "comparison": a.comparison,
            "status": a.status
        }
        for a in approvals
        if a.status == "pending"  # Only return still-pending
    ]


@router.get("/count")
async def get_approval_count(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get count of pending approvals."""
    result = await db.execute(
        select(ApprovalDB).where(
            ApprovalDB.user_id == current_user.id,
            ApprovalDB.status == "pending"
        )
    )
    approvals = result.scalars().all()

    # Filter out expired
    now = datetime.utcnow()
    pending_count = sum(1 for a in approvals if a.expires_at > now)

    return {"count": pending_count}


@router.post("/{approval_id}/approve")
async def approve_purchase(
    approval_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending purchase."""
    result = await db.execute(
        select(ApprovalDB).where(
            ApprovalDB.id == approval_id,
            ApprovalDB.user_id == current_user.id,
        )
    )
    approval = result.scalar_one_or_none()
    if approval is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )
    if approval.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Approval is already {approval.status}",
        )
    if approval.expires_at < datetime.utcnow():
        approval.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approval has expired",
        )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Purchase approval execution is disabled until a real payment provider and authenticated order processing are configured.",
    )


@router.post("/{approval_id}/decline")
async def decline_purchase(
    approval_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Decline a pending purchase."""
    result = await db.execute(
        select(ApprovalDB).where(
            ApprovalDB.id == approval_id,
            ApprovalDB.user_id == current_user.id
        )
    )
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found"
        )

    if approval.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Approval is already {approval.status}"
        )

    approval.status = "declined"
    await db.commit()

    return {"status": "declined", "message": "Purchase declined"}
