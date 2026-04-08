/**
 * sentry.js — Sentry error monitoring initialization.
 *
 * Must be imported as early as possible (top of main.js) so Sentry
 * captures errors from all subsequent modules. Never throws.
 */

import * as Sentry from '@sentry/browser';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

export { Sentry };
