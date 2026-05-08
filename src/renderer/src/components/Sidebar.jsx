// src/renderer/src/components/Sidebar.jsx
import React from "react";
import { supabase } from "../lib/supabaseClient";

const navItems = [
  {
    id: "my-leads",
    label: "My Leads",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "dialer-queue",
    label: "Dialer Queue",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    id: "admin-dashboard",
    label: "Admin Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "agent-management",
    label: "Agent Management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: "deal-pipeline",
    label: "Deal Pipeline",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    id: "clients",
    label: "Clients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeView, setActiveView, agent }) {
  const userRole = agent?.role || "agent";

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const initials = agent?.full_name
    ? agent.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userRole === "admin" ? "AD" : "AG";

  return (
    <aside className="w-64 min-h-screen bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
      <div className="px-6 py-5 border-b border-[#1e2130]">
        <img src="../assets/logo.png" height="60" style={{ width: "auto", objectFit: "contain" }} alt="Swift Path Capital" />
      </div>

      <div className="px-6 py-4 border-b border-[#1e2130]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold">
            {initials}
          </div>
          <div>
            <p className="text-white text-xs font-semibold">
              {agent?.full_name || (userRole === "admin" ? "Admin User" : "Agent")}
            </p>
            <p className="text-[#4a5568] text-xs capitalize">{userRole}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider px-3 mb-2">Navigation</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeView === item.id
                ? "bg-[#1e2d4a] text-[#c9a84c] border border-[#2a3f6a]"
                : "text-[#8892a4] hover:bg-[#161b27] hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {userRole === "admin" && (
          <>
            <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider px-3 mt-6 mb-2">Admin</p>
            {adminItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeView === item.id
                    ? "bg-[#2d1e4a] text-[#c9a84c] border border-[#4a2d6a]"
                    : "text-[#8892a4] hover:bg-[#161b27] hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-[#1e2130] space-y-3">
        <div className="flex items-center gap-2 px-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#4a5568] text-xs">Connected</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#8892a4] hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
