/**
 * LessonLibrary — manages the lesson catalog, interleaved selection, and progression.
 *
 * Interleaving rules:
 * - Never pick the same technique category back-to-back (or same as last 2)
 * - Mix 60% new lessons / 40% review (from SpacedRepetition)
 * - Respect prerequisite chains
 * - Adaptive: skip lessons that are too easy, surface lessons at the right difficulty
 */

import { LESSON_CATALOG, CATEGORIES } from './lesson-schema.js';

const STORAGE_KEY = 'onset:lesson-progress';

/**
 * @typedef {Object} LessonProgress
 * @property {boolean} completed
 * @property {number} bestScore
 * @property {number} attempts
 * @property {number} lastAttempt — timestamp
 */

export class LessonLibrary {
  /**
   * @param {import('./SpacedRepetition.js').SpacedRepetition} spacedRep
   */
  constructor(spacedRep) {
    this._spacedRep = spacedRep;
    this._catalog = [...LESSON_CATALOG];

    /** @type {Map<string, LessonProgress>} */
    this._progress = new Map();
    this._load();

    /** @type {string[]} recent category history for interleaving */
    this._recentCategories = [];
  }

  /**
   * Get all lessons in the catalog.
   * @returns {import('./lesson-schema.js').LessonDef[]}
   */
  getAll() {
    return this._catalog;
  }

  /**
   * Get a lesson by ID.
   * @param {string} id
   * @returns {import('./lesson-schema.js').LessonDef | undefined}
   */
  getById(id) {
    return this._catalog.find((l) => l.id === id);
  }

  /**
   * Get available lessons (prerequisites met).
   * @returns {import('./lesson-schema.js').LessonDef[]}
   */
  getAvailable() {
    return this._catalog.filter((lesson) =>
      lesson.prerequisiteIds.every((preId) => {
        const progress = this._progress.get(preId);
        return progress && progress.completed;
      })
    );
  }

  /**
   * Select the next lesson using interleaved practice.
   * Balances new material vs review, avoids category repetition.
   *
   * @param {number} [userAccuracy=0.7] — rolling accuracy 0-1 for adaptive difficulty
   * @returns {import('./lesson-schema.js').LessonDef | null}
   */
  selectNext(userAccuracy = 0.7) {
    const available = this.getAvailable();
    if (available.length === 0) return null;

    // Decide: new lesson or review (60/40 split)
    const dueForReview = this._spacedRep.getDueForReview();
    const shouldReview = dueForReview.length > 0 && Math.random() < 0.4;

    if (shouldReview) {
      // Find a review lesson from a different category
      const reviewLesson = this._findReviewLesson(dueForReview, available);
      if (reviewLesson) return reviewLesson;
    }

    // Select a new (or next) lesson
    return this._findNewLesson(available, userAccuracy);
  }

  /**
   * Build a session playlist (3-5 lessons, 10-15 minutes).
   * @param {number} [userAccuracy=0.7]
   * @returns {import('./lesson-schema.js').LessonDef[]}
   */
  buildSession(userAccuracy = 0.7) {
    const session = [];
    let totalMinutes = 0;
    const maxMinutes = 15;
    const usedIds = new Set();

    // Reset recent categories for fresh session
    this._recentCategories = [];

    while (totalMinutes < maxMinutes && session.length < 5) {
      const next = this.selectNext(userAccuracy);
      if (!next || usedIds.has(next.id)) break;

      session.push(next);
      usedIds.add(next.id);
      totalMinutes += next.estimatedMinutes;
      this._recentCategories.push(next.category);
    }

    return session;
  }

  /**
   * Record lesson completion.
   * @param {string} lessonId
   * @param {number} score — 0-100
   */
  recordCompletion(lessonId, score) {
    const existing = this._progress.get(lessonId) || {
      completed: false,
      bestScore: 0,
      attempts: 0,
      lastAttempt: 0,
    };

    existing.completed = true;
    existing.bestScore = Math.max(existing.bestScore, score);
    existing.attempts += 1;
    existing.lastAttempt = Date.now();

    this._progress.set(lessonId, existing);
    this._save();
  }

  /**
   * Get progress for a lesson.
   * @param {string} lessonId
   * @returns {LessonProgress | null}
   */
  getProgress(lessonId) {
    return this._progress.get(lessonId) || null;
  }

  /**
   * Get completion stats.
   * @returns {{ completed: number, total: number, averageScore: number }}
   */
  getStats() {
    let completed = 0;
    let totalScore = 0;

    for (const progress of this._progress.values()) {
      if (progress.completed) {
        completed += 1;
        totalScore += progress.bestScore;
      }
    }

    return {
      completed,
      total: this._catalog.length,
      averageScore: completed > 0 ? Math.round(totalScore / completed) : 0,
    };
  }

  // ── Private ─────────────────────────────────────────────

  /**
   * Find a review lesson from a different category than recent ones.
   * @private
   */
  _findReviewLesson(dueIds, available) {
    const availableIds = new Set(available.map((l) => l.id));

    for (const techniqueId of dueIds) {
      // Find lessons that teach this technique
      const candidates = available.filter(
        (l) => l.technique === techniqueId && availableIds.has(l.id)
      );

      for (const lesson of candidates) {
        if (!this._isCategoryRecent(lesson.category)) {
          this._recentCategories.push(lesson.category);
          return lesson;
        }
      }
    }

    // Fallback: any review lesson
    for (const techniqueId of dueIds) {
      const lesson = available.find((l) => l.technique === techniqueId);
      if (lesson) {
        this._recentCategories.push(lesson.category);
        return lesson;
      }
    }

    return null;
  }

  /**
   * Find a new lesson from a different category, at appropriate difficulty.
   * @private
   */
  _findNewLesson(available, userAccuracy) {
    // Target difficulty based on accuracy (err slightly easy for flow state)
    const targetDifficulty = this._accuracyToDifficulty(userAccuracy);

    // Filter to uncompleted or low-score lessons from non-recent categories
    const candidates = available
      .filter((l) => {
        const progress = this._progress.get(l.id);
        const isNew = !progress || !progress.completed;
        const isLowScore = progress && progress.bestScore < 70;
        return (isNew || isLowScore) && !this._isCategoryRecent(l.category);
      })
      .sort((a, b) => {
        // Sort by closeness to target difficulty
        const aDist = Math.abs(a.difficulty - targetDifficulty);
        const bDist = Math.abs(b.difficulty - targetDifficulty);
        return aDist - bDist;
      });

    if (candidates.length > 0) {
      const pick = candidates[0];
      this._recentCategories.push(pick.category);
      return pick;
    }

    // Fallback: any available lesson not recently categorized
    const fallback = available.find((l) => !this._isCategoryRecent(l.category));
    if (fallback) {
      this._recentCategories.push(fallback.category);
      return fallback;
    }

    // Last resort: first available
    if (available.length > 0) {
      this._recentCategories.push(available[0].category);
      return available[0];
    }

    return null;
  }

  /**
   * Check if a category was used in the last 2 lessons.
   * @private
   */
  _isCategoryRecent(category) {
    const recent = this._recentCategories.slice(-2);
    return recent.includes(category);
  }

  /**
   * Map user accuracy (0-1) to target difficulty (1-5).
   * Errs slightly easy to maintain flow state.
   * @private
   */
  _accuracyToDifficulty(accuracy) {
    // 70-80% accuracy is the sweet spot
    // If accuracy > 85%, push difficulty up
    // If accuracy < 60%, pull difficulty down
    if (accuracy >= 0.9) return 4;
    if (accuracy >= 0.8) return 3;
    if (accuracy >= 0.65) return 2;
    return 1;
  }

  /** @private */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        for (const [id, progress] of Object.entries(data)) {
          this._progress.set(id, /** @type {LessonProgress} */ (progress));
        }
      }
    } catch {
      // Start fresh
    }
  }

  /** @private */
  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this._progress)));
  }
}
