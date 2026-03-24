# Onset — Launch Prep Package

## Positioning
- **Headline**: Learn to DJ with real-time feedback on your actual controller
- **Subheadline**: Interactive lessons that watch your moves, score your mixing, and build your skills — right in the browser.
- **CTA**: Get early access

## X Thread

### Tweet 1 (Hook)
I spent $150 on a DJ lesson once. The instructor showed me a bass swap, I tried it, he said "not quite" and moved on.

No score. No feedback. No idea what I did wrong.

So I built onset — it's like Guitar Hero for learning to DJ. Watches your controller inputs and scores every move.

Drop your email for early access: onsetdj.com

### Tweet 2 (Problem → Solution)
The DJ learning pipeline is broken:

YouTube → passive watching, no feedback
DJ schools → $50-150/hr, if you can find one
Pro software → built for performing, not learning

onset sits in the gap. Plug in your controller, follow interactive lessons, get scored on accuracy + timing + phrase alignment.

### Tweet 3 (The Ask)
Building this for people who just bought their first DJ controller and want structured practice instead of YouTube roulette.

If you're learning to DJ (or teach DJing), what's the hardest part of the first 30 days? DM me — genuinely want to know.

## Distribution Channels

### Channel 1: r/Beatmatch (Reddit)
**Where**: reddit.com/r/Beatmatch — 180K+ members, specifically for beginner DJs
**When**: Tuesday or Wednesday, 10am EST
**Post type**: Text post (no links in body — save for comment)

**Draft:**

Title: "I built a free interactive DJ trainer that scores your mixing in real-time"

Body:
"Hey r/Beatmatch — I've been learning to DJ for a few months and the thing that frustrated me most was the gap between watching YouTube tutorials and actually knowing if I'm doing it right.

So I built onset. It's a web app where you plug in your MIDI controller, follow structured lessons (watch-imagine-do format), and it scores your accuracy, timing, and phrase alignment in real-time. Like Guitar Hero but for DJ skills.

Currently supports Hercules Inpulse 200 MK2, working on more controllers. Also building a feature where your phone becomes a touch controller via WiFi.

Would love feedback from this community — you're literally the target user. What would you want from a tool like this?

Link in my first comment."

### Channel 2: LinkedIn
**Where**: Personal profile + DJ/music production groups
**When**: Monday or Wednesday, 8am EST
**Post type**: Personal story + product mention

**Draft:**

"I taught myself to DJ this year. The learning experience is terrible.

YouTube tutorials are passive. DJ schools cost $150/hour. Software like Serato assumes you already know what you're doing.

So I built something: onset — an interactive DJ trainer in the browser. You plug in your controller, follow guided lessons, and it scores every move you make (accuracy, timing, phrase alignment).

Think Duolingo meets Guitar Hero, but for DJing.

It's free, runs in Chrome, and works with a $100 Hercules controller. Currently in early access.

If you know someone learning to DJ, I'd appreciate a share. And if you have feedback — I'm all ears.

onsetdj.com"

### Channel 3: DJ TechTools Forum
**Where**: djtechtools.com/community — the largest DJ technology forum
**When**: Any weekday
**Post type**: New thread in "DJ Software" or "Controllers" section

**Draft:**

Title: "Onset — free interactive DJ lessons with real-time MIDI feedback"

Body:
"Hi all — I built a browser-based DJ learning tool called onset that uses the Web MIDI API to give real-time feedback on your controller inputs.

How it works: plug in your controller, load your own tracks, and follow guided lessons. The app scores you on accuracy, timing, and phrase alignment (using BPM detection and beat grid analysis). It uses a watch-imagine-do framework — you see the technique, visualize it, then do it yourself with scaffolded guidance that fades as you improve.

Currently mapped for the Hercules Inpulse 200 MK2. Building more controller support.

Tech stack: vanilla JS, Web Audio API, Web MIDI API, runs entirely in the browser.

Would love feedback from this community. What features would make this useful for your students or practice sessions?

Link: onsetdj.com"

## Demo Script (60 seconds)

```
[0-5s] Hook: "If you just bought your first DJ controller, you know the feeling —
       you watched 10 YouTube tutorials and still can't do a clean transition."

[5-12s] Problem: "The problem isn't talent. It's feedback. Nobody's telling you
        if your timing is off, if your EQ cut was too early, if you missed the
        phrase boundary."

[12-20s] Show onset loading in browser: "This is onset. Open your browser, plug
         in your controller, drag in your tracks."

[20-30s] Start a lesson: "Each lesson has three phases. Watch the technique,
         visualize it, then do it yourself. The app watches your MIDI inputs
         and scores every move."

[30-40s] Show real-time scoring: "See that? 87 — accuracy was good but I was
         a beat late on the phrase. It tells you exactly what to fix."

[40-48s] Show progress: "XP, streaks, skill balance across categories.
         Spaced repetition so you actually retain techniques."

[48-55s] Differentiator: "Unlike YouTube, it's interactive. Unlike DJ schools,
         it's free. Unlike Serato, it's built for learning."

[55-60s] CTA: "Link in the description. Free forever. No credit card.
         onsetdj.com"
```

## Deployment Checklist
1. Deploy `landing/` folder to Vercel as a separate project (onset-landing)
2. Set env vars: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`
3. Connect subdomain: `onsetdj.com` → landing page
4. Connect subdomain: `app.onsetdj.com` → main app (or keep on same domain with routing)
5. Record Loom video (60 seconds, use demo script above)
6. Replace demo placeholder in landing page with Loom embed
7. Post X thread
8. Post in r/Beatmatch (stagger 1 day after X)
9. Post on LinkedIn (stagger 1 day after Reddit)
10. Post on DJ TechTools forum (stagger 1 day after LinkedIn)
11. Calendar reminder: run /decide in 2 weeks (2026-04-07)

## Validation Thresholds (broad-consumer, 100K+ addressable)

| Signal | Go | Iterate | Kill |
|--------|----|---------| -----|
| Email signups (2 wks) | 50+ | 20-49 | <20 |
| Pre-sales | Any | — | 0 |
| X engagement | 50+ | 15-49 | <15 |
| Organic referrals | Any | — | 0 |
| Bounce rate | <60% | 60-80% | >80% |

Decision date: **2026-04-07**
