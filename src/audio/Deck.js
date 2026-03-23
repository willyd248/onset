/**
 * Deck — per-deck audio graph with source, 3-band EQ, volume, pitch, and transport controls.
 * Audio graph: AudioBufferSourceNode → preGain → lowshelf → peaking (mid) → highshelf → GainNode(volume) → output
 */
export class Deck extends EventTarget {
  /**
   * @param {import('./AudioEngine.js').AudioEngine} engine
   * @param {'A' | 'B'} name
   */
  constructor(engine, name) {
    super();
    this._engine = engine;
    this._name = name;
    this._ctx = engine.context;

    // State
    this._buffer = null;
    this._source = null;
    this._isPlaying = false;
    this._startTime = 0;
    this._offset = 0;
    this._cuePoint = 0;
    this._playbackRate = 1.0;

    // EQ nodes
    this._eqLow = this._ctx.createBiquadFilter();
    this._eqLow.type = 'lowshelf';
    this._eqLow.frequency.value = 250;
    this._eqLow.gain.value = 0;

    this._eqMid = this._ctx.createBiquadFilter();
    this._eqMid.type = 'peaking';
    this._eqMid.frequency.value = 1000;
    this._eqMid.Q.value = 1;
    this._eqMid.gain.value = 0;

    this._eqHigh = this._ctx.createBiquadFilter();
    this._eqHigh.type = 'highshelf';
    this._eqHigh.frequency.value = 4000;
    this._eqHigh.gain.value = 0;

    // Pre-gain (input level / trim)
    this._preGainNode = this._ctx.createGain();
    this._preGainNode.gain.value = 1.0;

    // Volume (post-EQ channel fader)
    this._gainNode = this._ctx.createGain();
    this._gainNode.gain.value = 0.8;

    // Chain: preGain → eqLow → eqMid → eqHigh → gain(volume)
    this._preGainNode.connect(this._eqLow);
    this._eqLow.connect(this._eqMid);
    this._eqMid.connect(this._eqHigh);
    this._eqHigh.connect(this._gainNode);
  }

  /**
   * Load an audio file into this deck.
   * @param {File} file
   * @returns {Promise<void>}
   */
  async loadTrack(file) {
    if (this._isPlaying) {
      this.pause();
    }

    const arrayBuffer = await file.arrayBuffer();
    this._buffer = await this._ctx.decodeAudioData(arrayBuffer);
    this._offset = 0;
    this._cuePoint = 0;

    this.dispatchEvent(new CustomEvent('track-loaded', {
      detail: { name: file.name, duration: this._buffer.duration },
    }));
  }

  /** Start playback from current position. */
  play() {
    if (this._isPlaying || !this._buffer) return;

    this._source = this._ctx.createBufferSource();
    this._source.buffer = this._buffer;
    this._source.playbackRate.value = this._playbackRate;
    this._source.connect(this._preGainNode);

    this._source.onended = () => {
      if (this._isPlaying) {
        this._isPlaying = false;
        this._offset = 0;
        this.dispatchEvent(new Event('ended'));
      }
    };

    this._source.start(0, this._offset);
    this._startTime = this._ctx.currentTime;
    this._isPlaying = true;

    this.dispatchEvent(new Event('play'));
  }

  /** Pause playback and store current position. */
  pause() {
    if (!this._isPlaying || !this._source) return;

    this._source.onended = null;
    this._source.stop();
    this._source.disconnect();
    this._source = null;

    this._offset += (this._ctx.currentTime - this._startTime) * this._playbackRate;
    this._isPlaying = false;

    this.dispatchEvent(new Event('pause'));
  }

  /** Return to cue point and stop. */
  cue() {
    if (this._isPlaying) {
      this._source.onended = null;
      this._source.stop();
      this._source.disconnect();
      this._source = null;
      this._isPlaying = false;
    }
    this._offset = this._cuePoint;

    this.dispatchEvent(new Event('cue'));
  }

  /**
   * Set the cue point.
   * @param {number} time — time in seconds
   */
  setCuePoint(time) {
    this._cuePoint = Math.max(0, Math.min(time, this.duration));
  }

  /**
   * Set input gain (pre-EQ trim).
   * @param {number} value — 0.0 to 2.0 (1.0 = unity)
   */
  setGain(value) {
    this._preGainNode.gain.value = Math.max(0, Math.min(2, value));
  }

  /**
   * Set low EQ gain.
   * @param {number} value — dB, range -24 to +6
   */
  setEQLow(value) {
    this._eqLow.gain.value = Math.max(-24, Math.min(6, value));
  }

  /**
   * Set mid EQ gain.
   * @param {number} value — dB, range -24 to +6
   */
  setEQMid(value) {
    this._eqMid.gain.value = Math.max(-24, Math.min(6, value));
  }

  /**
   * Set high EQ gain.
   * @param {number} value — dB, range -24 to +6
   */
  setEQHigh(value) {
    this._eqHigh.gain.value = Math.max(-24, Math.min(6, value));
  }

  /**
   * Set deck volume.
   * @param {number} value — 0.0 to 1.0
   */
  setVolume(value) {
    this._gainNode.gain.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Set pitch/tempo adjustment via playbackRate.
   * @param {number} rate — 0.92 to 1.08 (±8%)
   */
  setPitch(rate) {
    this._playbackRate = Math.max(0.92, Math.min(1.08, rate));
    if (this._source) {
      this._source.playbackRate.value = this._playbackRate;
    }
  }

  /** @returns {number} Current playback position in seconds */
  get currentTime() {
    if (this._isPlaying) {
      return this._offset + (this._ctx.currentTime - this._startTime) * this._playbackRate;
    }
    return this._offset;
  }

  /** @returns {number} Track duration in seconds, or 0 if no track */
  get duration() {
    return this._buffer ? this._buffer.duration : 0;
  }

  /** @returns {boolean} */
  get isPlaying() {
    return this._isPlaying;
  }

  /** @returns {string} */
  get name() {
    return this._name;
  }

  /** @returns {GainNode} The output node — connect this to the crossfader */
  get output() {
    return this._gainNode;
  }
}
