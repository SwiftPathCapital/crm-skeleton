import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("electron")
    ? "http://localhost:3001"
    : "";

const STATUS_STYLES = {
  approved: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Sent" },
  pending:  { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",       label: "Sending…" },
  rejected: { bg: "bg-red-500/10 text-red-400 border-red-500/20",             label: "Failed" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${s.bg}`}>
      {s.label}
    </span>
  );
}

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY_FORM = {
  contact_name: "", business_name: "", client_email: "", deal_id: "",
  phone: "", dba: "", business_address: "", owner_address: "",
  ein: "", time_in_business: "", dob: "", ssn: "",
};

export default function NewApplication({ agent }) {
  const { userId, agent: ctxAgent, getAuthToken } = useApp();
  const resolvedAgent = agent || ctxAgent;
  const isAdmin = resolvedAgent?.role === "admin";

  const [requests,   setRequests]   = useState([]);
  const [deals,      setDeals]      = useState([]);
  const [agentMap,   setAgentMap]   = useState({});
  const [loading,    setLoading]    = useState(true);

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg,  setSubmitMsg]  = useState(null);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchRequests(), fetchDeals(), fetchAgents()]).then(() => setLoading(false));
  }, [userId]);

  async function fetchRequests() {
    const { data } = await supabase
      .from("application_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }

  async function fetchDeals() {
    let q = supabase.from("deals").select("id, contact_name, business_name").order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("assigned_agent_id", userId);
    const { data } = await q;
    setDeals(data || []);
  }

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("id, name, email");
    const map = {};
    (data || []).forEach(a => { map[a.id] = a.name || a.email; });
    setAgentMap(map);
  }

  function setField(key, val) {
    if (key === "deal_id" && val) {
      const deal = deals.find(d => d.id === val);
      if (deal) {
        setForm(f => ({
          ...f, deal_id: val,
          contact_name:  deal.contact_name  || f.contact_name,
          business_name: deal.business_name || f.business_name,
        }));
        return;
      }
    }
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contact_name.trim() || !form.business_name.trim() || !form.client_email.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);

    // 1. Insert the request row
    const { data: inserted, error: insertError } = await supabase
      .from("application_requests")
      .insert({
        agent_id:         userId,
        contact_name:     form.contact_name.trim(),
        business_name:    form.business_name.trim(),
        client_email:     form.client_email.trim(),
        deal_id:          form.deal_id || null,
        phone:            form.phone.trim(),
        dba:              form.dba.trim(),
        business_address: form.business_address.trim(),
        owner_address:    form.owner_address.trim(),
        ein:              form.ein.trim(),
        time_in_business: form.time_in_business.trim(),
        dob:              form.dob.trim(),
        ssn:              form.ssn.trim(),
      })
      .select()
      .single();

    if (insertError) {
      setSubmitMsg({ ok: false, msg: insertError.message });
      setSubmitting(false);
      return;
    }

    // 2. Fire SignWell immediately — no approval step
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/application-requests/${inserted.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitMsg({ ok: false, msg: typeof json.error === "object" ? JSON.stringify(json.error) : json.error || `Server error ${res.status}` });
      } else {
        setSubmitMsg({ ok: true, msg: "Application sent to client for signature." });
        setForm(EMPTY_FORM);
        await fetchRequests();
      }
    } catch (err) {
      setSubmitMsg({ ok: false, msg: err.message });
    }

    setSubmitting(false);
  }

  const myRequests = isAdmin ? requests : requests.filter(r => r.agent_id === userId);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[#c9a84c] text-sm animate-pulse">Loading…</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Send Application</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            Fill out the form and the client will receive a SignWell signing link immediately.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 pb-8">

        {/* ── Submit form ─────────────────────────────────────────────────── */}
        <section>
          <SectionTitle>Application Details</SectionTitle>
          <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Row 1 */}
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

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Client Email" required>
                  <input type="email" value={form.client_email} onChange={e => setField("client_email", e.target.value)}
                    placeholder="client@example.com" className={inputCls} required />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={form.phone} onChange={e => setField("phone", e.target.value)}
                    placeholder="(555) 555-5555" className={inputCls} />
                </Field>
              </div>

              {/* Row 3 */}
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

              {/* Row 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Date of Birth">
                  <input type="text" value={form.dob} onChange={e => setField("dob", e.target.value)}
                    placeholder="MM/DD/YYYY" className={inputCls} />
                </Field>
                <Field label="SSN">
                  <input type="text" value={form.ssn} onChange={e => setField("ssn", e.target.value)}
                    placeholder="XXX-XX-XXXX" className={inputCls} />
                </Field>
                <Field label="Time in Business">
                  <input type="date" value={form.time_in_business} onChange={e => setField("time_in_business", e.target.value)}
                    className={inputCls} />
                </Field>
              </div>

              {/* Row 5 */}
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

              {/* Row 6 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Link to Deal (optional)">
                  <select value={form.deal_id} onChange={e => setField("deal_id", e.target.value)} className={inputCls}>
                    <option value="">— None —</option>
                    {deals.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.contact_name || d.business_name || d.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !form.contact_name.trim() || !form.business_name.trim() || !form.client_email.trim()}
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
        </section>

        {/* ── History table ─────────────────────────────────────────────── */}
        <section>
          <SectionTitle>{isAdmin ? "All Sent Applications" : "My Sent Applications"}</SectionTitle>
          {myRequests.length === 0 ? (
            <EmptyCard>No applications sent yet.</EmptyCard>
          ) : (
            <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2130]">
                    {isAdmin && <Th>Agent</Th>}
                    <Th>Contact</Th>
                    <Th>Business</Th>
                    <Th>EIN</Th>
                    <Th>Client Email</Th>
                    <Th>Status</Th>
                    <Th>Sent</Th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((r, i) => (
                    <tr key={r.id} className={`border-b border-[#1e2130] last:border-0 ${i % 2 ? "bg-[#0a0e14]" : ""}`}>
                      {isAdmin && <Td>{agentMap[r.agent_id] || "—"}</Td>}
                      <Td>{r.contact_name || "—"}</Td>
                      <Td>{r.business_name || "—"}</Td>
                      <Td><span className="text-[#8892a4]">{r.ein || "—"}</span></Td>
                      <Td><span className="text-[#8892a4]">{r.client_email}</span></Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td><span className="text-[#4a5568]">{fmt(r.created_at)}</span></Td>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest whitespace-nowrap">{children}</p>
      <div className="flex-1 h-px bg-[#1e2130]" />
    </div>
  );
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

function EmptyCard({ children }) {
  return (
    <div className="bg-[#0d1017] border border-[#1e2130] rounded-xl p-8 text-center">
      <p className="text-[#4a5568] text-sm">{children}</p>
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left px-4 py-3 text-[10px] font-bold text-[#4a5568] uppercase tracking-wider">{children}</th>;
}

function Td({ children }) {
  return <td className="px-4 py-3 text-white text-xs">{children}</td>;
}
