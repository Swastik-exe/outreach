'use client';

import type { ApiResponse, TokenResponse } from './types';

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080/api/v1';

// ── In-memory token store ─────────────────────────────────────────────────────
// Never written to localStorage or cookies — lives only in JS heap.
let _accessToken: string | null = null;
let _refreshing: Promise<boolean> | null = null; // deduplicate concurrent refresh calls

export const tokenStore = {
  get: () => _accessToken,
  set: (t: string | null) => { _accessToken = t; },
  clear: () => { _accessToken = null; },
};

// ── Refresh helper ────────────────────────────────────────────────────────────
async function tryRefresh(): Promise<boolean> {
  // Deduplicate: if a refresh is already in-flight, wait for it
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends the HttpOnly refresh_token cookie
      });
      if (!res.ok) return false;
      const body = (await res.json()) as ApiResponse<TokenResponse>;
      if (body.success && body.data?.accessToken) {
        tokenStore.set(body.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
/**
 * Wraps fetch with:
 * - Bearer token injection from in-memory store
 * - Automatic 401 → refresh → retry (once)
 * - ApiResponse<T> unwrapping
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { _isRetry, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  const token = tokenStore.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    credentials: 'include',
    headers,
  });

  // 401 → try refresh once (skip retry for auth endpoints to avoid loops)
  if (res.status === 401 && !_isRetry && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      tokenStore.clear();
      window.location.href = '/login';
    }
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  const body = await res.json() as ApiResponse<T>;
  return body;
}

// ── Multipart upload helper ───────────────────────────────────────────────────
/**
 * POST multipart/form-data.  Does NOT set Content-Type — the browser must set
 * it with the correct multipart boundary.  Handles 401 → refresh → retry once.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  retried = false
): Promise<ApiResponse<T>> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiUpload<T>(path, formData, true);
    if (typeof window !== 'undefined') {
      tokenStore.clear();
      window.location.href = '/login';
    }
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  return res.json() as Promise<ApiResponse<T>>;
}

// ── Typed convenience methods ─────────────────────────────────────────────────
function withQuery(path: string, params?: Record<string, string | boolean | number>) {
  if (!params) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${path}?${qs.toString()}`;
}

export const api = {
  post: <T>(path: string, data?: unknown, params?: Record<string, string | boolean | number>) =>
    apiFetch<T>(withQuery(path, params), {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  get: <T>(path: string, params?: Record<string, string | boolean | number>) =>
    apiFetch<T>(withQuery(path, params), { method: 'GET' }),

  put: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),

  del: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
