/**
 * MIDI mapping for Hercules DJControl Inpulse 200 MK2.
 *
 * All CC assignments confirmed via hardware testing (2026-03-24).
 *
 * Channel layout:
 *   Ch0 — Shared controls (crossfader)
 *   Ch1 — Deck A main controls
 *   Ch2 — Deck B main controls
 *   Ch6 — Deck A performance pads
 *   Ch7 — Deck B performance pads
 *
 * CC assignments (confirmed):
 *   CC0  = Volume fader
 *   CC1  = Filter knob
 *   CC2  = Low EQ knob
 *   CC4  = High EQ knob
 *   CC5  = Gain knob (input trim)
 *   CC8  = Tempo/Pitch fader
 *   CC40 = Jog wheel rotation (relative encoding)
 */
export const herculesMapping = {
  controls: [
    // ── Deck A (Ch1) ────────────────────────────────────
    // Transport
    { name: 'deck-a:play',       type: 'note', channel: 1, number: 7,  action: 'toggle-play', deck: 'A' },
    { name: 'deck-a:cue',        type: 'note', channel: 1, number: 6,  action: 'cue',         deck: 'A' },
    { name: 'deck-a:sync',       type: 'note', channel: 1, number: 5,  action: 'sync',        deck: 'A' },

    // Faders & knobs (confirmed via hardware testing 2026-03-24)
    { name: 'deck-a:filter',     type: 'cc',   channel: 1, number: 1,  action: 'filter',      deck: 'A' },
    { name: 'deck-a:volume',     type: 'cc',   channel: 1, number: 0,  action: 'volume',      deck: 'A' },
    { name: 'deck-a:gain',       type: 'cc',   channel: 1, number: 5,  action: 'gain',        deck: 'A' },
    { name: 'deck-a:pitch',      type: 'cc',   channel: 1, number: 8,  action: 'pitch',       deck: 'A' },

    // EQ (confirmed: CC2 = Low, CC4 = High — opposite of original assumption)
    { name: 'deck-a:eq-low',     type: 'cc',   channel: 1, number: 2,  action: 'eq-low',      deck: 'A' },
    { name: 'deck-a:eq-high',    type: 'cc',   channel: 1, number: 4,  action: 'eq-high',     deck: 'A' },

    // Jog wheel
    { name: 'deck-a:jog-touch',  type: 'note', channel: 1, number: 8,  action: 'jog-touch',   deck: 'A' },
    { name: 'deck-a:jog-rotate', type: 'cc',   channel: 1, number: 40, action: 'jog-rotate',  deck: 'A' },

    // Performance pads (Ch6)
    { name: 'deck-a:pad-1',      type: 'note', channel: 6, number: 0,  action: 'pad', deck: 'A', pad: 1 },
    { name: 'deck-a:pad-2',      type: 'note', channel: 6, number: 1,  action: 'pad', deck: 'A', pad: 2 },
    { name: 'deck-a:pad-3',      type: 'note', channel: 6, number: 2,  action: 'pad', deck: 'A', pad: 3 },
    { name: 'deck-a:pad-4',      type: 'note', channel: 6, number: 3,  action: 'pad', deck: 'A', pad: 4 },

    // ── Deck B (Ch2) ────────────────────────────────────
    // Transport
    { name: 'deck-b:play',       type: 'note', channel: 2, number: 7,  action: 'toggle-play', deck: 'B' },
    { name: 'deck-b:cue',        type: 'note', channel: 2, number: 6,  action: 'cue',         deck: 'B' },
    { name: 'deck-b:sync',       type: 'note', channel: 2, number: 5,  action: 'sync',        deck: 'B' },

    // Faders & knobs (confirmed via hardware testing 2026-03-24)
    { name: 'deck-b:filter',     type: 'cc',   channel: 2, number: 1,  action: 'filter',      deck: 'B' },
    { name: 'deck-b:volume',     type: 'cc',   channel: 2, number: 0,  action: 'volume',      deck: 'B' },
    { name: 'deck-b:gain',       type: 'cc',   channel: 2, number: 5,  action: 'gain',        deck: 'B' },
    { name: 'deck-b:pitch',      type: 'cc',   channel: 2, number: 8,  action: 'pitch',       deck: 'B' },

    // EQ (confirmed: CC2 = Low, CC4 = High)
    { name: 'deck-b:eq-low',     type: 'cc',   channel: 2, number: 2,  action: 'eq-low',      deck: 'B' },
    { name: 'deck-b:eq-high',    type: 'cc',   channel: 2, number: 4,  action: 'eq-high',     deck: 'B' },

    // Jog wheel
    { name: 'deck-b:jog-touch',  type: 'note', channel: 2, number: 8,  action: 'jog-touch',   deck: 'B' },
    { name: 'deck-b:jog-rotate', type: 'cc',   channel: 2, number: 40, action: 'jog-rotate',  deck: 'B' },

    // Performance pads (Ch7)
    { name: 'deck-b:pad-1',      type: 'note', channel: 7, number: 16, action: 'pad', deck: 'B', pad: 1 },
    { name: 'deck-b:pad-2',      type: 'note', channel: 7, number: 17, action: 'pad', deck: 'B', pad: 2 },
    { name: 'deck-b:pad-3',      type: 'note', channel: 7, number: 18, action: 'pad', deck: 'B', pad: 3 },
    { name: 'deck-b:pad-4',      type: 'note', channel: 7, number: 19, action: 'pad', deck: 'B', pad: 4 },

    // ── Shared (Ch0) ───────────────────────────────────
    { name: 'crossfader',        type: 'cc',   channel: 0, number: 0,  action: 'crossfader',  deck: null },
  ],
};

/**
 * Build a lookup map from the controls array for fast MIDI message routing.
 * Key format: "{type}:{channel}:{number}"
 * @returns {Map<string, object>}
 */
export function buildMappingIndex(mapping) {
  const index = new Map();
  for (const control of mapping.controls) {
    const key = `${control.type}:${control.channel}:${control.number}`;
    index.set(key, control);
  }
  return index;
}
