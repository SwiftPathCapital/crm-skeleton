// src/components/LeadExpandedRow.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { LEAD_STATUSES } from "../lib/dispositions";

function Field({ label, fieldKey, value, onChange, type = "text", fullWidth = false }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${fullWidth ? "col-span-2" : ""}`}>
      <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white
          placeholder-[#4a5568] focus:outline-none focus:border-blue-500 focus:ring-1
          focus:ring-blue-500 transition-colors"
        placeholder="—"
      />
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="col-span-2 flex items-center gap-3 mt-2 mb-1">
      <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <div className="flex-1 h-px bg-[#1e2130]" />
    </div>
  );
}

// ── UCC FIELDS ──────────────────────────────────────────────────────────────
function UCCFields({ data, onChange }) {
  return (
    <>
      <SectionHeader title="Contact Info" />
      <Field label="Name" fieldKey="name" value={data.name} onChange={onChange} />
      <Field label="Title" fieldKey="title" value={data.title} onChange={onChange} />
      <Field label="Email" fieldKey="email" value={data.email} onChange={onChange} type="email" />
      <Field label="Number Type" fieldKey="number_type" value={data.number_type} onChange={onChange} />
      <Field label="Address" fieldKey="address" value={data.address} onChange={onChange} fullWidth />
      <Field label="City" fieldKey="city" value={data.city} onChange={onChange} />
      <Field label="Zip" fieldKey="zip" value={data.zip} onChange={onChange} />

      <SectionHeader title="Business Info" />
      <Field label="SIC Code" fieldKey="sic_code" value={data.sic_code} onChange={onChange} />
      <Field label="SIC Description" fieldKey="sic_description" value={data.sic_description} onChange={onChange} />
      <Field label="Employee Size" fieldKey="employee_size" value={data.employee_size} onChange={onChange} type="number" />
      <Field label="Revenue" fieldKey="revenue" value={data.revenue} onChange={onChange} />

      <SectionHeader title="Secondary Contact" />
      <Field label="Secondary Contact" fieldKey="secondary_contact" value={data.secondary_contact} onChange={onChange} />
      <Field label="Title" fieldKey="secondary_title" value={data.secondary_title} onChange={onChange} />

      <SectionHeader title="UCC Filing" />
      <Field label="Filing #" fieldKey="filing_number" value={data.filing_number} onChange={onChange} />
      <Field label="Filing Day" fieldKey="filing_day" value={data.filing_day} onChange={onChange} type="number" />
      <Field label="Filing Month" fieldKey="filing_month" value={data.filing_month} onChange={onChange} type="number" />
      <Field label="Filing Year" fieldKey="filing_year" value={data.filing_year} onChange={onChange} type="number" />
      <Field label="Secured Party Name" fieldKey="sec_partyname" value={data.sec_partyname} onChange={onChange} fullWidth />
    </>
  );
}

// ── TRIGGER FIELDS ───────────────────────────────────────────────────────────
function TriggerFields({ data, onChange }) {
  return (
    <>
      <SectionHeader title="Contact Info" />
      <Field label="Name" fieldKey="name" value={data.name} onChange={onChange} />
      <Field label="Title" fieldKey="title" value={data.title} onChange={onChange} />
      <Field label="Email" fieldKey="email" value={data.email} onChange={onChange} type="email" />
      <Field label="Number Type" fieldKey="number_type" value={data.number_type} onChange={onChange} />

      <SectionHeader title="Business Info" />
      <Field label="SIC Code" fieldKey="sic_code" value={data.sic_code} onChange={onChange} />
      <Field label="SIC Description" fieldKey="sic_description" value={data.sic_description} onChange={onChange} fullWidth />

      <SectionHeader title="Trigger Date" />
      <Field label="Day" fieldKey="day" value={data.day} onChange={onChange} type="number" />
      <Field label="Month" fieldKey="month" value={data.month} onChange={onChange} type="number" />
      <Field label="Year" fieldKey="year" value={data.year} onChange={onChange} type="number" />
    </>
  );
}

// ── AGED FIELDS ──────────────────────────────────────────────────────────────
function AgedFields({ data, onChange }) {
  return (
    <>
      <SectionHeader title="Contact Info" />
      <Field label="Name" fieldKey="name" value={data.name} onChange={onChange} />
      <Field label="Email" fieldKey="email" value={data.email} onChange={onChange} type="email" />
      <Field label="Line Type" fieldKey="line_type" value={data.line_type} onChange={onChange} />
    </>
  );
}

// ── WEB / LIVE TRANSFER FIELDS ───────────────────────────────────────────────
function WebFields({ data, onChange }) {
  return (
    <>
      <SectionHeader title="Contact Info" />
      <Field label="Name" fieldKey="name" value={data.name} onChange={onChange} />
      <Field label="Email" fieldKey="email" value={data.email} onChange={onChange} type="email" />

      <SectionHeader title="Application Info" />
      <Field label="Requested Amount" fieldKey="requested_amount" value={data.requested_amount} onChange={onChange} />
      <Field label="Notes / Why Funds" fieldKey="why_funds" value={data.why_funds} onChange={onChange} />
      <Field label="Time in Business" fieldKey="tib" value={data.tib} onChange={onChange} type="date" />
      <Field label="Monthly Deposit" fieldKey="monthly_deposit" value={data.monthly_deposit} onChange={onChange} />
      <Field label="Best Time to Call" fieldKey="best_time" value={data.best_time} onChange={onChange} />
      <Field label="FICO Score" fieldKey="fico" value={data.fico} onChange={onChange} type="number" />
      <Field label="Lead Source" fieldKey="lead_type_label" value={data.lead_type_label} onChange={onChange} />
      <Field label="Date Sold" fieldKey="date_sold" value={data.date_sold} onChange={onChange} />
    </>
  );
}

// ── DOCUMENTS SECTION ────────────────────────────────────────────────────────
function DocumentsSection() {
  return (
    <div className="col-span-2 mt-2">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Documents</p>
        <div className="flex-1 h-px bg-[#1e2130]" />
      </div>
      <div className="border-2 border-dashed border-[#1e2130] rounded-xl p-6 text-center hover:border-blue-500 transition-colors cursor-pointer group">
        <svg className="w-8 h-8 text-[#4a5568] group-hover:text-blue-400 mx-auto mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-[#4a5568] text-sm group-hover:text-white transition-colors">
          Drop files here or <span className="text-blue-400">browse</span>
        </p>
        <p className="text-[#2d3748] text-xs mt-1">PDF, DOC, JPG up to 25MB</p>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 bg-[#0f1117] border border-[#1e2130] rounded-lg px-4 py-2">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <span className="text-white text-xs flex-1">bank_statement_march.pdf</span>
          <span className="text-[#4a5568] text-xs">2.4 MB</span>
          <button className="text-[#4a5568] hover:text-red-400 transition-colors ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function initials(name) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
}

// ── NOTES TAB ─────────────────────────────────────────────────────────────────
function NotesTab({ lead }) {
  const { agent } = useApp();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [lead.id]);

  async function fetchComments() {
    setLoading(true);
    const { data } = await supabase
      .from("lead_comments")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true });
    setComments(data || []);
    setLoading(false);
  }

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("lead_comments").insert({
      lead_id: lead.id,
      agent_id: agent?.id ?? null,
      agent_name: agent?.name || "Unknown",
      content: text.trim(),
    });
    if (!error) {
      setText("");
      fetchComments();
    }
    setPosting(false);
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " at " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  return (
    <div className="col-span-2 flex flex-col gap-3">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#4a5568]">
          <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">No notes yet</p>
          <p className="text-xs mt-1 opacity-60">Add the first note on this lead</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0 mt-0.5">
                {initials(comment.agent_name)}
              </div>
              <div className="flex-1 bg-[#0f1117] border border-[#1e2130] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white text-xs font-semibold">{comment.agent_name}</span>
                  <span className="text-[#4a5568] text-xs">{formatDate(comment.created_at)}</span>
                </div>
                <p className="text-[#8892a4] text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose */}
      <div className="flex gap-3 items-start">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0 mt-0.5">
          {initials(agent?.name)}
        </div>
        <div className="flex-1 bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden focus-within:border-[#c9a84c]/50 transition-colors">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
            }}
            placeholder="Add a note…"
            rows={3}
            className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-[#4a5568] outline-none resize-none"
          />
          <div className="px-3 py-2 border-t border-[#1e2130] flex items-center justify-between">
            <span className="text-[#4a5568] text-xs">Ctrl + Enter to post</span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {posting ? (
                <div className="w-3.5 h-3.5 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
              ) : (
                "Post Note"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RECORDINGS TAB ───────────────────────────────────────────────────────────
const API_BASE = window.location?.protocol === "file:" ? "http://localhost:3001" : "";

function fmt(secs) {
  if (!secs) return null;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function RecordingsTab({ lead }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lead.phone) { setLoading(false); return; }
    const digits = lead.phone.replace(/\D/g, "").slice(-10);
    fetch(`${API_BASE}/api/lead-recordings?phone=${digits}`)
      .then(r => r.json())
      .then(d => setRecordings(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lead.id, lead.phone]);

  if (loading) return <p className="text-[#4a5568] text-sm py-4">Loading recordings…</p>;

  if (!recordings.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-[#4a5568] text-sm">No recordings found for this number.</p>
        <p className="text-[#2d3748] text-xs mt-1">Recordings appear 20 min after a call ends.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 col-span-2">
      {recordings.map(rec => (
        <div key={rec.id} className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rec.direction === "inbound" ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"}`}>
                {rec.direction === "inbound" ? "Inbound" : "Outbound"}
              </span>
              {rec.disposition && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e2130] text-[#8892a4]">{rec.disposition}</span>
              )}
              {fmt(rec.duration_seconds) && (
                <span className="text-xs text-[#4a5568]">{fmt(rec.duration_seconds)}</span>
              )}
            </div>
            <span className="text-xs text-[#4a5568]">
              {rec.started_at ? new Date(rec.started_at).toLocaleString() : ""}
            </span>
          </div>
          {rec.notes && (
            <p className="text-xs text-[#8892a4] italic">"{rec.notes}"</p>
          )}
          <audio
            controls
            src={rec.recording_url}
            className="w-full h-9"
            style={{ colorScheme: "dark" }}
          />
        </div>
      ))}
    </div>
  );
}

// ── EMAILS TAB ───────────────────────────────────────────────────────────────
function EmailsTab({ lead, onOpenEmailClient }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: lead.email || "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [flashSent, setFlashSent] = useState(false);

  useEffect(() => {
    fetchLeadEmails();
  }, [lead.id]);

  async function fetchLeadEmails() {
    setLoading(true);
    const { data } = await supabase
      .from("emails")
      .select("*")
      .eq("lead_id", lead.id)
      .order("sent_at", { ascending: false });
    setEmails(data || []);
    setLoading(false);
  }

  async function handleSend() {
    if (!composeForm.to.trim() || !composeForm.subject.trim()) return;
    setSending(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const fromEmail = authData?.user?.email || "admin@swiftpathcapital.net";
      const { error } = await supabase.from("emails").insert({
        lead_id: lead.id,
        from_email: fromEmail,
        to_email: composeForm.to.trim(),
        subject: composeForm.subject.trim(),
        body: composeForm.body,
        folder: "sent",
        read: true,
        sent_at: new Date().toISOString(),
      });
      if (!error) {
        setShowCompose(false);
        setComposeForm({ to: lead.email || "", subject: "", body: "" });
        setFlashSent(true);
        setTimeout(() => setFlashSent(false), 2500);
        fetchLeadEmails();
      }
    } finally {
      setSending(false);
    }
  }

  function formatEmailDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  const cf = (key, val) => setComposeForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="col-span-2 space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-[#4a5568] text-xs">
          {loading ? "Loading…" : `${emails.length} email${emails.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex items-center gap-3">
          {flashSent && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sent
            </span>
          )}
          <button
            onClick={() => setShowCompose((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showCompose ? "Cancel" : "Compose"}
          </button>
        </div>
      </div>

      {/* Inline compose panel */}
      {showCompose && (
        <div className="bg-[#0f1117] border border-[#2a3040] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[#1a2035] border-b border-[#1e2130] flex items-center justify-between">
            <span className="text-white text-xs font-semibold">New Message</span>
            <button onClick={() => setShowCompose(false)} className="text-[#4a5568] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-3 space-y-2.5 border-b border-[#1e2130]">
            {[
              { key: "to", label: "To", type: "email" },
              { key: "subject", label: "Subject", type: "text" },
            ].map(({ key, label, type }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[#4a5568] text-xs font-semibold uppercase tracking-wide w-14 flex-shrink-0">{label}</span>
                <input
                  type={type}
                  value={composeForm[key]}
                  onChange={(e) => cf(key, e.target.value)}
                  className="flex-1 bg-transparent border-b border-[#1e2130] focus:border-[#c9a84c] py-1 text-xs text-white outline-none transition-colors placeholder-[#4a5568]"
                  placeholder={key === "to" ? "recipient@example.com" : "Email subject"}
                />
              </div>
            ))}
          </div>

          <textarea
            value={composeForm.body}
            onChange={(e) => cf("body", e.target.value)}
            placeholder="Write your message…"
            rows={5}
            className="w-full bg-transparent px-4 py-3 text-xs text-white placeholder-[#4a5568] outline-none resize-none"
          />

          <div className="px-4 py-2.5 border-t border-[#1e2130] flex items-center justify-between">
            <button
              onClick={() => setShowCompose(false)}
              className="text-[#4a5568] text-xs hover:text-white transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={!composeForm.to.trim() || !composeForm.subject.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <div className="w-3.5 h-3.5 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#4a5568]">
          <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No emails with this lead yet</p>
          <p className="text-xs mt-1 opacity-60">Use Compose to send the first message</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {emails.map((email) => {
            const isOutbound = email.from_email?.toLowerCase().includes("swiftpath");
            return (
              <div
                key={email.id}
                className="flex items-center gap-3 bg-[#0f1117] border border-[#1e2130] rounded-lg px-4 py-3 hover:border-[#2a3040] transition-colors group"
              >
                {/* Direction dot */}
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${isOutbound ? "bg-[#c9a84c]" : "bg-blue-400"}`}
                  title={isOutbound ? "Outbound" : "Inbound"}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-medium truncate">
                      {isOutbound ? `To: ${email.to_email}` : `From: ${email.from_email}`}
                    </span>
                    {!email.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[#8892a4] text-xs truncate mt-0.5">
                    {email.subject || "(no subject)"}
                  </p>
                </div>

                {/* Date */}
                <span className="text-[#4a5568] text-xs flex-shrink-0">{formatEmailDate(email.sent_at)}</span>

                {/* Open in Email Client */}
                {onOpenEmailClient && (
                  <button
                    onClick={() => onOpenEmailClient({ initialEmailId: email.id })}
                    className="text-[#2d3748] group-hover:text-[#4a5568] hover:text-[#c9a84c] transition-colors flex-shrink-0"
                    title="Open in Email Client"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function LeadExpandedRow({ lead, onSave, onOpenEmailClient }) {
  const { agent, userId } = useApp();
  const isAdmin = agent?.role === "admin";
  const [formData, setFormData] = useState({ ...lead });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [agentsList, setAgentsList] = useState([]);

  // Callback scheduling modal
  const [cbModal, setCbModal]   = useState(false);
  const [cbForm,  setCbForm]    = useState({ scheduled_at: "", notes: "" });
  const [cbSaving, setCbSaving] = useState(false);
  const [cbSaved,  setCbSaved]  = useState(false);

  async function saveCallback() {
    if (!cbForm.scheduled_at) return;
    setCbSaving(true);
    await supabase.from("callbacks").insert({
      agent_id:     userId,
      lead_id:      lead.id,
      lead_phone:   lead.phone || null,
      lead_name:    lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
      scheduled_at: new Date(cbForm.scheduled_at).toISOString(),
      notes:        cbForm.notes || null,
      completed:    false,
    });
    setCbSaving(false);
    setCbSaved(true);
    setCbModal(false);
    setCbForm({ scheduled_at: "", notes: "" });
    setTimeout(() => setCbSaved(false), 3000);
  }

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("agents")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAgentsList(data || []));
  }, [isAdmin]);

  function handleChange(key, value) {
    setSaved(false);
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const leadTypeLabels = {
    ucc: { label: "UCC", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    trigger: { label: "Trigger", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    aged: { label: "Aged", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    web: { label: "Web", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    live_transfer: { label: "Live Transfer", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  };

  const typeInfo = leadTypeLabels[lead.lead_type] || { label: lead.lead_type, color: "bg-gray-500/20 text-gray-400" };

  return (
    <>
    <div className="bg-[#0d1017] border-t border-[#1e2130] px-6 py-5 overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${typeInfo.color}`}>
            {typeInfo.label} Lead
          </span>
          <span className="text-[#4a5568] text-xs">ID #{lead.id}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Schedule Callback button */}
          <button
            onClick={() => setCbModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              cbSaved
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {cbSaved ? "Scheduled!" : "Schedule Callback"}
          </button>
          <a
            href="https://www.swiftpathcapital.net/agent-tools"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Create Application
          </a>
          {activeTab === "details" && (
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                saved
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1e2130] mb-5">
        {[
          { id: "details", label: "Details" },
          { id: "emails", label: "Emails" },
          { id: "notes", label: "Notes" },
          { id: "recordings", label: "Recordings" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-[#c9a84c] border-[#c9a84c] bg-[#c9a84c]/5"
                : "text-[#4a5568] border-transparent hover:text-[#8892a4]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {activeTab === "details" && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 min-w-0">
          <SectionHeader title="Lead Info" />

          <Field label="First Name"    fieldKey="first_name"   value={formData.first_name}   onChange={handleChange} />
          <Field label="Last Name"     fieldKey="last_name"    value={formData.last_name}    onChange={handleChange} />
          <Field label="Company Name"  fieldKey="company_name" value={formData.company_name} onChange={handleChange} fullWidth />
          <Field label="Phone"         fieldKey="phone"        value={formData.phone}        onChange={handleChange} />
          <Field label="Email"         fieldKey="email"        value={formData.email}        onChange={handleChange} type="email" />
          <Field label="Address"       fieldKey="address"      value={formData.address}      onChange={handleChange} fullWidth />
          <Field label="City"          fieldKey="city"         value={formData.city}         onChange={handleChange} />
          <Field label="State"         fieldKey="state"        value={formData.state}        onChange={handleChange} />
          <Field label="Zip"           fieldKey="zip"          value={formData.zip}          onChange={handleChange} />
          <Field label="Lead Vendor"   fieldKey="lead_vendor"  value={formData.lead_vendor}  onChange={handleChange} />

          <div className="flex flex-col gap-1">
            <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">Status</label>
            <select
              value={formData.status ?? "New"}
              onChange={(e) => handleChange("status", e.target.value)}
              className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              {LEAD_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {isAdmin && agentsList.length > 0 && (
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">Assign To Agent</label>
              <select
                value={formData.assigned_to ?? ""}
                onChange={(e) => handleChange("assigned_to", e.target.value || null)}
                className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white
                  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="">— Unassigned —</option>
                {agentsList.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {lead.lead_type === "ucc" && <UCCFields data={formData} onChange={handleChange} />}
          {lead.lead_type === "trigger" && <TriggerFields data={formData} onChange={handleChange} />}
          {lead.lead_type === "aged" && <AgedFields data={formData} onChange={handleChange} />}
          {(lead.lead_type === "web" || lead.lead_type === "live_transfer") && (
            <WebFields data={formData} onChange={handleChange} />
          )}

          <DocumentsSection />
        </div>
      )}

      {/* Emails tab */}
      {activeTab === "emails" && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 min-w-0">
          <EmailsTab lead={lead} onOpenEmailClient={onOpenEmailClient} />
        </div>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 min-w-0">
          <NotesTab lead={lead} />
        </div>
      )}

      {/* Recordings tab */}
      {activeTab === "recordings" && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 min-w-0">
          <RecordingsTab lead={lead} />
        </div>
      )}

    </div>

    {/* Callback scheduling modal */}
    {cbModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-white font-bold text-lg">Schedule Callback</h2>
            <p className="text-[#4a5568] text-xs mt-0.5">
              {lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.phone}
            </p>
          </div>
          <div>
            <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={cbForm.scheduled_at}
              onChange={e => setCbForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Notes</label>
            <textarea
              value={cbForm.notes}
              onChange={e => setCbForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="What to follow up on…"
              className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors resize-none placeholder-[#4a5568]"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setCbModal(false)} className="flex-1 py-2 rounded-lg border border-[#1e2130] text-[#8892a4] hover:border-[#2d3748] text-sm transition-colors">Cancel</button>
            <button
              onClick={saveCallback}
              disabled={!cbForm.scheduled_at || cbSaving}
              className="flex-1 py-2 rounded-lg bg-[#c9a84c] hover:bg-[#b8963e] text-black font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {cbSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
