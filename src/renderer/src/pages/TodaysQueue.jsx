import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtRelative(iso) {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function leadName(l) {
  if (!l) return "Unknown";
  return l.company_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || l.phone || "Unknown";
}

function Section({ title, count, accent, children }) {
  const chipCls = {
    red:    "bg-red-500/15 text-red-400",
    yellow: "bg-yellow-500/15 text-yellow-400",
    gray:   "bg-[#1e2130] text-[#8892a4]",
  }[accent] ?? "bg-[#1e2130] text-[#8892a4]";
  const titleCls = { red: "text-red-400", yellow: "text-yellow-400", gray: "text-[#8892a4]" }[accent] ?? "text-[#8892a4]";
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className={`text-xs font-bold uppercase tracking-widest ${titleCls}`}>{title}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chipCls}`}>{count}</span>
        <div className="flex-1 h-px bg-[#1e2130]" />
      </div>
      {children}
    </div>
  );
}

export default function TodaysQueue({ onViewLead }) {
  const { userId, agent } = useApp();
  const isAdmin = agent?.role === "admin";

  const [overdue,  setOverdue]  = useState([]);
  const [today,    setToday]    = useState([]);
  const [stale,    setStale]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [agents,   setAgents]   = useState([]);
  const [saving,   setSaving]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const sevenAgo   = new Date(now.getTime() - 7 * 86400000).toISOString();

    const TERMINAL = ["DNC", "Not Interested", "Deal Funded"];

    let overdueQ = supabase
      .from("callbacks")
      .select("id, scheduled_at, notes, agent_id, lead_id, leads(id, first_name, last_name, company_name, phone, status)")
      .eq("completed", false)
      .lt("scheduled_at", todayStart)
      .order("scheduled_at");

    let todayQ = supabase
      .from("callbacks")
      .select("id, scheduled_at, notes, agent_id, lead_id, leads(id, first_name, last_name, company_name, phone, status)")
      .eq("completed", false)
      .gte("scheduled_at", todayStart)
      .lt("scheduled_at", todayEnd)
      .order("scheduled_at");

    let staleQ = supabase
      .from("leads")
      .select("id, first_name, last_name, company_name, phone, status, last_contacted, created_at, assigned_to")
      .not("status", "in", `(${TERMINAL.map(s => `"${s}"`).join(",")})`)
      .lt("created_at", sevenAgo)
      .or(`last_contacted.is.null,last_contacted.lt.${sevenAgo}`)
      .order("last_contacted", { ascending: true, nullsFirst: true })
      .limit(50);

    if (!isAdmin) {
      overdueQ = overdueQ.eq("agent_id", userId);
      todayQ   = todayQ.eq("agent_id", userId);
      staleQ   = staleQ.eq("assigned_to", userId);
    }

    const [o, t, s] = await Promise.all([overdueQ, todayQ, staleQ]);
    setOverdue(o.data || []);
    setToday(t.data || []);
    setStale(s.data || []);
    setLoading(false);
  }, [userId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("agents").select("id, name").then(({ data }) => setAgents(data || []));
  }, [isAdmin]);

  const agentName = (id) => agents.find(a => a.id === id)?.name || "—";

  async function markDone(cbId) {
    setSaving(cbId);
    await supabase.from("callbacks").update({ completed: true }).eq("id", cbId);
    setSaving(null);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalAction = overdue.length + today.length;

  function CallbackRow({ cb, borderCls, dotCls, timeCls }) {
    return (
      <div className={`flex items-center gap-4 bg-[#0f1117] border ${borderCls} rounded-xl px-5 py-4 transition-colors`}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{leadName(cb.leads)}</p>
          <p className="text-[#4a5568] text-xs">{cb.leads?.phone || "—"}</p>
          {cb.notes && <p className="text-[#8892a4] text-xs italic mt-0.5 truncate">"{cb.notes}"</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-medium ${timeCls}`}>{fmtTime(cb.scheduled_at)}</p>
          {isAdmin && <p className="text-[#4a5568] text-xs mt-0.5">{agentName(cb.agent_id)}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {cb.leads?.id && (
            <button
              onClick={() => onViewLead(cb.leads.id)}
              className="text-xs px-3 py-1.5 bg-[#1e2d4a] hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg transition-colors font-medium"
            >
              View Lead
            </button>
          )}
          <button
            onClick={() => markDone(cb.id)}
            disabled={saving === cb.id}
            className="text-xs px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {saving === cb.id ? "…" : "Done"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Today's Queue</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            {totalAction > 0
              ? `${totalAction} item${totalAction !== 1 ? "s" : ""} need your attention`
              : stale.length > 0
              ? `All caught up on callbacks — ${stale.length} stale lead${stale.length !== 1 ? "s" : ""} waiting`
              : "You're all caught up"}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] border border-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Overdue Callbacks */}
      <Section title="Overdue Callbacks" count={overdue.length} accent="red">
        {overdue.length === 0 ? (
          <div className="flex items-center gap-3 py-5 px-5 bg-[#0f1117] border border-[#1e2130] rounded-xl">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-[#4a5568] text-sm">No overdue callbacks.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overdue.map(cb => (
              <CallbackRow key={cb.id} cb={cb}
                borderCls="border-red-500/30 hover:border-red-500/50"
                dotCls="bg-red-500 animate-pulse"
                timeCls="text-red-400"
              />
            ))}
          </div>
        )}
      </Section>

      {/* Due Today */}
      <Section title="Due Today" count={today.length} accent="yellow">
        {today.length === 0 ? (
          <div className="flex items-center gap-3 py-5 px-5 bg-[#0f1117] border border-[#1e2130] rounded-xl">
            <p className="text-[#4a5568] text-sm">No callbacks scheduled for today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {today.map(cb => (
              <CallbackRow key={cb.id} cb={cb}
                borderCls="border-[#c9a84c]/20 hover:border-[#c9a84c]/40"
                dotCls="bg-[#c9a84c]"
                timeCls="text-[#c9a84c]"
              />
            ))}
          </div>
        )}
      </Section>

      {/* Stale Leads */}
      <Section title="Stale Leads — No contact in 7+ days" count={stale.length} accent="gray">
        {stale.length === 0 ? (
          <div className="flex items-center gap-3 py-5 px-5 bg-[#0f1117] border border-[#1e2130] rounded-xl">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-[#4a5568] text-sm">No stale leads. Great work!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stale.map(lead => {
              const daysSince = lead.last_contacted
                ? Math.floor((Date.now() - new Date(lead.last_contacted).getTime()) / 86400000)
                : null;
              const dotColor = daysSince === null ? "bg-red-500"
                : daysSince > 14 ? "bg-orange-500"
                : "bg-yellow-500";
              return (
                <div key={lead.id} className="flex items-center gap-4 bg-[#0f1117] border border-[#1e2130] hover:border-[#2a3040] rounded-xl px-5 py-4 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{leadName(lead)}</p>
                    <p className="text-[#4a5568] text-xs">{lead.phone || "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[#4a5568] text-[10px] uppercase tracking-wider">Last Contact</p>
                    <p className={`text-sm font-medium ${daysSince === null ? "text-red-400" : "text-[#8892a4]"}`}>
                      {fmtRelative(lead.last_contacted)}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#1e2130] text-[#8892a4] shrink-0">{lead.status}</span>
                  <button
                    onClick={() => onViewLead(lead.id)}
                    className="text-xs px-3 py-1.5 bg-[#1e2d4a] hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg transition-colors font-medium shrink-0"
                  >
                    View Lead
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
