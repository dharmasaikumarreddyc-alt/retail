'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthenticatedSession } from '../lib/auth';

export default function CartPilotAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const announcedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      const session = await getAuthenticatedSession('customer');
      if (cancelled) return;

      if (session) {
        setAllowed(true);
        setChecking(false);
        return;
      }

      if (!announcedRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        announcedRef.current = true;
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance('Please login to continue.');
          utterance.lang = 'en-IN';
          utterance.rate = 1;
          window.speechSynthesis.speak(utterance);
        } catch {
          // Navigation still proceeds if speech output is blocked by the browser.
        }
      }

      router.replace('/login?required=cart-pilot&next=%2Fcart-pilot');
    };

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (allowed) return <>{children}</>;

  return (
    <div style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', padding: '32px 20px' }}>
      <div className="text-center" role="status" aria-live="polite">
        <div className="spinner-border text-primary mb-3" aria-hidden="true" />
        <h4 className="mb-2">{checking ? 'Checking your login…' : 'Please login to continue'}</h4>
        <p className="text-muted mb-0">CartPilot voice ordering is available after customer sign-in.</p>
      </div>
    </div>
  );
}
