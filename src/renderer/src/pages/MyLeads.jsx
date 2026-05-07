// src/renderer/src/pages/MyLeads.jsx
import React from "react";
import LeadTable from "../components/LeadTable";

export default function MyLeads({ leads, onSaveLead, onRefresh }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">My Leads</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            Click any row to expand and edit lead details.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] border border-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <LeadTable leads={leads} onSaveLead={onSaveLead} />
    </div>
  );
}
