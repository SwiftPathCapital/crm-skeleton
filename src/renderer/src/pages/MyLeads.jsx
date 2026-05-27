import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import LeadTable from "../components/LeadTable";
import AnnouncementsBanner from "../components/AnnouncementsBanner";
import { LEAD_STATUSES } from "../lib/dispositions";

const LEAD_TYPES = [
  { value: "ucc",           label: "UCC" },
  { value: "trigger",       label: "Trigger" },
  { value: "aged",          label: "Aged" },
  { value: "web",           label: "Web" },
  { value: "live_transfer", label: "Live Transfer" },
];

const STATUSES = LEAD_STATUSES;

const EMPTY = {
  lead_type: "ucc", first_name: "", last_name: "", company_name: "",
  phone: "", email: "", address: "", city: "", state: "", zip: "",
  lead_vendor: "", lead_type_label: "", status: "New",
};

const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors placeholder-[#4a5568]";
const selectCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function Label({ children }) {
  return <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">{children}</label>;
}

function Section({ title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest whitespace-nowrap">{title}</p>
        <div className="flex-1 h-px bg-[#1e2130]" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── CSV parser (handles quoted fields with commas inside) ─────────────────────
function parseCSVRow(line) {
  const result = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) rows.push(parseCSVRow(lines[i]));
  }
  return rows;
}

// ── Vendor column mapping (by index — two "Title" columns exist) ──────────────
// Expected order: Business(Debtor) | Primary Contact | Title | Contact Address |
//                 Secondary Contact | Title | Secured Party(Lender) | State | Filing Date | Filing #
function parseFilingDate(raw) {
  if (!raw) return {};
  // Try MM/DD/YYYY or M/D/YYYY
  let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { filing_month: +m[1], filing_day: +m[2], filing_year: +m[3] };
  // Try YYYY-MM-DD
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { filing_month: +m[2], filing_day: +m[3], filing_year: +m[1] };
  return {};
}

function rowToLead(cols, vendorName, userId) {
  const [
    businessDebtor,   // 0
    primaryContact,   // 1
    primaryTitle,     // 2
    contactAddress,   // 3
    secondaryContact, // 4
    secondaryTitle,   // 5
    securedParty,     // 6
    state,            // 7
    filingDate,       // 8
    filingNumber,     // 9
  ] = cols;

  // Split primary contact into first/last
  const nameParts = (primaryContact || "").trim().split(/\s+/);
  const first_name = nameParts[0] || null;
  const last_name  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  return {
    lead_type:          "ucc",
    status:             "New",
    company_name:       businessDebtor    || null,
    name:               primaryContact    || null,
    first_name,
    last_name,
    title:              primaryTitle      || null,
    address:            contactAddress    || null,
    secondary_contact:  secondaryContact  || null,
    secondary_title:    secondaryTitle    || null,
    sec_partyname:      securedParty      || null,
    state:              state             || null,
    filing_number:      filingNumber      || null,
    lead_vendor:        vendorName        || null,
    assigned_to:        userId,
    created_at:         new Date().toISOString(),
    ...parseFilingDate(filingDate),
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MyLeads({ leads, onSaveLead, onRefresh, onOpenEmailClient }) {
  const { agent, userId } = useApp();

  // Add Lead drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  // Bulk upload
  const fileRef                              = useRef();
  const [uploadPreview, setUploadPreview]    = useState(null); // { rows, vendorName }
  const [uploading, setUploading]            = useState(false);
  const [uploadVendor, setUploadVendor]      = useState("");

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // ── Add single lead ─────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!form.phone.trim() && !form.first_name.trim() && !form.company_name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("leads").insert({
        lead_type:    form.lead_type,
        first_name:   form.first_name   || null,
        last_name:    form.last_name    || null,
        company_name: form.company_name || null,
        phone:        form.phone        || null,
        email:        form.email        || null,
        address:      form.address      || null,
        city:         form.city         || null,
        state:        form.state        || null,
        zip:          form.zip          || null,
        lead_vendor:      form.lead_vendor      || null,
        lead_type_label:  form.lead_type_label  || null,
        status:           form.status,
        assigned_to:      userId,
        created_at:   new Date().toISOString(),
      });
      if (error) throw error;
      setDrawerOpen(false);
      onRefresh?.();
    } catch (err) {
      alert("Error adding lead: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Bulk upload ─────────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) { alert("No data rows found in file."); return; }
      setUploadPreview({ rows, fileName: file.name });
    };
    reader.readAsText(file);
  }

  async function handleUploadConfirm() {
    if (!uploadPreview) return;
    setUploading(true);
    try {
      const leads = uploadPreview.rows.map(cols => rowToLead(cols, uploadVendor, userId));
      // Insert in batches of 500
      for (let i = 0; i < leads.length; i += 500) {
        const { error } = await supabase.from("leads").insert(leads.slice(i, i + 500));
        if (error) throw error;
      }
      setUploadPreview(null);
      setUploadVendor("");
      onRefresh?.();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <AnnouncementsBanner />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">My Leads</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            {agent?.role === "admin"
              ? "Click any row to expand and edit lead details."
              : "Your pipeline is shown by default. Search to find unassigned leads."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] border border-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          {/* Bulk upload */}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] border border-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Bulk Upload
          </button>

          {/* Add single lead */}
          <button
            onClick={() => { setForm(EMPTY); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </button>
        </div>
      </div>

      <LeadTable leads={leads} onSaveLead={onSaveLead} onOpenEmailClient={onOpenEmailClient} onRefresh={onRefresh} />

      {/* ── Bulk Upload Preview Modal ───────────────────────────────────────── */}
      {uploadPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setUploadPreview(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-[#0d1117] border border-[#1e2130] rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-white font-semibold text-lg mb-1">Confirm Upload</h2>
            <p className="text-[#4a5568] text-sm mb-5">
              <span className="text-white font-medium">{uploadPreview.rows.length}</span> UCC leads found in{" "}
              <span className="text-[#c9a84c]">{uploadPreview.fileName}</span>
            </p>

            {/* Column mapping preview */}
            <div className="bg-[#080b10] border border-[#1e2130] rounded-xl p-4 mb-5 text-xs space-y-1.5">
              <p className="text-[#c9a84c] font-bold uppercase tracking-widest text-[10px] mb-2">Column Mapping</p>
              {[
                ["Business (Debtor)",       "company_name"],
                ["Primary Contact",         "first_name + last_name"],
                ["Title",                   "title"],
                ["Contact Address",         "address"],
                ["Secondary Contact",       "secondary_contact"],
                ["Title (2nd)",             "secondary_title"],
                ["Secured Party (Lender)",  "sec_partyname"],
                ["State",                   "state"],
                ["Filing Date",             "filing_month / day / year"],
                ["Filing #",                "filing_number"],
              ].map(([from, to]) => (
                <div key={from} className="flex items-center gap-2">
                  <span className="text-[#8892a4] w-44 flex-shrink-0 truncate">{from}</span>
                  <span className="text-[#2d3748]">→</span>
                  <span className="text-emerald-400">{to}</span>
                </div>
              ))}
            </div>

            {/* Optional vendor name */}
            <div className="mb-5">
              <Label>Lead Vendor (optional)</Label>
              <input
                value={uploadVendor}
                onChange={e => setUploadVendor(e.target.value)}
                className={inputCls}
                placeholder="e.g. UCC vendor name"
              />
            </div>

            {/* Sample row */}
            {uploadPreview.rows[0] && (
              <div className="bg-[#080b10] border border-[#1e2130] rounded-xl p-3 mb-5">
                <p className="text-[#4a5568] text-[10px] font-bold uppercase tracking-widest mb-1.5">First row preview</p>
                <p className="text-white text-xs truncate">{uploadPreview.rows[0].slice(0, 4).join(" · ")}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleUploadConfirm}
                disabled={uploading}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {uploading ? `Uploading…` : `Import ${uploadPreview.rows.length} Leads`}
              </button>
              <button
                onClick={() => setUploadPreview(null)}
                className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lead Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="flex-1 bg-black/40" />
          <div
            className="h-full w-[460px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2130] flex-shrink-0">
              <h2 className="text-white font-semibold">Add Lead</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-[#4a5568] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <Section title="Lead Info">
                <div>
                  <Label>Lead Type</Label>
                  <select value={form.lead_type} onChange={e => f("lead_type", e.target.value)} className={selectCls}>
                    {LEAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={e => f("status", e.target.value)} className={selectCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Lead Vendor</Label>
                  <input value={form.lead_vendor} onChange={e => f("lead_vendor", e.target.value)} className={inputCls} placeholder="e.g. Data vendor name" />
                </div>
                <div>
                  <Label>Lead Source</Label>
                  <input value={form.lead_type_label} onChange={e => f("lead_type_label", e.target.value)} className={inputCls} placeholder="e.g. Google, Referral, Website" />
                </div>
              </Section>

              <Section title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <input value={form.first_name} onChange={e => f("first_name", e.target.value)} className={inputCls} placeholder="John" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <input value={form.last_name} onChange={e => f("last_name", e.target.value)} className={inputCls} placeholder="Smith" />
                  </div>
                </div>
                <div>
                  <Label>Company Name</Label>
                  <input value={form.company_name} onChange={e => f("company_name", e.target.value)} className={inputCls} placeholder="Acme LLC" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <input value={form.phone} onChange={e => f("phone", e.target.value)} className={inputCls} placeholder="+1 (555) 000-0000" />
                </div>
                <div>
                  <Label>Email</Label>
                  <input type="email" value={form.email} onChange={e => f("email", e.target.value)} className={inputCls} placeholder="john@example.com" />
                </div>
              </Section>

              <Section title="Address">
                <div>
                  <Label>Street Address</Label>
                  <input value={form.address} onChange={e => f("address", e.target.value)} className={inputCls} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label>City</Label>
                    <input value={form.city} onChange={e => f("city", e.target.value)} className={inputCls} placeholder="Miami" />
                  </div>
                  <div>
                    <Label>State</Label>
                    <input value={form.state} onChange={e => f("state", e.target.value)} className={inputCls} placeholder="FL" maxLength={2} />
                  </div>
                  <div>
                    <Label>Zip</Label>
                    <input value={form.zip} onChange={e => f("zip", e.target.value)} className={inputCls} placeholder="33101" />
                  </div>
                </div>
              </Section>
            </div>

            <div className="px-6 py-4 border-t border-[#1e2130] flex gap-3 flex-shrink-0">
              <button
                onClick={handleAdd}
                disabled={saving || (!form.phone.trim() && !form.first_name.trim() && !form.company_name.trim())}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {saving ? "Adding…" : "Add Lead"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
