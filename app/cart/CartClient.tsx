'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { backendUrl } from '../lib/backend';
import { clearAuthenticatedToken, getAuthenticatedSession } from '../lib/auth';

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

export default function CartClient() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCart();

    // Listen for cart updates from other components
    const handleCartUpdate = () => {
      fetchCart();
    };
    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, []);

  useEffect(() => {
    // Initialize bootstrap-touchspin for quantity inputs
    if (cart && cart.items.length > 0) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).$) {
          const $ = (window as any).$;
          try {
            $('input[name="demo_vertical2"]').each(function(this: any) {
              const $input = $(this);
              if (!$input.data('TouchSpin')) {
                $input.TouchSpin({
                  verticalbuttons: true,
                  verticalup: '<i class="ti-plus"></i>',
                  verticaldown: '<i class="ti-minus"></i>',
                  min: 1,
                  max: 100,
                });

                // Handle value change
                $input.on('change', function(this: any) {
                  const newValue = parseInt($(this).val()) || 1;
                  const itemKey = $(this).closest('tr').find('.product-item-name').text();
                  // Find matching cart item and update
                  const cartItem = cart.items.find(item => item.name === itemKey.trim());
                  if (cartItem) {
                    updateQuantity(cartItem.merchant_id, cartItem.product_id, newValue);
                  }
                });
              }
            });
          } catch (e) {
            console.debug('TouchSpin initialization skipped:', e);
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [cart]);

  const fetchCart = async () => {
    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${backendUrl}/cart`, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCart(data);
      } else if (response.status === 401) {
        clearAuthenticatedToken('customer');
        router.push('/login');
      } else {
        setError('Failed to load cart');
      }
    } catch (err) {
      setError('Error loading cart');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (merchantId: string, productId: string, newQuantity: number) => {
    const itemKey = `${merchantId}_${productId}`;
    setUpdating(itemKey);

    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) return;

      const response = await fetch(`${backendUrl}/cart/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          product_id: productId,
          quantity: newQuantity
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCart(data.cart);
        window.dispatchEvent(new Event('cartUpdated'));
      }
    } catch (error) {
      console.error('Error updating cart:', error);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (merchantId: string, productId: string) => {
    const itemKey = `${merchantId}_${productId}`;
    setUpdating(itemKey);

    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) return;

      const response = await fetch(
        `${backendUrl}/cart/remove?merchant_id=${merchantId}&product_id=${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCart(data.cart);
        window.dispatchEvent(new Event('cartUpdated'));
      }
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-5">
        <h4>Your cart is empty</h4>
        <p className="text-muted">Add some products to get started!</p>
        <Link href="/shop" className="btn btn-primary mt-3">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="row">
      <div className="col-lg-8">
        <div className="table-responsive">
          <table className="table check-tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th></th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => {
                const itemKey = `${item.merchant_id}_${item.product_id}`;
                const isUpdating = updating === itemKey;
                const itemSubtotal = item.price * item.quantity;

                return (
                  <tr key={itemKey}>
                    <td className="product-item-img">
                      <img src={item.image || '/images/shop/product/1.png'} alt={item.name} />
                    </td>
                    <td className="product-item-name">{item.name}</td>
                    <td className="product-item-price">${item.price.toFixed(2)}</td>
                    <td className="product-item-quantity">
                      <div className="quantity btn-quantity style-1 me-3">
                        <input
                          type="text"
                          value={item.quantity}
                          name="demo_vertical2"
                          readOnly
                        />
                        <div className="quantity-controls" style={{ display: 'none' }}>
                          <button
                            onClick={() => updateQuantity(item.merchant_id, item.product_id, item.quantity - 1)}
                            disabled={isUpdating || item.quantity <= 1}
                          >
                            -
                          </button>
                          <button
                            onClick={() => updateQuantity(item.merchant_id, item.product_id, item.quantity + 1)}
                            disabled={isUpdating}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="product-item-totle">${itemSubtotal.toFixed(2)}</td>
                    <td className="product-item-close">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          removeItem(item.merchant_id, item.product_id);
                        }}
                        style={{ pointerEvents: isUpdating ? 'none' : 'auto' }}
                      >
                        <i className="ti-close"></i>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row shop-form m-t30">
          <div className="col-md-6">
            <div className="form-group">
              <div className="input-group mb-0">
                <input name="dzEmail" required type="text" className="form-control" placeholder="Coupon Code" />
                <div className="input-group-addon">
                  <button name="submit" value="Submit" type="submit" className="btn coupon">
                    Apply Coupon
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6 text-end">
            <Link href="/shop" className="btn btn-secondary">UPDATE CART</Link>
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <h4 className="title mb15">Cart Total</h4>
        <div className="cart-detail">
          <Link href="#" className="btn btn-outline-secondary w-100 m-b20">Bank Offer 5% Cashback</Link>
          <div className="icon-bx-wraper style-4 m-b15">
            <div className="icon-bx">
              <i className="flaticon flaticon-ship"></i>
            </div>
            <div className="icon-content">
              <span className="font-14">FREE</span>
              <h6 className="dz-title">Enjoy The Product</h6>
            </div>
          </div>
          <div className="save-text">
            <i className="icon feather icon-check-circle"></i>
            <span className="m-l10">You will save ${(cart.subtotal * 0.05).toFixed(2)} on this order</span>
          </div>
          <table>
            <tbody>
              <tr className="total">
                <td>
                  <h6 className="mb-0">Total</h6>
                </td>
                <td className="price">
                  ${(cart.subtotal >= 100 ? cart.subtotal : cart.subtotal + 10).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
          <Link href="/checkout" className="btn btn-secondary w-100">PLACE ORDER</Link>
        </div>
      </div>
    </div>
  );
}
