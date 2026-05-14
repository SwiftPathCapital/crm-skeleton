// src/components/LeadExpandedRow.jsx
// All fields are editable inputs. Agent fills in missing data during the call.
// Save button writes back to Supabase in Phase 2.

import React, { useState } from "react";

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

      <SectionHeader title="UCC Filing" />
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
      <Field label="Why Funds" fieldKey="why_funds" value={data.why_funds} onChange={onChange} />
      <Field label="Time in Business" fieldKey="tib" value={data.tib} onChange={onChange} />
      <Field label="Monthly Deposit" fieldKey="monthly_deposit" value={data.monthly_deposit} onChange={onChange} />
      <Field label="Best Time to Call" fieldKey="best_time" value={data.best_time} onChange={onChange} />
      <Field label="FICO Score" fieldKey="fico" value={data.fico} onChange={onChange} type="number" />
      <Field label="Lead Type" fieldKey="lead_type_label" value={data.lead_type_label} onChange={onChange} />
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
      {/* Placeholder uploaded docs */}
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

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function LeadExpandedRow({ lead, onSave }) {
  const [formData, setFormData] = useState({ ...lead });
  const [saved, setSaved] = useState(false);

  function handleChange(key, value) {
    setSaved(false);
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    // Phase 2: replace with Supabase upsert
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
    <div className="bg-[#0d1017] border-t border-[#1e2130] px-6 py-6 overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${typeInfo.color}`}>
            {typeInfo.label} Lead
          </span>
          <span className="text-[#4a5568] text-xs">ID #{lead.id}</span>
        </div>
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
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 min-w-0">
        {/* Shared top fields */}
        <SectionHeader title="Lead Info" />
        <div className="col-span-2 flex flex-col gap-1 min-w-0">
          <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">Phone</label>
          <span className="w-full truncate text-white text-sm px-3 py-2 bg-[#0f1117] border border-[#1e2130] rounded-lg">
            {lead.phone || "—"}
          </span>
        </div>
        <Field label="Lead Vendor" fieldKey="lead_vendor" value={formData.lead_vendor} onChange={handleChange} />
        <div className="flex flex-col gap-1">
          <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">Status</label>
          <select
            value={formData.status ?? "New"}
            onChange={(e) => handleChange("status", e.target.value)}
            className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          >
            {["New","Contacted","Callback","App Sent","App Signed","Not Interested","Funded","DNC"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Lead-type specific fields */}
        {lead.lead_type === "ucc" && <UCCFields data={formData} onChange={handleChange} />}
        {lead.lead_type === "trigger" && <TriggerFields data={formData} onChange={handleChange} />}
        {lead.lead_type === "aged" && <AgedFields data={formData} onChange={handleChange} />}
        {(lead.lead_type === "web" || lead.lead_type === "live_transfer") && (
          <WebFields data={formData} onChange={handleChange} />
        )}

        {/* Documents always visible */}
        <DocumentsSection />
      </div>
    </div>
  );
}
