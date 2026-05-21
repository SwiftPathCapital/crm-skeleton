import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import LeadTable from "../components/LeadTable";
import AnnouncementsBanner from "../components/AnnouncementsBanner";

const LEAD_TYPES = [
  { value: "ucc",           label: "UCC" },
  { value: "trigger",       label: "Trigger" },
  { value: "aged",          label: "Aged" },
  { value: "web",           label: "Web" },
  { value: "live_transfer", label: "Live Transfer" },
];

const STATUSES = ["New","Contacted","Callback","App Sent","App Signed","Not Interested","Funded","DNC"];

const EMPTY = {
  lead_type: "ucc", first_name: "", last_name: "", company_name: "",
  phone: "", email: "", address: "", city: "", state: "", zip: "",
  lead_vendor: "", status: "New",
};

const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors placeholder-[#4a5568]";
const selectCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

function Label({ children }) {
  return <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">{children}</label>;
}

function Section({ title, children }) {
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

export default function MyLeads({ leads, onSaveLead, onRefresh, onOpenEmailClient }) {
  const { agent, userId } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  function openDrawer() {
    setForm(EMPTY);
    setDrawerOpen(true);
  }

  async function handleAdd() {
    if (!form.phone.trim() && !form.first_name.trim() && !form.company_name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("leads").insert({
        lead_type:    form.lead_type,
        first_name:   form.first_name  || null,
        last_name:    form.last_name   || null,
        company_name: form.company_name || null,
        phone:        form.phone       || null,
        email:        form.email       || null,
        address:      form.address     || null,
        city:         form.city        || null,
        state:        form.state       || null,
        zip:          form.zip         || null,
        lead_vendor:  form.lead_vendor || null,
        status:       form.status,
        assigned_to:  userId,
        created_at:   new Date().toISOString(),
      });
      if (error) throw error;
      setDrawerOpen(false);
      onRefresh?.();
    } catch (err) {
      alert("Error adding lead: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <AnnouncementsBanner />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">My Leads</h1>
          <p className="text-[#4a5568] text-sm mt-1">Click any row to expand and edit lead details.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] border border-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={openDrawer}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </button>
        </div>
      </div>

      <LeadTable leads={leads} onSaveLead={onSaveLead} onOpenEmailClient={onOpenEmailClient} onRefresh={onRefresh} />

      {/* Add Lead Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="flex-1 bg-black/40" />
          <div
            className="h-full w-[460px] bg-[#0d1117] border-l border-[#1e2130] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2130] flex-shrink-0">
              <h2 className="text-white font-semibold">Add Lead</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-[#4a5568] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <Section title="Lead Info">
                <div>
                  <Label>Lead Type</Label>
                  <select value={form.lead_type} onChange={e => f("lead_type", e.target.value)} className={selectCls}>
                    {LEAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={e => f("status", e.target.value)} className={selectCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Lead Vendor</Label>
                  <input value={form.lead_vendor} onChange={e => f("lead_vendor", e.target.value)} className={inputCls} placeholder="e.g. Data vendor name" />
                </div>
              </Section>

              <Section title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <input value={form.first_name} onChange={e => f("first_name", e.target.value)} className={inputCls} placeholder="John" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <input value={form.last_name} onChange={e => f("last_name", e.target.value)} className={inputCls} placeholder="Smith" />
                  </div>
                </div>
                <div>
                  <Label>Company Name</Label>
                  <input value={form.company_name} onChange={e => f("company_name", e.target.value)} className={inputCls} placeholder="Acme LLC" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <input value={form.phone} onChange={e => f("phone", e.target.value)} className={inputCls} placeholder="+1 (555) 000-0000" />
                </div>
                <div>
                  <Label>Email</Label>
                  <input type="email" value={form.email} onChange={e => f("email", e.target.value)} className={inputCls} placeholder="john@example.com" />
                </div>
              </Section>

              <Section title="Address">
                <div>
                  <Label>Street Address</Label>
                  <input value={form.address} onChange={e => f("address", e.target.value)} className={inputCls} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label>City</Label>
                    <input value={form.city} onChange={e => f("city", e.target.value)} className={inputCls} placeholder="Miami" />
                  </div>
                  <div>
                    <Label>State</Label>
                    <input value={form.state} onChange={e => f("state", e.target.value)} className={inputCls} placeholder="FL" maxLength={2} />
                  </div>
                  <div>
                    <Label>Zip</Label>
                    <input value={form.zip} onChange={e => f("zip", e.target.value)} className={inputCls} placeholder="33101" />
                  </div>
                </div>
              </Section>
            </div>

            <div className="px-6 py-4 border-t border-[#1e2130] flex gap-3 flex-shrink-0">
              <button
                onClick={handleAdd}
                disabled={saving || (!form.phone.trim() && !form.first_name.trim() && !form.company_name.trim())}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {saving ? "Adding…" : "Add Lead"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
