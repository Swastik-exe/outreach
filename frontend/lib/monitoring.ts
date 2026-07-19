'use client';

import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const SENTRY_ENABLED = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
const EMAIL = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const BEARER_TOKEN = /bearer\s+\S+/gi;
const JWT = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;
const TOKEN_PARAMETER = /(token|secret|password|authorization)=([^\s&]+)/gi;
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f-]{27,36}(?=\/|$)/gi;
const NUMBER_SEGMENT = /\/\d+(?=\/|$)/g;

function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL, '[redacted-email]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(JWT, '[redacted-token]')
    .replace(TOKEN_PARAMETER, '$1=[redacted]');
}

function safeApiPath(path: string): string {
  return path
    .split('?', 1)[0]
    .replace(UUID_SEGMENT, '/[id]')
    .replace(NUMBER_SEGMENT, '/[id]');
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  event.user = undefined;
  event.breadcrumbs = undefined;
  event.extra = undefined;
  event.contexts = undefined;

  if (event.request) {
    event.request = {
      method: event.request.method,
      url: event.request.url
        ? redactSensitiveText(event.request.url.split(/[?#]/, 1)[0])
        : undefined,
    };
  }
  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }
  if (event.transaction) {
    event.transaction = safeApiPath(redactSensitiveText(event.transaction));
  }
  event.exception?.values?.forEach((exception) => {
    if (exception.value) {
      exception.value = redactSensitiveText(exception.value);
    }
  });
  return event;
}

export function captureClientError(error: Error): void {
  if (!SENTRY_ENABLED) return;
  Sentry.captureException(error);
}

export function captureApiFailure(
  path: string,
  method: string,
  kind: 'network' | 'timeout' | 'invalid-response' | 'server',
  status?: number
): void {
  if (!SENTRY_ENABLED) return;

  Sentry.withScope((scope) => {
    scope.setTag('failure.kind', kind);
    scope.setTag('http.method', method);
    scope.setTag('api.path', safeApiPath(path));
    if (status !== undefined) {
      scope.setTag('http.status_code', String(status));
    }
    Sentry.captureException(new Error(`API request failed (${kind})`));
  });
}
