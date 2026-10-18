import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

// POST /api/agents/call
// Triggers a Bland.ai outbound demo call so a customer can experience the
// agent by phone. Reads BLAND_API_KEY from env; falls back to a stub response
// so the demo still renders when the key is missing.

const DEFAULT_PHONE = process.env.BLAND_DEMO_PHONE || '+918499077262';
const DEFAULT_TASK =
  'You are the Loopora agentic checkout assistant. Greet the caller, ' +
  'briefly explain that you can order food, groceries and gifts on their behalf ' +
  'across multiple merchants, ask what they would like to try, and take a simple ' +
  'demo order. Keep the whole call under two minutes and end warmly.';

// Corp proxies intercept TLS and Node can't verify the certificate for
// api.bland.ai, so we use the built-in https module with rejectUnauthorized:false.
function postJson(url: URL, headers: Record<string, string>, payload: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        port: url.port || 443,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload).toString() },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Bland.ai request timed out')));
    req.write(payload);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  const key = process.env.BLAND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'BLAND_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const phone = (body?.phone_number as string) || DEFAULT_PHONE;
  const task = (body?.task as string) || DEFAULT_TASK;

  const payload = JSON.stringify({
    phone_number: phone,
    task,
    voice: 'nat',
    max_duration: 3,
  });

  try {
    const { status, body: raw } = await postJson(
      new URL('https://api.bland.ai/v1/calls'),
      { 'Content-Type': 'application/json', authorization: key },
      payload
    );

    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (status < 200 || status >= 300) {
      return NextResponse.json(
        { ok: false, status, error: data?.message || 'Bland.ai call failed', data },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, phone, call_id: data?.call_id ?? null, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'Network error contacting Bland.ai' },
      { status: 502 }
    );
  }
}
