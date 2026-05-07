// src/components/Sidebar.jsx
import React from "react";

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
];

export default function Sidebar({ activeView, setActiveView, userRole }) {
  return (
    <aside className="w-64 min-h-screen bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#1e2130]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">APEX CRM</p>
            <p className="text-[#4a5568] text-xs">Sales Platform</p>
          </div>
        </div>
      </div>

      {/* Agent Info */}
      <div className="px-6 py-4 border-b border-[#1e2130]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
            {userRole === "admin" ? "AD" : "AG"}
          </div>
          <div>
            <p className="text-white text-xs font-semibold">
              {userRole === "admin" ? "Admin User" : "Agent User"}
            </p>
            <p className="text-[#4a5568] text-xs capitalize">{userRole}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider px-3 mb-2">
          Navigation
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeView === item.id
                ? "bg-[#1e2d4a] text-blue-400 border border-[#2a3f6a]"
                : "text-[#8892a4] hover:bg-[#161b27] hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* Admin only section */}
        {userRole === "admin" && (
          <>
            <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider px-3 mt-6 mb-2">
              Admin
            </p>
            {adminItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeView === item.id
                    ? "bg-[#2d1e4a] text-purple-400 border border-[#4a2d6a]"
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

      {/* Bottom status */}
      <div className="px-6 py-4 border-t border-[#1e2130]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#4a5568] text-xs">Connected</span>
        </div>
      </div>
    </aside>
  );
}
