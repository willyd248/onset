---
name: onset-v1
status: backlog
created: 2026-03-23T16:15:33Z
updated: 2026-03-23T16:25:48Z
progress: 0%
prd: .claude/prds/onset-v1.md
github: https://github.com/willyd248/onset/issues/1
---

# Epic: onset-v1

## Overview

Build Onset v1.0 — a browser-based DJ learning app that connects to a Hercules DJControl Inpulse 200 MK2 via Web MIDI API. The app provides dual-deck audio playback with real-time waveform visualization (Canvas), a guided lesson engine teaching beatmatching/EQ/transitions, and a free play mode. Entirely client-side: Vite + vanilla JS + Web Audio API + Web MIDI API + Canvas.

## Architecture Decisions

1. **Vanilla JS + Vite** — No framework. Audio/MIDI apps need tight control over the render loop and audio graph. A framework adds overhead and abstraction that hurts latency. Vite gives us HMR and bundling without runtime cost.

2. **Web Audio API audio graph** — Each deck gets its own audio pipeline: `AudioBufferSourceNode → GainNode → BiquadFilterNode (x3 for EQ) → GainNode (volume) → destination`. Crossfader is a gain crossfade between the two deck outputs before the master limiter (`DynamicsCompressorNode`).

3. **Canvas for waveforms** — WebGL is overkill for 2D waveform rendering. Canvas 2D context with `requestAnimationFrame` and pre-computed waveform data (downsampled to pixel resolution) will hit 60fps. Overview waveform is pre-rendered; zoomed waveform updates per frame.

4. **MIDI mapping as config** — Controller mapping is a JSON config file mapping MIDI CC/Note numbers to app actions. This makes it swappable for other controllers in future versions without code changes.

5. **Lesson format as JSON** — Lessons are declarative JSON defining steps, expected inputs, and validation rules. The lesson engine interprets them. This separates content from code.

6. **No backend** — All audio processing, BPM detection, and waveform generation happen client-side. Progress stored in localStorage. No auth, no server.

## Technical Approach

### Audio Engine (`src/audio/`)
- `AudioEngine` class managing the AudioContext and master output chain
- `Deck` class encapsulating per-deck audio graph (source → EQ → volume → output)
- `BPMDetector` using onset detection (energy-based algorithm on AudioBuffer)
- `CrossfaderNode` custom gain interpolation between decks
- Audio file decoding via `AudioContext.decodeAudioData()` supporting MP3, WAV, FLAC, OGG

### MIDI Controller (`src/midi/`)
- `MIDIController` class wrapping Web MIDI API access and device detection
- `HerculesMapping` JSON config mapping MIDI messages to actions (CC numbers, note numbers, channels)
- `MIDIRouter` dispatching incoming MIDI messages to the appropriate deck/mixer action
- LED feedback via MIDI output (play state, pad colors)

### Waveform Visualization (`src/visuals/`)
- `WaveformRenderer` class managing Canvas rendering per deck
- Pre-computation: decode audio → extract peaks at multiple zoom levels → store as typed arrays
- Overview canvas: full track, static render, moving playhead indicator
- Zoomed canvas: ~10 seconds centered on playhead, scrolling at 60fps
- Color coding: FFT analysis to tint waveform segments by frequency content (warm = bass, green = mids, cyan = highs)
- Beat grid overlay: vertical markers at detected beat positions

### Lesson Engine (`src/lessons/`)
- `LessonEngine` class managing lesson state, step progression, and validation
- `LessonRenderer` updating the lesson panel UI with current step instructions
- `InputValidator` comparing real-time MIDI/audio state against expected lesson criteria
- Lesson JSON schema: `{ id, title, description, tracks, steps: [{ instruction, highlight, expected, validation }] }`
- 4 built-in lessons: Setup & Basics, Beatmatching, EQ Mixing, Transitions

### UI Shell (`src/ui/`)
- Single-page app with CSS custom properties for theming
- Top bar: logo, MIDI connection indicator (pulsing green dot), lesson navigation
- Center: dual waveform canvases (Deck A cyan-accented, Deck B magenta-accented)
- Middle: virtual mixer panel (EQ knobs, volume faders, crossfader) — mirrors physical controller state
- Bottom: lesson panel (collapsible) or performance tips in free play
- Controller SVG diagram for lesson highlights
- All CSS uses dark theme variables: `--bg-primary: #0a0a0a`, `--bg-secondary: #1a1a1a`, `--accent-a: #00f0ff`, `--accent-b: #ff00e5`
- Glow effects via `box-shadow` with accent colors, subtle pulse animations on active elements

### Project Structure
```
onset/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.js              # Entry point, app initialization
│   ├── audio/
│   │   ├── AudioEngine.js    # Master audio context + output chain
│   │   ├── Deck.js           # Per-deck audio graph
│   │   ├── BPMDetector.js    # Onset-based BPM detection
│   │   └── Crossfader.js     # Crossfader gain logic
│   ├── midi/
│   │   ├── MIDIController.js # Web MIDI device management
│   │   ├── MIDIRouter.js     # Message dispatch
│   │   └── hercules-mapping.json
│   ├── visuals/
│   │   ├── WaveformRenderer.js  # Canvas waveform drawing
│   │   ├── WaveformData.js      # Peak extraction + caching
│   │   └── BeatGrid.js          # Beat grid overlay
│   ├── lessons/
│   │   ├── LessonEngine.js      # Lesson state machine
│   │   ├── LessonRenderer.js    # UI updates for lesson panel
│   │   ├── InputValidator.js    # MIDI input validation
│   │   └── data/
│   │       ├── 01-setup.json
│   │       ├── 02-beatmatching.json
│   │       ├── 03-eq-mixing.json
│   │       └── 04-transitions.json
│   ├── ui/
│   │   ├── App.js               # Shell layout + routing
│   │   ├── Mixer.js             # Virtual mixer controls
│   │   ├── TopBar.js            # Header + connection status
│   │   └── ControllerDiagram.js # SVG controller for lessons
│   └── styles/
│       ├── main.css             # Global styles + CSS variables
│       ├── waveform.css         # Waveform panel styles
│       ├── mixer.css            # Mixer panel styles
│       └── lessons.css          # Lesson panel styles
└── public/
    └── assets/
        ├── controller-diagram.svg
        └── fonts/
```

## Implementation Strategy

**Phase 1 — Foundation (Tasks 1-3):** Project scaffolding, audio engine core, MIDI controller integration. These can be parallelized.

**Phase 2 — Visualization (Tasks 4-5):** Waveform rendering and beat detection. Depends on audio engine.

**Phase 3 — Mixer & UI (Tasks 6-7):** Virtual mixer controls and app shell/theming. Can partially parallelize.

**Phase 4 — Lessons (Tasks 8-9):** Lesson engine and lesson content. Depends on MIDI + audio + waveforms.

**Phase 5 — Integration (Task 10):** End-to-end integration, polish, and free play mode.

## Task Breakdown Preview

1. **Project Setup & Scaffolding** — Vite config, project structure, HTML shell, CSS theme variables [S]
2. **Audio Engine Core** — AudioContext, Deck class, file loading/decoding, playback controls, EQ, volume [L]
3. **MIDI Controller Integration** — Web MIDI detection, Hercules mapping, MIDIRouter, LED feedback [M]
4. **Waveform Data Processing** — Peak extraction, frequency analysis, multi-resolution caching [M]
5. **Waveform Canvas Rendering** — Overview + zoomed waveforms, beat grid overlay, 60fps render loop [M]
6. **Virtual Mixer UI** — EQ knobs, volume faders, crossfader, MIDI state mirroring [M]
7. **App Shell & Theming** — Layout, top bar, connection status, dark theme, glow effects, responsive [S]
8. **Lesson Engine** — State machine, step progression, input validation, progress tracking [M]
9. **Lesson Content** — 4 lesson JSON files with instructions, validation criteria, controller highlights [M]
10. **Integration & Free Play** — Wire everything together, free play mode, performance tips, polish [L]

## Dependencies

- Vite 6.x (build tool)
- No runtime dependencies — all browser-native APIs

## Success Criteria (Technical)

- Controller detected and responsive within 3 seconds of page load
- Audio latency from MIDI input to sound: <20ms
- Waveform renders at 60fps during dual-deck playback
- Track load + waveform computation: <3 seconds for 5-minute MP3
- All 4 lessons completable end-to-end with real controller
- Zero external API calls — fully offline after initial load

## Estimated Effort

- Total: ~60 hours
- Parallel capacity: Tasks 1-3 can run simultaneously, Tasks 4-5 together, Tasks 6-7 together
- Critical path: Setup → Audio → Waveform Data → Waveform Render → Lesson Engine → Integration

## Tasks Created
- [ ] 001.md - Project Setup & Scaffolding (parallel: true)
- [ ] 002.md - Audio Engine Core (parallel: true)
- [ ] 003.md - MIDI Controller Integration (parallel: true)
- [ ] 004.md - Waveform Data Processing (parallel: true, depends: 002)
- [ ] 005.md - Waveform Canvas Rendering (parallel: true, depends: 004)
- [ ] 006.md - Virtual Mixer UI (parallel: true, depends: 002, 003)
- [ ] 007.md - App Shell & Theming (parallel: true, depends: 001)
- [ ] 008.md - Lesson Engine (parallel: false, depends: 002, 003, 005)
- [ ] 009.md - Lesson Content Creation (parallel: false, depends: 008)
- [ ] 010.md - Integration & Free Play Mode (parallel: false, depends: 005, 006, 007, 008, 009)

Total tasks: 10
Parallel tasks: 6
Sequential tasks: 4
Estimated total effort: 65 hours
