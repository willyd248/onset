# Onset — Build Plan

## Status: SHIPPED (v1.0)

## Architecture
- **Framework**: Vanilla JavaScript (ES modules, no framework)
- **Build**: Vite 8
- **Audio**: Web Audio API (AudioContext, BiquadFilter, DynamicsCompressor)
- **MIDI**: Web MIDI API with Hercules DJControl Inpulse 200 MK2 mapping
- **State**: MixerState (observable store with change events)
- **Storage**: localStorage for progress, XP, settings, hot cues
- **Styling**: Vanilla CSS with design tokens (light + dark mode)
- **Hosting**: Vercel (auto-deploy from GitHub)

## What's Built
- Two-deck mixer with EQ (3-band), filter, gain, volume, pitch, crossfader
- Waveform rendering with real-time playhead
- BPM detection via onset-strength autocorrelation
- Lesson engine: watch-imagine-do phases with scoring
- 10 lesson catalog across basics, beatmatching, EQ mixing, transitions
- Session manager with interleaved practice and spaced repetition
- Scoring engine: accuracy, timing, phrase alignment
- XP system with 8 levels, daily streaks, practice time tracking
- Dynamic Learn/Stats/Profile views reading from progress data
- MIDI routing with wrap-around detection
- Hot cue persistence per track
- Interactive settings (difficulty, session length, theme)
- Dark mode (system + manual toggle)
- PWA with service worker
- Full WCAG accessibility (ARIA labels, focus styles, aria-live, AAA contrast)

## What's Next (GitHub Issues)
- #19: Landing page for acquisition
- #20: Auth flow with Supabase
- #21: First-time user onboarding
- #22: Onset Connect (phone-as-controller companion app)

## Tech Stack
- Runtime: Browser (Chrome, Firefox, Edge)
- Zero npm dependencies beyond Vite
- ~99KB JS bundle (gzipped: ~25KB)
- ~34KB CSS (gzipped: ~6KB)
