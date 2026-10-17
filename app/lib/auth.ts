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

export async function getAuthenticatedSession(role: AccountRole): Promise<AuthenticatedSession | null> {
  if (typeof window === 'undefined') return null;

  const otherRole: AccountRole = role === 'customer' ? 'merchant' : 'customer';
  const storedToken =
    localStorage.getItem(tokenKeys[role]) ||
    localStorage.getItem(tokenKeys[otherRole]) ||
    localStorage.getItem('token');
  if (!storedToken) return null;

  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    if (!response.ok) {
      for (const key of Object.values(tokenKeys)) {
        if (localStorage.getItem(key) === storedToken) localStorage.removeItem(key);
      }
      if (localStorage.getItem('token') === storedToken) localStorage.removeItem('token');
      return null;
    }

    const profile: AuthenticatedSession['profile'] = await response.json();
    if (profile.role !== 'customer' && profile.role !== 'merchant') return null;

    const actualKey = tokenKeys[profile.role];
    const currentActualToken = localStorage.getItem(actualKey);
    if (!currentActualToken || currentActualToken === storedToken) {
      localStorage.setItem(actualKey, storedToken);
    }
    if (profile.role !== role && localStorage.getItem(tokenKeys[role]) === storedToken) {
      localStorage.removeItem(tokenKeys[role]);
    }
    if (localStorage.getItem('token') === storedToken) localStorage.removeItem('token');
    if (profile.role !== role) return null;

    return { token: storedToken, profile };
  } catch {
    return null;
  }
}

export function saveAuthenticatedToken(role: AccountRole, token: string): void {
  localStorage.setItem(tokenKeys[role], token);
  localStorage.removeItem('token');
}

export function clearAuthenticatedToken(role: AccountRole): void {
  localStorage.removeItem(tokenKeys[role]);
}
