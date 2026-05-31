const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const { supabase, supabaseAdmin } = require('../db');

const router    = express.Router();
const API_KEY   = process.env.TELNYX_API_KEY;
const fromNumber = process.env.TELNYX_PHONE_NUMBER;

// ── Telnyx webhook signature verification ────────────────────────────────────
function verifyTelnyxSignature(req, res, next) {
  const sigHeader   = req.headers['x-telnyx-signature-ed25519'];
  const timestamp   = req.headers['x-telnyx-timestamp'];
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

router.get('/health', (req, res) => {
  res.json({ status: 'ok', number: fromNumber });
});

router.post('/voice', (req, res) => {
  res.type('text/xml');
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Response><Hangup/></Response>'
  );
});

router.post('/sms', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.telnyx.com/v2/messages',
      { to: req.body.to, from: fromNumber, text: req.body.text },
      { headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json' } }
    );
    res.json({ id: response.data.data.id });
  } catch (err) {
    res.status(500).json({ error: err.response && err.response.data || err.message });
  }
});

router.get('/api/active-calls', async (req, res) => {
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

router.get('/api/recordings', async (req, res) => {
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
            to:   d.to   || rec.to   || null,
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

router.get('/api/lead-recordings', async (req, res) => {
  try {
    const phone = (req.query.phone || '').replace(/\D/g, '').slice(-10);
    if (phone.length < 7) return res.json([]);

    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('dialer_calls')
      .select('id, direction, from_number, to_number, recording_url, disposition, notes, started_at, ended_at, duration_seconds')
      .not('recording_url', 'is', null)
      .lt('started_at', cutoff)
      .or(`from_number.ilike.%${phone},to_number.ilike.%${phone}`)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[lead-recordings]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook/telnyx', verifyTelnyxSignature, async (req, res) => {
  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload   = req.body?.data?.payload;
  if (!eventType || !payload) return;

  // ── Inbound SMS ─────────────────────────────────────────────────────────────
  if (eventType === 'message.received') {
    const from       = payload.from?.phone_number || payload.from || null;
    const text       = payload.text || '';
    const receivedAt = payload.received_at || new Date().toISOString();
    if (!from || !text) return;

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
        body:            text,
        direction:       'inbound',
        sent_at:         receivedAt,
      });
    }
    return;
  }

  // ── Call events ─────────────────────────────────────────────────────────────
  const sessionId = payload.call_session_id;
  if (!sessionId) return;

  if (eventType === 'call.hangup') {
    if (payload.direction === 'inbound') {
      await supabaseAdmin.from('calls').upsert({
        call_session_id: sessionId,
        lead_phone:      payload.from || null,
        disposition:     'completed',
        created_at:      payload.start_time || new Date().toISOString(),
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

    const { data: existing } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('call_session_id', sessionId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('calls')
        .update({ recording_url: recordingUrl, duration })
        .eq('call_session_id', sessionId);
    } else {
      await supabaseAdmin.from('calls').upsert({
        call_session_id: sessionId,
        recording_url:   recordingUrl,
        duration,
        disposition:     'completed',
        created_at:      payload.recording_started_at || new Date().toISOString(),
      }, { onConflict: 'call_session_id' });
    }
  }
});

module.exports = router;
