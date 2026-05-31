const express = require('express');
const axios   = require('axios');
const { supabase, supabaseAdmin } = require('../db');
const { getZohoToken } = require('../lib/zoho');

const router = express.Router();

// ── POST /api/application-requests/:id/reject ─────────────────────────────────
router.post('/api/application-requests/:id/reject', async (req, res) => {
  const { data: me } = await supabase.from('agents').select('role').eq('id', req.userId).single();
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { note = '' } = req.body;
  const { error } = await supabaseAdmin.from('application_requests').update({
    status: 'rejected', reviewed_by: req.userId,
    reviewed_at: new Date().toISOString(), rejection_note: note || null,
  }).eq('id', req.params.id).eq('status', 'pending');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── POST /api/send-application ────────────────────────────────────────────────
router.post('/api/send-application', async (req, res) => {
  const {
    businessName, dba, businessAddress, businessStartDate, ein,
    ownerName, ownerSS, ownerDOB, ownerAddress, printName,
    clientEmail, phone,
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
      ${(clientEmail || phone) ? `<div class="sec">
        <div class="sec-title">Contact Info</div>
        ${clientEmail ? `<div class="row"><span class="lbl">Client Email</span><span class="val">${clientEmail}</span></div>` : ''}
        ${phone       ? `<div class="row"><span class="lbl">Phone</span><span class="val">${phone}</span></div>` : ''}
      </div>` : ''}
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
        toAddress:  'submissions@swiftpathtocapital.com',
        subject:    `New MCA Application — ${v(businessName)}`,
        content:    html,
        mailFormat: 'html',
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

module.exports = router;
