/**
 * KnobUI — renders tactile SVG rotary knobs over .knob-rotary-container elements.
 *
 * The hidden <input type="range"> is kept as the data store; KnobUI creates a
 * draggable SVG knob visual that reads/writes that input. MixerUI fires a
 * custom 'sync' event on the input whenever it updates the value programmatically
 * (e.g. from MIDI), which KnobUI listens for to refresh the visual.
 */

// Standard rotary knob geometry (compass degrees, clockwise from north)
const START_COMPASS = 210;  // 7 o'clock
const SWEEP_DEG = 300;       // 300° sweep (7→5 o'clock going via 12)

// Convert compass→SVG (SVG 0° = east/right, clockwise)
const compassToSvg = (d) => d - 90;
const START_SVG = compassToSvg(START_COMPASS); // 120°

const SIZE = 52;
const CX = SIZE / 2;
const CY = SIZE / 2;
const TRACK_R = 20;     // arc radius
const BODY_R = 16;      // knob body radius
const DOT_ORBIT_R = 10; // indicator dot orbit radius

export class KnobUI {
  constructor() {
    /** @type {Array<KnobInstance>} */
    this._knobs = [];
  }

  init() {
    document.querySelectorAll('.knob-rotary-container').forEach((container) => {
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
    const color = isB ? '#8a2ab9' : '#2a6900';
    const colorRing = isB ? 'rgba(238,194,255,0.55)' : 'rgba(132,251,66,0.55)';

    const svg = this._buildSVG(color, colorRing);
    const valuePath = svg.querySelector('.knob-value-arc');
    const dot = svg.querySelector('.knob-dot');

    /** @type {KnobInstance} */
    const knob = {
      input,
      svg,
      valuePath,
      dot,
      min: parseFloat(input.min) || 0,
      max: parseFloat(input.max) || 100,
      color,
    };

    this._knobs.push(knob);
    this._updateVisual(knob, parseFloat(input.value));
    this._bindDrag(knob);

    // Sync when MixerUI updates programmatically (MIDI / state replay)
    input.addEventListener('sync', () => {
      this._updateVisual(knob, parseFloat(input.value));
    });

    // Double-click resets to default value
    svg.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const def = parseFloat(input.defaultValue);
      input.value = String(def);
      input.dispatchEvent(new Event('input'));
      this._updateVisual(knob, def);
    });

    // Keyboard interaction: Arrow keys step the value
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', 'slider');
    svg.setAttribute('aria-label', input.getAttribute('aria-label') || 'knob');
    svg.setAttribute('aria-valuemin', input.min);
    svg.setAttribute('aria-valuemax', input.max);
    svg.setAttribute('aria-valuenow', input.value);
    svg.addEventListener('keydown', (e) => {
      const step = (knob.max - knob.min) / 50;
      let val = parseFloat(input.value);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        val = Math.min(knob.max, val + step);
        e.preventDefault();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        val = Math.max(knob.min, val - step);
        e.preventDefault();
      } else if (e.key === 'Home') {
        val = knob.min; e.preventDefault();
      } else if (e.key === 'End') {
        val = knob.max; e.preventDefault();
      } else { return; }
      input.value = String(val);
      input.dispatchEvent(new Event('input'));
      this._updateVisual(knob, val);
      svg.setAttribute('aria-valuenow', String(val));
    });

    // Hide native input, insert SVG
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.width = '0';
    input.style.height = '0';

    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.appendChild(svg);
  }

  /** Build the SVG element for a knob. */
  _buildSVG(color, colorRing) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute('width', String(SIZE));
    svg.setAttribute('height', String(SIZE));
    svg.style.cursor = 'ns-resize';
    svg.style.display = 'block';
    svg.style.userSelect = 'none';
    svg.style.touchAction = 'none';
    svg.style.flexShrink = '0';

    const mk = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    // Background arc track (full sweep, gray)
    const trackPath = mk('path', {
      class: 'knob-track-arc',
      fill: 'none',
      stroke: '#c8cacb',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      d: this._arcPath(CX, CY, TRACK_R, START_SVG, START_SVG + SWEEP_DEG),
    });

    // Value arc (colored, from min to current)
    const valuePath = mk('path', {
      class: 'knob-value-arc',
      fill: 'none',
      stroke: color,
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      d: this._arcPath(CX, CY, TRACK_R, START_SVG, START_SVG),
    });

    // Knob body
    const body = mk('circle', {
      cx: String(CX),
      cy: String(CY),
      r: String(BODY_R),
      fill: '#1e2020',
    });

    // Fine grooves for realism (3 subtle lines)
    const grooveR = BODY_R - 4;
    const grooveGroup = document.createElementNS(ns, 'g');
    grooveGroup.setAttribute('opacity', '0.2');
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const x1 = CX + (grooveR - 2) * Math.cos(angle);
      const y1 = CY + (grooveR - 2) * Math.sin(angle);
      const x2 = CX + grooveR * Math.cos(angle);
      const y2 = CY + grooveR * Math.sin(angle);
      const groove = mk('line', {
        x1: x1.toFixed(1), y1: y1.toFixed(1),
        x2: x2.toFixed(1), y2: y2.toFixed(1),
        stroke: 'white', 'stroke-width': '0.8',
      });
      grooveGroup.appendChild(groove);
    }

    // Colored ring border
    const ring = mk('circle', {
      cx: String(CX), cy: String(CY),
      r: String(BODY_R - 0.75),
      fill: 'none',
      stroke: colorRing,
      'stroke-width': '1.5',
    });

    // Indicator dot (white, orbits around body)
    const dot = mk('circle', {
      class: 'knob-dot',
      r: '2.5',
      fill: 'rgba(255,255,255,0.92)',
    });

    svg.append(trackPath, valuePath, body, grooveGroup, ring, dot);
    return svg;
  }

  /**
   * Update the SVG visual to reflect a raw input value.
   * @param {KnobInstance} knob
   * @param {number} value
   */
  _updateVisual(knob, value) {
    const { min, max, valuePath, dot } = knob;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    const currentSvg = START_SVG + t * SWEEP_DEG;

    // Update value arc
    if (t < 0.001) {
      valuePath.setAttribute('d', '');
    } else {
      valuePath.setAttribute('d', this._arcPath(CX, CY, TRACK_R, START_SVG, currentSvg));
    }

    // Move indicator dot along the orbit
    const dotAngle = currentSvg * (Math.PI / 180);
    dot.setAttribute('cx', (CX + DOT_ORBIT_R * Math.cos(dotAngle)).toFixed(2));
    dot.setAttribute('cy', (CY + DOT_ORBIT_R * Math.sin(dotAngle)).toFixed(2));
  }

  /**
   * Compute SVG arc path string.
   * @param {number} cx @param {number} cy @param {number} r
   * @param {number} startDeg @param {number} endDeg — SVG degrees (0=east, CW)
   * @returns {string}
   */
  _arcPath(cx, cy, r, startDeg, endDeg) {
    const toRad = (d) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    // Normalise delta to 0–360
    const delta = ((endDeg - startDeg) % 360 + 360) % 360;
    const largeArc = delta > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  /**
   * Bind mouse/touch drag to update knob value.
   * Drag upward = increase value; drag downward = decrease.
   * @param {KnobInstance} knob
   */
  _bindDrag(knob) {
    const { svg, input, min, max } = knob;
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
      // 150px of vertical drag = full range
      const delta = ((startY - y) / 150) * (max - min);
      const newVal = Math.max(min, Math.min(max, startVal + delta));
      input.value = String(newVal);
      input.dispatchEvent(new Event('input'));
      this._updateVisual(knob, newVal);
    };

    const onUp = () => { active = false; };

    svg.addEventListener('mousedown', onDown);
    svg.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }
}

/**
 * @typedef {{ input: HTMLInputElement, svg: SVGSVGElement, valuePath: SVGPathElement,
 *   dot: SVGCircleElement, min: number, max: number, color: string }} KnobInstance
 */
