import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const EVENT_COLORS = [
  { label:"Gold",   value:"#c9a84c" },
  { label:"Blue",   value:"#3b82f6" },
  { label:"Green",  value:"#22c55e" },
  { label:"Red",    value:"#ef4444" },
  { label:"Purple", value:"#8b5cf6" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" });
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<first; i++)  cells.push({ date: new Date(year,month,i-first+1), current:false });
  for (let d=1; d<=days; d++)  cells.push({ date: new Date(year,month,d),          current:true  });
  while (cells.length < 42)    cells.push({ date: new Date(year,month+1,cells.length-first-days+1), current:false });
  return cells;
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}
function getWeekDays(start) {
  return Array.from({ length:7 }, (_,i) => {
    const d = new Date(start);
    d.setDate(d.getDate()+i);
    return d;
  });
}

// ── Demo data ─────────────────────────────────────────────────────────────────
function makeDemoEvents() {
  const n=new Date(), y=n.getFullYear(), m=n.getMonth(), d=n.getDate();
  return [
    { id:"de1", title:"Follow up — Marcus Johnson",  description:"Review loan documents",   start_time:new Date(y,m,d,10,0).toISOString(),   end_time:new Date(y,m,d,10,30).toISOString(),  color:"#c9a84c" },
    { id:"de2", title:"Team standup",                description:"",                        start_time:new Date(y,m,d,9,0).toISOString(),    end_time:new Date(y,m,d,9,15).toISOString(),   color:"#3b82f6" },
    { id:"de3", title:"Call — Sarah Williams",       description:"Interest rate options",   start_time:new Date(y,m,d+1,14,0).toISOString(), end_time:new Date(y,m,d+1,14,30).toISOString(),color:"#22c55e" },
    { id:"de4", title:"Pipeline review",             description:"Monthly review",          start_time:new Date(y,m,d+2,11,0).toISOString(), end_time:new Date(y,m,d+2,12,0).toISOString(),  color:"#8b5cf6" },
    { id:"de5", title:"Follow up — Derek Cole",      description:"",                        start_time:new Date(y,m,d+3,15,0).toISOString(), end_time:new Date(y,m,d+3,15,30).toISOString(),color:"#c9a84c" },
    { id:"de6", title:"Loan closing — Priya Mehta",  description:"Final signing",           start_time:new Date(y,m,d+5,13,0).toISOString(), end_time:new Date(y,m,d+5,14,0).toISOString(),  color:"#ef4444" },
  ];
}
function makeDemoAgentEvents() {
  const n=new Date(), y=n.getFullYear(), m=n.getMonth(), d=n.getDate();
  return [
    { id:"dae1", title:"Client call — Rivera",     agent_id:"ag1", agent_name:"Mike Torres",  start_time:new Date(y,m,d,11,0).toISOString(),   end_time:new Date(y,m,d,11,30).toISOString(),  color:"#3b82f6" },
    { id:"dae2", title:"Follow up — Chen",          agent_id:"ag1", agent_name:"Mike Torres",  start_time:new Date(y,m,d,14,0).toISOString(),   end_time:new Date(y,m,d,14,30).toISOString(),  color:"#3b82f6" },
    { id:"dae3", title:"Loan review — Patel",       agent_id:"ag2", agent_name:"Lisa Park",    start_time:new Date(y,m,d,10,30).toISOString(),  end_time:new Date(y,m,d,11,0).toISOString(),   color:"#22c55e" },
    { id:"dae4", title:"New lead call",             agent_id:"ag2", agent_name:"Lisa Park",    start_time:new Date(y,m,d+1,9,0).toISOString(),  end_time:new Date(y,m,d+1,9,30).toISOString(), color:"#22c55e" },
    { id:"dae5", title:"Document signing — Adams",  agent_id:"ag3", agent_name:"James Wright", start_time:new Date(y,m,d+1,13,0).toISOString(), end_time:new Date(y,m,d+1,14,0).toISOString(), color:"#8b5cf6" },
    { id:"dae6", title:"Follow up — Morrison",      agent_id:"ag3", agent_name:"James Wright", start_time:new Date(y,m,d+2,15,0).toISOString(), end_time:new Date(y,m,d+2,15,30).toISOString(),color:"#8b5cf6" },
    { id:"dae7", title:"Credit review — Torres",    agent_id:"ag4", agent_name:"Amy Chen",     start_time:new Date(y,m,d+2,10,0).toISOString(), end_time:new Date(y,m,d+2,10,30).toISOString(),color:"#ef4444" },
    { id:"dae8", title:"Closing call — Williams",   agent_id:"ag4", agent_name:"Amy Chen",     start_time:new Date(y,m,d+3,11,0).toISOString(), end_time:new Date(y,m,d+3,11,30).toISOString(),color:"#ef4444" },
  ];
}

const BLANK_FORM = { title:"", description:"", date:todayStr(), startTime:"09:00", endTime:"09:30", color:"#c9a84c" };
const card = { background:"#0d1117", borderRadius:12, border:"1px solid #1e2130" };

// ── Main component ────────────────────────────────────────────────────────────
export default function CalendarPage({ agent }) {
  const isAdmin = agent?.role === "admin";
  const now = new Date();

  const [viewMode, setViewMode]     = useState("month");
  const [year, setYear]             = useState(now.getFullYear());
  const [month, setMonth]           = useState(now.getMonth());
  const [weekStart, setWeekStart]   = useState(getWeekStart(now));
  const [events, setEvents]         = useState([]);
  const [usingDemo, setUsingDemo]   = useState(false);
  const [agentEvts, setAgentEvts]   = useState([]); // all-agents events (admin)
  const [selectedDay, setSelectedDay]     = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(BLANK_FORM);
  const [saving, setSaving]         = useState(false);

  // Agents' Appointments popup
  const [apptDay, setApptDay]       = useState(null);   // day string
  const [apptGroups, setApptGroups] = useState([]);     // [{ name, events }]
  const [apptLoading, setApptLoading] = useState(false);

  const today = todayStr();

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("calendar_events").select("*").order("start_time", { ascending:true });
    if (!error && data?.length) {
      setEvents(data);
      if (isAdmin) loadAgentEvents();
    } else {
      setEvents(makeDemoEvents());
      setUsingDemo(true);
      if (isAdmin) setAgentEvts(makeDemoAgentEvents());
    }
  }

  async function loadAgentEvents() {
    const { data } = await supabase
      .from("calendar_events").select("*").not("agent_id","is",null);
    setAgentEvts(data || []);
  }

  // ── Derived maps ────────────────────────────────────────────────────────────
  const eventsByDay = {};
  events.forEach(ev => {
    const k = dateKey(new Date(ev.start_time));
    (eventsByDay[k] = eventsByDay[k] || []).push(ev);
  });

  const agentEvtsByDay = {};
  agentEvts.forEach(ev => {
    const k = dateKey(new Date(ev.start_time));
    (agentEvtsByDay[k] = agentEvtsByDay[k] || []).push(ev);
  });

  const upcoming = events.filter(ev => new Date(ev.start_time) >= new Date(today)).slice(0,8);
  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevMonth() { month===0 ? (setYear(y=>y-1),setMonth(11)) : setMonth(m=>m-1); }
  function nextMonth() { month===11 ? (setYear(y=>y+1),setMonth(0)) : setMonth(m=>m+1); }
  function goToday()   { setYear(now.getFullYear()); setMonth(now.getMonth()); setWeekStart(getWeekStart(now)); setSelectedDay(today); }
  function prevWeek()  { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
  function nextWeek()  { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }

  // ── Event modal ──────────────────────────────────────────────────────────────
  function openAddModal(dateStr) {
    setForm({ ...BLANK_FORM, date: dateStr || today });
    setSelectedEvent(null);
    setShowModal(true);
  }
  function openEditModal(ev) {
    const d=new Date(ev.start_time), e=ev.end_time?new Date(ev.end_time):null;
    setForm({ title:ev.title, description:ev.description||"", date:dateKey(d),
      startTime:`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
      endTime:e?`${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`:"",
      color:ev.color||"#c9a84c" });
    setSelectedEvent(ev);
    setShowModal(true);
  }
  async function saveEvent() {
    if (!form.title.trim()) return;
    setSaving(true);
    const startIso = new Date(`${form.date}T${form.startTime}`).toISOString();
    const endIso   = form.endTime ? new Date(`${form.date}T${form.endTime}`).toISOString() : null;
    const payload  = { title:form.title.trim(), description:form.description.trim()||null, start_time:startIso, end_time:endIso, color:form.color, agent_id:agent?.id||null };
    if (usingDemo) {
      const id = selectedEvent?.id || `de-${Date.now()}`;
      setEvents(prev => selectedEvent ? prev.map(e=>e.id===selectedEvent.id?{...e,...payload}:e) : [...prev,{id,...payload}]);
    } else {
      if (selectedEvent && !selectedEvent.id.startsWith("de"))
        await supabase.from("calendar_events").update(payload).eq("id",selectedEvent.id);
      else
        await supabase.from("calendar_events").insert(payload);
      await loadEvents();
    }
    setSaving(false); setShowModal(false);
  }
  async function deleteEvent(ev) {
    if (!usingDemo && !ev.id.startsWith("de")) {
      await supabase.from("calendar_events").delete().eq("id",ev.id);
      await loadEvents();
    } else { setEvents(prev=>prev.filter(e=>e.id!==ev.id)); }
    setShowModal(false);
  }

  // ── Agents' Appointments popup ───────────────────────────────────────────────
  async function openAgentAppts(dayStr) {
    setApptDay(dayStr);
    setApptGroups([]);
    setApptLoading(true);

    if (usingDemo) {
      const dayEvts = makeDemoAgentEvents().filter(ev => dateKey(new Date(ev.start_time)) === dayStr);
      const grouped = {};
      dayEvts.forEach(ev => {
        if (!grouped[ev.agent_id]) grouped[ev.agent_id] = { name:ev.agent_name, events:[] };
        grouped[ev.agent_id].events.push(ev);
      });
      setApptGroups(Object.values(grouped));
      setApptLoading(false);
      return;
    }

    const dayStart = new Date(dayStr+"T00:00:00").toISOString();
    const dayEnd   = new Date(dayStr+"T23:59:59").toISOString();
    const [{ data:evData }, { data:agentsData }] = await Promise.all([
      supabase.from("calendar_events").select("*").gte("start_time",dayStart).lte("start_time",dayEnd).not("agent_id","is",null),
      supabase.from("agents").select("id, full_name"),
    ]);
    const grouped = {};
    (evData||[]).forEach(ev => {
      const name = agentsData?.find(a=>a.id===ev.agent_id)?.full_name || "Unknown Agent";
      if (!grouped[ev.agent_id]) grouped[ev.agent_id] = { name, events:[] };
      grouped[ev.agent_id].events.push(ev);
    });
    setApptGroups(Object.values(grouped));
    setApptLoading(false);
  }

  // ── Agents' Appointments link (reused in month + week) ───────────────────────
  function AgentApptLink({ dayStr }) {
    const count = (agentEvtsByDay[dayStr]||[]).length;
    return (
      <button
        onClick={e => { e.stopPropagation(); openAgentAppts(dayStr); }}
        style={{ width:"100%", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:4, padding:"2px 5px", fontSize:9, fontWeight:600, color:"#a78bfa", cursor:"pointer", display:"flex", alignItems:"center", gap:3, marginTop:"auto" }}
      >
        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        Agents' Appointments{count>0 ? ` (${count})` : ""}
      </button>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const weekDays = getWeekDays(weekStart);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:20 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#e2e8f0" }}>Calendar</h1>
          {/* View toggle */}
          <div style={{ display:"flex", background:"#1e2130", borderRadius:8, padding:3, gap:2 }}>
            {["month","week"].map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ background:viewMode===v?"#2a3f6a":"transparent", border:"none", borderRadius:6, padding:"5px 14px", fontSize:12, fontWeight:600, color:viewMode===v?"#c9a84c":"#4a5568", cursor:"pointer", transition:"all 0.15s", textTransform:"capitalize" }}>
                {v}
              </button>
            ))}
          </div>
          {usingDemo && <span style={{ fontSize:11, color:"#4a5568", background:"#1e2130", borderRadius:6, padding:"3px 10px", border:"1px solid #2a3040" }}>Demo — run calendar_events.sql to persist</span>}
        </div>
        <button onClick={() => openAddModal(today)} style={{ background:"linear-gradient(135deg,#c9a84c,#e8c96d)", border:"none", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#080b10", cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Event
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", gap:20, overflow:"hidden" }}>

        {/* ── MONTH VIEW ────────────────────────────────────────────────────── */}
        {viewMode === "month" && (
          <div style={{ flex:1, ...card, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Nav */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid #1e2130" }}>
              <button onClick={prevMonth} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:17, fontWeight:700, color:"#e2e8f0" }}>{MONTHS[month]} {year}</span>
                <button onClick={goToday} style={{ background:"#1e2130", border:"1px solid #2a3040", borderRadius:7, padding:"4px 12px", fontSize:12, fontWeight:600, color:"#8892a4", cursor:"pointer" }}>Today</button>
              </div>
              <button onClick={nextMonth} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #1e2130" }}>
              {DAYS.map(d => <div key={d} style={{ padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:600, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.06em" }}>{d}</div>)}
            </div>

            {/* Cells */}
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)", gridTemplateRows:"repeat(6,1fr)", overflow:"hidden" }}>
              {getMonthGrid(year, month).map((cell, i) => {
                const key = dateKey(cell.date);
                const isToday    = key === today;
                const isSelected = key === selectedDay;
                const cellEvts   = eventsByDay[key] || [];
                const maxPills   = isAdmin ? 2 : 3;
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    style={{ borderRight:(i+1)%7===0?"none":"1px solid #1e2130", borderBottom:i<35?"1px solid #1e2130":"none", padding:"7px 7px 5px", cursor:"pointer", background:isSelected?"#1a2340":"transparent", transition:"background 0.1s", overflow:"hidden", display:"flex", flexDirection:"column" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#111827"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}
                  >
                    <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:3 }}>
                      <span style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:isToday?700:400, color:isToday?"#080b10":cell.current?"#e2e8f0":"#2a3040", background:isToday?"#c9a84c":"transparent" }}>
                        {cell.date.getDate()}
                      </span>
                    </div>
                    {cellEvts.slice(0,maxPills).map(ev => (
                      <div key={ev.id} onClick={e=>{e.stopPropagation();openEditModal(ev);}} style={{ background:ev.color||"#c9a84c", borderRadius:4, padding:"2px 5px", fontSize:9, fontWeight:600, color:"#080b10", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer" }}>
                        {ev.title}
                      </div>
                    ))}
                    {cellEvts.length > maxPills && <div style={{ fontSize:9, color:"#4a5568", paddingLeft:3 }}>+{cellEvts.length-maxPills} more</div>}
                    {isAdmin && cell.current && <AgentApptLink dayStr={key} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WEEK VIEW ─────────────────────────────────────────────────────── */}
        {viewMode === "week" && (
          <div style={{ flex:1, ...card, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Nav */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid #1e2130" }}>
              <button onClick={prevWeek} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:16, fontWeight:700, color:"#e2e8f0" }}>
                  {weekDays[0].toLocaleDateString([],{month:"short",day:"numeric"})} – {weekDays[6].toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}
                </span>
                <button onClick={goToday} style={{ background:"#1e2130", border:"1px solid #2a3040", borderRadius:7, padding:"4px 12px", fontSize:12, fontWeight:600, color:"#8892a4", cursor:"pointer" }}>Today</button>
              </div>
              <button onClick={nextWeek} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Week columns */}
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)", overflow:"hidden" }}>
              {weekDays.map((day, i) => {
                const key      = dateKey(day);
                const isToday  = key === today;
                const dayEvts  = eventsByDay[key] || [];
                return (
                  <div key={i} style={{ borderRight:i<6?"1px solid #1e2130":"none", display:"flex", flexDirection:"column", overflow:"hidden" }}>
                    {/* Day header */}
                    <div style={{ padding:"10px 6px", textAlign:"center", borderBottom:"1px solid #1e2130", flexShrink:0 }}>
                      <div style={{ fontSize:10, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{DAYS[day.getDay()]}</div>
                      <div style={{ width:30, height:30, borderRadius:"50%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", background:isToday?"#c9a84c":"transparent", fontSize:14, fontWeight:isToday?700:500, color:isToday?"#080b10":"#e2e8f0" }}>
                        {day.getDate()}
                      </div>
                    </div>

                    {/* Events */}
                    <div style={{ flex:1, overflowY:"auto", padding:"6px 5px", display:"flex", flexDirection:"column", gap:3 }}>
                      {dayEvts.map(ev => (
                        <div key={ev.id} onClick={e=>{e.stopPropagation();openEditModal(ev);}} style={{ background:ev.color||"#c9a84c", borderRadius:5, padding:"3px 6px", fontSize:9, fontWeight:600, color:"#080b10", cursor:"pointer", overflow:"hidden" }}>
                          <div style={{ opacity:0.75, marginBottom:1 }}>{fmtTime(ev.start_time)}</div>
                          <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.title}</div>
                        </div>
                      ))}
                      <button onClick={() => openAddModal(key)} style={{ background:"none", border:"1px dashed #2a3040", borderRadius:5, padding:"4px 0", fontSize:9, color:"#4a5568", cursor:"pointer", width:"100%", marginTop:2 }}>+ Add</button>
                    </div>

                    {/* Agents' Appointments (admin only) */}
                    {isAdmin && (
                      <div style={{ borderTop:"1px solid #1e2130", padding:"6px 5px", flexShrink:0 }}>
                        <button
                          onClick={() => openAgentAppts(key)}
                          style={{ width:"100%", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", borderRadius:6, padding:"5px 6px", fontSize:10, fontWeight:600, color:"#a78bfa", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}
                        >
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                          </svg>
                          Agents' Appts{(agentEvtsByDay[key]||[]).length>0?` (${(agentEvtsByDay[key]||[]).length})`:""}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Right panel ─────────────────────────────────────────────────────── */}
        <div style={{ width:260, display:"flex", flexDirection:"column", gap:16 }}>
          {selectedDay && (
            <div style={{ ...card, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{new Date(selectedDay+"T12:00:00").toLocaleDateString([],{weekday:"long",month:"short",day:"numeric"})}</span>
                <button onClick={() => openAddModal(selectedDay)} style={{ background:"#1e2130", border:"none", borderRadius:6, padding:"4px 8px", fontSize:11, fontWeight:600, color:"#c9a84c", cursor:"pointer" }}>+ Add</button>
              </div>
              {selectedDayEvents.length===0 ? (
                <p style={{ fontSize:12, color:"#4a5568", margin:0 }}>No events — click + Add.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {selectedDayEvents.map(ev => (
                    <div key={ev.id} onClick={() => openEditModal(ev)} style={{ display:"flex", gap:9, alignItems:"flex-start", cursor:"pointer", padding:"8px 10px", borderRadius:8, background:"#111827", border:"1px solid #1e2130" }}>
                      <div style={{ width:3, borderRadius:4, background:ev.color||"#c9a84c", alignSelf:"stretch", flexShrink:0, minHeight:18 }} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", marginBottom:2 }}>{ev.title}</div>
                        <div style={{ fontSize:11, color:"#4a5568" }}>{fmtTime(ev.start_time)}{ev.end_time?` – ${fmtTime(ev.end_time)}`:""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ ...card, padding:16, flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <p style={{ margin:"0 0 12px", fontSize:11, fontWeight:600, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.07em" }}>Upcoming</p>
            {upcoming.length===0 ? <p style={{ fontSize:12, color:"#4a5568" }}>No upcoming events.</p> : (
              <div style={{ overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
                {upcoming.map(ev => (
                  <div key={ev.id} onClick={() => openEditModal(ev)} style={{ display:"flex", gap:9, alignItems:"flex-start", cursor:"pointer", padding:"9px 10px", borderRadius:8, background:"#111827", border:"1px solid #1e2130", transition:"border-color 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="#2a3040"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="#1e2130"}>
                    <div style={{ width:3, borderRadius:4, background:ev.color||"#c9a84c", alignSelf:"stretch", flexShrink:0, minHeight:18 }} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{ev.title}</div>
                      <div style={{ fontSize:11, color:"#4a5568" }}>{fmtDate(ev.start_time)}</div>
                      <div style={{ fontSize:11, color:"#4a5568" }}>{fmtTime(ev.start_time)}{ev.end_time?` – ${fmtTime(ev.end_time)}`:""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Event modal ───────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setShowModal(false); }}>
          <div style={{ background:"#0d1117", border:"1px solid #1e2130", borderRadius:14, padding:28, width:420, boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:"#e2e8f0" }}>{selectedEvent?"Edit Event":"New Event"}</h3>
            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Title *</label>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Event title"
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", marginBottom:14 }} />
            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Date</label>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", marginBottom:14, colorScheme:"dark" }} />
            <div style={{ display:"flex", gap:12, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Start</label>
                <input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}
                  style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", colorScheme:"dark" }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>End</label>
                <input type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}
                  style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", colorScheme:"dark" }} />
              </div>
            </div>
            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Description</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional notes…" rows={2}
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", resize:"vertical", marginBottom:14 }} />
            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:8 }}>Color</label>
            <div style={{ display:"flex", gap:8, marginBottom:22 }}>
              {EVENT_COLORS.map(c => (
                <button key={c.value} onClick={() => setForm(f=>({...f,color:c.value}))} title={c.label}
                  style={{ width:26, height:26, borderRadius:"50%", background:c.value, border:form.color===c.value?"3px solid #fff":"3px solid transparent", cursor:"pointer", outline:form.color===c.value?`2px solid ${c.value}`:"none", outlineOffset:1 }} />
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"space-between" }}>
              <div>{selectedEvent && <button onClick={() => deleteEvent(selectedEvent)} style={{ background:"#1a0a0a", border:"1px solid #3d1515", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:600, color:"#ef4444", cursor:"pointer" }}>Delete</button>}</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowModal(false)} style={{ background:"#1e2130", border:"1px solid #2a3040", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, color:"#8892a4", cursor:"pointer" }}>Cancel</button>
                <button onClick={saveEvent} disabled={saving||!form.title.trim()} style={{ background:"linear-gradient(135deg,#c9a84c,#e8c96d)", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#080b10", cursor:"pointer", opacity:saving||!form.title.trim()?0.6:1 }}>
                  {saving?"Saving…":selectedEvent?"Save Changes":"Create Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Agents' Appointments popup ───────────────────────────────────────── */}
      {apptDay && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setApptDay(null); }}>
          <div style={{ background:"#0d1117", border:"1px solid #1e2130", borderRadius:14, padding:28, width:480, maxHeight:"70vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <h3 style={{ margin:"0 0 3px", fontSize:16, fontWeight:700, color:"#e2e8f0" }}>Agents' Appointments</h3>
                <p style={{ margin:0, fontSize:12, color:"#4a5568" }}>{new Date(apptDay+"T12:00:00").toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
              </div>
              <button onClick={() => setApptDay(null)} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY:"auto", flex:1 }}>
              {apptLoading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
                  <div style={{ width:24, height:24, border:"2px solid #c9a84c", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                </div>
              ) : apptGroups.length === 0 ? (
                <div style={{ textAlign:"center", padding:"32px 0" }}>
                  <p style={{ fontSize:14, color:"#4a5568", margin:0 }}>No agent appointments for this day.</p>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {apptGroups.map((group, gi) => (
                    <div key={gi} style={{ background:"#111827", borderRadius:10, border:"1px solid #1e2130", overflow:"hidden" }}>
                      {/* Agent name header */}
                      <div style={{ padding:"10px 14px", background:"#161b27", borderBottom:"1px solid #1e2130", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#8b5cf6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>
                          {group.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
                        </div>
                        <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{group.name}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, color:"#4a5568" }}>{group.events.length} appointment{group.events.length!==1?"s":""}</span>
                      </div>
                      {/* Events */}
                      <div style={{ padding:"8px 14px", display:"flex", flexDirection:"column", gap:7 }}>
                        {group.events.sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)).map(ev => (
                          <div key={ev.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                            <div style={{ width:3, borderRadius:4, background:ev.color||"#8b5cf6", alignSelf:"stretch", flexShrink:0, minHeight:16, marginTop:2 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0" }}>{ev.title}</div>
                              <div style={{ fontSize:11, color:"#4a5568" }}>{fmtTime(ev.start_time)}{ev.end_time?` – ${fmtTime(ev.end_time)}`:""}</div>
                              {ev.description && <div style={{ fontSize:11, color:"#4a5568", marginTop:2 }}>{ev.description}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
