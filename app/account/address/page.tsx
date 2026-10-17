'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import AccountSidebar from '../../components/AccountSidebar';
import { getAuthenticatedSession } from '../../lib/auth';

interface Address {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export default function AddressPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState<Partial<Address>>({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'India',
    phone: '',
    isDefault: false,
  });

  useEffect(() => {
    const verifyAndLoad = async () => {
      if (!(await getAuthenticatedSession('customer'))) {
        router.replace('/login');
        return;
      }
      fetchAddresses();
    };
    void verifyAndLoad();
  }, [router]);

  const fetchAddresses = () => {
    // Load from localStorage
    const saved = localStorage.getItem('userAddresses');
    if (saved) {
      setAddresses(JSON.parse(saved));
    } else {
      setAddresses([]);
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let updatedAddresses: Address[];

    if (editingId) {
      // Edit existing
      updatedAddresses = addresses.map(addr =>
        addr.id === editingId ? { ...formData, id: editingId } as Address : addr
      );
      setMessage('Address updated successfully!');
    } else {
      // Add new
      const newAddress: Address = {
        ...formData,
        id: `addr-${Date.now()}`,
      } as Address;
      updatedAddresses = [...addresses, newAddress];
      setMessage('Address added successfully!');
    }

    // If setting as default, unset others
    if (formData.isDefault) {
      updatedAddresses = updatedAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === (editingId || updatedAddresses[updatedAddresses.length - 1].id),
      }));
    }

    setAddresses(updatedAddresses);
    localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
    window.dispatchEvent(new Event('addressesChanged'));

    resetForm();
  };

  const handleEdit = (address: Address) => {
    setFormData(address);
    setEditingId(address.id);
    setShowForm(true);
    setMessage('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    const updatedAddresses = addresses.filter(addr => addr.id !== id);
    setAddresses(updatedAddresses);
    localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
    setMessage('Address deleted successfully!');
  };

  const handleSetDefault = (id: string) => {
    const updatedAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id,
    }));
    setAddresses(updatedAddresses);
    localStorage.setItem('userAddresses', JSON.stringify(updatedAddresses));
    setMessage('Default address updated!');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'India',
      phone: '',
      isDefault: false,
    });
    setEditingId(null);
    setShowForm(false);
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
              <h1>My Addresses</h1>
              <nav aria-label="breadcrumb" className="breadcrumb-row">
                <ul className="breadcrumb">
                  <li className="breadcrumb-item"><Link href="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link href="/account/dashboard">Account</Link></li>
                  <li className="breadcrumb-item">Addresses</li>
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
                    <h5 className="mb-0">Saved Addresses</h5>
                    {!showForm && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowForm(true)}
                      >
                        <i className="fa fa-plus me-2"></i>Add New Address
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
                        <h6 className="card-title mb-3">
                          {editingId ? 'Edit Address' : 'Add New Address'}
                        </h6>
                        <form onSubmit={handleSubmit}>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Address Label *</label>
                              <input
                                type="text"
                                className="form-control"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Home, Office"
                                required
                              />
                            </div>

                            <div className="col-md-6">
                              <label className="form-label">Phone *</label>
                              <input
                                type="tel"
                                className="form-control"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+91 1234567890"
                                required
                              />
                            </div>

                            <div className="col-12">
                              <label className="form-label">Street Address *</label>
                              <input
                                type="text"
                                className="form-control"
                                name="street"
                                value={formData.street}
                                onChange={handleChange}
                                placeholder="House no., Building name, Street"
                                required
                              />
                            </div>

                            <div className="col-md-6">
                              <label className="form-label">City *</label>
                              <input
                                type="text"
                                className="form-control"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                required
                              />
                            </div>

                            <div className="col-md-3">
                              <label className="form-label">State *</label>
                              <input
                                type="text"
                                className="form-control"
                                name="state"
                                value={formData.state}
                                onChange={handleChange}
                                required
                              />
                            </div>

                            <div className="col-md-3">
                              <label className="form-label">PIN Code *</label>
                              <input
                                type="text"
                                className="form-control"
                                name="zip"
                                value={formData.zip}
                                onChange={handleChange}
                                placeholder="500081"
                                required
                              />
                            </div>

                            <div className="col-md-6">
                              <label className="form-label">Country *</label>
                              <select
                                className="form-control"
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                required
                              >
                                <option value="India">India</option>
                                <option value="USA">USA</option>
                                <option value="UK">UK</option>
                              </select>
                            </div>

                            <div className="col-12">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  name="isDefault"
                                  id="isDefault"
                                  checked={formData.isDefault || false}
                                  onChange={handleChange}
                                />
                                <label className="form-check-label" htmlFor="isDefault">
                                  Set as default address
                                </label>
                              </div>
                            </div>

                            <div className="col-12">
                              <button type="submit" className="btn btn-secondary me-2">
                                <i className="fa fa-save me-2"></i>
                                {editingId ? 'Update Address' : 'Add Address'}
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

                  {addresses.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="mb-4">
                        <i className="fa fa-map-marker-alt text-muted" style={{ fontSize: '3rem' }}></i>
                      </div>
                      <h5 className="mb-3">No addresses saved</h5>
                      <p className="text-muted mb-4">Add your first address to get started</p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {addresses.map((address) => (
                        <div key={address.id} className="col-md-6">
                          <div className={`card h-100 ${address.isDefault ? 'border-secondary' : ''}`}>
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-3">
                                <h6 className="card-title mb-0">
                                  {address.name}
                                  {address.isDefault && (
                                    <span className="badge bg-secondary ms-2">Default</span>
                                  )}
                                </h6>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-secondary"
                                    onClick={() => handleEdit(address)}
                                    title="Edit"
                                  >
                                    <i className="fa fa-edit"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleDelete(address.id)}
                                    title="Delete"
                                    disabled={address.isDefault}
                                  >
                                    <i className="fa fa-trash"></i>
                                  </button>
                                </div>
                              </div>
                              <p className="mb-2">{address.street}</p>
                              <p className="mb-2">{address.city}, {address.state} {address.zip}</p>
                              <p className="mb-2">{address.country}</p>
                              <p className="mb-3">
                                <i className="fa fa-phone me-2"></i>{address.phone}
                              </p>
                              {!address.isDefault && (
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleSetDefault(address.id)}
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
