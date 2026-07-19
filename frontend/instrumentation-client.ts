import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './lib/monitoring';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: () => null,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
