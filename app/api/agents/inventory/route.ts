import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, getMerchantProducts, merchantsDB, hasProductIntent, matchesRequestedProduct, type Product } from '../data';
import { llmJSON, llmEnabled } from '../llm';

// POST /api/agents/inventory
// Inventory Agent - Picks only the products that directly satisfy the request.

const SYSTEM_PROMPT = `You are the Inventory Agent for an agentic commerce marketplace.
Given a customer's request and a single merchant's catalog, choose only items that directly fulfil the request.

STRICT RULES:
- Only choose from the provided product ids. Never invent products.
- Respect dietary and other constraints.
- Do NOT add related items, upsells, complements, or inferred extras.
- If the customer asks for ONE thing (for example: "coffee"), return exactly ONE best direct match.
- "Coffee" must not automatically add milk, cappuccino, pastry, breakfast, or any other item.
- If the customer explicitly asks for multiple things, return one best direct match for each requested thing.
- If the exact requested item is unavailable, mark any substitute as an alternative. Never silently substitute it.
- If the request asks for ingredients of a dish, select the best matching dish only; the application will provide ingredient guidance separately.

Respond with ONLY a JSON object:
{
  "items": [{ "id": "<product-id>", "reason": "<one short sentence why it directly matches>", "isAlternative": true/false, "originalRequest": "<what customer asked for if this is alternative>" }],
  "exactMatchFound": true/false,
  "spoken": "<one concise sentence describing only what was requested>"
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

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'a', 'an', 'the', 'please', 'want', 'need', 'get', 'give', 'show', 'find', 'order',
  'for', 'from', 'near', 'nearby', 'some', 'one', 'item', 'items', 'would', 'like', 'to', 'of', 'with',
]);

function requestTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function isIngredientRequest(query: string): boolean {
  return /\b(ingredient|ingredients|recipe|what goes into|what is in)\b/i.test(query);
}

function biryaniIngredients(query: string): string[] | null {
  if (!/\bbiryani\b/i.test(query) || !isIngredientRequest(query)) return null;
  const base = [
    'basmati rice', 'onion', 'tomato', 'yogurt', 'ginger', 'garlic', 'green chilli', 'mint', 'coriander',
    'lemon', 'ghee or oil', 'salt', 'turmeric', 'red chilli powder', 'coriander powder', 'garam masala',
    'biryani masala', 'cumin', 'bay leaf', 'cinnamon', 'cloves', 'cardamom', 'saffron or food colour',
  ];
  if (/\bveg|vegetable|vegetarian\b/i.test(query)) {
    return [...base, 'mixed vegetables (carrot, beans, peas, potato, cauliflower)'];
  }
  return [...base, 'chicken'];
}

function enrichRecipeDescription(product: Product, ingredients: string[] | null): Product {
  if (!ingredients) return product;
  return {
    ...product,
    description: `Ingredients: ${ingredients.join(', ')}.`,
    aiReason: 'Showing the ingredient list you asked for.',
  };
}

function directFallbackMatches(catalog: Product[], query: string): Product[] {
  const terms = requestTerms(query).filter((term) => !['ingredient', 'ingredients', 'recipe'].includes(term));
  if (terms.length === 0) return [];

  const scored = catalog
    .map((product) => {
      const name = product.name.toLowerCase();
      const category = product.category.toLowerCase();
      const tags = product.tags.map((tag) => tag.toLowerCase());
      let score = 0;
      for (const term of terms) {
        if (name === term) score += 20;
        else if (name.includes(term)) score += 10;
        if (category === term || category.includes(term)) score += 5;
        if (tags.some((tag) => tag === term)) score += 6;
        else if (tags.some((tag) => tag.includes(term))) score += 2;
      }
      return { product, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ product }) => product);
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

    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    const allMerchantProducts = await getMerchantProducts(merchantId);
    const ingredients = biryaniIngredients(normalizedQuery);

    // Use AI first, but strictly post-filter to direct matches. Keyword scoring is the deterministic fallback.
    const ai = await aiSelectProducts(merchantId, merchant.name, normalizedQuery, allMerchantProducts);
    const eligibleProducts = hasProductIntent(normalizedQuery)
      ? allMerchantProducts.filter(product => matchesRequestedProduct(product, normalizedQuery))
      : allMerchantProducts;
    const deterministic = directFallbackMatches(eligibleProducts, normalizedQuery);
    const legacyMatches = deterministic.length ? deterministic : await searchProducts(merchantId, normalizedQuery);

    const relevantAIProducts = ai?.products.filter(product => !hasProductIntent(normalizedQuery) || matchesRequestedProduct(product, normalizedQuery)) || [];
    let products = relevantAIProducts.length ? relevantAIProducts : legacyMatches;

    // A generic single-item request should result in one item only. The LLM may otherwise over-select related products.
    const explicitMultiItem = /\b(and|plus|with|,|\&)\b/i.test(normalizedQuery) && !isIngredientRequest(normalizedQuery);
    if (!explicitMultiItem && products.length > 1) products = products.slice(0, 1);

    // Ingredient questions are informational: show the best matching biryani item with a complete ingredient description.
    if (ingredients && products.length > 0) {
      products = [enrichRecipeDescription(products[0], ingredients)];
    }

    const catalogAlternatives = !ai && products.length === 0 ? allMerchantProducts.slice(0, 3) : [];
    if (products.length === 0) products = catalogAlternatives;
    const usedAI = Boolean(ai);

    const alternatives =
      ai?.alternatives ??
      catalogAlternatives.map((product) => ({
        productId: product.id,
        originalRequest: normalizedQuery || 'your request',
        reason: `Available at ${merchant.name}`,
      }));
    const hasAlternatives = alternatives.length > 0;
    const exactMatchFound = ai?.exactMatchFound ?? catalogAlternatives.length === 0;

    let message = '';
    let alternativeMessage = '';
    let spoken = ai?.spoken;

    if (ingredients && products.length > 0) {
      message = `Showing biryani ingredients at ${merchant.name}`;
      spoken = `For biryani, you will need ${ingredients.join(', ')}.`;
    } else if (catalogAlternatives.length > 0) {
      const names = catalogAlternatives.map((product) => product.name).join(', ');
      message = `No exact match found at ${merchant.name}`;
      alternativeMessage = `I couldn't find an exact match for "${normalizedQuery}" at ${merchant.name}. Available alternatives are ${names}. Would you like one of these instead?`;
      spoken = alternativeMessage;
    } else if (products.length === 0) {
      message = `No matching products found at ${merchant.name}`;
    } else if (ai && hasAlternatives && !exactMatchFound) {
      const altItems = alternatives.map((a) => a.originalRequest).join(', ');
      message = `"${altItems}" is not available at ${merchant.name}`;
      alternativeMessage = `We found a similar alternative: ${products.map((p) => p.name).join(', ')}. Would you like this instead?`;
    } else {
      message = `Found ${products.length} direct match${products.length > 1 ? 'es' : ''} at ${merchant.name}`;
    }

    return NextResponse.json({
      success: true,
      agent: 'InventoryAgent',
      mode: usedAI ? 'llm' : llmEnabled() ? 'llm-fallback' : 'keyword',
      merchantId,
      merchantName: merchant.name,
      query: normalizedQuery,
      timestamp: new Date().toISOString(),
      results: {
        products,
        count: products.length,
        message,
        spoken,
        exactMatchFound,
        hasAlternatives,
        alternatives,
        alternativeMessage,
        recipeIngredients: ingredients || undefined,
      },
    });
  } catch (error) {
    console.error('Inventory Agent Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
