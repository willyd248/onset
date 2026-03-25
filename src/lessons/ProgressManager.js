/**
 * ProgressManager — central store for XP, streaks, practice time, and lesson completion.
 * Writes to localStorage immediately for offline use, and syncs to Supabase cloud
 * in the background when cloud sync is enabled.
 */

const STORAGE_KEY = 'onset:progress';

/** XP awarded per lesson score bracket */
const XP_TABLE = {
  perfect: 150,  // score >= 90
  great: 100,    // score >= 70
  good: 60,      // score >= 50
  ok: 30,        // score < 50
};

/** Level thresholds (cumulative XP) */
const LEVELS = [
  { level: 1, label: 'Beginner', xp: 0 },
  { level: 2, label: 'Novice', xp: 200 },
  { level: 3, label: 'Apprentice', xp: 500 },
  { level: 4, label: 'Intermediate', xp: 1000 },
  { level: 5, label: 'Advanced', xp: 2000 },
  { level: 6, label: 'Expert', xp: 4000 },
  { level: 7, label: 'Master', xp: 7000 },
  { level: 8, label: 'Legend', xp: 12000 },
];

/**
 * @typedef {Object} ProgressData
 * @property {number} totalXP
 * @property {number} lessonsCompleted
 * @property {number} currentStreak — consecutive days practiced
 * @property {number} bestStreak
 * @property {string|null} lastPracticeDate — ISO date string (YYYY-MM-DD)
 * @property {number} totalPracticeMs — cumulative practice time
 * @property {string[]} completedLessonIds
 * @property {Record<string, number>} categoryScores — category → best aggregate score
 */

export class ProgressManager extends EventTarget {
  constructor() {
    super();
    /** @type {ProgressData} */
    this._data = this._load();
    this._sessionStartTime = 0;

    // Cloud sync — set via setCloudSync() after auth
    /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
    this._supabase = null;
    /** @type {string | null} */
    this._userId = null;
  }

  /**
   * Enable Supabase cloud sync and load cloud data if available.
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   * @param {string} userId
   */
  async setCloudSync(supabase, userId) {
    this._supabase = supabase;
    this._userId = userId;
    await this._loadFromCloud();
  }

  /** Start tracking a practice session. */
  startSession() {
    this._sessionStartTime = Date.now();
  }

  /** End session and accumulate practice time. */
  endSession() {
    if (this._sessionStartTime > 0) {
      this._data.totalPracticeMs += Date.now() - this._sessionStartTime;
      this._sessionStartTime = 0;
      this._save();
      this._syncToCloud();
    }
  }

  /**
   * Record a lesson completion. Awards XP, updates streak, tracks progress.
   * @param {string} lessonId
   * @param {number} score — 0-100
   * @param {string} category — lesson category
   */
  recordLessonComplete(lessonId, score, category) {
    // Award XP
    let xp;
    if (score >= 90) xp = XP_TABLE.perfect;
    else if (score >= 70) xp = XP_TABLE.great;
    else if (score >= 50) xp = XP_TABLE.good;
    else xp = XP_TABLE.ok;

    this._data.totalXP += xp;

    // Track unique lesson completions
    if (!this._data.completedLessonIds.includes(lessonId)) {
      this._data.completedLessonIds.push(lessonId);
      this._data.lessonsCompleted = this._data.completedLessonIds.length;
    }

    // Update category score
    const prev = this._data.categoryScores[category] || 0;
    this._data.categoryScores[category] = Math.max(prev, score);

    // Update streak
    this._updateStreak();

    this._save();
    this._syncToCloud();
    this.dispatchEvent(new CustomEvent('progress-updated', { detail: this.getSummary() }));
  }

  /** Update daily streak based on current date. */
  _updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = this._data.lastPracticeDate;

    if (lastDate === today) return;

    if (lastDate) {
      const last = new Date(lastDate);
      const now = new Date(today);
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        this._data.currentStreak += 1;
      } else if (diffDays > 1) {
        this._data.currentStreak = 1;
      }
    } else {
      this._data.currentStreak = 1;
    }

    this._data.lastPracticeDate = today;
    this._data.bestStreak = Math.max(this._data.bestStreak, this._data.currentStreak);
  }

  /**
   * Get the current level info.
   * @returns {{ level: number, label: string, xp: number, nextLevelXP: number }}
   */
  getLevel() {
    let current = LEVELS[0];
    let nextXP = LEVELS[1]?.xp || Infinity;

    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (this._data.totalXP >= LEVELS[i].xp) {
        current = LEVELS[i];
        nextXP = LEVELS[i + 1]?.xp || Infinity;
        break;
      }
    }

    return { ...current, nextLevelXP: nextXP };
  }

  /**
   * Get summary for UI consumption.
   */
  getSummary() {
    const level = this.getLevel();
    return {
      totalXP: this._data.totalXP,
      lessonsCompleted: this._data.lessonsCompleted,
      currentStreak: this._data.currentStreak,
      bestStreak: this._data.bestStreak,
      practiceHours: Math.round((this._data.totalPracticeMs / (1000 * 60 * 60)) * 10) / 10,
      level: level.level,
      levelLabel: level.label,
      nextLevelXP: level.nextLevelXP,
      completedLessonIds: this._data.completedLessonIds,
      categoryScores: { ...this._data.categoryScores },
    };
  }

  /**
   * Check if a lesson ID has been completed.
   * @param {string} lessonId
   * @returns {boolean}
   */
  isLessonCompleted(lessonId) {
    return this._data.completedLessonIds.includes(lessonId);
  }

  // ── Persistence ───────────────────────────────────────────────

  /** @private — Load from localStorage (fast, synchronous, offline-safe). */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          totalXP: data.totalXP || 0,
          lessonsCompleted: data.lessonsCompleted || 0,
          currentStreak: data.currentStreak || 0,
          bestStreak: data.bestStreak || 0,
          lastPracticeDate: data.lastPracticeDate || null,
          totalPracticeMs: data.totalPracticeMs || 0,
          completedLessonIds: data.completedLessonIds || [],
          categoryScores: data.categoryScores || {},
        };
      }
    } catch {
      // Start fresh
    }
    return {
      totalXP: 0,
      lessonsCompleted: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPracticeDate: null,
      totalPracticeMs: 0,
      completedLessonIds: [],
      categoryScores: {},
    };
  }

  /** @private — Write to localStorage. */
  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data)); } catch { /* quota exceeded */ }
  }

  /** @private — Load from Supabase (overwrites localStorage cache with authoritative data). */
  async _loadFromCloud() {
    if (!this._supabase || !this._userId) return;
    try {
      const { data, error } = await this._supabase
        .from('progress')
        .select('*')
        .eq('user_id', this._userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return; // No cloud row yet — localStorage data is current

      this._data = {
        totalXP:             data.total_xp             || 0,
        lessonsCompleted:    data.lessons_completed     || 0,
        currentStreak:       data.current_streak        || 0,
        bestStreak:          data.best_streak           || 0,
        lastPracticeDate:    data.last_practice_date    || null,
        totalPracticeMs:     Number(data.total_practice_ms) || 0,
        completedLessonIds:  data.completed_lesson_ids  || [],
        categoryScores:      data.category_scores       || {},
      };

      // Keep localStorage in sync as cache
      this._save();
      this.dispatchEvent(new CustomEvent('progress-updated', { detail: this.getSummary() }));
    } catch (err) {
      console.warn('[progress] Failed to load from cloud:', err.message);
    }
  }

  /** @private — Fire-and-forget sync to Supabase. */
  _syncToCloud() {
    if (!this._supabase || !this._userId) return;
    this._supabase
      .from('progress')
      .upsert({
        user_id:              this._userId,
        total_xp:             this._data.totalXP,
        lessons_completed:    this._data.lessonsCompleted,
        current_streak:       this._data.currentStreak,
        best_streak:          this._data.bestStreak,
        last_practice_date:   this._data.lastPracticeDate,
        total_practice_ms:    this._data.totalPracticeMs,
        completed_lesson_ids: this._data.completedLessonIds,
        category_scores:      this._data.categoryScores,
        updated_at:           new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn('[progress] Cloud sync failed:', error.message);
      });
  }
}
