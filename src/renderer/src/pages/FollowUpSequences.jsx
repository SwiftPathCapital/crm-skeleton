import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { LEAD_STATUSES } from "../lib/dispositions";

const inputCls  = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors placeholder-[#4a5568]";
const selectCls = "w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 transition-colors";

const EMPTY_SEQ  = { name: "", trigger_status: "Callback" };
const EMPTY_STEP = { day_offset: 1, note_template: "" };

function Label({ children }) {
  return <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">{children}</label>;
}

export default function FollowUpSequences() {
  const { userId } = useApp();

  const [sequences, setSequences] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Sequence create/edit modal
  const [seqModal,  setSeqModal]  = useState(false);
  const [seqForm,   setSeqForm]   = useState(EMPTY_SEQ);
  const [seqSaving, setSeqSaving] = useState(false);

  // Steps editor (for expanded sequence)
  const [expandedId, setExpandedId] = useState(null);
  const [steps,      setSteps]      = useState({}); // { seqId: [step, ...] }
  const [stepForm,   setStepForm]   = useState(EMPTY_STEP);
  const [stepSaving, setStepSaving] = useState(false);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("follow_up_sequences")
      .select("*, follow_up_sequence_steps(*)")
      .order("created_at", { ascending: false });
    if (data) {
      setSequences(data);
      const stepsMap = {};
      data.forEach(s => {
        stepsMap[s.id] = (s.follow_up_sequence_steps || []).sort((a, b) => a.sort_order - b.sort_order || a.day_offset - b.day_offset);
      });
      setSteps(stepsMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  async function saveSequence() {
    if (!seqForm.name.trim()) return;
    setSeqSaving(true);
    await supabase.from("follow_up_sequences").insert({
      name:           seqForm.name.trim(),
      trigger_status: seqForm.trigger_status,
      created_by:     userId,
    });
    setSeqModal(false);
    setSeqForm(EMPTY_SEQ);
    setSeqSaving(false);
    fetchSequences();
  }

  async function deleteSequence(id) {
    if (!window.confirm("Delete this sequence and all its steps?")) return;
    await supabase.from("follow_up_sequences").delete().eq("id", id);
    fetchSequences();
  }

  async function addStep(seqId) {
    setStepSaving(true);
    const existing = steps[seqId] || [];
    await supabase.from("follow_up_sequence_steps").insert({
      sequence_id:   seqId,
      day_offset:    parseInt(stepForm.day_offset) || 1,
      note_template: stepForm.note_template.trim() || null,
      sort_order:    existing.length,
    });
    setStepForm(EMPTY_STEP);
    setStepSaving(false);
    fetchSequences();
  }

  async function deleteStep(stepId, seqId) {
    await supabase.from("follow_up_sequence_steps").delete().eq("id", stepId);
    setSteps(prev => ({ ...prev, [seqId]: (prev[seqId] || []).filter(s => s.id !== stepId) }));
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-Up Sequences</h1>
          <p className="text-[#4a5568] text-sm mt-1">
            Define callback sequences that auto-fire when a lead reaches a trigger status.
          </p>
        </div>
        <button
          onClick={() => { setSeqForm(EMPTY_SEQ); setSeqModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sequence
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-4 mb-6 flex gap-3">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-blue-300 text-sm">
          When a lead's status is saved as the trigger status, the system automatically creates callbacks for each step — spaced by the day offset you configure.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-12 h-12 text-[#1e2130] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <p className="text-[#4a5568] text-sm">No sequences yet.</p>
          <p className="text-[#2d3748] text-xs mt-1">Create one to start automating follow-ups.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map(seq => {
            const seqSteps = steps[seq.id] || [];
            const isExpanded = expandedId === seq.id;
            return (
              <div key={seq.id} className="bg-[#0d1117] border border-[#1e2130] rounded-2xl overflow-hidden">
                {/* Sequence header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : seq.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <svg
                      className={`w-4 h-4 text-[#4a5568] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <p className="text-white font-semibold text-sm">{seq.name}</p>
                      <p className="text-[#4a5568] text-xs mt-0.5">
                        Triggers on: <span className="text-[#c9a84c]">{seq.trigger_status}</span>
                        {" · "}
                        <span className="text-[#8892a4]">{seqSteps.length} step{seqSteps.length !== 1 ? "s" : ""}</span>
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteSequence(seq.id)}
                    className="text-[#4a5568] hover:text-red-400 transition-colors p-1"
                    title="Delete sequence"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Steps (expanded) */}
                {isExpanded && (
                  <div className="border-t border-[#1e2130] px-5 py-4 space-y-3">
                    {seqSteps.length === 0 ? (
                      <p className="text-[#4a5568] text-sm">No steps yet. Add the first step below.</p>
                    ) : (
                      <div className="space-y-2">
                        {seqSteps.map((step, i) => (
                          <div key={step.id} className="flex items-start gap-3 bg-[#0f1117] border border-[#1e2130] rounded-xl px-4 py-3">
                            <div className="w-6 h-6 rounded-full bg-[#1e2130] flex items-center justify-center text-[#8892a4] text-xs font-bold flex-shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium">
                                Day {step.day_offset}
                                <span className="text-[#4a5568] font-normal"> — schedule callback</span>
                              </p>
                              {step.note_template && (
                                <p className="text-[#8892a4] text-xs mt-1 italic">"{step.note_template}"</p>
                              )}
                            </div>
                            <button
                              onClick={() => deleteStep(step.id, seq.id)}
                              className="text-[#4a5568] hover:text-red-400 transition-colors p-1 flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add step form */}
                    <div className="bg-[#080b10] border border-[#1e2130] rounded-xl p-4 space-y-3 mt-2">
                      <p className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider">Add Step</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Day Offset</Label>
                          <input
                            type="number"
                            min={0}
                            value={stepForm.day_offset}
                            onChange={e => setStepForm(f => ({ ...f, day_offset: e.target.value }))}
                            className={inputCls}
                            placeholder="e.g. 3"
                          />
                          <p className="text-[#2d3748] text-[10px] mt-1">Days from status trigger</p>
                        </div>
                        <div>
                          <Label>Callback Note (optional)</Label>
                          <input
                            value={stepForm.note_template}
                            onChange={e => setStepForm(f => ({ ...f, note_template: e.target.value }))}
                            className={inputCls}
                            placeholder="e.g. Check in on application"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => addStep(seq.id)}
                        disabled={stepSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1e2130] hover:bg-[#2a3040] text-[#8892a4] hover:text-white text-sm rounded-lg transition-all disabled:opacity-50"
                      >
                        {stepSaving ? (
                          <div className="w-4 h-4 border-2 border-[#8892a4] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        Add Step
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Sequence Modal */}
      {seqModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-bold text-lg">New Follow-Up Sequence</h2>
            <div>
              <Label>Sequence Name</Label>
              <input
                value={seqForm.name}
                onChange={e => setSeqForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Interested Lead Follow-Up"
              />
            </div>
            <div>
              <Label>Trigger Status</Label>
              <select
                value={seqForm.trigger_status}
                onChange={e => setSeqForm(f => ({ ...f, trigger_status: e.target.value }))}
                className={selectCls}
              >
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-[#4a5568] text-[11px] mt-1.5">Callbacks auto-created when a lead's status is set to this.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSeqModal(false)}
                className="flex-1 py-2 rounded-lg border border-[#1e2130] text-[#8892a4] hover:border-[#2d3748] text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSequence}
                disabled={!seqForm.name.trim() || seqSaving}
                className="flex-1 py-2 rounded-lg bg-[#c9a84c] hover:bg-[#b8963e] text-black font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {seqSaving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
