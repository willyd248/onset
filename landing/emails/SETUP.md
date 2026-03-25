# Onset Onboarding Drip — Setup Guide

## Overview

3-email sequence for new onsetdj.com signups. Resend handles delivery; Vercel Cron handles scheduling.

```
Day 0  →  email1-welcome.html   (sent immediately on signup)
Day 3  →  email2-tips.html      (sent by /api/drip/day3 cron)
Day 7  →  email3-streak.html    (sent by /api/drip/day7 cron)
```

All emails send from `hello@onsetdj.com`. The Day 0 email fires synchronously inside `api/subscribe.js`. Days 3 and 7 run via a daily Vercel Cron that queries the Resend audience for contacts who signed up exactly N days ago.

---

## Before Going Live

### 1. Verify your sending domain in Resend
- Go to **Resend → Domains** and add `onsetdj.com`
- Add the DNS records Resend gives you (SPF, DKIM, DMARC)
- Emails send from `hello@onsetdj.com` — update `subscribe.js` and `drip/day*.js` if you want a different address

### 2. Set environment variables in Vercel

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key (already set) |
| `RESEND_AUDIENCE_ID` | Your Resend audience ID (already set) |
| `CRON_SECRET` | A random secret string — protects the cron endpoints |
| `SEND_WELCOME_EMAIL` | `true` (or omit — enabled by default) |

Set `CRON_SECRET` with: `openssl rand -hex 32`

### 3. Add CRON_SECRET to Vercel Cron config
Vercel automatically passes `Authorization: Bearer <CRON_SECRET>` when calling cron routes if you set `CRON_SECRET` in environment variables. No extra config needed.

### 4. Add an unsubscribe page
The emails link to `https://onsetdj.com/unsubscribe`. This needs to exist. Simplest option: a static page that calls `DELETE /audiences/{id}/contacts/{email}` via Resend API. Until then, Resend's audience panel lets you manually remove contacts.

---

## Enabling the Drip

**The drip is NOT active until you deploy.** Nothing sends until the code is live on Vercel.

To activate:
1. Complete the domain verification and env var steps above
2. Merge this branch and deploy to Vercel
3. Vercel will auto-register the cron jobs from `landing/vercel.json`
4. Crons run daily at 10:00 UTC

To disable a specific email without removing code, set `SEND_WELCOME_EMAIL=false` for Day 0, or remove the relevant entry from `landing/vercel.json` for Day 3/7.

---

## Cron Schedule

Both drip crons run at **10:00 UTC daily** (`0 10 * * *`). Each run:
1. Fetches all contacts from the Resend audience
2. Filters to contacts with `created_at` matching exactly N days ago (UTC midnight comparison)
3. Sends the email to each eligible contact via `POST /emails`

Logs are visible in **Vercel → Functions → Logs**.

---

## Testing

To test without waiting for real signups:

```bash
# Test Day 0 — subscribe a test email
curl -X POST https://onsetdj.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'

# Test Day 3 cron manually (replace YOUR_CRON_SECRET)
curl -X GET https://onsetdj.com/api/drip/day3 \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test Day 7 cron manually
curl -X GET https://onsetdj.com/api/drip/day7 \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

For Day 3/7 tests, temporarily change `isNDaysAgo` to match contacts from today (daysAgo = 0).

---

## Editing Templates

HTML source files are in `landing/emails/`. They use inline styles for email client compatibility. Key design tokens:

| Color | Hex | Usage |
|---|---|---|
| Primary green | `#2a6900` | Buttons, numbers |
| Primary container | `#84fb42` | Divider accents |
| Purple container | `#eec2ff` | Info callout backgrounds |
| Gold | `#fec700` | Streak badge |
| Background | `#f6f6f6` | Email background |
| Card | `#ffffff` | Main content card |

Font: Plus Jakarta Sans (loaded via Google Fonts `<link>` — supported in most modern email clients; falls back to Arial).
