import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function leadName(cb) {
  const l = cb.leads;
  if (l) return l.company_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown Lead";
  return cb.lead_name || cb.lead_phone || "Unknown Lead";
}

// Polls every 60s and surfaces a dismissable banner for callbacks due within 15 min.
export default function CallbackReminder({ userId, onNavigateCallbacks, onBadgeChange }) {
  const [alerts, setAlerts] = useState([]);
  const dismissed = useRef(new Set()); // IDs dismissed this session

  async function check() {
    const now   = new Date();
    const soon  = new Date(now.getTime() + 15 * 60 * 1000);

    // Badge: all pending upcoming callbacks for this agent
    const { count } = await supabase
      .from("callbacks")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", userId)
      .eq("completed", false)
      .lte("scheduled_at", soon.toISOString());
    onBadgeChange?.(count || 0);

    // Alerts: due within 15 min (or up to 5 min overdue)
    const { data } = await supabase
      .from("callbacks")
      .select("id, scheduled_at, notes, leads(first_name, last_name, company_name, phone), lead_name, lead_phone")
      .eq("agent_id", userId)
      .eq("completed", false)
      .lte("scheduled_at", soon.toISOString())
      .gte("scheduled_at", new Date(now.getTime() - 5 * 60 * 1000).toISOString()); // up to 5min past

    const fresh = (data || []).filter(c => !dismissed.current.has(c.id));
    if (fresh.length) setAlerts(prev => {
      const existing = new Set(prev.map(a => a.id));
      return [...prev, ...fresh.filter(c => !existing.has(c.id))];
    });
  }

  useEffect(() => {
    if (!userId) return;
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [userId]);

  function dismiss(id) {
    dismissed.current.add(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function markDone(id) {
    await supabase.from("callbacks").update({ completed: true }).eq("id", id);
    dismiss(id);
  }

  if (!alerts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {alerts.map(cb => {
        const overdue = new Date(cb.scheduled_at) < new Date();
        return (
          <div
            key={cb.id}
            className={`bg-[#0f1117] border rounded-xl shadow-2xl p-4 flex flex-col gap-2 animate-fade-in ${
              overdue ? "border-red-500/60" : "border-[#c9a84c]/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${overdue ? "text-red-400" : "text-[#c9a84c]"}`}>
                  {overdue ? "⚠️" : "🔔"}
                </span>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{leadName(cb)}</p>
                  <p className={`text-xs ${overdue ? "text-red-400" : "text-[#c9a84c]"}`}>
                    {overdue ? "Overdue · " : "Due at "}{fmtTime(cb.scheduled_at)}
                  </p>
                </div>
              </div>
              <button onClick={() => dismiss(cb.id)} className="text-[#4a5568] hover:text-white transition-colors shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {cb.notes && <p className="text-[#8892a4] text-xs italic pl-7">"{cb.notes}"</p>}
            <div className="flex gap-2 pl-7">
              <button
                onClick={() => markDone(cb.id)}
                className="text-xs px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition-colors font-medium"
              >
                Mark Done
              </button>
              <button
                onClick={() => { dismiss(cb.id); onNavigateCallbacks?.(); }}
                className="text-xs px-3 py-1 bg-[#1e2130] hover:bg-[#2d3748] text-[#8892a4] rounded-lg transition-colors"
              >
                View All
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
