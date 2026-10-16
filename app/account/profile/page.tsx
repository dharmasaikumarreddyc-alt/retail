'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import AccountSidebar from '../../components/AccountSidebar';
import { optionalBackendUrl } from '../../lib/backend';
import { getAuthenticatedSession } from '../../lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const verifyAndLoad = async () => {
      if (!(await getAuthenticatedSession('customer'))) {
        router.replace('/login');
        return;
      }
      fetchUserInfo();
    };
    void verifyAndLoad();
  }, [router]);

  const fetchUserInfo = async () => {
    try {
      const backend = optionalBackendUrl;
      if (!backend) {
        // Demo mode - use mock data
        setFormData(prev => ({
          ...prev,
          name: 'Demo User',
          email: 'demo@example.com',
          phone: '+91 9876543210',
        }));
        setLoading(false);
        return;
      }

      const session = await getAuthenticatedSession('customer');
      if (!session) return;

      const response = await fetch(`${backend}/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
        }));
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
      setError('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const backend = optionalBackendUrl;
      if (!backend) {
        // Demo mode - just show success message
        setMessage('Profile updated successfully!');
        setSaving(false);
        return;
      }

      const session = await getAuthenticatedSession('customer');
      if (!session) return;

      const updateData: any = {
        name: formData.name,
        phone: formData.phone,
      };

      // Only include password if changing
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setError('New passwords do not match');
          setSaving(false);
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await fetch(`${backend}/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setMessage('Profile updated successfully!');
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        window.dispatchEvent(new Event('authChanged'));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('An error occurred while updating profile');
    } finally {
      setSaving(false);
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
              <h1>My Profile</h1>
              <nav aria-label="breadcrumb" className="breadcrumb-row">
                <ul className="breadcrumb">
                  <li className="breadcrumb-item"><Link href="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link href="/account/dashboard">Account</Link></li>
                  <li className="breadcrumb-item">Profile</li>
                </ul>
              </nav>
            </div>
          </div>
        </div>

        <div className="content-inner-1">
          <div className="container">
            <div className="row">
              <AccountSidebar userName={formData.name} userEmail={formData.email} />

              <div className="col-xl-9 account-wrapper">
                <div className="account-card">
                  <h5 className="mb-4">Account Details</h5>

                  {message && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                      <i className="fa fa-check-circle me-2"></i>{message}
                      <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
                    </div>
                  )}

                  {error && (
                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                      <i className="fa fa-exclamation-circle me-2"></i>{error}
                      <button type="button" className="btn-close" onClick={() => setError('')}></button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Full Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Email Address *</label>
                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          value={formData.email}
                          disabled
                          title="Email cannot be changed"
                        />
                        <small className="text-muted">Email cannot be changed</small>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+91 1234567890"
                        />
                      </div>

                      <div className="col-12">
                        <hr className="my-4" />
                        <h5 className="mb-3">Change Password</h5>
                        <p className="text-muted mb-4">Leave blank if you don't want to change your password</p>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Current Password</label>
                        <input
                          type="password"
                          className="form-control"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          autoComplete="current-password"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">New Password</label>
                        <input
                          type="password"
                          className="form-control"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Confirm New Password</label>
                        <input
                          type="password"
                          className="form-control"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="col-12">
                        <button
                          type="submit"
                          className="btn btn-secondary btn-lg"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Saving...
                            </>
                          ) : (
                            <>
                              <i className="fa fa-save me-2"></i>
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
