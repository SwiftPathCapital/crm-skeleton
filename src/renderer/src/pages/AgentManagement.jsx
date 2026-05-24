import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const API_BASE = window.location?.protocol === "file:" ? "http://localhost:3001" : "";

export default function AgentManagement() {
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: "", email: "", password: "", role: "agent", did: "", sip_username: "", sip_password: "" });
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [editAgent, setEditAgent] = useState(null);
  const [editForm, setEditForm]   = useState({ name: "", email: "", role: "agent", did: "", sip_username: "", sip_password: "" });
  const [saving, setSaving]           = useState(false);
  const [editError, setEditError]     = useState(null);
  const [resetSent, setResetSent]     = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwSuccess, setPwSuccess]     = useState(false);

  useEffect(() => { fetchAgents(); }, []);

  async function fetchAgents() {
    const { data } = await supabase.from("agents").select("*").order("name");
    setAgents(data || []);
    setLoading(false);
  }

  async function getAuthToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function handleCreateAgent(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/agents/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");

      setSuccess(`Agent ${form.name} created! They can now log into both the CRM and the dialer.`);
      setForm({ name: "", email: "", password: "", role: "agent", did: "", sip_username: "", sip_password: "" });
      setShowForm(false);
      fetchAgents();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword.trim()) return;
    setPwSaving(true);
    setPwSuccess(false);
    setEditError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/agents/${editAgent.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setNewPassword("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  function openEdit(agent) {
    setEditAgent(agent);
    setNewPassword("");
    setPwSuccess(false);
    setEditForm({
      name:         agent.name         || "",
      email:        agent.email        || "",
      role:         agent.role         || "agent",
      did:          agent.did          || "",
      sip_username: agent.sip_username || "",
      sip_password: agent.sip_password || "",
    });
    setEditError(null);
    setResetSent(false);
  }

  async function handleResetPassword() {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(editAgent.email);
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleUpdateAgent(e) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          name:         editForm.name,
          email:        editForm.email,
          role:         editForm.role,
          did:          editForm.did          || null,
          sip_username: editForm.sip_username || null,
          sip_password: editForm.sip_password || null,
        })
        .eq("id", editAgent.id);
      if (error) throw error;
      setSuccess(`${editForm.name} updated.`);
      setEditAgent(null);
      fetchAgents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!window.confirm(`Delete ${editAgent.name}? This removes their CRM and dialer access.`)) return;
    setDeleting(true);
    setEditError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/api/agents/${editAgent.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete agent");
      setEditAgent(null);
      fetchAgents();
      setSuccess(`${editAgent.name} deleted.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c] transition-colors";
  const labelCls = "text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Agent Management</h1>
          <p className="text-[#4a5568] text-sm mt-1">Create and manage agent accounts across CRM and dialer.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Agent
        </button>
      </div>

      {success && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
          <p className="text-emerald-400 text-sm">{success}</p>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-[#0d1117] border border-[#1e2130] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">New Agent</h2>
          <form onSubmit={handleCreateAgent} className="grid grid-cols-2 gap-4">
            {[
              { label: "Full Name",       key: "name",         type: "text",     placeholder: "John Smith" },
              { label: "Email",           key: "email",        type: "email",    placeholder: "john@swiftpathtocapital.com" },
              { label: "Password",        key: "password",     type: "password", placeholder: "••••••••" },
              { label: "DID (Phone #)",   key: "did",          type: "text",     placeholder: "+13055551234" },
              { label: "SIP Username",    key: "sip_username", type: "text",     placeholder: "john.smith" },
              { label: "SIP Password",    key: "sip_password", type: "password", placeholder: "••••••••" },
            ].map((field) => (
              <div key={field.key}>
                <label className={labelCls}>{field.label}</label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={inputCls}
                  required={field.key === "name" || field.key === "email" || field.key === "password"}
                />
              </div>
            ))}
            <div>
              <label className={labelCls}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className={inputCls}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && (
              <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={creating}
                className="px-6 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                {creating ? "Creating..." : "Create Agent"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agents Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#1e2130]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0f1117] border-b border-[#1e2130]">
              {["Name", "Email", "Role", "DID", "SIP Username"].map((h) => (
                <th key={h} className="text-left text-[#4a5568] font-semibold text-xs uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center text-[#4a5568] py-8">Loading agents...</td></tr>
            )}
            {!loading && agents.length === 0 && (
              <tr><td colSpan={5} className="text-center text-[#4a5568] py-8">No agents yet.</td></tr>
            )}
            {agents.map((agent) => (
              <tr key={agent.id} onClick={() => openEdit(agent)}
                className="border-b border-[#1e2130] hover:bg-[#111520] cursor-pointer">
                <td className="px-4 py-3 text-white font-medium">{agent.name}</td>
                <td className="px-4 py-3 text-[#8892a4]">{agent.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${agent.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>
                    {agent.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{agent.did || "—"}</td>
                <td className="px-4 py-3 text-[#8892a4] font-mono text-xs">{agent.sip_username || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Agent Modal */}
      {editAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditAgent(null); }}>
          <div className="bg-[#0d1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-lg font-bold">Edit Agent</h2>
              <button onClick={() => setEditAgent(null)} className="text-[#4a5568] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateAgent} className="flex flex-col gap-4">
              {[
                { label: "Full Name",    key: "name",         type: "text",     placeholder: "John Smith" },
                { label: "Email",        key: "email",        type: "email",    placeholder: "john@swiftpathtocapital.com" },
                { label: "DID (Phone #)",key: "did",          type: "text",     placeholder: "+13055551234" },
                { label: "SIP Username", key: "sip_username", type: "text",     placeholder: "john.smith" },
                { label: "SIP Password", key: "sip_password", type: "password", placeholder: "••••••••" },
              ].map((field) => (
                <div key={field.key}>
                  <label className={labelCls}>{field.label}</label>
                  <input
                    type={field.type}
                    value={editForm[field.key]}
                    onChange={(e) => setEditForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={inputCls}
                    required={field.key === "name" || field.key === "email"}
                  />
                </div>
              ))}
              <div>
                <label className={labelCls}>Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} className={inputCls}>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-sm">{editError}</p>
                </div>
              )}
              {resetSent && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                  <p className="text-emerald-400 text-sm">Password reset email sent to {editAgent.email}</p>
                </div>
              )}

              {/* Change password */}
              <div className="border-t border-[#1e2130] pt-4">
                <label className={labelCls}>Change Password</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={pwSaving || !newPassword.trim()}
                    className="px-4 py-2 bg-[#1e2130] border border-[#2d3748] text-[#8892a4] hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {pwSaving ? "Saving..." : "Set"}
                  </button>
                </div>
                {pwSuccess && <p className="text-emerald-400 text-xs mt-1">Password updated — works for CRM and dialer.</p>}
              </div>

              <button type="button" onClick={handleResetPassword}
                className="w-full py-2 bg-[#1e2130] border border-[#2d3748] text-[#8892a4] hover:text-white text-sm rounded-lg transition-colors">
                Send Password Reset Email
              </button>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditAgent(null)}
                  className="px-5 py-2 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors">
                  Cancel
                </button>
              </div>

              <button type="button" onClick={handleDeleteAgent} disabled={deleting}
                className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm rounded-lg transition-colors disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete Agent"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
