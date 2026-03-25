# Onset — Project State

## Status: v1.0 Complete

## What Just Shipped
- Complete UI overhaul: dark theme → Duolingo-inspired light theme
- Design system from Google Stitch (9 screens generated)
- Multi-view navigation: Learn, Practice, Stats, Profile, Settings
- Session Complete celebration view
- Plus Jakarta Sans typography, Material Symbols icons
- All audio/MIDI/lesson engine code preserved and wired

## What Works
- Dual-deck audio playback (Web Audio API)
- MIDI controller support (Hercules DJControl Inpulse 200 MK2)
- All mixer controls: gain, EQ (hi/mid/low), volume, pitch, filter, crossfader
- Transport: play/pause, cue, sync
- Hot cue pads (4 per deck)
- Real-time waveform rendering (overview + zoomed views)
- Drag-and-drop track loading
- Lesson engine with Watch-Imagine-Do phases
- Guitar Hero-style visual feedback on controls
- Scoring system (accuracy, timing, phrase alignment)
- Spaced repetition scheduling
- View routing between 5 screens + session complete

## What's Next (v1.1 candidates)
- Wire learning path nodes to actual LessonLibrary progression
- Make settings interactive (difficulty selector, session length)
- Persist user progress (localStorage or Supabase)
- Track time/XP on stats and profile pages
- Mobile-responsive layout
- More lesson content


## Tech Stack
- Vanilla JS (ES6 modules), no framework
- Vite bundler
- CSS custom properties (no Tailwind)
- Web Audio API, Web MIDI API, Canvas API
- Deployed on Vercel
