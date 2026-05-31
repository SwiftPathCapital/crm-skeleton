import React, { useState } from "react";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("electron")
    ? "http://localhost:3001"
    : "";

const EMPTY_FORM = {
  contact_name: "", business_name: "", client_email: "", phone: "",
  dba: "", business_address: "", owner_address: "",
  ein: "", time_in_business: "", dob: "", ssn: "",
};

export default function NewApplication() {
  const { getAuthToken } = useApp();

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg,  setSubmitMsg]  = useState(null);

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contact_name.trim() || !form.business_name.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/send-application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessName:      form.business_name.trim(),
          ownerName:         form.contact_name.trim(),
          printName:         form.contact_name.trim(),
          dba:               form.dba.trim(),
          businessAddress:   form.business_address.trim(),
          ownerAddress:      form.owner_address.trim(),
          ein:               form.ein.trim(),
          businessStartDate: form.time_in_business.trim(),
          ownerDOB:          form.dob.trim(),
          ownerSS:           form.ssn.trim(),
          clientEmail:       form.client_email.trim(),
          phone:             form.phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitMsg({ ok: false, msg: typeof json.error === "object" ? JSON.stringify(json.error) : json.error || `Server error ${res.status}` });
      } else {
        setSubmitMsg({ ok: true, msg: "Application sent to submissions inbox." });
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setSubmitMsg({ ok: false, msg: err.message });
    }

    setSubmitting(false);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Send Application</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            Fill out and submit — the completed application is emailed to the submissions inbox.
          </p>
        </div>
      </div>

      <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Owner / Contact Name" required>
              <input type="text" value={form.contact_name} onChange={e => setField("contact_name", e.target.value)}
                placeholder="John Smith" className={inputCls} required />
            </Field>
            <Field label="Business Name" required>
              <input type="text" value={form.business_name} onChange={e => setField("business_name", e.target.value)}
                placeholder="Acme LLC" className={inputCls} required />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client Email">
              <input type="email" value={form.client_email} onChange={e => setField("client_email", e.target.value)}
                placeholder="client@example.com" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={e => setField("phone", e.target.value)}
                placeholder="(555) 555-5555" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="DBA (Doing Business As)">
              <input type="text" value={form.dba} onChange={e => setField("dba", e.target.value)}
                placeholder="Trading name if different" className={inputCls} />
            </Field>
            <Field label="EIN">
              <input type="text" value={form.ein} onChange={e => setField("ein", e.target.value)}
                placeholder="12-3456789" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Date of Birth">
              <input type="text" value={form.dob} onChange={e => setField("dob", e.target.value)}
                placeholder="MM/DD/YYYY" className={inputCls} />
            </Field>
            <Field label="SSN">
              <input type="text" value={form.ssn} onChange={e => setField("ssn", e.target.value)}
                placeholder="XXX-XX-XXXX" className={inputCls} />
            </Field>
            <Field label="Business Start Date">
              <input type="date" value={form.time_in_business} onChange={e => setField("time_in_business", e.target.value)}
                className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Address">
              <input type="text" value={form.business_address} onChange={e => setField("business_address", e.target.value)}
                placeholder="123 Main St, City, ST 00000" className={inputCls} />
            </Field>
            <Field label="Owner Address">
              <input type="text" value={form.owner_address} onChange={e => setField("owner_address", e.target.value)}
                placeholder="123 Home St, City, ST 00000" className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={submitting || !form.contact_name.trim() || !form.business_name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              {submitting ? "Sending…" : "Send Application"}
            </button>
            {submitMsg && (
              <p className={`text-sm ${submitMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {submitMsg.ok ? "✓ " : "✗ "}{submitMsg.msg}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">
        {label}{required && <span className="text-[#c9a84c] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
