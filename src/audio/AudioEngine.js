/**
 * AudioEngine — singleton managing the Web Audio API context and master output chain.
 * Master chain: merger → DynamicsCompressorNode (limiter) → destination
 */
export class AudioEngine extends EventTarget {
  /** @type {AudioEngine | null} */
  static #instance = null;

  /** @returns {AudioEngine} */
  static getInstance() {
    if (!AudioEngine.#instance) {
      AudioEngine.#instance = new AudioEngine();
    }
    return AudioEngine.#instance;
  }

  constructor() {
    super();
    if (AudioEngine.#instance) {
      throw new Error('AudioEngine is a singleton — use AudioEngine.getInstance()');
    }

    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master output chain
    this._merger = this._ctx.createChannelMerger(2);
    this._limiter = this._ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -1;
    this._limiter.knee.value = 0;
    this._limiter.ratio.value = 20;
    this._limiter.attack.value = 0.003;
    this._limiter.release.value = 0.25;

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 1.0;

    this._merger.connect(this._limiter);
    this._limiter.connect(this._masterGain);
    this._masterGain.connect(this._ctx.destination);

    this._initialized = false;
  }

  /**
   * Resume the AudioContext (must be called from a user gesture).
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
    this._initialized = true;

    // Auto-resume if browser suspends the context (tab blur, resource limits)
    this._ctx.addEventListener('statechange', () => {
      if (this._initialized && this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
    });

    this.dispatchEvent(new Event('initialized'));
  }

  /** @returns {AudioContext} */
  get context() {
    return this._ctx;
  }

  /** @returns {GainNode} */
  get masterGain() {
    return this._masterGain;
  }

  /** @returns {ChannelMergerNode} */
  get merger() {
    return this._merger;
  }

  /** @returns {boolean} */
  get isInitialized() {
    return this._initialized;
  }
}
