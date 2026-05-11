const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fromNumber = process.env.TELNYX_PHONE_NUMBER;
const API_KEY = process.env.TELNYX_API_KEY;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { transport: ws } }
);

const SIP_AGENT_MAP = { Glenn2800: 'Glenn', Brent2800: 'Brent', Jordan2800: 'Jordan' };
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
    '<Response>' +
      '<Dial timeout="30">' +
        '<Sip>sip:Glenn2800@sip.telnyx.com</Sip>' +
        '<Sip>sip:Brent2800@sip.telnyx.com</Sip>' +
        '<Sip>sip:Jordan2800@sip.telnyx.com</Sip>' +
      '</Dial>' +
    '</Response>'
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

    if (payload.direction === 'outbound') {
      // Outbound leg to a SIP agent — extract the username and update the row
      const sipMatch = (payload.to || '').match(/sip:([^@]+)@/i);
      if (sipMatch) {
        const agentId = SIP_AGENT_MAP[sipMatch[1]] || sipMatch[1];
        await supabase.from('calls')
          .update({ agent_id: agentId })
          .eq('call_session_id', sessionId);
      }
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('TELNYX_API_KEY:', API_KEY ? `set (${API_KEY.slice(0, 8)}...)` : 'MISSING');
});