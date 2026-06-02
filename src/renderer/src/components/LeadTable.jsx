// src/components/LeadTable.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import LeadExpandedRow from "./LeadExpandedRow";

const KNOWN_LEAD_TYPES = ["ucc", "trigger", "aged", "web", "live_transfer"];

const leadTypeStyles = {
  ucc:           "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  trigger:       "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  aged:          "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  web:           "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  live_transfer: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
};

const leadTypeLabels = {
  ucc:           "UCC",
  trigger:       "Trigger",
  aged:          "Aged",
  web:           "Web",
  live_transfer: "Live Transfer",
};

function isInbound(lead) {
  return lead.lead_type && !KNOWN_LEAD_TYPES.includes(lead.lead_type);
}

function leadTypeDisplay(lead) {
  const label = lead.lead_type_label || lead.lead_type;
  const style = leadTypeStyles[lead.lead_type] || "bg-teal-500/20 text-teal-400 border border-teal-500/30";
  return { label: leadTypeLabels[lead.lead_type] || label || "—", style };
}

// Age/staleness helpers
function ageDotColor(lastContacted) {
  if (!lastContacted) return "bg-red-500";
  const days = Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000);
  if (days <= 3)  return "bg-emerald-500";
  if (days <= 7)  return "bg-yellow-500";
  if (days <= 14) return "bg-orange-500";
  return "bg-red-500";
}

function lastContactLabel(lastContacted) {
  if (!lastContacted) return "Never";
  const days = Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function StatusBadge({ status }) {
  const styles = {
    New:              "bg-blue-500/20 text-blue-300",
    Contacted:        "bg-cyan-500/20 text-cyan-300",
    Callback:         "bg-yellow-500/20 text-yellow-300",
    "App Sent":       "bg-orange-500/20 text-orange-300",
    "App Signed":     "bg-purple-500/20 text-purple-300",
    Funded:           "bg-emerald-500/20 text-emerald-300",
    "Not Interested": "bg-gray-500/20 text-gray-400",
    DNC:              "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
    </svg>
  );
}

function SelectBox({ checked, indeterminate, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
        checked || indeterminate
          ? "bg-[#c9a84c] border-[#c9a84c] text-[#080b10]"
          : "border-[#4a5568] text-transparent hover:border-[#c9a84c]"
      }`}
    >
      {checked ? <CheckIcon /> : indeterminate ? <MinusIcon /> : null}
    </button>
  );
}

// Quick Callback Modal (shared across all rows)
function QuickCallbackModal({ lead, userId, onClose, onSaved }) {
  const [form,   setForm]   = useState({ scheduled_at: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.scheduled_at) return;
    setSaving(true);
    await supabase.from("callbacks").insert({
      agent_id:     userId,
      lead_id:      lead.id,
      lead_phone:   lead.phone || null,
      lead_name:    lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      notes:        form.notes || null,
      completed:    false,
    });
    setSaving(false);
    onSaved();
  }

  const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors placeholder-[#4a5568]";
  const name     = lead.company_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.phone || "this lead";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-white font-bold text-lg">Schedule Callback</h2>
          <p className="text-[#4a5568] text-xs mt-0.5 truncate">{name}</p>
        </div>
        <div>
          <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Date & Time</label>
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="What to follow up on…"
            className={`${inputCls} resize-none`}
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[#1e2130] text-[#8892a4] hover:border-[#2d3748] text-sm transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={!form.scheduled_at || saving}
            className="flex-1 py-2 rounded-lg bg-[#c9a84c] hover:bg-[#b8963e] text-black font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadTable({ leads, onSaveLead, onOpenEmailClient, onRefresh, focusLeadId, onFocusHandled }) {
  const { agent, userId } = useApp();
  const isAdmin = agent?.role === "admin";

  const [expandedId,      setExpandedId]      = useState(null);
  const [search,          setSearch]          = useState("");
  const [filterType,      setFilterType]      = useState("all");
  const [filterAgent,     setFilterAgent]     = useState("all");
  const [filterMode,      setFilterMode]      = useState(null); // null | "stale" | "overdue"
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [agentsList,      setAgentsList]      = useState([]);
  const [assignTarget,    setAssignTarget]    = useState("");
  const [assigning,       setAssigning]       = useState(false);
  const [revoking,        setRevoking]        = useState(false);
  const [successMsg,      setSuccessMsg]      = useState("");
  const [overdueLeadIds,  setOverdueLeadIds]  = useState(new Set());
  const [quickCbLead,     setQuickCbLead]     = useState(null);
  const [cbSavedId,       setCbSavedId]       = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("agents").select("id, name").order("name").then(({ data }) => setAgentsList(data || []));
  }, [isAdmin]);

  useEffect(() => {
    if (!focusLeadId) return;
    setExpandedId(focusLeadId);
    onFocusHandled?.();
  }, [focusLeadId]);

  // Load lead IDs with overdue callbacks
  useEffect(() => {
    const now = new Date().toISOString();
    let q = supabase
      .from("callbacks")
      .select("lead_id")
      .eq("completed", false)
      .lt("scheduled_at", now)
      .not("lead_id", "is", null);
    if (!isAdmin) q = q.eq("agent_id", userId);
    q.then(({ data }) => setOverdueLeadIds(new Set((data || []).map(c => c.lead_id))));
  }, [isAdmin, userId]);

  const searching   = search.trim().length > 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const TERMINAL     = ["DNC", "Not Interested", "Deal Funded"];

  const filtered = leads.filter((l) => {
    const matchType =
      filterType === "all"
        ? true
        : filterType === "inbound"
        ? isInbound(l)
        : l.lead_type === filterType;

    const matchAgent =
      !isAdmin ||
      filterAgent === "all" ||
      (filterAgent === "unassigned" ? !l.assigned_to : l.assigned_to === filterAgent);

    // Special filter modes (override search when active)
    if (filterMode === "stale") {
      const isStale = !l.last_contacted || l.last_contacted < sevenDaysAgo;
      return isStale && !TERMINAL.includes(l.status) && matchType && matchAgent &&
        (!isAdmin ? l.assigned_to === userId : true);
    }
    if (filterMode === "overdue") {
      return overdueLeadIds.has(l.id) && matchType && matchAgent;
    }

    if (!isAdmin && !searching) {
      return l.assigned_to === userId && matchType;
    }

    const q       = search.toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const phoneDigits = (l.phone || "").replace(/\D/g, "");
    const matchSearch =
      l.first_name?.toLowerCase().includes(q) ||
      l.last_name?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits)) ||
      l.state?.toLowerCase().includes(q) ||
      l.lead_vendor?.toLowerCase().includes(q);

    return matchType && matchAgent && matchSearch;
  });

  const allSelected  = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someSelected = filtered.some((l) => selectedIds.has(l.id));
  const totalSelected = selectedIds.size;

  function toggleRow(id) { setExpandedId((prev) => (prev === id ? null : id)); }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((l) => l.id)));
  }

  async function handleBulkRevoke() {
    if (totalSelected === 0 || revoking) return;
    setRevoking(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from("leads").update({ assigned_to: null }).in("id", ids);
    if (!error) {
      setSelectedIds(new Set());
      setSuccessMsg(`${ids.length} lead${ids.length !== 1 ? "s" : ""} unassigned`);
      setTimeout(() => setSuccessMsg(""), 4000);
      onRefresh?.();
    }
    setRevoking(false);
  }

  async function handleBulkAssign() {
    if (!assignTarget || totalSelected === 0 || assigning) return;
    setAssigning(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from("leads").update({ assigned_to: assignTarget }).in("id", ids);
    if (!error) {
      const agentName = agentsList.find((a) => a.id === assignTarget)?.name || "agent";
      setSelectedIds(new Set());
      setAssignTarget("");
      setSuccessMsg(`${ids.length} lead${ids.length !== 1 ? "s" : ""} assigned to ${agentName}`);
      setTimeout(() => setSuccessMsg(""), 4000);
      onRefresh?.();
    }
    setAssigning(false);
  }

  function handleQuickCbSaved(leadId) {
    setQuickCbLead(null);
    setCbSavedId(leadId);
    setTimeout(() => setCbSavedId(null), 3000);
    // Refresh overdue set
    const now = new Date().toISOString();
    let q = supabase.from("callbacks").select("lead_id").eq("completed", false).lt("scheduled_at", now).not("lead_id", "is", null);
    if (!isAdmin) q = q.eq("agent_id", userId);
    q.then(({ data }) => setOverdueLeadIds(new Set((data || []).map(c => c.lead_id))));
  }

  // colSpan: checkbox(admin) + chevron + first + last + company + phone + state + vendor + type + lastContact + status + actions = 12 admin / 11 agent
  const colSpan = isAdmin ? 12 : 11;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilterMode(null); }}
            className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Lead type filters */}
        <div className="flex items-center gap-1 bg-[#0f1117] border border-[#1e2130] rounded-lg p-1 flex-wrap">
          {["all", "ucc", "trigger", "aged", "web", "live_transfer", "inbound"].map((type) => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setFilterMode(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                filterType === type
                  ? type === "inbound" ? "bg-teal-600 text-white" : "bg-blue-600 text-white"
                  : "text-[#8892a4] hover:text-white"
              }`}
            >
              {type === "all" ? "All" : type === "inbound" ? "Inbound" : leadTypeLabels[type]}
            </button>
          ))}
        </div>

        {/* Follow-up mode filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterMode(filterMode === "stale" ? null : "stale")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === "stale"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-[#0f1117] border border-[#1e2130] text-[#8892a4] hover:text-white hover:border-[#2a3040]"
            }`}
            title="Leads with no contact in 7+ days"
          >
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            Stale
          </button>
          <button
            onClick={() => setFilterMode(filterMode === "overdue" ? null : "overdue")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === "overdue"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-[#0f1117] border border-[#1e2130] text-[#8892a4] hover:text-white hover:border-[#2a3040]"
            }`}
            title="Leads with overdue callbacks"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Overdue
            {overdueLeadIds.size > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {overdueLeadIds.size}
              </span>
            )}
          </button>
        </div>

        {isAdmin && agentsList.length > 0 && (
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-[#8892a4] focus:outline-none focus:border-[#c9a84c] transition-colors"
          >
            <option value="all">All agents</option>
            <option value="unassigned">Unassigned</option>
            {agentsList.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        <div className="text-[#4a5568] text-xs ml-auto">
          {filterMode === "stale" ? (
            <span className="text-orange-400">{filtered.length} stale lead{filtered.length !== 1 ? "s" : ""}</span>
          ) : filterMode === "overdue" ? (
            <span className="text-red-400">{filtered.length} overdue</span>
          ) : !isAdmin && !searching ? (
            <span>{filtered.length} in pipeline</span>
          ) : (
            <span>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
          )}
          {totalSelected > 0 && (
            <span className="ml-2 text-[#c9a84c] font-semibold">· {totalSelected} selected</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#1e2130]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0f1117] border-b border-[#1e2130]">
              {isAdmin && (
                <th className="px-4 py-3 w-10">
                  <SelectBox checked={allSelected} indeterminate={someSelected && !allSelected} onToggle={toggleSelectAll} />
                </th>
              )}
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3 w-8"></th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">First</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Last</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Company</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Phone</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">State</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Lead Vendor</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Last Contact</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="text-center py-16">
                  {filterMode === "stale" ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-10 h-10 text-[#1e2130]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-[#4a5568] text-sm font-medium">No stale leads</p>
                      <p className="text-[#2d3748] text-xs">All leads have been contacted within the last 7 days.</p>
                    </div>
                  ) : filterMode === "overdue" ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-10 h-10 text-[#1e2130]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-[#4a5568] text-sm font-medium">No overdue callbacks</p>
                    </div>
                  ) : !isAdmin && !searching ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-10 h-10 text-[#1e2130]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-[#4a5568] text-sm font-medium">Your pipeline is empty</p>
                      <p className="text-[#2d3748] text-xs max-w-xs">Search by business name, contact, or phone number above to find and claim unassigned leads.</p>
                    </div>
                  ) : (
                    <p className="text-[#4a5568] text-sm">No leads found.</p>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const isExpanded   = expandedId === lead.id;
              const isChecked    = selectedIds.has(lead.id);
              const isOverdue    = overdueLeadIds.has(lead.id);
              const cbJustSaved  = cbSavedId === lead.id;

              return (
                <React.Fragment key={lead.id}>
                  <tr
                    onClick={() => toggleRow(lead.id)}
                    className={`border-b border-[#1e2130] cursor-pointer transition-colors duration-100 ${
                      isExpanded
                        ? "bg-[#131929] border-l-2 border-l-blue-500"
                        : isChecked
                        ? "bg-[#1a1f2e]"
                        : isOverdue
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : "hover:bg-[#111520]"
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3 w-10">
                        <SelectBox
                          checked={isChecked}
                          indeterminate={false}
                          onToggle={() => setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(lead.id) ? next.delete(lead.id) : next.add(lead.id);
                            return next;
                          })}
                        />
                      </td>
                    )}
                    {/* Chevron */}
                    <td className="px-4 py-3 w-8">
                      <svg
                        className={`w-4 h-4 text-[#4a5568] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{lead.first_name}</td>
                    <td className="px-4 py-3 text-white">{lead.last_name}</td>
                    <td className="px-4 py-3 text-[#8892a4]">{lead.company_name}</td>
                    <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{lead.phone}</td>
                    <td className="px-4 py-3">
                      <span className="text-[#8892a4] bg-[#1e2130] px-2 py-0.5 rounded text-xs font-mono">
                        {lead.state || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8892a4] text-xs">{lead.lead_vendor || "—"}</td>
                    <td className="px-4 py-3">
                      {(() => { const { label, style } = leadTypeDisplay(lead); return (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${style}`}>{label}</span>
                      ); })()}
                    </td>
                    {/* Last Contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${ageDotColor(lead.last_contacted)}`}
                          title={`Last contact: ${lastContactLabel(lead.last_contacted)}`}
                        />
                        <span className="text-[#8892a4] text-xs">{lastContactLabel(lead.last_contacted)}</span>
                        {isOverdue && (
                          <span className="text-[10px] text-red-400 font-semibold">· CB</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    {/* Quick callback action */}
                    <td className="px-4 py-3 w-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); setQuickCbLead(lead); }}
                        className={`p-1 transition-colors ${cbJustSaved ? "text-emerald-400" : "text-[#4a5568] hover:text-[#c9a84c]"}`}
                        title="Schedule callback"
                      >
                        {cbJustSaved ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-[#1e2130]">
                      <td colSpan={colSpan} className="p-0">
                        <LeadExpandedRow
                          lead={lead}
                          onSave={(updated) => onSaveLead(updated)}
                          onOpenEmailClient={onOpenEmailClient}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating bulk action bar */}
      {isAdmin && totalSelected > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0f1117] border border-[#2a3040] rounded-2xl px-5 py-3 shadow-2xl shadow-black/60">
          <span className="text-white text-sm font-semibold whitespace-nowrap">
            {totalSelected} lead{totalSelected !== 1 ? "s" : ""} selected
          </span>
          <div className="w-px h-5 bg-[#1e2130]" />
          <select
            value={assignTarget}
            onChange={(e) => setAssignTarget(e.target.value)}
            className="bg-[#1e2130] border border-[#2a3040] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#c9a84c] transition-colors min-w-[160px]"
          >
            <option value="">Assign to agent…</option>
            {agentsList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!assignTarget || assigning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#c9a84c] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {assigning ? <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {assigning ? "Assigning…" : "Assign"}
          </button>
          <button
            onClick={handleBulkRevoke}
            disabled={revoking}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#1e2130] border border-[#3d1515] text-[#ef4444] hover:bg-[#2a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {revoking ? <div className="w-4 h-4 border-2 border-[#ef4444] border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
            )}
            {revoking ? "Revoking…" : "Revoke"}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[#4a5568] hover:text-white transition-colors ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl shadow-black/60">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Quick callback modal */}
      {quickCbLead && (
        <QuickCallbackModal
          lead={quickCbLead}
          userId={userId}
          onClose={() => setQuickCbLead(null)}
          onSaved={() => handleQuickCbSaved(quickCbLead.id)}
        />
      )}
    </div>
  );
}
