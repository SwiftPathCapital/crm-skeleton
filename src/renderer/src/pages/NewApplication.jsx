import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("electron")
    ? "http://localhost:3001"
    : "";

const STATUS_STYLES = {
  pending:  { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",       label: "Pending"  },
  approved: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Approved" },
  rejected: { bg: "bg-red-500/10 text-red-400 border-red-500/20",             label: "Rejected" },
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

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting,    setRejecting]    = useState(false);
  const [approving,    setApproving]    = useState(null);

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
    const { data } = await supabase.from("agents").select("id, full_name, email");
    const map = {};
    (data || []).forEach(a => { map[a.id] = a.full_name || a.email; });
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
    const { error } = await supabase.from("application_requests").insert({
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
    });
    if (error) {
      setSubmitMsg({ ok: false, msg: error.message });
    } else {
      setSubmitMsg({ ok: true, msg: "Submitted — waiting for admin approval." });
      setForm(EMPTY_FORM);
      await fetchRequests();
    }
    setSubmitting(false);
  }

  async function handleApprove(id) {
    setApproving(id);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/application-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (!res.ok) alert("Approve failed: " + (json.error || res.status));
      else await fetchRequests();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setApproving(null);
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/application-requests/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ note: rejectTarget.note }),
      });
      if (res.ok) { setRejectTarget(null); await fetchRequests(); }
      else { const j = await res.json(); alert("Reject failed: " + (j.error || res.status)); }
    } catch (err) {
      alert("Error: " + err.message);
    }
    setRejecting(false);
  }

  const pending    = requests.filter(r => r.status === "pending");
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
          <h1 className="text-white text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            {isAdmin
              ? `${pending.length} pending approval${pending.length !== 1 ? "s" : ""}`
              : "Submit an MCA application for admin approval"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 pb-8">

        {/* ── Admin: Pending approvals ──────────────────────────────────── */}
        {isAdmin && (
          <section>
            <SectionTitle>Pending Approvals</SectionTitle>
            {pending.length === 0 ? (
              <EmptyCard>No pending requests — all caught up.</EmptyCard>
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map(r => (
                  <div key={r.id} className="bg-[#0d1017] border border-amber-500/20 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm">
                          {r.contact_name} — {r.business_name}
                        </p>
                        <p className="text-[#4a5568] text-xs mt-0.5">
                          {r.client_email} · Submitted by{" "}
                          <span className="text-[#8892a4]">{agentMap[r.agent_id] || "Unknown"}</span>{" "}
                          · {fmt(r.created_at)}
                        </p>
                      </div>

                      {rejectTarget?.id === r.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="text"
                            value={rejectTarget.note}
                            onChange={e => setRejectTarget(t => ({ ...t, note: e.target.value }))}
                            placeholder="Reason (optional)"
                            autoFocus
                            className="bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-1.5 text-white text-xs w-44 focus:outline-none focus:border-red-500/40 transition-colors"
                          />
                          <button
                            onClick={handleReject}
                            disabled={rejecting}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-all"
                          >
                            {rejecting ? "…" : "Confirm Reject"}
                          </button>
                          <button
                            onClick={() => setRejectTarget(null)}
                            className="px-3 py-1.5 bg-[#1e2130] text-[#8892a4] rounded-lg text-xs hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={approving === r.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
                          >
                            {approving === r.id ? (
                              <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Approve &amp; Send
                          </button>
                          <button
                            onClick={() => setRejectTarget({ id: r.id, note: "" })}
                            className="px-4 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5 pt-3 border-t border-[#1e2130]">
                      <DetailRow label="Phone"      value={r.phone} />
                      <DetailRow label="DBA"        value={r.dba} />
                      <DetailRow label="EIN"        value={r.ein} />
                      <DetailRow label="DOB"        value={r.dob} />
                      <DetailRow label="SSN"        value={r.ssn ? "••••••" + r.ssn.slice(-4) : ""} />
                      <DetailRow label="Time in Biz" value={r.time_in_business} />
                      <DetailRow label="Biz Address" value={r.business_address} span />
                      <DetailRow label="Owner Address" value={r.owner_address} span />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Submit form ───────────────────────────────────────────────── */}
        <section>
          <SectionTitle>New Application Request</SectionTitle>
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
                  <input type="text" value={form.time_in_business} onChange={e => setField("time_in_business", e.target.value)}
                    placeholder="e.g. 3 years" className={inputCls} />
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
                  Submit for Approval
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
          <SectionTitle>{isAdmin ? "All Requests" : "My Requests"}</SectionTitle>
          {myRequests.length === 0 ? (
            <EmptyCard>No requests submitted yet.</EmptyCard>
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
                    <Th>Submitted</Th>
                    <Th>Reviewed</Th>
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
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={r.status} />
                          {r.rejection_note && (
                            <span className="text-[10px] text-[#4a5568] max-w-[160px] truncate">{r.rejection_note}</span>
                          )}
                        </div>
                      </Td>
                      <Td><span className="text-[#4a5568]">{fmt(r.created_at)}</span></Td>
                      <Td><span className="text-[#4a5568]">{fmt(r.reviewed_at)}</span></Td>
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

function DetailRow({ label, value, span }) {
  if (!value) return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <span className="text-[#4a5568] text-[10px] uppercase tracking-wider">{label}: </span>
      <span className="text-[#8892a4] text-xs">{value}</span>
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
