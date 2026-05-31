import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const API_BASE =
  typeof window !== "undefined" && window.location?.protocol === "file:"
    ? "http://localhost:3001"
    : "";

const STAGES = [
  { id: "new_lead",     label: "New Lead",     bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400",    text: "text-blue-400" },
  { id: "app_sent",     label: "App Sent",     bg: "bg-purple-500/10 border-purple-500/20",   dot: "bg-purple-400",  text: "text-purple-400" },
  { id: "app_signed",   label: "App Signed",   bg: "bg-indigo-500/10 border-indigo-500/20",   dot: "bg-indigo-400",  text: "text-indigo-400" },
  { id: "underwriting", label: "Underwriting", bg: "bg-amber-500/10 border-amber-500/20",     dot: "bg-amber-400",   text: "text-amber-400" },
  { id: "funded",       label: "Funded",       bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400", text: "text-emerald-400" },
  { id: "declined",     label: "Declined",     bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400",     text: "text-red-400" },
];

const EMPTY_DEAL = {
  lead_id: null,
  contact_name: "", business_name: "", lead_type: "",
  assigned_agent_id: "", stage: "new_lead",
  notes: [], docs: [],
  funded_amount: "", funded_date: "",
  commission_rate: "", commission_amount: "",
};

function dollar(n) {
  if (!n && n !== 0) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function DealPipeline({ agent, onViewLead }) {
  const { userId } = useApp();
  const [deals, setDeals]                   = useState([]);
  const [removedDeals, setRemovedDeals]     = useState([]);
  const [agents, setAgents]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selected, setSelected]             = useState(null);
  const [isNew, setIsNew]                   = useState(false);
  const [form, setForm]                     = useState(EMPTY_DEAL);
  const [newNote, setNewNote]               = useState("");
  const [saving, setSaving]                 = useState(false);
  const [dragOverStage, setDragOverStage]   = useState(null);
  const [showRemoved, setShowRemoved]       = useState(false);
  const draggingId = useRef(null);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([fetchDeals(), fetchAgents()]).then(() => setLoading(false));
  }, []);

  async function fetchDeals() {
    let query = supabase.from("deals").select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (agent?.role === "agent") query = query.eq("assigned_agent_id", agent.id);
    const { data } = await query;
    setDeals(data || []);

    if (agent?.role === "admin") {
      const { data: removed } = await supabase
        .from("deals")
        .select("*, agents!deals_deleted_by_fkey(name, email)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      setRemovedDeals(removed || []);
    }
  }

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("id, name, email");
    setAgents(data || []);
  }

  function agentName(id) {
    const a = agents.find(a => a.id === id);
    return a ? (a.name || a.email) : "—";
  }

  function openDeal(deal) {
    setSelected(deal);
    setIsNew(false);
    setForm({
      ...deal,
      lead_id:           deal.lead_id           ?? null,
      funded_amount:     deal.funded_amount     ?? "",
      funded_date:       deal.funded_date       ?? "",
      commission_rate:   deal.commission_rate   ?? "",
      commission_amount: deal.commission_amount ?? "",
    });
    setNewNote("");
  }

  function openNew() {
    setSelected(null);
    setIsNew(true);
    setForm({ ...EMPTY_DEAL, assigned_agent_id: agent?.role === "agent" ? agent.id : "" });
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

  async function handleDrop(stageId) {
    const id = draggingId.current;
    if (!id) return;
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.stage === stageId) return;

    const wasNotFunded = deal.stage !== "funded";
    const nowFunded    = stageId === "funded";

    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: stageId } : d));
    await supabase.from("deals").update({ stage: stageId, updated_at: new Date().toISOString() }).eq("id", id);

    if (nowFunded && wasNotFunded) {
      const { data: existing } = await supabase.from("clients").select("id").eq("deal_id", id).maybeSingle();
      if (!existing) {
        await supabase.from("clients").insert({
          contact_name:      deal.contact_name,
          business_name:     deal.business_name,
          funded_amount:     deal.funded_amount,
          funding_date:      deal.funded_date,
          assigned_agent_id: deal.assigned_agent_id,
          notes: [], docs: [],
          deal_id:    id,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  async function handleRemoveDeal(dealId) {
    if (!confirm("Remove this deal? Admins will be notified and can restore it.")) return;
    await supabase.from("deals").update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    }).eq("id", dealId);
    setDeals(prev => prev.filter(d => d.id !== dealId));
    closeModal();
  }

  async function handleRestoreDeal(dealId) {
    await supabase.from("deals").update({ deleted_at: null, deleted_by: null }).eq("id", dealId);
    setRemovedDeals(prev => prev.filter(d => d.id !== dealId));
    await fetchDeals();
  }

  async function handlePermanentDelete(dealId) {
    if (!confirm("Permanently delete this deal? This cannot be undone.")) return;
    await supabase.from("deals").delete().eq("id", dealId);
    setRemovedDeals(prev => prev.filter(d => d.id !== dealId));
  }

  async function handleSave() {
    if (!form.contact_name.trim()) return;
    setSaving(true);
    try {
      const wasNotFunded = selected && selected.stage !== "funded";
      const nowFunded    = form.stage === "funded";

      const payload = {
        lead_id:           form.lead_id           || null,
        contact_name:      form.contact_name,
        business_name:     form.business_name,
        lead_type:         form.lead_type,
        assigned_agent_id: form.assigned_agent_id || null,
        stage:             form.stage,
        notes:             form.notes || [],
        docs:              form.docs  || [],
        funded_amount:     form.funded_amount     ? parseFloat(form.funded_amount)     : null,
        funded_date:       form.funded_date       || null,
        commission_rate:   form.commission_rate   ? parseFloat(form.commission_rate)   : 0,
        commission_amount: form.commission_amount ? parseFloat(form.commission_amount) : 0,
        updated_at:        new Date().toISOString(),
      };

      let savedDeal;
      if (selected) {
        const { data, error } = await supabase.from("deals").update(payload).eq("id", selected.id).select().single();
        if (error) throw error;
        savedDeal = data;
      } else {
        const { data, error } = await supabase.from("deals").insert({ ...payload, created_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        savedDeal = data;
      }

      if (nowFunded && (wasNotFunded || !selected) && savedDeal) {
        const { data: existing } = await supabase.from("clients").select("id").eq("deal_id", savedDeal.id).maybeSingle();
        if (!existing) {
          await supabase.from("clients").insert({
            contact_name:      savedDeal.contact_name,
            business_name:     savedDeal.business_name,
            funded_amount:     savedDeal.funded_amount,
            funding_date:      savedDeal.funded_date,
            assigned_agent_id: savedDeal.assigned_agent_id,
            notes: [], docs: [],
            deal_id:    savedDeal.id,
            created_at: new Date().toISOString(),
          });
        }
      }

      await fetchDeals();
      closeModal();
    } catch (err) {
      console.error("Error saving deal:", err);
      alert("Error saving deal: " + (err.message || err));
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

      <div className="flex gap-3 overflow-x-auto flex-1 pb-2 min-h-0">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          return (
            <div
              key={stage.id}
              className="flex flex-col w-52 flex-shrink-0 min-h-0"
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
              onDrop={() => { handleDrop(stage.id); setDragOverStage(null); draggingId.current = null; }}
            >
              <div className={`flex items-center justify-between px-3 py-2 mb-2 rounded-lg border ${stage.bg}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
                  <span className={`text-xs font-semibold ${stage.text}`}>{stage.label}</span>
                </div>
                <span className="text-[#4a5568] text-xs tabular-nums">{stageDeals.length}</span>
              </div>

              <div className={`flex flex-col gap-2 overflow-y-auto flex-1 rounded-lg transition-all ${dragOverStage === stage.id ? "ring-1 ring-[#c9a84c]/40 bg-[#c9a84c]/5" : ""}`}>
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    agentName={agentName}
                    onClick={() => openDeal(deal)}
                    onDragStart={() => { draggingId.current = deal.id; }}
                  />
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

      {/* Removed Deals — admin only */}
      {agent?.role === "admin" && (
        <div className="flex-shrink-0 mt-3 border-t border-[#1e2130] pt-3">
          <button
            onClick={() => setShowRemoved(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-[#4a5568] hover:text-white transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showRemoved ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Removed by Agents
            {removedDeals.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold">
                {removedDeals.length}
              </span>
            )}
          </button>

          {showRemoved && (
            <div className="mt-3 overflow-auto rounded-xl border border-[#1e2130]">
              {removedDeals.length === 0 ? (
                <p className="text-center text-[#4a5568] text-xs py-6">No removed deals</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2130] bg-[#0d1117]">
                      {["Contact", "Business", "Stage", "Removed By", "Removed At", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#4a5568] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {removedDeals.map((d, i) => {
                      const stage = STAGES.find(s => s.id === d.stage);
                      const agentWho = d.agents?.name || d.agents?.email || "Unknown";
                      return (
                        <tr key={d.id} className={`border-b border-[#1e2130] ${i % 2 === 0 ? "bg-[#080b10]" : "bg-[#0a0d14]"}`}>
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{d.contact_name || "—"}</td>
                          <td className="px-4 py-3 text-[#8892a4] max-w-[160px] truncate">{d.business_name || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-semibold ${stage?.text || "text-[#4a5568]"}`}>{stage?.label || d.stage}</span>
                          </td>
                          <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap">{agentWho}</td>
                          <td className="px-4 py-3 text-[#4a5568] whitespace-nowrap text-xs">
                            {new Date(d.deleted_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRestoreDeal(d.id)}
                                className="px-2.5 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(d.id)}
                                className="px-2.5 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

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
          isAdmin={agent?.role === "admin"}
          dealId={selected?.id || null}
          currentUserId={userId}
          onRemoveDeal={handleRemoveDeal}
          selectedDealId={selected?.id || null}
          onViewLead={onViewLead}
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

function DealCard({ deal, agentName, onClick, onDragStart }) {
  const docCount  = (deal.docs  || []).length;
  const noteCount = (deal.notes || []).length;

  return (
    <button
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(); }}
      onClick={onClick}
      className="w-full text-left bg-[#0d1117] border border-[#1e2130] rounded-lg p-3 hover:border-[#c9a84c]/30 hover:bg-[#111520] transition-all group cursor-grab active:cursor-grabbing"
    >
      <p className="text-white text-xs font-semibold truncate group-hover:text-[#c9a84c] transition-colors">
        {deal.contact_name || "Unnamed"}
      </p>
      {deal.business_name && (
        <p className="text-[#4a5568] text-[10px] truncate mt-0.5">{deal.business_name}</p>
      )}
      {deal.funded_amount > 0 && (
        <p className="text-emerald-400 text-[10px] font-semibold mt-1">{dollar(deal.funded_amount)}</p>
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

const OFFER_EMPTY = { amount: "", factor_rate: "", term: "", position: "1st", notes: "" };

function DealDrawer({ form, setForm, isNew, agents, stages, newNote, setNewNote, onAddNote, onFileUpload, fileRef, onSave, onClose, saving, hasExistingId, isAdmin, dealId, currentUserId, onRemoveDeal, selectedDealId, onViewLead }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const [offers,      setOffers]      = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerForm,   setOfferForm]   = useState(OFFER_EMPTY);
  const [offerSaving, setOfferSaving] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);

  useEffect(() => {
    if (!dealId) { setOffers([]); return; }
    setOffersLoading(true);
    supabase.from("offers").select("*").eq("deal_id", dealId).order("created_at", { ascending: false })
      .then(({ data }) => { setOffers(data || []); setOffersLoading(false); });
  }, [dealId]);

  function handleCommissionCalc(key, val) {
    const updated = { ...form, [key]: val };
    const fa = parseFloat(updated.funded_amount) || 0;
    const cr = parseFloat(updated.commission_rate) || 0;
    if (fa && cr && key !== "commission_amount") {
      updated.commission_amount = ((fa * cr) / 100).toFixed(2);
    }
    setForm(updated);
  }

  async function addOffer() {
    if (!offerForm.amount || !dealId) return;
    setOfferSaving(true);
    const { data } = await supabase.from("offers").insert({
      deal_id:     dealId,
      agent_id:    currentUserId,
      amount:      parseFloat(offerForm.amount),
      factor_rate: offerForm.factor_rate ? parseFloat(offerForm.factor_rate) : null,
      term:        offerForm.term.trim(),
      position:    offerForm.position,
      notes:       offerForm.notes.trim(),
      status:      "sent",
    }).select().single();
    if (data) setOffers(prev => [data, ...prev]);
    setOfferForm(OFFER_EMPTY);
    setShowOfferForm(false);
    setOfferSaving(false);
  }

  async function updateOfferStatus(offerId, status) {
    await supabase.from("offers").update({ status }).eq("id", offerId);
    setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status } : o));
  }

  const OFFER_STATUS_STYLES = {
    sent:     "bg-[#1e2130] text-[#8892a4]",
    accepted: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    declined: "bg-red-500/10 text-red-400 border border-red-500/20",
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="h-full w-[480px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
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
            <LeadPicker form={form} setForm={setForm} />
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
            {isAdmin && (
              <div>
                <DrawerLabel>Assigned Agent</DrawerLabel>
                <select value={form.assigned_agent_id || ""} onChange={e => f("assigned_agent_id", e.target.value)} className={selectCls}>
                  <option value="">— Unassigned —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                </select>
              </div>
            )}
          </DrawerSection>

          {/* ── Offers ── */}
          {hasExistingId && (
            <DrawerSection title={`Offers (${offers.length})`}>
              {offersLoading ? (
                <p className="text-[#4a5568] text-xs">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {offers.map(o => (
                    <div key={o.id} className="bg-[#080b10] border border-[#1e2130] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold">{dollar(o.amount)}</p>
                          <p className="text-[#4a5568] text-[10px] mt-0.5">
                            {o.factor_rate ? `${o.factor_rate}x factor` : ""}
                            {o.factor_rate && o.term ? " · " : ""}
                            {o.term}
                            {o.position ? ` · ${o.position} position` : ""}
                          </p>
                          {o.notes && <p className="text-[#4a5568] text-[10px] mt-1">{o.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${OFFER_STATUS_STYLES[o.status] || OFFER_STATUS_STYLES.sent}`}>
                            {o.status}
                          </span>
                          {o.status === "sent" && (
                            <>
                              <button
                                onClick={() => updateOfferStatus(o.id, "accepted")}
                                className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] hover:bg-emerald-500/20 transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => updateOfferStatus(o.id, "declined")}
                                className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] hover:bg-red-500/20 transition-colors"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showOfferForm ? (
                <div className="bg-[#080b10] border border-[#1e2130] rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <DrawerLabel>Amount ($)</DrawerLabel>
                      <input type="number" value={offerForm.amount} onChange={e => setOfferForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="50000" className={miniInputCls} />
                    </div>
                    <div>
                      <DrawerLabel>Factor Rate</DrawerLabel>
                      <input type="number" step="0.01" value={offerForm.factor_rate} onChange={e => setOfferForm(f => ({ ...f, factor_rate: e.target.value }))}
                        placeholder="1.35" className={miniInputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <DrawerLabel>Term</DrawerLabel>
                      <input type="text" value={offerForm.term} onChange={e => setOfferForm(f => ({ ...f, term: e.target.value }))}
                        placeholder="6 months" className={miniInputCls} />
                    </div>
                    <div>
                      <DrawerLabel>Position</DrawerLabel>
                      <select value={offerForm.position} onChange={e => setOfferForm(f => ({ ...f, position: e.target.value }))} className={miniInputCls}>
                        {["1st","2nd","3rd"].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <DrawerLabel>Notes</DrawerLabel>
                    <input type="text" value={offerForm.notes} onChange={e => setOfferForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Additional details…" className={miniInputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={addOffer}
                      disabled={!offerForm.amount || offerSaving}
                      className="flex-1 py-1.5 bg-[#c9a84c] text-[#080b10] text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
                    >
                      {offerSaving ? "Saving…" : "Log Offer"}
                    </button>
                    <button onClick={() => { setShowOfferForm(false); setOfferForm(OFFER_EMPTY); }}
                      className="px-3 py-1.5 bg-[#1e2130] text-[#8892a4] text-xs rounded-lg hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowOfferForm(true)}
                  className="w-full border border-dashed border-[#1e2130] hover:border-[#c9a84c]/30 rounded-lg py-2.5 text-[#4a5568] hover:text-white text-xs transition-all"
                >
                  + Log Offer Sent
                </button>
              )}
            </DrawerSection>
          )}

          {/* ── Funding & Commission ── */}
          <DrawerSection title="Funding &amp; Commission">
            <div className="grid grid-cols-2 gap-3">
              <DrawerField label="Funded Amount ($)" value={form.funded_amount}
                onChange={v => handleCommissionCalc("funded_amount", v)} type="number" />
              <DrawerField label="Funded Date" value={form.funded_date}
                onChange={v => f("funded_date", v)} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DrawerField label="Commission Rate (%)" value={form.commission_rate}
                onChange={v => handleCommissionCalc("commission_rate", v)} type="number" />
              <div>
                <DrawerLabel>Commission ($)</DrawerLabel>
                <input
                  type="number"
                  value={form.commission_amount}
                  onChange={e => f("commission_amount", e.target.value)}
                  placeholder="Auto-calculated"
                  className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-emerald-400 text-sm font-semibold focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
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
            {saving ? "Saving…" : isNew ? "Create Deal" : "Save Changes"}
          </button>
          {form.lead_id && onViewLead && (
            <button
              onClick={() => { onClose(); onViewLead(form.lead_id); }}
              className="px-3 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              title="Open this lead in My Leads"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Lead
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
          >
            Cancel
          </button>
          {!isNew && !isAdmin && selectedDealId && (
            <button
              onClick={() => onRemoveDeal(selectedDealId)}
              className="px-3 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 text-sm rounded-lg hover:bg-red-500/20 transition-colors"
              title="Remove deal (admin will be notified)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lead Picker ───────────────────────────────────────────────────────────────

function LeadPicker({ form, setForm }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [open,      setOpen]      = useState(false);
  const [mode,      setMode]      = useState(form.lead_id ? "linked" : form.contact_name ? "manual" : "search");
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  // close dropdown on outside click
  useEffect(() => {
    function handle(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // debounced search
  useEffect(() => {
    if (mode !== "search") return;
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const q = query.trim();
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, company_name, phone, email")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      setResults(data || []);
      setOpen(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, mode]);

  function selectLead(lead) {
    setForm(f => ({
      ...f,
      lead_id:       lead.id,
      contact_name:  [lead.first_name, lead.last_name].filter(Boolean).join(" "),
      business_name: lead.company_name || "",
    }));
    setMode("linked");
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clearLead() {
    setForm(f => ({ ...f, lead_id: null, contact_name: "", business_name: "" }));
    setMode("search");
    setQuery("");
  }

  function goManual() {
    setForm(f => ({ ...f, lead_id: null }));
    setMode("manual");
    setOpen(false);
    setQuery("");
  }

  const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

  if (mode === "linked") {
    return (
      <div className="bg-[#080b10] border border-[#c9a84c]/20 rounded-lg px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{form.contact_name || "—"}</p>
            {form.business_name && <p className="text-[#4a5568] text-xs truncate mt-0.5">{form.business_name}</p>}
            <p className="text-[#c9a84c] text-[10px] mt-1 font-medium">Linked from CRM</p>
          </div>
          <button onClick={clearLead} className="text-[#4a5568] hover:text-white transition-colors flex-shrink-0 mt-0.5" title="Change contact">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="space-y-3">
        <DrawerField label="Contact Name" value={form.contact_name} onChange={v => setForm(f => ({ ...f, contact_name: v }))} />
        <DrawerField label="Business Name" value={form.business_name} onChange={v => setForm(f => ({ ...f, business_name: v }))} />
        <button onClick={() => setMode("search")} className="text-[#4a5568] hover:text-[#c9a84c] text-xs transition-colors">
          ← Search CRM instead
        </button>
      </div>
    );
  }

  // search mode
  return (
    <div ref={wrapRef} className="relative">
      <DrawerLabel>Search CRM (name, phone, or email)</DrawerLabel>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Type to search…"
          className={inputCls}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0d1117] border border-[#1e2130] rounded-lg shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-[#4a5568] text-xs">No matches found</div>
          ) : (
            results.map(lead => (
              <button
                key={lead.id}
                onMouseDown={() => selectLead(lead)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#111520] transition-colors border-b border-[#1e2130] last:border-0"
              >
                <p className="text-white text-xs font-semibold">
                  {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed"}
                  {lead.company_name && <span className="text-[#4a5568] font-normal"> · {lead.company_name}</span>}
                </p>
                <p className="text-[#4a5568] text-[10px] mt-0.5 font-mono">
                  {lead.phone && <span>{lead.phone}</span>}
                  {lead.phone && lead.email && <span className="mx-1">·</span>}
                  {lead.email && <span>{lead.email}</span>}
                </p>
              </button>
            ))
          )}
          <button
            onMouseDown={goManual}
            className="w-full text-left px-3 py-2.5 text-[#c9a84c] text-xs hover:bg-[#111520] transition-colors border-t border-[#1e2130]"
          >
            + Not in CRM — enter manually
          </button>
        </div>
      )}

      <button onClick={goManual} className="mt-1.5 text-[#4a5568] hover:text-[#c9a84c] text-xs transition-colors">
        Not in CRM? Enter manually →
      </button>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

const selectCls   = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";
const miniInputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

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
