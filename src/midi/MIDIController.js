/**
 * MIDIController — manages Web MIDI API access and device detection.
 * Auto-detects Hercules DJControl Inpulse 200 MK2 by name.
 */
export class MIDIController extends EventTarget {
  constructor() {
    super();
    this._access = null;
    this._inputPort = null;
    this._outputPort = null;
    this._isConnected = false;
    this._onStateChange = this._onStateChange.bind(this);
  }

  /**
   * Request MIDI access and start listening for devices.
   * @returns {Promise<void>}
   */
  async init() {
    if (!navigator.requestMIDIAccess) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { message: 'Web MIDI API not supported in this browser' },
      }));
      return;
    }

    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      this.dispatchEvent(new CustomEvent('permission-denied', {
        detail: { message: err.message },
      }));
      return;
    }

    this._access.addEventListener('statechange', this._onStateChange);
    this._scanForDevice();
  }

  /** Scan connected MIDI devices for the Hercules controller. */
  _scanForDevice() {
    if (!this._access) return;

    for (const input of this._access.inputs.values()) {
      if (this._isHerculesDevice(input.name)) {
        this._inputPort = input;
        break;
      }
    }

    for (const output of this._access.outputs.values()) {
      if (this._isHerculesDevice(output.name)) {
        this._outputPort = output;
        break;
      }
    }

    const wasConnected = this._isConnected;
    this._isConnected = !!(this._inputPort && this._outputPort);

    if (this._isConnected && !wasConnected) {
      this.dispatchEvent(new CustomEvent('connected', {
        detail: { name: this._inputPort.name },
      }));
    }
  }

  /**
   * Check if a device name matches the Hercules Inpulse controller.
   * @param {string} name
   * @returns {boolean}
   */
  _isHerculesDevice(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('inpulse') || lower.includes('hercules');
  }

  /** Handle MIDI port state changes (connect/disconnect). */
  _onStateChange(event) {
    const port = event.port;

    if (port.state === 'disconnected' && this._isConnected) {
      if (this._isHerculesDevice(port.name)) {
        this._inputPort = null;
        this._outputPort = null;
        this._isConnected = false;
        this.dispatchEvent(new CustomEvent('disconnected', {
          detail: { name: port.name },
        }));
      }
    } else if (port.state === 'connected') {
      this._scanForDevice();
    }
  }

  /**
   * Send raw MIDI data to the output port (for LED control).
   * @param {number[]} data — MIDI message bytes
   */
  sendMIDI(data) {
    if (this._outputPort) {
      this._outputPort.send(data);
    }
  }

  /** @returns {boolean} */
  get isConnected() {
    return this._isConnected;
  }

  /** @returns {MIDIInput | null} */
  get inputPort() {
    return this._inputPort;
  }

  /** @returns {MIDIOutput | null} */
  get outputPort() {
    return this._outputPort;
  }

  /** Clean up all listeners. */
  destroy() {
    if (this._access) {
      this._access.removeEventListener('statechange', this._onStateChange);
    }
    this._inputPort = null;
    this._outputPort = null;
    this._isConnected = false;
  }
}
