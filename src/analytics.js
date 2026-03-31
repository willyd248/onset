/**
 * analytics.js — lightweight event tracking module.
 *
 * Wraps window.va (Vercel Analytics) and PostHog with a fire-and-forget
 * interface. Never throws — analytics must never break the app.
 */

import { posthog } from './posthog.js';

/**
 * @param {string} name
 * @param {Record<string, string | number | boolean>} [data]
 */
function track(name, data = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.va === 'function') {
      window.va('event', { name, data });
    }
  } catch { /* never break the app */ }

  try {
    posthog.capture(name, data);
  } catch { /* never break the app */ }
}

/** Fired when the user starts a new practice session. */
export function trackSessionStarted() {
  track('session_started');
}

/**
 * Fired when a session ends (completed or abandoned).
 * @param {{ totalXP: number, lessonsCompleted: number }} props
 */
export function trackSessionEnded({ totalXP, lessonsCompleted }) {
  track('session_ended', { totalXP, lessonsCompleted });
}

/**
 * Fired when a lesson begins (Watch phase starts).
 * @param {{ lessonId: string, lessonName: string }} props
 */
export function trackLessonStarted({ lessonId, lessonName }) {
  track('lesson_started', { lessonId, lessonName });
}

/**
 * Fired when all phases of a lesson are completed.
 * @param {{ lessonId: string, score: number, durationMs: number }} props
 */
export function trackLessonCompleted({ lessonId, score, durationMs }) {
  track('lesson_completed', { lessonId, score, durationMs });
}

/**
 * Fired when a user exits mid-lesson.
 * @param {{ lessonId: string, phase: 'Watch' | 'Imagine' | 'Do' }} props
 */
export function trackLessonAbandoned({ lessonId, phase }) {
  track('lesson_abandoned', { lessonId, phase });
}
