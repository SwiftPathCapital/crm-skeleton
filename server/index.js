const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fromNumber = process.env.TELNYX_PHONE_NUMBER;
const API_KEY = process.env.TELNYX_API_KEY;
const CONNECTION_ID = '2950311615590827625';
const AGENT_NUMBER  = '+15164071132';

let agentCallControlId = null;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', number: fromNumber });
});

app.post('/call', async (req, res) => {
  const to = req.body.to ? (req.body.to.startsWith('+') ? req.body.to : '+' + req.body.to) : '+17868091508';
  console.log('Call attempt to:', to, '| existing agent leg:', agentCallControlId || 'none');

  const headers = {
    Authorization: 'Bearer ' + API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    let leadId;
    let agentId = agentCallControlId;

    if (!agentId) {
      // No active agent leg — call both simultaneously then bridge
      const [leadCall, agentCall] = await Promise.all([
        axios.post('https://api.telnyx.com/v2/calls', { connection_id: CONNECTION_ID, to, from: fromNumber }, { headers }),
        axios.post('https://api.telnyx.com/v2/calls', { connection_id: CONNECTION_ID, to: AGENT_NUMBER, from: fromNumber }, { headers })
      ]);
      leadId  = leadCall.data.data.call_control_id;
      agentId = agentCall.data.data.call_control_id;
      agentCallControlId = agentId;
      console.log('Agent leg created:', agentId);
    } else {
      // Agent already on the line — call lead only
      const leadCall = await axios.post(
        'https://api.telnyx.com/v2/calls',
        { connection_id: CONNECTION_ID, to, from: fromNumber },
        { headers }
      );
      leadId = leadCall.data.data.call_control_id;
    }

    // Bridge lead into the agent call
    await axios.post(
      `https://api.telnyx.com/v2/calls/${leadId}/actions/bridge`,
      { call_control_id: agentId },
      { headers }
    );

    res.json({ success: true, lead_call_id: leadId, agent_call_id: agentId });
  } catch (err) {
    console.error('Telnyx error:', err.response && err.response.data || err.message);
    res.status(500).json({ error: err.response && err.response.data || err.message });
  }
});

app.post('/agent-hangup', (req, res) => {
  agentCallControlId = null;
  console.log('Agent call cleared');
  res.json({ success: true });
});

app.post('/voice', (req, res) => {
  res.type('text/xml');
  res.send('<Response><Dial></Dial></Response>');
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});