import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function isPast(iso) {
  return iso && new Date(iso) < new Date();
}

export default function CallbacksPage({ onNavigateLeads }) {
  const { agent, userId } = useApp();
  const isAdmin = agent?.role === "admin";

  const [callbacks, setCallbacks] = useState([]);
  const [agents,    setAgents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("upcoming"); // upcoming | past | all
  const [saving,    setSaving]    = useState(null); // id being saved

  // Schedule modal state
  const [schedModal, setSchedModal] = useState(false);
  const [schedForm,  setSchedForm]  = useState({ scheduled_at: "", notes: "" });
  const [schedSaving, setSchedSaving] = useState(false);

  const fetchCallbacks = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("callbacks")
      .select("*, leads(id, first_name, last_name, company_name, phone)")
      .order("scheduled_at", { ascending: true });

    if (!isAdmin) q = q.eq("agent_id", userId);

    const { data } = await q;
    setCallbacks(data || []);
    setLoading(false);
  }, [isAdmin, userId]);

  useEffect(() => { fetchCallbacks(); }, [fetchCallbacks]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("agents").select("id, name").then(({ data }) => setAgents(data || []));
  }, [isAdmin]);

  const agentName = (id) => agents.find(a => a.id === id)?.name ?? "—";

  async function markDone(cb) {
    setSaving(cb.id);
    await supabase.from("callbacks").update({ completed: true }).eq("id", cb.id);
    setCallbacks(prev => prev.map(c => c.id === cb.id ? { ...c, completed: true } : c));
    setSaving(null);
  }

  async function markPending(cb) {
    setSaving(cb.id);
    await supabase.from("callbacks").update({ completed: false }).eq("id", cb.id);
    setCallbacks(prev => prev.map(c => c.id === cb.id ? { ...c, completed: false } : c));
    setSaving(null);
  }

  async function deleteCallback(id) {
    if (!window.confirm("Delete this callback?")) return;
    await supabase.from("callbacks").delete().eq("id", id);
    setCallbacks(prev => prev.filter(c => c.id !== id));
  }

  async function saveScheduled() {
    if (!schedForm.scheduled_at) return;
    setSchedSaving(true);
    await supabase.from("callbacks").insert({
      agent_id: userId,
      scheduled_at: new Date(schedForm.scheduled_at).toISOString(),
      notes: schedForm.notes || null,
      completed: false,
    });
    setSchedModal(false);
    setSchedForm({ scheduled_at: "", notes: "" });
    setSchedSaving(false);
    fetchCallbacks();
  }

  const leadDisplay = (cb) => {
    const l = cb.leads;
    if (l) {
      return {
        name: l.company_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown",
        phone: l.phone || cb.lead_phone || "—",
      };
    }
    return { name: cb.lead_name || "—", phone: cb.lead_phone || "—" };
  };

  const filtered = callbacks.filter(cb => {
    if (filter === "upcoming") return !cb.completed && !isPast(cb.scheduled_at);
    if (filter === "past")     return cb.completed || isPast(cb.scheduled_at);
    return true;
  });

  const upcomingCount = callbacks.filter(c => !c.completed && !isPast(c.scheduled_at)).length;
  const overdueCount  = callbacks.filter(c => !c.completed && isPast(c.scheduled_at)).length;

  const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors placeholder-[#4a5568]";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Callbacks</h1>
          <p className="text-[#4a5568] text-sm mt-0.5">
            {upcomingCount} upcoming{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
          </p>
        </div>
        <button
          onClick={() => setSchedModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963e] text-black font-semibold rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Callback
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#1e2130] mb-6">
        {[
          { id: "upcoming", label: "Upcoming" },
          { id: "past",     label: "Past / Done" },
          { id: "all",      label: "All" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-all border-b-2 -mb-px ${
              filter === t.id
                ? "text-[#c9a84c] border-[#c9a84c] bg-[#c9a84c]/5"
                : "text-[#4a5568] border-transparent hover:text-[#8892a4]"
            }`}
          >
            {t.label}
            {t.id === "upcoming" && overdueCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#c9a84c]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-12 h-12 text-[#1e2130] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[#4a5568]">No callbacks in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cb => {
            const { name, phone } = leadDisplay(cb);
            const overdue = !cb.completed && isPast(cb.scheduled_at);
            return (
              <div
                key={cb.id}
                className={`flex items-center gap-4 bg-[#0f1117] border rounded-xl px-5 py-4 transition-all ${
                  cb.completed ? "border-[#1e2130] opacity-60" : overdue ? "border-red-500/40" : "border-[#1e2130] hover:border-[#c9a84c]/20"
                }`}
              >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cb.completed ? "bg-emerald-500" : overdue ? "bg-red-500 animate-pulse" : "bg-[#c9a84c]"}`} />

                {/* Lead info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{name}</p>
                  <p className="text-[#4a5568] text-xs">{phone}</p>
                </div>

                {/* Scheduled time */}
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-medium ${cb.completed ? "text-[#4a5568]" : overdue ? "text-red-400" : "text-[#c9a84c]"}`}>
                    {fmtDate(cb.scheduled_at)}
                  </p>
                  {isAdmin && <p className="text-[#4a5568] text-xs mt-0.5">{agentName(cb.agent_id)}</p>}
                </div>

                {/* Notes */}
                {cb.notes && (
                  <div className="shrink-0 max-w-xs hidden lg:block">
                    <p className="text-[#8892a4] text-xs italic truncate">"{cb.notes}"</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!cb.completed ? (
                    <button
                      onClick={() => markDone(cb)}
                      disabled={saving === cb.id}
                      className="text-xs px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      Mark Done
                    </button>
                  ) : (
                    <button
                      onClick={() => markPending(cb)}
                      disabled={saving === cb.id}
                      className="text-xs px-3 py-1.5 bg-[#1e2130] hover:bg-[#2d3748] text-[#8892a4] rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    onClick={() => deleteCallback(cb.id)}
                    className="text-[#4a5568] hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule modal */}
      {schedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-bold text-lg">Schedule Callback</h2>
            <div>
              <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={schedForm.scheduled_at}
                onChange={e => setSchedForm(f => ({ ...f, scheduled_at: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Notes</label>
              <textarea
                value={schedForm.notes}
                onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="What to follow up on…"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSchedModal(false)} className="flex-1 py-2 rounded-lg border border-[#1e2130] text-[#8892a4] hover:border-[#2d3748] text-sm transition-colors">Cancel</button>
              <button
                onClick={saveScheduled}
                disabled={!schedForm.scheduled_at || schedSaving}
                className="flex-1 py-2 rounded-lg bg-[#c9a84c] hover:bg-[#b8963e] text-black font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {schedSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
