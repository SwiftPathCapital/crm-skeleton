// src/components/LeadTable.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import LeadExpandedRow from "./LeadExpandedRow";

const leadTypeStyles = {
  ucc: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  trigger: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  aged: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  web: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  live_transfer: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
};

const leadTypeLabels = {
  ucc: "UCC",
  trigger: "Trigger",
  aged: "Aged",
  web: "Web",
  live_transfer: "Live Transfer",
};

function ScoreBadge({ score }) {
  let color = "bg-red-500/20 text-red-400";
  if (score >= 80) color = "bg-emerald-500/20 text-emerald-400";
  else if (score >= 60) color = "bg-yellow-500/20 text-yellow-400";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${color}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    New: "bg-blue-500/20 text-blue-300",
    Contacted: "bg-cyan-500/20 text-cyan-300",
    Callback: "bg-yellow-500/20 text-yellow-300",
    "App Sent": "bg-orange-500/20 text-orange-300",
    "App Signed": "bg-purple-500/20 text-purple-300",
    Funded: "bg-emerald-500/20 text-emerald-300",
    "Not Interested": "bg-gray-500/20 text-gray-400",
    DNC: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status}
    </span>
  );
}

// Checkbox that supports indeterminate state
function Checkbox({ checked, indeterminate, onChange, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      className="w-4 h-4 rounded border-[#2a3040] bg-[#0f1117] text-[#c9a84c] accent-[#c9a84c] cursor-pointer"
    />
  );
}

export default function LeadTable({ leads, onSaveLead, onOpenEmailClient, onRefresh }) {
  const { agent } = useApp();
  const isAdmin = agent?.role === "admin";

  const [expandedId,    setExpandedId]    = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterType,    setFilterType]    = useState("all");
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [agentsList,    setAgentsList]    = useState([]);
  const [assignTarget,  setAssignTarget]  = useState("");
  const [assigning,     setAssigning]     = useState(false);
  const [successMsg,    setSuccessMsg]    = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("agents")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setAgentsList(data || []));
  }, [isAdmin]);

  const filtered = leads.filter((l) => {
    const matchType = filterType === "all" || l.lead_type === filterType;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.first_name?.toLowerCase().includes(q) ||
      l.last_name?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.state?.toLowerCase().includes(q) ||
      l.lead_vendor?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const allSelected  = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someSelected = filtered.some((l) => selectedIds.has(l.id));
  const totalSelected = selectedIds.size;

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!assignTarget || totalSelected === 0 || assigning) return;
    setAssigning(true);
    const ids = [...selectedIds];
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: assignTarget })
      .in("id", ids);
    if (!error) {
      const agentName = agentsList.find((a) => a.id === assignTarget)?.full_name || "agent";
      setSelectedIds(new Set());
      setAssignTarget("");
      setSuccessMsg(`${ids.length} lead${ids.length !== 1 ? "s" : ""} assigned to ${agentName}`);
      setTimeout(() => setSuccessMsg(""), 4000);
      onRefresh?.();
    }
    setAssigning(false);
  }

  const colSpan = isAdmin ? 11 : 10;

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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#0f1117] border border-[#1e2130] rounded-lg p-1">
          {["all", "ucc", "trigger", "aged", "web", "live_transfer"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                filterType === type ? "bg-blue-600 text-white" : "text-[#8892a4] hover:text-white"
              }`}
            >
              {type === "all" ? "All" : leadTypeLabels[type]}
            </button>
          ))}
        </div>

        <div className="text-[#4a5568] text-xs ml-auto">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
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
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                  />
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
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Score</th>
              <th className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="text-center text-[#4a5568] py-12 text-sm">
                  No leads found.
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const isExpanded = expandedId === lead.id;
              const isChecked  = selectedIds.has(lead.id);
              return (
                <React.Fragment key={lead.id}>
                  <tr
                    onClick={() => toggleRow(lead.id)}
                    className={`border-b border-[#1e2130] cursor-pointer transition-colors duration-100 ${
                      isExpanded
                        ? "bg-[#131929] border-l-2 border-l-blue-500"
                        : isChecked
                        ? "bg-[#1a1f2e]"
                        : "hover:bg-[#111520]"
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => {}}
                          onClick={(e) => toggleSelect(lead.id, e)}
                        />
                      </td>
                    )}
                    {/* Chevron */}
                    <td className="px-4 py-3 w-8">
                      <svg
                        className={`w-4 h-4 text-[#4a5568] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${leadTypeStyles[lead.lead_type] || ""}`}>
                        {leadTypeLabels[lead.lead_type] || lead.lead_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.lead_score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
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
            {agentsList.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>

          <button
            onClick={handleBulkAssign}
            disabled={!assignTarget || assigning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#c9a84c] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {assigning ? (
              <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {assigning ? "Assigning…" : "Assign"}
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[#4a5568] hover:text-white transition-colors ml-1"
            title="Clear selection"
          >
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
    </div>
  );
}
