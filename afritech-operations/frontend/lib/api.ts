'use client';

export type ApiError = { error?: string; messages?: unknown };

const TOKEN_KEY = 'abops_token';
const USER_KEY = 'abops_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getUserCache(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUserCache(user: any | null) {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, any>; formData?: FormData } = {}
): Promise<T> {
  const { method = 'GET', body, params, formData } = options;
  let url = path;
  if (params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const qs = sp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = (data && (data.error || data.msg)) || `Request failed (${res.status})`;
    if (res.status === 401) {
      if (typeof window !== 'undefined' && !path.includes('/auth/login')) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        if (path !== '/api/auth/me' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    throw new ApiClientError(message, res.status, data);
  }
  return data as T;
}

export class ApiClientError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ---- typed helpers ----
export function fmtMoney(value: number | string | null | undefined, currency = 'RWF') {
  const n = Number(value || 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB');
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiClientError(data.error || 'Login failed', res.status, data);
  setToken(data.access_token);
  setUserCache(data.user);
  return data.user;
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  setToken(null);
  setUserCache(null);
}

export async function fetchMe(): Promise<any> {
  const data = await api('/api/auth/me');
  setUserCache(data.user);
  return data.user;
}

export function can(user: any | null, permission: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (user.permissions || []).includes(permission);
}

export function hasRole(user: any | null, role: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (user.role_codes || []).includes(role);
}

export function isSuperAdmin(user: any | null): boolean {
  return !!user && user.is_super_admin;
}