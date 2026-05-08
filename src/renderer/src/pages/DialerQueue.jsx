// src/renderer/src/pages/DialerQueue.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const DISPOSITIONS = [
  { label: "Answered",      value: "answered",       color: "bg-emerald-600 hover:bg-emerald-500" },
  { label: "No Answer",     value: "no_answer",      color: "bg-slate-600 hover:bg-slate-500" },
  { label: "Callback",      value: "callback",       color: "bg-blue-600 hover:bg-blue-500" },
  { label: "Not Interested",value: "not_interested", color: "bg-red-700 hover:bg-red-600" },
  { label: "App Sent",      value: "app_sent",       color: "bg-purple-600 hover:bg-purple-500" },
  { label: "App Signed",    value: "app_signed",     color: "bg-indigo-600 hover:bg-indigo-500" },
  { label: "Funded",        value: "funded",         color: "bg-yellow-600 hover:bg-yellow-500" },
  { label: "DNC",           value: "dnc",            color: "bg-rose-900 hover:bg-rose-800" },
];

// Weighted Fisher-Yates: higher lead_score leads appear earlier on average
function weightedShuffle(leads) {
  const items = leads.map(l => ({ lead: l, weight: Math.max(Number(l.lead_score) || 1, 1) }));
  const result = [];
  while (items.length > 0) {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let rand = Math.random() * total;
    let idx = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      rand -= items[i].weight;
      if (rand <= 0) { idx = i; break; }
    }
    result.push(items[idx].lead);
    items.splice(idx, 1);
  }
  return result;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function DialerQueue() {
  const [leads, setLeads]               = useState([]);
  const [queue, setQueue]               = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // idle | calling | connected | ended
  const [callState, setCallState]       = useState("idle");
  const [callSeconds, setCallSeconds]   = useState(0);
  const [disposition, setDisposition]   = useState(null);
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [serverOnline, setServerOnline] = useState(false);
  const [smsBody, setSmsBody]           = useState("");
  const [showSms, setShowSms]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  const timerRef  = useRef(null);
  const healthRef = useRef(null);

  const currentLead = queue[currentIndex] ?? null;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*");
    if (!error && data) {
      setLeads(data);
      setQueue(weightedShuffle(data));
      setCurrentIndex(0);
    }
    setLoading(false);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/health", {
        signal: AbortSignal.timeout(3000),
      });
      setServerOnline(res.ok);
    } catch {
      setServerOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    checkHealth();
    healthRef.current = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(healthRef.current);
      clearInterval(timerRef.current);
    };
  }, [fetchLeads, checkHealth]);

  // Call timer
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const handleDial = async () => {
    if (!currentLead) return;
    setCallState("calling");
    const digits = currentLead.phone.replace(/\D/g, "");
    const to = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    window.location.href = 'zoiper5:' + to;
    try {
      const res = await fetch("/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (res.ok) {
        setCallState("connected");
      } else {
        setCallState("idle");
      }
    } catch {
      setCallState("idle");
    }
  };

  const handleHangUp = () => {
    setCallState("ended");
  };

  const goNext = () => {
    setCallState("idle");
    setCallSeconds(0);
    setDisposition(null);
    setCallbackDate("");
    setCallbackTime("");
    setNotes("");
    setSmsBody("");
    setShowSms(false);
    setCurrentIndex(i => (i + 1 < queue.length ? i + 1 : i));
  };

  const handleSaveAndNext = async () => {
    if (!currentLead || !disposition) return;
    setSaving(true);
    const update = { status: disposition, notes };
    if (disposition === "callback" && callbackDate) {
      update.callback_at = `${callbackDate}T${callbackTime || "09:00"}:00`;
    }
    await supabase.from("leads").update(update).eq("id", currentLead.id);
    setSaving(false);
    goNext();
  };

  const handleSms = async () => {
    if (!currentLead || !smsBody.trim()) return;
    await fetch("/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: currentLead.phone, body: smsBody }),
    });
    setSmsBody("");
    setShowSms(false);
  };

  const handleReshuffle = () => {
    if (!leads.length) return;
    setQueue(weightedShuffle(leads));
    setCurrentIndex(0);
    setCallState("idle");
    setCallSeconds(0);
    setDisposition(null);
    setNotes("");
    setSmsBody("");
    setShowSms(false);
  };

  const jumpTo = (i) => {
    if (callState === "connected") return; // don't jump mid-call
    setCurrentIndex(i);
    setCallState("idle");
    setCallSeconds(0);
    setDisposition(null);
    setNotes("");
    setSmsBody("");
    setShowSms(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#c9a84c] text-sm animate-pulse">Loading queue...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-hidden">

      {/* ── Left: Queue list ── */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[#0d1117] border border-[#1e2a3a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
          <span className="text-white font-semibold text-sm">
            Queue&nbsp;
            <span className="text-[#4a5568] font-normal">({queue.length})</span>
          </span>
          <button
            onClick={handleReshuffle}
            className="text-[10px] font-semibold tracking-wide text-[#c9a84c] hover:text-white border border-[#c9a84c]/30 hover:border-[#c9a84c] px-2 py-1 rounded transition-all"
          >
            Reshuffle
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {queue.map((lead, i) => {
            const name = [lead.first_name || lead.name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
            const company = lead.company || lead.business_name || "";
            const active = i === currentIndex;
            return (
              <button
                key={lead.id ?? i}
                onClick={() => jumpTo(i)}
                className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a3a]/40 transition-all ${
                  active
                    ? "bg-[#c9a84c]/10 border-l-2 border-l-[#c9a84c]"
                    : "hover:bg-[#1e2a3a]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold truncate ${active ? "text-[#c9a84c]" : "text-white"}`}>
                    {i + 1}. {name}
                  </span>
                  {lead.lead_score != null && (
                    <span className="text-[10px] text-[#4a5568] flex-shrink-0 tabular-nums">
                      {lead.lead_score}
                    </span>
                  )}
                </div>
                {company && (
                  <div className="text-[10px] text-[#4a5568] truncate mt-0.5">{company}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Softphone panel ── */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="text-white text-2xl font-bold tracking-tight">Dialer Queue</h1>
          <div className="flex items-center gap-3">
            {/* Server status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#1e2a3a] rounded-lg">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${serverOnline ? "bg-emerald-400" : "bg-red-500"}`} />
              <span className={`text-xs font-medium ${serverOnline ? "text-emerald-400" : "text-red-400"}`}>
                {serverOnline ? "Server Online" : "Server Offline"}
              </span>
            </div>
            {/* Skip */}
            <button
              onClick={goNext}
              disabled={!currentLead || callState === "connected" || currentIndex >= queue.length - 1}
              className="text-xs text-[#8892a4] hover:text-white border border-[#1e2a3a] hover:border-[#2a3a4a] px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Skip
            </button>
          </div>
        </div>

        {!currentLead ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[#4a5568] text-sm mb-3">Queue is empty</div>
              <button
                onClick={handleReshuffle}
                className="text-sm text-[#c9a84c] border border-[#c9a84c]/30 hover:border-[#c9a84c] px-4 py-2 rounded-lg transition-all"
              >
                Reload & Reshuffle
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Lead info card */}
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-5 flex-shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h2 className="text-white text-xl font-bold truncate">
                    {[currentLead.first_name || currentLead.name, currentLead.last_name].filter(Boolean).join(" ") || "Unknown"}
                  </h2>
                  <p className="text-[#c9a84c] text-sm mt-0.5 truncate">
                    {currentLead.company || currentLead.business_name || "—"}
                  </p>
                </div>
                {currentLead.lead_score != null && (
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-2xl font-bold text-[#c9a84c] tabular-nums">{currentLead.lead_score}</div>
                    <div className="text-[10px] text-[#4a5568] uppercase tracking-wider">Score</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Phone",     value: currentLead.phone },
                  { label: "State",     value: currentLead.state },
                  { label: "Lead Type", value: currentLead.lead_type },
                  { label: "Status",    value: currentLead.status },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#080b10] rounded-lg px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-0.5">{label}</div>
                    <div className="text-white text-sm font-medium truncate">{value || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Call controls */}
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-5 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">

                {callState === "idle" && (
                  <button
                    onClick={handleDial}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Dial
                  </button>
                )}

                {callState === "calling" && (
                  <>
                    <span className="text-yellow-400 text-sm animate-pulse font-medium">Dialing…</span>
                    <button
                      onClick={handleHangUp}
                      className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-900/20"
                    >
                      <PhoneDownIcon />
                      Hang Up
                    </button>
                  </>
                )}

                {callState === "connected" && (
                  <>
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-mono text-lg font-bold tabular-nums">
                        {formatTime(callSeconds)}
                      </span>
                    </div>
                    <button
                      onClick={handleHangUp}
                      className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-900/20"
                    >
                      <PhoneDownIcon />
                      Hang Up
                    </button>
                  </>
                )}

                {callState === "ended" && (
                  <div className="flex items-center gap-2 text-[#4a5568] text-sm">
                    <div className="w-2 h-2 rounded-full bg-[#4a5568]" />
                    Call ended &mdash; {formatTime(callSeconds)}
                  </div>
                )}

                {/* SMS button */}
                <button
                  onClick={() => setShowSms(v => !v)}
                  className={`ml-auto flex items-center gap-2 px-4 py-2.5 border text-sm rounded-xl transition-all ${
                    showSms
                      ? "bg-[#c9a84c]/10 border-[#c9a84c]/40 text-[#c9a84c]"
                      : "bg-[#1e2a3a] hover:bg-[#2a3a4a] border-[#2a3a4a] text-[#8892a4] hover:text-white"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  SMS
                </button>
              </div>

              {/* SMS panel */}
              {showSms && (
                <div className="mt-4 pt-4 border-t border-[#1e2a3a]">
                  <textarea
                    value={smsBody}
                    onChange={e => setSmsBody(e.target.value)}
                    placeholder={`Message to ${currentLead.phone || "lead"}…`}
                    rows={3}
                    className="w-full bg-[#080b10] border border-[#1e2a3a] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a5568] resize-none focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[#4a5568]">{smsBody.length} chars</span>
                    <button
                      onClick={handleSms}
                      disabled={!smsBody.trim() || !serverOnline}
                      className="px-4 py-1.5 bg-[#c9a84c] hover:bg-[#d4b55c] disabled:opacity-30 disabled:cursor-not-allowed text-[#080b10] text-sm font-bold rounded-lg transition-all"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notes — always visible so agent can type during call */}
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-5 flex-shrink-0">
              <label className="text-xs uppercase tracking-wider text-[#4a5568] mb-2 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Type call notes here…"
                rows={4}
                className="w-full bg-[#080b10] border border-[#1e2a3a] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a5568] resize-none focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
              />
            </div>

            {/* Disposition — shown after hang up */}
            {callState === "ended" && (
              <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-5 flex-shrink-0">
                <h3 className="text-white font-semibold text-sm mb-3">Disposition</h3>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {DISPOSITIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDisposition(prev => prev === d.value ? null : d.value)}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold text-white transition-all ${
                        disposition === d.value
                          ? `${d.color} ring-2 ring-white/20 scale-95`
                          : "bg-[#1e2a3a] hover:bg-[#2a3a4a] text-[#8892a4] hover:text-white"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {disposition === "callback" && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1 block">
                        Callback Date
                      </label>
                      <input
                        type="date"
                        value={callbackDate}
                        onChange={e => setCallbackDate(e.target.value)}
                        className="w-full bg-[#080b10] border border-[#1e2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1 block">
                        Callback Time
                      </label>
                      <input
                        type="time"
                        value={callbackTime}
                        onChange={e => setCallbackTime(e.target.value)}
                        className="w-full bg-[#080b10] border border-[#1e2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveAndNext}
                  disabled={!disposition || saving}
                  className="w-full py-3 bg-[#c9a84c] hover:bg-[#d4b55c] disabled:bg-[#c9a84c]/20 disabled:cursor-not-allowed text-[#080b10] disabled:text-[#4a5568] font-bold text-sm rounded-xl transition-all"
                >
                  {saving ? "Saving…" : "Save & Next Lead"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PhoneDownIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z" />
    </svg>
  );
}
