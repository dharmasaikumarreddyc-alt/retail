import { NextRequest } from 'next/server';
import { buildChatRequest } from '../llm';

// POST /api/agents/narrate
// Streams the agent's "thinking" as plain-text deltas while the real work runs.
// Transforms the upstream OpenAI-style SSE into a simple text stream the client
// can read incrementally. Falls back to a canned narration if no LLM is configured.

const SYSTEM = `You are an autonomous shopping agent narrating your work out loud as you fulfil a request.
Write 4 to 5 very short first-person lines, one action per line, present tense
(e.g. "Scanning nearby merchants...", "Comparing vegan breakfast options...", "Locking in the best match...").
No preamble, no markdown, no numbering. Keep each line under 8 words.`;

function textStream(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const l of lines) {
        controller.enqueue(encoder.encode(l + '\n'));
        await new Promise((r) => setTimeout(r, 450));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST(request: NextRequest) {
  const { query } = await request.json().catch(() => ({ query: '' }));

  const req = await buildChatRequest();
  if (!req) {
    return textStream([
      'Understanding your request...',
      'Scanning nearby merchants...',
      'Matching the best options...',
      'Preparing your order...',
    ]);
  }

  const body: Record<string, unknown> = {
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Request: "${query}"` },
    ],
  };
  if (req.supportsTemperature) body.temperature = 0.5;
  if (req.modelField) body.model = req.modelField;

  let upstream: Response;
  try {
    upstream = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
    });
  } catch {
    return textStream(['Working on your request...']);
  }

  if (!upstream.ok || !upstream.body) {
    return textStream(['Working on your request...']);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              return;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* partial chunk — wait for more */
            }
          }
        }
      } catch {
        /* upstream closed */
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
