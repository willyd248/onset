/**
 * SpacedRepetition — SM-2 inspired scheduling for technique retention across sessions.
 *
 * Persists review state in localStorage (immediate) and syncs to Supabase cloud
 * in the background when cloud sync is enabled.
 * Each technique tracks:
 * - lastPracticed: timestamp
 * - interval: days until next review
 * - easeFactor: how easily the user recalls this (starts at 2.5)
 * - repetitions: consecutive successful reviews
 */

const STORAGE_KEY = 'onset:spaced-repetition';

/** @typedef {{ lastPracticed: number, interval: number, easeFactor: number, repetitions: number }} TechniqueRecord */

export class SpacedRepetition {
  constructor() {
    /** @type {Map<string, TechniqueRecord>} */
    this._records = new Map();
    this._load();

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

  /**
   * Record a practice attempt for a technique.
   * @param {string} techniqueId
   * @param {number} quality — 0-5 scale (0=total fail, 3=correct with difficulty, 5=perfect)
   */
  recordAttempt(techniqueId, quality) {
    let record = this._records.get(techniqueId) || {
      lastPracticed: 0,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
    };

    record.lastPracticed = Date.now();

    if (quality >= 3) {
      if (record.repetitions === 0) {
        record.interval = 1;
      } else if (record.repetitions === 1) {
        record.interval = 3;
      } else {
        record.interval = Math.round(record.interval * record.easeFactor);
      }
      record.repetitions += 1;
    } else {
      record.repetitions = 0;
      record.interval = 1;
    }

    // Update ease factor (SM-2 formula)
    record.easeFactor = Math.max(
      1.3,
      record.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    this._records.set(techniqueId, record);
    this._save();
    this._syncToCloud();
  }

  /**
   * Get techniques that are due for review (interval has elapsed).
   * @returns {string[]} technique IDs sorted by most overdue first
   */
  getDueForReview() {
    const now = Date.now();
    const due = [];

    for (const [id, record] of this._records) {
      const nextReview = record.lastPracticed + record.interval * 24 * 60 * 60 * 1000;
      if (now >= nextReview) {
        due.push({ id, overdueDays: (now - nextReview) / (24 * 60 * 60 * 1000) });
      }
    }

    due.sort((a, b) => b.overdueDays - a.overdueDays);
    return due.map((d) => d.id);
  }

  /**
   * Check if a technique has ever been practiced.
   * @param {string} techniqueId
   * @returns {boolean}
   */
  hasPracticed(techniqueId) {
    return this._records.has(techniqueId);
  }

  /**
   * Get the record for a technique.
   * @param {string} techniqueId
   * @returns {TechniqueRecord | null}
   */
  getRecord(techniqueId) {
    return this._records.get(techniqueId) || null;
  }

  /**
   * Convert a lesson score (0-100) to SM-2 quality (0-5).
   * @param {number} score — 0 to 100
   * @returns {number} — 0 to 5
   */
  static scoreToQuality(score) {
    if (score >= 95) return 5;
    if (score >= 80) return 4;
    if (score >= 60) return 3;
    if (score >= 40) return 2;
    if (score >= 20) return 1;
    return 0;
  }

  // ── Persistence ───────────────────────────────────────────────

  /** @private */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        for (const [id, record] of Object.entries(data)) {
          this._records.set(id, /** @type {TechniqueRecord} */ (record));
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
  }

  /** @private */
  _save() {
    try {
      const obj = Object.fromEntries(this._records);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch { /* quota exceeded */ }
  }

  /** @private — Load from Supabase (overwrites localStorage cache). */
  async _loadFromCloud() {
    if (!this._supabase || !this._userId) return;
    try {
      const { data, error } = await this._supabase
        .from('spaced_repetition')
        .select('records')
        .eq('user_id', this._userId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.records) return;

      this._records = new Map(Object.entries(data.records));
      this._save(); // update localStorage cache
    } catch (err) {
      console.warn('[spaced-rep] Failed to load from cloud:', err.message);
    }
  }

  /** @private — Fire-and-forget sync to Supabase. */
  _syncToCloud() {
    if (!this._supabase || !this._userId) return;
    const records = Object.fromEntries(this._records);
    this._supabase
      .from('spaced_repetition')
      .upsert({
        user_id:    this._userId,
        records,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn('[spaced-rep] Cloud sync failed:', error.message);
      });
  }
}
