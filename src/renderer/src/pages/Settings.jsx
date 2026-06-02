// src/renderer/src/pages/Settings.jsx
//
// Requires this table in Supabase (run once):
//   CREATE TABLE IF NOT EXISTS settings (
//     key text PRIMARY KEY,
//     value text,
//     updated_at timestamptz default now()
//   );

import React, { useState, useEffect, useRef } from "react"; // useRef used by useSaveState timer
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


// ── 5. Integrations ───────────────────────────────────────────────────────────

function IntegrationsSection({ raw, upsert }) {
  const { zohoConnected, setZohoConnected, userId, disconnectZoho } = useApp();
  const [vicidialUrl, setVicidialUrl] = useState(raw.vicidial_url    || "");
  const [webhookUrl,  setWebhookUrl]  = useState(raw.webhook_url     || "");
  const { saving, saved, wrap } = useSaveState();

  async function saveIntegrations() {
    await wrap(() => upsert({ vicidial_url: vicidialUrl, webhook_url: webhookUrl }));
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


// ── Sidebar nav icons ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "integrations",
    label: "Integrations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { agent } = useApp();
  const [activeSection, setActiveSection] = useState("integrations");
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
    return <IntegrationsSection raw={raw} upsert={upsert} />;
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
