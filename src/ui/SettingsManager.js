/**
 * SettingsManager — persists user preferences to localStorage.
 * Handles difficulty, session length, and theme.
 */

const STORAGE_KEY = 'onset:settings';

export class SettingsManager {
  constructor() {
    this._settings = this._load();
    this._applyTheme();
    this._bindControls();
  }

  get difficulty() { return this._settings.difficulty; }
  get sessionLength() { return this._settings.sessionLength; }
  get theme() { return this._settings.theme; }

  /** @private */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          difficulty: data.difficulty || 'beginner',
          sessionLength: data.sessionLength || 15,
          theme: data.theme || 'system',
        };
      }
    } catch { /* start fresh */ }
    return { difficulty: 'beginner', sessionLength: 15, theme: 'system' };
  }

  /** @private */
  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
  }

  /** @private */
  _applyTheme() {
    const theme = this._settings.theme;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /** @private */
  _bindControls() {
    const difficultyEl = /** @type {HTMLSelectElement} */ (document.getElementById('settings-difficulty'));
    const sessionEl = /** @type {HTMLSelectElement} */ (document.getElementById('settings-session-length'));
    const themeEl = /** @type {HTMLSelectElement} */ (document.getElementById('settings-theme'));

    if (difficultyEl) {
      difficultyEl.value = this._settings.difficulty;
      difficultyEl.addEventListener('change', () => {
        this._settings.difficulty = difficultyEl.value;
        this._save();
      });
    }

    if (sessionEl) {
      sessionEl.value = String(this._settings.sessionLength);
      sessionEl.addEventListener('change', () => {
        this._settings.sessionLength = parseInt(sessionEl.value, 10);
        this._save();
      });
    }

    if (themeEl) {
      themeEl.value = this._settings.theme;
      themeEl.addEventListener('change', () => {
        this._settings.theme = themeEl.value;
        this._save();
        this._applyTheme();
      });
    }
  }
}
