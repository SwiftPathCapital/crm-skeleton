// src/renderer/src/pages/LiveTransfers.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending",           color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "completed", label: "Completed",          color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "funded",    label: "Funded",             color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "failed",    label: "Failed / No Answer", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "credit",    label: "Credit",             color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

function statusStyle(val) {
  return STATUS_OPTIONS.find(s => s.value === val)?.color ?? "bg-[#1e2130] text-[#8892a4] border-[#2d3748]";
}
function statusLabel(val) {
  return STATUS_OPTIONS.find(s => s.value === val)?.label ?? val;
}

const EMPTY_FORM = {
  customer_name:    "",
  company_name:     "",
  phone:            "",
  email:            "",
  state:            "",
  vendor_id:        "",
  status:           "pending",
  requested_amount: "",
  monthly_revenue:  "",
  time_in_business: "",
  notes:            "",
};

// ── Add Vendor Modal ──────────────────────────────────────────────────────────

function AddVendorModal({ onClose, onAdded }) {
  const [name,   setName]   = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("transfer_vendors")
      .insert({ name: trimmed })
      .select()
      .single();
    setSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    onAdded(data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-80 shadow-2xl">
        <h3 className="text-white font-semibold mb-4">Add New Vendor</h3>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Vendor name"
          className="w-full bg-[#1e2130] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c] mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#8892a4] hover:text-white hover:bg-[#1e2130]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer Form Modal ───────────────────────────────────────────────────────

function TransferModal({ transfer, vendors, onClose, onSaved, isAdmin, onNavigatePipeline }) {
  const { userId, agent } = useApp();

  const [form, setForm] = useState(transfer ? {
    customer_name:    transfer.customer_name,
    company_name:     transfer.company_name,
    phone:            transfer.phone,
    email:            transfer.email,
    state:            transfer.state,
    vendor_id:        transfer.vendor_id ?? "",
    status:           transfer.status,
    requested_amount: transfer.requested_amount,
    monthly_revenue:  transfer.monthly_revenue,
    time_in_business: transfer.time_in_business,
    notes:            transfer.notes,
  } : { ...EMPTY_FORM });

  const [saving,      setSaving]      = useState(false);
  const [showAddVend, setShowAddVend] = useState(false);
  const [vendorList,  setVendorList]  = useState(vendors);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form,
      vendor_id: form.vendor_id || null,
      agent_id:  transfer ? transfer.agent_id : userId,
    };

    if (transfer) {
      // Edit — just update
      const { error } = await supabase.from("live_transfers").update(payload).eq("id", transfer.id);
      setSaving(false);
      if (error) { alert("Error: " + error.message); return; }
    } else {
      // New transfer — create lead + deal first, then link them
      const nameParts  = form.customer_name.trim().split(" ");
      const firstName  = nameParts[0] || "";
      const lastName   = nameParts.slice(1).join(" ") || "";

      // 1. Create lead
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          name:         form.customer_name.trim(),
          first_name:   firstName,
          last_name:    lastName,
          company_name: form.company_name.trim(),
          phone:        form.phone.trim(),
          email:        form.email.trim(),
          state:        form.state,
          assigned_to:  userId,
          status:       "New",
          lead_type:    "Live Transfer",
        })
        .select("id")
        .single();

      if (leadErr) { setSaving(false); alert("Error creating lead: " + leadErr.message); return; }

      // 2. Create deal in pipeline
      const { data: newDeal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          lead_id:           newLead.id,
          contact_name:      form.customer_name.trim(),
          business_name:     form.company_name.trim(),
          lead_type:         "Live Transfer",
          assigned_agent_id: userId,
          stage:             "new_lead",
          notes:             [],
          docs:              [],
        })
        .select("id")
        .single();

      if (dealErr) { setSaving(false); alert("Error creating deal: " + dealErr.message); return; }

      // 3. Insert live transfer linked to lead + deal
      const { error } = await supabase.from("live_transfers").insert({
        ...payload,
        lead_id: newLead.id,
        deal_id: newDeal.id,
      });
      setSaving(false);
      if (error) { alert("Error: " + error.message); return; }
    }

    onSaved();
    onClose();
  }

  const inputCls  = "w-full bg-[#1e2130] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c] transition-colors";
  const labelCls  = "block text-xs font-semibold text-[#4a5568] uppercase tracking-wider mb-1";
  const isEditing = !!transfer;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold text-lg">
              {isEditing ? "Edit Transfer" : "New Live Transfer"}
            </h3>
            {isEditing && transfer.deal_id && (
              <button
                onClick={() => { onClose(); onNavigatePipeline(); }}
                className="flex items-center gap-1.5 text-xs text-[#c9a84c] hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                View in Pipeline
              </button>
            )}
          </div>

          {!isEditing && (
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-lg px-3 py-2 mb-4 text-xs text-[#c9a84c]">
              A lead and pipeline deal will be created automatically when you save.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Customer Name</label>
              <input type="text" value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="Full name" className={inputCls} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Company Name</label>
              <input type="text" value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="Business name" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 000-0000" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>State</label>
              <select value={form.state} onChange={e => set("state", e.target.value)} className={inputCls + " cursor-pointer"}>
                <option value="">Select state…</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls + " cursor-pointer"}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Requested Amount</label>
              <input type="text" value={form.requested_amount} onChange={e => set("requested_amount", e.target.value)} placeholder="$50,000" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Monthly Revenue</label>
              <input type="text" value={form.monthly_revenue} onChange={e => set("monthly_revenue", e.target.value)} placeholder="$15,000/mo" className={inputCls} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Time in Business</label>
              <input type="text" value={form.time_in_business} onChange={e => set("time_in_business", e.target.value)} placeholder="e.g. 3 years, 18 months" className={inputCls} />
            </div>

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + " mb-0"}>Transfer Type / Vendor</label>
                {isAdmin && (
                  <button onClick={() => setShowAddVend(true)} className="text-[10px] text-[#c9a84c] hover:underline">+ Add vendor</button>
                )}
              </div>
              <select value={form.vendor_id} onChange={e => set("vendor_id", e.target.value)} className={inputCls + " cursor-pointer"}>
                <option value="">Select vendor…</option>
                {vendorList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={4}
                placeholder="Any additional details, qualifying info, objections…"
                className={inputCls + " resize-none"}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#8892a4] hover:text-white hover:bg-[#1e2130]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create"}
            </button>
          </div>
        </div>
      </div>

      {showAddVend && (
        <AddVendorModal
          onClose={() => setShowAddVend(false)}
          onAdded={v => {
            setVendorList(prev => [...prev, v]);
            set("vendor_id", v.id);
          }}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveTransfers({ onNavigatePipeline }) {
  const { agent, userId } = useApp();
  const isAdmin = agent?.role === "admin";

  const [transfers,    setTransfers]    = useState([]);
  const [vendors,      setVendors]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [search,       setSearch]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: v }] = await Promise.all([
      supabase
        .from("live_transfers")
        .select("*, transfer_vendors(name)")
        .order("created_at", { ascending: false }),
      supabase.from("transfer_vendors").select("*").order("name"),
    ]);
    setTransfers(t || []);
    setVendors(v || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!confirm("Delete this transfer?")) return;
    await supabase.from("live_transfers").delete().eq("id", id);
    setTransfers(prev => prev.filter(t => t.id !== id));
  }

  const filtered = transfers.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterVendor !== "all" && t.vendor_id !== filterVendor) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.customer_name.toLowerCase().includes(q) &&
        !(t.company_name || "").toLowerCase().includes(q) &&
        !t.phone.includes(q) &&
        !t.email.toLowerCase().includes(q) &&
        !t.state.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Transfer Tracker</h1>
          <p className="text-[#4a5568] text-sm mt-0.5">{filtered.length} transfer{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Transfer
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, company, phone…"
          className="bg-[#1e2130] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c] w-56"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1e2130] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={filterVendor}
          onChange={e => setFilterVendor(e.target.value)}
          className="bg-[#1e2130] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c] cursor-pointer"
        >
          <option value="all">All Vendors</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#4a5568]">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-sm">No transfers found</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-[#1e2130]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2130] bg-[#0d1117]">
                {["Customer", "Company", "Phone", "State", "Asking", "Revenue/Mo", "Vendor", "Status", "Date", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-[#1e2130] hover:bg-[#1e2130]/40 transition-colors ${i % 2 === 0 ? "bg-[#080b10]" : "bg-[#0a0d14]"}`}
                >
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {t.customer_name || <span className="text-[#4a5568]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#8892a4] max-w-[140px] truncate">{t.company_name || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{t.phone || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{t.state || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{t.requested_amount || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{t.monthly_revenue || "—"}</td>
                  <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{t.transfer_vendors?.name || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#4a5568] whitespace-nowrap text-xs">
                    {new Date(t.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {t.deal_id && (
                        <button
                          onClick={onNavigatePipeline}
                          className="text-[#4a5568] hover:text-[#c9a84c] transition-colors"
                          title="View in Deal Pipeline"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => { setEditing(t); setShowModal(true); }}
                        className="text-[#4a5568] hover:text-[#c9a84c] transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {(isAdmin || t.agent_id === userId) && (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-[#4a5568] hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TransferModal
          transfer={editing}
          vendors={vendors}
          isAdmin={isAdmin}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
          onNavigatePipeline={onNavigatePipeline}
        />
      )}
    </div>
  );
}
