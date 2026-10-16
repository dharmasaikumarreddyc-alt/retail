'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { backendUrl } from '../lib/backend';
import { clearAuthenticatedToken, getAuthenticatedSession } from '../lib/auth';

interface Product {
  id: string | number;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  image: string;
  category: string[];
  tags: string[];
  description: string;
  merchant: string;
  merchant_id?: string;
  location: string;
  rating: number;
  inStock: boolean;
}

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isInCart, setIsInCart] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
      setQuantity(1);
      checkIfInCart();
      // Trigger animation after mount
      setTimeout(() => setIsVisible(true), 10);
    } else {
      document.body.style.overflow = 'unset';
      setIsVisible(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [product]);

  const checkIfInCart = async () => {
    if (!product) return;

    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        setIsInCart(false);
        return;
      }

      const response = await fetch(`${backendUrl}/cart`, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const productId = typeof product.id === 'string'
          ? product.id.split('_')[1]
          : product.id.toString();

        const inCart = data.items?.some((item: any) =>
          item.product_id === productId || item.product_id === product.id.toString()
        );
        setIsInCart(inCart);
      }
    } catch (error) {
      console.error('Error checking cart:', error);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    const session = await getAuthenticatedSession('customer');
    if (!session) {
      // Redirect to login if not authenticated
      router.push('/login');
      return;
    }

    setIsAdding(true);

    try {
      // Parse merchant_id and product_id from combined ID
      let merchantId = product.merchant_id;
      let productId = product.id.toString();

      if (typeof product.id === 'string' && product.id.includes('_')) {
        const parts = product.id.split('_');
        merchantId = parts[0];
        productId = parts[1];
      }

      const response = await fetch(`${backendUrl}/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          product_id: productId,
          quantity: quantity
        })
      });

      if (response.ok) {
        setIsInCart(true);
        // Trigger a cart update event for other components
        window.dispatchEvent(new Event('cartUpdated'));
      } else if (response.status === 401) {
        // Token expired, redirect to login
        clearAuthenticatedToken('customer');
        router.push('/login');
      } else {
        console.error('Failed to add to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleGoToCart = () => {
    onClose();
    router.push('/cart');
  };

  if (!product) return null;

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      stars.push(
        <li
          key={i}
          className={i < fullStars ? 'star-fill' : ''}
        >
          <i className="flaticon-star-1"></i>
        </li>
      );
    }
    return stars;
  };

  const reviewCount = Math.floor(product.rating * 100) + 50;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className={`modal-backdrop fade ${isVisible ? 'show' : ''}`}
        style={{
          zIndex: 1040,
          transition: 'opacity 0.3s ease-in-out',
          opacity: isVisible ? 0.5 : 0
        }}
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div
        className={`modal quick-view-modal fade ${isVisible ? 'show' : ''}`}
        style={{
          display: 'block',
          zIndex: 1050,
          transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.9)'
        }}
        tabIndex={-1}
        role="dialog"
        aria-hidden="false"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="icon feather icon-x"></i>
            </button>
            <div className="modal-body">
              <div className="row g-xl-4 g-3">
                <div className="col-xl-6 col-md-6">
                  <div className="dz-product-detail mb-0">
                    <div className="dz-media">
                      <img src={product.image} alt={product.name} className="img-fluid" />
                    </div>
                  </div>
                </div>
                <div className="col-xl-6 col-md-6">
                  <div className="dz-product-detail style-2 ps-xl-3 ps-0 pt-2 mb-0">
                    <div className="dz-content">
                      <div className="dz-content-footer">
                        <div className="dz-content-start">
                          {product.discount && (
                            <span className="badge bg-secondary mb-2">{product.discount}</span>
                          )}
                          <h4 className="title mb-1">
                            <Link href={`/shop/${product.id}`}>{product.name}</Link>
                          </h4>
                          <div className="review-num">
                            <ul className="dz-rating me-2">
                              {renderStars(product.rating)}
                            </ul>
                            <span className="text-secondary me-2">{product.rating} Rating</span>
                            <a href="#">({reviewCount} customer reviews)</a>
                          </div>
                        </div>
                      </div>
                      <p className="para-text">
                        {product.description}
                      </p>
                      <div className="meta-content m-b20 d-flex align-items-end">
                        <div className="me-3">
                          <span className="form-label">Price</span>
                          <span className="price">
                            ${product.price.toFixed(2)}
                            {product.originalPrice && (
                              <> <del>${product.originalPrice.toFixed(2)}</del></>
                            )}
                          </span>
                        </div>
                        <div className="btn-quantity light me-0">
                          <label className="form-label">Quantity</label>
                          <div className="input-group">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              type="button"
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                              -
                            </button>
                            <input
                              type="text"
                              className="form-control text-center"
                              value={quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setQuantity(Math.max(1, val));
                              }}
                              style={{ width: '60px' }}
                            />
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              type="button"
                              onClick={() => setQuantity(quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="cart-btn">
                        {isInCart ? (
                          <button
                            onClick={handleGoToCart}
                            className="btn btn-secondary text-uppercase"
                          >
                            Go To Cart
                          </button>
                        ) : (
                          <button
                            onClick={handleAddToCart}
                            className="btn btn-secondary text-uppercase"
                            disabled={isAdding}
                          >
                            {isAdding ? 'Adding...' : 'Add To Cart'}
                          </button>
                        )}
                        <a
                          href="#"
                          className="btn btn-md btn-outline-secondary btn-icon"
                        >
                          <svg
                            width="19"
                            height="17"
                            viewBox="0 0 19 17"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M9.24805 16.9986C8.99179 16.9986 8.74474 16.9058 8.5522 16.7371C7.82504 16.1013 7.12398 15.5038 6.50545 14.9767L6.50229 14.974C4.68886 13.4286 3.12289 12.094 2.03333 10.7794C0.815353 9.30968 0.248047 7.9162 0.248047 6.39391C0.248047 4.91487 0.755203 3.55037 1.67599 2.55157C2.60777 1.54097 3.88631 0.984375 5.27649 0.984375C6.31552 0.984375 7.26707 1.31287 8.10464 1.96065C8.52734 2.28763 8.91049 2.68781 9.24805 3.15459C9.58574 2.68781 9.96875 2.28763 10.3916 1.96065C11.2292 1.31287 12.1807 0.984375 13.2197 0.984375C14.6098 0.984375 15.8885 1.54097 16.8202 2.55157C17.741 3.55037 18.248 4.91487 18.248 6.39391C18.248 7.9162 17.6809 9.30968 16.4629 10.7792C15.3733 12.094 13.8075 13.4285 11.9944 14.9737C11.3747 15.5016 10.6726 16.1001 9.94376 16.7374C9.75136 16.9058 9.50417 16.9986 9.24805 16.9986ZM5.27649 2.03879C4.18431 2.03879 3.18098 2.47467 2.45108 3.26624C1.71033 4.06975 1.30232 5.18047 1.30232 6.39391C1.30232 7.67422 1.77817 8.81927 2.84508 10.1066C3.87628 11.3509 5.41011 12.658 7.18605 14.1715L7.18935 14.1743C7.81021 14.7034 8.51402 15.3033 9.24654 15.9438C9.98344 15.302 10.6884 14.7012 11.3105 14.1713C13.0863 12.6578 14.6199 11.3509 15.6512 10.1066C16.7179 8.81927 17.1938 7.67422 17.1938 6.39391C17.1938 5.18047 16.7858 4.06975 16.045 3.26624C15.3152 2.47467 14.3118 2.03879 13.2197 2.03879C12.4197 2.03879 11.6851 2.29312 11.0365 2.79465C10.4585 3.24179 10.0558 3.80704 9.81975 4.20255C9.69835 4.40593 9.48466 4.52733 9.24805 4.52733C9.01143 4.52733 8.79774 4.40593 8.67635 4.20255C8.44041 3.80704 8.03777 3.24179 7.45961 2.79465C6.811 2.29312 6.07643 2.03879 5.27649 2.03879Z"
                              fill="currentColor"
                            ></path>
                          </svg>
                          Add To Wishlist
                        </a>
                      </div>
                      <div className="dz-info mb-0">
                        <ul>
                          <li>
                            <strong>Category:</strong>
                          </li>
                          {product.category.map((cat, idx) => (
                            <li key={idx}>
                              <Link href="/shop">{cat}{idx < product.category.length - 1 ? ',' : ''}</Link>
                            </li>
                          ))}
                        </ul>
                        <ul>
                          <li>
                            <strong>Tags:</strong>
                          </li>
                          {product.tags.map((tag, idx) => (
                            <li key={idx}>
                              <Link href="/shop">{tag}{idx < product.tags.length - 1 ? ',' : ''}</Link>
                            </li>
                          ))}
                        </ul>
                        <ul>
                          <li>
                            <strong>Merchant:</strong>
                          </li>
                          <li>{product.merchant}</li>
                        </ul>
                        <ul>
                          <li>
                            <strong>Location:</strong>
                          </li>
                          <li>{product.location}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
