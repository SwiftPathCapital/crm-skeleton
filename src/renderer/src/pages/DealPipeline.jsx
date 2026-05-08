import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const STAGES = [
  { id: "new_lead",     label: "New Lead",     bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400",    text: "text-blue-400" },
  { id: "app_sent",     label: "App Sent",     bg: "bg-purple-500/10 border-purple-500/20",   dot: "bg-purple-400",  text: "text-purple-400" },
  { id: "app_signed",   label: "App Signed",   bg: "bg-indigo-500/10 border-indigo-500/20",   dot: "bg-indigo-400",  text: "text-indigo-400" },
  { id: "underwriting", label: "Underwriting", bg: "bg-amber-500/10 border-amber-500/20",     dot: "bg-amber-400",   text: "text-amber-400" },
  { id: "funded",       label: "Funded",       bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400", text: "text-emerald-400" },
  { id: "declined",     label: "Declined",     bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400",     text: "text-red-400" },
];

const EMPTY_DEAL = {
  contact_name: "", business_name: "", lead_type: "",
  assigned_agent_id: "", stage: "new_lead",
  notes: [], docs: [], funded_amount: "", funded_date: "",
};

export default function DealPipeline({ agent }) {
  const [deals, setDeals]       = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [isNew, setIsNew]       = useState(false);
  const [form, setForm]         = useState(EMPTY_DEAL);
  const [newNote, setNewNote]   = useState("");
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([fetchDeals(), fetchAgents()]).then(() => setLoading(false));
  }, []);

  async function fetchDeals() {
    const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    setDeals(data || []);
  }

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("id, full_name, email");
    setAgents(data || []);
  }

  function agentName(id) {
    const a = agents.find(a => a.id === id);
    return a ? (a.full_name || a.email) : "—";
  }

  function openDeal(deal) {
    setSelected(deal);
    setIsNew(false);
    setForm({ ...deal, funded_amount: deal.funded_amount ?? "", funded_date: deal.funded_date ?? "" });
    setNewNote("");
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm({ ...EMPTY_DEAL });
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
    const { error } = await supabase.storage.from("deal-docs").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("deal-docs").getPublicUrl(path);
      setForm(f => ({ ...f, docs: [...(f.docs || []), { name: file.name, url: publicUrl }] }));
    }
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.contact_name.trim()) return;
    setSaving(true);
    try {
      const wasNotFunded = selected && selected.stage !== "funded";
      const nowFunded    = form.stage === "funded";

      const payload = {
        contact_name:      form.contact_name,
        business_name:     form.business_name,
        lead_type:         form.lead_type,
        assigned_agent_id: form.assigned_agent_id || null,
        stage:             form.stage,
        notes:             form.notes || [],
        docs:              form.docs  || [],
        funded_amount:     form.funded_amount ? parseFloat(form.funded_amount) : null,
        funded_date:       form.funded_date   || null,
        updated_at:        new Date().toISOString(),
      };

      let savedDeal;
      if (selected) {
        const { data } = await supabase.from("deals").update(payload).eq("id", selected.id).select().single();
        savedDeal = data;
      } else {
        const { data } = await supabase.from("deals").insert({ ...payload, created_at: new Date().toISOString() }).select().single();
        savedDeal = data;
      }

      // Auto-create client record when a deal is first marked Funded
      if (nowFunded && (wasNotFunded || !selected) && savedDeal) {
        const { data: existing } = await supabase.from("clients").select("id").eq("deal_id", savedDeal.id).maybeSingle();
        if (!existing) {
          await supabase.from("clients").insert({
            contact_name:      savedDeal.contact_name,
            business_name:     savedDeal.business_name,
            funded_amount:     savedDeal.funded_amount,
            funding_date:      savedDeal.funded_date,
            assigned_agent_id: savedDeal.assigned_agent_id,
            notes:             [],
            docs:              [],
            deal_id:           savedDeal.id,
            created_at:        new Date().toISOString(),
          });
        }
      }

      await fetchDeals();
      closeModal();
    } catch (err) {
      console.error("Error saving deal:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[#c9a84c] text-sm animate-pulse">Loading pipeline…</div>
    </div>
  );

  const modalOpen = selected || isNew;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Deal Pipeline</h1>
          <p className="text-[#4a5568] text-sm mt-1">{deals.length} deal{deals.length !== 1 ? "s" : ""} in progress</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deal
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto flex-1 pb-2 min-h-0">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          return (
            <div key={stage.id} className="flex flex-col w-52 flex-shrink-0 min-h-0">
              <div className={`flex items-center justify-between px-3 py-2 mb-2 rounded-lg border ${stage.bg}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
                  <span className={`text-xs font-semibold ${stage.text}`}>{stage.label}</span>
                </div>
                <span className="text-[#4a5568] text-xs tabular-nums">{stageDeals.length}</span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {stageDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} agentName={agentName} onClick={() => openDeal(deal)} />
                ))}
                {stageDeals.length === 0 && (
                  <div className="border border-dashed border-[#1e2130] rounded-lg py-8 text-center">
                    <p className="text-[#2d3748] text-xs">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Side drawer */}
      {modalOpen && (
        <DealDrawer
          form={form}
          setForm={setForm}
          isNew={isNew}
          agents={agents}
          stages={STAGES}
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

// ── Deal card ─────────────────────────────────────────────────────────────────

const LEAD_TYPE_COLORS = {
  ucc: "text-blue-400", trigger: "text-orange-400",
  aged: "text-yellow-400", web: "text-emerald-400", live_transfer: "text-purple-400",
};

function DealCard({ deal, agentName, onClick }) {
  const docCount  = (deal.docs  || []).length;
  const noteCount = (deal.notes || []).length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#0d1117] border border-[#1e2130] rounded-lg p-3 hover:border-[#c9a84c]/30 hover:bg-[#111520] transition-all group"
    >
      <p className="text-white text-xs font-semibold truncate group-hover:text-[#c9a84c] transition-colors">
        {deal.contact_name || "Unnamed"}
      </p>
      {deal.business_name && (
        <p className="text-[#4a5568] text-[10px] truncate mt-0.5">{deal.business_name}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {deal.lead_type && (
          <span className={`text-[10px] font-medium capitalize ${LEAD_TYPE_COLORS[deal.lead_type] || "text-[#4a5568]"}`}>
            {deal.lead_type.replace("_", " ")}
          </span>
        )}
      </div>
      <p className="text-[#4a5568] text-[10px] truncate mt-1">{agentName(deal.assigned_agent_id)}</p>
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#1e2130]">
        <span className="text-[10px] text-[#2d3748]">{docCount} doc{docCount !== 1 ? "s" : ""}</span>
        <span className="text-[10px] text-[#2d3748]">{noteCount} note{noteCount !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function DealDrawer({ form, setForm, isNew, agents, stages, newNote, setNewNote, onAddNote, onFileUpload, fileRef, onSave, onClose, saving, hasExistingId }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Scrim */}
      <div className="flex-1 bg-black/40" />
      {/* Panel */}
      <div
        className="h-full w-[460px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2130] flex-shrink-0">
          <h2 className="text-white font-semibold">{isNew ? "New Deal" : "Edit Deal"}</h2>
          <button onClick={onClose} className="text-[#4a5568] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <DrawerSection title="Contact Info">
            <DrawerField label="Contact Name" value={form.contact_name} onChange={v => f("contact_name", v)} />
            <DrawerField label="Business Name" value={form.business_name} onChange={v => f("business_name", v)} />
          </DrawerSection>

          <DrawerSection title="Deal Info">
            <div>
              <DrawerLabel>Lead Type</DrawerLabel>
              <select value={form.lead_type} onChange={e => f("lead_type", e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                {["ucc","trigger","aged","web","live_transfer"].map(t => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <DrawerLabel>Stage</DrawerLabel>
              <select value={form.stage} onChange={e => f("stage", e.target.value)} className={selectCls}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <DrawerLabel>Assigned Agent</DrawerLabel>
              <select value={form.assigned_agent_id || ""} onChange={e => f("assigned_agent_id", e.target.value)} className={selectCls}>
                <option value="">— Unassigned —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
              </select>
            </div>
          </DrawerSection>

          {form.stage === "funded" && (
            <DrawerSection title="Funding">
              <DrawerField label="Funded Amount ($)" value={form.funded_amount} onChange={v => f("funded_amount", v)} type="number" />
              <DrawerField label="Funded Date" value={form.funded_date} onChange={v => f("funded_date", v)} type="date" />
            </DrawerSection>
          )}

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
            {saving ? "Saving…" : isNew ? "Create Deal" : "Save Changes"}
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

// ── Shared sub-components ─────────────────────────────────────────────────────

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
