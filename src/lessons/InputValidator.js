/**
 * InputValidator — validates MIDI input and audio state against lesson step targets.
 *
 * Subscribes to MixerState changes and provides immediate feedback (<5ms from MIDI).
 * Each validation check returns both a pass/fail AND a continuous 0-100 accuracy score.
 */

import { ScoringEngine } from './ScoringEngine.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} passed
 * @property {number} accuracy — 0-100
 * @property {number} currentValue
 * @property {number} targetValue
 * @property {number} distance — absolute distance from target
 * @property {'cold' | 'warm' | 'hot' | 'hit'} proximity — for Guitar Hero visual feedback
 */

export class InputValidator extends EventTarget {
  /**
   * @param {import('../ui/MixerState.js').MixerState} mixerState
   */
  constructor(mixerState) {
    super();
    this._mixerState = mixerState;
    this._activeTarget = null;
    this._stepStartTime = 0;
    this._onStateChange = this._onStateChange.bind(this);

    // Subscribe to all mixer state changes for immediate feedback
    this._mixerState.addEventListener('change', this._onStateChange);
  }

  /**
   * Start validating a step target. Every relevant state change will be checked.
   * @param {import('./lesson-schema.js').TargetSpec} target
   */
  startValidating(target) {
    this._activeTarget = target;
    this._stepStartTime = performance.now();
  }

  /** Stop active validation. */
  stopValidating() {
    this._activeTarget = null;
  }

  /**
   * Handle a mixer state change — check against active target.
   * @param {Event} event
   * @private
   */
  _onStateChange(event) {
    if (!this._activeTarget) return;

    const { deck, param, value } = /** @type {CustomEvent} */ (event).detail;
    const target = this._activeTarget;

    // Only validate changes relevant to the current target
    if (!this._isRelevant(target, deck, param)) return;

    const result = this.validate(target);

    // Dispatch feedback event for immediate visual response
    this.dispatchEvent(new CustomEvent('input-feedback', {
      detail: {
        ...result,
        deck,
        param,
        target,
        elapsedMs: performance.now() - this._stepStartTime,
      },
    }));

    // If passed, dispatch completion
    if (result.passed) {
      this.dispatchEvent(new CustomEvent('step-complete', {
        detail: {
          ...result,
          elapsedMs: performance.now() - this._stepStartTime,
        },
      }));
    }
  }

  /**
   * Check if a state change is relevant to the current target.
   * @private
   */
  _isRelevant(target, deck, param) {
    switch (target.type) {
      case 'volume_value':
        return deck === target.deck && param === 'volume';
      case 'eq_value':
      case 'eq_kill':
        return deck === target.deck && param === target.param;
      case 'crossfader_position':
        return deck === 'shared' && param === 'crossfader';
      case 'pitch_match':
        return param === 'pitch';
      case 'button_press':
        return deck === target.deck && param === target.param;
      case 'beat_aligned':
        return param === 'pitch' || param === 'jog';
      default:
        return false;
    }
  }

  /**
   * Validate the current mixer state against a target.
   * @param {import('./lesson-schema.js').TargetSpec} target
   * @returns {ValidationResult}
   */
  validate(target) {
    switch (target.type) {
      case 'volume_value':
        return this._validateNumeric(
          this._mixerState.get(target.deck, 'volume'),
          target.value,
          target.tolerance
        );

      case 'eq_value':
        return this._validateNumeric(
          this._mixerState.get(target.deck, target.param),
          target.value,
          target.tolerance
        );

      case 'eq_kill':
        // EQ kill = value at or below -20dB
        return this._validateNumeric(
          this._mixerState.get(target.deck, target.param),
          -24,
          4
        );

      case 'crossfader_position':
        return this._validateNumeric(
          this._mixerState.get('shared', 'crossfader'),
          target.value,
          target.tolerance
        );

      case 'pitch_match':
        return this._validatePitchMatch(target);

      case 'button_press':
        return this._validateButtonPress(target);

      case 'beat_aligned':
        return this._validateBeatAligned(target);

      default:
        return { passed: false, accuracy: 0, currentValue: 0, targetValue: 0, distance: Infinity, proximity: 'cold' };
    }
  }

  /**
   * Validate a numeric value against a target.
   * @private
   * @param {number} current
   * @param {number} target
   * @param {number} tolerance
   * @returns {ValidationResult}
   */
  _validateNumeric(current, target, tolerance) {
    const distance = Math.abs(current - target);
    const accuracy = ScoringEngine.calcAccuracy(current, target, tolerance);
    const passed = distance <= tolerance;

    /** @type {ValidationResult['proximity']} */
    let proximity;
    if (passed) proximity = 'hit';
    else if (distance <= tolerance * 1.5) proximity = 'hot';
    else if (distance <= tolerance * 3) proximity = 'warm';
    else proximity = 'cold';

    return { passed, accuracy, currentValue: current, targetValue: target, distance, proximity };
  }

  /**
   * Validate BPM pitch matching between decks.
   * @private
   */
  _validatePitchMatch(target) {
    const pitchA = this._mixerState.get('A', 'pitch') || 0;
    const pitchB = this._mixerState.get('B', 'pitch') || 0;

    // Pitch values are -8 to +8 (percent deviation)
    // Matching means the effective BPMs are close
    // For simplicity: check if pitch difference is within tolerance
    const diff = Math.abs(pitchA - pitchB);
    const tolerance = target.tolerance || 1;

    return this._validateNumeric(diff, 0, tolerance);
  }

  /**
   * Validate a button press (e.g., play, cue).
   * @private
   */
  _validateButtonPress(target) {
    const value = this._mixerState.get(target.deck, target.param);
    const expected = true;
    const passed = value === expected;

    return {
      passed,
      accuracy: passed ? 100 : 0,
      currentValue: value ? 1 : 0,
      targetValue: 1,
      distance: passed ? 0 : 1,
      proximity: passed ? 'hit' : 'cold',
    };
  }

  /**
   * Validate beat alignment by comparing pitch values between decks.
   * If pitch data isn't available, falls back to auto-pass.
   * @private
   */
  _validateBeatAligned(target) {
    const pitchA = this._mixerState.get('A', 'pitch');
    const pitchB = this._mixerState.get('B', 'pitch');

    // Fall back to auto-pass if pitch values aren't available (no MIDI controller)
    if (pitchA == null || pitchB == null) {
      return { passed: true, accuracy: 70, currentValue: 0, targetValue: 0, distance: 0, proximity: 'hot' };
    }

    const diff = Math.abs(pitchA - pitchB);
    const tolerance = 0.5; // pitch units — close enough to be "aligned"

    // Accuracy: 100 when perfectly matched, scaling down as diff increases
    const maxDiff = 8; // pitch range is typically -8 to +8
    const accuracy = Math.max(0, Math.round(100 * (1 - diff / maxDiff)));
    const passed = diff <= tolerance;

    /** @type {ValidationResult['proximity']} */
    let proximity;
    if (passed) proximity = 'hit';
    else if (diff <= tolerance * 2) proximity = 'hot';
    else if (diff <= tolerance * 4) proximity = 'warm';
    else proximity = 'cold';

    return { passed, accuracy, currentValue: diff, targetValue: 0, distance: diff, proximity };
  }

  /** Clean up listeners. */
  destroy() {
    this._mixerState.removeEventListener('change', this._onStateChange);
  }
}
