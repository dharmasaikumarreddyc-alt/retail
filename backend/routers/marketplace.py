"""Marketplace API - Merchant discovery, ordering, and checkout."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from agents.base import (
    discover_merchants,
    get_merchant_catalog,
    MERCHANTS,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class DiscoverRequest(BaseModel):
    query: str
    max_distance: float = 5.0
    category: Optional[str] = None


class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    qty: int = 1


class OrderRequest(BaseModel):
    merchant_id: str
    items: List[OrderItem]
    customer_id: str
    order_type: str = "pickup"


@router.post("/discover")
async def discover(request: DiscoverRequest):
    """
    AI-powered merchant discovery.

    Example: "Find me a local coffee shop with vegan breakfast and order ahead"
    Returns: List of matching merchants with relevance scoring
    """
    results = discover_merchants(
        query=request.query,
        max_distance=request.max_distance,
        category=request.category,
    )
    return results


@router.get("/merchants")
async def list_merchants(category: Optional[str] = None, limit: int = 20):
    """List all available merchants."""
    merchants = list(MERCHANTS.values())

    if category:
        merchants = [m for m in merchants if m["category"].lower() == category.lower()]

    return merchants[:limit]


@router.get("/merchants/{merchant_id}")
async def get_merchant(merchant_id: str, filter_tags: Optional[str] = None):
    """Get merchant details with catalog."""
    tags = filter_tags.split(",") if filter_tags else None
    merchant = get_merchant_catalog(merchant_id, filter_tags=tags)

    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    return merchant


@router.post("/order")
async def place_order(request: OrderRequest):
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Checkout is disabled until a real payment provider and persistent order storage are configured.",
    )


@router.get("/customer/{customer_id}")
async def get_customer_profile(customer_id: str):
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Customer profiles are unavailable until backed by authenticated persistent storage.",
    )


@router.get("/categories")
async def get_categories():
    """Get available merchant categories."""
    categories = set()
    for merchant in MERCHANTS.values():
        categories.add(merchant["category"])

    return [
        {"id": cat.lower().replace(" ", "-"), "name": cat}
        for cat in sorted(categories)
    ]
