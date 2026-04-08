/**
 * posthog.js — PostHog analytics initialization.
 *
 * Initializes PostHog once at app startup. Never throws — analytics
 * must never break the app.
 */

import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
}

export { posthog };
