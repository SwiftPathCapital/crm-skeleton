// src/renderer/src/pages/Settings.jsx
//
// Requires this table in Supabase (run once):
//   CREATE TABLE IF NOT EXISTS settings (
//     key text PRIMARY KEY,
//     value text,
//     updated_at timestamptz default now()
//   );

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h2 className="text-white text-xl font-bold">{title}</h2>
      <p className="text-[#4a5568] text-sm mt-1">{description}</p>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#1e2130] bg-[#0d1017] ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <p className="text-white text-sm font-semibold mb-4">{children}</p>;
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[#8892a4] text-xs font-semibold uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[#4a5568] text-xs mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c]/50 transition-colors ${className}`}
    />
  );
}

function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9a84c]/50 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#c9a84c]" : "bg-[#1e2130]"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      {label && <span className="text-sm text-[#8892a4]">{label}</span>}
    </label>
  );
}

function SaveButton({ saving, saved, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      {saving ? (
        <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
      ) : saved ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
      {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

function useSaveState() {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const timer = useRef(null);

  async function wrap(fn) {
    setSaving(true);
    setSaved(false);
    try { await fn(); }
    finally {
      setSaving(false);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    }
  }
  return { saving, saved, wrap };
}

// ── 1. Phone Settings ─────────────────────────────────────────────────────────

function PhoneSection({ raw, upsert }) {
  const dids   = parseJson(raw.phone_dids, []);
  const [agentList, setAgentList] = useState([]);
  const [newDid,    setNewDid]    = useState({ number: "", label: "", assignedTo: "", callerId: "" });
  const [adding,    setAdding]    = useState(false);
  const { saving, saved, wrap }   = useSaveState();

  useEffect(() => {
    supabase.from("agents").select("id, full_name").then(({ data }) => setAgentList(data || []));
  }, []);

  async function addDid() {
    if (!newDid.number.trim()) return;
    await wrap(() => upsert({ phone_dids: JSON.stringify([...dids, { id: Date.now().toString(), ...newDid }]) }));
    setNewDid({ number: "", label: "", assignedTo: "", callerId: "" });
    setAdding(false);
  }

  async function removeDid(id) {
    await upsert({ phone_dids: JSON.stringify(dids.filter((d) => d.id !== id)) });
  }

  async function patchDid(id, field, value) {
    await upsert({ phone_dids: JSON.stringify(dids.map((d) => d.id === id ? { ...d, [field]: value } : d)) });
  }

  return (
    <div>
      <SectionHeader title="Phone Settings" description="Manage DIDs, assign to agents, and configure caller ID" />

      <Card className="mb-4">
        <div className="px-5 py-4 border-b border-[#1e2130] flex items-center justify-between">
          <CardTitle>DID Numbers</CardTitle>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a] hover:bg-[#26376e] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add DID
          </button>
        </div>

        {dids.length === 0 && !adding ? (
          <div className="px-5 py-10 text-center text-[#4a5568] text-sm">No DIDs configured yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2130]">
                {["Number", "Label", "Assigned To", "Caller ID", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a5568] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dids.map((d) => (
                <tr key={d.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#080b10]/60">
                  <td className="px-4 py-2.5 font-mono text-white">{d.number}</td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={d.label}
                      onBlur={(e) => patchDid(d.id, "label", e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-[#1e2130] focus:border-[#c9a84c] px-1 py-0.5 text-sm text-[#8892a4] outline-none w-32 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={d.assignedTo || ""}
                      onChange={(e) => patchDid(d.id, "assignedTo", e.target.value)}
                      className="bg-[#080b10] border border-[#1e2130] rounded px-2 py-1 text-xs text-[#8892a4] focus:outline-none focus:border-[#c9a84c]/50"
                    >
                      <option value="">Unassigned</option>
                      {agentList.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={d.callerId}
                      onBlur={(e) => patchDid(d.id, "callerId", e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-[#1e2130] focus:border-[#c9a84c] px-1 py-0.5 text-sm text-[#8892a4] font-mono outline-none w-36 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeDid(d.id)} className="text-[#4a5568] hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}

              {adding && (
                <tr className="border-t border-[#c9a84c]/20 bg-[#c9a84c]/5">
                  <td className="px-4 py-2.5">
                    <input value={newDid.number} onChange={(e) => setNewDid((p) => ({ ...p, number: e.target.value }))}
                      placeholder="+15551234567" className="bg-[#080b10] border border-[#1e2130] rounded px-2 py-1.5 text-sm text-white font-mono outline-none focus:border-[#c9a84c]/50 w-36" />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={newDid.label} onChange={(e) => setNewDid((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Label" className="bg-[#080b10] border border-[#1e2130] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-[#c9a84c]/50 w-28" />
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={newDid.assignedTo} onChange={(e) => setNewDid((p) => ({ ...p, assignedTo: e.target.value }))}
                      className="bg-[#080b10] border border-[#1e2130] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#c9a84c]/50">
                      <option value="">Unassigned</option>
                      {agentList.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={newDid.callerId} onChange={(e) => setNewDid((p) => ({ ...p, callerId: e.target.value }))}
                      placeholder="+15551234567" className="bg-[#080b10] border border-[#1e2130] rounded px-2 py-1.5 text-sm text-white font-mono outline-none focus:border-[#c9a84c]/50 w-36" />
                  </td>
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <button onClick={addDid} disabled={saving} className="px-3 py-1.5 rounded text-xs font-semibold bg-[#c9a84c] text-[#080b10] hover:opacity-90 disabled:opacity-40">
                      {saving ? "…" : "Add"}
                    </button>
                    <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded text-xs text-[#8892a4] hover:text-white">Cancel</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {saved && <p className="px-5 pb-3 text-xs text-emerald-400">Saved!</p>}
      </Card>
    </div>
  );
}

// ── 2. Call Settings ──────────────────────────────────────────────────────────

function CallSection({ raw, upsert }) {
  const [recording,    setRecording]    = useState(raw.call_recording === "true");
  const [ringTimeout,  setRingTimeout]  = useState(raw.ring_timeout   || "30");
  const [dispositions, setDispositions] = useState(parseJson(raw.disposition_options, ["Interested", "Callback", "Not Interested", "No Answer", "Wrong Number", "DNC"]));
  const [newDisp,      setNewDisp]      = useState("");
  const [editIdx,      setEditIdx]      = useState(null);
  const [editVal,      setEditVal]      = useState("");
  const { saving, saved, wrap } = useSaveState();

  async function saveGeneral() {
    await wrap(() => upsert({ call_recording: String(recording), ring_timeout: ringTimeout }));
  }

  async function saveDispositions(next) {
    await upsert({ disposition_options: JSON.stringify(next) });
    setDispositions(next);
  }

  function addDisposition() {
    if (!newDisp.trim() || dispositions.includes(newDisp.trim())) return;
    saveDispositions([...dispositions, newDisp.trim()]);
    setNewDisp("");
  }

  function removeDisposition(i) {
    saveDispositions(dispositions.filter((_, idx) => idx !== i));
  }

  function commitEdit(i) {
    if (!editVal.trim()) { setEditIdx(null); return; }
    const next = dispositions.map((d, idx) => idx === i ? editVal.trim() : d);
    saveDispositions(next);
    setEditIdx(null);
  }

  return (
    <div>
      <SectionHeader title="Call Settings" description="Configure recording, ring timeout, and call disposition options" />

      <Card className="p-5 mb-4">
        <CardTitle>General</CardTitle>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Call Recording">
            <div className="flex items-center gap-3 mt-1">
              <Toggle checked={recording} onChange={setRecording} />
              <span className="text-sm text-[#8892a4]">{recording ? "Enabled" : "Disabled"}</span>
            </div>
          </Field>
          <Field label="Ring Timeout" hint="Seconds before call is considered unanswered">
            <TextInput type="number" value={ringTimeout} onChange={setRingTimeout} placeholder="30" className="w-28" />
          </Field>
        </div>
        <SaveButton saving={saving} saved={saved} onClick={saveGeneral} />
      </Card>

      <Card className="p-5">
        <CardTitle>Disposition Options</CardTitle>
        <div className="space-y-1.5 mb-4">
          {dispositions.map((d, i) => (
            <div key={i} className="flex items-center gap-2 group">
              {editIdx === i ? (
                <>
                  <input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(i); if (e.key === "Escape") setEditIdx(null); }}
                    className="flex-1 bg-[#080b10] border border-[#c9a84c]/50 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                  />
                  <button onClick={() => commitEdit(i)} className="px-3 py-1.5 rounded text-xs font-semibold bg-[#c9a84c] text-[#080b10]">Save</button>
                  <button onClick={() => setEditIdx(null)} className="px-3 py-1.5 rounded text-xs text-[#8892a4] hover:text-white">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#080b10] border border-[#1e2130]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
                    <span className="text-sm text-[#8892a4]">{d}</span>
                  </div>
                  <button onClick={() => { setEditIdx(i); setEditVal(d); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[#4a5568] hover:text-[#c9a84c] transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => removeDisposition(i)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[#4a5568] hover:text-red-400 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <TextInput
            value={newDisp}
            onChange={setNewDisp}
            placeholder="New disposition…"
            className="flex-1"
          />
          <button
            onClick={addDisposition}
            disabled={!newDisp.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a] hover:bg-[#26376e] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Add
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── 3. Agent Settings ─────────────────────────────────────────────────────────

function AgentSection({ raw, upsert }) {
  const [agents,   setAgents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sipCreds, setSipCreds] = useState(parseJson(raw.agent_sip, {}));
  const [expanded, setExpanded] = useState(null);
  const { saving, saved, wrap } = useSaveState();
  const dids = parseJson(raw.phone_dids, []);

  useEffect(() => {
    supabase.from("agents").select("id, full_name, email, role").order("full_name")
      .then(({ data }) => { setAgents(data || []); setLoading(false); });
  }, []);

  function getCred(agentId, field) {
    return sipCreds[agentId]?.[field] || "";
  }

  function patchCred(agentId, field, value) {
    setSipCreds((prev) => ({ ...prev, [agentId]: { ...prev[agentId], [field]: value } }));
  }

  async function saveSip() {
    await wrap(() => upsert({ agent_sip: JSON.stringify(sipCreds) }));
  }

  function agentDids(agentId) {
    return dids.filter((d) => d.assignedTo === agentId).map((d) => d.number).join(", ") || "None";
  }

  return (
    <div>
      <SectionHeader title="Agent Settings" description="View agents, manage SIP credentials, and DID assignments" />

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Card>
          <div className="px-5 py-4 border-b border-[#1e2130] flex items-center justify-between">
            <CardTitle>Agents ({agents.length})</CardTitle>
            <SaveButton saving={saving} saved={saved} onClick={saveSip} />
          </div>

          <div className="divide-y divide-[#1e2130]">
            {agents.map((a) => (
              <div key={a.id}>
                <div
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-[#080b10]/50 transition-colors"
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0">
                    {a.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{a.full_name}</p>
                    <p className="text-[#4a5568] text-xs">{a.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === "admin" ? "bg-[#c9a84c]/15 text-[#c9a84c]" : "bg-[#1e2d4a] text-[#8892a4]"}`}>
                    {a.role}
                  </span>
                  <div className="text-xs text-[#4a5568] w-36 truncate text-right">
                    DID: {agentDids(a.id)}
                  </div>
                  <svg className={`w-4 h-4 text-[#4a5568] flex-shrink-0 transition-transform ${expanded === a.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expanded === a.id && (
                  <div className="px-5 pb-4 bg-[#080b10]/30 border-t border-[#1e2130]">
                    <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider my-3">SIP Credentials</p>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="SIP Username">
                        <TextInput value={getCred(a.id, "username")} onChange={(v) => patchCred(a.id, "username", v)} placeholder="user2800" />
                      </Field>
                      <Field label="SIP Password">
                        <TextInput type="password" value={getCred(a.id, "password")} onChange={(v) => patchCred(a.id, "password", v)} placeholder="••••••••" />
                      </Field>
                      <Field label="SIP Domain">
                        <TextInput value={getCred(a.id, "domain")} onChange={(v) => patchCred(a.id, "domain", v)} placeholder="sip.telnyx.com" />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── 4. Campaign Settings ──────────────────────────────────────────────────────

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
];

function CampaignSection({ raw, upsert }) {
  const [timezone,  setTimezone]  = useState(raw.timezone        || "America/New_York");
  const [schedStart, setSchedStart] = useState(raw.call_sched_start || "08:00");
  const [schedEnd,   setSchedEnd]   = useState(raw.call_sched_end   || "17:00");
  const [lists,     setLists]      = useState(parseJson(raw.lead_lists, []));
  const [newList,   setNewList]    = useState("");
  const { saving, saved, wrap }    = useSaveState();

  async function saveSchedule() {
    await wrap(() => upsert({ timezone, call_sched_start: schedStart, call_sched_end: schedEnd }));
  }

  async function addList() {
    if (!newList.trim()) return;
    const next = [...lists, { id: Date.now().toString(), name: newList.trim(), createdAt: new Date().toISOString() }];
    await upsert({ lead_lists: JSON.stringify(next) });
    setLists(next);
    setNewList("");
  }

  async function removeList(id) {
    const next = lists.filter((l) => l.id !== id);
    await upsert({ lead_lists: JSON.stringify(next) });
    setLists(next);
  }

  return (
    <div>
      <SectionHeader title="Campaign Settings" description="Configure lead lists, call schedules, and time zone" />

      <Card className="p-5 mb-4">
        <CardTitle>Call Schedule & Time Zone</CardTitle>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Time Zone">
            <Select value={timezone} onChange={setTimezone}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
            </Select>
          </Field>
          <Field label="Daily Start Time">
            <TextInput type="time" value={schedStart} onChange={setSchedStart} />
          </Field>
          <Field label="Daily End Time">
            <TextInput type="time" value={schedEnd} onChange={setSchedEnd} />
          </Field>
        </div>
        <SaveButton saving={saving} saved={saved} onClick={saveSchedule} />
      </Card>

      <Card className="p-5">
        <CardTitle>Lead Lists</CardTitle>

        {lists.length === 0 ? (
          <p className="text-[#4a5568] text-sm mb-4">No lead lists configured.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {lists.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#080b10] border border-[#1e2130] group">
                <svg className="w-4 h-4 text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="flex-1 text-sm text-[#8892a4]">{l.name}</span>
                <span className="text-xs text-[#4a5568]">{new Date(l.createdAt).toLocaleDateString()}</span>
                <button onClick={() => removeList(l.id)} className="opacity-0 group-hover:opacity-100 text-[#4a5568] hover:text-red-400 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <TextInput value={newList} onChange={setNewList} placeholder="List name…" className="flex-1" />
          <button
            onClick={addList}
            disabled={!newList.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a] hover:bg-[#26376e] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Add List
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── 5. Integrations ───────────────────────────────────────────────────────────

function IntegrationsSection({ raw, upsert }) {
  const { zohoConnected, setZohoConnected, userId, disconnectZoho } = useApp();
  const [telnyxKey,   setTelnyxKey]   = useState(raw.telnyx_api_key  || "");
  const [vicidialUrl, setVicidialUrl] = useState(raw.vicidial_url    || "");
  const [webhookUrl,  setWebhookUrl]  = useState(raw.webhook_url     || "");
  const [showKey,     setShowKey]     = useState(false);
  const { saving, saved, wrap } = useSaveState();

  async function saveIntegrations() {
    await wrap(() => upsert({ telnyx_api_key: telnyxKey, vicidial_url: vicidialUrl, webhook_url: webhookUrl }));
  }

  function connectZoho() {
    if (!userId) return;
    const popup = window.open(
      `${API_BASE}/auth/zoho?agentId=${userId}`,
      "zoho-oauth",
      "width=600,height=700,left=300,top=100"
    );
    const handler = (e) => {
      if (e.data === "zoho-connected") {
        window.removeEventListener("message", handler);
        setZohoConnected(true);
      }
    };
    window.addEventListener("message", handler);
    const poll = setInterval(() => {
      if (popup?.closed) { clearInterval(poll); window.removeEventListener("message", handler); }
    }, 1000);
  }

  return (
    <div>
      <SectionHeader title="Integrations" description="Connect external services and manage API credentials" />

      {/* Zoho */}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white text-sm font-semibold mb-1">Zoho Mail</p>
            <p className="text-[#4a5568] text-xs">Send and receive emails directly from your CRM</p>
          </div>
          {zohoConnected === null ? (
            <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin mt-1" />
          ) : zohoConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 text-xs font-medium">Connected</span>
              </div>
              <button
                onClick={disconnectZoho}
                className="px-3 py-1 rounded-lg text-xs font-medium text-[#8892a4] hover:text-red-400 hover:bg-red-500/10 border border-[#1e2130] transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectZoho}
              disabled={!userId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect Zoho
            </button>
          )}
        </div>
      </Card>

      {/* Other services */}
      <Card className="p-5">
        <CardTitle>API Credentials & URLs</CardTitle>
        <div className="space-y-4 mb-5">
          <Field label="Telnyx API Key" hint="Used for SMS, SIP calling, and DID provisioning">
            <div className="relative">
              <TextInput
                type={showKey ? "text" : "password"}
                value={telnyxKey}
                onChange={setTelnyxKey}
                placeholder="KEY0••••••••••••••••••••••"
              />
              <button
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5568] hover:text-[#8892a4]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showKey
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                  }
                </svg>
              </button>
            </div>
          </Field>
          <Field label="VICIdial URL" hint="Base URL for your VICIdial instance">
            <TextInput value={vicidialUrl} onChange={setVicidialUrl} placeholder="https://dialer.yourcompany.com" />
          </Field>
          <Field label="Webhook URL" hint="Receive call events and lead updates from third-party services">
            <TextInput value={webhookUrl} onChange={setWebhookUrl} placeholder="https://yourapp.com/webhooks/crm" />
          </Field>
        </div>
        <SaveButton saving={saving} saved={saved} onClick={saveIntegrations} />
      </Card>
    </div>
  );
}

// ── 6. Branding ───────────────────────────────────────────────────────────────

const PRESET_COLORS = ["#c9a84c", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function BrandingSection({ raw, upsert }) {
  const [companyName,  setCompanyName]  = useState(raw.company_name  || "");
  const [accentColor,  setAccentColor]  = useState(raw.accent_color  || "#c9a84c");
  const [logoUrl,      setLogoUrl]      = useState(raw.logo_url      || "");
  const [logoPreview,  setLogoPreview]  = useState(raw.logo_data     || raw.logo_url || "");
  const fileRef = useRef(null);
  const { saving, saved, wrap } = useSaveState();

  function handleLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { alert("Logo must be under 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target.result);
      setLogoUrl("");
    };
    reader.readAsDataURL(file);
  }

  async function saveBranding() {
    const pairs = {
      company_name: companyName,
      accent_color: accentColor,
    };
    if (logoPreview && logoPreview.startsWith("data:")) {
      pairs.logo_data = logoPreview;
    } else {
      pairs.logo_url = logoUrl;
    }
    await wrap(() => upsert(pairs));
  }

  return (
    <div>
      <SectionHeader title="Branding" description="Customize the company name, logo, and accent color" />

      <Card className="p-5">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <Field label="Company Name">
              <TextInput value={companyName} onChange={setCompanyName} placeholder="Swift Path Capital" />
            </Field>

            <Field label="Accent Color">
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-all ${accentColor === c ? "ring-2 ring-offset-2 ring-offset-[#0d1017] ring-white scale-110" : "hover:scale-105"}`}
                  />
                ))}
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[#4a5568] text-xs font-mono">{accentColor}</span>
                </div>
              </div>
            </Field>

            <Field label="Logo URL" hint="Or upload a file below (max 500 KB)">
              <TextInput
                value={logoUrl}
                onChange={(v) => { setLogoUrl(v); setLogoPreview(v); }}
                placeholder="https://yourcdn.com/logo.png"
              />
            </Field>

            <div className="mb-4">
              <label className="block text-[#8892a4] text-xs font-semibold uppercase tracking-wide mb-1.5">Upload Logo</label>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#8892a4] bg-[#080b10] border border-[#1e2130] hover:border-[#c9a84c]/40 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose File
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
            </div>

            <SaveButton saving={saving} saved={saved} onClick={saveBranding} />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-[#8892a4] text-xs font-semibold uppercase tracking-wide mb-3">Preview</label>
            <div className="rounded-xl border border-[#1e2130] bg-[#080b10] p-5">
              <div className="flex items-center gap-3 mb-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-10 w-auto object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[#080b10] font-bold text-xs"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                    {companyName?.slice(0, 2).toUpperCase() || "CP"}
                  </div>
                )}
                <span className="text-white font-semibold text-sm">{companyName || "Company Name"}</span>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#080b10]"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                  Primary Button
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium border text-sm"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                  Secondary
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Sidebar nav icons ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "phone",
    label: "Phone Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    id: "call",
    label: "Call Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: "agents",
    label: "Agent Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: "campaign",
    label: "Campaign Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: "branding",
    label: "Branding",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { agent } = useApp();
  const [activeSection, setActiveSection] = useState("phone");
  const [raw,           setRaw]           = useState({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });
      setRaw(map);
    } catch (err) {
      console.error("[Settings] loadSettings:", err);
      setError("Could not load settings. Make sure the settings table exists in Supabase.");
    } finally {
      setLoading(false);
    }
  }

  async function upsert(pairs) {
    const rows = Object.entries(pairs).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    setRaw((prev) => {
      const next = { ...prev };
      rows.forEach(({ key, value }) => { next[key] = value; });
      return next;
    });
  }

  if (agent?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full text-[#4a5568]">
        <p>Access restricted to administrators.</p>
      </div>
    );
  }

  function renderSection() {
    const props = { raw, upsert };
    switch (activeSection) {
      case "phone":        return <PhoneSection        {...props} />;
      case "call":         return <CallSection         {...props} />;
      case "agents":       return <AgentSection        {...props} />;
      case "campaign":     return <CampaignSection     {...props} />;
      case "integrations": return <IntegrationsSection {...props} />;
      case "branding":     return <BrandingSection     {...props} />;
      default:             return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-[#4a5568] text-sm mt-1">Manage system configuration</p>
        </div>
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8892a4] hover:text-white bg-[#0d1017] border border-[#1e2130] hover:border-[#c9a84c]/40 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 rounded-xl border border-[#1e2130] overflow-hidden bg-[#0d1017]">

        {/* Left nav */}
        <div className="w-52 flex-shrink-0 border-r border-[#1e2130] bg-[#080b10] py-3 px-2">
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all duration-150 ${
                activeSection === id
                  ? "bg-[#2d1e4a] text-[#c9a84c] border border-[#4a2d6a]"
                  : "text-[#8892a4] hover:bg-[#161b27] hover:text-white"
              }`}
            >
              <span className={activeSection === id ? "text-[#c9a84c]" : "text-[#4a5568]"}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-red-400 text-sm">
              <p className="font-semibold mb-1">Settings table not found</p>
              <p className="text-xs text-red-400/70">{error}</p>
              <pre className="mt-3 text-xs bg-[#080b10] rounded-lg p-3 text-[#8892a4] border border-[#1e2130] overflow-x-auto">{`CREATE TABLE IF NOT EXISTS settings (\n  key text PRIMARY KEY,\n  value text,\n  updated_at timestamptz default now()\n);`}</pre>
            </div>
          ) : (
            renderSection()
          )}
        </div>
      </div>
    </div>
  );
}
