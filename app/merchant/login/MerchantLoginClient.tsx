'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { backendUrl } from '../../lib/backend';
import { saveAuthenticatedToken } from '../../lib/auth';

export default function MerchantLoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginResponse = await fetch(`${backendUrl}/auth/login/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const login = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(login.detail || 'Email or password is incorrect.');
      }

      const profileResponse = await fetch(`${backendUrl}/auth/me`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${login.access_token}` },
      });
      const profile = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profile.detail || 'Could not verify this account.');
      }
      if (profile.role !== 'merchant' || !profile.merchant_id) {
        throw new Error('That is a customer account. Use the customer sign-in instead.');
      }

      saveAuthenticatedToken('merchant', login.access_token);
      window.dispatchEvent(new Event('authChanged'));
      router.replace(`/merchant/dashboard/${encodeURIComponent(profile.merchant_id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="merchant-login-root">
      <header className="merchant-login-topbar">
        <Link className="merchant-brand" href="/merchant">
          <img className="merchant-brand-logo" src="/images/logo.svg" alt="AI Mavericks" />
        </Link>
        <Link className="merchant-login-customer-link" href="/login">Customer sign in <i className="fas fa-arrow-up-right-from-square" /></Link>
      </header>

      <div className="merchant-login-layout">
        <section className="merchant-login-intro">
          <span className="merchant-eyebrow"><span /> YOUR BUSINESS, IN FOCUS</span>
          <h1>Welcome back.</h1>
          <p>See what’s selling, keep an eye on orders, and turn customer feedback into your next great idea.</p>
          <div className="merchant-login-trust">
            <span><i className="fas fa-lock" /> Private merchant workspace</span>
            <span><i className="fas fa-chart-simple" /> Your store’s performance, at a glance</span>
          </div>
          <div className="merchant-login-orbit" aria-hidden="true">
            <span className="merchant-orbit-ring merchant-orbit-ring-one" />
            <span className="merchant-orbit-ring merchant-orbit-ring-two" />
            <span className="merchant-orbit-center"><i className="fas fa-mug-hot" /></span>
            <span className="merchant-orbit-chip merchant-orbit-chip-one"><i className="fas fa-arrow-trend-up" /> Business insights</span>
            <span className="merchant-orbit-chip merchant-orbit-chip-two"><i className="fas fa-star" /> Customer love</span>
          </div>
        </section>

        <section className="merchant-login-card" aria-labelledby="merchant-login-title">
          <div className="merchant-login-card-icon"><i className="fas fa-store" /></div>
          <p className="merchant-eyebrow">MERCHANT PORTAL</p>
          <h2 id="merchant-login-title">Sign in to your store</h2>
          <p className="merchant-login-card-copy">Use the email and password provided for your merchant account.</p>

          {error && <div className="merchant-login-error" role="alert"><i className="fas fa-circle-exclamation" />{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="merchant-field-label" htmlFor="merchant-email">Email address</label>
            <div className="merchant-field">
              <i className="far fa-envelope" aria-hidden="true" />
              <input
                autoComplete="username"
                id="merchant-email"
                name="email"
                type="email"
                placeholder="you@yourrestaurant.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>

            <label className="merchant-field-label" htmlFor="merchant-password">Password</label>
            <div className="merchant-field">
              <i className="fas fa-lock" aria-hidden="true" />
              <input
                autoComplete="current-password"
                id="merchant-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
              <button
                className="merchant-password-toggle"
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`far ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>

            <button className="merchant-login-submit" type="submit" disabled={loading}>
              {loading ? 'Checking your account…' : 'Open merchant dashboard'}
              {!loading && <i className="fas fa-arrow-right" />}
            </button>
          </form>
          <p className="merchant-login-footnote"><i className="fas fa-shield-halved" /> Merchant accounts are separate from customer accounts.</p>
        </section>
      </div>

      <footer className="merchant-login-footer">
        <span>© Aisle Merchant Workspace</span>
        <Link href="/login">Customer sign in <i className="fas fa-arrow-right" /></Link>
      </footer>
    </main>
  );
}
