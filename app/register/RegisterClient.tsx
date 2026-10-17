'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { backendUrl } from '../lib/backend';
import { saveAuthenticatedToken } from '../lib/auth';

export default function RegisterClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.detail === 'string' ? data.detail : 'Unable to create your account.');
        return;
      }

      const profileResponse = await fetch(`${backendUrl}/auth/me`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || profile.role !== 'customer') {
        setError('Customer registration could not be verified. Please use customer sign-in.');
        return;
      }

      saveAuthenticatedToken('customer', data.access_token);
      window.dispatchEvent(new Event('authChanged'));
      router.push('/shop');
    } catch (err) {
      setError('Unable to reach the server. Check that the backend is running and try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-area">
      <h2 className="text-secondary text-center">Create Account</h2>
      <p className="text-center m-b25">Register to get started</p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="m-b30">
          <label className="label-title" htmlFor="register-name">Name</label>
          <input
            id="register-name"
            name="name"
            required
            className="form-control"
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="m-b30">
          <label className="label-title" htmlFor="register-email">Email Address</label>
          <input
            id="register-email"
            name="email"
            required
            className="form-control"
            placeholder="Email Address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="m-b30">
          <label className="label-title" htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="form-control"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="m-b30">
          <label className="label-title" htmlFor="register-confirm-password">Confirm Password</label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="form-control"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="text-center">
          <button
            type="submit"
            className="btn btn-secondary btnhover text-uppercase me-2 sign-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          <Link href="/login" className="btn btn-outline-secondary btnhover text-uppercase">
            Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
