# Onset — Handoff Document (Updated 2026-03-24)

## Current Priority
UI redesign in progress. Sidebar nav and deck cards are live. Remaining work is CSS/HTML polish to match Stitch mockup designs.

## Live URLs
- Landing: https://onsetdj.com | Demo: https://onsetdj.com/demo | App: https://app.onsetdj.com
- GitHub: https://github.com/willyd248/onset

## UI Redesign — What Still Needs Work
Reference screenshots: ~/Desktop/Stitch/ (extract with: for f in ~/Desktop/Stitch/*.zip; do unzip -qo "$f" -d "/tmp/stitch-designs/$(basename "$f" .zip)"; done)

1. Vinyl records: larger (~240px), grooved rings, tonearm from top-right
2. Deck header: track name as bold heading, play button circle top-right
3. Volume faders: tall tracks (192px, 48px wide), rounded, visible fill + thumb
4. Tempo faders: same height, thinner (16px wide)
5. EQ knobs: larger (56px), colored border ring, rotating indicator dot
6. Gain + Filter: unhide, show as knobs with EQ row
7. Crossfader: full-width below both decks, not between them
8. Hot cue pads: tighten spacing

Files: index.html (Tailwind classes), src/styles/custom.css, src/ui/MixerUI.js (only if DOM changes)

## MIDI Mapping (confirmed 2026-03-24)
CC0=Volume, CC1=Filter, CC2=LowEQ, CC4=HighEQ, CC5=Gain, CC8=Tempo, CC40=Jog
Note5=Sync, Note6=Cue, Note7=Play | Ch6/Ch7 Notes 0-3 = Pads | Ch0 CC0 = Crossfader

## Critical: Element IDs must not change
All JS modules query by ID. See existing index.html for complete list.
Key: gain-a/b, eq-high/mid/low-a/b, volume-a/b, pitch-a/b, filter-a/b, crossfader,
play-a/b, cue-a/b, sync-a/b, pad-1-4-a/b, vinyl-a/b, waveform-a/b, load-a/b, file-a/b

## Deployment
Main app: vercel --prod from project root | Landing: cd landing && vercel --prod
