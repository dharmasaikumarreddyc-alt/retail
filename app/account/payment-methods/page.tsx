'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import AccountSidebar from '../../components/AccountSidebar';
import { getAuthenticatedSession } from '../../lib/auth';

type PaymentMethodType = 'card' | 'upi' | 'wallet';

interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  details: string; // Card last 4 digits, UPI ID, or Wallet name
  isDefault: boolean;
}

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedType, setSelectedType] = useState<PaymentMethodType>('card');

  const [formData, setFormData] = useState<Partial<PaymentMethod>>({
    name: '',
    details: '',
    isDefault: false,
  });

  useEffect(() => {
    const verifyAndLoad = async () => {
      if (!(await getAuthenticatedSession('customer'))) {
        router.replace('/login');
        return;
      }
      fetchPaymentMethods();
    };
    void verifyAndLoad();
  }, [router]);

  const fetchPaymentMethods = () => {
    // Load from localStorage
    const saved = localStorage.getItem('userPaymentMethods');
    if (saved) {
      setPaymentMethods(JSON.parse(saved));
    } else {
      // Default demo methods
      setPaymentMethods([
        {
          id: 'pm-1',
          type: 'card',
          name: 'Visa Credit Card',
          details: '4242',
          isDefault: true,
        },
        {
          id: 'pm-2',
          type: 'upi',
          name: 'Paytm UPI',
          details: 'user@paytm',
          isDefault: false,
        },
      ]);
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type: selectedType,
      ...formData,
    } as PaymentMethod;

    let updatedMethods = [...paymentMethods, newMethod];

    // If setting as default, unset others
    if (formData.isDefault) {
      updatedMethods = updatedMethods.map(pm => ({
        ...pm,
        isDefault: pm.id === newMethod.id,
      }));
    }

    setPaymentMethods(updatedMethods);
    localStorage.setItem('userPaymentMethods', JSON.stringify(updatedMethods));

    setMessage('Payment method added successfully!');
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    const updatedMethods = paymentMethods.filter(pm => pm.id !== id);
    setPaymentMethods(updatedMethods);
    localStorage.setItem('userPaymentMethods', JSON.stringify(updatedMethods));
    setMessage('Payment method deleted successfully!');
  };

  const handleSetDefault = (id: string) => {
    const updatedMethods = paymentMethods.map(pm => ({
      ...pm,
      isDefault: pm.id === id,
    }));
    setPaymentMethods(updatedMethods);
    localStorage.setItem('userPaymentMethods', JSON.stringify(updatedMethods));
    setMessage('Default payment method updated!');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      details: '',
      isDefault: false,
    });
    setSelectedType('card');
    setShowForm(false);
  };

  const getIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'card':
        return 'fa-credit-card';
      case 'upi':
        return 'fa-mobile-alt';
      case 'wallet':
        return 'fa-wallet';
    }
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
              <h1>Payment Methods</h1>
              <nav aria-label="breadcrumb" className="breadcrumb-row">
                <ul className="breadcrumb">
                  <li className="breadcrumb-item"><Link href="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link href="/account/dashboard">Account</Link></li>
                  <li className="breadcrumb-item">Payment Methods</li>
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
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="mb-0">Saved Payment Methods</h5>
                    {!showForm && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowForm(true)}
                      >
                        <i className="fa fa-plus me-2"></i>Add Payment Method
                      </button>
                    )}
                  </div>

                  {message && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                      <i className="fa fa-check-circle me-2"></i>{message}
                      <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
                    </div>
                  )}

                  {showForm && (
                    <div className="card mb-4 border-secondary">
                      <div className="card-body">
                        <h6 className="card-title mb-3">Add New Payment Method</h6>

                        {/* Payment Type Selector */}
                        <div className="mb-4">
                          <label className="form-label">Select Payment Type</label>
                          <div className="btn-group w-100" role="group">
                            <input
                              type="radio"
                              className="btn-check"
                              name="paymentType"
                              id="typeCard"
                              checked={selectedType === 'card'}
                              onChange={() => setSelectedType('card')}
                            />
                            <label className="btn btn-outline-secondary" htmlFor="typeCard">
                              <i className="fa fa-credit-card me-2"></i>Card
                            </label>

                            <input
                              type="radio"
                              className="btn-check"
                              name="paymentType"
                              id="typeUpi"
                              checked={selectedType === 'upi'}
                              onChange={() => setSelectedType('upi')}
                            />
                            <label className="btn btn-outline-secondary" htmlFor="typeUpi">
                              <i className="fa fa-mobile-alt me-2"></i>UPI
                            </label>

                            <input
                              type="radio"
                              className="btn-check"
                              name="paymentType"
                              id="typeWallet"
                              checked={selectedType === 'wallet'}
                              onChange={() => setSelectedType('wallet')}
                            />
                            <label className="btn btn-outline-secondary" htmlFor="typeWallet">
                              <i className="fa fa-wallet me-2"></i>Wallet
                            </label>
                          </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                          <div className="row g-3">
                            <div className="col-12">
                              <label className="form-label">
                                {selectedType === 'card' && 'Card Nickname'}
                                {selectedType === 'upi' && 'UPI Label'}
                                {selectedType === 'wallet' && 'Wallet Name'} *
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder={
                                  selectedType === 'card' ? 'e.g., Visa Credit Card' :
                                  selectedType === 'upi' ? 'e.g., Paytm UPI' :
                                  'e.g., Aisle Wallet'
                                }
                                required
                              />
                            </div>

                            <div className="col-12">
                              <label className="form-label">
                                {selectedType === 'card' && 'Card Number (Last 4 Digits)'}
                                {selectedType === 'upi' && 'UPI ID'}
                                {selectedType === 'wallet' && 'Wallet ID'} *
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                name="details"
                                value={formData.details}
                                onChange={handleChange}
                                placeholder={
                                  selectedType === 'card' ? '4242' :
                                  selectedType === 'upi' ? 'user@paytm' :
                                  'wallet@aisle'
                                }
                                maxLength={selectedType === 'card' ? 4 : undefined}
                                required
                              />
                            </div>

                            <div className="col-12">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  name="isDefault"
                                  id="isDefaultPayment"
                                  checked={formData.isDefault || false}
                                  onChange={handleChange}
                                />
                                <label className="form-check-label" htmlFor="isDefaultPayment">
                                  Set as default payment method
                                </label>
                              </div>
                            </div>

                            <div className="col-12">
                              <button type="submit" className="btn btn-secondary me-2">
                                <i className="fa fa-save me-2"></i>Add Payment Method
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={resetForm}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="mb-4">
                        <i className="fa fa-credit-card text-muted" style={{ fontSize: '3rem' }}></i>
                      </div>
                      <h5 className="mb-3">No payment methods saved</h5>
                      <p className="text-muted mb-4">Add your first payment method for faster checkout</p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {paymentMethods.map((method) => (
                        <div key={method.id} className="col-md-6">
                          <div className={`card h-100 ${method.isDefault ? 'border-secondary' : ''}`}>
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                  <h6 className="card-title mb-1">
                                    <i className={`fa ${getIcon(method.type)} me-2`}></i>
                                    {method.name}
                                    {method.isDefault && (
                                      <span className="badge bg-secondary ms-2">Default</span>
                                    )}
                                  </h6>
                                  <p className="text-muted small mb-0">
                                    {method.type === 'card' && `•••• ${method.details}`}
                                    {method.type === 'upi' && method.details}
                                    {method.type === 'wallet' && method.details}
                                  </p>
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDelete(method.id)}
                                  title="Delete"
                                  disabled={method.isDefault}
                                >
                                  <i className="fa fa-trash"></i>
                                </button>
                              </div>
                              {!method.isDefault && (
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleSetDefault(method.id)}
                                >
                                  Set as Default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
