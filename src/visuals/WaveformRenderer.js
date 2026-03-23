/**
 * WaveformRenderer — Draws real-time waveforms on HTML5 Canvas elements.
 * Two views per deck: overview (full track, top half) and zoomed (~10s around playhead, bottom half).
 * Uses frequency-based coloring from WaveformData and supports HiDPI displays.
 */
export class WaveformRenderer {
  /** @type {HTMLCanvasElement} */
  _canvas;

  /** @type {CanvasRenderingContext2D} */
  _ctx;

  /** @type {'A' | 'B'} */
  _deck;

  /** @type {string} Accent color for this deck */
  _accent;

  /** @type {import('./WaveformData.js').WaveformData | null} */
  _data = null;

  /** @type {OffscreenCanvas | HTMLCanvasElement | null} */
  _overviewCache = null;

  /** @type {CanvasRenderingContext2D | null} */
  _overviewCacheCtx = null;

  /** @type {number | null} */
  _rafId = null;

  /** @type {function | null} Callback returning current playback time in seconds */
  _getPlaybackPosition = null;

  /** @type {number} Phase offset in seconds for alignment indicator */
  _phaseOffset = 0;

  /** @type {number} Device pixel ratio */
  _dpr = 1;

  /** @type {number} Logical canvas width */
  _width = 0;

  /** @type {number} Logical canvas height */
  _height = 0;

  /** @type {number} Zoomed view window in seconds */
  static ZOOM_WINDOW = 10;

  /** @type {string} Background color */
  static BG_COLOR = '#f0f1f1';

  /** @type {string} Beat grid color */
  static BEAT_GRID_COLOR = 'rgba(0, 0, 0, 0.06)';

  /** @type {string} Beat grid color for zoomed view */
  static BEAT_GRID_ZOOM_COLOR = 'rgba(0, 0, 0, 0.08)';

  /**
   * @param {HTMLCanvasElement} canvas — the canvas element for this deck
   * @param {'A' | 'B'} deck — deck identifier for color theming
   */
  constructor(canvas, deck) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._deck = deck;
    this._accent = deck === 'A' ? '#2a6900' : '#8a2ab9';

    this._dpr = window.devicePixelRatio || 1;
    this._resize();

    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  /**
   * Set the waveform data to render.
   * @param {import('./WaveformData.js').WaveformData} data
   */
  setData(data) {
    this._data = data;
    this._buildOverviewCache();
  }

  /**
   * Start the render loop (requestAnimationFrame).
   * @param {function} getPlaybackPosition — callback returning current time in seconds
   */
  start(getPlaybackPosition) {
    this._getPlaybackPosition = getPlaybackPosition;
    if (this._rafId !== null) return;
    this._loop();
  }

  /** Stop the render loop */
  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._getPlaybackPosition = null;
  }

  /**
   * Set phase offset for alignment indicator.
   * @param {number} offset — offset in seconds between this deck's beats and the other deck's beats
   */
  setPhaseOffset(offset) {
    this._phaseOffset = offset;
  }

  /**
   * Clean up event listeners and stop rendering.
   */
  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  /** @private */
  _resize() {
    this._dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._width = rect.width;
    this._height = rect.height;

    this._canvas.width = Math.round(rect.width * this._dpr);
    this._canvas.height = Math.round(rect.height * this._dpr);

    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    // Rebuild overview cache at new size
    if (this._data) {
      this._buildOverviewCache();
    }
  }

  // ---------------------------------------------------------------------------
  // Overview cache (pre-rendered offscreen canvas)
  // ---------------------------------------------------------------------------

  /** @private */
  _buildOverviewCache() {
    if (!this._data) return;

    const w = this._width;
    const h = Math.floor(this._height / 2);
    if (w <= 0 || h <= 0) return;

    const physW = Math.round(w * this._dpr);
    const physH = Math.round(h * this._dpr);

    // Use OffscreenCanvas if available, otherwise a detached canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      this._overviewCache = new OffscreenCanvas(physW, physH);
    } else {
      this._overviewCache = document.createElement('canvas');
      this._overviewCache.width = physW;
      this._overviewCache.height = physH;
    }

    const ctx = this._overviewCache.getContext('2d');
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._overviewCacheCtx = ctx;

    const peaks = this._data.overviewPeaks;
    const colors = this._data.overviewColors;
    if (!peaks || peaks.length === 0) return;

    // Clear
    ctx.fillStyle = WaveformRenderer.BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Draw subtle grid pattern
    this._drawGridPattern(ctx, w, h);

    // Draw beat grid on overview
    this._drawBeatGridOverview(ctx, w, h);

    // Draw bars — mirrored above and below center
    const centerY = h / 2;
    const barWidth = w / peaks.length;
    const maxBarH = centerY - 2; // leave a small margin

    ctx.shadowColor = this._accent;
    ctx.shadowBlur = 2;

    for (let i = 0; i < peaks.length; i++) {
      const amplitude = peaks[i];
      if (amplitude < 0.005) continue;

      const barH = amplitude * maxBarH;
      const x = i * barWidth;

      const color = colors && colors[i]
        ? this._rgbToString(colors[i])
        : 'rgba(90, 92, 92, 0.6)';

      ctx.fillStyle = color;
      // Top half (above center)
      ctx.fillRect(x, centerY - barH, Math.max(barWidth - 0.5, 0.5), barH);
      // Bottom half (below center, mirrored)
      ctx.fillRect(x, centerY, Math.max(barWidth - 0.5, 0.5), barH);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  /** @private */
  _loop() {
    this._render();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  /** @private */
  _render() {
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;

    if (w <= 0 || h <= 0) return;

    // Clear full canvas
    ctx.fillStyle = WaveformRenderer.BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    if (!this._data) return;

    const position = this._getPlaybackPosition ? this._getPlaybackPosition() : 0;
    const duration = this._data.duration;

    // --- Overview (top half) ---
    const overviewH = Math.floor(h / 2);
    this._renderOverview(ctx, w, overviewH, position, duration);

    // --- Divider line ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, overviewH, w, 1);

    // --- Zoomed (bottom half) ---
    const zoomY = overviewH + 1;
    const zoomH = h - zoomY;
    ctx.save();
    ctx.translate(0, zoomY);
    this._renderZoomed(ctx, w, zoomH, position, duration);
    ctx.restore();

    // --- Phase offset indicator ---
    if (Math.abs(this._phaseOffset) > 0.001) {
      this._renderPhaseIndicator(ctx, w, h);
    }
  }

  // ---------------------------------------------------------------------------
  // Overview rendering
  // ---------------------------------------------------------------------------

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} position
   * @param {number} duration
   */
  _renderOverview(ctx, w, h, position, duration) {
    // Blit the cached overview
    if (this._overviewCache) {
      ctx.drawImage(this._overviewCache, 0, 0, w, h);
    }

    if (duration <= 0) return;

    // Draw playhead
    const playheadX = (position / duration) * w;
    this._drawPlayhead(ctx, playheadX, 0, h);

    // Darken played portion
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, playheadX, h);
  }

  // ---------------------------------------------------------------------------
  // Zoomed rendering
  // ---------------------------------------------------------------------------

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} position
   * @param {number} duration
   */
  _renderZoomed(ctx, w, h, position, duration) {
    // Background with grid
    ctx.fillStyle = WaveformRenderer.BG_COLOR;
    ctx.fillRect(0, 0, w, h);
    this._drawGridPattern(ctx, w, h);

    if (!this._data || duration <= 0) return;

    const peaks = this._data.zoomedPeaks;
    const colors = this._data.zoomedColors;
    if (!peaks || peaks.length === 0) return;

    const halfWindow = WaveformRenderer.ZOOM_WINDOW / 2;
    const windowStart = position - halfWindow;
    const windowEnd = position + halfWindow;

    // Map time to peak index: peaks are sampled at 10 samples/peak
    // Total peaks = buffer.length / 10, duration = buffer.length / sampleRate
    // So peaksPerSecond = sampleRate / 10
    const peaksPerSecond = peaks.length / duration;
    const startIdx = Math.floor(windowStart * peaksPerSecond);
    const endIdx = Math.ceil(windowEnd * peaksPerSecond);

    const visibleCount = endIdx - startIdx;
    if (visibleCount <= 0) return;

    const barWidth = w / visibleCount;
    const centerY = h / 2;
    const maxBarH = centerY - 2;

    ctx.shadowColor = this._accent;
    ctx.shadowBlur = 2;

    for (let i = startIdx; i < endIdx; i++) {
      // Skip out-of-bounds peaks
      if (i < 0 || i >= peaks.length) continue;

      const amplitude = peaks[i];
      if (amplitude < 0.005) continue;

      const barH = amplitude * maxBarH;
      const x = (i - startIdx) * barWidth;

      const color = colors && colors[i]
        ? this._rgbToString(colors[i])
        : 'rgba(90, 92, 92, 0.6)';

      ctx.fillStyle = color;
      ctx.fillRect(x, centerY - barH, Math.max(barWidth - 0.5, 0.5), barH);
      ctx.fillRect(x, centerY, Math.max(barWidth - 0.5, 0.5), barH);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Beat grid on zoomed view
    this._drawBeatGridZoomed(ctx, w, h, windowStart, windowEnd);

    // Center playhead (fixed position)
    this._drawPlayhead(ctx, w / 2, 0, h);

    // Center line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  // Beat grid
  // ---------------------------------------------------------------------------

  /**
   * Draw beat grid lines on the overview cache.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  _drawBeatGridOverview(ctx, w, h) {
    if (!this._data || !this._data.beatGrid) return;

    const duration = this._data.duration;
    if (duration <= 0) return;

    ctx.strokeStyle = WaveformRenderer.BEAT_GRID_COLOR;
    ctx.lineWidth = 1;

    const beatGrid = this._data.beatGrid;
    for (let i = 0; i < beatGrid.length; i++) {
      const x = (beatGrid[i] / duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  /**
   * Draw beat grid lines on the zoomed view.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} windowStart
   * @param {number} windowEnd
   */
  _drawBeatGridZoomed(ctx, w, h, windowStart, windowEnd) {
    if (!this._data || !this._data.beatGrid) return;

    const windowDuration = windowEnd - windowStart;
    if (windowDuration <= 0) return;

    ctx.strokeStyle = WaveformRenderer.BEAT_GRID_ZOOM_COLOR;
    ctx.lineWidth = 1;

    const beatGrid = this._data.beatGrid;
    for (let i = 0; i < beatGrid.length; i++) {
      const t = beatGrid[i];
      if (t < windowStart || t > windowEnd) continue;

      const x = ((t - windowStart) / windowDuration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Playhead
  // ---------------------------------------------------------------------------

  /**
   * Draw a playhead line with glow.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} h
   */
  _drawPlayhead(ctx, x, y, h) {
    // Glow
    ctx.save();
    ctx.shadowColor = this._accent;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#2d2f2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
    ctx.restore();

    // Crisp line on top
    ctx.strokeStyle = '#2d2f2f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  // Phase alignment indicator
  // ---------------------------------------------------------------------------

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  _renderPhaseIndicator(ctx, w, h) {
    const indicatorW = 60;
    const indicatorH = 8;
    const x = w / 2 - indicatorW / 2;
    const y = h - 16;

    // Background bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(x, y, indicatorW, indicatorH);

    // Offset marker — clamp to [-1, 1] range for display
    const normalizedOffset = Math.max(-1, Math.min(1, this._phaseOffset));
    const markerX = x + (indicatorW / 2) + (normalizedOffset * indicatorW / 2);

    ctx.fillStyle = this._accent;
    ctx.fillRect(markerX - 2, y - 1, 4, indicatorH + 2);

    // Center tick
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(x + indicatorW / 2 - 0.5, y - 1, 1, indicatorH + 2);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Draw a subtle grid pattern on a region.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  _drawGridPattern(ctx, w, h) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;

    // Horizontal lines every 16px
    for (let y = 16; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical lines every 32px
    for (let x = 32; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  /**
   * Convert a [r, g, b] float array (0-1 range) to a CSS rgb string.
   * @private
   * @param {[number, number, number]} rgb
   * @returns {string}
   */
  _rgbToString(rgb) {
    const r = Math.round(rgb[0] * 255);
    const g = Math.round(rgb[1] * 255);
    const b = Math.round(rgb[2] * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
