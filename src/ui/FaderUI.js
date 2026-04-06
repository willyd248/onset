/**
 * FaderUI — renders custom DJ-style vertical fader controls over .fader-track elements.
 *
 * Each .fader-track wrapper's hidden <input type="range"> is kept as the data store.
 * FaderUI creates a visual track + fill + thumb and handles drag input.
 * MixerUI fires a 'sync' event on the input when it sets the value programmatically.
 */

export class FaderUI {
  constructor() {
    /** @type {Array<FaderInstance>} */
    this._faders = [];
  }

  init() {
    document.querySelectorAll('.fader-track').forEach((container) => {
      const input = /** @type {HTMLInputElement} */ (container.querySelector('input[type="range"]'));
      if (!input) return;
      this._mount(container, input);
    });
  }

  /**
   * @param {HTMLElement} container
   * @param {HTMLInputElement} input
   */
  _mount(container, input) {
    const isB = input.classList.contains('accent-secondary');
    const isPitch = input.id?.startsWith('pitch-');
    const accent = isB ? '#8a2ab9' : '#2a6900';
    const accentLight = isB ? 'rgba(238,194,255,0.35)' : 'rgba(132,251,66,0.35)';

    // Fader dimensions
    const trackH = isPitch ? 140 : 160;
    const trackW = isPitch ? 6 : 8;
    const thumbH = isPitch ? 20 : 24;
    const thumbW = isPitch ? 14 : 36;

    // Wrapper
    const wrap = document.createElement('div');
    wrap.className = 'fader-visual';
    wrap.style.cssText = [
      'position: relative',
      `width: ${Math.max(thumbW, 40)}px`,
      `height: ${trackH}px`,
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'cursor: ns-resize',
      'touch-action: none',
      'user-select: none',
    ].join(';');

    // Track background
    const track = document.createElement('div');
    track.className = 'fader-visual__track';
    track.style.cssText = [
      'position: absolute',
      `width: ${trackW}px`,
      `height: ${trackH}px`,
      `left: ${(Math.max(thumbW, 40) - trackW) / 2}px`,
      'top: 0',
      'border-radius: 9999px',
      'background: #d0d2d2',
      'overflow: hidden',
    ].join(';');

    // Fill
    const fill = document.createElement('div');
    fill.className = 'fader-visual__fill';
    fill.style.cssText = [
      'position: absolute',
      'bottom: 0',
      `width: ${trackW}px`,
      'height: 0',
      'border-radius: 9999px',
      `background: ${accent}`,
      'transition: none',
    ].join(';');

    // Center tick for pitch faders
    if (isPitch) {
      const tick = document.createElement('div');
      tick.style.cssText = [
        'position: absolute',
        'top: 50%',
        'transform: translateY(-50%)',
        'width: 100%',
        'height: 2px',
        'background: rgba(255,255,255,0.5)',
      ].join(';');
      track.appendChild(tick);
    }

    track.appendChild(fill);

    // Thumb
    const thumb = document.createElement('div');
    thumb.className = 'fader-visual__thumb';
    thumb.style.cssText = [
      'position: absolute',
      `width: ${thumbW}px`,
      `height: ${thumbH}px`,
      `left: ${(Math.max(thumbW, 40) - thumbW) / 2}px`,
      'border-radius: 4px',
      'background: linear-gradient(180deg, #f5f5f5 0%, #d8dada 100%)',
      'box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
      'border: 1px solid #b0b2b2',
    ].join(';');

    // Thumb center grip lines
    const grip = document.createElement('div');
    grip.style.cssText = [
      'position: absolute',
      'top: 50%', 'left: 50%',
      'transform: translate(-50%, -50%)',
      'display: flex', 'flex-direction: column', 'gap: 3px',
    ].join(';');
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.style.cssText = `width: ${thumbW - 8}px; height: 1px; background: rgba(0,0,0,0.2); border-radius: 1px;`;
      grip.appendChild(line);
    }
    thumb.appendChild(grip);

    // Colored border accent on thumb
    const thumbAccent = document.createElement('div');
    thumbAccent.style.cssText = [
      'position: absolute',
      'left: 0', 'right: 0',
      'top: 0',
      'height: 3px',
      'border-radius: 4px 4px 0 0',
      `background: ${accentLight}`,
    ].join(';');
    thumb.appendChild(thumbAccent);

    wrap.appendChild(track);
    wrap.appendChild(thumb);

    /** @type {FaderInstance} */
    const fader = {
      input, wrap, fill, thumb,
      trackH, thumbH,
      min: parseFloat(input.min) || 0,
      max: parseFloat(input.max) || 100,
      isPitch,
    };
    this._faders.push(fader);

    // Initial position
    this._updateVisual(fader, parseFloat(input.value));

    // Drag
    this._bindDrag(fader);

    // Sync from MIDI
    input.addEventListener('sync', () => {
      this._updateVisual(fader, parseFloat(input.value));
    });

    // Hide native input
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.width = '0';
    input.style.height = '0';

    container.style.position = 'relative';
    container.innerHTML = '';
    container.appendChild(input); // keep input in DOM
    container.appendChild(wrap);
  }

  /**
   * @param {FaderInstance} fader
   * @param {number} value
   */
  _updateVisual(fader, value) {
    const { fill, thumb, trackH, thumbH, min, max } = fader;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    // Fill from bottom: fill height = t * trackH
    const fillH = t * trackH;
    fill.style.height = `${fillH}px`;

    // Thumb position: 0% = bottom (thumbH/2 from bottom), 100% = top
    const thumbTop = (1 - t) * (trackH - thumbH);
    thumb.style.top = `${thumbTop}px`;
  }

  /**
   * @param {FaderInstance} fader
   */
  _bindDrag(fader) {
    const { wrap, input, min, max, trackH, thumbH } = fader;
    let active = false;
    let startY = 0;
    let startVal = 0;

    const onDown = (e) => {
      active = true;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startVal = parseFloat(input.value);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!active) return;
      const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      const usableH = trackH - thumbH;
      const delta = ((startY - y) / usableH) * (max - min);
      const newVal = Math.max(min, Math.min(max, startVal + delta));
      input.value = String(newVal);
      input.dispatchEvent(new Event('input'));
      this._updateVisual(fader, newVal);
    };

    const onUp = () => { active = false; };

    wrap.addEventListener('mousedown', onDown);
    wrap.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }
}

/**
 * @typedef {{ input: HTMLInputElement, wrap: HTMLElement, fill: HTMLElement,
 *   thumb: HTMLElement, trackH: number, thumbH: number,
 *   min: number, max: number, isPitch: boolean }} FaderInstance
 */
