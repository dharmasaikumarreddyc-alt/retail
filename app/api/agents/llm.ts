import { GoogleAuth } from 'google-auth-library';

const USE_VERTEX = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
const vertexAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

// Reusable LLM client for the agent API routes.
//
// Vertex AI is preferred when GOOGLE_GENAI_USE_VERTEXAI=true.
// Otherwise supports these backends, selected automatically by env vars:
//   1. Azure OpenAI  — set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_DEPLOYMENT
//   2. GitHub Models / Azure AI Inference (OpenAI-compatible) — set GITHUB_MODELS_TOKEN
//
// Hackathon notes:
// - Secrets are read from process.env (see .env.local), never hardcoded.
// - Every helper fails *soft*: if the key is missing, the network call errors,
//   or the model returns junk, we return null so callers can fall back to the
//   existing keyword/mock logic. The demo never hard-crashes.

// Azure OpenAI configuration
const AZURE_ENDPOINT_RAW = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_ENDPOINT = AZURE_ENDPOINT_RAW.endsWith('/') ? AZURE_ENDPOINT_RAW.slice(0, -1) : AZURE_ENDPOINT_RAW;
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';

// GitHub Models / Azure AI Inference (fallback)
const GH_BASE_URL = process.env.GITHUB_MODELS_BASE_URL || 'https://models.inference.ai.azure.com';
const GH_MODEL = process.env.GITHUB_MODELS_MODEL || 'gpt-4o';
const GH_TOKEN = process.env.GITHUB_MODELS_TOKEN;

const USE_AZURE = Boolean(AZURE_ENDPOINT && AZURE_API_KEY && AZURE_DEPLOYMENT);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function llmEnabled(): boolean {
  return USE_VERTEX || USE_AZURE || Boolean(GH_TOKEN);
}

/**
 * Build the request URL + headers for the active backend.
 * Exported so the streaming narrate route can reuse the same auth logic.
 */
export async function buildChatRequest(): Promise<{ url: string; headers: Record<string, string>; modelField?: string; supportsTemperature: boolean } | null> {
  if (USE_VERTEX) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    if (!project) return null;
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    try {
      const token = await vertexAuth.getAccessToken();
      if (!token) return null;
      return {
        url: `https://${host}/v1beta1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        modelField: `google/${(process.env.GOOGLE_MODEL || 'gemini-3.8-flash').replace(/^google\//, '')}`,
        supportsTemperature: true,
      };
    } catch {
      console.error('[llm] Vertex authentication failed');
      return null;
    }
  }
  if (USE_AZURE) {
    return {
      url: `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_API_KEY!,
      },
      // GPT-5 family deployments reject any non-default temperature.
      supportsTemperature: false,
    };
  }
  if (GH_TOKEN) {
    return {
      url: `${GH_BASE_URL}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GH_TOKEN}`,
      },
      modelField: GH_MODEL,
      supportsTemperature: true,
    };
  }
  return null;
}

/**
 * Low-level chat completion. Returns the assistant message text, or null on any failure.
 */
export async function llmChat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  const req = await buildChatRequest();
  if (!req) return null;

  const { json = false, temperature = 0.3, timeoutMs = 12000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    };
    if (req.supportsTemperature) body.temperature = temperature;
    if (req.modelField) body.model = req.modelField;

    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error('[llm] request failed', res.status);
      return null;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    console.error('[llm] request failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chat completion that expects a JSON object back. Returns the parsed object, or null.
 * Tolerates models that wrap JSON in prose or ```json fences.
 */
export async function llmJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: { temperature?: number } = {}
): Promise<T | null> {
  const raw = await llmChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true, temperature: opts.temperature ?? 0.3 }
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Best-effort: pull the first {...} block out of the text.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    console.error('[llm] could not parse JSON from:', raw.slice(0, 200));
    return null;
  }
}
