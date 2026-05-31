const express = require('express');
const axios   = require('axios');
const { supabaseAdmin } = require('./db');

const router = express.Router();

// ── POST /api/agents/create ───────────────────────────────────────────────────
router.post('/api/agents/create', async (req, res) => {
  try {
    const { name, email, password, role, did, sip_username, sip_password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password are required' });

    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (!serviceKey) return res.status(500).json({ error: 'Service role key not configured' });

    const authRes = await axios.post(
      `${supabaseUrl}/auth/v1/admin/users`,
      { email, password, email_confirm: true },
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const newUser = authRes.data;

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .insert({ id: newUser.id, name, email, role: role || 'agent', did: did || null, sip_username: sip_username || null, sip_password: sip_password || null })
      .select()
      .single();

    if (agentError) {
      await axios.delete(`${supabaseUrl}/auth/v1/admin/users/${newUser.id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      }).catch(() => {});
      return res.status(500).json({ error: agentError.message });
    }

    res.json(agent);
  } catch (err) {
    const msg = err.response?.data?.msg || err.response?.data?.message || err.message;
    res.status(err.response?.status || 500).json({ error: msg });
  }
});

// ── PATCH /api/agents/:id/password ───────────────────────────────────────────
router.patch('/api/agents/:id/password', async (req, res) => {
  try {
    const { id }       = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;

    await axios.put(
      `${supabaseUrl}/auth/v1/admin/users/${id}`,
      { password },
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── DELETE /api/agents/:id ────────────────────────────────────────────────────
router.delete('/api/agents/:id', async (req, res) => {
  try {
    const { id }      = req.params;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;

    await supabaseAdmin.from('agents').delete().eq('id', id);

    await axios.delete(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
