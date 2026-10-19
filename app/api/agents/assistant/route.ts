import { NextRequest, NextResponse } from 'next/server';
import { llmJSON } from '../llm';

// POST /api/agents/assistant
// Conversational concierge brain. Obvious shopping/stop requests are routed
// locally for low-latency voice UX; ambiguous conversation still uses the LLM.

const SYSTEM_PROMPT = `You are "Aisle", a warm, witty voice shopping concierge — think Siri or Jarvis — for a
local marketplace that can find and order from nearby merchants (coffee shops, restaurants, bakeries, grocery stores).

Classify the user's message and reply in a natural, spoken style (no markdown, no emojis).
Respond with ONLY this JSON:
{
  "intent": "order" | "chat" | "stop",
  "reply": "<what you say out loud>",
  "orderQuery": "<for order intent: a concise normalized request, e.g. 'coffee and a vegan breakfast'; else empty>"
}

Rules:
- "order": the user wants to buy / order / get food, drinks, groceries, etc. reply = a short friendly acknowledgement (max 12 words). Set orderQuery.
- "stop": the user is ending the chat or thanking you to finish. reply = a warm goodbye (max 14 words).
- "chat": anything else — questions, small talk, "what can you do". reply = concise and helpful.
Be friendly and human, like a personal assistant.`;

interface AssistantResult {
  intent?: 'order' | 'chat' | 'stop';
  reply?: string;
  orderQuery?: string;
}

const ORDER_HINT = /\b(order|buy|get me|grab|want|need|show me|find|coffee|tea|latte|cappuccino|espresso|americano|breakfast|lunch|dinner|food|grocery|groceries|cake|pastry|pizza|biryani|dosa|idli|snack|hungry|eat|drink|ingredients?)\b/i;
const STOP_HINT = /\b(that's it|thats it|that's all|thats all|stop|done|bye|goodbye|thank you|thanks|no more|nothing else|that is all)\b/i;

function fallback(message: string): AssistantResult {
  const m = message.toLowerCase();
  if (STOP_HINT.test(m) && !ORDER_HINT.test(m)) {
    return { intent: 'stop', reply: 'Anytime! It was a pleasure helping you. Talk soon!', orderQuery: '' };
  }
  if (ORDER_HINT.test(m)) {
    return { intent: 'order', reply: '', orderQuery: message.trim() };
  }
  return {
    intent: 'chat',
    reply: "I can find and order from local coffee shops, restaurants, bakeries and grocery stores. Just tell me what you're craving!",
    orderQuery: '',
  };
}

export async function POST(request: NextRequest) {
  const { message } = await request.json().catch(() => ({ message: '' }));
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ success: true, ...fallback('') });
  }

  const quick = fallback(message);

  // Voice shopping should feel instant. Do not spend an LLM round-trip on
  // unambiguous order/stop phrases such as "coffee", "I want biryani", or "done".
  if (quick.intent === 'order' || quick.intent === 'stop') {
    return NextResponse.json({ success: true, ...quick });
  }

  const result = await llmJSON<AssistantResult>(SYSTEM_PROMPT, `User said: "${message}"`, { temperature: 0.6 });
  const out = result?.intent ? result : quick;

  return NextResponse.json({
    success: true,
    intent: out.intent ?? 'chat',
    reply: out.reply ?? "I'm here to help you order from nearby merchants.",
    orderQuery: out.orderQuery ?? '',
  });
}
