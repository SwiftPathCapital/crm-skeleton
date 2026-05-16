const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fromNumber = process.env.TELNYX_PHONE_NUMBER;
const API_KEY = process.env.TELNYX_API_KEY;

// ── Zoho OAuth config ─────────────────────────────────────────────────────────
// Requires the zoho_tokens table — see zoho_tokens_migration.sql
const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI  = 'https://crm-skeleton-production.up.railway.app/auth/zoho/callback';
const ZOHO_AUTH_URL      = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL     = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_SCOPES        = [
  'ZohoMail.messages.ALL',
  'ZohoMail.folders.ALL',
  'ZohoMail.accounts.READ',
  'ZohoCalendar.event.ALL',
  'ZohoCalendar.calendar.READ',
].join(',');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { transport: ws } }
);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', number: fromNumber });
});

app.post('/voice', (req, res) => {
  res.type('text/xml');
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response><Hangup/></Response>'
  );
});

app.post('/sms', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.telnyx.com/v2/messages',
      {
        to: req.body.to,
        from: fromNumber,
        text: req.body.text
      },
      {
        headers: {
          Authorization: 'Bearer ' + API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ id: response.data.data.id });
  } catch (err) {
    res.status(500).json({ error: err.response && err.response.data || err.message });
  }
});

app.get('/api/active-calls', async (req, res) => {
  const CONNECTION_IDS = ['2950311615590827625', '2950540692578895477'];
  try {
    const results = await Promise.all(
      CONNECTION_IDS.map(id =>
        axios.get(`https://api.telnyx.com/v2/calls?connection_id=${id}`, {
          headers: { Authorization: 'Bearer ' + API_KEY }
        })
      )
    );
    const data = results.flatMap(r => r.data?.data || []);
    res.json({ data });
  } catch (err) {
    console.error('[active-calls] status:', err.response?.status);
    console.error('[active-calls] body:', JSON.stringify(err.response?.data));
    console.error('[active-calls] message:', err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get('/api/recordings', async (req, res) => {
  try {
    const listRes = await axios.get('https://api.telnyx.com/v2/recordings', {
      headers: { Authorization: 'Bearer ' + API_KEY },
      params: { 'page[size]': 50 }
    });
    const recordings = listRes.data?.data || [];

    // Fetch full detail for each recording in parallel to get download_url, from, to
    const detailed = await Promise.all(
      recordings.map(async rec => {
        try {
          const detailRes = await axios.get(`https://api.telnyx.com/v2/recordings/${rec.id}`, {
            headers: { Authorization: 'Bearer ' + API_KEY }
          });
          const d = detailRes.data?.data || {};
          return {
            ...rec,
            download_url: d.download_urls?.mp3 || d.download_url || null,
            from: d.from || rec.from || null,
            to: d.to || rec.to || null,
          };
        } catch (detailErr) {
          console.error(`[recordings] detail fetch failed for ${rec.id}:`, detailErr.message);
          return { ...rec, download_url: null, from: null, to: null };
        }
      })
    );

    res.json({ data: detailed });
  } catch (err) {
    console.error('[recordings] status:', err.response?.status);
    console.error('[recordings] body:', JSON.stringify(err.response?.data));
    console.error('[recordings] message:', err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.post('/webhook/telnyx', async (req, res) => {
  // Acknowledge immediately — Telnyx retries if it doesn't get a 200 fast
  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload   = req.body?.data?.payload;
  if (!eventType || !payload) return;

  const sessionId = payload.call_session_id;
  if (!sessionId) return;

  if (eventType === 'call.hangup') {
    if (payload.direction === 'inbound') {
      // Lead called in — create or merge the row keyed on call_session_id
      await supabase.from('calls').upsert({
        call_session_id: sessionId,
        lead_phone: payload.from || null,
        disposition: 'completed',
        created_at: payload.start_time || new Date().toISOString(),
      }, { onConflict: 'call_session_id' });
    }

  }

  if (eventType === 'call.recording.saved') {
    const recordingUrl = payload.public_recording_urls?.mp3
      || payload.download_urls?.mp3
      || null;
    const duration = payload.duration_millis
      ? Math.round(payload.duration_millis / 1000)
      : null;

    // Try to update an existing row first; if none exists (recording arrived
    // without a prior hangup event), create it
    const { data: existing } = await supabase
      .from('calls')
      .select('id')
      .eq('call_session_id', sessionId)
      .maybeSingle();

    if (existing) {
      await supabase.from('calls')
        .update({ recording_url: recordingUrl, duration })
        .eq('call_session_id', sessionId);
    } else {
      await supabase.from('calls').upsert({
        call_session_id: sessionId,
        recording_url: recordingUrl,
        duration,
        disposition: 'completed',
        created_at: payload.recording_started_at || new Date().toISOString(),
      }, { onConflict: 'call_session_id' });
    }
  }
});

// ── Zoho helpers ──────────────────────────────────────────────────────────────

// Fetch token from zoho_tokens table, refreshing if within 5 min of expiry.
async function getZohoToken(agentId) {
  const { data: row, error } = await supabase
    .from('zoho_tokens')
    .select('access_token, refresh_token, expires_at, account_id, calendar_uid, api_domain')
    .eq('id', agentId)
    .maybeSingle();

  if (error || !row?.access_token) {
    const err = new Error('Zoho not connected. Reconnect via /auth/zoho?agentId=' + agentId);
    err.status = 401;
    throw err;
  }

  const needsRefresh = row.expires_at && Date.now() > row.expires_at - 300_000;
  if (needsRefresh) {
    const refreshRes = await axios.post(ZOHO_TOKEN_URL, null, {
      params: {
        refresh_token: row.refresh_token,
        client_id:     ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type:    'refresh_token',
      },
    });
    const { access_token, expires_in } = refreshRes.data;
    const expires_at = Date.now() + (expires_in || 3600) * 1000;
    await supabase.from('zoho_tokens').update({ access_token, expires_at }).eq('id', agentId);
    row.access_token = access_token;
    row.expires_at   = expires_at;
  }

  const apiDomain = row.api_domain || 'https://mail.zoho.com';
  return {
    accessToken:  row.access_token,
    accountId:    row.account_id,
    calendarUid:  row.calendar_uid,
    apiDomain,
    calendarBase: apiDomain.replace('mail.', 'calendar.'),
  };
}

// ── 1. GET /auth/zoho ─────────────────────────────────────────────────────────
app.get('/auth/zoho', (req, res) => {
  if (!ZOHO_CLIENT_ID) return res.status(500).send('ZOHO_CLIENT_ID env var not set');
  const { agentId = '' } = req.query;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     ZOHO_CLIENT_ID,
    scope:         ZOHO_SCOPES,
    redirect_uri:  ZOHO_REDIRECT_URI,
    access_type:   'offline',
    state:         agentId,
  });
  res.redirect(`${ZOHO_AUTH_URL}?${params}`);
});

// ── 2. GET /auth/zoho/callback ────────────────────────────────────────────────
app.get('/auth/zoho/callback', async (req, res) => {
  const { code, state: agentId, error: oauthError } = req.query;
  if (oauthError || !code) {
    return res.status(400).send(`Zoho OAuth error: ${oauthError || 'no authorization code received'}`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(ZOHO_TOKEN_URL, null, {
      params: {
        code,
        client_id:     ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        redirect_uri:  ZOHO_REDIRECT_URI,
        grant_type:    'authorization_code',
      },
    });

    const { access_token, refresh_token, expires_in, api_domain } = tokenRes.data;
    if (!access_token) throw new Error('Token exchange failed: ' + JSON.stringify(tokenRes.data));

    const mailBase   = api_domain || 'https://mail.zoho.com';
    const calBase    = mailBase.replace('mail.', 'calendar.');
    const expires_at = Date.now() + (expires_in || 3600) * 1000;

    // Fetch Zoho Mail account ID
    const accountsRes = await axios.get(`${mailBase}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
    });
    const accountId = accountsRes.data?.data?.[0]?.accountId;

    // Fetch default Zoho Calendar UID (best-effort)
    let calendarUid = null;
    try {
      const calsRes = await axios.get(`${calBase}/api/v1/calendars`, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
      });
      calendarUid = calsRes.data?.calendars?.[0]?.uid;
    } catch (calErr) {
      console.warn('[zoho/callback] calendar fetch skipped:', calErr.message);
    }

    // Upsert into zoho_tokens table
    await supabase.from('zoho_tokens').upsert({
      id:           agentId,
      access_token,
      refresh_token,
      expires_at,
      account_id:   accountId,
      calendar_uid: calendarUid,
      api_domain:   mailBase,
    }, { onConflict: 'id' });

    console.log(`[zoho/callback] saved token for agent ${agentId} — mail:${accountId} cal:${calendarUid}`);

    res.send(`
      <html><body style="font-family:sans-serif;background:#080b10;color:#c9a84c;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <p style="font-size:1.25rem;font-weight:bold">✓ Zoho connected</p>
          <p style="color:#8892a4;font-size:.875rem">Mail &amp; Calendar ready. You can close this tab.</p>
          <script>if(window.opener){window.opener.postMessage('zoho-connected','*');setTimeout(()=>window.close(),800);}</script>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error('[zoho/callback]', err.response?.data || err.message);
    res.status(500).send('Failed to connect Zoho: ' + (err.response?.data?.error || err.message));
  }
});

// ── 3. GET /api/emails/inbox ──────────────────────────────────────────────────
app.get('/api/emails/inbox', async (req, res) => {
  const { agentId, limit = 50, start = 0 } = req.query;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(agentId);
    const response = await axios.get(`${apiDomain}/api/accounts/${accountId}/messages/view`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      params:  { folderPath: 'Inbox', limit, start, sortBy: 'date', sortorder: 'desc' },
    });
    res.json(response.data);
  } catch (err) {
    console.error('[emails/inbox]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── 4. GET /api/emails/sent ───────────────────────────────────────────────────
app.get('/api/emails/sent', async (req, res) => {
  const { agentId, limit = 50, start = 0 } = req.query;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(agentId);
    const response = await axios.get(`${apiDomain}/api/accounts/${accountId}/messages/view`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      params:  { folderPath: 'Sent', limit, start, sortBy: 'date', sortorder: 'desc' },
    });
    res.json(response.data);
  } catch (err) {
    console.error('[emails/sent]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── 5. POST /api/emails/send ──────────────────────────────────────────────────
app.post('/api/emails/send', async (req, res) => {
  const { agentId, to, cc, subject, body, leadId } = req.body;
  if (!agentId || !to || !subject) {
    return res.status(400).json({ error: 'agentId, to, and subject are required' });
  }
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(agentId);
    const sendRes = await axios.post(
      `${apiDomain}/api/accounts/${accountId}/messages`,
      { toAddress: to, ccAddress: cc || '', subject, content: body || '', mailFormat: 'plaintext' },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    const zohoMessageId = sendRes.data?.data?.messageId;

    // Mirror into Supabase emails table for lead history
    const { data: agentRow } = await supabase.from('agents').select('email').eq('id', agentId).single();
    await supabase.from('emails').insert({
      lead_id:         leadId || null,
      from_email:      agentRow?.email || '',
      to_email:        to,
      cc_email:        cc || null,
      subject,
      body:            body || '',
      folder:          'sent',
      read:            true,
      sent_at:         new Date().toISOString(),
      zoho_message_id: zohoMessageId,
    });

    res.json({ success: true, messageId: zohoMessageId });
  } catch (err) {
    console.error('[emails/send]', err.response?.data || err.message);
    res.status(err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── 6. GET /api/calendar/events ───────────────────────────────────────────────
app.get('/api/calendar/events', async (req, res) => {
  const { agentId } = req.query;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(agentId);
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

// ── 7. POST /api/calendar/events ─────────────────────────────────────────────
app.post('/api/calendar/events', async (req, res) => {
  const { agentId, title, start, end, description, timezone = 'America/New_York' } = req.body;
  if (!agentId || !title || !start || !end) {
    return res.status(400).json({ error: 'agentId, title, start, and end are required' });
  }
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(agentId);
    if (!calendarUid) return res.status(409).json({ error: 'No calendar found. Reconnect Zoho.' });

    // Convert ISO datetime → Zoho format: YYYYMMDDTHHmmss+0000
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

// ── 8. DELETE /api/calendar/events/:id ───────────────────────────────────────
app.delete('/api/calendar/events/:id', async (req, res) => {
  const { id: eventId } = req.params;
  const { agentId }     = req.query;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });
  try {
    const { accessToken, calendarUid, calendarBase } = await getZohoToken(agentId);
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('TELNYX_API_KEY:', API_KEY ? `set (${API_KEY.slice(0, 8)}...)` : 'MISSING');
});