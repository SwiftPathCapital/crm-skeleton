const axios = require('axios');
const { supabaseAdmin } = require('./db');

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_TOKEN_URL     = 'https://accounts.zoho.com/oauth/v2/token';

// In-memory folder ID cache: agentId → { inbox, sent, updatedAt }
const folderIdCache = new Map();

async function getZohoFolderIds(agentId, accessToken, accountId, apiDomain) {
  const cached = folderIdCache.get(agentId);
  if (cached && Date.now() - cached.updatedAt < 3_600_000) return cached;

  const foldersRes = await axios.get(`${apiDomain}/api/accounts/${accountId}/folders`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const folders = foldersRes.data?.data || [];
  console.log('[zoho/folders] available folders:', folders.map(f => `${f.folderName}(type:${f.folderType},id:${f.folderId})`).join(', '));
  const ids = {
    inbox:     (folders.find(f => (f.folderType || '').toLowerCase() === 'inbox'))?.folderId || null,
    sent:      (folders.find(f => (f.folderType || '').toLowerCase() === 'sent'))?.folderId  || null,
    updatedAt: Date.now(),
  };
  folderIdCache.set(agentId, ids);
  return ids;
}

async function getZohoToken(agentId) {
  console.log('[getZohoToken] looking up agentId:', agentId, '(type:', typeof agentId, ')');

  const { data: row, error } = await supabaseAdmin
    .from('zoho_tokens')
    .select('access_token, refresh_token, expires_at, account_id, calendar_uid, api_domain, from_email')
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

  const expiresMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
  const needsRefresh = expiresMs && Date.now() > expiresMs - 300_000;
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
    const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
    await supabaseAdmin.from('zoho_tokens').update({ access_token, expires_at }).eq('id', agentId);
    row.access_token = access_token;
    row.expires_at   = expires_at;
  }

  const apiDomain = row.api_domain || 'https://mail.zoho.com';
  return {
    accessToken:  row.access_token,
    accountId:    row.account_id,
    calendarUid:  row.calendar_uid,
    fromEmail:    row.from_email,
    apiDomain,
    calendarBase: apiDomain.replace('mail.', 'calendar.'),
  };
}

module.exports = { getZohoToken, getZohoFolderIds };
