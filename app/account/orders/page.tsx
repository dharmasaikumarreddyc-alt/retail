'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import AccountSidebar from '../../components/AccountSidebar';
import { getAuthenticatedSession } from '../../lib/auth';
import { backendUrl } from '../../lib/backend';

interface Order {
  id: string;
  merchantName: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  pricing: {
    subtotal: number;
    serviceFee: number;
    deliveryFee: number;
    tax: number;
    loyaltyDiscount: number;
    total: number;
  };
  status: string;
  createdAt: string;
}

interface BackendOrder {
  id: string;
  merchantName: string;
  items: Array<{
    productId?: string;
    product_id?: string;
    name: string;
    price: number;
    quantity?: number;
    qty?: number;
    image?: string;
  }>;
  pricing?: Order['pricing'];
  total: number;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        router.replace('/login');
        return;
      }
      const response = await fetch(`${backendUrl}/orders`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!response.ok) throw new Error('Could not load your order history.');
      const data: BackendOrder[] = await response.json();
      setOrders(data.map((order) => {
        const items = order.items.map((item) => ({
          productId: item.productId || item.product_id || item.name,
          name: item.name,
          price: item.price,
          quantity: item.quantity ?? item.qty ?? 1,
          image: item.image || '/images/shop/small/pic1.png',
        }));
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        return {
          id: order.id,
          merchantName: order.merchantName,
          items,
          pricing: order.pricing || {
            subtotal,
            serviceFee: 0,
            deliveryFee: 0,
            tax: 0,
            loyaltyDiscount: 0,
            total: order.total,
          },
          status: order.status,
          createdAt: order.createdAt,
        };
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const loadOrders = async () => {
      await fetchOrders();
    };
    void loadOrders();
  }, [fetchOrders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; label: string }> = {
      pending: { bg: 'bg-warning', label: 'Pending' },
      confirmed: { bg: 'bg-info', label: 'Confirmed' },
      preparing: { bg: 'bg-info', label: 'In Progress' },
      ready: { bg: 'bg-primary', label: 'Ready' },
      delivered: { bg: 'bg-success', label: 'Delivered' },
      cancelled: { bg: 'bg-danger', label: 'Cancelled' },
    };
    const statusInfo = statusMap[status] || { bg: 'bg-secondary', label: status };
    return <span className={`badge ${statusInfo.bg} m-0`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="page-content bg-light">
          <div className="container py-5 text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="page-content bg-light">
        {/* Banner */}
      <div className="dz-bnr-inr bg-secondary overlay-black-light" style={{ backgroundImage: 'url(/images/background/bg1.jpg)' }}>
        <div className="container">
          <div className="dz-bnr-inr-entry">
            <h1>Orders</h1>
            <nav aria-label="breadcrumb" className="breadcrumb-row">
              <ul className="breadcrumb">
                <li className="breadcrumb-item"><Link href="/">Home</Link></li>
                <li className="breadcrumb-item">Orders</li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <div className="content-inner-1">
        <div className="container">
          <div className="row">
            <AccountSidebar />

            <div className="col-xl-9 account-wrapper">
              <div className="account-card">
                {orders.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                      </svg>
                    </div>
                    <h5 className="mb-3">No orders yet</h5>
                    <p className="text-muted mb-4">You haven&apos;t placed any orders yet. Start shopping with Cart Pilot!</p>
                    <Link href="/cart-pilot" className="btn btn-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                        <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
                      </svg>
                      Try Cart Pilot AI
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive table-style-1">
                      <table className="table table-hover mb-3">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>Date Purchased</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <tr key={order.id}>
                              <td>
                                <Link href={`/account/orders/${order.id}`} className="fw-medium">
                                  #{order.id}
                                </Link>
                              </td>
                              <td>{formatDate(order.createdAt)}</td>
                              <td>{getStatusBadge(order.status)}</td>
                              <td>${order.pricing.total.toFixed(2)}</td>
                              <td>
                                <Link href={`/account/orders/${order.id}`} className="btn-link text-underline p-0">
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {orders.length > 10 && (
                      <div className="d-flex justify-content-center">
                        <nav aria-label="Table Pagination">
                          <ul className="pagination style-1">
                            <li className="page-item"><a className="page-link" href="#">Prev</a></li>
                            <li className="page-item"><a className="page-link" href="#">1</a></li>
                            <li className="page-item"><a className="page-link" href="#">Next</a></li>
                          </ul>
                        </nav>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
