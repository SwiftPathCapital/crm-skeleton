const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const { supabaseAdmin } = require('./db');

const router = express.Router();

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI  = 'https://crm-skeleton-production.up.railway.app/auth/zoho/callback';
const ZOHO_AUTH_URL      = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL     = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_SCOPES = [
  'ZohoMail.messages.ALL',
  'ZohoMail.folders.ALL',
  'ZohoMail.accounts.READ',
  'ZohoCalendar.event.ALL',
  'ZohoCalendar.calendar.READ',
].join(',');

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET;

function buildOAuthState(agentId) {
  const nonce   = crypto.randomBytes(16).toString('hex');
  const ts      = Date.now().toString();
  const payload = `${agentId}:${nonce}:${ts}`;
  const sig     = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function parseOAuthState(state) {
  try {
    const decoded   = Buffer.from(state, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    const payload   = decoded.slice(0, lastColon);
    const sig       = decoded.slice(lastColon + 1);
    const expected  = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const [agentId, , ts] = payload.split(':');
    if (Date.now() - parseInt(ts, 10) > 600_000) return null;
    return agentId;
  } catch {
    return null;
  }
}

// ── GET /auth/zoho ────────────────────────────────────────────────────────────
router.get('/auth/zoho', (req, res) => {
  if (!ZOHO_CLIENT_ID) return res.status(500).send('ZOHO_CLIENT_ID env var not set');
  const { agentId = '' } = req.query;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     ZOHO_CLIENT_ID,
    scope:         ZOHO_SCOPES,
    redirect_uri:  ZOHO_REDIRECT_URI,
    access_type:   'offline',
    prompt:        'consent',
    state:         buildOAuthState(agentId),
  });
  res.redirect(`${ZOHO_AUTH_URL}?${params}`);
});

// ── GET /auth/zoho/callback ───────────────────────────────────────────────────
router.get('/auth/zoho/callback', async (req, res) => {
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

    const rawApiDomain = api_domain || 'https://www.zohoapis.com';
    const mailBase = rawApiDomain.replace('www.zohoapis', 'mail.zoho');
    const calBase  = rawApiDomain.replace('www.zohoapis', 'calendar.zoho');
    const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    console.log('[zoho/callback] api_domain from Zoho:', rawApiDomain);
    console.log('[zoho/callback] derived mailBase:', mailBase);

    const accountsUrl = `${mailBase}/api/accounts`;
    console.log('[zoho/callback] fetching accounts from:', accountsUrl);
    const accountsRes = await axios.get(accountsUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
    });
    console.log('[zoho/callback] accounts response status:', accountsRes.status);
    const accountData = accountsRes.data?.data?.[0];
    const accountId   = accountData?.accountId;
    const fromEmail   = accountData?.emailAddress?.find(e => e.isPrimary)?.mailId
                     || accountData?.emailAddress?.[0]?.mailId
                     || null;
    if (!accountId) console.warn('[zoho/callback] accountId came back null — accounts response:', JSON.stringify(accountsRes.data));
    console.log('[zoho/callback] fromEmail:', fromEmail);

    let calendarUid = null;
    try {
      const calsRes = await axios.get(`${calBase}/api/v1/calendars`, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
      });
      calendarUid = calsRes.data?.calendars?.[0]?.uid;
    } catch (calErr) {
      console.warn('[zoho/callback] calendar fetch skipped:', calErr.message);
    }

    const { error: upsertError } = await supabaseAdmin.from('zoho_tokens').upsert({
      id:           agentId,
      access_token,
      refresh_token,
      expires_at,
      account_id:   accountId,
      calendar_uid: calendarUid,
      api_domain:   mailBase,
      from_email:   fromEmail,
    }, { onConflict: 'id' });

    if (upsertError) throw new Error('Failed to save token: ' + upsertError.message);

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

module.exports = router;
