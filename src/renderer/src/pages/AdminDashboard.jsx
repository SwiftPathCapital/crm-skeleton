import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const SERVER = "http://localhost:3001";

const SIP_AGENT_MAP = {
  Glenn2800: "Glenn",
  Brent2800: "Brent",
  Jordan2800: "Jordan",
};

function parseSipAgent(to = "") {
  const m = to.match(/sip:([^@]+)@/i);
  if (m) return SIP_AGENT_MAP[m[1]] || m[1];
  return null;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function LiveTimer({ startTime }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const origin = startTime ? new Date(startTime).getTime() : Date.now();
    const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span className="font-mono text-emerald-400">{formatDuration(secs)}</span>;
}

export default function AdminDashboard() {
  const [activeCalls, setActiveCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  // Poll active calls every 5 seconds
  useEffect(() => {
    let live = true;
    async function poll() {
      try {
        const r = await fetch(`${SERVER}/api/active-calls`);
        if (r.ok && live) {
          const json = await r.json();
          setActiveCalls(json.data || []);
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCallHistory(data);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function syncRecordings() {
    setSyncing(true);
    try {
      const r = await fetch(`${SERVER}/api/recordings`);
      if (!r.ok) return;
      const { data: recs } = await r.json();
      for (const rec of recs || []) {
        await supabase.from("calls").upsert({
          telnyx_recording_id: rec.id,
          agent_id: null,
          lead_phone: null,
          duration: Math.round((rec.duration_millis || 0) / 1000),
          disposition: "completed",
          recording_url: rec.download_urls?.mp3 || null,
          created_at: rec.created_at,
        }, { onConflict: "telnyx_recording_id" });
      }
      await loadHistory();
    } finally {
      setSyncing(false);
    }
  }

  function handlePlay(id, url) {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
        setPlayingId(id);
      }
    }
  }

  // Group legs by session so each call = one row
  const displayCalls = (() => {
    const map = {};
    for (const call of activeCalls) {
      const sid = call.call_session_id || call.call_leg_id;
      if (!map[sid]) map[sid] = { id: sid, agent: null, leadPhone: null, startTime: null, state: null };
      const entry = map[sid];
      if (call.direction === "inbound") {
        entry.leadPhone = call.from;
        entry.startTime = entry.startTime || call.start_time;
        entry.state = entry.state || call.state;
      }
      const agent = parseSipAgent(call.to || "");
      if (agent) { entry.agent = agent; entry.state = call.state; }
      if (!entry.state) entry.state = call.state;
    }
    return Object.values(map);
  })();

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-[#4a5568] text-sm mt-1">
          Agent management, lead assignment, DID provisioning, and performance tracking.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "Agent Management", desc: "Add agents, create logins, assign DIDs", phase: "Phase 3", icon: "👤", color: "border-blue-500/30 bg-blue-500/5" },
          { title: "Lead Assignment", desc: "Assign leads to agents from the admin panel", phase: "Phase 3", icon: "📋", color: "border-indigo-500/30 bg-indigo-500/5" },
          { title: "DID Provisioning", desc: "No-code Twilio DID purchase and assignment", phase: "Phase 6", icon: "📞", color: "border-cyan-500/30 bg-cyan-500/5" },
          { title: "Whisper & Barge", desc: "Live call monitoring, whisper, and barge", phase: "Phase 6", icon: "🎧", color: "border-purple-500/30 bg-purple-500/5" },
          { title: "Performance Dashboard", desc: "Dials, apps sent, apps signed, funded", phase: "Phase 6", icon: "📊", color: "border-emerald-500/30 bg-emerald-500/5" },
          { title: "Commission Tracking", desc: "Track wins and agent commissions", phase: "Phase 6", icon: "💰", color: "border-yellow-500/30 bg-yellow-500/5" },
        ].map((item) => (
          <div key={item.title} className={`border rounded-xl p-5 ${item.color}`}>
            <div className="text-2xl mb-3">{item.icon}</div>
            <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
            <p className="text-[#4a5568] text-xs mb-3">{item.desc}</p>
            <span className="text-xs text-[#4a5568] bg-[#1e2130] px-2 py-1 rounded">{item.phase}</span>
          </div>
        ))}
      </div>

      {/* Live Call Board */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-semibold text-lg">Live Call Board</h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            LIVE · 5s
          </span>
        </div>
        <div className="border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] border-b border-[#1e2130]">
                {["Agent", "Lead Phone", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCalls.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[#4a5568] text-sm py-8">
                    No active calls
                  </td>
                </tr>
              ) : (
                displayCalls.map((call) => (
                  <tr key={call.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#111520]">
                    <td className="px-4 py-3 text-white font-medium">{call.agent || "—"}</td>
                    <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{call.leadPhone || "—"}</td>
                    <td className="px-4 py-3">
                      <LiveTimer startTime={call.startTime} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {call.state || "active"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Call History</h2>
          <button
            onClick={syncRecordings}
            disabled={syncing}
            className="flex items-center gap-2 text-xs bg-[#1e2130] hover:bg-[#252b3d] text-[#8892a4] hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncing ? "Syncing…" : "Sync Recordings"}
          </button>
        </div>
        <div className="border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] border-b border-[#1e2130]">
                {["Date", "Agent", "Lead Phone", "Duration", "Disposition", "Recording"].map((h) => (
                  <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {callHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[#4a5568] text-sm py-8">
                    No call history. Click "Sync Recordings" to import from Telnyx.
                  </td>
                </tr>
              ) : (
                callHistory.map((call) => (
                  <tr key={call.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#111520]">
                    <td className="px-4 py-3 text-[#4a5568] text-xs">
                      {new Date(call.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{call.agent_id || "—"}</td>
                    <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{call.lead_phone || "—"}</td>
                    <td className="px-4 py-3 text-[#8892a4] font-mono">
                      {call.duration != null ? formatDuration(call.duration) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {call.disposition ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#1e2130] text-[#8892a4]">
                          {call.disposition}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {call.recording_url ? (
                        <button
                          onClick={() => handlePlay(call.id, call.recording_url)}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[9px]">
                            {playingId === call.id ? "■" : "▶"}
                          </span>
                          {playingId === call.id ? "Stop" : "Play"}
                        </button>
                      ) : (
                        <span className="text-[#4a5568] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  );
}
