// src/renderer/src/pages/EmailClient.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

// In Electron (file:// protocol) talk to the local Express server.
// On Railway/web the renderer is served by the same origin, so use relative URLs.
const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

const FOLDERS = [
  { id: "inbox",   label: "Inbox"   },
  { id: "sent",    label: "Sent"    },
  { id: "drafts",  label: "Drafts"  },
  { id: "starred", label: "Starred" },
];


// Map a Zoho Mail API message object to the app's internal email shape.
function mapZohoMessage(zm, folder) {
  return {
    id:         zm.messageId,
    from_email: zm.fromAddress || zm.sender || "",
    to_email:   zm.toAddress   || "",
    subject:    zm.subject     || "(no subject)",
    body:       zm.summary     || "",
    sent_at:    zm.receivedTime
      ? new Date(Number(zm.receivedTime)).toISOString()
      : new Date().toISOString(),
    read:    zm.isRead  === "true",
    starred: zm.flagged === "true",
    folder:  folder || "inbox",
    lead_id: null,
  };
}

// Only Supabase UUIDs should trigger DB updates; Zoho IDs don't.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isSupabaseId = (id) => UUID_RE.test(String(id));

function formatDate(dateStr) {
  const date     = new Date(dateStr);
  const now      = new Date();
  const diffDays = Math.floor((now - date) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function senderDisplay(email, isOutbound) {
  const addr = isOutbound ? email.to_email : email.from_email;
  return addr.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function InboxIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function SentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function StarIcon({ filled, className = "w-4 h-4" }) {
  return (
    <svg className={className} fill={filled ? "#c9a84c" : "none"} stroke={filled ? "#c9a84c" : "currentColor"} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

const folderIcons = {
  inbox:   <InboxIcon />,
  sent:    <SentIcon />,
  drafts:  <DraftIcon />,
  starred: <StarIcon filled />,
};

// ── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({ onClose, onSend, initialTo = "", initialSubject = "", initialBody = "" }) {
  const [to,      setTo]      = useState(initialTo);
  const [cc,      setCc]      = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body,    setBody]    = useState(initialBody);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    await onSend({ to: to.trim(), cc: cc.trim(), subject: subject.trim(), body });
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-[#0d1017] border border-[#1e2130] rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 640, maxWidth: "95vw", maxHeight: "85vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2130]">
          <h2 className="text-white text-base font-semibold">New Message</h2>
          <button onClick={onClose} className="text-[#4a5568] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 space-y-2.5 border-b border-[#1e2130]">
          {[
            { label: "To",      value: to,      set: setTo,      type: "email", placeholder: "recipient@example.com" },
            { label: "CC",      value: cc,      set: setCc,      type: "email", placeholder: "cc@example.com" },
            { label: "Subject", value: subject, set: setSubject, type: "text",  placeholder: "Email subject" },
          ].map(({ label, value, set, type, placeholder }) => (
            <div key={label} className="flex items-center gap-3">
              <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wide w-16 flex-shrink-0">
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent border-b border-[#1e2130] focus:border-[#c9a84c] py-1.5 text-sm text-white placeholder-[#4a5568] outline-none transition-colors"
              />
            </div>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="flex-1 bg-transparent px-5 py-4 text-sm text-white placeholder-[#4a5568] outline-none resize-none"
          style={{ minHeight: 200 }}
        />

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e2130]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#8892a4] hover:text-white hover:bg-[#1e2130] transition-all"
          >
            Discard
          </button>
          <button
            onClick={handleSend}
            disabled={!to.trim() || !subject.trim() || sending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
              : <SentIcon />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailClient({ initialCompose = null, initialEmailId = null }) {
  const [folder,        setFolder]        = useState("inbox");
  const [emails,        setEmails]        = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showCompose,   setShowCompose]   = useState(!!initialCompose);
  const [composePreset, setComposePreset] = useState(initialCompose || {});
  const [search,        setSearch]        = useState("");
  const [loading,       setLoading]       = useState(true);
  const [zohoConnected, setZohoConnected] = useState(null); // null = still checking
  const [userId,        setUserId]        = useState(null);
  const initHandled        = React.useRef(false);
  const messageHandlerRef  = React.useRef(null);
  const pollIntervalRef    = React.useRef(null);

  // Check Zoho connection once on mount; triggers loadEmails when resolved.
  useEffect(() => {
    checkZohoStatus();
    // On unmount: remove any pending OAuth listeners/intervals — do NOT disconnect Zoho.
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Load emails whenever connection status is known or the active folder changes.
  useEffect(() => {
    if (zohoConnected === null) return;
    loadEmails();
  }, [zohoConnected, folder]);

  // Deep-link to a specific email after real data arrives.
  useEffect(() => {
    if (!initialEmailId || initHandled.current || loading) return;
    const isReal = emails.some((e) => !String(e.id).startsWith("demo-"));
    if (!isReal) return;
    const target = emails.find((e) => e.id === initialEmailId);
    if (target) {
      initHandled.current = true;
      setFolder(target.folder || "inbox");
      selectEmail(target);
    }
  }, [initialEmailId, emails, loading]);

  async function checkZohoStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setZohoConnected(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("zoho_tokens")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      setZohoConnected(!!data);
    } catch {
      setZohoConnected(false);
    }
  }

  async function loadEmails() {
    setLoading(true);
    try {
      // Use Zoho API for inbox / sent when connected
      if (zohoConnected && userId && (folder === "inbox" || folder === "sent")) {
        const endpoint = folder === "sent" ? "/api/emails/sent" : "/api/emails/inbox";
        const res = await fetch(`${API_BASE}${endpoint}?agentId=${userId}&limit=50`);
        if (res.ok) {
          const json = await res.json();
          const msgs = (json.data || []).map((zm) => mapZohoMessage(zm, folder));
          setEmails(msgs.length > 0 ? msgs : []);
          return;
        }
      }
      // Supabase fallback
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .order("sent_at", { ascending: false });
      if (!error && data?.length > 0) setEmails(data);
      else setEmails([]);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend({ to, cc, subject, body }) {
    // Route through the Express proxy when Zoho is connected
    if (zohoConnected && userId) {
      try {
        const res = await fetch(`${API_BASE}/api/emails/send`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ agentId: userId, to, cc, subject, body }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Send failed");
        }
      } catch (err) {
        alert("Failed to send email: " + err.message);
        return;
      }
      setShowCompose(false);
      if (folder === "sent") loadEmails();
      return;
    }

    // Supabase direct fallback (no Zoho connection)
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const draft = {
      from_email: user?.email ?? "admin@swiftpathcapital.net",
      to_email:   to,
      subject,
      body,
      sent_at:    new Date().toISOString(),
      folder:     "sent",
      read:       true,
      starred:    false,
    };
    try {
      const { data, error } = await supabase.from("emails").insert(draft).select().single();
      setEmails((prev) => [error ? { ...draft, id: "local-" + Date.now() } : data, ...prev]);
    } catch {
      setEmails((prev) => [{ ...draft, id: "local-" + Date.now() }, ...prev]);
    }
    setShowCompose(false);
    setFolder("sent");
  }

  function openCompose(preset = {}) {
    setComposePreset(preset);
    setShowCompose(true);
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
        messageHandlerRef.current = null;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setZohoConnected(true);
      }
    };
    messageHandlerRef.current = handler;
    window.addEventListener("message", handler);
    const poll = setInterval(() => {
      if (popup?.closed) {
        clearInterval(poll);
        pollIntervalRef.current = null;
        if (messageHandlerRef.current) {
          window.removeEventListener("message", messageHandlerRef.current);
          messageHandlerRef.current = null;
        }
      }
    }, 1000);
    pollIntervalRef.current = poll;
  }

  async function disconnectZoho() {
    if (!userId) return;
    try {
      await supabase.from("zoho_tokens").delete().eq("id", userId);
    } catch { /* best-effort */ }
    setZohoConnected(false);
  }

  async function toggleStar(e, targetId) {
    e.stopPropagation();
    const target = emails.find((em) => em.id === targetId);
    if (!target) return;
    const next = !target.starred;
    setEmails((prev) => prev.map((em) => em.id === targetId ? { ...em, starred: next } : em));
    if (selectedEmail?.id === targetId) setSelectedEmail((s) => ({ ...s, starred: next }));
    // Only persist to Supabase for emails that live there (not Zoho or demo)
    if (isSupabaseId(targetId)) {
      await supabase.from("emails").update({ starred: next }).eq("id", targetId);
    }
  }

  async function selectEmail(em) {
    if (!em.read) {
      setEmails((prev) => prev.map((x) => x.id === em.id ? { ...x, read: true } : x));
      if (isSupabaseId(em.id)) {
        await supabase.from("emails").update({ read: true }).eq("id", em.id);
      }
    }
    setSelectedEmail({ ...em, read: true });
  }

  const filteredEmails = emails.filter((em) => {
    if (folder === "starred") {
      if (!em.starred) return false;
    } else if (em.folder !== folder) {
      return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      em.subject?.toLowerCase().includes(q)    ||
      em.from_email?.toLowerCase().includes(q) ||
      em.to_email?.toLowerCase().includes(q)   ||
      em.body?.toLowerCase().includes(q)
    );
  });

  const unreadCounts = {
    inbox:   emails.filter((em) => em.folder === "inbox" && !em.read).length,
    sent:    0,
    drafts:  emails.filter((em) => em.folder === "drafts").length,
    starred: emails.filter((em) => em.starred).length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Email</h1>
          <p className="text-[#4a5568] text-sm mt-1">Manage your email communications</p>
        </div>

        {/* Zoho connection status / button */}
        <div>
          {zohoConnected === null ? (
            <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          ) : zohoConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 text-xs font-medium">Zoho Connected</span>
              </div>
              <button
                onClick={disconnectZoho}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8892a4] hover:text-red-400 hover:bg-red-500/10 border border-[#1e2130] transition-all"
              >
                Disconnect Zoho
              </button>
            </div>
          ) : (
            <button
              onClick={connectZoho}
              disabled={!userId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect Zoho
            </button>
          )}
        </div>
      </div>

      {/* 3-panel email layout */}
      <div className="flex flex-1 min-h-0 rounded-xl border border-[#1e2130] overflow-hidden bg-[#0d1017]">

        {/* ── Panel 1: Folder sidebar ───────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 border-r border-[#1e2130] flex flex-col bg-[#080b10]">
          <div className="p-3">
            <button
              onClick={() => openCompose({})}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Compose
            </button>
          </div>

          <nav className="flex-1 px-2 pb-3 space-y-0.5">
            {FOLDERS.map(({ id, label }) => {
              const count  = unreadCounts[id];
              const active = folder === id;
              return (
                <button
                  key={id}
                  onClick={() => { setFolder(id); setSelectedEmail(null); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a]"
                      : "text-[#8892a4] hover:bg-[#161b27] hover:text-white"
                  }`}
                >
                  <span className={active ? "text-[#c9a84c]" : "text-[#4a5568]"}>
                    {folderIcons[id]}
                  </span>
                  <span className="flex-1 text-left">{label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-[#c9a84c] text-[#080b10]" : "bg-[#1e2d4a] text-[#c9a84c]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Panel 2: Email list ───────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-[#1e2130] flex flex-col">
          <div className="p-3 border-b border-[#1e2130]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0d12] border border-[#1e2130] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#4a5568] gap-2">
                {folderIcons[folder]}
                <p className="text-xs">No emails yet</p>
              </div>
            ) : (
              filteredEmails.map((em) => {
                const isSelected  = selectedEmail?.id === em.id;
                const displayName = senderDisplay(em, folder === "sent");
                return (
                  <div
                    key={em.id}
                    onClick={() => selectEmail(em)}
                    className={`relative px-4 py-3.5 border-b border-[#1e2130] cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#131929] border-l-2 border-l-[#c9a84c]"
                        : !em.read
                          ? "bg-[#0d1117] hover:bg-[#111520]"
                          : "hover:bg-[#111520]"
                    }`}
                  >
                    {!em.read && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
                    )}

                    <div className="flex items-start justify-between gap-1.5 mb-0.5">
                      <span className={`text-xs truncate flex-1 ${!em.read ? "text-white font-semibold" : "text-[#8892a4]"}`}>
                        {displayName}
                      </span>
                      <span className="text-[10px] text-[#4a5568] flex-shrink-0 mt-px">
                        {formatDate(em.sent_at)}
                      </span>
                    </div>

                    <div className={`text-xs mb-1 truncate ${!em.read ? "text-white font-medium" : "text-[#8892a4]"}`}>
                      {em.subject}
                    </div>

                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] text-[#4a5568] truncate flex-1">
                        {(em.body || "").replace(/\n/g, " ").slice(0, 72)}
                      </span>
                      <button
                        onClick={(e) => toggleStar(e, em.id)}
                        className={`flex-shrink-0 transition-colors ${
                          em.starred ? "text-[#c9a84c]" : "text-[#2d3748] hover:text-[#c9a84c]"
                        }`}
                      >
                        <StarIcon filled={em.starred} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Panel 3: Reading pane ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedEmail ? (
            <>
              <div className="px-6 py-5 border-b border-[#1e2130]">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-white text-lg font-semibold leading-snug flex-1">
                    {selectedEmail.subject}
                  </h2>
                  <button
                    onClick={(e) => toggleStar(e, selectedEmail.id)}
                    className={`flex-shrink-0 mt-1 transition-colors ${
                      selectedEmail.starred ? "text-[#c9a84c]" : "text-[#4a5568] hover:text-[#c9a84c]"
                    }`}
                  >
                    <StarIcon filled={selectedEmail.starred} className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-[#4a5568] font-semibold uppercase tracking-wide">From</span>
                  <span className="text-[#8892a4]">{selectedEmail.from_email}</span>
                  <span className="text-[#4a5568] font-semibold uppercase tracking-wide">To</span>
                  <span className="text-[#8892a4]">{selectedEmail.to_email}</span>
                  <span className="text-[#4a5568] font-semibold uppercase tracking-wide">Date</span>
                  <span className="text-[#8892a4]">
                    {new Date(selectedEmail.sent_at).toLocaleString([], {
                      month: "long", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="text-[#c8d0e0] text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedEmail.body}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-[#1e2130] flex items-center gap-3">
                <button
                  onClick={() => openCompose({
                    to:      selectedEmail.from_email,
                    subject: `Re: ${selectedEmail.subject}`,
                  })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a] hover:bg-[#26376e] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </button>
                <button
                  onClick={() => openCompose({
                    subject: `Fwd: ${selectedEmail.subject}`,
                    body:    `\n\n--- Forwarded message ---\nFrom: ${selectedEmail.from_email}\nDate: ${new Date(selectedEmail.sent_at).toLocaleString()}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
                  })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#8892a4] hover:bg-[#161b27] hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Forward
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#4a5568]">
              {/* Inline connect prompt when Zoho is not connected */}
              {zohoConnected === false && (
                <div className="mb-6 px-6 py-5 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-center max-w-xs">
                  <p className="text-[#c9a84c] text-sm font-semibold mb-1">Connect Zoho Mail</p>
                  <p className="text-[#8892a4] text-xs mb-4">
                    Link your Zoho account to send and receive real emails from your CRM.
                  </p>
                  <button
                    onClick={connectZoho}
                    disabled={!userId}
                    className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect Zoho
                  </button>
                </div>
              )}
              <svg className="w-14 h-14 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Select an email to read</p>
              <p className="text-xs mt-1 opacity-60">or compose a new message</p>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSend={handleSend}
          initialTo={composePreset.to || ""}
          initialSubject={composePreset.subject || ""}
          initialBody={composePreset.body || ""}
        />
      )}
    </div>
  );
}
