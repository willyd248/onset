/**
 * MixerBridge — connects MixerState to the audio engine and MIDI router.
 *
 * State changes flow to the audio engine.
 * MIDI router events flow into state (source: 'midi').
 */
export class MixerBridge {
  /**
   * @param {import('./MixerState.js').MixerState} state
   * @param {{ A: import('../audio/Deck.js').Deck, B: import('../audio/Deck.js').Deck }} decks
   * @param {import('../audio/Crossfader.js').Crossfader} crossfader
   * @param {import('../midi/MIDIRouter.js').MIDIRouter | null} router
   */
  constructor(state, decks, crossfader, router) {
    this._state = state;
    this._decks = decks;
    this._crossfader = crossfader;
    this._router = router;
  }

  /** Wire up all subscriptions. */
  init() {
    this._stateListener = (e) => {
      const { deck, param, value, source } = /** @type {CustomEvent} */ (e).detail;

      // Route to the correct audio engine call
      if (deck === 'A' || deck === 'B') {
        this._applyDeckParam(deck, param, value);
      } else if (deck === 'shared') {
        this._applySharedParam(param, value);
      }
    };
    this._state.addEventListener('change', this._stateListener);

    if (this._router) {
      this._subscribeToMIDI();
    }
    this._subscribeToDecks();
  }

  /** Remove listeners to prevent leaks. */
  destroy() {
    if (this._stateListener) {
      this._state.removeEventListener('change', this._stateListener);
      this._stateListener = null;
    }
  }

  /**
   * Apply a deck parameter change to the audio engine.
   * @param {'A' | 'B'} deck
   * @param {string} param
   * @param {number | boolean} value
   */
  _applyDeckParam(deck, param, value) {
    const d = this._decks[deck];
    if (!d) return;

    switch (param) {
      case 'gain':
        d.setGain(/** @type {number} */ (value));
        break;
      case 'volume':
        d.setVolume(/** @type {number} */ (value));
        break;
      case 'eqHigh':
        d.setEQHigh(/** @type {number} */ (value));
        break;
      case 'eqMid':
        d.setEQMid(/** @type {number} */ (value));
        break;
      case 'eqLow':
        d.setEQLow(/** @type {number} */ (value));
        break;
      case 'pitch':
        // State pitch is -8 to +8 (percent). Audio engine wants rate 0.92–1.08.
        d.setPitch(1 + /** @type {number} */ (value) / 100);
        break;
      case 'filter':
        d.setFilter(/** @type {number} */ (value));
        break;
      case 'isPlaying':
        if (value) {
          d.play();
        } else {
          d.pause();
        }
        break;
    }
  }

  /**
   * Apply a shared parameter change to the audio engine.
   * @param {string} param
   * @param {number} value
   */
  _applySharedParam(param, value) {
    if (param === 'crossfader') {
      this._crossfader.position = value;
    }
  }

  /** MIDI router events → state updates. */
  _subscribeToMIDI() {
    const router = /** @type {import('../midi/MIDIRouter.js').MIDIRouter} */ (this._router);
    console.log('[MixerBridge] MIDI subscriptions active — router:', !!router);

    // Gain knobs (MIDI sends 0-1, normalize to 0-2, center=1.0)
    router.addEventListener('deck-a:gain', (e) => {
      this._state.set('A', 'gain', /** @type {CustomEvent} */ (e).detail.value * 2, 'midi');
    });
    router.addEventListener('deck-b:gain', (e) => {
      this._state.set('B', 'gain', /** @type {CustomEvent} */ (e).detail.value * 2, 'midi');
    });

    // Volume faders (MIDI sends 0-1)
    router.addEventListener('deck-a:volume', (e) => {
      this._state.set('A', 'volume', /** @type {CustomEvent} */ (e).detail.value, 'midi');
    });
    router.addEventListener('deck-b:volume', (e) => {
      this._state.set('B', 'volume', /** @type {CustomEvent} */ (e).detail.value, 'midi');
    });

    // EQ high (MIDI sends 0-1, normalize to -24..+6 dB)
    router.addEventListener('deck-a:eq-high', (e) => {
      this._state.set('A', 'eqHigh', this._midiToEQ(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });
    router.addEventListener('deck-b:eq-high', (e) => {
      this._state.set('B', 'eqHigh', this._midiToEQ(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });

    // EQ low (MIDI sends 0-1, normalize to -24..+6 dB)
    router.addEventListener('deck-a:eq-low', (e) => {
      this._state.set('A', 'eqLow', this._midiToEQ(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });
    router.addEventListener('deck-b:eq-low', (e) => {
      this._state.set('B', 'eqLow', this._midiToEQ(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });

    // Pitch faders (MIDI sends 0-1, normalize to -8..+8)
    router.addEventListener('deck-a:pitch', (e) => {
      this._state.set('A', 'pitch', this._midiToPitch(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });
    router.addEventListener('deck-b:pitch', (e) => {
      this._state.set('B', 'pitch', this._midiToPitch(/** @type {CustomEvent} */ (e).detail.value), 'midi');
    });

    // Crossfader (MIDI sends 0-1, normalize to -1..+1)
    router.addEventListener('crossfader', (e) => {
      const midiValue = /** @type {CustomEvent} */ (e).detail.value;
      this._state.set('shared', 'crossfader', midiValue * 2 - 1, 'midi');
    });

    // Play buttons (note on = toggle)
    router.addEventListener('deck-a:play', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        const current = this._state.get('A', 'isPlaying');
        this._state.set('A', 'isPlaying', !current, 'midi');
      }
    });
    router.addEventListener('deck-b:play', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        const current = this._state.get('B', 'isPlaying');
        this._state.set('B', 'isPlaying', !current, 'midi');
      }
    });

    // Cue buttons (note on = cue)
    router.addEventListener('deck-a:cue', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        this._decks.A.cue();
        this._state.set('A', 'isPlaying', false, 'midi');
      }
    });
    router.addEventListener('deck-b:cue', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        this._decks.B.cue();
        this._state.set('B', 'isPlaying', false, 'midi');
      }
    });

    // Sync buttons — copy pitch from the other deck
    router.addEventListener('deck-a:sync', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        const otherPitch = this._state.get('B', 'pitch');
        this._state.set('A', 'pitch', otherPitch, 'midi');
      }
    });
    router.addEventListener('deck-b:sync', (e) => {
      if (/** @type {CustomEvent} */ (e).detail.value === 1) {
        const otherPitch = this._state.get('A', 'pitch');
        this._state.set('B', 'pitch', otherPitch, 'midi');
      }
    });

    // Filter knobs (MIDI sends 0-1, store directly)
    router.addEventListener('deck-a:filter', (e) => {
      this._state.set('A', 'filter', /** @type {CustomEvent} */ (e).detail.value, 'midi');
    });
    router.addEventListener('deck-b:filter', (e) => {
      this._state.set('B', 'filter', /** @type {CustomEvent} */ (e).detail.value, 'midi');
    });

    // Hot cue pads — first press sets, second press jumps
    for (const deckName of ['A', 'B']) {
      for (let p = 1; p <= 4; p++) {
        const eventName = `deck-${deckName.toLowerCase()}:pad-${p}`;
        router.addEventListener(eventName, (e) => {
          if (/** @type {CustomEvent} */ (e).detail.value !== 1) return;
          const cues = this._state.get(deckName, 'hotCues');
          const deck = this._decks[deckName];
          const idx = p - 1;
          if (cues[idx] === null) {
            // Set hot cue at current position
            cues[idx] = deck.currentTime;
            this._state.set(deckName, 'hotCues', [...cues], 'midi');
          } else {
            // Jump to hot cue
            deck.cue();
            deck.setCuePoint(cues[idx]);
            deck.cue();
          }
        });
      }
    }
  }

  /** Listen to deck transport events and sync state back. */
  _subscribeToDecks() {
    for (const deckName of /** @type {const} */ (['A', 'B'])) {
      const deck = this._decks[deckName];

      deck.addEventListener('play', () => {
        if (!this._state.get(deckName, 'isPlaying')) {
          this._state.set(deckName, 'isPlaying', true, 'audio');
        }
      });

      deck.addEventListener('pause', () => {
        if (this._state.get(deckName, 'isPlaying')) {
          this._state.set(deckName, 'isPlaying', false, 'audio');
        }
      });

      deck.addEventListener('ended', () => {
        this._state.set(deckName, 'isPlaying', false, 'audio');
      });

      deck.addEventListener('cue', () => {
        this._state.set(deckName, 'isPlaying', false, 'audio');
      });
    }
  }

  /**
   * Convert MIDI 0-1 value to EQ dB range (-24 to +6).
   * Center point (0.5) maps to 0 dB (neutral).
   * @param {number} value — 0.0 to 1.0
   * @returns {number} — -24 to +6 dB
   */
  _midiToEQ(value) {
    // 0 → -24, 0.5 → 0, 1.0 → +6
    if (value <= 0.5) {
      return -24 + (value / 0.5) * 24;
    }
    return ((value - 0.5) / 0.5) * 6;
  }

  /**
   * Convert MIDI 0-1 value to pitch range (-8 to +8).
   * @param {number} value — 0.0 to 1.0
   * @returns {number} — -8 to +8
   */
  _midiToPitch(value) {
    return value * 16 - 8;
  }
}
