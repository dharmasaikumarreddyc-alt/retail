'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { optionalBackendUrl } from '../lib/backend';
import { clearAuthenticatedToken, getAuthenticatedSession } from '../lib/auth';

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const refreshAuth = async () => {
    const session = await getAuthenticatedSession('customer');
    setIsLoggedIn(Boolean(session));
    setUserName(session?.profile.name || session?.profile.email || 'Account');
  };

  const refreshCart = async () => {
    if (!optionalBackendUrl) return setCartCount(0);
    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) return setCartCount(0);
      const response = await fetch(`${optionalBackendUrl}/cart`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!response.ok) return setCartCount(0);
      const data = await response.json();
      setCartCount(data.count || 0);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    refreshAuth();
    refreshCart();

    const authHandler = () => {
      refreshAuth();
      refreshCart();
    };
    const cartHandler = () => refreshCart();
    const outsideHandler = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener('authChanged', authHandler);
    window.addEventListener('cartUpdated', cartHandler);
    document.addEventListener('mousedown', outsideHandler);
    return () => {
      window.removeEventListener('authChanged', authHandler);
      window.removeEventListener('cartUpdated', cartHandler);
      document.removeEventListener('mousedown', outsideHandler);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const logout = () => {
    clearAuthenticatedToken('customer');
    setIsLoggedIn(false);
    setUserName('');
    setCartCount(0);
    setProfileOpen(false);
    setMobileOpen(false);
    window.dispatchEvent(new Event('authChanged'));
    window.location.href = '/';
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/shop', label: 'Shop' },
    { href: '/cart-pilot', label: 'CartPilot', featured: true },
    { href: '/merchant', label: 'Merchant' },
  ];

  return (
    <>
      <header className="loopora-header">
        <div className="loopora-nav-shell">
          <Link href="/" className="loopora-brand" aria-label="Loopora home">
            <img src="/images/logo.svg" alt="Loopora" />
          </Link>

          <nav className="loopora-desktop-nav" aria-label="Primary navigation">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className={link.featured ? 'nav-link featured' : 'nav-link'}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="loopora-actions">
            <Link href="/cart" className="icon-action" aria-label={`Cart with ${cartCount} items`}>
              <i className="fas fa-shopping-cart" />
              {cartCount > 0 && <span className="cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>

            {isLoggedIn ? (
              <div className="profile-wrap" ref={profileRef}>
                <button className="account-button" type="button" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}>
                  <i className="far fa-user" />
                  <span className="account-name">{userName}</span>
                  <i className="fas fa-chevron-down small-chevron" />
                </button>
                {profileOpen && (
                  <div className="profile-menu">
                    <Link href="/account/profile">My profile</Link>
                    <Link href="/account/orders">My orders</Link>
                    <button type="button" onClick={logout}>Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="login-button">Login</Link>
            )}

            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen(value => !value)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && <button className="mobile-backdrop" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <aside id="mobile-navigation" className={`mobile-drawer ${mobileOpen ? 'open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="drawer-top">
          <Link href="/" className="loopora-brand" onClick={() => setMobileOpen(false)}>
            <img src="/images/logo.svg" alt="Loopora" />
          </Link>
          <button type="button" className="drawer-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="drawer-links">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} className={link.featured ? 'drawer-link cartpilot' : 'drawer-link'} onClick={() => setMobileOpen(false)}>
              <span>{link.label}</span>
              <i className="fas fa-arrow-right" />
            </Link>
          ))}
          <Link href="/cart" className="drawer-link" onClick={() => setMobileOpen(false)}>
            <span>Cart {cartCount > 0 ? `(${cartCount})` : ''}</span>
            <i className="fas fa-arrow-right" />
          </Link>
        </div>

        <div className="drawer-actions">
          {isLoggedIn ? (
            <>
              <Link href="/account/profile" className="drawer-secondary" onClick={() => setMobileOpen(false)}>My account</Link>
              <button type="button" className="drawer-primary" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="drawer-primary" onClick={() => setMobileOpen(false)}>Customer Login</Link>
              <Link href="/merchant/login" className="drawer-secondary" onClick={() => setMobileOpen(false)}>Merchant Login</Link>
            </>
          )}
        </div>
      </aside>

      <style jsx>{`
        .loopora-header{position:relative;z-index:1050;background:#fff;border-bottom:1px solid rgba(21,31,55,.08);box-shadow:0 6px 26px rgba(21,31,55,.06)}
        .loopora-nav-shell{width:min(1180px,calc(100% - 32px));min-height:76px;margin:0 auto;display:flex;align-items:center;gap:28px}
        .loopora-brand{display:flex;align-items:center;flex:0 0 auto}.loopora-brand img{display:block;width:150px;max-height:48px;object-fit:contain}
        .loopora-desktop-nav{display:flex;align-items:center;gap:6px;margin-left:auto}.nav-link{padding:11px 14px;border-radius:999px;color:#1b2436;font-weight:650;text-decoration:none;white-space:nowrap}.nav-link:hover{background:#f4f6f8;color:#e95e35}.nav-link.featured{background:#151f37;color:#fff}.nav-link.featured:hover{background:#273554;color:#fff}
        .loopora-actions{display:flex;align-items:center;gap:10px}.icon-action{position:relative;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#151f37;background:#f5f6f8;text-decoration:none}.cart-badge{position:absolute;right:-3px;top:-4px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;display:grid;place-items:center;background:#ef653f;color:#fff;font-size:11px;font-weight:800}
        .login-button,.account-button{height:42px;border-radius:999px;padding:0 17px;display:flex;align-items:center;gap:8px;border:1px solid #e3e6eb;background:#fff;color:#151f37;text-decoration:none;font-weight:700}.account-button{cursor:pointer}.small-chevron{font-size:10px}.profile-wrap{position:relative}.profile-menu{position:absolute;right:0;top:50px;width:190px;padding:8px;background:#fff;border:1px solid #e8e9ed;border-radius:14px;box-shadow:0 18px 44px rgba(21,31,55,.15);display:grid}.profile-menu a,.profile-menu button{padding:10px 12px;border:0;border-radius:9px;background:transparent;color:#20283a;text-align:left;text-decoration:none}.profile-menu a:hover,.profile-menu button:hover{background:#f5f6f8}
        .mobile-toggle{display:none;width:42px;height:42px;border:0;border-radius:10px;background:#151f37;padding:10px;cursor:pointer}.mobile-toggle span{display:block;height:2px;background:#fff;margin:4px 0;border-radius:2px}
        .mobile-backdrop{position:fixed;inset:0;z-index:1090;border:0;background:rgba(10,16,29,.5)}
        .mobile-drawer{position:fixed;z-index:1100;top:0;right:0;width:min(88vw,380px);height:100dvh;padding:22px;background:#fff;box-shadow:-24px 0 60px rgba(10,16,29,.18);transform:translateX(105%);transition:transform .22s ease;display:flex;flex-direction:column;overflow-y:auto}.mobile-drawer.open{transform:translateX(0)}
        .drawer-top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid #edf0f3}.drawer-close{width:42px;height:42px;border:0;border-radius:50%;background:#f3f5f7;color:#151f37}
        .drawer-links{display:grid;gap:7px;padding:20px 0}.drawer-link{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-radius:12px;color:#172033;text-decoration:none;font-weight:700;background:#f7f8fa}.drawer-link.cartpilot{background:#151f37;color:#fff}.drawer-actions{display:grid;gap:10px;margin-top:auto;padding-top:20px}.drawer-primary,.drawer-secondary{min-height:48px;border-radius:12px;display:grid;place-items:center;text-decoration:none;font-weight:800}.drawer-primary{border:0;background:#ef653f;color:#fff}.drawer-secondary{border:1px solid #dfe3e8;background:#fff;color:#151f37}
        @media(max-width:991px){.loopora-nav-shell{width:min(100% - 24px,760px);min-height:68px;gap:14px}.loopora-brand img{width:132px}.loopora-desktop-nav{display:none}.mobile-toggle{display:block}.account-name{display:none}.login-button{display:none}.loopora-actions{margin-left:auto}}
        @media(max-width:480px){.loopora-nav-shell{width:calc(100% - 20px)}.loopora-brand img{width:116px}.icon-action{width:40px;height:40px}.account-button{width:40px;padding:0;justify-content:center}.account-button .small-chevron{display:none}.mobile-toggle{width:40px;height:40px}.mobile-drawer{width:92vw;padding:18px}}
      `}</style>
    </>
  );
}
