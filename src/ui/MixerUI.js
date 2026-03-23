/**
 * MixerUI — connects DOM elements to MixerState bidirectionally.
 *
 * DOM input events update the state (source: 'ui').
 * State changes from other sources (MIDI, audio) update the DOM.
 */
export class MixerUI extends EventTarget {
  /**
   * @param {import('./MixerState.js').MixerState} state
   */
  constructor(state) {
    super();
    this._state = state;

    /** @type {Record<string, HTMLInputElement>} */
    this._elements = {};
    /** @type {Record<string, HTMLButtonElement>} */
    this._buttons = {};
  }

  /** Query DOM elements, attach input listeners, subscribe to state changes. */
  init() {
    this._queryElements();
    this._attachInputListeners();
    this._attachButtonListeners();
    this._subscribeToState();
    this._syncInitialState();
  }

  /** Find all mixer DOM elements by ID. */
  _queryElements() {
    // EQ knobs
    this._elements['A:eqHigh'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-high-a'));
    this._elements['A:eqMid'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-mid-a'));
    this._elements['A:eqLow'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-low-a'));
    this._elements['B:eqHigh'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-high-b'));
    this._elements['B:eqMid'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-mid-b'));
    this._elements['B:eqLow'] = /** @type {HTMLInputElement} */ (document.getElementById('eq-low-b'));

    // Volume faders
    this._elements['A:volume'] = /** @type {HTMLInputElement} */ (document.getElementById('volume-a'));
    this._elements['B:volume'] = /** @type {HTMLInputElement} */ (document.getElementById('volume-b'));

    // Pitch faders
    this._elements['A:pitch'] = /** @type {HTMLInputElement} */ (document.getElementById('pitch-a'));
    this._elements['B:pitch'] = /** @type {HTMLInputElement} */ (document.getElementById('pitch-b'));

    // Crossfader
    this._elements['shared:crossfader'] = /** @type {HTMLInputElement} */ (document.getElementById('crossfader'));

    // Gain knobs
    this._elements['A:gain'] = /** @type {HTMLInputElement} */ (document.getElementById('gain-a'));
    this._elements['B:gain'] = /** @type {HTMLInputElement} */ (document.getElementById('gain-b'));

    // Filter knobs
    this._elements['A:filter'] = /** @type {HTMLInputElement} */ (document.getElementById('filter-a'));
    this._elements['B:filter'] = /** @type {HTMLInputElement} */ (document.getElementById('filter-b'));

    // Buttons
    this._buttons['playA'] = /** @type {HTMLButtonElement} */ (document.getElementById('play-a'));
    this._buttons['playB'] = /** @type {HTMLButtonElement} */ (document.getElementById('play-b'));
    this._buttons['cueA'] = /** @type {HTMLButtonElement} */ (document.getElementById('cue-a'));
    this._buttons['cueB'] = /** @type {HTMLButtonElement} */ (document.getElementById('cue-b'));
    this._buttons['syncA'] = /** @type {HTMLButtonElement} */ (document.getElementById('sync-a'));
    this._buttons['syncB'] = /** @type {HTMLButtonElement} */ (document.getElementById('sync-b'));
    this._buttons['loadA'] = /** @type {HTMLButtonElement} */ (document.getElementById('load-a'));
    this._buttons['loadB'] = /** @type {HTMLButtonElement} */ (document.getElementById('load-b'));

    // Pad buttons
    for (const deck of ['A', 'B']) {
      for (let p = 1; p <= 4; p++) {
        this._buttons[`pad${deck}${p}`] = /** @type {HTMLButtonElement} */ (
          document.getElementById(`pad-${p}-${deck.toLowerCase()}`)
        );
      }
    }

    // Hidden file inputs
    this._elements['fileA'] = /** @type {HTMLInputElement} */ (document.getElementById('file-a'));
    this._elements['fileB'] = /** @type {HTMLInputElement} */ (document.getElementById('file-b'));
  }

  /** Attach input event listeners for faders and knobs. */
  _attachInputListeners() {
    // EQ knobs — range is already -24 to +6 in the HTML, value maps directly
    this._bindRange('A:eqHigh', 'A', 'eqHigh', parseFloat);
    this._bindRange('A:eqMid', 'A', 'eqMid', parseFloat);
    this._bindRange('A:eqLow', 'A', 'eqLow', parseFloat);
    this._bindRange('B:eqHigh', 'B', 'eqHigh', parseFloat);
    this._bindRange('B:eqMid', 'B', 'eqMid', parseFloat);
    this._bindRange('B:eqLow', 'B', 'eqLow', parseFloat);

    // Volume faders — HTML range 0-100, state stores 0-1
    this._bindRange('A:volume', 'A', 'volume', (v) => parseFloat(v) / 100);
    this._bindRange('B:volume', 'B', 'volume', (v) => parseFloat(v) / 100);

    // Pitch faders — HTML range -8 to +8, maps directly
    this._bindRange('A:pitch', 'A', 'pitch', parseFloat);
    this._bindRange('B:pitch', 'B', 'pitch', parseFloat);

    // Crossfader — HTML range -100 to +100, state stores -1 to +1
    this._bindRange('shared:crossfader', 'shared', 'crossfader', (v) => parseFloat(v) / 100);

    // Gain knobs — HTML range 0-200, state stores 0-2 (center=1.0)
    this._bindRange('A:gain', 'A', 'gain', (v) => parseFloat(v) / 100);
    this._bindRange('B:gain', 'B', 'gain', (v) => parseFloat(v) / 100);

    // Filter knobs — HTML range 0-100, state stores 0-1
    this._bindRange('A:filter', 'A', 'filter', (v) => parseFloat(v) / 100);
    this._bindRange('B:filter', 'B', 'filter', (v) => parseFloat(v) / 100);
  }

  /**
   * Bind a range input to a state parameter.
   * @param {string} elementKey — key in this._elements
   * @param {'A' | 'B' | 'shared'} deck
   * @param {string} param
   * @param {(value: string) => number} normalize — convert DOM value to state value
   */
  _bindRange(elementKey, deck, param, normalize) {
    const el = this._elements[elementKey];
    if (!el) return;

    el.addEventListener('input', () => {
      const value = normalize(el.value);
      this._state.set(deck, param, value, 'ui');
    });
  }

  /** Attach click listeners for transport and load buttons. */
  _attachButtonListeners() {
    // Play buttons — toggle isPlaying
    this._buttons['playA']?.addEventListener('click', () => {
      const current = this._state.get('A', 'isPlaying');
      this._state.set('A', 'isPlaying', !current, 'ui');
    });

    this._buttons['playB']?.addEventListener('click', () => {
      const current = this._state.get('B', 'isPlaying');
      this._state.set('B', 'isPlaying', !current, 'ui');
    });

    // Cue buttons — dispatch cue event
    this._buttons['cueA']?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cue', { detail: { deck: 'A' } }));
    });

    this._buttons['cueB']?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cue', { detail: { deck: 'B' } }));
    });

    // Sync buttons — dispatch sync event
    this._buttons['syncA']?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('sync', { detail: { deck: 'A' } }));
    });

    this._buttons['syncB']?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('sync', { detail: { deck: 'B' } }));
    });

    // Pad buttons — dispatch pad event
    for (const deck of ['A', 'B']) {
      for (let p = 1; p <= 4; p++) {
        this._buttons[`pad${deck}${p}`]?.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('pad', { detail: { deck, pad: p } }));
        });
      }
    }

    // Load buttons — trigger hidden file input
    this._buttons['loadA']?.addEventListener('click', () => {
      this._elements['fileA']?.click();
    });

    this._buttons['loadB']?.addEventListener('click', () => {
      this._elements['fileB']?.click();
    });

    // File input change — dispatch load-track event
    this._elements['fileA']?.addEventListener('change', (e) => {
      const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
      if (file) {
        this.dispatchEvent(new CustomEvent('load-track', { detail: { deck: 'A', file } }));
      }
    });

    this._elements['fileB']?.addEventListener('change', (e) => {
      const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
      if (file) {
        this.dispatchEvent(new CustomEvent('load-track', { detail: { deck: 'B', file } }));
      }
    });
  }

  /** Subscribe to state changes and update DOM elements. */
  _subscribeToState() {
    this._state.addEventListener('change', (e) => {
      const { deck, param, value, source } = /** @type {CustomEvent} */ (e).detail;

      // Skip DOM updates when the change came from the UI itself
      if (source === 'ui') return;

      this._updateDOM(deck, param, value);
    });
  }

  /**
   * Update a DOM element to reflect a state change.
   * @param {'A' | 'B' | 'shared'} deck
   * @param {string} param
   * @param {number | boolean} value
   */
  _updateDOM(deck, param, value) {
    // Handle play button glow state
    if (param === 'isPlaying') {
      const btnKey = deck === 'A' ? 'playA' : 'playB';
      const btn = this._buttons[btnKey];
      if (!btn) return;

      const glowClass = deck === 'A' ? 'glow-a-strong' : 'glow-b-strong';
      const baseGlow = deck === 'A' ? 'glow-a' : 'glow-b';

      if (value) {
        btn.classList.remove(baseGlow);
        btn.classList.add(glowClass);
        btn.textContent = 'Pause';
      } else {
        btn.classList.remove(glowClass);
        btn.classList.add(baseGlow);
        btn.textContent = 'Play';
      }
      return;
    }

    // Map state param back to DOM element key and denormalize
    const elementKey = deck === 'shared' ? `shared:${param}` : `${deck}:${param}`;
    const el = this._elements[elementKey];
    if (!el) return;

    // Denormalize from state value to DOM range value
    let domValue;
    if (param === 'volume' || param === 'gain' || param === 'filter') {
      domValue = /** @type {number} */ (value) * 100;
    } else if (param === 'crossfader') {
      domValue = /** @type {number} */ (value) * 100;
    } else {
      // eqHigh, eqMid, eqLow, pitch — direct mapping
      domValue = value;
    }

    el.value = String(domValue);
  }

  /** Push the initial state values into the DOM. */
  _syncInitialState() {
    for (const deck of /** @type {const} */ (['A', 'B'])) {
      for (const param of ['gain', 'volume', 'eqHigh', 'eqMid', 'eqLow', 'pitch', 'filter']) {
        const value = this._state.get(deck, param);
        if (value !== undefined) {
          this._updateDOM(deck, param, value);
        }
      }
      // Sync play button state
      this._updateDOM(deck, 'isPlaying', this._state.get(deck, 'isPlaying'));
    }
    // Crossfader
    const cfValue = this._state.get('shared', 'crossfader');
    if (cfValue !== undefined) {
      this._updateDOM('shared', 'crossfader', cfValue);
    }
  }
}
