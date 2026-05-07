// src/pages/MyLeads.jsx
import React from "react";
import LeadTable from "../components/LeadTable";

export default function MyLeads({ leads, onSaveLead }) {
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold tracking-tight">My Leads</h1>
        <p className="text-[#4a5568] text-sm mt-1">
          Click any row to expand and edit lead details.
        </p>
      </div>
      <LeadTable leads={leads} onSaveLead={onSaveLead} />
    </div>
  );
}
