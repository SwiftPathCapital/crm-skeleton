import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

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

function dollar(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
  const [activeCalls,   setActiveCalls]   = useState([]);
  const [softphoneLogs, setSoftphoneLogs] = useState([]);
  const [logsLoading,   setLogsLoading]   = useState(false);
  const [stats,         setStats]         = useState(null);
  const [agentStats,    setAgentStats]    = useState([]);
  const [statsLoading,  setStatsLoading]  = useState(true);

  // ── Live call board ────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    async function poll() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`/api/active-calls`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
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

  // ── Softphone logs ─────────────────────────────────────────────────────────
  const loadSoftphoneLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await supabase.from("calls").select("*").order("created_at", { ascending: false }).limit(100);
      const logs = data || [];
      const paths = logs.filter(l => l.recording_path).map(l => l.recording_path);
      let urlMap = {};
      if (paths.length > 0) {
        const { data: urlsData } = await supabase.storage.from("call-recordings").createSignedUrls(paths, 3600);
        (urlsData || []).forEach(u => { urlMap[u.path] = u.signedUrl; });
      }
      setSoftphoneLogs(logs.map(l => ({ ...l, recording_url: urlMap[l.recording_path] || null })));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadSoftphoneLogs(); }, [loadSoftphoneLogs]);

  // ── Revenue & commission stats ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [
        { data: deals  },
        { data: offers },
        { data: agents },
      ] = await Promise.all([
        supabase.from("deals").select("id, stage, funded_amount, commission_amount, commission_rate, assigned_agent_id"),
        supabase.from("offers").select("id, deal_id, agent_id, amount, status"),
        supabase.from("agents").select("id, name, email"),
      ]);

      const allDeals   = deals  || [];
      const allOffers  = offers || [];
      const allAgents  = agents || [];

      const fundedDeals  = allDeals.filter(d => d.stage === "funded");
      const activeDeals  = allDeals.filter(d => d.stage !== "funded" && d.stage !== "declined");
      const totalRevenue     = fundedDeals.reduce((s, d) => s + (Number(d.funded_amount)     || 0), 0);
      const totalCommissions = fundedDeals.reduce((s, d) => s + (Number(d.commission_amount) || 0), 0);
      const totalOffersCount = allOffers.length;
      const totalOffersValue = allOffers.reduce((s, o) => s + (Number(o.amount) || 0), 0);

      setStats({ totalRevenue, totalCommissions, totalOffersCount, totalOffersValue, activeDeals: activeDeals.length, fundedDeals: fundedDeals.length });

      // Per-agent breakdown
      const map = {};
      allAgents.forEach(a => {
        map[a.id] = { id: a.id, name: a.name || a.email, deals: 0, funded: 0, fundedAmount: 0, commissions: 0, offersSent: 0, offersValue: 0 };
      });

      allDeals.forEach(d => {
        if (!d.assigned_agent_id) return;
        if (!map[d.assigned_agent_id]) return;
        map[d.assigned_agent_id].deals++;
        if (d.stage === "funded") {
          map[d.assigned_agent_id].funded++;
          map[d.assigned_agent_id].fundedAmount  += Number(d.funded_amount)     || 0;
          map[d.assigned_agent_id].commissions   += Number(d.commission_amount) || 0;
        }
      });

      allOffers.forEach(o => {
        if (!o.agent_id || !map[o.agent_id]) return;
        map[o.agent_id].offersSent++;
        map[o.agent_id].offersValue += Number(o.amount) || 0;
      });

      setAgentStats(
        Object.values(map)
          .filter(a => a.deals > 0 || a.offersSent > 0)
          .sort((a, b) => b.fundedAmount - a.fundedAmount)
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Active call display ────────────────────────────────────────────────────
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
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-[#4a5568] text-sm mt-1">Company performance, revenue, and agent tracking.</p>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="flex items-center gap-2 text-xs bg-[#1e2130] hover:bg-[#252b3d] text-[#8892a4] hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {statsLoading ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <StatCard
          label="Company Revenue"
          value={stats ? dollar(stats.totalRevenue) : "—"}
          sub={`${stats?.fundedDeals ?? 0} deal${stats?.fundedDeals !== 1 ? "s" : ""} funded`}
          color="emerald"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 8v1m-7-1a9 9 0 1118 0 9 9 0 01-18 0z" />}
        />
        <StatCard
          label="Total Commissions"
          value={stats ? dollar(stats.totalCommissions) : "—"}
          sub="Across all funded deals"
          color="gold"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />}
        />
        <StatCard
          label="Offers Sent"
          value={stats ? stats.totalOffersCount.toLocaleString() : "—"}
          sub={stats ? `Total value ${dollar(stats.totalOffersValue)}` : ""}
          color="blue"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
        />
        <StatCard
          label="Active Deals"
          value={stats ? stats.activeDeals.toLocaleString() : "—"}
          sub="In pipeline right now"
          color="purple"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />}
        />
      </div>

      {/* ── Agent performance table ── */}
      <div className="flex-shrink-0">
        <h2 className="text-white font-semibold text-lg mb-3">Agent Performance</h2>
        <div className="border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] border-b border-[#1e2130]">
                {["Agent", "Deals in Pipeline", "Deals Funded", "Amount Funded", "Commission Earned", "Offers Sent", "Offers Value"].map(h => (
                  <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center text-[#4a5568] text-sm py-8">Loading…</td>
                </tr>
              ) : agentStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[#4a5568] text-sm py-8">No deal or offer data yet.</td>
                </tr>
              ) : agentStats.map((a, i) => (
                <tr key={a.id} className={`border-b border-[#1e2130] last:border-0 hover:bg-[#111520] ${i % 2 ? "bg-[#0a0e14]" : ""}`}>
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{a.name}</td>
                  <td className="px-4 py-3 text-[#8892a4] tabular-nums">{a.deals}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={a.funded > 0 ? "text-emerald-400 font-semibold" : "text-[#4a5568]"}>{a.funded}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={a.fundedAmount > 0 ? "text-emerald-400 font-semibold" : "text-[#4a5568]"}>{dollar(a.fundedAmount)}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={a.commissions > 0 ? "text-[#c9a84c] font-semibold" : "text-[#4a5568]"}>{dollar(a.commissions)}</span>
                  </td>
                  <td className="px-4 py-3 text-[#8892a4] tabular-nums">{a.offersSent}</td>
                  <td className="px-4 py-3 text-[#8892a4] tabular-nums">{dollar(a.offersValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Live Call Board ── */}
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
                {["Agent", "Lead Phone", "Duration", "Status"].map(h => (
                  <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCalls.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-[#4a5568] text-sm py-8">No active calls</td></tr>
              ) : displayCalls.map(call => (
                <tr key={call.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#111520]">
                  <td className="px-4 py-3 text-white font-medium">{call.agent || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{call.leadPhone || "—"}</td>
                  <td className="px-4 py-3"><LiveTimer startTime={call.startTime} /></td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {call.state || "active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Softphone call logs ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Soft Phone Call Logs</h2>
            <p className="text-[#4a5568] text-xs mt-0.5">Calls placed via the WebRTC softphone by agents.</p>
          </div>
          <button
            onClick={loadSoftphoneLogs}
            disabled={logsLoading}
            className="flex items-center gap-2 text-xs bg-[#1e2130] hover:bg-[#252b3d] text-[#8892a4] hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {logsLoading ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {logsLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] border-b border-[#1e2130]">
                {["Date / Time", "Agent", "Phone", "Dir", "Duration", "Disposition", "Recording"].map(h => (
                  <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {softphoneLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[#4a5568] text-sm py-8">
                    {logsLoading ? "Loading…" : "No softphone call logs yet."}
                  </td>
                </tr>
              ) : softphoneLogs.map(log => (
                <tr key={log.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#111520]">
                  <td className="px-4 py-3 text-[#4a5568] text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                    <span className="text-[#2d3748]">
                      {new Date(log.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{log.agent_name || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{log.lead_phone || log.caller_phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.direction === "inbound" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-[#1e2130] text-[#8892a4]"}`}>
                      {log.direction === "inbound" ? "In" : "Out"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8892a4] font-mono">
                    {log.duration != null ? formatDuration(log.duration) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {log.disposition ? (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        log.disposition === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-[#1e2130] text-[#8892a4]"
                      }`}>
                        {log.disposition}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {log.recording_url ? (
                      <div className="flex items-center gap-2">
                        <audio controls preload="none" src={log.recording_url} className="h-8 max-w-[180px]" />
                        <a href={log.recording_url} download className="text-[#4a5568] hover:text-white transition-colors flex-shrink-0" title="Download">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      </div>
                    ) : (
                      <span className="text-[#4a5568] text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400", icon: "text-emerald-400" },
  gold:    { border: "border-[#c9a84c]/20",   bg: "bg-[#c9a84c]/5",   text: "text-[#c9a84c]",  icon: "text-[#c9a84c]" },
  blue:    { border: "border-blue-500/20",    bg: "bg-blue-500/5",    text: "text-blue-400",   icon: "text-blue-400" },
  purple:  { border: "border-purple-500/20",  bg: "bg-purple-500/5",  text: "text-purple-400", icon: "text-purple-400" },
};

function StatCard({ label, value, sub, color, icon }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`border ${c.border} ${c.bg} rounded-xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">{label}</p>
        <svg className={`w-5 h-5 ${c.icon} opacity-60`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <p className={`text-2xl font-bold ${c.text} tabular-nums`}>{value}</p>
      {sub && <p className="text-[#4a5568] text-xs mt-1">{sub}</p>}
    </div>
  );
}
