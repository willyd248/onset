/**
 * PerformanceTips — contextual hints for free play mode.
 * Checks mixer state periodically and shows non-intrusive toast tips.
 */
import { Toast } from './Toast.js';

export class PerformanceTips {
  /**
   * @param {import('./MixerState.js').MixerState} mixerState
   */
  constructor(mixerState) {
    this._state = mixerState;
    this._intervalId = null;
    this._lastTipTime = 0;
    this._shownTips = new Set();

    /** @type {number} Minimum interval between tips in ms */
    this._cooldownMs = 15000;
  }

  /** Begin checking conditions periodically. */
  start() {
    this._shownTips.clear();
    this._lastTipTime = 0;
    this._intervalId = setInterval(() => this._check(), 5000);
  }

  /** Stop checking. */
  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** @private */
  _check() {
    const now = Date.now();
    if (now - this._lastTipTime < this._cooldownMs) return;

    const tip = this._evaluateTips();
    if (tip) {
      Toast.show(tip.message);
      this._lastTipTime = now;
      this._shownTips.add(tip.id);
    }
  }

  /**
   * Evaluate conditions and return the first applicable tip not yet shown.
   * @private
   * @returns {{ id: string, message: string } | null}
   */
  _evaluateTips() {
    const playingA = this._state.get('A', 'isPlaying');
    const playingB = this._state.get('B', 'isPlaying');
    const crossfader = this._state.get('shared', 'crossfader');
    const eqHighA = this._state.get('A', 'eqHigh');
    const eqMidA = this._state.get('A', 'eqMid');
    const eqLowA = this._state.get('A', 'eqLow');
    const eqHighB = this._state.get('B', 'eqHigh');
    const eqMidB = this._state.get('B', 'eqMid');
    const eqLowB = this._state.get('B', 'eqLow');
    const pitchA = this._state.get('A', 'pitch');
    const pitchB = this._state.get('B', 'pitch');
    const volA = this._state.get('A', 'volume');
    const volB = this._state.get('B', 'volume');

    const eqAFlat = eqHighA === 0 && eqMidA === 0 && eqLowA === 0;
    const eqBFlat = eqHighB === 0 && eqMidB === 0 && eqLowB === 0;

    const tips = [
      {
        id: 'load-other-deck',
        condition: (playingA && !playingB) || (!playingA && playingB),
        message: 'Load a track on the other deck to start mixing',
      },
      {
        id: 'eq-before-crossfade',
        condition: playingA && playingB && Math.abs(crossfader) > 0.2 && eqAFlat && eqBFlat,
        message: 'Try adjusting the EQ before crossfading',
      },
      {
        id: 'match-tempo',
        condition: playingA && playingB && Math.abs(pitchA - pitchB) > 1,
        message: 'Use the pitch fader to match tempos',
      },
      {
        id: 'cut-bass',
        condition: playingA && playingB && Math.abs(crossfader) > 0.3 && eqLowA === 0 && eqLowB === 0,
        message: 'Cut the bass on the outgoing track for a cleaner transition',
      },
      {
        id: 'try-jog-wheel',
        condition: playingA && playingB && Math.abs(pitchA - pitchB) < 0.5,
        message: 'Try nudging the jog wheel to align the beats',
      },
      {
        id: 'experiment-volume',
        condition: playingA && playingB && volA === 0.8 && volB === 0.8,
        message: 'Try adjusting the volume faders for a smoother blend',
      },
      {
        id: 'try-filter',
        condition: playingA && playingB && crossfader === 0,
        message: 'Move the crossfader to blend between decks',
      },
      {
        id: 'high-eq-cut',
        condition: playingA && playingB && eqHighA > 3 && eqHighB > 3,
        message: 'Boosting highs on both decks can sound harsh — try cutting one',
      },
    ];

    for (const tip of tips) {
      if (tip.condition && !this._shownTips.has(tip.id)) {
        return tip;
      }
    }

    return null;
  }
}
