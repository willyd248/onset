import { describe, it, expect, beforeEach } from 'vitest';
import { LessonLibrary } from '../src/lessons/LessonLibrary.js';
import { SpacedRepetition } from '../src/lessons/SpacedRepetition.js';

describe('LessonLibrary', () => {
  /** @type {LessonLibrary} */
  let library;

  beforeEach(() => {
    localStorage.clear();
    const sr = new SpacedRepetition();
    library = new LessonLibrary(sr);
  });

  // ── buildSession ─────────────────────────────────────────────
  describe('buildSession', () => {
    it('never returns more than 5 lessons regardless of time budget', () => {
      const session = library.buildSession(0.7, { maxMinutes: 1000, difficulty: 'advanced' });
      expect(session.length).toBeLessThanOrEqual(5);
    });

    it('returns at least one lesson when the catalog has available lessons', () => {
      const session = library.buildSession(0.7, { maxMinutes: 100, difficulty: 'beginner' });
      expect(session.length).toBeGreaterThan(0);
    });

    it('respects beginner difficulty ceiling (≤ 2)', () => {
      const session = library.buildSession(0.7, { maxMinutes: 100, difficulty: 'beginner' });
      for (const lesson of session) {
        expect(lesson.difficulty).toBeLessThanOrEqual(2);
      }
    });

    it('respects intermediate difficulty ceiling (≤ 3)', () => {
      // Unlock intermediate lessons by completing beginner ones
      for (const l of library.getAll()) {
        if (l.difficulty <= 2) library.recordCompletion(l.id, 90);
      }
      const session = library.buildSession(0.9, { maxMinutes: 100, difficulty: 'intermediate' });
      for (const lesson of session) {
        expect(lesson.difficulty).toBeLessThanOrEqual(3);
      }
    });

    it('respects advanced difficulty ceiling (≤ 5)', () => {
      const session = library.buildSession(0.9, { maxMinutes: 100, difficulty: 'advanced' });
      for (const lesson of session) {
        expect(lesson.difficulty).toBeLessThanOrEqual(5);
      }
    });

    it('contains no duplicate lessons', () => {
      const session = library.buildSession(0.7, { maxMinutes: 100, difficulty: 'advanced' });
      const ids = session.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('returns fewer or equal lessons for a shorter time budget', () => {
      const short = library.buildSession(0.7, { maxMinutes: 1, difficulty: 'beginner' });
      const long = library.buildSession(0.7, { maxMinutes: 100, difficulty: 'beginner' });
      expect(short.length).toBeLessThanOrEqual(long.length);
    });

    it('terminates without infinite loop when all available lessons exceed the ceiling', () => {
      // Mark all beginner lessons complete to remove them from candidacy,
      // then request a beginner session — should return empty or terminate
      for (const l of library.getAll()) {
        library.recordCompletion(l.id, 95);
      }
      // Should not hang; may return 0 lessons
      const session = library.buildSession(0.95, { maxMinutes: 100, difficulty: 'beginner' });
      expect(Array.isArray(session)).toBe(true);
    });
  });

  // ── getAvailable ─────────────────────────────────────────────
  describe('getAvailable', () => {
    it('returns at least one lesson for a fresh user', () => {
      expect(library.getAvailable().length).toBeGreaterThan(0);
    });

    it('all returned lessons have their prerequisites met', () => {
      const available = library.getAvailable();
      for (const lesson of available) {
        for (const prereqId of lesson.prerequisiteIds) {
          const progress = library.getProgress(prereqId);
          expect(progress?.completed).toBe(true);
        }
      }
    });

    it('gates lessons behind unmet prerequisites', () => {
      const all = library.getAll();
      const available = library.getAvailable();
      const availableIds = new Set(available.map((l) => l.id));

      for (const lesson of all) {
        const prereqsMet = lesson.prerequisiteIds.every(
          (id) => library.getProgress(id)?.completed
        );
        if (!prereqsMet) {
          expect(availableIds.has(lesson.id)).toBe(false);
        }
      }
    });

    it('makes lessons available once prerequisites are completed', () => {
      const firstLesson = library.getAll().find((l) => l.prerequisiteIds.length === 0);
      if (!firstLesson) return;

      const dependents = library.getAll().filter(
        (l) => l.prerequisiteIds.includes(firstLesson.id) && l.prerequisiteIds.length === 1
      );
      if (!dependents.length) return;

      const target = dependents[0];
      expect(library.getAvailable().some((l) => l.id === target.id)).toBe(false);

      library.recordCompletion(firstLesson.id, 80);
      expect(library.getAvailable().some((l) => l.id === target.id)).toBe(true);
    });
  });

  // ── recordCompletion ─────────────────────────────────────────
  describe('recordCompletion', () => {
    it('marks a lesson completed with the given score', () => {
      library.recordCompletion('basics-load-play', 85);
      const progress = library.getProgress('basics-load-play');
      expect(progress?.completed).toBe(true);
      expect(progress?.bestScore).toBe(85);
    });

    it('keeps the highest score across multiple completions', () => {
      library.recordCompletion('basics-load-play', 70);
      library.recordCompletion('basics-load-play', 90);
      library.recordCompletion('basics-load-play', 60);
      expect(library.getProgress('basics-load-play')?.bestScore).toBe(90);
    });

    it('increments the attempt counter', () => {
      library.recordCompletion('basics-load-play', 70);
      library.recordCompletion('basics-load-play', 80);
      expect(library.getProgress('basics-load-play')?.attempts).toBe(2);
    });
  });

  // ── getStats ─────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns zero completed and full total for a fresh user', () => {
      const stats = library.getStats();
      expect(stats.completed).toBe(0);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.averageScore).toBe(0);
    });

    it('counts completed lessons and computes average score', () => {
      library.recordCompletion('basics-load-play', 80);
      library.recordCompletion('basics-eq-sweep', 60);
      const stats = library.getStats();
      expect(stats.completed).toBe(2);
      expect(stats.averageScore).toBe(70);
    });
  });
});
