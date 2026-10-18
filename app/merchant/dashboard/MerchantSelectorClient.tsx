'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedSession } from '../../lib/auth';

export default function MerchantSelectorClient() {
  const [message, setMessage] = useState('A dedicated space for the numbers, orders, and feedback that move your restaurant forward.');
  const router = useRouter();

  useEffect(() => {
    const verifyMerchant = async () => {
      const session = await getAuthenticatedSession('merchant');
      if (!session) return;
      if (!session.profile.merchant_id) {
        setMessage('This account is not linked to a merchant. Sign in with your merchant account.');
        return;
      }
      router.replace(`/merchant/dashboard/${encodeURIComponent(session.profile.merchant_id)}`);
    };
    void verifyMerchant();
  }, [router]);

  return (
    <main className="merchant-dash-root merchant-portal-root">
      <header className="merchant-portal-topbar">
        <Link className="merchant-brand" href="/merchant">
          <img className="merchant-brand-logo" src="/images/logo.svg" alt="Loopora" />
        </Link>
        <Link className="merchant-login-customer-link" href="/login">Customer sign in <i className="fas fa-arrow-up-right-from-square" /></Link>
      </header>
      <div className="merchant-portal-card">
        <span className="merchant-card-sparkle"><i className="fas fa-chart-line" /></span>
        <p className="merchant-eyebrow">YOUR BUSINESS, IN FOCUS</p>
        <h1>How’s business going?</h1>
        <p>{message}</p>
        <div className="merchant-portal-perks">
          <span><i className="fas fa-chart-column" /> Sales at a glance</span>
          <span><i className="fas fa-message" /> Feedback that helps</span>
        </div>
        <Link className="merchant-login-submit merchant-portal-cta" href="/merchant/login">
          Sign in to merchant portal <i className="fas fa-arrow-right" />
        </Link>
        <p className="merchant-portal-separate">Private merchant access · Customer accounts cannot open this dashboard</p>
      </div>
      <footer className="merchant-login-footer"><span>© Loopora Merchant Workspace</span><Link href="/login">Customer sign in <i className="fas fa-arrow-right" /></Link></footer>
    </main>
  );
}
