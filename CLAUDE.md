# Onset — DJ learning tool for hardware controllers

## Stack
- Framework: Vanilla JavaScript (ES6 modules), Vite 8 (no React/Vue/Svelte)
- Styling: Tailwind CSS (CDN in index.html), custom CSS in src/styles/
- Auth: Supabase Auth (optional — app falls back to localStorage-only if env vars absent)
- DB: Supabase PostgreSQL (optional)
- Audio: Web Audio API
- MIDI: Web MIDI API (hardcoded for Hercules DJControl Inpulse 200 MK2)
- Hosting: Vercel (two separate projects — app and landing)
- Email: Resend (landing page drip campaign)
- Analytics: Vercel Analytics + PostHog

## Commands
- `npm run dev`: Vite dev server at http://localhost:3000
- `npm run build`: Build app → `dist/`
- `npm run preview`: Preview built app locally
- `npm test`: Run test suite (Vitest)
- Landing page has no package.json — deploy via `cd landing && vercel --prod`

## Architecture
- `src/` — Main app: audio/, auth/, midi/, lessons/, visuals/, ui/, styles/
- `src/lessons/data/` — 24 JSON lesson files + 6 inline lessons = 30 total (schema defined in lesson-schema.js)
- `src/auth/` — Supabase client, AuthManager, AuthModal, localStorage migration
- `landing/` — Separate landing page with Vercel serverless functions (no shared code with app)
- `landing/api/` — Email subscribe endpoint + Resend drip crons (day3, day7)
- `public/` — Static assets, PWA manifest, service worker
- `supabase/migrations/` — Single SQL migration file
- No SPA router — view routing handled in ui/ViewManager.js
- All DOM element IDs for mixer controls are hardcoded in MIDI mapping — do not rename them

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (**bakes at build time**)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (**bakes at build time**)
- `VITE_POSTHOG_KEY` — PostHog project key (**bakes at build time**, optional — analytics disabled if absent)

Without both `VITE_SUPABASE_*` vars, the app runs in localStorage-only mode with no auth gate.

All `VITE_` vars bake into the JS bundle at build time — changing them in Vercel requires a redeploy.

### Landing page (Vercel env vars, not VITE_)
- `RESEND_API_KEY` — Resend API key for drip emails
- `RESEND_AUDIENCE_ID` — Resend audience ID
- `CRON_SECRET` — Protects `/api/drip/*` cron endpoints (optional but recommended)

## Deployment
- App: `vercel --prod` from repo root → deploys to app.onsetdj.com
  - Run `vercel alias set <url> app.onsetdj.com` after deploy
- Landing: `cd landing && vercel --prod` → deploys to onsetdj.com
  - Run `vercel alias set <url> onsetdj.com` after deploy
- Two Vercel projects — onset (app.onsetdj.com) and onset-landing (onsetdj.com). Deploy separately from their respective directories.

## Known Gotchas
- `VITE_SUPABASE_*` vars bake at build time — Vercel redeploy required after changes
- App and landing are separate Vercel projects; deploying one does not affect the other
- Mixer DOM element IDs (e.g., `gain-a`, `volume-b`, `crossfader`) are hardcoded in MIDI mapping — never rename
- MIDI mapping targets Hercules DJControl Inpulse 200 MK2 only; other controllers won't work without remapping
- Vercel cron jobs in `landing/vercel.json` fire daily at 10:00 UTC — `CRON_SECRET` should be set in prod

## Current Status
- Live at app.onsetdj.com (app) and onsetdj.com (landing)
- 30 lessons implemented with spaced repetition
- Supabase cloud sync + auth active

## Rules
- NEVER commit .env files
- ALWAYS run `vercel alias set` after `vercel --prod` deploy
- NEVER edit env vars directly in Vercel or Railway. Always edit in Infisical and let it sync.
- Dev bypass: `?dev=dk_onset_will_9f3k` URL param. Two Vercel projects — onset (app.onsetdj.com) and onset-landing (onsetdj.com). Deploy separately from their respective directories.
