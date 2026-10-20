import { NextRequest, NextResponse } from 'next/server';
import { searchMerchants, merchantsDB, hasProductIntent, type Merchant } from '../data';
import { llmJSON, llmEnabled } from '../llm';

// POST /api/agents/discover
// Merchant Discovery Agent - Finds & ranks relevant merchants for a natural-language request.
// Simple product requests use deterministic matching immediately; complex requests use the LLM.

const SYSTEM_PROMPT = `You are the Merchant Discovery Agent for an agentic commerce marketplace.
The customer speaks in natural language (e.g. "find me a local coffee shop with vegan breakfast and order ahead").
You are given a list of registered local merchants. Pick the ones that genuinely match the request and rank them best-first.

Rules:
- Only choose from the provided merchant ids. Never invent merchants.
- Prefer merchants whose type/categories/offers match the intent AND that are closer / higher rated.
- Respect dietary or other constraints (vegan, healthy, etc.) when stated.
- If the request is too vague to choose well, set a short "clarifyingQuestion".

Respond with ONLY a JSON object:
{
  "matches": [{ "id": "<merchant-id>", "reason": "<one short sentence why it fits>" }],
  "spoken": "<one friendly sentence summarizing the top pick, suitable to read aloud>",
  "clarifyingQuestion": "<a short question, or empty string if none needed>"
}`;

interface LlmDiscoverResult {
  matches?: { id: string; reason: string }[];
  spoken?: string;
  clarifyingQuestion?: string;
}

function distanceOf(m: Merchant): number {
  const n = parseFloat(m.distance);
  return Number.isFinite(n) ? n : 99;
}

function buildMerchantContext(list: Merchant[]): string {
  return list
    .map(
      (m) =>
        `- id: ${m.id} | ${m.name} (${m.type}) | categories: ${m.category.join(', ')} | rating: ${m.rating} | distance: ${m.distance} | offers: ${m.offers.join('; ')}`
    )
    .join('\n');
}

function canUseFastPath(query: string, candidates: Merchant[]): boolean {
  if (candidates.length === 0) return false;
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const needsReasoning = /\b(vegan|vegetarian|healthy|organic|cheapest|cheaper|best|highest|rating|rated|offer|discount|under|budget|within|without|except|allergy|gluten|compare|versus|vs)\b/i.test(query);
  return words.length <= 7 && !needsReasoning;
}

async function aiDiscover(
  query: string,
  list: Merchant[]
): Promise<{
  merchants: Merchant[];
  spoken?: string;
  clarifyingQuestion?: string;
} | null> {
  if (list.length === 0) return null;
  const result = await llmJSON<LlmDiscoverResult>(
    SYSTEM_PROMPT,
    `Customer request: "${query}"\n\nRegistered merchants (already filtered to within the customer's radius):\n${buildMerchantContext(list)}`
  );

  if (!result?.matches?.length) return null;

  const merchants: Merchant[] = [];
  for (const match of result.matches) {
    const merchant = list.find((m) => m.id === match.id && m.isOpen);
    if (merchant && !merchants.find((x) => x.id === merchant.id)) {
      merchants.push({ ...merchant, aiReason: match.reason } as Merchant & { aiReason: string });
    }
  }
  if (merchants.length === 0) return null;

  return {
    merchants,
    spoken: result.spoken,
    clarifyingQuestion: result.clarifyingQuestion || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxDistance } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const radius = typeof maxDistance === 'number' && maxDistance > 0 ? maxDistance : 99;
    const withinRadius = merchantsDB.filter((m) => m.isOpen && distanceOf(m) <= radius);

    // Deterministic matching is dramatically faster for requests like "coffee" or "biryani".
    const fallbackMerchants = (await searchMerchants(query)).filter((m) => distanceOf(m) <= radius);
    const fastPath = canUseFastPath(query, fallbackMerchants);
    // Ranking may reorder relevant candidates, but may not introduce unrelated shops.
    const eligible = hasProductIntent(query) ? fallbackMerchants : withinRadius;
    const ai = fastPath ? null : await aiDiscover(query, eligible);
    const merchants = fastPath ? fallbackMerchants : (ai?.merchants ?? fallbackMerchants);
    const usedAI = Boolean(ai);

    const response = {
      success: true,
      agent: 'MerchantDiscoveryAgent',
      mode: fastPath ? 'keyword-fast' : usedAI ? 'llm' : llmEnabled() ? 'llm-fallback' : 'keyword',
      query,
      timestamp: new Date().toISOString(),
      results: {
        merchants,
        count: merchants.length,
        message:
          merchants.length > 0
            ? `Found ${merchants.length} merchant${merchants.length > 1 ? 's' : ''} matching your request`
            : 'No merchants found for your query. Try broadening your search.',
        spoken: ai?.spoken,
        clarifyingQuestion: ai?.clarifyingQuestion,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Merchant Discovery Agent Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
