// src/App.jsx
// Phase 1 skeleton — dummy data, no Supabase yet
// userRole: 'agent' | 'admin' — swap to test both views

import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import MyLeads from "./pages/MyLeads";
import AdminDashboard from "./pages/AdminDashboard";
import { dummyLeads } from "./lib/dummyData";

// ── Toggle this to test role-based sidebar visibility ──
const userRole = "admin"; // "agent" | "admin"

export default function App() {
  const [activeView, setActiveView] = useState("my-leads");
  const [leads, setLeads] = useState(dummyLeads);

  // Phase 2: replace with Supabase upsert
  function handleSaveLead(updatedLead) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
    );
    console.log("Lead saved (Phase 2 will persist to Supabase):", updatedLead);
  }

  function renderView() {
    switch (activeView) {
      case "my-leads":
        return <MyLeads leads={leads} onSaveLead={handleSaveLead} />;
      case "admin-dashboard":
        return userRole === "admin" ? <AdminDashboard /> : null;
      default:
        return <MyLeads leads={leads} onSaveLead={handleSaveLead} />;
    }
  }

  return (
    <div className="flex h-screen bg-[#080b10] text-white overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        userRole={userRole}
      />
      <main className="flex-1 overflow-auto p-6">
        {renderView()}
      </main>
    </div>
  );
}
