/**
 * Crossfader — blends between Deck A and Deck B outputs.
 * Two GainNodes with complementary gain curves feeding into the engine's merger.
 */
export class Crossfader {
  /**
   * @param {import('./AudioEngine.js').AudioEngine} engine
   */
  constructor(engine) {
    this._ctx = engine.context;

    this._gainA = this._ctx.createGain();
    this._gainB = this._ctx.createGain();

    // Connect both gains into the merger (channel 0 = left, channel 1 = right)
    // Using a single stereo path — both decks merge into the master
    this._gainA.connect(engine.merger, 0, 0);
    this._gainA.connect(engine.merger, 0, 1);
    this._gainB.connect(engine.merger, 0, 0);
    this._gainB.connect(engine.merger, 0, 1);

    this._position = 0; // -1.0 (full A) to 1.0 (full B)
    this._curve = 'smooth';

    this._applyGains();
  }

  /**
   * Set crossfader position.
   * @param {number} value — -1.0 (full A) to 1.0 (full B), 0 = center
   */
  set position(value) {
    this._position = Math.max(-1, Math.min(1, value));
    this._applyGains();
  }

  /** @returns {number} */
  get position() {
    return this._position;
  }

  /**
   * Set crossfader curve type.
   * @param {'linear' | 'smooth' | 'sharp'} type
   */
  set curve(type) {
    if (!['linear', 'smooth', 'sharp'].includes(type)) return;
    this._curve = type;
    this._applyGains();
  }

  /** @returns {string} */
  get curve() {
    return this._curve;
  }

  /** @returns {GainNode} Connect Deck A's output to this */
  get inputA() {
    return this._gainA;
  }

  /** @returns {GainNode} Connect Deck B's output to this */
  get inputB() {
    return this._gainB;
  }

  /** Apply gain values based on position and curve type. */
  _applyGains() {
    const pos = this._position;
    let gainA, gainB;

    switch (this._curve) {
      case 'linear':
        gainA = (1 - pos) / 2;
        gainB = (1 + pos) / 2;
        break;

      case 'smooth': {
        // Equal-power crossfade
        const angle = (pos + 1) / 2 * (Math.PI / 2);
        gainA = Math.cos(angle);
        gainB = Math.sin(angle);
        break;
      }

      case 'sharp': {
        // Hard cut — drops to 0 quickly past ±0.8
        const threshold = 0.8;
        if (pos <= -threshold) {
          gainA = 1;
          gainB = 0;
        } else if (pos >= threshold) {
          gainA = 0;
          gainB = 1;
        } else {
          // Linear in the middle zone
          const normalized = (pos + threshold) / (2 * threshold);
          gainA = 1 - normalized;
          gainB = normalized;
        }
        break;
      }

      default:
        gainA = 0.5;
        gainB = 0.5;
    }

    this._gainA.gain.setValueAtTime(gainA, this._ctx.currentTime);
    this._gainB.gain.setValueAtTime(gainB, this._ctx.currentTime);
  }
}
