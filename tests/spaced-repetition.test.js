import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpacedRepetition } from '../src/lessons/SpacedRepetition.js';

describe('SpacedRepetition', () => {
  /** @type {SpacedRepetition} */
  let sr;

  beforeEach(() => {
    localStorage.clear();
    sr = new SpacedRepetition();
  });

  // ── scoreToQuality (static) ──────────────────────────────────
  describe('scoreToQuality', () => {
    it.each([
      [100, 5], [95, 5],
      [94, 4], [80, 4],
      [79, 3], [60, 3],
      [59, 2], [40, 2],
      [39, 1], [20, 1],
      [19, 0], [0, 0],
    ])('score %i → quality %i', (score, quality) => {
      expect(SpacedRepetition.scoreToQuality(score)).toBe(quality);
    });
  });

  // ── recordAttempt — SM-2 interval progression ────────────────
  describe('recordAttempt', () => {
    it('first passing attempt (rep 0) sets interval to 1 day', () => {
      sr.recordAttempt('beatmatching', 4);
      const rec = sr.getRecord('beatmatching');
      expect(rec.interval).toBe(1);
      expect(rec.repetitions).toBe(1);
    });

    it('second passing attempt (rep 1) sets interval to 3 days', () => {
      sr.recordAttempt('beatmatching', 4);
      sr.recordAttempt('beatmatching', 4);
      const rec = sr.getRecord('beatmatching');
      expect(rec.interval).toBe(3);
      expect(rec.repetitions).toBe(2);
    });

    it('third passing attempt (rep 2+) multiplies interval by ease factor', () => {
      // q=5 each time: EF after r0→2.6, after r1→2.7; interval at r2 = round(3 * 2.7) = 8
      sr.recordAttempt('beatmatching', 5);
      sr.recordAttempt('beatmatching', 5);
      sr.recordAttempt('beatmatching', 5);
      const rec = sr.getRecord('beatmatching');
      expect(rec.interval).toBe(8);
      expect(rec.repetitions).toBe(3);
    });

    it('failing quality (< 3) resets repetitions and interval to 1', () => {
      sr.recordAttempt('beatmatching', 5);
      sr.recordAttempt('beatmatching', 5);
      sr.recordAttempt('beatmatching', 1); // fail
      const rec = sr.getRecord('beatmatching');
      expect(rec.repetitions).toBe(0);
      expect(rec.interval).toBe(1);
    });

    it('ease factor decreases on poor-but-passing performance (quality=3)', () => {
      sr.recordAttempt('beatmatching', 3);
      // EF' = max(1.3, 2.5 + 0.1 - 2*(0.08 + 2*0.02)) = max(1.3, 2.36) = 2.36
      expect(sr.getRecord('beatmatching').easeFactor).toBeCloseTo(2.36, 5);
    });

    it('ease factor never drops below 1.3', () => {
      for (let i = 0; i < 20; i++) {
        sr.recordAttempt('beatmatching', 0);
      }
      expect(sr.getRecord('beatmatching').easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('records a timestamp on each attempt', () => {
      const before = Date.now();
      sr.recordAttempt('beatmatching', 4);
      const after = Date.now();
      const ts = sr.getRecord('beatmatching').lastPracticed;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  // ── getDueForReview ──────────────────────────────────────────
  describe('getDueForReview', () => {
    it('returns empty when nothing practiced', () => {
      expect(sr.getDueForReview()).toEqual([]);
    });

    it('returns nothing due when just practiced (interval not elapsed)', () => {
      sr.recordAttempt('beatmatching', 4); // interval=1 day
      expect(sr.getDueForReview()).toEqual([]);
    });

    it('returns technique when its interval has elapsed', () => {
      vi.useFakeTimers();
      const start = new Date('2024-01-01').getTime();
      vi.setSystemTime(start);

      sr.recordAttempt('beatmatching', 4); // interval=1 day

      vi.setSystemTime(start + 2 * 24 * 60 * 60 * 1000); // +2 days
      expect(sr.getDueForReview()).toContain('beatmatching');
      vi.useRealTimers();
    });

    it('sorts by most overdue first', () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date('2024-01-01').getTime());
      sr.recordAttempt('beatmatching', 4); // interval=1 day, practiced Jan 1

      vi.setSystemTime(new Date('2024-01-03').getTime());
      sr.recordAttempt('eq-mixing', 4); // interval=1 day, practiced Jan 3

      // Jan 5: beatmatching overdue by 3 days, eq-mixing overdue by 1 day
      vi.setSystemTime(new Date('2024-01-05').getTime());
      const due = sr.getDueForReview();
      expect(due.indexOf('beatmatching')).toBeLessThan(due.indexOf('eq-mixing'));
      vi.useRealTimers();
    });
  });

  // ── hasPracticed ─────────────────────────────────────────────
  describe('hasPracticed', () => {
    it('returns false for an unpracticed technique', () => {
      expect(sr.hasPracticed('beatmatching')).toBe(false);
    });

    it('returns true after the first attempt', () => {
      sr.recordAttempt('beatmatching', 4);
      expect(sr.hasPracticed('beatmatching')).toBe(true);
    });
  });
});
