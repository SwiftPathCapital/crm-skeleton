// src/pages/AdminDashboard.jsx
import React from "react";

export default function AdminDashboard() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-[#4a5568] text-sm mt-1">
          Agent management, lead assignment, DID provisioning, and performance tracking.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "Agent Management", desc: "Add agents, create logins, assign DIDs", phase: "Phase 3", icon: "👤", color: "border-blue-500/30 bg-blue-500/5" },
          { title: "Lead Assignment", desc: "Assign leads to agents from the admin panel", phase: "Phase 3", icon: "📋", color: "border-indigo-500/30 bg-indigo-500/5" },
          { title: "DID Provisioning", desc: "No-code Twilio DID purchase and assignment", phase: "Phase 6", icon: "📞", color: "border-cyan-500/30 bg-cyan-500/5" },
          { title: "Whisper & Barge", desc: "Live call monitoring, whisper, and barge", phase: "Phase 6", icon: "🎧", color: "border-purple-500/30 bg-purple-500/5" },
          { title: "Performance Dashboard", desc: "Dials, apps sent, apps signed, funded", phase: "Phase 6", icon: "📊", color: "border-emerald-500/30 bg-emerald-500/5" },
          { title: "Commission Tracking", desc: "Track wins and agent commissions", phase: "Phase 6", icon: "💰", color: "border-yellow-500/30 bg-yellow-500/5" },
        ].map((item) => (
          <div key={item.title} className={`border rounded-xl p-5 ${item.color}`}>
            <div className="text-2xl mb-3">{item.icon}</div>
            <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
            <p className="text-[#4a5568] text-xs mb-3">{item.desc}</p>
            <span className="text-xs text-[#4a5568] bg-[#1e2130] px-2 py-1 rounded">
              {item.phase}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
