const express = require('express');
const axios   = require('axios');
const { supabase, supabaseAdmin } = require('./db');

const router = express.Router();

function dsHeaders() {
  return {
    'X-Auth-Token':  process.env.DOCUSEAL_API_KEY,
    'Content-Type':  'application/json',
  };
}

// ── POST /api/docuseal/send ───────────────────────────────────────────────────
router.post('/api/docuseal/send', async (req, res) => {
  const {
    clientEmail, contactName, businessName, dealId, leadId,
    dba, businessAddress, businessStartDate, ein,
    ownerSSN, ownerDOB, ownerAddress, phone,
  } = req.body;
  if (!clientEmail) return res.status(400).json({ error: 'clientEmail is required' });

  const baseUrl    = (process.env.DOCUSEAL_URL || '').replace(/\/$/, '');
  const apiKey     = process.env.DOCUSEAL_API_KEY;
  const templateId = process.env.DOCUSEAL_TEMPLATE_ID;

  if (!baseUrl || !apiKey || !templateId) {
    return res.status(500).json({
      error: 'DocuSeal not configured — set DOCUSEAL_URL, DOCUSEAL_API_KEY, and DOCUSEAL_TEMPLATE_ID in Railway env vars',
    });
  }

  try {
    const fields = [];
    if (businessName)      fields.push({ name: 'Business Name',       default_value: businessName });
    if (dba)               fields.push({ name: 'DBA',                 default_value: dba });
    if (businessAddress)   fields.push({ name: 'Business Address',    default_value: businessAddress });
    if (businessStartDate) fields.push({ name: 'Business Start Date', default_value: businessStartDate });
    if (ein)               fields.push({ name: 'EIN',                 default_value: ein });
    if (contactName)       fields.push({ name: 'Owner Name',          default_value: contactName });
    if (ownerSSN)          fields.push({ name: 'Owner SSN',           default_value: ownerSSN });
    if (ownerDOB)          fields.push({ name: 'Owner DOB',           default_value: ownerDOB });
    if (ownerAddress)      fields.push({ name: 'Owner Address',       default_value: ownerAddress });
    if (phone)             fields.push({ name: 'Phone',               default_value: phone });

    const dsRes = await axios.post(
      `${baseUrl}/api/submissions`,
      {
        template_id: parseInt(templateId, 10),
        send_email:  true,
        submitters: [{
          role:   'First Party',
          email:  clientEmail,
          name:   contactName || clientEmail,
          ...(fields.length ? { fields } : {}),
        }],
      },
      { headers: dsHeaders() }
    );

    // DocuSeal returns an array of submitter objects
    const submitters   = Array.isArray(dsRes.data) ? dsRes.data : [dsRes.data];
    const submitter    = submitters[0] || {};
    const submissionId = String(submitter.submission_id || submitter.id || '');
    const slug         = submitter.slug || '';
    const signingUrl   = slug ? `${baseUrl}/s/${slug}` : null;

    const { data: row, error: dbErr } = await supabase
      .from('docuseal_submissions')
      .insert({
        submission_id: submissionId,
        signing_url:   signingUrl,
        status:        'sent',
        deal_id:       dealId  || null,
        lead_id:       leadId  || null,
        agent_id:      req.userId,
        client_email:  clientEmail,
        contact_name:  contactName  || null,
        business_name: businessName || null,
      })
      .select()
      .single();

    if (dbErr) console.error('[docuseal] db insert error:', dbErr.message);

    console.log(`[docuseal] sent to ${clientEmail} — submission ${submissionId}`);
    res.json({ success: true, submissionId, signingUrl, id: row?.id });
  } catch (err) {
    const detail = err.response?.data?.error || err.response?.data || err.message;
    console.error('[docuseal/send]', detail);
    res.status(err.response?.status || 500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

// ── POST /webhook/docuseal — no auth, called by DocuSeal ─────────────────────
router.post('/webhook/docuseal', async (req, res) => {
  try {
    const { event_type, data } = req.body || {};

    if (event_type === 'submission.completed' || event_type === 'form.completed') {
      const submissionId = String(
        data?.submission?.id ||
        data?.submitter?.submission_id ||
        ''
      );
      if (submissionId) {
        await supabaseAdmin
          .from('docuseal_submissions')
          .update({ status: 'completed' })
          .eq('submission_id', submissionId);
        console.log(`[docuseal webhook] submission ${submissionId} marked completed`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[docuseal webhook]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
