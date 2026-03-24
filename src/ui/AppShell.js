/**
 * @module AppShell
 * Manages the app shell behavior — mode switching, panel collapse,
 * connection status, file drop zones, and minimum width handling.
 */

/** @typedef {'lessons' | 'freeplay'} AppMode */
/** @typedef {'connected' | 'disconnected' | 'no-midi'} ConnectionStatus */

const MIN_WIDTH = 1200;

export class AppShell {
  constructor() {
    /** @type {AppMode} */
    this._mode = 'lessons';

    /** @type {ConnectionStatus} */
    this._connectionStatus = 'disconnected';

    /** @type {HTMLElement | null} */
    this._midiStatusEl = null;

    /** @type {HTMLElement | null} */
    this._lessonPanel = null;

    /** @type {HTMLElement | null} */
    this._overlay = null;

    /** @type {HTMLButtonElement | null} */
    this._lessonsBtn = null;

    /** @type {HTMLButtonElement | null} */
    this._freeplayBtn = null;
  }

  /** Set up all shell behaviors */
  init() {
    this._midiStatusEl = document.getElementById('midi-status');
    this._lessonPanel = document.querySelector('.lesson-panel');
    this._overlay = document.getElementById('min-width-overlay');
    this._lessonsBtn = document.getElementById('mode-lessons');
    this._freeplayBtn = document.getElementById('mode-freeplay');

    this._initModeToggle();
    this._initDropZones();
    this._initMinWidthCheck();

    // Apply initial state
    this.setMode('lessons');
    this.setConnectionStatus('disconnected');
  }

  // ── Mode switching ──────────────────────────────────────────────

  /** @private */
  _initModeToggle() {
    this._lessonsBtn?.addEventListener('click', () => this.setMode('lessons'));
    this._freeplayBtn?.addEventListener('click', () => this.setMode('freeplay'));
  }

  /**
   * Switch between Lessons and Free Play mode.
   * @param {AppMode} mode
   */
  setMode(mode) {
    this._mode = mode;

    // Update button active states
    if (mode === 'lessons') {
      this._lessonsBtn?.classList.add('mode-btn--active');
      this._freeplayBtn?.classList.remove('mode-btn--active');
      this._lessonPanel?.classList.remove('lesson-panel--collapsed');
    } else {
      this._freeplayBtn?.classList.add('mode-btn--active');
      this._lessonsBtn?.classList.remove('mode-btn--active');
      this._lessonPanel?.classList.add('lesson-panel--collapsed');
    }

    // Hide/show lesson panel header in free play mode
    const headerEl = this._lessonPanel?.querySelector('.lesson-panel__header');
    if (headerEl) {
      headerEl.style.display = mode === 'freeplay' ? 'none' : '';
    }
  }

  /** @returns {AppMode} */
  get currentMode() {
    return this._mode;
  }

  // ── MIDI connection indicator ───────────────────────────────────

  /**
   * Update the MIDI connection status indicator.
   * @param {ConnectionStatus} status
   */
  setConnectionStatus(status) {
    this._connectionStatus = status;
    const el = this._midiStatusEl;
    if (!el) return;

    // Remove all status classes
    el.classList.remove('connected', 'disconnected', 'no-midi');
    el.classList.add(status);

    /** @type {Record<ConnectionStatus, string>} */
    const labels = {
      connected: 'MIDI: connected',
      disconnected: 'MIDI: disconnected',
      'no-midi': 'MIDI: not available',
    };

    el.textContent = labels[status];
  }

  // ── File drop zones ─────────────────────────────────────────────

  /** @private */
  _initDropZones() {
    const deckA = document.querySelector('.waveform-display--a');
    const deckB = document.querySelector('.waveform-display--b');

    if (deckA) this._setupDropZone(deckA, 'a');
    if (deckB) this._setupDropZone(deckB, 'b');
  }

  /**
   * Wire up drag-and-drop events for a waveform display zone.
   * @private
   * @param {HTMLElement} el
   * @param {'a' | 'b'} deck
   */
  _setupDropZone(el, deck) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drop-active');
    });

    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      el.classList.add('drop-active');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drop-active');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-active');

      const file = e.dataTransfer?.files[0];
      if (!file) return;

      el.dispatchEvent(
        new CustomEvent('track-drop', {
          bubbles: true,
          detail: { deck, file },
        })
      );
    });
  }

  // ── Minimum width enforcement ───────────────────────────────────

  /** @private */
  _initMinWidthCheck() {
    this._checkWidth();
    window.addEventListener('resize', () => this._checkWidth());
  }

  /** @private */
  _checkWidth() {
    if (!this._overlay) return;

    if (window.innerWidth < MIN_WIDTH) {
      this._overlay.classList.add('min-width-overlay--visible');
    } else {
      this._overlay.classList.remove('min-width-overlay--visible');
    }
  }
}
