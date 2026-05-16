// src/renderer/src/App.jsx — Phase 3 with real auth
import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MyLeads from "./pages/MyLeads";
import AdminDashboard from "./pages/AdminDashboard";
import AgentManagement from "./pages/AgentManagement";
import DealPipeline from "./pages/DealPipeline";
import Clients from "./pages/Clients";
import ScriptsPage from "./pages/ScriptsPage";
import EmailClient from "./pages/EmailClient";
import SoftPhone from "./pages/SoftPhone";
import Login from "./pages/Login";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [agent, setAgent] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState("my-leads");
  const [emailClientProps, setEmailClientProps] = useState({});
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAgentProfile(session.user.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAgentProfile(session.user.id);
      else { setAgent(null); setAuthLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchAgentProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      setAgent(data);
    } catch (err) {
      console.error("Error fetching agent profile:", err);
    } finally {
      setAuthLoading(false);
    }
  }

  const fetchLeads = async () => {
    try {
      setLeadsLoading(true);
      let allLeads = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        // Agents only see their assigned leads
        if (agent?.role === "agent") {
          query = query.eq("assigned_to", session.user.id);
        }

        const { data, error } = await query;
        if (error) { console.error("Supabase Error:", error.message); break; }
        allLeads = [...allLeads, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }

      setLeads(allLeads);
    } catch (err) {
      console.error("System Error:", err.message);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (agent) fetchLeads();
  }, [agent]);

  async function handleSaveLead(updatedLead) {
    try {
      const { error } = await supabase
        .from("leads")
        .upsert(updatedLead, { onConflict: "id" });
      if (error) throw error;
      setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    } catch (err) {
      console.error("Error saving lead:", err);
      alert("Error saving: " + err.message);
    }
  }

  function openEmailClient(props = {}) {
    setEmailClientProps(props);
    setActiveView("email-client");
  }

  function handleLogin(user, agentProfile) {
    setSession({ user });
    setAgent(agentProfile);
  }

  // Loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in — show login screen
  if (!session || !agent) {
    return <Login onLogin={handleLogin} />;
  }

  function renderView() {
    if (leadsLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a84c]"></div>
          <span className="ml-3 text-[#4a5568]">Loading your leads...</span>
        </div>
      );
    }
    switch (activeView) {
      case "my-leads":
        return <MyLeads leads={leads} onSaveLead={handleSaveLead} onRefresh={fetchLeads} onOpenEmailClient={openEmailClient} />;
      case "scripts":
        return <ScriptsPage />;
      case "email-client":
        return <EmailClient {...emailClientProps} />;
      case "admin-dashboard":
        return agent.role === "admin" ? <AdminDashboard /> : <MyLeads leads={leads} onSaveLead={handleSaveLead} onRefresh={fetchLeads} onOpenEmailClient={openEmailClient} />;
      case "agent-management":
        return agent.role === "admin" ? <AgentManagement /> : <MyLeads leads={leads} onSaveLead={handleSaveLead} onRefresh={fetchLeads} onOpenEmailClient={openEmailClient} />;
      case "deal-pipeline":
        return <DealPipeline agent={agent} />;
      case "clients":
        return <Clients agent={agent} />;
      case "softphone":
        return <SoftPhone agent={agent} />;
      default:
        return <MyLeads leads={leads} onSaveLead={handleSaveLead} onRefresh={fetchLeads} onOpenEmailClient={openEmailClient} />;
    }
  }

  return (
    <div className="flex h-screen bg-[#080b10] text-white overflow-hidden font-sans">
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => {
          if (view !== "email-client") setEmailClientProps({});
          setActiveView(view);
        }}
        agent={agent}
      />
      {/* Dialer iframe stays mounted at all times so VICIdial session survives navigation */}
      <iframe
        src="https://dialer.swiftpathcapital.net/agc/vicidial.php"
        title="VICIdial"
        style={{ display: activeView === "dialer" ? "block" : "none", flex: 1, border: "none" }}
      />
      {activeView !== "dialer" && (
        <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-[#080b10] to-[#0f1117]">
          {renderView()}
        </main>
      )}
    </div>
  );
}
