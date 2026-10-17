'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { backendUrl } from '../lib/backend';
import { getAuthenticatedSession } from '../lib/auth';
import {
  formatCustomerAddress,
  readCustomerAddresses,
  type CustomerAddress,
} from '../lib/customer-addresses';

interface CartItem {
  merchant_id: string;
  merchant_name: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartData {
  items: CartItem[];
  count: number;
  subtotal: number;
  total: number;
}

interface PlacedOrder {
  orderId: string;
  merchantName: string;
  total: number;
  paymentMethod: string;
}

const emptyAddress: CustomerAddress = {
  id: '',
  name: '',
  label: 'Delivery address',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  phone: '',
  isDefault: false,
};

export default function CheckoutClient() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [address, setAddress] = useState<CustomerAddress>(emptyAddress);
  const [instructions, setInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'wallet' | 'cod'>('cod');
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        router.replace('/login');
        return;
      }
      try {
        const savedAddresses = readCustomerAddresses();
        const preferredAddress = savedAddresses.find((entry) => entry.isDefault) || savedAddresses[0];
        if (!cancelled) {
          setAddresses(savedAddresses);
          setAddress(preferredAddress || emptyAddress);
          setInstructions(localStorage.getItem('cartCookingInstructions') || '');
        }

        const response = await fetch(`${backendUrl}/cart`, {
          headers: { Authorization: `Bearer ${session.token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Could not load your cart. Please try again.');
        const data: CartData = await response.json();
        if (!cancelled) setCart(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load checkout details.');
          setCart({ items: [], count: 0, subtotal: 0, total: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const updateAddress = (field: keyof CustomerAddress, value: string) => {
    setAddress((current) => ({ ...current, [field]: value }));
  };

  const chooseAddress = (id: string) => {
    const selected = addresses.find((entry) => entry.id === id);
    if (selected) setAddress(selected);
    else setAddress(emptyAddress);
  };

  const placeOrders = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!cart?.items.length) {
      setError('Your cart is empty.');
      return;
    }
    const requiredFields = [
      ['name', 'Name'],
      ['street', 'Street address'],
      ['city', 'City'],
      ['state', 'State'],
      ['zipCode', 'ZIP code'],
      ['country', 'Country'],
      ['phone', 'Phone number'],
    ] as const;
    const missingField = requiredFields.find(([field]) => !address[field].trim());
    if (missingField) {
      setError(`Please enter your ${missingField[1]} before placing the order.`);
      return;
    }

    setSubmitting(true);
    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        router.replace('/login');
        return;
      }
      const deliveryAddress = formatCustomerAddress(address);
      const groups = new Map<string, CartItem[]>();
      for (const item of cart.items) {
        groups.set(item.merchant_id, [...(groups.get(item.merchant_id) || []), item]);
      }
      const orders: PlacedOrder[] = [];
      for (const [merchantId, items] of groups) {
        const response = await fetch(`${backendUrl}/payments/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            merchantId,
            items: items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
            paymentMethod,
            deliveryAddress,
            cookingInstructions: instructions.trim(),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || data.error || 'Could not place your order.');
        if (!data.order?.orderId) throw new Error('The order service returned an invalid response.');
        orders.push({
          orderId: data.order.orderId,
          merchantName: data.order.merchantName,
          total: data.order.pricing.total,
          paymentMethod: data.payment.method,
        });
      }

      setPlacedOrders(orders);
      localStorage.removeItem('cartCookingInstructions');
      const clearResponse = await fetch(`${backendUrl}/cart/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!clearResponse.ok) {
        setError('Your order was placed, but the cart could not be cleared. Please refresh your cart before ordering again.');
      }
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (placeError) {
      setError(placeError instanceof Error ? placeError.message : 'Could not place your order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>;
  }

  if (placedOrders.length > 0) {
    return (
      <div className="container py-5">
        <div className="card card-body">
          <h2 className="text-success">Order placed!</h2>
          <p>Your order is confirmed.</p>
          {error && <div className="alert alert-warning">{error}</div>}
          {placedOrders.map((order) => (
            <section key={order.orderId} className="border rounded p-3 mb-3">
              <h5 className="mb-1">{order.merchantName}</h5>
              <p className="text-muted mb-2">
                Order #{order.orderId} · ${order.total.toFixed(2)} · Mode of payment: {order.paymentMethod.toUpperCase()}
              </p>
              <Link href={`/account/orders/${order.orderId}`} className="btn btn-outline-primary">
                View order, rate & review
              </Link>
            </section>
          ))}
          <div className="d-flex gap-2 flex-wrap">
            <Link href="/account/orders" className="btn btn-primary">View your orders</Link>
            <Link href="/shop" className="btn btn-outline-secondary">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart?.items.length) {
    return (
      <div className="container py-5 text-center">
        <h4>Your cart is empty</h4>
        <p className="text-muted">Add some items before checking out.</p>
        <Link href="/shop" className="btn btn-secondary">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <form className="row g-4" onSubmit={placeOrders}>
        <div className="col-xl-7">
          <section className="card card-body mb-4">
            <h4 className="mb-3">Delivery address</h4>
            {addresses.length > 0 && (
              <div className="mb-3">
                <label className="form-label" htmlFor="saved-address">Use a saved address</label>
                <select
                  id="saved-address"
                  className="form-select"
                  value={addresses.some((entry) => entry.id === address.id) ? address.id : ''}
                  onChange={(event) => chooseAddress(event.target.value)}
                >
                  <option value="">Enter a different address</option>
                  {addresses.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}: {[entry.street, entry.city].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="row g-3">
              {([
                ['name', 'Full name'],
                ['phone', 'Phone number'],
                ['street', 'House number and street'],
                ['city', 'City'],
                ['state', 'State'],
                ['zipCode', 'ZIP / postcode'],
                ['country', 'Country'],
              ] as const).map(([field, label]) => (
                <div className={field === 'street' ? 'col-12' : 'col-md-6'} key={field}>
                  <label className="form-label" htmlFor={`delivery-${field}`}>{label} *</label>
                  <input
                    id={`delivery-${field}`}
                    className="form-control"
                    value={address[field]}
                    onChange={(event) => updateAddress(field, event.target.value)}
                    required
                    maxLength={field === 'street' ? 300 : 100}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="card card-body mb-4">
            <h4 className="mb-2">Cooking instructions</h4>
            <p className="text-muted">Optional notes for the restaurant, such as spice level or allergies.</p>
            <textarea
              className="form-control"
              rows={3}
              maxLength={1000}
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                localStorage.setItem('cartCookingInstructions', event.target.value);
              }}
              placeholder="Add cooking instructions (optional)"
            />
          </section>

          <section className="card card-body">
            <h4 className="mb-3">Payment preference</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {([
                ['cod', 'Cash on delivery'],
                ['upi', 'UPI'],
                ['card', 'Card'],
                ['wallet', 'Wallet'],
              ] as const).map(([method, label]) => (
                <div key={method} style={{ minWidth: 0 }}>
                  <label
                    className={`d-flex align-items-center gap-2 border rounded p-2 h-100 ${paymentMethod === method ? 'border-primary bg-light' : ''}`}
                    style={{ cursor: 'pointer', minWidth: 0, overflowWrap: 'normal' }}
                  >
                    <input
                      className="form-check-input m-0 flex-shrink-0"
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                    />
                    <span className="lh-sm" style={{ overflowWrap: 'normal', wordBreak: 'normal' }}>{label}</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="col-xl-5">
          <section className="card card-body">
            <h4 className="mb-3">Your order</h4>
            {cart.items.map((item) => (
              <div className="d-flex justify-content-between gap-3 py-2 border-bottom" key={`${item.merchant_id}-${item.product_id}`}>
                <span>{item.quantity} × {item.name}<small className="d-block text-muted">{item.merchant_name}</small></span>
                <strong>${(item.price * item.quantity).toFixed(2)}</strong>
              </div>
            ))}
            <div className="d-flex justify-content-between mt-3">
              <strong>Cart subtotal</strong><strong>${cart.subtotal.toFixed(2)}</strong>
            </div>
            <p className="small text-muted mt-2">Final fees and totals are calculated by the order service.</p>
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            <button type="submit" className="btn btn-secondary w-100 mt-2" disabled={submitting}>
              {submitting ? 'Placing order…' : 'PLACE ORDER'}
            </button>
          </section>
        </aside>
      </form>
    </div>
  );
}
