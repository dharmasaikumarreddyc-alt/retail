import { NextResponse } from 'next/server';
import { localProductsDB, localMerchantsDB } from '../agents/data';
import { backendUrl, optionalBackendUrl } from '../../lib/backend';

export interface Product {
  id: string | number;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  image: string;
  category: string[];
  tags: string[];
  description: string;
  merchant: string;
  merchant_id?: string;
  location: string;
  rating: number;
  inStock: boolean;
}

// Transform local product to shop format
function transformLocalProduct(p: any): Product {
  const merchant = localMerchantsDB.find(m => m.id === p.merchantId);
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    discount: p.discount ? `${p.discount}%` : undefined,
    image: p.image,
    category: [p.category],
    tags: p.tags,
    description: p.description,
    merchant: merchant?.name || 'Local Shop',
    merchant_id: p.merchantId,
    location: merchant?.address || 'Hyderabad',
    rating: p.rating || merchant?.rating || 4.5,
    inStock: p.inStock,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim().toLowerCase();
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 50;

  // Try Python backend first if configured
  if (optionalBackendUrl) {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      if (limit) params.append('limit', limit.toString());

      const response = await fetch(`${backendUrl}/products?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.products)) {
          return NextResponse.json({
            products: data.products,
            total: data.total ?? data.products.length,
            success: true,
          });
        }
      }
    } catch {
      // Backend not available, fall through to local/DummyJSON
    }
  }

  // Offline fallback is restricted to products in the app's local food catalog.
  try {
    const searchTerms = search?.split(/\s+/).filter(Boolean) ?? [];
    const products = localProductsDB
      .map(transformLocalProduct)
      .filter(product => {
        const categoryMatches = !category || product.category.some(value => value.toLowerCase().includes(category));
        const searchableText = [
          product.name,
          product.description,
          product.merchant,
          ...product.category,
          ...product.tags,
        ].join(' ').toLowerCase();
        const searchMatches = searchTerms.every(term => searchableText.includes(term));
        return categoryMatches && searchMatches;
      });

    // Apply limit
    const limitedProducts = products.slice(0, limit);

    return NextResponse.json({
      products: limitedProducts,
      total: products.length,
      success: true,
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ products: [], total: 0, success: true });
  }
}
