import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

const EMPTY_FORM = {
  client_email: "", contact_name: "", business_name: "",
  dba: "", business_address: "", business_start_date: "",
  ein: "", owner_ssn: "", owner_dob: "", owner_address: "", phone: "",
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NewApplication({ agent }) {
  const { userId, agent: ctxAgent } = useApp();
  const resolvedAgent = agent || ctxAgent;
  const isAdmin = resolvedAgent?.role === "admin";

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg,  setSubmitMsg]  = useState(null);

  const [subs,        setSubs]        = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [agentMap,    setAgentMap]    = useState({});

  const fetchSubs = useCallback(async () => {
    setSubsLoading(true);
    let q = supabase
      .from("docuseal_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("agent_id", userId);
    const { data } = await q;
    setSubs(data || []);
    setSubsLoading(false);
  }, [isAdmin, userId]);

  useEffect(() => {
    if (!userId) return;
    fetchSubs();
    if (isAdmin) {
      supabase.from("agents").select("id, name, email").then(({ data }) => {
        const map = {};
        (data || []).forEach(a => { map[a.id] = a.name || a.email; });
        setAgentMap(map);
      });
    }
  }, [userId, fetchSubs]);

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_email.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/api/docuseal/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientEmail:        form.client_email.trim(),
          contactName:        form.contact_name.trim()         || null,
          businessName:       form.business_name.trim()        || null,
          dba:                form.dba.trim()                  || null,
          businessAddress:    form.business_address.trim()     || null,
          businessStartDate:  form.business_start_date.trim()  || null,
          ein:                form.ein.trim()                  || null,
          ownerSSN:           form.owner_ssn.trim()            || null,
          ownerDOB:           form.owner_dob.trim()            || null,
          ownerAddress:       form.owner_address.trim()        || null,
          phone:              form.phone.trim()                || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitMsg({ ok: false, msg: json.error || `Server error ${res.status}` });
      } else {
        setSubmitMsg({ ok: true, msg: `Sent to ${form.client_email.trim()}.`, url: json.signingUrl });
        setForm(EMPTY_FORM);
        fetchSubs();
      }
    } catch (err) {
      setSubmitMsg({ ok: false, msg: err.message });
    }

    setSubmitting(false);
  }

  const STATUS_STYLE = {
    sent:      "bg-[#1e2130] text-[#8892a4] border-[#2d3748]",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    declined:  "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">Applications</h1>
        <p className="text-[#4a5568] text-sm mt-1">
          Fill in what you have — the client completes anything left blank when they sign.
        </p>
      </div>

      <div className="flex flex-col gap-8 pb-8">

        {/* Send form */}
        <section>
          <SectionTitle>Send for Signature</SectionTitle>
          <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              <GroupHeader>Client Contact</GroupHeader>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Client Email" required>
                  <input type="email" value={form.client_email} onChange={e => setField("client_email", e.target.value)}
                    placeholder="client@example.com" className={inputCls} required />
                </Field>
                <Field label="Owner / Contact Name">
                  <input type="text" value={form.contact_name} onChange={e => setField("contact_name", e.target.value)}
                    placeholder="John Smith" className={inputCls} />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={form.phone} onChange={e => setField("phone", e.target.value)}
                    placeholder="(555) 555-5555" className={inputCls} />
                </Field>
              </div>

              <GroupHeader>Business Info</GroupHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business Name">
                  <input type="text" value={form.business_name} onChange={e => setField("business_name", e.target.value)}
                    placeholder="Acme LLC" className={inputCls} />
                </Field>
                <Field label="DBA">
                  <input type="text" value={form.dba} onChange={e => setField("dba", e.target.value)}
                    placeholder="Trading name if different" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Business Address">
                  <input type="text" value={form.business_address} onChange={e => setField("business_address", e.target.value)}
                    placeholder="123 Main St, City, ST 00000" className={inputCls} />
                </Field>
                <Field label="Business Start Date">
                  <input type="date" value={form.business_start_date} onChange={e => setField("business_start_date", e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="EIN">
                  <input type="text" value={form.ein} onChange={e => setField("ein", e.target.value)}
                    placeholder="12-3456789" className={inputCls} />
                </Field>
              </div>

              <GroupHeader>Owner Info</GroupHeader>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Owner Address">
                  <input type="text" value={form.owner_address} onChange={e => setField("owner_address", e.target.value)}
                    placeholder="123 Home St, City, ST 00000" className={inputCls} />
                </Field>
                <Field label="Date of Birth">
                  <input type="text" value={form.owner_dob} onChange={e => setField("owner_dob", e.target.value)}
                    placeholder="MM/DD/YYYY" className={inputCls} />
                </Field>
                <Field label="SSN">
                  <input type="text" value={form.owner_ssn} onChange={e => setField("owner_ssn", e.target.value)}
                    placeholder="XXX-XX-XXXX" className={inputCls} />
                </Field>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !form.client_email.trim()}
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
                    {submitMsg.ok && submitMsg.url && (
                      <> · <a href={submitMsg.url} target="_blank" rel="noreferrer" className="underline">View signing link</a></>
                    )}
                  </p>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* History */}
        <section>
          <SectionTitle>{isAdmin ? "All Sent Applications" : "My Sent Applications"}</SectionTitle>
          {subsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : subs.length === 0 ? (
            <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl p-8 text-center">
              <p className="text-[#4a5568] text-sm">No applications sent yet.</p>
            </div>
          ) : (
            <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2130]">
                    {isAdmin && <Th>Agent</Th>}
                    <Th>Contact</Th>
                    <Th>Business</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Sent</Th>
                    <Th>Link</Th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s, i) => (
                    <tr key={s.id} className={`border-b border-[#1e2130] last:border-0 ${i % 2 ? "bg-[#0a0e14]" : ""}`}>
                      {isAdmin && <Td><span className="text-[#8892a4]">{agentMap[s.agent_id] || "—"}</span></Td>}
                      <Td>{s.contact_name || "—"}</Td>
                      <Td><span className="text-[#8892a4]">{s.business_name || "—"}</span></Td>
                      <Td><span className="text-[#8892a4]">{s.client_email}</span></Td>
                      <Td>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLE[s.status] || STATUS_STYLE.sent}`}>
                          {s.status}
                        </span>
                      </Td>
                      <Td><span className="text-[#4a5568]">{fmt(s.created_at)}</span></Td>
                      <Td>
                        {s.signing_url
                          ? <a href={s.signing_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-xs">Open</a>
                          : <span className="text-[#2d3748]">—</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest whitespace-nowrap">{children}</p>
      <div className="flex-1 h-px bg-[#1e2130]" />
    </div>
  );
}

function GroupHeader({ children }) {
  return <p className="text-[#8892a4] text-xs font-semibold uppercase tracking-wider -mb-1">{children}</p>;
}

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

function Th({ children }) {
  return <th className="text-left px-4 py-3 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">{children}</th>;
}

function Td({ children }) {
  return <td className="px-4 py-3 text-white text-xs">{children}</td>;
}
