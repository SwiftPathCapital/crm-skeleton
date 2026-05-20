const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const ws = require('ws');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fromNumber = process.env.TELNYX_PHONE_NUMBER;
const API_KEY = process.env.TELNYX_API_KEY;

// ── Zoho OAuth config ─────────────────────────────────────────────────────────
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

// ── CORS: restrict to known origins ──────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://crm-skeleton-production.up.railway.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
]);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Electron file://, server-to-server)
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
  credentials: true,
}));

// Capture raw body for Telnyx webhook signature verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.userId = user.id;
  next();
}

// Apply requireAuth to all /api/* routes and /sms
app.use('/api', requireAuth);
app.use('/sms', requireAuth);

// ── OAuth CSRF helpers ────────────────────────────────────────────────────────
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || (() => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[oauth] OAUTH_STATE_SECRET not set — using insecure fallback');
  }
  return 'dev-fallback-secret-change-me';
})();

function buildOAuthState(agentId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now().toString();
  const payload = `${agentId}:${nonce}:${ts}`;
  const sig = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function parseOAuthState(state) {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const [agentId, , ts] = payload.split(':');
    // Reject states older than 10 minutes
    if (Date.now() - parseInt(ts, 10) > 600_000) return null;
    return agentId;
  } catch {
    return null;
  }
}

// ── Telnyx webhook signature verification ────────────────────────────────────
function verifyTelnyxSignature(req, res, next) {
  const sigHeader = req.headers['x-telnyx-signature-ed25519'];
  const timestamp = req.headers['x-telnyx-timestamp'];
  const publicKeyB64 = process.env.TELNYX_WEBHOOK_PUBLIC_KEY;

  if (!publicKeyB64) {
    console.warn('[webhook] TELNYX_WEBHOOK_PUBLIC_KEY not set — set this env var to enable signature verification');
    return next();
  }

  if (!sigHeader || !timestamp) {
    return res.status(400).json({ error: 'Missing webhook signature headers' });
  }

  const tsMs = parseInt(timestamp, 10) * 1000;
  if (Math.abs(Date.now() - tsMs) > 300_000) {
    return res.status(400).json({ error: 'Webhook timestamp expired' });
  }

  try {
    const message = Buffer.from(`${timestamp}|${req.rawBody || ''}`);
    const sig = Buffer.from(sigHeader, 'base64');
    const pubKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    if (!crypto.verify('ed25519', message, pubKey, sig)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    next();
  } catch (err) {
    console.error('[webhook] signature error:', err.message);
    return res.status(400).json({ error: 'Signature verification failed' });
  }
}

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
  const results = await Promise.allSettled(
    CONNECTION_IDS.map(id =>
      axios.get(`https://api.telnyx.com/v2/calls?connection_id=${id}`, {
        headers: { Authorization: 'Bearer ' + API_KEY }
      })
    )
  );
  const data = results.flatMap(r =>
    r.status === 'fulfilled' ? (r.value.data?.data || []) : []
  );
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.response?.status);
  if (errors.length) console.warn('[active-calls] some connection IDs failed with statuses:', errors);
  res.json({ data });
});

app.get('/api/recordings', async (req, res) => {
  try {
    const listRes = await axios.get('https://api.telnyx.com/v2/recordings', {
      headers: { Authorization: 'Bearer ' + API_KEY },
      params: { 'page[size]': 50 }
    });
    const recordings = listRes.data?.data || [];

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

app.post('/webhook/telnyx', verifyTelnyxSignature, async (req, res) => {
  // Acknowledge immediately — Telnyx retries if it doesn't get a 200 fast
  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload   = req.body?.data?.payload;
  if (!eventType || !payload) return;

  // ── Inbound SMS ─────────────────────────────────────────────────────────────
  if (eventType === 'message.received') {
    const from = payload.from?.phone_number || payload.from || null;
    const text = payload.text || '';
    const receivedAt = payload.received_at || new Date().toISOString();
    if (!from || !text) return;

    // Find or create conversation for this number
    let { data: conv } = await supabase
      .from('sms_conversations')
      .select('id, unread_count')
      .eq('contact_phone', from)
      .maybeSingle();

    if (!conv) {
      const { data: newConv } = await supabase
        .from('sms_conversations')
        .insert({ contact_phone: from, last_message: text, last_message_at: receivedAt, unread_count: 1 })
        .select().single();
      conv = newConv;
    } else {
      await supabase.from('sms_conversations')
        .update({ last_message: text, last_message_at: receivedAt, unread_count: (conv.unread_count || 0) + 1 })
        .eq('id', conv.id);
    }

    if (conv) {
      await supabase.from('sms_messages').insert({
        conversation_id: conv.id,
        body: text,
        direction: 'inbound',
        sent_at: receivedAt,
      });
    }
    return;
  }

  // ── Call events (require call_session_id) ───────────────────────────────────
  const sessionId = payload.call_session_id;
  if (!sessionId) return;

  if (eventType === 'call.hangup') {
    if (payload.direction === 'inbound') {
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

async function getZohoToken(agentId) {
  console.log('[getZohoToken] looking up agentId:', agentId, '(type:', typeof agentId, ')');

  const { data: row, error } = await supabase
    .from('zoho_tokens')
    .select('access_token, refresh_token, expires_at, account_id, calendar_uid, api_domain')
    .eq('id', agentId)
    .maybeSingle();

  console.log('[getZohoToken] raw result — error:', error, '| row:', row
    ? { ...row, access_token: row.access_token ? row.access_token.slice(0, 12) + '…' : null }
    : null);

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
    state:         buildOAuthState(agentId),
  });
  res.redirect(`${ZOHO_AUTH_URL}?${params}`);
});

// ── 2. GET /auth/zoho/callback ────────────────────────────────────────────────
app.get('/auth/zoho/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  if (oauthError || !code) {
    return res.status(400).send(`Zoho OAuth error: ${oauthError || 'no authorization code received'}`);
  }

  const agentId = parseOAuthState(state);
  if (!agentId) {
    return res.status(400).send('Invalid or expired OAuth state. Please try connecting again.');
  }

  try {
    console.log('[zoho/callback] exchanging code for token...');
    console.log('[zoho/callback] redirect_uri:', ZOHO_REDIRECT_URI);
    console.log('[zoho/callback] agentId (from state):', agentId);

    let tokenRes;
    try {
      tokenRes = await axios.post(ZOHO_TOKEN_URL, null, {
        params: {
          code,
          client_id:     ZOHO_CLIENT_ID,
          client_secret: ZOHO_CLIENT_SECRET,
          redirect_uri:  ZOHO_REDIRECT_URI,
          grant_type:    'authorization_code',
        },
      });
      console.log('[zoho/callback] token response status:', tokenRes.status);
      console.log('[zoho/callback] token response body:', JSON.stringify(tokenRes.data));
    } catch (tokenErr) {
      console.error('[zoho/callback] token exchange HTTP error:');
      console.error('  status:', tokenErr.response?.status);
      console.error('  headers:', JSON.stringify(tokenErr.response?.headers));
      console.error('  body:', JSON.stringify(tokenErr.response?.data));
      throw tokenErr;
    }

    const { access_token, refresh_token, expires_in, api_domain } = tokenRes.data;
    if (!access_token) throw new Error('Token exchange failed: ' + JSON.stringify(tokenRes.data));

    // Derive correct regional mail/calendar base URLs from the api_domain Zoho returns.
    // api_domain looks like "https://www.zohoapis.com" (or .eu, .in, .com.au, .jp).
    // Mail API lives at mail.zoho.{tld}, calendar at calendar.zoho.{tld}.
    const rawApiDomain = api_domain || 'https://www.zohoapis.com';
    const mailBase = rawApiDomain.replace('www.zohoapis', 'mail.zoho');
    const calBase  = rawApiDomain.replace('www.zohoapis', 'calendar.zoho');
    const expires_at = Date.now() + (expires_in || 3600) * 1000;

    console.log('[zoho/callback] api_domain from Zoho:', rawApiDomain);
    console.log('[zoho/callback] derived mailBase:', mailBase);

    const accountsUrl = `${mailBase}/api/accounts`;
    console.log('[zoho/callback] fetching accounts from:', accountsUrl);
    const accountsRes = await axios.get(accountsUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
    });
    console.log('[zoho/callback] accounts response status:', accountsRes.status);
    const accountId = accountsRes.data?.data?.[0]?.accountId;
    if (!accountId) console.warn('[zoho/callback] accountId came back null — accounts response:', JSON.stringify(accountsRes.data));

    let calendarUid = null;
    try {
      const calsRes = await axios.get(`${calBase}/api/v1/calendars`, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
      });
      calendarUid = calsRes.data?.calendars?.[0]?.uid;
    } catch (calErr) {
      console.warn('[zoho/callback] calendar fetch skipped:', calErr.message);
    }

    await supabase.from('zoho_tokens').upsert({
      id:           agentId,
      access_token,
      refresh_token,
      expires_at,
      account_id:   accountId,
      calendar_uid: calendarUid,
      api_domain:   mailBase,
    }, { onConflict: 'id' });

    console.log(`[zoho/callback] saved token for agent ${agentId} — mail:${accountId} cal:${calendarUid} domain:${mailBase}`);

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
  const { limit = 50, start = 0 } = req.query;
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
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
  const { limit = 50, start = 0 } = req.query;
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
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
  const { to, cc, subject, body, leadId } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ error: 'to and subject are required' });
  }
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    const sendRes = await axios.post(
      `${apiDomain}/api/accounts/${accountId}/messages`,
      { toAddress: to, ccAddress: cc || '', subject, content: body || '', mailFormat: 'plaintext' },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    const zohoMessageId = sendRes.data?.data?.messageId;

    const { data: agentRow } = await supabase.from('agents').select('email').eq('id', req.userId).single();
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

// ── 7. POST /api/calendar/events ─────────────────────────────────────────────
app.post('/api/calendar/events', async (req, res) => {
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

// ── 8. DELETE /api/calendar/events/:id ───────────────────────────────────────
app.delete('/api/calendar/events/:id', async (req, res) => {
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

// ── POST /api/send-application ────────────────────────────────────────────────
app.post('/api/send-application', async (req, res) => {
  const {
    businessName, dba, businessAddress, businessStartDate, ein,
    ownerName, ownerSS, ownerDOB, ownerAddress, printName,
  } = req.body;

  const blank = '___________';
  const v = (val) => (val && String(val).trim()) ? String(val).trim() : blank;

  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; }
    .wrap { max-width: 660px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .hdr { background: #080b10; padding: 28px 40px; text-align: center; }
    .hdr-co { color: #c9a84c; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 0 0 4px; }
    .hdr-sub { color: #8892a4; font-size: 13px; margin: 0; letter-spacing: 0.5px; }
    .body { padding: 32px 40px; }
    .sec { margin-bottom: 28px; }
    .sec-title { color: #c9a84c; font-size: 10px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; padding-bottom: 8px; border-bottom: 2px solid #c9a84c; margin-bottom: 16px; }
    .row { display: flex; align-items: baseline; margin-bottom: 10px; gap: 12px; }
    .lbl { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; width: 160px; flex-shrink: 0; }
    .val { color: #111827; font-size: 14px; border-bottom: 1px solid #d1d5db; flex: 1; padding-bottom: 3px; min-height: 20px; }
    .ftr { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 14px 40px; text-align: center; }
    .ftr p { color: #9ca3af; font-size: 11px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <p class="hdr-co">SWIFT PATH CAPITAL LLC</p>
      <p class="hdr-sub">Merchant Cash Advance Application</p>
    </div>
    <div class="body">
      <div class="sec">
        <div class="sec-title">Business Information</div>
        <div class="row"><span class="lbl">Business Name</span><span class="val">${v(businessName)}</span></div>
        <div class="row"><span class="lbl">DBA</span><span class="val">${v(dba)}</span></div>
        <div class="row"><span class="lbl">Business Address</span><span class="val">${v(businessAddress)}</span></div>
        <div class="row"><span class="lbl">Business Start Date</span><span class="val">${v(businessStartDate)}</span></div>
        <div class="row"><span class="lbl">EIN</span><span class="val">${v(ein)}</span></div>
      </div>
      <div class="sec">
        <div class="sec-title">Owner Information</div>
        <div class="row"><span class="lbl">Owner Name</span><span class="val">${v(ownerName)}</span></div>
        <div class="row"><span class="lbl">Social Security #</span><span class="val">${v(ownerSS)}</span></div>
        <div class="row"><span class="lbl">Date of Birth</span><span class="val">${v(ownerDOB)}</span></div>
        <div class="row"><span class="lbl">Owner Address</span><span class="val">${v(ownerAddress)}</span></div>
      </div>
      <div class="sec">
        <div class="sec-title">Signature</div>
        <div class="row"><span class="lbl">Print Name</span><span class="val">${v(printName)}</span></div>
      </div>
    </div>
    <div class="ftr">
      <p>Swift Path Capital LLC &bull; Submitted ${submittedAt} ET</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    const sendRes = await axios.post(
      `${apiDomain}/api/accounts/${accountId}/messages`,
      {
        toAddress:   'submissions@swiftpathtocapital.com',
        subject:     `New MCA Application — ${v(businessName)}`,
        content:     html,
        mailFormat:  'html',
      },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    const messageId = sendRes.data?.data?.messageId;
    res.json({ success: true, id: messageId });
  } catch (err) {
    console.error('[send-application]', err.response?.data || err.message);
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
