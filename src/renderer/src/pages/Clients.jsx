import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const EMPTY_CLIENT = {
  contact_name: "", business_name: "",
  funded_amount: "", funding_date: "",
  assigned_agent_id: "", notes: [], docs: [],
};

export default function Clients() {
  const [clients, setClients]   = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [isNew, setIsNew]       = useState(false);
  const [form, setForm]         = useState(EMPTY_CLIENT);
  const [newNote, setNewNote]   = useState("");
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([fetchClients(), fetchAgents()]).then(() => setLoading(false));
  }, []);

  async function fetchClients() {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients(data || []);
  }

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("id, full_name, email");
    setAgents(data || []);
  }

  function agentName(id) {
    const a = agents.find(a => a.id === id);
    return a ? (a.full_name || a.email) : "—";
  }

  function openClient(client) {
    setSelected(client);
    setIsNew(false);
    setForm({ ...client, funded_amount: client.funded_amount ?? "", funding_date: client.funding_date ?? "" });
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

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[#c9a84c] text-sm animate-pulse">Loading clients…</div>
    </div>
  );

  const modalOpen = selected || isNew;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            {clients.length} funded client{clients.length !== 1 ? "s" : ""}
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

      {/* Grid */}
      {clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-[#0d1117] border border-[#1e2130] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#2d3748]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-[#4a5568] text-sm font-medium">No clients yet</p>
            <p className="text-[#2d3748] text-xs mt-1 max-w-xs">
              Clients are added automatically when a deal is marked Funded, or you can add them manually.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4 pb-4">
            {clients.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                agentName={agentName}
                onClick={() => openClient(client)}
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
        />
      )}
    </div>
  );
}

// ── Client card ───────────────────────────────────────────────────────────────

function ClientCard({ client, agentName, onClick }) {
  const amount    = client.funded_amount ? "$" + Number(client.funded_amount).toLocaleString() : null;
  const docCount  = (client.docs  || []).length;
  const noteCount = (client.notes || []).length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-[#0d1117] border border-[#1e2130] rounded-xl p-5 hover:border-[#c9a84c]/30 hover:bg-[#111520] transition-all group"
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
        <div className="flex items-center gap-2">
          <span className="text-[#2d3748] text-[10px] uppercase tracking-wider w-16 flex-shrink-0">Agent</span>
          <span className="text-[#8892a4] text-xs truncate">{agentName(client.assigned_agent_id)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2130]">
        <span className="text-[10px] text-[#2d3748]">{noteCount} note{noteCount !== 1 ? "s" : ""}</span>
        <span className="text-[10px] text-[#2d3748]">{docCount} doc{docCount !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function ClientDrawer({ form, setForm, isNew, agents, newNote, setNewNote, onAddNote, onFileUpload, fileRef, onSave, onClose, saving, hasExistingId }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="h-full w-[460px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2130] flex-shrink-0">
          <h2 className="text-white font-semibold">{isNew ? "Add Client" : "Edit Client"}</h2>
          <button onClick={onClose} className="text-[#4a5568] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <DrawerSection title="Client Info">
            <DrawerField label="Contact Name" value={form.contact_name} onChange={v => f("contact_name", v)} />
            <DrawerField label="Business Name" value={form.business_name} onChange={v => f("business_name", v)} />
          </DrawerSection>

          <DrawerSection title="Funding">
            <DrawerField label="Funded Amount ($)" value={form.funded_amount} onChange={v => f("funded_amount", v)} type="number" />
            <DrawerField label="Funding Date" value={form.funding_date} onChange={v => f("funding_date", v)} type="date" />
            <div>
              <DrawerLabel>Assigned Agent</DrawerLabel>
              <select value={form.assigned_agent_id || ""} onChange={e => f("assigned_agent_id", e.target.value)} className={selectCls}>
                <option value="">— Unassigned —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
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

function DrawerField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <DrawerLabel>{label}</DrawerLabel>
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
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
