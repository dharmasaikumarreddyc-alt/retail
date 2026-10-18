import { backendUrl } from './backend';

export type AccountRole = 'customer' | 'merchant';

export interface AuthenticatedSession {
  token: string;
  profile: {
    id: string;
    email: string;
    name?: string;
    role: AccountRole;
    merchant_id: string | null;
  };
}

const tokenKeys: Record<AccountRole, string> = {
  customer: 'customerToken',
  merchant: 'merchantToken',
};

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function tokenSource(key: string): { token: string; storage: BrowserStorage } | null {
  const persistent = localStorage.getItem(key);
  if (persistent) return { token: persistent, storage: localStorage };

  const session = sessionStorage.getItem(key);
  if (session) return { token: session, storage: sessionStorage };

  return null;
}

function removeMatchingToken(key: string, token: string): void {
  if (localStorage.getItem(key) === token) localStorage.removeItem(key);
  if (sessionStorage.getItem(key) === token) sessionStorage.removeItem(key);
}

export async function getAuthenticatedSession(role: AccountRole): Promise<AuthenticatedSession | null> {
  if (typeof window === 'undefined') return null;

  const otherRole: AccountRole = role === 'customer' ? 'merchant' : 'customer';
  const source =
    tokenSource(tokenKeys[role]) ||
    tokenSource(tokenKeys[otherRole]) ||
    tokenSource('token');
  if (!source) return null;

  const { token: storedToken, storage: sourceStorage } = source;

  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    if (!response.ok) {
      for (const key of Object.values(tokenKeys)) {
        removeMatchingToken(key, storedToken);
      }
      removeMatchingToken('token', storedToken);
      return null;
    }

    const profile: AuthenticatedSession['profile'] = await response.json();
    if (profile.role !== 'customer' && profile.role !== 'merchant') return null;

    const actualKey = tokenKeys[profile.role];
    const actualSource = tokenSource(actualKey);
    if (!actualSource || actualSource.token === storedToken) {
      removeMatchingToken(actualKey, storedToken);
      sourceStorage.setItem(actualKey, storedToken);
    }

    if (profile.role !== role) {
      removeMatchingToken(tokenKeys[role], storedToken);
    }
    removeMatchingToken('token', storedToken);

    if (profile.role !== role) return null;

    return { token: storedToken, profile };
  } catch {
    return null;
  }
}

export function saveAuthenticatedToken(role: AccountRole, token: string, persist = true): void {
  localStorage.removeItem(tokenKeys[role]);
  sessionStorage.removeItem(tokenKeys[role]);

  const storage = persist ? localStorage : sessionStorage;
  storage.setItem(tokenKeys[role], token);

  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
}

export function clearAuthenticatedToken(role: AccountRole): void {
  localStorage.removeItem(tokenKeys[role]);
  sessionStorage.removeItem(tokenKeys[role]);
}
