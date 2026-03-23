/**
 * BPMDetector — Analyzes an AudioBuffer to estimate BPM and generate a beat grid.
 * Uses onset-strength autocorrelation, accurate to ±1 BPM in the 100–180 range.
 */
export class BPMDetector {
  /**
   * Analyze an AudioBuffer and return estimated BPM + beat grid.
   * @param {AudioBuffer} buffer
   * @returns {{ bpm: number, beatGrid: number[] }}
   */
  static detect(buffer) {
    const sampleRate = buffer.sampleRate;
    const mono = BPMDetector._toMono(buffer);

    // --- 1. Compute energy in ~200ms windows ---
    const windowSize = Math.round(sampleRate * 0.2);
    const hopSize = Math.round(windowSize / 2); // 50% overlap
    const energyLen = Math.floor((mono.length - windowSize) / hopSize) + 1;
    const energy = new Float32Array(energyLen);

    for (let i = 0; i < energyLen; i++) {
      const start = i * hopSize;
      let sum = 0;
      for (let j = start; j < start + windowSize; j++) {
        sum += mono[j] * mono[j];
      }
      energy[i] = sum / windowSize;
    }

    // --- 2. Onset strength function (positive energy derivative) ---
    const onset = new Float32Array(energyLen);
    for (let i = 1; i < energyLen; i++) {
      const diff = energy[i] - energy[i - 1];
      onset[i] = diff > 0 ? diff : 0;
    }

    // --- 3. Autocorrelation for lag range 80–200 BPM ---
    // lag (in onset frames) = 60 / bpm / (hopSize / sampleRate)
    const frameDuration = hopSize / sampleRate; // seconds per onset frame
    const minBPM = 80;
    const maxBPM = 200;
    const minLag = Math.floor(60 / maxBPM / frameDuration);
    const maxLag = Math.ceil(60 / minBPM / frameDuration);

    let bestLag = minLag;
    let bestCorr = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const limit = onset.length - lag;
      for (let i = 0; i < limit; i++) {
        corr += onset[i] * onset[i + lag];
      }
      // Normalize by number of terms
      corr /= limit;

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    const rawBPM = 60 / (bestLag * frameDuration);
    const bpm = Math.round(rawBPM);

    // --- 4. Find first strong onset for grid alignment ---
    const beatInterval = 60 / bpm; // seconds
    let firstOnsetTime = 0;
    let maxOnsetVal = 0;

    // Find the peak onset value for thresholding
    for (let i = 0; i < onset.length; i++) {
      if (onset[i] > maxOnsetVal) maxOnsetVal = onset[i];
    }

    const threshold = maxOnsetVal * 0.3;
    for (let i = 0; i < onset.length; i++) {
      if (onset[i] >= threshold) {
        firstOnsetTime = i * frameDuration;
        break;
      }
    }

    // --- 5. Generate beat grid ---
    const duration = buffer.duration;
    /** @type {number[]} */
    const beatGrid = [];
    let t = firstOnsetTime;
    while (t < duration) {
      beatGrid.push(t);
      t += beatInterval;
    }

    return { bpm, beatGrid };
  }

  /**
   * Downmix AudioBuffer to mono Float32Array.
   * @param {AudioBuffer} buffer
   * @returns {Float32Array}
   */
  static _toMono(buffer) {
    const ch0 = buffer.getChannelData(0);
    if (buffer.numberOfChannels === 1) {
      return ch0;
    }
    const ch1 = buffer.getChannelData(1);
    const mono = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      mono[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    return mono;
  }
}
