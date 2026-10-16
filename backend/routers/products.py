"""Products API - Serves product catalog from merchants."""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from agents.base import MERCHANTS

router = APIRouter(prefix="/products", tags=["products"])


def transform_product(product: dict, merchant: dict) -> dict:
    """Transform merchant catalog item to frontend product format."""
    return {
        "id": f"{merchant['id']}_{product['id']}",  # Unique ID combining merchant and product
        "name": product["name"],
        "price": product["price"],
        "originalPrice": product.get("originalPrice"),
        "discount": product.get("discount"),
        "image": product.get("image", ""),
        "category": [product.get("category", merchant["category"])],
        "tags": product.get("tags", []),
        "description": product.get("description", ""),
        "merchant": merchant["name"],
        "merchant_id": merchant["id"],
        "location": merchant.get("address", ""),
        "rating": merchant.get("rating", 4.5),
        "inStock": product.get("available", True)
    }


@router.get("")
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = None,
    merchant_id: Optional[str] = None
):
    """
    Get all products from merchant catalogs.

    Query parameters:
    - category: Filter by category
    - search: Search in product name/description
    - limit: Limit number of results
    - merchant_id: Filter by specific merchant
    """
    products = []

    # Get merchants to search
    merchants_to_search = MERCHANTS.values()
    if merchant_id:
        merchant = MERCHANTS.get(merchant_id)
        if not merchant:
            return {"success": False, "products": [], "total": 0, "message": "Merchant not found"}
        merchants_to_search = [merchant]

    # Collect all products from merchant catalogs
    for merchant in merchants_to_search:
        for product in merchant.get("catalog", []):
            # Transform to frontend format
            transformed = transform_product(product, merchant)

            # Apply filters
            if category:
                product_categories = [c.lower() for c in transformed["category"]]
                if category.lower() not in product_categories:
                    continue

            if search and search.strip():
                search_terms = search.lower().split()
                searchable_text = (
                    f"{transformed['name']} {transformed['description']} {transformed['merchant']} "
                    f"{' '.join(transformed['category'])} {' '.join(transformed['tags'])}"
                ).lower()
                if not all(term in searchable_text for term in search_terms):
                    continue

            products.append(transformed)

    total = len(products)
    # Apply limit
    if limit:
        products = products[:limit]

    return {
        "success": True,
        "products": products,
        "total": total
    }


@router.get("/{product_id}")
async def get_product(product_id: str):
    """Get single product by ID."""
    # Parse combined ID (format: merchant_id_product_id)
    parts = product_id.split("_", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid product ID format")

    merchant_id, prod_id = parts
    merchant = MERCHANTS.get(merchant_id)

    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Find product in merchant catalog
    product = None
    for item in merchant.get("catalog", []):
        if item["id"] == prod_id:
            product = item
            break

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "success": True,
        "product": transform_product(product, merchant)
    }


@router.get("/merchant/{merchant_id}")
async def get_merchant_products(merchant_id: str, tags: Optional[str] = None):
    """Get all products from a specific merchant."""
    merchant = MERCHANTS.get(merchant_id)

    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = []
    tag_list = tags.split(",") if tags else None

    for product in merchant.get("catalog", []):
        # Filter by tags if provided
        if tag_list:
            product_tags = [t.lower() for t in product.get("tags", [])]
            if not any(tag.lower() in product_tags for tag in tag_list):
                continue

        products.append(transform_product(product, merchant))

    return {
        "success": True,
        "merchant": {
            "id": merchant["id"],
            "name": merchant["name"],
            "type": merchant["type"],
            "category": merchant["category"],
            "rating": merchant.get("rating", 4.5),
            "address": merchant.get("address", ""),
            "image": merchant.get("image", "")
        },
        "products": products,
        "total": len(products)
    }
