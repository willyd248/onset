import { BPMDetector } from './BPMDetector.js';

/**
 * WaveformData — Extracts multi-resolution peak amplitude data and frequency
 * color information from decoded AudioBuffers.
 */
export class WaveformData {
  /** @type {AudioBuffer} */
  _buffer;

  /** @type {Float32Array | null} */
  _overviewPeaks = null;

  /** @type {Float32Array | null} */
  _zoomedPeaks = null;

  /** @type {Array<[number, number, number]> | null} */
  _overviewColors = null;

  /** @type {Array<[number, number, number]> | null} */
  _zoomedColors = null;

  /** @type {number[] | null} */
  _beatGrid = null;

  /** @type {number} */
  _bpm = 0;

  /**
   * @param {AudioBuffer} buffer
   */
  constructor(buffer) {
    this._buffer = buffer;
  }

  /**
   * Generate multi-resolution peak data, frequency colors, and beat grid.
   * Call once after construction; results are cached.
   */
  generate() {
    const mono = this._getMono();

    // Peak extraction at two resolutions
    this._overviewPeaks = WaveformData._extractPeaks(mono, 100);
    this._zoomedPeaks = WaveformData._extractPeaks(mono, 10);

    // Frequency color analysis at both resolutions
    this._overviewColors = WaveformData._extractColors(mono, 100, this._buffer.sampleRate);
    this._zoomedColors = WaveformData._extractColors(mono, 10, this._buffer.sampleRate);

    // BPM detection
    const { bpm, beatGrid } = BPMDetector.detect(this._buffer);
    this._bpm = bpm;
    this._beatGrid = beatGrid;
  }

  /** @returns {Float32Array} */
  get overviewPeaks() {
    return this._overviewPeaks;
  }

  /** @returns {Float32Array} */
  get zoomedPeaks() {
    return this._zoomedPeaks;
  }

  /** @returns {Array<[number, number, number]>} */
  get overviewColors() {
    return this._overviewColors;
  }

  /** @returns {Array<[number, number, number]>} */
  get zoomedColors() {
    return this._zoomedColors;
  }

  /** @returns {number[]} Beat time positions in seconds */
  get beatGrid() {
    return this._beatGrid;
  }

  /** @returns {number} Detected BPM */
  get bpm() {
    return this._bpm;
  }

  /** @returns {number} Track duration in seconds */
  get duration() {
    return this._buffer.duration;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Downmix to mono Float32Array (averages channels for stereo).
   * @returns {Float32Array}
   */
  _getMono() {
    const ch0 = this._buffer.getChannelData(0);
    if (this._buffer.numberOfChannels === 1) {
      return ch0;
    }
    const ch1 = this._buffer.getChannelData(1);
    const mono = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      mono[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    return mono;
  }

  /**
   * Extract peak amplitudes at the given samples-per-peak resolution.
   * @param {Float32Array} mono
   * @param {number} samplesPerPeak
   * @returns {Float32Array}
   */
  static _extractPeaks(mono, samplesPerPeak) {
    const peakCount = Math.ceil(mono.length / samplesPerPeak);
    const peaks = new Float32Array(peakCount);

    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, mono.length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = mono[j] < 0 ? -mono[j] : mono[j];
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }

    return peaks;
  }

  /**
   * Extract frequency-based colors for each peak-window segment.
   *
   * For each segment we compute energy in three bands using DFT bins:
   *   bass  (20–250 Hz)  → warm red  [0.8, 0.2, 0.1]
   *   mid   (250–4000 Hz) → green    [0.2, 0.8, 0.3]
   *   high  (4000–20000 Hz) → cyan   [0.1, 0.7, 0.9]
   *
   * We use 2048-sample FFT segments aligned to each peak window.
   *
   * @param {Float32Array} mono
   * @param {number} samplesPerPeak
   * @param {number} sampleRate
   * @returns {Array<[number, number, number]>}
   */
  static _extractColors(mono, samplesPerPeak, sampleRate) {
    const peakCount = Math.ceil(mono.length / samplesPerPeak);
    const fftSize = 2048;
    const colors = new Array(peakCount);

    // Pre-compute bin boundaries
    const binHz = sampleRate / fftSize;
    const bassBinStart = Math.floor(20 / binHz);
    const bassBinEnd = Math.floor(250 / binHz);
    const midBinStart = bassBinEnd;
    const midBinEnd = Math.floor(4000 / binHz);
    const highBinStart = midBinEnd;
    const highBinEnd = Math.min(Math.floor(20000 / binHz), fftSize / 2);

    // Hann window (reused across all segments)
    const hann = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Color constants
    const BASS = [0.8, 0.2, 0.1];
    const MID = [0.2, 0.8, 0.3];
    const HIGH = [0.1, 0.7, 0.9];

    for (let i = 0; i < peakCount; i++) {
      const center = i * samplesPerPeak + Math.floor(samplesPerPeak / 2);
      const segStart = Math.max(0, center - Math.floor(fftSize / 2));
      const segEnd = Math.min(mono.length, segStart + fftSize);
      const segLen = segEnd - segStart;

      // Compute energy in each band using the DFT at specific frequency bins.
      // Instead of a full FFT, compute the Goertzel-like magnitude for band ranges.
      let bassEnergy = 0;
      let midEnergy = 0;
      let highEnergy = 0;

      // For efficiency we compute DFT only at the bin boundaries using band energy.
      // Simpler approach: compute energy by filtering in time domain approximation.
      // We use a simplified spectral energy estimation via DFT at sampled bins.

      // Extract windowed segment
      const seg = new Float32Array(fftSize);
      for (let j = 0; j < segLen; j++) {
        seg[j] = mono[segStart + j] * hann[j];
      }

      // Compute DFT magnitudes at bins we care about (sparse DFT)
      // Sample every 4th bin for speed, then aggregate into bands
      const step = Math.max(1, Math.floor((highBinEnd - bassBinStart) / 64));

      for (let k = bassBinStart; k <= highBinEnd; k += step) {
        // DFT at bin k: X[k] = sum( x[n] * e^(-j*2*pi*k*n/N) )
        let re = 0;
        let im = 0;
        const w = (2 * Math.PI * k) / fftSize;
        for (let n = 0; n < segLen; n++) {
          re += seg[n] * Math.cos(w * n);
          im -= seg[n] * Math.sin(w * n);
        }
        const mag = re * re + im * im; // magnitude squared

        if (k < bassBinEnd) {
          bassEnergy += mag;
        } else if (k < midBinEnd) {
          midEnergy += mag;
        } else {
          highEnergy += mag;
        }
      }

      // Normalize to ratios
      const total = bassEnergy + midEnergy + highEnergy;
      if (total === 0) {
        colors[i] = [0.4, 0.4, 0.4];
        continue;
      }

      const bRatio = bassEnergy / total;
      const mRatio = midEnergy / total;
      const hRatio = highEnergy / total;

      // Blend colors
      colors[i] = [
        BASS[0] * bRatio + MID[0] * mRatio + HIGH[0] * hRatio,
        BASS[1] * bRatio + MID[1] * mRatio + HIGH[1] * hRatio,
        BASS[2] * bRatio + MID[2] * mRatio + HIGH[2] * hRatio,
      ];
    }

    return colors;
  }
}
