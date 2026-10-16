'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAuthenticatedSession } from '../lib/auth';

interface AccountSidebarProps {
  userName?: string;
  userEmail?: string;
}

export default function AccountSidebar({ userName, userEmail }: AccountSidebarProps) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState(userName || 'User');
  const [displayEmail, setDisplayEmail] = useState(userEmail || 'user@example.com');

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const session = await getAuthenticatedSession('customer');
      if (!session || cancelled) return;

      const email = userEmail || session.profile.email;
      const name = userName?.trim() || session.profile.name?.trim() || email.split('@')[0] || 'User';
      setDisplayName(name);
      setDisplayEmail(email);
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userName, userEmail]);

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="col-xl-3">
      <div className="toggle-info">
        <h5 className="title mb-0">Account Navbar</h5>
        <a className="toggle-btn" href="#accountSidebar">Account Menu</a>
      </div>
      <div className="sticky-top account-sidebar-wrapper">
        <div className="account-sidebar" id="accountSidebar">
          <div className="profile-head">
            <div className="user-thumb">
              <img className="rounded-circle" src="/images/profile4.jpg" alt={displayName} />
            </div>
            <h5 className="title mb-0">{displayName}</h5>
            <span className="text text-primary">{displayEmail}</span>
          </div>
          <div className="account-nav">
            <div className="nav-title bg-light">DASHBOARD</div>
            <ul>
              <li>
                <Link
                  href="/account/dashboard"
                  className={isActive('/account/dashboard') ? 'active' : ''}
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/account/orders"
                  className={isActive('/account/orders') ? 'active' : ''}
                >
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/cart-pilot">
                  Cart Pilot
                </Link>
              </li>
            </ul>
            <div className="nav-title bg-light">ACCOUNT SETTINGS</div>
            <ul className="account-info-list">
              <li>
                <Link href="/account/profile">Profile</Link>
              </li>
              <li>
                <Link href="/account/address">Address</Link>
              </li>
              <li>
                <Link href="/account/payment-methods">Payment Methods</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
