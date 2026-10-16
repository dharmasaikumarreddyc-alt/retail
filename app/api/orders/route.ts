import { NextRequest, NextResponse } from 'next/server';
import { addOrder, getOrders, type Order } from './store';

const productionUnavailable = () =>
  NextResponse.json(
    { success: false, error: 'Order history is disabled until authenticated persistent order storage is configured.' },
    { status: 503 },
  );

export async function GET() {
  if (process.env.NODE_ENV === 'production') return productionUnavailable();
  return NextResponse.json({ success: true, orders: getOrders() });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return productionUnavailable();
  try {
    const order: Order = await request.json();
    addOrder(order);
    return NextResponse.json({ success: true, order });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
