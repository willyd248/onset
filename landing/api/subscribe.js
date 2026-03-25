import fs from 'fs';
import path from 'path';

function loadEmailTemplate(filename) {
  const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'emails', filename);
  return fs.readFileSync(templatePath, 'utf-8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    console.error('Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Step 1: Add contact to Resend audience
    const audienceResponse = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          unsubscribed: false,
        }),
      }
    );

    if (!audienceResponse.ok) {
      const error = await audienceResponse.text();
      console.error('Resend audience error:', error);
      return res.status(500).json({ error: 'Failed to subscribe' });
    }

    // Step 2: Send Day 0 welcome email immediately
    // NOTE: This is a transactional send — not a broadcast.
    // Remove this block and set SEND_WELCOME_EMAIL=false to disable.
    if (process.env.SEND_WELCOME_EMAIL !== 'false') {
      let html = loadEmailTemplate('email1-welcome.html');
      // Replace unsubscribe placeholder — Resend does not auto-inject this for
      // transactional sends. Link to a simple hosted unsubscribe page or remove.
      html = html.replace('{{unsubscribe_url}}', 'https://onsetdj.com/unsubscribe');

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Onset <hello@onsetdj.com>',
          to: [email],
          subject: 'Welcome to Onset — here\'s how to get started',
          html,
        }),
      });

      if (!emailResponse.ok) {
        // Log but don't fail the signup — contact was added successfully
        const error = await emailResponse.text();
        console.error('Welcome email send error:', error);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
