'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { backendUrl } from '../lib/backend';
import { saveAuthenticatedToken } from '../lib/auth';

const DEMO_EMAIL = 'customer@loopora.demo';
const DEMO_PASSWORD = 'LooporaDemo123!';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/shop';
  return value;
}

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [nextPath, setNextPath] = useState('/shop');
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const required = params.get('required') === 'cart-pilot';
    setLoginRequired(required);
    setNextPath(safeNextPath(params.get('next')));

    if (required && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Please login to continue.');
        utterance.lang = 'en-IN';
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      } catch {
        // The visible login message remains available if autoplay speech is blocked.
      }
    }
  }, []);

  const loadDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/auth/login/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (response.ok) {
        const data = await response.json();
        const profileResponse = await fetch(`${backendUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (!profileResponse.ok) throw new Error('Could not load your account profile.');
        const profile: { role: 'customer' | 'merchant'; merchant_id: string | null } = await profileResponse.json();
        if (profile.role !== 'customer') {
          setError('Customer sign-in only. This is a merchant account; use the merchant portal below.');
          return;
        }
        saveAuthenticatedToken('customer', data.access_token, rememberMe);
        window.dispatchEvent(new Event('authChanged'));
        router.push(nextPath);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Invalid email or password');
      }
    } catch (err) {
      setError('Failed to login. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-area">
      <h2 className="text-secondary text-center">Customer Login</h2>
      <p className="text-center m-b20">Sign in to shop, use CartPilot, and manage orders.</p>

      {loginRequired && (
        <div className="alert alert-info text-center" role="alert" aria-live="polite">
          <i className="fas fa-lock me-2" aria-hidden="true" />
          <strong>Please login to continue.</strong>
          <div className="small mt-1">CartPilot voice ordering requires a customer account.</div>
        </div>
      )}

      <button type="button" className="btn btn-outline-secondary w-100 mb-4" onClick={loadDemoCredentials}>
        <i className="fas fa-wand-magic-sparkles me-2" /> Load customer demo credentials
      </button>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="m-b30">
          <label className="label-title">Email Address</label>
          <input name="email" required className="form-control" placeholder="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="m-b15">
          <label className="label-title">Password</label>
          <div className="secure-input">
            <input type={showPassword ? 'text' : 'password'} name="password" className="form-control dz-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            <button type="button" className="show-pass border-0 bg-transparent" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
        </div>
        <div className="form-row d-flex justify-content-between m-b30">
          <div className="form-group">
            <div className="custom-control custom-checkbox">
              <input type="checkbox" className="form-check-input" id="basic_checkbox_1" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <label className="form-check-label" htmlFor="basic_checkbox_1">Remember Me</label>
            </div>
          </div>
        </div>
        <div className="text-center d-flex flex-wrap gap-2 justify-content-center">
          <button type="submit" className="btn btn-secondary btnhover text-uppercase sign-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <Link href="/register" className="btn btn-outline-secondary btnhover text-uppercase">Register</Link>
        </div>
      </form>
      <p className="text-center mt-4 mb-0">Run a restaurant? <Link href="/merchant/login" className="text-primary">Merchant sign in</Link></p>
    </div>
  );
}
