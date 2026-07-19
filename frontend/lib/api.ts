'use client';

import type { ApiResponse, TokenResponse } from './types';
import { captureApiFailure } from './monitoring';

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080/api/v1';

/** Bound hung requests (Render cold starts can take 10–30s). */
const REQUEST_TIMEOUT_MS = 45_000;

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
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status >= 500) {
        captureApiFailure('/auth/refresh', 'POST', 'server', res.status);
      }
      if (!res.ok) return false;
      const body = (await res.json()) as ApiResponse<TokenResponse>;
      if (body.success && body.data?.accessToken) {
        tokenStore.set(body.data.accessToken);
        return true;
      }
      return false;
    } catch {
      captureApiFailure('/auth/refresh', 'POST', 'network');
      return false;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { _isRetry, ...fetchOptions } = options;
  const method = fetchOptions.method ?? 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  const token = tokenStore.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: 'include',
      headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      captureApiFailure(path, method, 'timeout');
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    captureApiFailure(path, method, 'network');
    return { success: false, error: 'Network error, please try again.' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && !_isRetry && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
    if (typeof window !== 'undefined') {
      tokenStore.clear();
      window.location.href = '/login';
    }
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  if (res.status >= 500) {
    captureApiFailure(path, method, 'server', res.status);
  }

  try {
    return await res.json() as ApiResponse<T>;
  } catch {
    captureApiFailure(path, method, 'invalid-response', res.status);
    return { success: false, error: 'Network error, please try again.' };
  }
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  retried = false
): Promise<ApiResponse<T>> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
      credentials: 'include',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      captureApiFailure(path, 'POST', 'timeout');
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    captureApiFailure(path, 'POST', 'network');
    return { success: false, error: 'Network error, please try again.' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiUpload<T>(path, formData, true);
    if (typeof window !== 'undefined') {
      tokenStore.clear();
      window.location.href = '/login';
    }
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  if (res.status >= 500) {
    captureApiFailure(path, 'POST', 'server', res.status);
  }

  try {
    return await res.json() as ApiResponse<T>;
  } catch {
    captureApiFailure(path, 'POST', 'invalid-response', res.status);
    return { success: false, error: 'Network error, please try again.' };
  }
}

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
