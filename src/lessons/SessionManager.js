/**
 * SessionManager — structures 10-15 minute practice sessions with natural stopping points.
 *
 * A session contains 3-5 lessons from the LessonLibrary, interleaved across categories.
 * Between each lesson is a "stopping point" where the user can quit guilt-free.
 * Tracks session timing and provides progress feedback.
 */

export class SessionManager extends EventTarget {
  /**
   * @param {import('./LessonLibrary.js').LessonLibrary} library
   */
  constructor(library) {
    super();
    this._library = library;

    /** @type {import('./lesson-schema.js').LessonDef[]} */
    this._playlist = [];
    this._currentIndex = -1;
    this._sessionStartTime = 0;
    this._isActive = false;
    this._rollingAccuracy = 0.7; // Start at 70% assumed accuracy
  }

  /**
   * Build and start a new session.
   * @returns {import('./lesson-schema.js').LessonDef[]} the session playlist
   */
  startSession() {
    // Read user settings for session length and difficulty
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem('onset:settings') || '{}'); } catch { /* use defaults */ }
    const opts = {
      maxMinutes: settings.sessionLength || 15,
      difficulty: settings.difficulty || 'beginner',
    };
    this._playlist = this._library.buildSession(this._rollingAccuracy, opts);
    this._currentIndex = -1;
    this._sessionStartTime = Date.now();
    this._isActive = true;

    this.dispatchEvent(new CustomEvent('session-started', {
      detail: { playlist: this._playlist },
    }));

    return this._playlist;
  }

  /**
   * Advance to the next lesson in the session.
   * @returns {import('./lesson-schema.js').LessonDef | null} — null if session is complete
   */
  nextLesson() {
    this._currentIndex += 1;

    if (this._currentIndex >= this._playlist.length) {
      this.endSession();
      return null;
    }

    const lesson = this._playlist[this._currentIndex];

    this.dispatchEvent(new CustomEvent('lesson-started', {
      detail: { lesson, index: this._currentIndex, total: this._playlist.length },
    }));

    return lesson;
  }

  /**
   * Record that the current lesson was completed with a score.
   * Updates rolling accuracy for adaptive difficulty.
   * @param {number} score — 0-100
   */
  recordLessonScore(score) {
    // Exponential moving average of accuracy
    const normalizedScore = score / 100;
    this._rollingAccuracy = this._rollingAccuracy * 0.7 + normalizedScore * 0.3;
  }

  /** End the session early or at completion. */
  endSession() {
    this._isActive = false;

    this.dispatchEvent(new CustomEvent('session-ended', {
      detail: {
        lessonsCompleted: this._currentIndex + 1,
        totalLessons: this._playlist.length,
        elapsedMs: Date.now() - this._sessionStartTime,
      },
    }));
  }

  /** @returns {boolean} */
  get isActive() {
    return this._isActive;
  }

  /** @returns {boolean} Whether this is the last lesson in the session */
  get isLastLesson() {
    return this._currentIndex >= this._playlist.length - 1;
  }

  /** @returns {number} Current lesson index (0-based) */
  get currentIndex() {
    return this._currentIndex;
  }

  /** @returns {number} Total lessons in session */
  get totalLessons() {
    return this._playlist.length;
  }

  /** @returns {number} Elapsed session time in ms */
  get elapsedMs() {
    return this._isActive ? Date.now() - this._sessionStartTime : 0;
  }

  /** @returns {number} Rolling accuracy 0-1 */
  get rollingAccuracy() {
    return this._rollingAccuracy;
  }
}
