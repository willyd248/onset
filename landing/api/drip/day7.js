/**
 * Drip Email — Day 7
 * Subject: "Keep your streak alive"
 *
 * Triggered daily by Vercel Cron (see landing/vercel.json).
 * Queries the Resend audience for contacts created exactly 7 days ago
 * and sends them the Day 7 streak email.
 *
 * Protected by CRON_SECRET — set this env var in Vercel.
 */

import fs from 'fs';
import path from 'path';

function loadEmailTemplate(filename) {
  const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'emails', filename);
  return fs.readFileSync(templatePath, 'utf-8');
}

/** Returns true if the contact's created_at date is exactly `daysAgo` days before today (UTC). */
function isNDaysAgo(createdAt, daysAgo) {
  const created = new Date(createdAt);
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() - daysAgo);
  const createdDay = new Date(created);
  createdDay.setUTCHours(0, 0, 0, 0);
  return createdDay.getTime() === target.getTime();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret so this can't be triggered by arbitrary requests
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    console.error('Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Fetch all contacts from the Resend audience
    const contactsResponse = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      }
    );

    if (!contactsResponse.ok) {
      const error = await contactsResponse.text();
      console.error('Failed to fetch contacts:', error);
      return res.status(500).json({ error: 'Failed to fetch contacts' });
    }

    const { data: contacts } = await contactsResponse.json();

    // Filter to contacts who signed up exactly 7 days ago and haven't unsubscribed
    const targets = (contacts || []).filter(
      (c) => !c.unsubscribed && c.created_at && isNDaysAgo(c.created_at, 7)
    );

    if (targets.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No contacts due for Day 7 email' });
    }

    let html = loadEmailTemplate('email3-streak.html');
    html = html.replace(/\{\{unsubscribe_url\}\}/g, 'https://onsetdj.com/unsubscribe');

    const results = await Promise.allSettled(
      targets.map((contact) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Onset <hello@onsetdj.com>',
            to: [contact.email],
            subject: 'Keep your streak alive',
            html,
          }),
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`Day 7 drip: sent=${sent} failed=${failed}`);
    return res.status(200).json({ sent, failed });
  } catch (err) {
    console.error('Day 7 drip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
