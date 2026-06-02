// src/renderer/src/App.jsx
import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MyLeads from "./pages/MyLeads";
import AdminDashboard from "./pages/AdminDashboard";
import AgentManagement from "./pages/AgentManagement";
import AgentLeads from "./pages/AgentLeads";
import DealPipeline from "./pages/DealPipeline";
import Clients from "./pages/Clients";
import ScriptsPage from "./pages/ScriptsPage";
import EmailClient from "./pages/EmailClient";
import CalendarPage from "./pages/CalendarPage";
import NewApplication from "./pages/NewApplication";
import Settings from "./pages/Settings";
import Messaging from "./pages/Messaging";
import LiveTransfers from "./pages/LiveTransfers";
import CallbacksPage from "./pages/CallbacksPage";
import TodaysQueue from "./pages/TodaysQueue";
import FollowUpSequences from "./pages/FollowUpSequences";
import CallbackReminder from "./components/CallbackReminder";
import Login from "./pages/Login";
import TourGuide from "./components/TourGuide";
import { supabase } from "./lib/supabaseClient";
import { AppProvider, useApp } from "./context/AppContext";

// Keeps a page mounted but hidden when inactive so stateful components
// (softphone, email session, VICIdial) survive navigation.
function PageSlot({ active, padded, children }) {
  return (
    <div
      className={`absolute inset-0 overflow-auto${padded ? " p-6" : ""}`}
      style={{ display: active ? "block" : "none" }}
    >
      {children}
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleLogin(user) {
    setSession({ user });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

// ── Main shell (reads from AppContext) ────────────────────────────────────────

function AppShell() {
  const { agent, userId } = useApp();

  const [activeView,       setActiveView]       = useState("my-leads");
  const [emailClientProps, setEmailClientProps] = useState({});
  const [leads,          setLeads]          = useState([]);
  const [leadsLoading,   setLeadsLoading]   = useState(false);
  const [unreadMsgCount,    setUnreadMsgCount]    = useState(0);
  const [tourActive,        setTourActive]        = useState(false);
  const [callbackBadge,     setCallbackBadge]     = useState(0);
  const [focusLeadId,       setFocusLeadId]       = useState(null);

  useEffect(() => {
    if (agent) fetchLeads();
  }, [agent]);

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

        if (agent?.role === "agent") {
          query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
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

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = agent.role === "admin";

  return (
    <div className="flex h-screen bg-[#080b10] text-white overflow-hidden font-sans">
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => {
          if (view !== "email-client") setEmailClientProps({});
          setActiveView(view);
        }}
        agent={agent}
        badges={{ "messaging": unreadMsgCount, "callbacks": callbackBadge }}
        onStartTour={() => setTourActive(true)}
      />

      {/* All page views are always mounted; only the active one is visible.
          This keeps email sessions, softphone state, and other long-lived
          connections alive across navigation. */}
      <main className="flex-1 overflow-hidden bg-gradient-to-br from-[#080b10] to-[#0f1117] relative">
        <PageSlot active={activeView === "my-leads"} padded>
          {leadsLoading && leads.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a84c]" />
              <span className="ml-3 text-[#4a5568]">Loading your leads...</span>
            </div>
          ) : (
            <MyLeads leads={leads} onSaveLead={handleSaveLead} onRefresh={fetchLeads} onOpenEmailClient={openEmailClient} focusLeadId={focusLeadId} onFocusHandled={() => setFocusLeadId(null)} />
          )}
        </PageSlot>

        <PageSlot active={activeView === "email-client"} padded>
          <EmailClient {...emailClientProps} />
        </PageSlot>

        <PageSlot active={activeView === "scripts"} padded>
          <ScriptsPage agent={agent} />
        </PageSlot>

        {isAdmin && (
          <>
            <PageSlot active={activeView === "admin-dashboard"} padded>
              <AdminDashboard />
            </PageSlot>
            <PageSlot active={activeView === "agent-management"} padded>
              <AgentManagement />
            </PageSlot>
            <PageSlot active={activeView === "agent-leads"} padded>
              <AgentLeads />
            </PageSlot>
          </>
        )}

        <PageSlot active={activeView === "deal-pipeline"} padded>
          <DealPipeline agent={agent} onViewLead={(leadId) => { setFocusLeadId(leadId); setActiveView("my-leads"); }} />
        </PageSlot>

        <PageSlot active={activeView === "clients"} padded>
          <Clients agent={agent} />
        </PageSlot>

        <PageSlot active={activeView === "calendar"} padded>
          <CalendarPage agent={agent} />
        </PageSlot>

        <PageSlot active={activeView === "new-application"} padded>
          <NewApplication agent={agent} />
        </PageSlot>

        <PageSlot active={activeView === "settings"} padded>
          <Settings />
        </PageSlot>

        <PageSlot active={activeView === "messaging"} padded>
          <Messaging onUnreadChange={setUnreadMsgCount} />
        </PageSlot>

        <PageSlot active={activeView === "live-transfers"} padded>
          <LiveTransfers onNavigatePipeline={() => setActiveView("deal-pipeline")} />
        </PageSlot>

        <PageSlot active={activeView === "callbacks"} padded>
          <CallbacksPage />
        </PageSlot>

        <PageSlot active={activeView === "todays-queue"} padded>
          <TodaysQueue onViewLead={(leadId) => { setFocusLeadId(leadId); setActiveView("my-leads"); }} />
        </PageSlot>

        {isAdmin && (
          <PageSlot active={activeView === "follow-up-sequences"} padded>
            <FollowUpSequences />
          </PageSlot>
        )}

      </main>

      {tourActive && (
        <TourGuide
          setActiveView={setActiveView}
          isAdmin={isAdmin}
          onExit={() => setTourActive(false)}
        />
      )}

      <CallbackReminder
        userId={userId}
        onNavigateCallbacks={() => setActiveView("callbacks")}
        onBadgeChange={setCallbackBadge}
      />
    </div>
  );
}
