/**
 * MixerState — observable state store for bidirectional binding between MIDI, UI, and audio.
 *
 * Dispatches CustomEvent('change') with detail: { deck, param, value, source }
 * whenever a value is updated. The `source` field ('midi' | 'ui' | 'audio')
 * allows listeners to prevent feedback loops.
 */
export class MixerState extends EventTarget {
  constructor() {
    super();

    /** @type {Record<string, Record<string, number | boolean>>} */
    this._state = {
      A: {
        gain: 1.0,
        volume: 0.8,
        eqHigh: 0,
        eqMid: 0,
        eqLow: 0,
        pitch: 0,
        filter: 0,
        isPlaying: false,
        hotCues: [null, null, null, null],
      },
      B: {
        gain: 1.0,
        volume: 0.8,
        eqHigh: 0,
        eqMid: 0,
        eqLow: 0,
        pitch: 0,
        filter: 0,
        isPlaying: false,
        hotCues: [null, null, null, null],
      },
      shared: {
        crossfader: 0,
      },
    };
  }

  /**
   * Get a parameter value for a deck (or shared).
   * @param {'A' | 'B' | 'shared'} deck
   * @param {string} param
   * @returns {number | boolean | undefined}
   */
  get(deck, param) {
    const group = this._state[deck];
    if (!group) return undefined;
    return group[param];
  }

  /**
   * Set a parameter value and dispatch a change event.
   * @param {'A' | 'B' | 'shared'} deck
   * @param {string} param
   * @param {number | boolean} value
   * @param {'midi' | 'ui' | 'audio'} source — origin of the change, used to prevent feedback loops
   */
  set(deck, param, value, source) {
    const group = this._state[deck];
    if (!group) return;

    const prev = group[param];
    if (prev === value) return;

    group[param] = value;

    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { deck, param, value, source },
      })
    );
  }
}
