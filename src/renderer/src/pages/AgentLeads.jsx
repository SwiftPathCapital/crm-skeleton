import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const STATUS_COLORS = {
  "New": "bg-blue-500/20 text-blue-300",
  "Contacted": "bg-yellow-500/20 text-yellow-300",
  "Callback": "bg-orange-500/20 text-orange-300",
  "App Sent": "bg-purple-500/20 text-purple-300",
  "App Signed": "bg-indigo-500/20 text-indigo-300",
  "Funded": "bg-green-500/20 text-green-300",
  "Not Interested": "bg-red-500/20 text-red-300",
  "DNC": "bg-gray-500/20 text-gray-400",
};

const LEAD_TYPE_LABELS = {
  ucc: "UCC",
  trigger: "Trigger",
  aged: "Aged",
  web: "Web",
  live_transfer: "Live Transfer",
};

function initials(name) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
}

function LeadRow({ lead, action, onAction }) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
  const statusColor = STATUS_COLORS[lead.status] || "bg-gray-500/20 text-gray-400";
  const typeLabel = LEAD_TYPE_LABELS[lead.lead_type] || lead.lead_type || "—";

  return (
    <div className="grid grid-cols-[1fr_1fr_130px_90px_110px_90px] gap-3 px-4 py-3 items-center hover:bg-[#111520] transition-colors">
      <span className="text-white text-sm font-medium truncate">{name}</span>
      <span className="text-[#8892a4] text-sm truncate">{lead.company_name || "—"}</span>
      <span className="text-[#8892a4] text-sm font-mono truncate">{lead.phone || "—"}</span>
      <span className="text-[#8892a4] text-xs">{typeLabel}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium text-center ${statusColor}`}>
        {lead.status || "—"}
      </span>
      {action === "unassign" ? (
        <button
          onClick={onAction}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
        >
          Unassign
        </button>
      ) : (
        <button
          onClick={onAction}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] hover:bg-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-all"
        >
          Assign
        </button>
      )}
    </div>
  );
}

const TABLE_HEADER = (
  <div className="grid grid-cols-[1fr_1fr_130px_90px_110px_90px] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#4a5568] border-b border-[#1e2130]">
    <span>Name</span>
    <span>Company</span>
    <span>Phone</span>
    <span>Type</span>
    <span>Status</span>
    <span></span>
  </div>
);

export default function AgentLeads() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase
      .from("agents")
      .select("id, full_name, role, email")
      .order("full_name")
      .then(({ data }) => setAgents(data || []));
  }, []);

  const fetchAssignedLeads = useCallback(async (agentId) => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("id, first_name, last_name, company_name, phone, lead_type, status")
      .eq("assigned_to", agentId)
      .order("created_at", { ascending: false });
    setAssignedLeads(data || []);
    setLoading(false);
  }, []);

  function handleSelectAgent(agent) {
    setSelectedAgent(agent);
    setSearchQuery("");
    setSearchResults([]);
    fetchAssignedLeads(agent.id);
  }

  useEffect(() => {
    if (!searchQuery.trim() || !selectedAgent) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, company_name, phone, lead_type, status")
        .is("assigned_to", null)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedAgent]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUnassign(leadId) {
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: null })
      .eq("id", leadId);
    if (error) { showToast("Error unassigning lead", "error"); return; }
    setAssignedLeads((prev) => prev.filter((l) => l.id !== leadId));
    showToast("Lead unassigned successfully");
  }

  async function handleAssign(lead) {
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: selectedAgent.id })
      .eq("id", lead.id);
    if (error) { showToast("Error assigning lead", "error"); return; }
    setAssignedLeads((prev) => [lead, ...prev]);
    setSearchResults((prev) => prev.filter((l) => l.id !== lead.id));
    showToast(`Lead assigned to ${selectedAgent.full_name}`);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === "error"
              ? "bg-red-500/20 border border-red-500/40 text-red-300"
              : "bg-green-500/20 border border-green-500/40 text-green-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-white text-2xl font-bold">Agent Leads</h1>
        <p className="text-[#4a5568] text-sm">Assign and manage lead distribution across agents</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left — agent cards */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
          <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider px-1 mb-1">
            Agents ({agents.length})
          </p>
          {agents.length === 0 && (
            <p className="text-[#4a5568] text-sm px-1">No agents found</p>
          )}
          {agents.map((agent) => {
            const active = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                  active
                    ? "bg-[#2d1e4a] border-[#4a2d6a] text-[#c9a84c]"
                    : "bg-[#0f1117] border-[#1e2130] text-[#8892a4] hover:bg-[#161b27] hover:text-white hover:border-[#2a3f6a]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    active
                      ? "bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] text-[#080b10]"
                      : "bg-[#1e2130] text-[#8892a4]"
                  }`}
                >
                  {initials(agent.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{agent.full_name}</p>
                  <p className={`text-xs capitalize ${active ? "text-[#c9a84c]/70" : "text-[#4a5568]"}`}>
                    {agent.role}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — lead management */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
          {!selectedAgent ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#1e2130] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-[#4a5568] text-sm">Select an agent to manage their leads</p>
              </div>
            </div>
          ) : (
            <>
              {/* Agent summary bar */}
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-sm font-bold flex-shrink-0">
                  {initials(selectedAgent.full_name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-white font-semibold text-lg leading-tight">{selectedAgent.full_name}</h2>
                  <p className="text-[#4a5568] text-sm capitalize truncate">
                    {selectedAgent.role} · {selectedAgent.email}
                  </p>
                </div>
                <div className="ml-auto text-right flex-shrink-0">
                  <p className="text-[#c9a84c] text-2xl font-bold leading-none">{assignedLeads.length}</p>
                  <p className="text-[#4a5568] text-xs mt-0.5">assigned leads</p>
                </div>
              </div>

              {/* Assigned leads table */}
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e2130]">
                  <h3 className="text-white text-sm font-semibold">Assigned Leads</h3>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-10 gap-3">
                    <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[#4a5568] text-sm">Loading leads…</span>
                  </div>
                ) : assignedLeads.length === 0 ? (
                  <div className="py-10 text-center text-[#4a5568] text-sm">No leads assigned to this agent</div>
                ) : (
                  <>
                    {TABLE_HEADER}
                    <div className="divide-y divide-[#1e2130]">
                      {assignedLeads.map((lead) => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          action="unassign"
                          onAction={() => handleUnassign(lead.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Search & assign unassigned leads */}
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e2130]">
                  <h3 className="text-white text-sm font-semibold">Assign Unassigned Leads</h3>
                </div>
                <div className="p-4">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5568] pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, company, or phone…"
                      className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg pl-9 pr-9 py-2.5 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <>
                    {TABLE_HEADER}
                    <div className="divide-y divide-[#1e2130]">
                      {searchResults.map((lead) => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          action="assign"
                          onAction={() => handleAssign(lead)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                  <p className="px-4 pb-4 text-[#4a5568] text-sm">No unassigned leads match your search</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
