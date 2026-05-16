import React, { useState, useEffect, useRef, useCallback } from "react";
import { TelnyxRTC } from "@telnyx/webrtc";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";


const DIAL_ROWS = [["1","2","3"],["4","5","6"],["7","8","9"],["*","0","#"]];

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function DirectionIcon({ direction }) {
  if (direction === "incoming") return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
  if (direction === "missed") return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="17 18 23 18 23 12"/>
    </svg>
  );
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
    </svg>
  );
}

const W = 760;
const H = 560;

export default function SoftPhone({ agent, visible, onClose }) {
  // ── Drag state ──────────────────────────────────────────────────────────────
  const [pos, setPos]   = useState({ x: Math.max(0, window.innerWidth  - W - 40), y: 60 });
  const dragging        = useRef(false);
  const dragOrigin      = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - W, dragOrigin.current.px + e.clientX - dragOrigin.current.mx)),
      y: Math.max(0, Math.min(window.innerHeight - H, dragOrigin.current.py + e.clientY - dragOrigin.current.my)),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  function startDrag(e) {
    if (e.button !== 0) return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  }

  // Cleanup listeners if unmounted mid-drag
  useEffect(() => () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onMouseUp]);

  // ── Telnyx WebRTC state ─────────────────────────────────────────────────────
  const clientRef        = useRef(null);
  const callRef          = useRef(null);
  const remoteAudioRef   = useRef(null);
  const timerRef         = useRef(null);
  const callStartRef     = useRef(null);  // Date when call went active
  const callDestRef      = useRef("");    // E164 destination dialled
  const [sipStatus, setSipStatus]             = useState("disconnected"); // disconnected | connecting | registered | failed
  const [callState, setCallState]             = useState(null);           // null | ringing_out | ringing_in | active
  const [incomingCallerId, setIncomingCallerId] = useState("");
  const [isMuted, setIsMuted]                 = useState(false);
  const [callSeconds, setCallSeconds]         = useState(0);

  useEffect(() => {
    if (!agent?.sip_username || !agent?.sip_password) return;

    const client = new TelnyxRTC({
      login:    agent.sip_username,
      password: agent.sip_password,
    });

    client.on("telnyx.ready", () => setSipStatus("registered"));
    client.on("telnyx.error", () => setSipStatus("failed"));
    client.on("telnyx.socket.close", () => setSipStatus("disconnected"));

    client.on("telnyx.notification", (notification) => {
      const call = notification.call;
      if (!call) return;

      callRef.current = call;
      const state = call.state;
      console.log("[Telnyx] call state:", state, call.direction);

      if (state === "ringing" && call.direction === "inbound") {
        setIncomingCallerId(call.options?.remoteCallerNumber || "Unknown");
        setCallState("ringing_in");
      } else if (state === "ringing" && call.direction === "outbound") {
        setCallState("ringing_out");
      } else if (state === "active") {
        callStartRef.current = new Date();
        setCallState("active");
        setCallSeconds(0);
        timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
        // Attach remote audio stream
        if (remoteAudioRef.current && call.remoteStream) {
          remoteAudioRef.current.srcObject = call.remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
      } else if (state === "destroy" || state === "hangup" || state === "done") {
        clearInterval(timerRef.current);
        // Save call record if the call was ever active
        if (callStartRef.current) {
          const duration = Math.round((Date.now() - callStartRef.current.getTime()) / 1000);
          supabase.from("calls").insert({
            lead_phone:  callDestRef.current || call.options?.destinationNumber || null,
            agent_name:  agent?.full_name || null,
            duration,
            disposition: "completed",
            created_at:  callStartRef.current.toISOString(),
          }).then(({ error }) => { if (error) console.warn("[calls] insert failed:", error.message); });
          callStartRef.current = null;
        }
        callDestRef.current = "";
        setCallState(null);
        setIncomingCallerId("");
        setIsMuted(false);
        setCallSeconds(0);
        callRef.current = null;
      }
    });

    setSipStatus("connecting");
    client.connect();
    clientRef.current = client;

    return () => {
      clearInterval(timerRef.current);
      try { client.disconnect(); } catch (_) {}
      clientRef.current = null;
    };
  }, [agent?.sip_username, agent?.sip_password]);

  function makeCall() {
    if (!dialInput.trim()) return;
    if (!clientRef.current || sipStatus !== "registered") {
      alert("Not connected to Telnyx. Check credentials.");
      return;
    }
    if (callState) return;

    // Normalise to E164 +1XXXXXXXXXX
    let digits = dialInput.trim().replace(/\D/g, "");
    if (!digits.startsWith("1")) digits = "1" + digits;
    const dest = "+" + digits;

    callDestRef.current = dest;
    clientRef.current.newCall({
      destinationNumber: dest,
      callerNumber:      agent?.did || "+17869460772",
      callerIdNumber:    agent?.did || "+17869460772",
    });
  }

  function answerCall() {
    try { callRef.current?.answer(); } catch (_) {}
    setCallState("active");
    setIncomingCallerId("");
  }

  function hangUp() {
    clearInterval(timerRef.current);
    // Save call record before clearing refs
    if (callStartRef.current) {
      const duration = Math.round((Date.now() - callStartRef.current.getTime()) / 1000);
      supabase.from("calls").insert({
        lead_phone:  callDestRef.current || null,
        agent_name:  agent?.full_name || null,
        duration,
        disposition: "completed",
        created_at:  callStartRef.current.toISOString(),
      }).then(({ error }) => { if (error) console.warn("[calls] insert failed:", error.message); });
    }
    callStartRef.current = null;
    callDestRef.current = "";
    try { callRef.current?.hangup(); } catch (_) {}
    setCallState(null);
    setIncomingCallerId("");
    setIsMuted(false);
    setCallSeconds(0);
    callRef.current = null;
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    if (isMuted) {
      try { call.unmuteAudio(); } catch (_) {}
    } else {
      try { call.muteAudio(); } catch (_) {}
    }
    setIsMuted(m => !m);
  }

  function formatDuration(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── App state ───────────────────────────────────────────────────────────────
  const [showSipPass, setShowSipPass]     = useState(false);
  const [activeTab, setActiveTab]         = useState("messages");
  const [dialInput, setDialInput]         = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [composeText, setComposeText]     = useState("");
  const [showNewMsg, setShowNewMsg]       = useState(false);
  const [newTo, setNewTo]                 = useState("");
  const [newName, setNewName]             = useState("");
  const messagesEndRef                    = useRef(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (selectedConv) loadMessages(selectedConv.id);
  }, [selectedConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const { data } = await supabase
      .from("sms_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    setConversations(data || []);
  }

  async function loadMessages(convId) {
    const { data } = await supabase
      .from("sms_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("sent_at", { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!composeText.trim() || !selectedConv) return;
    const body = composeText.trim();
    setComposeText("");
    const optimistic = { id: `tmp-${Date.now()}`, body, direction: "outbound", sent_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      await fetch(`${API_BASE}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedConv.contact_phone, text: body }),
      });
    } catch (e) { console.error("[softphone] SMS send failed:", e); }
    await supabase.from("sms_messages").insert({ conversation_id: selectedConv.id, body, direction: "outbound", sent_at: new Date().toISOString() });
    await supabase.from("sms_conversations").update({ last_message: body, last_message_at: new Date().toISOString() }).eq("id", selectedConv.id);
    setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, last_message: body, last_message_at: new Date().toISOString() } : c));
  }

  async function startConversation() {
    if (!newTo.trim()) return;
    const payload = { contact_phone: newTo.trim(), contact_name: newName.trim() || null, last_message: "", last_message_at: new Date().toISOString(), unread_count: 0 };
    const { data } = await supabase.from("sms_conversations").insert(payload).select().single();
    const conv = data || { id: `dc-${Date.now()}`, ...payload };
    setConversations(prev => [conv, ...prev]);
    setSelectedConv(conv);
    setMessages([]);
    setShowNewMsg(false);
    setNewTo(""); setNewName("");
    setActiveTab("messages");
  }

  function press(key) { setDialInput(p => p + key); }
  function backspace() { setDialInput(p => p.slice(0, -1)); }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      left: pos.x, top: pos.y,
      width: W, height: H,
      display: visible ? "flex" : "none",
      flexDirection: "column",
      background: "#f1f5f9",
      borderRadius: 14,
      overflow: "hidden",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)",
      zIndex: 9999,
      userSelect: dragging.current ? "none" : "auto",
    }}>

      {/* ── Drag handle / title bar ──────────────────────────────────────────── */}
      <div
        onMouseDown={startDrag}
        style={{ background:"#1e293b", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"grab", flexShrink:0 }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Grab dots */}
          <svg width={14} height={14} viewBox="0 0 14 14" fill="#475569">
            {[2,6,10].map(x => [2,6,10].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r={1.2}/>))}
          </svg>
          <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>SoftPhone</span>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block", marginLeft:2 }} />
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", display:"flex", alignItems:"center", padding:4, borderRadius:6 }}
          onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color="#64748b"}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Body (left + right panels) ───────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div style={{ width:240, background:"#fff", borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column", flexShrink:0 }}>

          {/* Agent header */}
          <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom: (agent?.sip_username || agent?.sip_password) ? 8 : 0 }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12, fontWeight:700, flexShrink:0 }}>
                {initials(agent?.full_name || "Agent")}
              </div>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:1 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"#1e293b" }}>{agent?.full_name || "Agent"}</span>
                  <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block", background: sipStatus === "registered" ? "#22c55e" : sipStatus === "connecting" ? "#f59e0b" : sipStatus === "failed" ? "#ef4444" : "#94a3b8" }} />
                </div>
                <span style={{ fontSize:10, color:"#94a3b8" }}>
                  {sipStatus === "registered" ? "Registered" : sipStatus === "connecting" ? "Connecting…" : sipStatus === "failed" ? "Reg. failed" : "Disconnected"}
                </span>
              </div>
            </div>
            {(agent?.did || agent?.sip_username || agent?.sip_password) && (
              <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                {agent?.did && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:9, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em" }}>DID</span>
                    <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>{agent.did}</span>
                  </div>
                )}
                {agent?.sip_username && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:9, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em" }}>SIP User</span>
                    <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>{agent.sip_username}</span>
                  </div>
                )}
                {agent?.sip_password && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:9, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em" }}>SIP Pass</span>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>
                        {showSipPass ? agent.sip_password : "••••••••"}
                      </span>
                      <button
                        onClick={() => setShowSipPass(p => !p)}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:"#94a3b8", display:"flex", alignItems:"center" }}
                      >
                        {showSipPass ? (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active call panel OR dialpad */}
          {callState === "active" ? (
            <div style={{ padding:"16px 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#22c55e,#16a34a)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#fff"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:2 }}>{dialInput || "Unknown"}</div>
                <div style={{ fontSize:20, fontWeight:700, color:"#22c55e", letterSpacing:2, fontFamily:"monospace" }}>{formatDuration(callSeconds)}</div>
              </div>
              <div style={{ display:"flex", gap:10, width:"100%" }}>
                <button
                  onClick={toggleMute}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid #e2e8f0", background: isMuted ? "#fef2f2" : "#f8fafc", color: isMuted ? "#ef4444" : "#475569", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                >
                  {isMuted ? (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  ) : (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  )}
                  {isMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  onClick={hangUp}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, boxShadow:"0 3px 10px rgba(239,68,68,0.3)" }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                  Hang Up
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Number display */}
              <div style={{ padding:"10px 12px 6px" }}>
                <div style={{ background:"#f8fafc", borderRadius:9, padding:"9px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid #e2e8f0", minHeight:42 }}>
                  <span style={{ fontSize: dialInput ? 18 : 13, color: dialInput ? "#1e293b" : "#cbd5e1", fontWeight: dialInput ? 500 : 400, letterSpacing:1, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {dialInput || "Enter number"}
                  </span>
                  {dialInput && (
                    <button onClick={backspace} style={{ background:"none", border:"none", cursor:"pointer", padding:2, color:"#94a3b8", display:"flex", alignItems:"center" }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Dialpad */}
              <div style={{ padding:"4px 12px 10px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  {DIAL_ROWS.flat().map(key => (
                    <button
                      key={key}
                      onClick={() => press(key)}
                      style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:9, padding:"11px 0", fontSize:16, fontWeight:600, color:"#334155", cursor:"pointer", transition:"background 0.1s" }}
                      onMouseDown={e => e.currentTarget.style.background="#e2e8f0"}
                      onMouseUp={e => e.currentTarget.style.background="#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background="#f8fafc"}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                {callState === "ringing_out" ? (
                  <button
                    style={{ width:"100%", marginTop:8, background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:10, padding:"11px 0", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:"0 3px 10px rgba(239,68,68,0.3)" }}
                    onClick={hangUp}
                  >
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    Cancel
                  </button>
                ) : (
                  <button
                    style={{ width:"100%", marginTop:8, background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:10, padding:"11px 0", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:"0 3px 10px rgba(34,197,94,0.3)" }}
                    onClick={makeCall}
                  >
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    Call
                  </button>
                )}
              </div>
            </>
          )}

          {/* Recent calls */}
          <div style={{ flex:1, overflowY:"auto", borderTop:"1px solid #f1f5f9" }}>
            <div style={{ padding:"9px 14px 5px" }}>
              <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em" }}>Recent Calls</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:80 }}>
              <span style={{ fontSize:11, color:"#cbd5e1" }}>No recent calls</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#f8fafc", minWidth:0 }}>

          {/* Tab bar */}
          <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ display:"flex" }}>
              {["messages","history"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{ padding:"12px 16px", background:"none", border:"none", borderBottom: activeTab===tab ? "2px solid #3b82f6" : "2px solid transparent", cursor:"pointer", fontSize:12, fontWeight: activeTab===tab ? 600 : 500, color: activeTab===tab ? "#3b82f6" : "#94a3b8", transition:"all 0.15s", marginBottom:-1 }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewMsg(true)}
              style={{ background:"#3b82f6", color:"#fff", border:"none", borderRadius:7, padding:"5px 11px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Message
            </button>
          </div>

          {/* MESSAGES TAB */}
          {activeTab === "messages" && (
            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

              {/* Conversation list */}
              <div style={{ width:220, borderRight:"1px solid #e2e8f0", background:"#fff", overflowY:"auto", flexShrink:0 }}>
                {conversations.length === 0 && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:80 }}>
                    <span style={{ fontSize:11, color:"#cbd5e1" }}>No messages yet</span>
                  </div>
                )}
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 12px", cursor:"pointer", background: selectedConv?.id===conv.id ? "#eff6ff" : "transparent", borderLeft: selectedConv?.id===conv.id ? "3px solid #3b82f6" : "3px solid transparent", transition:"all 0.1s" }}
                    onMouseEnter={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background="#f8fafc"; }}
                    onMouseLeave={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background="transparent"; }}
                  >
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700, flexShrink:0 }}>
                      {initials(conv.contact_name || conv.contact_phone)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:90 }}>{conv.contact_name || conv.contact_phone}</span>
                        <span style={{ fontSize:10, color:"#94a3b8", flexShrink:0, marginLeft:4 }}>{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:110 }}>{conv.last_message}</span>
                        {conv.unread_count > 0 && (
                          <span style={{ background:"#3b82f6", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:9, fontWeight:700, flexShrink:0, marginLeft:4 }}>{conv.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message thread */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
                {selectedConv ? (
                  <>
                    {/* Thread header */}
                    <div style={{ padding:"10px 14px", background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:10, fontWeight:700, flexShrink:0 }}>
                        {initials(selectedConv.contact_name || selectedConv.contact_phone)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#1e293b" }}>{selectedConv.contact_name || selectedConv.contact_phone}</div>
                        <div style={{ fontSize:10, color:"#94a3b8" }}>{selectedConv.contact_phone}</div>
                      </div>
                      <button
                        onClick={() => setDialInput(selectedConv.contact_phone)}
                        style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:600, color:"#16a34a", cursor:"pointer", display:"flex", alignItems:"center", gap:5, flexShrink:0 }}
                      >
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        Call
                      </button>
                    </div>

                    {/* Bubbles */}
                    <div style={{ flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:8 }}>
                      {messages.map(msg => (
                        <div key={msg.id} style={{ display:"flex", justifyContent: msg.direction==="outbound" ? "flex-end" : "flex-start" }}>
                          <div style={{ maxWidth:"75%", padding:"8px 12px", borderRadius: msg.direction==="outbound" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", background: msg.direction==="outbound" ? "#3b82f6" : "#fff", color: msg.direction==="outbound" ? "#fff" : "#1e293b", fontSize:12, lineHeight:1.5, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", border: msg.direction==="inbound" ? "1px solid #e2e8f0" : "none" }}>
                            <div>{msg.body}</div>
                            <div style={{ fontSize:9, marginTop:3, opacity:0.55, textAlign: msg.direction==="outbound" ? "right" : "left" }}>{formatTime(msg.sent_at)}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Compose */}
                    <div style={{ padding:"10px 12px", background:"#fff", borderTop:"1px solid #e2e8f0", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                      <input
                        value={composeText}
                        onChange={e => setComposeText(e.target.value)}
                        onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                        placeholder="Type a message…"
                        style={{ flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#1e293b", outline:"none" }}
                      />
                      <button onClick={sendMessage} style={{ background:"#3b82f6", border:"none", borderRadius:10, padding:"8px 12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 6px rgba(59,130,246,0.3)", flexShrink:0 }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
                    <div style={{ width:52, height:52, borderRadius:"50%", background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </div>
                    <p style={{ fontSize:13, fontWeight:600, color:"#1e293b", margin:0 }}>Select a conversation</p>
                    <p style={{ fontSize:11, color:"#94a3b8", margin:0 }}>Or start a new message</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.77a16 16 0 006.29 6.29l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span style={{ fontSize:12, color:"#94a3b8" }}>No recent calls</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio for remote stream */}
      <audio ref={remoteAudioRef} autoPlay style={{ display:"none" }} />

      {/* ── INCOMING CALL BANNER ────────────────────────────────────────────────── */}
      {callState === "ringing_in" && (
        <div style={{ position:"absolute", top:54, left:0, right:0, zIndex:20, margin:"0 12px", background:"#1e293b", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#fff" }}>Incoming Call</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:2, fontFamily:"monospace" }}>{incomingCallerId}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button
              onClick={answerCall}
              style={{ background:"#22c55e", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}
            >
              Answer
            </button>
            <button
              onClick={hangUp}
              style={{ background:"#ef4444", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}
            >
              Decline
            </button>
          </div>
        </div>
      )}


      {/* ── NEW MESSAGE MODAL ──────────────────────────────────────────────────── */}
      {showNewMsg && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, borderRadius:14 }}
          onClick={e => { if (e.target===e.currentTarget) setShowNewMsg(false); }}>
          <div style={{ background:"#fff", borderRadius:14, padding:24, width:340, boxShadow:"0 12px 40px rgba(0,0,0,0.18)" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" }}>New Message</h3>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:5 }}>Name (optional)</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Contact name"
              style={{ width:"100%", boxSizing:"border-box", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:9, padding:"9px 12px", fontSize:12, marginBottom:12, outline:"none", color:"#1e293b" }} />
            <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:5 }}>Phone number</label>
            <input value={newTo} onChange={e => setNewTo(e.target.value)} onKeyDown={e => e.key==="Enter" && startConversation()} placeholder="+1 (555) 000-0000"
              style={{ width:"100%", boxSizing:"border-box", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:9, padding:"9px 12px", fontSize:12, marginBottom:20, outline:"none", color:"#1e293b" }} />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => { setShowNewMsg(false); setNewTo(""); setNewName(""); }}
                style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7, padding:"8px 16px", fontSize:12, fontWeight:600, color:"#64748b", cursor:"pointer" }}>Cancel</button>
              <button onClick={startConversation}
                style={{ background:"#3b82f6", border:"none", borderRadius:7, padding:"8px 16px", fontSize:12, fontWeight:600, color:"#fff", cursor:"pointer" }}>Start Conversation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
