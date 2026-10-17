import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus, type OrderStatus } from '../store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Order history is disabled until authenticated persistent order storage is configured.' },
      { status: 503 },
    );
  }
  const { id } = await params;
  const order = getOrder(id);

  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, order });
}

// PATCH /api/orders/[id] - Update order status (used by the merchant console)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Order updates are disabled until authenticated persistent order storage is configured.' },
      { status: 503 },
    );
  }
  const { id } = await params;
  const body = await request.json();
  const status = body?.status as OrderStatus;

  const valid: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!valid.includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  }

  const order = updateOrderStatus(id, status);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, order });
}
