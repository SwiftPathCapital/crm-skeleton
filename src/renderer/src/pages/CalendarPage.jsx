import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const EVENT_COLORS = [
  { label: "Gold",   value: "#c9a84c" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Green",  value: "#22c55e" },
  { label: "Red",    value: "#ef4444" },
  { label: "Purple", value: "#8b5cf6" },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function formatEventTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ date: new Date(year, month, i - firstDay + 1), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, cells.length - firstDay - daysInMonth + 1), current: false });
  }
  return cells;
}

function makeDemoEvents() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  return [
    { id: "de1", title: "Follow up — Marcus Johnson",   description: "Review loan application documents", start_time: new Date(y,m,d,10,0).toISOString(),  end_time: new Date(y,m,d,10,30).toISOString(),  color: "#c9a84c" },
    { id: "de2", title: "Team standup",                  description: "",                                  start_time: new Date(y,m,d,9,0).toISOString(),   end_time: new Date(y,m,d,9,15).toISOString(),   color: "#3b82f6" },
    { id: "de3", title: "Call — Sarah Williams",         description: "Discuss interest rate options",     start_time: new Date(y,m,d+1,14,0).toISOString(), end_time: new Date(y,m,d+1,14,30).toISOString(), color: "#22c55e" },
    { id: "de4", title: "Pipeline review",               description: "Monthly deal pipeline review",      start_time: new Date(y,m,d+2,11,0).toISOString(), end_time: new Date(y,m,d+2,12,0).toISOString(),  color: "#8b5cf6" },
    { id: "de5", title: "Follow up — Derek Cole",        description: "",                                  start_time: new Date(y,m,d+3,15,0).toISOString(), end_time: new Date(y,m,d+3,15,30).toISOString(), color: "#c9a84c" },
    { id: "de6", title: "Loan closing — Priya Mehta",   description: "Final paperwork signing",           start_time: new Date(y,m,d+5,13,0).toISOString(), end_time: new Date(y,m,d+5,14,0).toISOString(),  color: "#ef4444" },
  ];
}

const BLANK_FORM = { title: "", description: "", date: todayStr(), startTime: "09:00", endTime: "09:30", color: "#c9a84c" };

export default function CalendarPage({ agent }) {
  const now = new Date();
  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth());
  const [events, setEvents]       = useState([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_time", { ascending: true });
    if (!error && data?.length) {
      setEvents(data);
    } else {
      setEvents(makeDemoEvents());
      setUsingDemo(true);
    }
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDay(todayStr()); }

  const grid = getMonthGrid(year, month);
  const today = todayStr();

  // Map events by date key
  const eventsByDay = {};
  events.forEach(ev => {
    const k = dateKey(new Date(ev.start_time));
    if (!eventsByDay[k]) eventsByDay[k] = [];
    eventsByDay[k].push(ev);
  });

  // Upcoming events (next 30 days from today)
  const upcoming = events
    .filter(ev => new Date(ev.start_time) >= new Date(today))
    .slice(0, 8);

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  function openAddModal(dateStr) {
    setForm({ ...BLANK_FORM, date: dateStr || todayStr() });
    setSelectedEvent(null);
    setShowModal(true);
  }

  function openEditModal(ev) {
    const d = new Date(ev.start_time);
    const e = ev.end_time ? new Date(ev.end_time) : null;
    setForm({
      title: ev.title,
      description: ev.description || "",
      date: dateKey(d),
      startTime: `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
      endTime: e ? `${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}` : "",
      color: ev.color || "#c9a84c",
    });
    setSelectedEvent(ev);
    setShowModal(true);
  }

  async function saveEvent() {
    if (!form.title.trim()) return;
    setSaving(true);
    const startIso = new Date(`${form.date}T${form.startTime}`).toISOString();
    const endIso   = form.endTime ? new Date(`${form.date}T${form.endTime}`).toISOString() : null;
    const payload  = { title: form.title.trim(), description: form.description.trim() || null, start_time: startIso, end_time: endIso, color: form.color, agent_id: agent?.id || null };

    if (usingDemo) {
      const id = selectedEvent?.id || `de-${Date.now()}`;
      setEvents(prev => selectedEvent
        ? prev.map(e => e.id === selectedEvent.id ? { ...e, ...payload } : e)
        : [...prev, { id, ...payload }]
      );
    } else {
      if (selectedEvent && !selectedEvent.id.startsWith("de")) {
        await supabase.from("calendar_events").update(payload).eq("id", selectedEvent.id);
      } else {
        await supabase.from("calendar_events").insert(payload);
      }
      await loadEvents();
    }
    setSaving(false);
    setShowModal(false);
  }

  async function deleteEvent(ev) {
    if (!usingDemo && !ev.id.startsWith("de")) {
      await supabase.from("calendar_events").delete().eq("id", ev.id);
      await loadEvents();
    } else {
      setEvents(prev => prev.filter(e => e.id !== ev.id));
    }
    setShowModal(false);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card = { background:"#0d1117", borderRadius:12, border:"1px solid #1e2130" };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#e2e8f0" }}>Calendar</h1>
          {usingDemo && (
            <span style={{ fontSize:11, color:"#4a5568", background:"#1e2130", borderRadius:6, padding:"3px 10px", border:"1px solid #2a3040" }}>Demo data — run calendar_events.sql to enable persistence</span>
          )}
        </div>
        <button
          onClick={() => openAddModal(today)}
          style={{ background:"linear-gradient(135deg,#c9a84c,#e8c96d)", border:"none", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#080b10", cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Event
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", gap:20, overflow:"hidden" }}>

        {/* ── Calendar grid ────────────────────────────────────────────────── */}
        <div style={{ flex:1, ...card, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1e2130" }}>
            <button onClick={prevMonth} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex", alignItems:"center" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:17, fontWeight:700, color:"#e2e8f0" }}>{MONTHS[month]} {year}</span>
              <button onClick={goToday} style={{ background:"#1e2130", border:"1px solid #2a3040", borderRadius:7, padding:"4px 12px", fontSize:12, fontWeight:600, color:"#8892a4", cursor:"pointer" }}>Today</button>
            </div>
            <button onClick={nextMonth} style={{ background:"#1e2130", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#8892a4", display:"flex", alignItems:"center" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #1e2130" }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:11, fontWeight:600, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.06em" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)", gridTemplateRows:"repeat(6,1fr)", overflow:"hidden" }}>
            {grid.map((cell, i) => {
              const key   = dateKey(cell.date);
              const isToday    = key === today;
              const isSelected = key === selectedDay;
              const cellEvents = eventsByDay[key] || [];
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  style={{
                    borderRight: (i+1)%7===0 ? "none" : "1px solid #1e2130",
                    borderBottom: i < 35 ? "1px solid #1e2130" : "none",
                    padding:"8px 8px 4px",
                    cursor:"pointer",
                    background: isSelected ? "#1a2340" : "transparent",
                    transition:"background 0.1s",
                    overflow:"hidden",
                    display:"flex",
                    flexDirection:"column",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#111827"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}
                >
                  {/* Date number */}
                  <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:3 }}>
                    <span style={{
                      width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight: isToday ? 700 : 400,
                      color: isToday ? "#080b10" : cell.current ? "#e2e8f0" : "#2a3040",
                      background: isToday ? "#c9a84c" : "transparent",
                    }}>
                      {cell.date.getDate()}
                    </span>
                  </div>
                  {/* Event pills */}
                  {cellEvents.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); openEditModal(ev); }}
                      style={{ background: ev.color || "#c9a84c", borderRadius:4, padding:"2px 6px", fontSize:10, fontWeight:600, color:"#080b10", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer" }}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {cellEvents.length > 3 && (
                    <div style={{ fontSize:10, color:"#4a5568", paddingLeft:4 }}>+{cellEvents.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div style={{ width:260, display:"flex", flexDirection:"column", gap:16 }}>

          {/* Selected day events */}
          {selectedDay && (
            <div style={{ ...card, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString([], { weekday:"long", month:"short", day:"numeric" })}
                </span>
                <button onClick={() => openAddModal(selectedDay)} style={{ background:"#1e2130", border:"none", borderRadius:6, padding:"4px 8px", fontSize:11, fontWeight:600, color:"#c9a84c", cursor:"pointer" }}>+ Add</button>
              </div>
              {selectedDayEvents.length === 0 ? (
                <p style={{ fontSize:12, color:"#4a5568", margin:0 }}>No events — click + Add to create one.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {selectedDayEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => openEditModal(ev)}
                      style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"8px 10px", borderRadius:8, background:"#111827", border:"1px solid #1e2130" }}
                    >
                      <div style={{ width:3, borderRadius:4, background: ev.color || "#c9a84c", alignSelf:"stretch", flexShrink:0, minHeight:20 }} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", marginBottom:2 }}>{ev.title}</div>
                        <div style={{ fontSize:11, color:"#4a5568" }}>{formatEventTime(ev.start_time)}{ev.end_time ? ` – ${formatEventTime(ev.end_time)}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div style={{ ...card, padding:16, flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <p style={{ margin:"0 0 12px", fontSize:11, fontWeight:600, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.07em" }}>Upcoming</p>
            {upcoming.length === 0 ? (
              <p style={{ fontSize:12, color:"#4a5568" }}>No upcoming events.</p>
            ) : (
              <div style={{ overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
                {upcoming.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => openEditModal(ev)}
                    style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"9px 10px", borderRadius:8, background:"#111827", border:"1px solid #1e2130", transition:"border-color 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="#2a3040"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="#1e2130"}
                  >
                    <div style={{ width:3, borderRadius:4, background: ev.color || "#c9a84c", alignSelf:"stretch", flexShrink:0, minHeight:20 }} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{ev.title}</div>
                      <div style={{ fontSize:11, color:"#4a5568" }}>{formatEventDate(ev.start_time)}</div>
                      <div style={{ fontSize:11, color:"#4a5568" }}>{formatEventTime(ev.start_time)}{ev.end_time ? ` – ${formatEventTime(ev.end_time)}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Event Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background:"#0d1117", border:"1px solid #1e2130", borderRadius:14, padding:28, width:420, boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:"#e2e8f0" }}>
              {selectedEvent ? "Edit Event" : "New Event"}
            </h3>

            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", marginBottom:14 }}
            />

            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", marginBottom:14, colorScheme:"dark" }}
            />

            <div style={{ display:"flex", gap:12, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Start time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", colorScheme:"dark" }}
                />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>End time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", colorScheme:"dark" }}
                />
              </div>
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:6 }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…"
              rows={2}
              style={{ width:"100%", boxSizing:"border-box", background:"#0f1117", border:"1px solid #1e2130", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#e2e8f0", outline:"none", resize:"vertical", marginBottom:14 }}
            />

            <label style={{ fontSize:12, fontWeight:600, color:"#8892a4", display:"block", marginBottom:8 }}>Color</label>
            <div style={{ display:"flex", gap:8, marginBottom:22 }}>
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  title={c.label}
                  style={{ width:26, height:26, borderRadius:"50%", background:c.value, border: form.color===c.value ? "3px solid #fff" : "3px solid transparent", cursor:"pointer", outline: form.color===c.value ? `2px solid ${c.value}` : "none", outlineOffset:1 }}
                />
              ))}
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"space-between" }}>
              <div>
                {selectedEvent && (
                  <button
                    onClick={() => deleteEvent(selectedEvent)}
                    style={{ background:"#1a0a0a", border:"1px solid #3d1515", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:600, color:"#ef4444", cursor:"pointer" }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowModal(false)} style={{ background:"#1e2130", border:"1px solid #2a3040", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, color:"#8892a4", cursor:"pointer" }}>Cancel</button>
                <button
                  onClick={saveEvent}
                  disabled={saving || !form.title.trim()}
                  style={{ background:"linear-gradient(135deg,#c9a84c,#e8c96d)", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#080b10", cursor:"pointer", opacity: saving || !form.title.trim() ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : selectedEvent ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
