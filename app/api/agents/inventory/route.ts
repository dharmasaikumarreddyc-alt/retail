import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, getMerchantProducts, merchantsDB, type Product } from '../data';
import { llmJSON, llmEnabled } from '../llm';

// POST /api/agents/inventory
// Inventory Agent - Picks the products from a merchant that best satisfy the request.
// Uses the LLM to reason over the catalog; falls back to keyword search.

const SYSTEM_PROMPT = `You are the Inventory Agent for an agentic commerce marketplace.
Given a customer's request and a single merchant's catalog, choose the items that best fulfil the request.
Pick a sensible, minimal set (usually 1-3 items) — e.g. "coffee and a vegan breakfast" -> one coffee + one vegan breakfast item.

Rules:
- Only choose from the provided product ids. Never invent products.
- Respect dietary/other constraints stated in the request.
- Order the items best-first.
- If the EXACT item requested is not available, mark it as an alternative and explain clearly.

Respond with ONLY a JSON object:
{
  "items": [{ "id": "<product-id>", "reason": "<one short sentence why it fits>", "isAlternative": true/false, "originalRequest": "<what customer asked for if this is alternative>" }],
  "exactMatchFound": true/false,
  "spoken": "<one friendly sentence. If alternatives, say something like 'I couldn't find X, but Y is a great alternative. Would you like that instead?'>"
}`;

interface LlmInventoryResult {
  items?: { id: string; reason: string; isAlternative?: boolean; originalRequest?: string }[];
  exactMatchFound?: boolean;
  spoken?: string;
}

interface AiSelectResult {
  products: Product[];
  spoken?: string;
  exactMatchFound: boolean;
  alternatives: { productId: string; originalRequest: string; reason: string }[];
}

async function aiSelectProducts(
  merchantId: string,
  merchantName: string,
  query: string,
  catalog: Product[]
): Promise<AiSelectResult | null> {
  if (catalog.length === 0) return null;

  const context = catalog
    .map(
      (p) =>
        `- id: ${p.id} | ${p.name} | ${p.category} | $${p.price} | tags: ${p.tags.join(', ')} | ${p.description}`
    )
    .join('\n');

  const result = await llmJSON<LlmInventoryResult>(
    SYSTEM_PROMPT,
    `Customer request: "${query}"\nMerchant: ${merchantName}\n\nCatalog:\n${context}`
  );

  if (!result?.items?.length) return null;

  const products: Product[] = [];
  const alternatives: { productId: string; originalRequest: string; reason: string }[] = [];

  for (const item of result.items) {
    const product = catalog.find((p) => p.id === item.id);
    if (product && !products.find((x) => x.id === product.id)) {
      products.push({ ...product, aiReason: item.reason });
      if (item.isAlternative && item.originalRequest) {
        alternatives.push({
          productId: product.id,
          originalRequest: item.originalRequest,
          reason: item.reason,
        });
      }
    }
  }
  if (products.length === 0) return null;

  return {
    products,
    spoken: result.spoken,
    exactMatchFound: result.exactMatchFound ?? true,
    alternatives,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, query } = body;

    if (!merchantId || typeof merchantId !== 'string') {
      return NextResponse.json({ success: false, error: 'Merchant ID is required' }, { status: 400 });
    }

    const merchant = merchantsDB.find((m) => m.id === merchantId);
    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    // Fetch products (works for both local and DummyJSON merchants)
    const allMerchantProducts = await getMerchantProducts(merchantId);

    // Try the real AI agent first; fall back to keyword matching.
    const ai = await aiSelectProducts(merchantId, merchant.name, query || '', allMerchantProducts);
    const matchingProducts = await searchProducts(merchantId, query || '');
    const catalogAlternatives =
      !ai && matchingProducts.length === 0 ? allMerchantProducts.slice(0, 3) : [];
    const products = ai?.products ?? (matchingProducts.length > 0 ? matchingProducts : catalogAlternatives);
    const usedAI = Boolean(ai);

    const alternatives =
      ai?.alternatives ??
      catalogAlternatives.map((product) => ({
        productId: product.id,
        originalRequest: query || 'your request',
        reason: `Available at ${merchant.name}`,
      }));
    const hasAlternatives = alternatives.length > 0;
    const exactMatchFound = ai?.exactMatchFound ?? catalogAlternatives.length === 0;

    // Build appropriate message
    let message = '';
    let alternativeMessage = '';
    if (catalogAlternatives.length > 0) {
      const names = catalogAlternatives.map((product) => product.name).join(', ');
      message = `No exact match found at ${merchant.name}`;
      alternativeMessage = `I couldn't find an exact match for "${query}" at ${merchant.name}. Here are some items actually available there: ${names}. Would you like one of these instead?`;
    } else if (products.length === 0) {
      message = `No matching products found at ${merchant.name}`;
    } else if (ai && hasAlternatives && !exactMatchFound) {
      const altItems = alternatives.map(a => a.originalRequest).join(', ');
      message = `"${altItems}" is not available at ${merchant.name}`;
      alternativeMessage = `We found a similar alternative: ${products.map(p => p.name).join(', ')}. Would you like this instead?`;
    } else {
      message = `Found ${products.length} product${products.length > 1 ? 's' : ''} at ${merchant.name}`;
    }

    const response = {
      success: true,
      agent: 'InventoryAgent',
      mode: usedAI ? 'llm' : llmEnabled() ? 'llm-fallback' : 'keyword',
      merchantId,
      merchantName: merchant.name,
      query: query || '',
      timestamp: new Date().toISOString(),
      results: {
        products,
        count: products.length,
        message,
        spoken: catalogAlternatives.length > 0 ? alternativeMessage : ai?.spoken,
        exactMatchFound,
        hasAlternatives,
        alternatives,
        alternativeMessage,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Inventory Agent Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
