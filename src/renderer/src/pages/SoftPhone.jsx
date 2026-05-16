import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

const DEMO_CALLS = [
  { id: 1, name: "Marcus Johnson",  number: "+13055551234", time: "2m ago",  direction: "incoming" },
  { id: 2, name: "Sarah Williams",  number: "+17865559876", time: "14m ago", direction: "outgoing" },
  { id: 3, name: "+13054448899",    number: "+13054448899", time: "1h ago",  direction: "missed"   },
  { id: 4, name: "Derek Cole",      number: "+13055557700", time: "2h ago",  direction: "outgoing" },
  { id: 5, name: "Priya Mehta",     number: "+17865553210", time: "3h ago",  direction: "incoming" },
];

const DEMO_CONVS = [
  { id: "dc1", contact_name: "Marcus Johnson", contact_phone: "+13055551234", last_message: "Thanks, I'll review the documents tonight.", last_message_at: new Date(Date.now() - 5 * 60000).toISOString(), unread_count: 2 },
  { id: "dc2", contact_name: "Sarah Williams", contact_phone: "+17865559876", last_message: "What's the interest rate on the deal?",     last_message_at: new Date(Date.now() - 45 * 60000).toISOString(), unread_count: 0 },
  { id: "dc3", contact_name: "Derek Cole",     contact_phone: "+13055557700", last_message: "Sounds good, call me tomorrow.",             last_message_at: new Date(Date.now() - 2 * 3600000).toISOString(), unread_count: 0 },
];

const DEMO_MSGS = {
  dc1: [
    { id: "dm1", body: "Hey Marcus, just checking in on your application status.", direction: "outbound", sent_at: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: "dm2", body: "Thanks, I'll review the documents tonight.",               direction: "inbound",  sent_at: new Date(Date.now() - 5 * 60000).toISOString() },
  ],
  dc2: [
    { id: "dm3", body: "Hi Sarah, following up on our call earlier.",              direction: "outbound", sent_at: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: "dm4", body: "What's the interest rate on the deal?",                    direction: "inbound",  sent_at: new Date(Date.now() - 45 * 60000).toISOString() },
  ],
  dc3: [
    { id: "dm5", body: "Derek, are you available for a quick call?",               direction: "outbound", sent_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: "dm6", body: "Sounds good, call me tomorrow.",                           direction: "inbound",  sent_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  ],
};

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
    const { data, error } = await supabase
      .from("sms_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    setConversations((!error && data?.length) ? data : DEMO_CONVS);
  }

  async function loadMessages(convId) {
    if (convId.startsWith("dc")) { setMessages(DEMO_MSGS[convId] || []); return; }
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
    if (!selectedConv.id.startsWith("dc")) {
      await supabase.from("sms_messages").insert({ conversation_id: selectedConv.id, body, direction: "outbound", sent_at: new Date().toISOString() });
      await supabase.from("sms_conversations").update({ last_message: body, last_message_at: new Date().toISOString() }).eq("id", selectedConv.id);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, last_message: body, last_message_at: new Date().toISOString() } : c));
    }
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
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
                </div>
                <span style={{ fontSize:10, color:"#94a3b8" }}>Online</span>
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
            <button
              style={{ width:"100%", marginTop:8, background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:10, padding:"11px 0", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:"0 3px 10px rgba(34,197,94,0.3)" }}
              onClick={() => dialInput ? alert(`Calling ${dialInput}…`) : alert("Enter a number first")}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              Call
            </button>
          </div>

          {/* Recent calls */}
          <div style={{ flex:1, overflowY:"auto", borderTop:"1px solid #f1f5f9" }}>
            <div style={{ padding:"9px 14px 5px" }}>
              <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em" }}>Recent Calls</span>
            </div>
            {DEMO_CALLS.map(call => (
              <div
                key={call.id}
                onClick={() => setDialInput(call.number)}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 14px", cursor:"pointer", transition:"background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background="#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}
              >
                <div style={{ width:28, height:28, borderRadius:"50%", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#475569", flexShrink:0 }}>
                  {call.name !== call.number ? initials(call.name) : "#"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{call.name}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{call.time}</div>
                </div>
                <DirectionIcon direction={call.direction} />
              </div>
            ))}
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
            <div style={{ flex:1, overflowY:"auto", padding:16 }}>
              <div style={{ background:"#fff", borderRadius:10, border:"1px solid #e2e8f0", overflow:"hidden" }}>
                {DEMO_CALLS.map((call, i) => (
                  <div key={call.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom: i < DEMO_CALLS.length-1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#475569", flexShrink:0 }}>
                      {call.name !== call.number ? initials(call.name) : "#"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{call.name}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>{call.number}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                      <span style={{ fontSize:11, fontWeight:500, color: call.direction==="missed" ? "#ef4444" : call.direction==="incoming" ? "#22c55e" : "#94a3b8", textTransform:"capitalize" }}>{call.direction}</span>
                      <span style={{ fontSize:10, color:"#94a3b8" }}>{call.time}</span>
                    </div>
                    <button onClick={() => setDialInput(call.number)} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:7, padding:"5px 11px", fontSize:11, color:"#16a34a", fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                      Call back
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
