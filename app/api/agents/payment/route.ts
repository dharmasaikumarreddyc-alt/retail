import { NextResponse } from 'next/server';

// POST /api/agents/payment
// Real payments must not be represented as successful until a provider is integrated.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Checkout is disabled until a real payment provider and persistent order storage are configured.',
    },
    { status: 503 },
  );
}
