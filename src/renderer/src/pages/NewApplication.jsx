import React, { useState } from "react";

function AppField({ label, value, onChange, type = "text", placeholder = "", required = false, fullWidth = false }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "—"}
        required={required}
        className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c] transition-colors placeholder-[#4a5568]"
      />
    </div>
  );
}

const EMPTY = {
  businessName: "",
  dba: "",
  businessAddress: "",
  businessStartDate: "",
  ein: "",
  ownerName: "",
  ownerSS: "",
  ownerDOB: "",
  ownerAddress: "",
  printName: "",
};

export default function NewApplication() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/send-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(EMPTY);
    setSubmitted(false);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">New Application</h1>
          <p className="text-[#4a5568] text-sm mt-1">Submit a merchant cash advance application to submissions@swiftpathtocapital.com</p>
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold text-xl">Application Sent!</p>
          <p className="text-[#4a5568] text-sm mt-2">Submitted to submissions@swiftpathtocapital.com</p>
          <button
            onClick={handleReset}
            className="mt-8 px-6 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            Start Another Application
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="max-w-2xl space-y-8">
            {/* Business Information */}
            <div className="bg-[#0d1117] border border-[#1e2130] rounded-xl p-6">
              <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-5">Business Information</p>
              <div className="grid grid-cols-2 gap-4">
                <AppField label="Business Name" value={form.businessName} onChange={(v) => set("businessName", v)} required />
                <AppField label="DBA" value={form.dba} onChange={(v) => set("dba", v)} />
                <AppField label="Business Address" value={form.businessAddress} onChange={(v) => set("businessAddress", v)} fullWidth />
                <AppField label="Business Start Date" value={form.businessStartDate} onChange={(v) => set("businessStartDate", v)} type="date" />
                <AppField label="EIN" value={form.ein} onChange={(v) => set("ein", v)} placeholder="Optional" />
              </div>
            </div>

            {/* Owner Information */}
            <div className="bg-[#0d1117] border border-[#1e2130] rounded-xl p-6">
              <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-5">Owner Information</p>
              <div className="grid grid-cols-2 gap-4">
                <AppField label="Owner Name" value={form.ownerName} onChange={(v) => set("ownerName", v)} required />
                <AppField label="Owner SS#" value={form.ownerSS} onChange={(v) => set("ownerSS", v)} placeholder="Optional" />
                <AppField label="Date of Birth" value={form.ownerDOB} onChange={(v) => set("ownerDOB", v)} type="date" />
                <AppField label="Owner Address" value={form.ownerAddress} onChange={(v) => set("ownerAddress", v)} />
              </div>
            </div>

            {/* Signature */}
            <div className="bg-[#0d1117] border border-[#1e2130] rounded-xl p-6">
              <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-5">Signature</p>
              <div className="grid grid-cols-2 gap-4">
                <AppField label="Print Name" value={form.printName} onChange={(v) => set("printName", v)} required />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pb-6">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                {submitting ? "Sending…" : "Send Application"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
              >
                Clear Form
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
