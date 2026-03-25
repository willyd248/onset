/**
 * ScaffoldManager — controls the fading of guidance from full → partial → minimal.
 *
 * Scaffolding levels:
 *   full    — highlighted control + exact target marker + direction arrow + text instruction
 *   partial — highlighted control + brief text, no target marker
 *   minimal — text instruction only, no visual highlights
 *
 * Transition rules:
 *   3 consecutive passes at current level → drop one level
 *   Any fail at minimal → bump back to partial
 *   Any 2 consecutive fails at partial → bump back to full
 *
 * Persists per-technique scaffold state so returning users pick up where they left off.
 */

const STORAGE_KEY = 'onset:scaffold';

/** @typedef {'full' | 'partial' | 'minimal'} ScaffoldLevel */

/**
 * @typedef {Object} ScaffoldState
 * @property {ScaffoldLevel} level
 * @property {number} consecutivePasses — at current level
 * @property {number} consecutiveFails — at current level
 */

export class ScaffoldManager {
  constructor() {
    /** @type {Map<string, ScaffoldState>} techniqueId → state */
    this._states = new Map();
    this._load();
  }

  /**
   * Get the current scaffold level for a technique.
   * @param {string} techniqueId
   * @param {ScaffoldLevel} [defaultLevel='full']
   * @returns {ScaffoldLevel}
   */
  getLevel(techniqueId, defaultLevel = 'full') {
    const state = this._states.get(techniqueId);
    return state ? state.level : defaultLevel;
  }

  /**
   * Record a step result and potentially adjust the scaffold level.
   * @param {string} techniqueId
   * @param {boolean} passed — did the user pass this step?
   * @returns {{ level: ScaffoldLevel, changed: boolean, direction: 'up' | 'down' | null }}
   */
  recordResult(techniqueId, passed) {
    let state = this._states.get(techniqueId);
    if (!state) {
      state = { level: 'full', consecutivePasses: 0, consecutiveFails: 0 };
    }

    const prevLevel = state.level;

    if (passed) {
      state.consecutivePasses += 1;
      state.consecutiveFails = 0;

      // 3 consecutive passes → drop guidance
      if (state.consecutivePasses >= 3 && state.level !== 'minimal') {
        state.level = state.level === 'full' ? 'partial' : 'minimal';
        state.consecutivePasses = 0;
      }
    } else {
      state.consecutiveFails += 1;
      state.consecutivePasses = 0;

      // Fail at minimal → bump to partial
      if (state.level === 'minimal') {
        state.level = 'partial';
        state.consecutiveFails = 0;
      }
      // 2 consecutive fails at partial → bump to full
      else if (state.level === 'partial' && state.consecutiveFails >= 2) {
        state.level = 'full';
        state.consecutiveFails = 0;
      }
    }

    this._states.set(techniqueId, state);
    this._save();

    const changed = prevLevel !== state.level;
    const direction = changed
      ? (this._levelIndex(state.level) < this._levelIndex(prevLevel) ? 'up' : 'down')
      : null;

    return { level: state.level, changed, direction };
  }

  /**
   * Get what visual elements to show at each scaffold level.
   * @param {ScaffoldLevel} level
   * @returns {{ showHighlight: boolean, showTarget: boolean, showArrow: boolean, showText: boolean }}
   */
  static getVisuals(level) {
    switch (level) {
      case 'full':
        return { showHighlight: true, showTarget: true, showArrow: true, showText: true };
      case 'partial':
        return { showHighlight: true, showTarget: false, showArrow: false, showText: true };
      case 'minimal':
        return { showHighlight: false, showTarget: false, showArrow: false, showText: true };
      default:
        return { showHighlight: true, showTarget: true, showArrow: true, showText: true };
    }
  }

  /**
   * Reset scaffold state for a technique (e.g., if user wants to re-learn).
   * @param {string} techniqueId
   */
  reset(techniqueId) {
    this._states.delete(techniqueId);
    this._save();
  }

  /** @private */
  _levelIndex(level) {
    return { full: 0, partial: 1, minimal: 2 }[level] ?? 0;
  }

  /** @private */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        for (const [id, state] of Object.entries(data)) {
          this._states.set(id, /** @type {ScaffoldState} */ (state));
        }
      }
    } catch {
      // Start fresh
    }
  }

  /** @private */
  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this._states))); } catch { /* quota exceeded */ }
  }
}
