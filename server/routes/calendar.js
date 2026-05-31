const express = require('express');
const axios   = require('axios');
const { getZohoToken } = require('../lib/zoho');

const router = express.Router();

// ── GET /api/calendar/events ──────────────────────────────────────────────────
router.get('/api/calendar/events', async (req, res) => {
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(req.userId);
    if (!calendarUid) return res.status(409).json({ error: 'No calendar found. Reconnect Zoho.' });

    const now    = new Date();
    const future = new Date(now.getTime() + 30 * 86_400_000);
    const fmt    = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

    const response = await axios.get(`${calendarBase}/api/v1/calendars/${calendarUid}/events`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      params:  { range: JSON.stringify({ start: fmt(now), end: fmt(future) }) },
    });
    res.json(response.data);
  } catch (err) {
    console.error('[calendar/events GET]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── POST /api/calendar/events ─────────────────────────────────────────────────
router.post('/api/calendar/events', async (req, res) => {
  const { title, start, end, description, timezone = 'America/New_York' } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ error: 'title, start, and end are required' });
  }
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(req.userId);
    if (!calendarUid) return res.status(409).json({ error: 'No calendar found. Reconnect Zoho.' });

    const toZohoTime = (iso) =>
      iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '+0000').replace(/Z$/, '+0000');

    const response = await axios.post(
      `${calendarBase}/api/v1/calendars/${calendarUid}/events`,
      {
        title,
        dateandtime: { start: toZohoTime(start), end: toZohoTime(end), timezone },
        description: description || '',
        reminders:   [{ minutes: -15, action: 'alert' }],
      },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[calendar/events POST]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── DELETE /api/calendar/events/:id ──────────────────────────────────────────
router.delete('/api/calendar/events/:id', async (req, res) => {
  const { id: eventId } = req.params;
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(req.userId);
    if (!calendarUid) return res.status(409).json({ error: 'No calendar found. Reconnect Zoho.' });

    await axios.delete(`${calendarBase}/api/v1/calendars/${calendarUid}/events/${eventId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[calendar/events DELETE]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
