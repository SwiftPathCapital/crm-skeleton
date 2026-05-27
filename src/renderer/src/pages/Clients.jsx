import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { dispositionStyle, dispositionLabel } from "../lib/dispositions";

const EMPTY_CLIENT = {
  contact_name: "", business_name: "", phone: "",
  funded_amount: "", funding_date: "",
  assigned_agent_id: "", notes: [], docs: [],
};

function maskPhone(phone) {
  if (!phone) return null;
  const str = String(phone);
  return str.length > 2 ? str.slice(0, -2) + "••" : "••";
}

export default function Clients({ agent, onDial }) {
  const isAdmin = agent?.role === "admin";

  const [clients, setClients]   = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [isNew, setIsNew]       = useState(false);
  const [form, setForm]         = useState(EMPTY_CLIENT);
  const [newNote, setNewNote]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([fetchClients(), fetchAgents()]).then(() => setLoading(false));
  }, []);

  async function fetchClients() {
    let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("assigned_agent_id", agent?.id);
    const { data } = await query;
    setClients(data || []);
  }

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("id, name, email");
    setAgents(data || []);
  }

  function agentName(id) {
    const a = agents.find(a => a.id === id);
    return a ? (a.name || a.email) : "—";
  }

  function openClient(client) {
    setSelected(client);
    setIsNew(false);
    setForm({ ...EMPTY_CLIENT, ...client, funded_amount: client.funded_amount ?? "", funding_date: client.funding_date ?? "" });
    setNewNote("");
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm({ ...EMPTY_CLIENT });
    setNewNote("");
  }

  function closeModal() {
    setSelected(null);
    setIsNew(false);
    setNewNote("");
  }

  function addNote() {
    if (!newNote.trim()) return;
    setForm(f => ({ ...f, notes: [...(f.notes || []), { text: newNote.trim(), created_at: new Date().toISOString() }] }));
    setNewNote("");
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !selected) return;
    const path = `${selected.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("client-docs").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("client-docs").getPublicUrl(path);
      setForm(f => ({ ...f, docs: [...(f.docs || []), { name: file.name, url: publicUrl }] }));
    }
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.contact_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        contact_name:      form.contact_name,
        business_name:     form.business_name,
        phone:             form.phone || null,
        funded_amount:     form.funded_amount ? parseFloat(form.funded_amount) : null,
        funding_date:      form.funding_date  || null,
        assigned_agent_id: form.assigned_agent_id || null,
        notes:             form.notes || [],
        docs:              form.docs  || [],
      };

      if (selected) {
        await supabase.from("clients").update(payload).eq("id", selected.id);
      } else {
        await supabase.from("clients").insert({ ...payload, created_at: new Date().toISOString() });
      }

      await fetchClients();
      closeModal();
    } catch (err) {
      console.error("Error saving client:", err);
    } finally {
      setSaving(false);
    }
  }

  const filteredClients = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const phoneDigits = (c.phone || "").replace(/\D/g, "");
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.business_name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits))
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[#c9a84c] text-sm animate-pulse">Loading clients…</div>
    </div>
  );

  const modalOpen = selected || isNew;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            {filteredClients.length} funded client{filteredClients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, business, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#0f1117] border border-[#1e2130] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
      </div>

      {/* Grid */}
      {filteredClients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-[#0d1117] border border-[#1e2130] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#2d3748]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-[#4a5568] text-sm font-medium">{search ? "No clients match your search" : "No clients yet"}</p>
            <p className="text-[#2d3748] text-xs mt-1 max-w-xs">
              {search ? "Try a different name or phone number." : "Clients are added automatically when a deal is marked Funded, or you can add them manually."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4 pb-4">
            {filteredClients.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                agentName={agentName}
                onClick={() => openClient(client)}
                phoneDisplay={client.phone ? (isAdmin ? client.phone : maskPhone(client.phone)) : null}
                onDial={client.phone && onDial ? () => onDial(client.phone, client.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Side drawer */}
      {modalOpen && (
        <ClientDrawer
          form={form}
          setForm={setForm}
          isNew={isNew}
          agents={agents}
          newNote={newNote}
          setNewNote={setNewNote}
          onAddNote={addNote}
          onFileUpload={handleFileUpload}
          fileRef={fileRef}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
          hasExistingId={!!selected}
          clientId={selected?.id || null}
          onDial={onDial}
        />
      )}
    </div>
  );
}

// ── Client card ───────────────────────────────────────────────────────────────

function ClientCard({ client, agentName, onClick, phoneDisplay, onDial }) {
  const amount    = client.funded_amount ? "$" + Number(client.funded_amount).toLocaleString() : null;
  const docCount  = (client.docs  || []).length;
  const noteCount = (client.notes || []).length;

  return (
    <div
      onClick={onClick}
      className={`text-left bg-[#0d1117] border border-[#1e2130] rounded-xl p-5 hover:border-[#c9a84c]/30 hover:bg-[#111520] transition-all group ${onClick ? "cursor-pointer" : "cursor-default hover:border-[#1e2130] hover:bg-[#0d1117]"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold truncate group-hover:text-[#c9a84c] transition-colors">
            {client.contact_name || "Unnamed"}
          </p>
          {client.business_name && (
            <p className="text-[#4a5568] text-xs truncate mt-0.5">{client.business_name}</p>
          )}
        </div>
        <span className="ml-2 flex-shrink-0 text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
          Funded
        </span>
      </div>

      {amount && (
        <p className="text-[#c9a84c] text-xl font-bold mb-3 tabular-nums">{amount}</p>
      )}

      <div className="space-y-1.5">
        {client.funding_date && (
          <div className="flex items-center gap-2">
            <span className="text-[#2d3748] text-[10px] uppercase tracking-wider w-16 flex-shrink-0">Date</span>
            <span className="text-[#8892a4] text-xs">{new Date(client.funding_date).toLocaleDateString()}</span>
          </div>
        )}
        {phoneDisplay && (
          <div className="flex items-center gap-2">
            <span className="text-[#2d3748] text-[10px] uppercase tracking-wider w-16 flex-shrink-0">Phone</span>
            <span className="text-[#8892a4] text-xs tabular-nums">{phoneDisplay}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[#2d3748] text-[10px] uppercase tracking-wider w-16 flex-shrink-0">Agent</span>
          <span className="text-[#8892a4] text-xs truncate">{agentName(client.assigned_agent_id)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2130]">
        <span className="text-[10px] text-[#2d3748]">{noteCount} note{noteCount !== 1 ? "s" : ""}</span>
        <span className="text-[10px] text-[#2d3748]">{docCount} doc{docCount !== 1 ? "s" : ""}</span>
        {onDial && (
          <button
            onClick={e => { e.stopPropagation(); onDial(); }}
            className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md hover:bg-emerald-500/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            Call
          </button>
        )}
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function ClientDrawer({ form, setForm, isNew, agents, newNote, setNewNote, onAddNote, onFileUpload, fileRef, onSave, onClose, saving, hasExistingId, clientId, onDial }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const [recordings, setRecordings]   = useState([]);
  const [recUrls, setRecUrls]         = useState({});

  useEffect(() => {
    if (!clientId) return;
    supabase.from("calls")
      .select("id, created_at, duration, disposition, recording_path")
      .eq("client_id", clientId)
      .not("recording_path", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRecordings(data || []));
  }, [clientId]);

  useEffect(() => {
    recordings.forEach(async (rec) => {
      if (!rec.recording_path || recUrls[rec.recording_path]) return;
      const { data } = await supabase.storage.from("call-recordings").createSignedUrl(rec.recording_path, 3600);
      if (data?.signedUrl) setRecUrls(prev => ({ ...prev, [rec.recording_path]: data.signedUrl }));
    });
  }, [recordings]);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="h-full w-[460px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2130] flex-shrink-0">
          <h2 className="text-white font-semibold">{isNew ? "Add Client" : "Edit Client"}</h2>
          <div className="flex items-center gap-3">
            {!isNew && form.phone && onDial && (
              <button
                onClick={() => onDial(form.phone, clientId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                Call Client
              </button>
            )}
            <button onClick={onClose} className="text-[#4a5568] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <DrawerSection title="Client Info">
            <DrawerField label="Contact Name" value={form.contact_name} onChange={v => f("contact_name", v)} />
            <DrawerField label="Business Name" value={form.business_name} onChange={v => f("business_name", v)} />
            <DrawerField label="Phone" value={form.phone || ""} onChange={v => f("phone", v)} placeholder="+1 (555) 000-0000" />
          </DrawerSection>

          <DrawerSection title="Funding">
            <DrawerField label="Funded Amount ($)" value={form.funded_amount} onChange={v => f("funded_amount", v)} type="number" />
            <DrawerField label="Funding Date" value={form.funding_date} onChange={v => f("funding_date", v)} type="date" />
            <div>
              <DrawerLabel>Assigned Agent</DrawerLabel>
              <select value={form.assigned_agent_id || ""} onChange={e => f("assigned_agent_id", e.target.value)} className={selectCls}>
                <option value="">— Unassigned —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
              </select>
            </div>
          </DrawerSection>

          <DrawerSection title={`Notes (${(form.notes || []).length})`}>
            <div className="space-y-2">
              {(form.notes || []).map((n, i) => (
                <div key={i} className="bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2">
                  <p className="text-white text-xs leading-relaxed">{n.text}</p>
                  <p className="text-[#2d3748] text-[10px] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="flex-1 bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-xs placeholder-[#2d3748] resize-none focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
              />
              <button
                onClick={onAddNote}
                disabled={!newNote.trim()}
                className="self-end px-3 py-2 bg-[#1e2130] hover:bg-[#2a3040] disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </DrawerSection>

          {hasExistingId && (
            <DrawerSection title={`Documents (${(form.docs || []).length})`}>
              <div className="space-y-2">
                {(form.docs || []).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-[#4a5568] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs truncate hover:underline flex-1">{d.name}</a>
                  </div>
                ))}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={onFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-[#1e2130] hover:border-[#c9a84c]/30 rounded-lg py-3 text-[#4a5568] hover:text-white text-xs transition-all"
              >
                + Upload Document
              </button>
            </DrawerSection>
          )}

          {hasExistingId && recordings.length > 0 && (
            <DrawerSection title={`Recordings (${recordings.length})`}>
              <div className="space-y-3">
                {recordings.map(rec => (
                  <div key={rec.id} className="bg-[#080b10] border border-[#1e2130] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#8892a4] text-xs">{new Date(rec.created_at).toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        {rec.disposition && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${dispositionStyle(rec.disposition)}`}>
                            {dispositionLabel(rec.disposition)}
                          </span>
                        )}
                        <span className="text-[10px] text-[#4a5568]">{rec.duration}s</span>
                      </div>
                    </div>
                    {recUrls[rec.recording_path] ? (
                      <audio controls src={recUrls[rec.recording_path]} className="w-full" style={{ height: 32, accentColor: "#c9a84c" }} />
                    ) : (
                      <div className="text-[10px] text-[#4a5568] animate-pulse">Loading…</div>
                    )}
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#1e2130] flex gap-3 flex-shrink-0">
          <button
            onClick={onSave}
            disabled={saving || !form.contact_name.trim()}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {saving ? "Saving…" : isNew ? "Add Client" : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const selectCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function DrawerLabel({ children }) {
  return <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">{children}</label>;
}

function DrawerField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <DrawerLabel>{label}</DrawerLabel>
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
      />
    </div>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest whitespace-nowrap">{title}</p>
        <div className="flex-1 h-px bg-[#1e2130]" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
