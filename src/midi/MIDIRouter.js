import { buildMappingIndex } from './hercules-mapping.js';

/**
 * MIDIRouter — dispatches raw MIDI messages as named application events.
 * Parses MIDI status bytes, looks up the control in the mapping, and emits
 * typed events like 'deck-a:eq-low' with normalized values.
 */
export class MIDIRouter extends EventTarget {
  /**
   * @param {import('./MIDIController.js').MIDIController} controller
   * @param {object} mapping — hercules mapping config
   */
  constructor(controller, mapping) {
    super();
    this._controller = controller;
    this._mappingIndex = buildMappingIndex(mapping);
    this._onMIDIMessage = this._onMIDIMessage.bind(this);
    this._debug = false;

    this._attachListener();

    // Re-attach when controller connects
    controller.addEventListener('connected', () => this._attachListener());
    controller.addEventListener('disconnected', () => this._detachListener());
  }

  /** Attach the MIDI message listener to the input port. */
  _attachListener() {
    const input = this._controller.inputPort;
    if (input) {
      input.onmidimessage = this._onMIDIMessage;
    }
  }

  /** Detach the MIDI message listener. */
  _detachListener() {
    const input = this._controller.inputPort;
    if (input) {
      input.onmidimessage = null;
    }
  }

  /**
   * Handle a raw MIDI message.
   * @param {MIDIMessageEvent} event
   */
  _onMIDIMessage(event) {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    let type;
    let velocity = data2;

    if (messageType === 0xB0) {
      // CC message
      type = 'cc';
    } else if (messageType === 0x90) {
      // Note On (velocity 0 = Note Off)
      type = 'note';
      if (data2 === 0) {
        velocity = 0; // treat as note-off
      }
    } else if (messageType === 0x80) {
      // Note Off
      type = 'note';
      velocity = 0;
    } else {
      return; // ignore other message types
    }

    const key = `${type}:${channel}:${data1}`;
    const control = this._mappingIndex.get(key);

    // Debug logging — fires for ALL messages, including unmapped
    if (this._debug) {
      const mapped = control ? control.name : 'unmapped';
      console.log(`[MIDI] ${type} ch:${channel} ${type === 'cc' ? 'cc' : 'note'}:${data1} value:${data2} → ${mapped}`);
    }

    if (!control) return;

    let value;
    if (type === 'cc') {
      if (control.action === 'jog-rotate') {
        // Relative encoding: 64 = stopped, >64 = forward, <64 = backward
        value = data2 - 64;
      } else {
        // Normalize 0-127 → 0.0-1.0
        value = data2 / 127;
      }
    } else {
      // Note: velocity as 0-127, boolean for pressed
      value = velocity > 0 ? 1 : 0;
    }

    this.dispatchEvent(new CustomEvent(control.name, {
      detail: {
        value,
        velocity,
        deck: control.deck,
        action: control.action,
        pad: control.pad || null,
        raw: { status, data1, data2 },
      },
    }));
  }

  /**
   * Enable or disable MIDI debug logging.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debug = enabled;
    if (enabled) console.log('[MIDI] Debug mode ON — all messages will be logged');
  }

  /** @returns {boolean} */
  get debug() {
    return this._debug;
  }

  /** Clean up. */
  destroy() {
    this._detachListener();
  }
}
