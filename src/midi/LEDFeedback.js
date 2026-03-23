import { herculesMapping } from './hercules-mapping.js';

/**
 * LEDFeedback — controls LED output on the Hercules controller.
 * Sends MIDI note-on/off messages to the output port for visual feedback.
 */
export class LEDFeedback {
  /**
   * @param {import('./MIDIController.js').MIDIController} controller
   */
  constructor(controller) {
    this._controller = controller;

    // Build lookup for play buttons and pads by name
    this._ledMap = new Map();
    for (const control of herculesMapping.controls) {
      if (control.type === 'note') {
        this._ledMap.set(control.name, control);
      }
    }
  }

  /**
   * Set the play button LED state for a deck.
   * @param {'A' | 'B'} deck
   * @param {boolean} isPlaying
   */
  setPlayState(deck, isPlaying) {
    const name = `deck-${deck.toLowerCase()}:play`;
    const control = this._ledMap.get(name);
    if (!control) return;

    if (isPlaying) {
      this._sendNoteOn(control.channel, control.number, 127);
    } else {
      this._sendNoteOff(control.channel, control.number);
    }
  }

  /**
   * Set a performance pad LED color/brightness.
   * @param {'A' | 'B'} deck
   * @param {number} padNumber — 1-4
   * @param {number} velocity — 0 (off) to 127 (full brightness/color)
   */
  setPadColor(deck, padNumber, velocity) {
    const name = `deck-${deck.toLowerCase()}:pad-${padNumber}`;
    const control = this._ledMap.get(name);
    if (!control) return;

    if (velocity > 0) {
      this._sendNoteOn(control.channel, control.number, velocity);
    } else {
      this._sendNoteOff(control.channel, control.number);
    }
  }

  /** Turn off all LEDs. */
  allOff() {
    for (const control of this._ledMap.values()) {
      this._sendNoteOff(control.channel, control.number);
    }
  }

  /**
   * Send a Note On message.
   * @param {number} channel — 0-15
   * @param {number} note — 0-127
   * @param {number} velocity — 0-127
   */
  _sendNoteOn(channel, note, velocity) {
    this._controller.sendMIDI([0x90 | channel, note, velocity]);
  }

  /**
   * Send a Note Off message.
   * @param {number} channel — 0-15
   * @param {number} note — 0-127
   */
  _sendNoteOff(channel, note) {
    this._controller.sendMIDI([0x80 | channel, note, 0]);
  }
}
