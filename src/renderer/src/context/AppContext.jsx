// src/renderer/src/context/AppContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [userId,        setUserId]        = useState(null);
  const [agent,         setAgent]         = useState(null);
  const [zohoConnected, setZohoConnected] = useState(null); // null = still checking
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    // Seed from existing session immediately so there's no flash on reload.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) initUser(session.user.id);
      else setZohoConnected(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initUser(session.user.id);
      } else {
        setUserId(null);
        setAgent(null);
        setZohoConnected(false);
        stopRefresh();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopRefresh();
    };
  }, []);

  function stopRefresh() {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }

  async function initUser(uid) {
    setUserId(uid);
    await Promise.all([fetchAgent(uid), checkZohoStatus(uid)]);
    // Start 45-minute background token refresh after initial check.
    stopRefresh();
    refreshTimerRef.current = setInterval(() => refreshZohoToken(uid), 45 * 60 * 1000);
  }

  async function fetchAgent(uid) {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", uid)
        .single();
      if (!error && data) setAgent(data);
    } catch (err) {
      console.error("[AppContext] fetchAgent:", err);
    }
  }

  async function checkZohoStatus(uid) {
    try {
      const { data, error } = await supabase
        .from("zoho_tokens")
        .select("id")
        .eq("id", uid)
        .maybeSingle();
      console.log("[AppContext] zoho_tokens:", data, "error:", error);
      setZohoConnected(!!data);
    } catch (err) {
      console.error("[AppContext] checkZohoStatus:", err);
      setZohoConnected(false);
    }
  }

  async function refreshZohoToken(uid) {
    try {
      const res = await fetch(`${API_BASE}/api/zoho/refresh?agentId=${uid}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("[AppContext] Zoho token refreshed");
    } catch (err) {
      console.warn("[AppContext] Zoho token refresh failed:", err.message);
    }
  }

  async function disconnectZoho() {
    if (!userId) return;
    try {
      await supabase.from("zoho_tokens").delete().eq("id", userId);
    } catch { /* best-effort */ }
    setZohoConnected(false);
    stopRefresh();
  }

  return (
    <AppContext.Provider value={{ userId, agent, zohoConnected, setZohoConnected, disconnectZoho }}>
      {children}
    </AppContext.Provider>
  );
}
