---
name: onset-v1
description: DJ learning app for Hercules DJControl Inpulse 200 MK2 using Web MIDI, Web Audio, and Canvas
status: active
created: 2026-03-23T16:15:33Z
---

# PRD: onset-v1

## Executive Summary

Onset is a browser-based DJ learning app that connects to a physical Hercules DJControl Inpulse 200 MK2 via USB MIDI. It teaches complete beginners how to DJ through guided, interactive lessons — starting with loading tracks and understanding waveforms, progressing through beatmatching by ear, EQ mixing, and smooth transitions. The app renders real-time waveforms, responds to physical controller input, and provides visual feedback that mirrors what a real DJ booth feels like.

## Problem Statement

Learning to DJ is intimidating. YouTube tutorials are passive and disconnected from the hardware. Paid courses are expensive and generic. The Hercules Inpulse 200 MK2 ships with DJUICE software that's functional but teaches nothing — it's a tool, not a teacher. There is no product that combines a real physical controller with structured, interactive lessons in the browser.

Beginners buy a controller, watch a few videos, get overwhelmed by the gap between "press play" and "actually mixing," and the controller collects dust. Onset bridges that gap by turning the controller into the lesson itself.

## User Stories

### US-1: First-time setup
**As a** complete beginner who just unboxed their Hercules controller,
**I want to** plug in my controller and have the app detect it automatically,
**so that** I can start learning without any driver installation or configuration headaches.

**Acceptance criteria:**
- App prompts for Web MIDI access on first load
- Controller is detected and named within 3 seconds of granting permission
- If no controller is detected, a clear troubleshooting guide is shown
- MIDI input/output indicators confirm the connection is live

### US-2: Loading and previewing tracks
**As a** beginner learning to DJ,
**I want to** load audio tracks into virtual decks and see their waveforms,
**so that** I can understand the structure of a song before mixing it.

**Acceptance criteria:**
- User can drag-and-drop or file-pick audio files (MP3, WAV, FLAC, OGG)
- Waveform is rendered within 2 seconds of loading for a typical 5-minute track
- Waveform shows amplitude and color-coded frequency bands (lows, mids, highs)
- Playback position is shown as a moving playhead on the waveform
- BPM is auto-detected and displayed per deck

### US-3: Guided lesson — beatmatching
**As a** beginner who has never beatmatched,
**I want to** follow a step-by-step lesson that teaches me to match tempos using the jog wheels and pitch faders on my controller,
**so that** I can learn the foundational skill of DJing with hands-on practice.

**Acceptance criteria:**
- Lesson loads two pre-selected tracks with known BPMs
- Step-by-step instructions appear on screen, highlighting which physical control to use
- Visual beat grid overlay shows alignment/misalignment in real time
- Tempo difference is displayed numerically (e.g., "+1.2 BPM")
- Lesson validates when beats are aligned within ±0.5 BPM for 8 bars
- Controller jog wheels and pitch faders are mapped and responsive

### US-4: Guided lesson — EQ mixing
**As a** beginner learning EQ techniques,
**I want to** follow a lesson that teaches me to use the EQ knobs to blend frequencies between two tracks,
**so that** I can create smooth, professional-sounding mixes.

**Acceptance criteria:**
- Lesson explains low/mid/high EQ bands with audio examples
- Real-time EQ visualization shows frequency response per deck
- Instructions guide the user through a bass swap technique
- EQ knob movements on the controller are reflected in the UI in real time
- Lesson validates when a clean EQ swap is performed (no clipping, smooth transition)

### US-5: Guided lesson — transitions
**As a** beginner ready to put skills together,
**I want to** follow a lesson that teaches me to transition between two tracks using crossfader, volume faders, and EQ,
**so that** I can perform a complete mix from one song to the next.

**Acceptance criteria:**
- Lesson combines beatmatching + EQ skills from prior lessons
- Crossfader and volume fader movements are tracked and visualized
- Step-by-step guidance walks through: cue the next track, align beats, begin transition, EQ swap, complete crossfade
- Transition quality score is given at the end (based on beat alignment, EQ balance, crossfader smoothness)
- User can replay and improve their score

### US-6: Free play mode
**As a** user who has completed lessons,
**I want to** mix freely with any tracks I load,
**so that** I can practice and develop my own style without lesson constraints.

**Acceptance criteria:**
- Full dual-deck interface with waveforms, EQ, volume, crossfader
- All controller inputs are mapped and responsive
- No lesson overlays or forced progression
- BPM display, beat grid, and waveform visualization remain active
- Optional performance tips shown as non-intrusive hints

## Functional Requirements

### FR-1: Web MIDI Controller Integration
- Detect Hercules DJControl Inpulse 200 MK2 via Web MIDI API
- Map all physical controls: jog wheels (touch + rotation), pitch faders, EQ knobs (low/mid/high per channel), volume faders, crossfader, play/pause/cue buttons, headphone cue buttons, pads
- Send LED feedback to controller (play state indicators, pad colors)
- Handle MIDI clock for sync reference
- Graceful degradation if controller disconnects mid-session

### FR-2: Audio Engine
- Decode and play audio files using Web Audio API (AudioContext, AudioBuffer)
- Dual independent audio channels (Deck A and Deck B)
- Per-deck controls: play, pause, cue, pitch/tempo adjustment (±8% range)
- 3-band EQ (low/mid/high) with kill switches
- Crossfader with configurable curve (sharp, smooth, linear)
- Volume faders per channel
- Master output with limiter to prevent clipping
- BPM detection using onset detection algorithm
- Beat grid generation from detected BPM

### FR-3: Waveform Visualization
- Real-time scrolling waveform per deck rendered on HTML5 Canvas
- Color-coded frequency bands: bass (red/warm), mids (green), highs (blue/cyan)
- Overview waveform showing full track with playback position
- Zoomed waveform showing ~10 seconds around the playhead
- Beat grid markers overlaid on waveforms
- Phase alignment indicator between decks
- 60fps rendering target

### FR-4: Lesson Engine
- JSON-based lesson format defining steps, expected controller inputs, validation criteria
- Lesson renderer that shows current step, instruction text, and highlighted controller diagram
- Input validator that checks controller actions against expected inputs
- Progress tracker per lesson (step completion, overall progress)
- Lesson library with ordered curriculum: (1) Setup & Basics, (2) Beatmatching, (3) EQ Mixing, (4) Transitions
- Completion state persisted in localStorage

### FR-5: UI Layout
- Dark immersive theme — deep blacks (#0a0a0a), dark grays (#1a1a1a, #2a2a2a)
- Neon accent colors: cyan (#00f0ff) for Deck A, magenta (#ff00e5) for Deck B
- Glowing UI elements with box-shadow and subtle pulsing animations
- Layout: top bar (logo, connection status, lesson nav), center (dual waveform displays), middle (virtual mixer with EQ/volume/crossfader), bottom (lesson panel or performance tips)
- Controller diagram SVG for lesson highlights
- Responsive for 1280px+ screens (not mobile — requires physical controller)

## Non-Functional Requirements

### NFR-1: Performance
- Audio latency from controller input to sound output: <20ms
- Waveform rendering: 60fps sustained during playback
- Track load + waveform generation: <3 seconds for a 5-minute MP3
- Memory usage: <512MB with two loaded tracks

### NFR-2: Browser Support
- Chrome 89+ (Web MIDI API support required)
- Edge 89+ (Chromium-based)
- No Firefox/Safari support (Web MIDI not available without polyfill)

### NFR-3: Offline Capability
- App works fully offline after initial load (no server-side audio processing)
- All lessons bundled in the app
- User audio files are processed client-side only — never uploaded

### NFR-4: Accessibility
- Keyboard navigation for non-MIDI UI elements
- High contrast mode (already dark theme, ensure sufficient contrast ratios)
- Screen reader labels for status indicators

## Success Criteria

- A complete beginner can go from unboxing to performing a basic transition in under 60 minutes
- All 4 lesson modules (setup, beatmatching, EQ, transitions) are completable end-to-end
- Controller input-to-audio latency is imperceptible (<20ms)
- Waveform visualization runs at 60fps without dropped frames
- BPM detection is accurate within ±1 BPM for tracks in the 100-180 BPM range

## Constraints & Assumptions

### Constraints
- Web MIDI API is Chromium-only — limits browser support
- Hercules DJControl Inpulse 200 MK2 specific MIDI mapping — other controllers not supported in v1
- No server backend — all processing is client-side
- Audio files must be local — no streaming service integration

### Assumptions
- Users have a Hercules DJControl Inpulse 200 MK2 connected via USB
- Users are on Chrome/Edge desktop browser
- Users have their own music library (MP3/WAV files)
- The Hercules controller's MIDI implementation follows the documented SysEx spec

## Out of Scope

- Support for controllers other than Hercules DJControl Inpulse 200 MK2
- Mobile or tablet interface
- Cloud storage or sync of tracks/progress
- Streaming service integration (Spotify, SoundCloud, etc.)
- Recording or exporting mixes
- Effects (reverb, delay, flanger, etc.) — future version
- Sampler/loop pads — future version
- Multi-user or social features
- Account system or authentication

## Dependencies

- Web MIDI API (browser-native, Chromium only)
- Web Audio API (browser-native, all modern browsers)
- HTML5 Canvas API (browser-native)
- Hercules DJControl Inpulse 200 MK2 MIDI specification document
- Vite (build tool)
- No external UI frameworks — vanilla JS + Canvas
