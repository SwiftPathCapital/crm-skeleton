import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

export default function AnnouncementsBanner() {
  const { agent, userId } = useApp();
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [posting, setPosting] = useState(false);

  const isAdmin = agent?.role === "admin";

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (payload) => {
        setAnnouncements((prev) => [payload.new, ...prev].slice(0, 3));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
    setAnnouncements(data || []);
  }

  async function postAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      posted_by: userId,
    });
    if (!error) {
      setForm({ title: "", body: "" });
      setShowForm(false);
      fetchAnnouncements();
    }
    setPosting(false);
  }

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0 && !isAdmin) return null;

  return (
    <div className="mb-6">
      {visible.length > 0 && (
        <div className="space-y-2 mb-3">
          {visible.map((ann) => (
            <div
              key={ann.id}
              className="flex items-start gap-3 bg-[#1a1f2e] border border-[#c9a84c]/30 rounded-xl px-4 py-3"
            >
              <div className="w-7 h-7 rounded-lg bg-[#c9a84c]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#c9a84c] text-xs font-bold uppercase tracking-wider">Announcement</span>
                  <span className="text-[#4a5568] text-xs">
                    {new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <p className="text-white text-sm font-semibold">{ann.title}</p>
                <p className="text-[#8892a4] text-xs mt-0.5">{ann.body}</p>
              </div>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, ann.id]))}
                className="text-[#4a5568] hover:text-white transition-colors flex-shrink-0 mt-0.5"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        showForm ? (
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">New Announcement</p>
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] transition-colors"
            />
            <textarea
              placeholder="Message…"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={2}
              className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={postAnnouncement}
                disabled={!form.title.trim() || !form.body.trim() || posting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#c9a84c] text-[#080b10] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {posting ? "Posting…" : "Post"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm({ title: "", body: "" }); }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#8892a4] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-xs text-[#c9a84c] hover:text-[#e8c96d] transition-colors border border-[#c9a84c]/30 hover:border-[#c9a84c]/60 rounded-lg px-3 py-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Post Announcement
          </button>
        )
      )}
    </div>
  );
}
