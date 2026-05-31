const express  = require('express');
const axios    = require('axios');
const multer   = require('multer');
const FormData = require('form-data');
const { supabase, supabaseAdmin } = require('../db');
const { getZohoToken, getZohoFolderIds } = require('../lib/zoho');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = express.Router();

// ── GET /api/emails/inbox ─────────────────────────────────────────────────────
router.get('/api/emails/inbox', async (req, res) => {
  const { limit = 50, start = 0 } = req.query;
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    let params = { folderPath: 'Inbox', limit: Number(limit), start: Number(start) };
    try {
      const ids = await getZohoFolderIds(req.userId, accessToken, accountId, apiDomain);
      if (ids.inbox) params = { folderId: ids.inbox, limit: Number(limit), start: Number(start) };
    } catch (fe) { console.warn('[emails/inbox] folder lookup skipped:', fe.message); }
    const response = await axios.get(`${apiDomain}/api/accounts/${accountId}/messages/view`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      params,
    });
    res.json(response.data);
  } catch (err) {
    console.error('[emails/inbox]', err.response?.data || err.message);
    res.status(err.response?.status || err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── GET /api/emails/sent ──────────────────────────────────────────────────────
router.get('/api/emails/sent', async (req, res) => {
  const { limit = 50, start = 0 } = req.query;
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    let params = { folderPath: 'Sent', limit: Number(limit), start: Number(start) };
    try {
      const ids = await getZohoFolderIds(req.userId, accessToken, accountId, apiDomain);
      if (ids.sent) params = { folderId: ids.sent, limit: Number(limit), start: Number(start) };
    } catch (fe) { console.warn('[emails/sent] folder lookup skipped:', fe.message); }
    const response = await axios.get(`${apiDomain}/api/accounts/${accountId}/messages/view`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      params,
    });
    res.json(response.data);
  } catch (err) {
    console.error('[emails/sent]', err.response?.data || err.message);
    res.status(err.response?.status || err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── GET /api/emails/folders ───────────────────────────────────────────────────
router.get('/api/emails/folders', async (req, res) => {
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    const foldersRes = await axios.get(`${apiDomain}/api/accounts/${accountId}/folders`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    res.json(foldersRes.data);
  } catch (err) {
    console.error('[emails/folders]', err.response?.data || err.message);
    res.status(err.response?.status || err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── POST /api/emails/send ─────────────────────────────────────────────────────
router.post('/api/emails/send', upload.array('attachments', 10), async (req, res) => {
  const { to, cc, bcc, subject, body, leadId } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ error: 'to and subject are required' });
  }
  try {
    const [{ accessToken, accountId, apiDomain, fromEmail }, { data: agentRow }] = await Promise.all([
      getZohoToken(req.userId),
      supabase.from('agents').select('email').eq('id', req.userId).single(),
    ]);

    const attachmentPaths = [];
    for (const file of (req.files || [])) {
      const fd = new FormData();
      fd.append('attach', file.buffer, { filename: file.originalname, contentType: file.mimetype });
      const uploadRes = await axios.post(
        `${apiDomain}/api/accounts/${accountId}/messages/attachments`,
        fd,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, ...fd.getHeaders() } }
      );
      const attachPath = uploadRes.data?.data?.attachmentPath;
      if (attachPath) attachmentPaths.push({ attachmentPath: attachPath });
    }

    const payload = {
      fromAddress: fromEmail || agentRow?.email,
      toAddress:   to,
      ccAddress:   cc  || '',
      bccAddress:  bcc || '',
      subject,
      content:     body || '',
      mailFormat:  'html',
    };
    if (attachmentPaths.length) payload.attachments = attachmentPaths;

    const sendRes = await axios.post(
      `${apiDomain}/api/accounts/${accountId}/messages`,
      payload,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    const zohoMessageId = sendRes.data?.data?.messageId;
    await supabaseAdmin.from('emails').insert({
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
    res.status(err.response?.status || err.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── GET /api/emails/:messageId ────────────────────────────────────────────────
router.get('/api/emails/:messageId', async (req, res) => {
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    const msgRes = await axios.get(
      `${apiDomain}/api/accounts/${accountId}/messages/${req.params.messageId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    res.json(msgRes.data);
  } catch (err) {
    console.error('[emails/:id]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

// ── GET /api/emails/:messageId/attachment/:attachmentId ───────────────────────
router.get('/api/emails/:messageId/attachment/:attachmentId', async (req, res) => {
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    const attRes = await axios.get(
      `${apiDomain}/api/accounts/${accountId}/messages/${req.params.messageId}/attachments/${req.params.attachmentId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }, responseType: 'stream' }
    );
    res.setHeader('Content-Type', attRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', attRes.headers['content-disposition'] || 'attachment');
    attRes.data.pipe(res);
  } catch (err) {
    console.error('[emails/attachment]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ── DELETE /api/emails/:messageId ─────────────────────────────────────────────
router.delete('/api/emails/:messageId', async (req, res) => {
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    await axios.delete(
      `${apiDomain}/api/accounts/${accountId}/messages/${req.params.messageId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[emails/delete]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// ── PATCH /api/emails/:messageId/unread ───────────────────────────────────────
router.patch('/api/emails/:messageId/unread', async (req, res) => {
  try {
    const { accessToken, accountId, apiDomain } = await getZohoToken(req.userId);
    await axios.put(
      `${apiDomain}/api/accounts/${accountId}/updatemessage`,
      { mode: 'markAsUnread', messageId: [req.params.messageId] },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[emails/unread]', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

module.exports = router;
