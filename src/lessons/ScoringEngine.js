/**
 * ScoringEngine — variable reward scoring with accuracy, timing, and phrase alignment.
 *
 * Each step produces a StepScore. Scores aggregate into a lesson score.
 * Variable rewards: streaks, personal bests, "perfect" bonuses.
 */

const STORAGE_KEY = 'onset:scores';

/**
 * @typedef {Object} StepScore
 * @property {string} stepId
 * @property {number} accuracy — 0-100: how close to the target value
 * @property {number} timing — 0-100: how quickly they hit the target
 * @property {number} phrase — 0-100: whether the move landed on a beat/phrase boundary
 * @property {number} weighted — final weighted score for this step
 * @property {boolean} isPerfect — all components >= 90
 */

/**
 * @typedef {Object} LessonScore
 * @property {string} lessonId
 * @property {number} score — 0-100 aggregate
 * @property {StepScore[]} steps
 * @property {number} streak — consecutive successful steps
 * @property {number} maxStreak
 * @property {boolean} isPersonalBest
 * @property {number} timestamp
 */

export class ScoringEngine {
  constructor() {
    /** @type {StepScore[]} */
    this._currentSteps = [];
    this._currentLessonId = '';
    this._streak = 0;
    this._maxStreak = 0;

    /** @type {Map<string, number>} lessonId → best score */
    this._personalBests = new Map();
    this._loadBests();
  }

  /**
   * Start scoring a new lesson.
   * @param {string} lessonId
   */
  startLesson(lessonId) {
    this._currentSteps = [];
    this._currentLessonId = lessonId;
    this._streak = 0;
    this._maxStreak = 0;
  }

  /**
   * Score a completed step.
   * @param {string} stepId
   * @param {{ accuracy: number, timing: number, phrase: number }} rawScores — each 0-100
   * @param {{ accuracy: number, timing: number, phrase: number }} weights — should sum to 1
   * @returns {StepScore}
   */
  scoreStep(stepId, rawScores, weights) {
    const weighted =
      rawScores.accuracy * weights.accuracy +
      rawScores.timing * weights.timing +
      rawScores.phrase * weights.phrase;

    const isPerfect = rawScores.accuracy >= 90 && rawScores.timing >= 90 && rawScores.phrase >= 90;

    // Update streak
    if (weighted >= 60) {
      this._streak += 1;
    } else {
      this._streak = 0;
    }
    this._maxStreak = Math.max(this._maxStreak, this._streak);

    /** @type {StepScore} */
    const stepScore = {
      stepId,
      accuracy: Math.round(rawScores.accuracy),
      timing: Math.round(rawScores.timing),
      phrase: Math.round(rawScores.phrase),
      weighted: Math.round(weighted),
      isPerfect,
    };

    this._currentSteps.push(stepScore);
    return stepScore;
  }

  /**
   * Finalize the lesson and return the aggregate score.
   * @returns {LessonScore}
   */
  finishLesson() {
    const totalWeighted = this._currentSteps.reduce((sum, s) => sum + s.weighted, 0);
    const score = this._currentSteps.length > 0
      ? Math.round(totalWeighted / this._currentSteps.length)
      : 0;

    const prevBest = this._personalBests.get(this._currentLessonId) || 0;
    const isPersonalBest = score > prevBest;

    if (isPersonalBest) {
      this._personalBests.set(this._currentLessonId, score);
      this._saveBests();
    }

    /** @type {LessonScore} */
    const result = {
      lessonId: this._currentLessonId,
      score,
      steps: [...this._currentSteps],
      streak: this._streak,
      maxStreak: this._maxStreak,
      isPersonalBest,
      timestamp: Date.now(),
    };

    return result;
  }

  /**
   * Calculate accuracy score based on distance from target.
   * @param {number} actual — current value
   * @param {number} target — expected value
   * @param {number} tolerance — acceptable deviation
   * @returns {number} 0-100
   */
  static calcAccuracy(actual, target, tolerance) {
    const distance = Math.abs(actual - target);
    if (distance <= tolerance * 0.25) return 100; // Dead on
    if (distance <= tolerance) return 100 - ((distance / tolerance) * 30); // Within tolerance: 70-100
    if (distance <= tolerance * 2) return 40 - ((distance - tolerance) / tolerance) * 40; // Close: 0-40
    return 0; // Way off
  }

  /**
   * Calculate timing score based on how quickly the user hit the target.
   * @param {number} elapsedMs — time since step started
   * @param {number | null} timeLimitMs — optional time limit
   * @returns {number} 0-100
   */
  static calcTiming(elapsedMs, timeLimitMs) {
    if (!timeLimitMs) {
      // No time limit — score based on reasonable speed
      if (elapsedMs < 2000) return 100;
      if (elapsedMs < 5000) return 80;
      if (elapsedMs < 10000) return 60;
      if (elapsedMs < 20000) return 40;
      return 20;
    }

    const ratio = elapsedMs / timeLimitMs;
    if (ratio <= 0.25) return 100;
    if (ratio <= 0.5) return 85;
    if (ratio <= 0.75) return 70;
    if (ratio <= 1.0) return 50;
    return 20; // Over time but still completed
  }

  /**
   * Calculate phrase alignment score.
   * @param {number} actionTimeMs — when the user performed the action
   * @param {number[]} beatGrid — array of beat times in seconds
   * @param {number} bpm — track BPM
   * @returns {number} 0-100
   */
  static calcPhraseAlignment(actionTimeMs, beatGrid, bpm) {
    if (!beatGrid || beatGrid.length === 0 || !bpm) return 50; // No data, neutral score

    const actionTimeSec = actionTimeMs / 1000;

    // Find nearest beat
    let minBeatDist = Infinity;
    for (const beat of beatGrid) {
      const dist = Math.abs(beat - actionTimeSec);
      if (dist < minBeatDist) minBeatDist = dist;
    }

    const beatIntervalSec = 60 / bpm;

    // Check phrase boundary (every 4, 8, or 16 beats)
    const phraseInterval = beatIntervalSec * 8; // 8-beat phrase
    const nearestPhraseDist = actionTimeSec % phraseInterval;
    const phraseDist = Math.min(nearestPhraseDist, phraseInterval - nearestPhraseDist);

    // Score: on a phrase boundary = 100, on a beat = 70, off-beat = lower
    if (phraseDist < beatIntervalSec * 0.25) return 100; // On a phrase boundary
    if (minBeatDist < beatIntervalSec * 0.15) return 75; // On a beat
    if (minBeatDist < beatIntervalSec * 0.3) return 50; // Close to a beat
    return 25; // Off-beat
  }

  /**
   * Get the personal best score for a lesson.
   * @param {string} lessonId
   * @returns {number}
   */
  getPersonalBest(lessonId) {
    return this._personalBests.get(lessonId) || 0;
  }

  /** @private */
  _loadBests() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        for (const [id, score] of Object.entries(data)) {
          this._personalBests.set(id, /** @type {number} */ (score));
        }
      }
    } catch {
      // Start fresh
    }
  }

  /** @private */
  _saveBests() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this._personalBests))); } catch { /* quota exceeded */ }
  }
}
