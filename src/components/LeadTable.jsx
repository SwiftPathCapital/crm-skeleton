// src/components/LeadTable.jsx
import React, { useState } from "react";
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

export default function LeadTable({ leads, onSaveLead }) {
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const filtered = leads.filter((l) => {
    const matchType = filterType === "all" || l.lead_type === filterType;
      !q ||
      l.first_name?.toLowerCase().includes(q) ||
      l.last_name?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.state?.toLowerCase().includes(q) ||
      l.lead_vendor?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
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

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-[#0f1117] border border-[#1e2130] rounded-lg p-1">
          {["all", "ucc", "trigger", "aged", "web", "live_transfer"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                filterType === type
                  ? "bg-blue-600 text-white"
                  : "text-[#8892a4] hover:text-white"
              }`}
            >
              {type === "all" ? "All" : leadTypeLabels[type]}
            </button>
          ))}
        </div>

        <div className="text-[#4a5568] text-xs ml-auto">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#1e2130]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0f1117] border-b border-[#1e2130]">
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
                <td colSpan={10} className="text-center text-[#4a5568] py-12 text-sm">
                  No leads found.
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const isExpanded = expandedId === lead.id;
              return (
                <React.Fragment key={lead.id}>
                  <tr
                    onClick={() => toggleRow(lead.id)}
                    className={`border-b border-[#1e2130] cursor-pointer transition-colors duration-100 ${
                      isExpanded
                        ? "bg-[#131929] border-l-2 border-l-blue-500"
                        : "hover:bg-[#111520]"
                    }`}
                  >
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

                  {/* Expanding row */}
                  {isExpanded && (
                    <tr className="border-b border-[#1e2130]">
                      <td colSpan={10} className="p-0">
                        <LeadExpandedRow
                          lead={lead}
                          onSave={(updated) => onSaveLead(updated)}
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
    </div>
  );
}
