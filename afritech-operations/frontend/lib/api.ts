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

/**
 * `JSON.stringify` that cannot throw.
 *
 * Payloads are built by hand in pages, so a React click event, a DOM node or a
 * self-referencing object can end up inside them. Stringifying that walks
 * window → document → React's root fiber and dies with
 * "Converting circular structure to JSON", which surfaces as a failed request
 * and an unreadable error. This mirrors JSON.stringify semantics (own
 * enumerable properties, functions/undefined dropped, `toJSON` honoured) and
 * only differs where JSON would throw: cycles and DOM/window references are
 * dropped, with a console warning naming the path so the real culprit is
 * still visible.
 */
export function safeStringify(value: unknown): string {
  const ancestors = new Set<object>();

  const drop = (path: string, why: string) => {
    // eslint-disable-next-line no-console
    console.warn(
      `[api] dropped non-serializable value at ${path || '<root>'} (${why}) — ` +
      'this would have crashed JSON.stringify'
    );
    return undefined;
  };

  const walk = (v: any, path: string): any => {
    if (typeof v === 'function') return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (typeof Node !== 'undefined' && v instanceof Node) return drop(path, 'DOM node');
    if (typeof Window !== 'undefined' && v instanceof Window) return drop(path, 'window');
    if (ancestors.has(v)) return drop(path, 'circular reference');
    if (v instanceof Date) return v;

    ancestors.add(v);
    try {
      if (Array.isArray(v)) {
        return v.map((item, i) => walk(item, `${path}[${i}]`));
      }
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) {
        const w = walk(val, path ? `${path}.${k}` : k);
        if (w !== undefined) out[k] = w;
      }
      return out;
    } finally {
      ancestors.delete(v);
    }
  };

  return JSON.stringify(walk(value, ''));
}

export function setUserCache(user: any | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    try {
      window.localStorage.setItem(USER_KEY, safeStringify(user));
    } catch {
      // a non-serializable cache entry must never break auth
      window.localStorage.removeItem(USER_KEY);
    }
  } else window.localStorage.removeItem(USER_KEY);
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
    init.body = safeStringify(body);
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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a date for display.
 *
 * Date-only values (`YYYY-MM-DD`) are calendar days, not instants: `new Date`
 * parses those as UTC midnight, so anywhere west of Greenwich the rendered day
 * falls one day early (2026-11-02 showing as 01/11/2026). Build them from
 * local components instead and leave real timestamps to parse normally.
 */
export function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB');
  }
  return new Date(value).toLocaleDateString('en-GB');
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB');
}

/** Fetch a protected file and hand it to the browser as a download.
 *  A plain <a href> would not carry the bearer token, so this goes through
 *  fetch + object URL and revokes it afterwards. */
export async function downloadFile(path: string, fallbackName = 'download') {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new Error(message);
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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