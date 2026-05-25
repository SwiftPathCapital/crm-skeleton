import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

function initials(name) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "??";
}

function GroupIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function Messaging({ onUnreadChange }) {
  const { userId, agent } = useApp();
  const isAdmin = agent?.role === "admin";

  const [agents,    setAgents]    = useState([]);
  const [agentMap,  setAgentMap]  = useState({});
  const [groups,    setGroups]    = useState([]);

  // activeConv: null | { type: 'dm', data: agentObj } | { type: 'group', data: groupObj }
  const [activeConv,  setActiveConv]  = useState(null);
  const activeConvRef = useRef(null);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  const [messages,   setMessages]   = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending,    setSending]    = useState(false);

  const [unreadDm,     setUnreadDm]     = useState({});
  const [unreadGroups, setUnreadGroups] = useState(new Set());

  // New-group modal
  const [showNewGroup,    setShowNewGroup]    = useState(false);
  const [newGroupTitle,   setNewGroupTitle]   = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [creatingGroup,   setCreatingGroup]   = useState(false);

  const bottomRef = useRef(null);

  // ── Load agents + groups ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from("agents").select("id, name, role, email").order("name")
      .then(({ data }) => {
        const all = data || [];
        const map = {};
        all.forEach(a => { map[a.id] = a; });
        setAgentMap(map);
        setAgents(all.filter(a => a.id !== userId));
      });
    fetchGroups();
  }, [userId]);

  async function fetchGroups() {
    const { data } = await supabase
      .from("group_chats")
      .select("*, group_chat_members(agent_id)")
      .order("created_at", { ascending: false });
    setGroups(data || []);
  }

  // ── DM unread badges ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from("messages").select("from_agent_id").eq("to_agent_id", userId).eq("read", false)
      .then(({ data }) => {
        const counts = {};
        (data || []).forEach(m => { counts[m.from_agent_id] = (counts[m.from_agent_id] || 0) + 1; });
        setUnreadDm(counts);
      });

    const ch = supabase.channel(`unread-dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `to_agent_id=eq.${userId}` },
        (payload) => {
          const from = payload.new.from_agent_id;
          const conv = activeConvRef.current;
          if (conv?.type === "dm" && conv.data.id === from) return;
          setUnreadDm(prev => ({ ...prev, [from]: (prev[from] || 0) + 1 }));
        }
      ).subscribe();

    return () => supabase.removeChannel(ch);
  }, [userId]);

  // ── Group unread badges ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`unread-groups-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages" },
        (payload) => {
          const { chat_id, from_agent_id } = payload.new;
          if (from_agent_id === userId) return;
          const conv = activeConvRef.current;
          if (conv?.type === "group" && conv.data.id === chat_id) return;
          setUnreadGroups(prev => new Set([...prev, chat_id]));
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  // ── Load messages for active conversation ──────────────────────────────────
  useEffect(() => {
    if (!activeConv || !userId) { setMessages([]); return; }
    setMessages([]);

    let channel;

    if (activeConv.type === "dm") {
      const other = activeConv.data;
      supabase.from("messages").select("*")
        .or(`and(from_agent_id.eq.${userId},to_agent_id.eq.${other.id}),and(from_agent_id.eq.${other.id},to_agent_id.eq.${userId})`)
        .order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));

      supabase.from("messages").update({ read: true })
        .eq("to_agent_id", userId).eq("from_agent_id", other.id).eq("read", false);
      setUnreadDm(prev => ({ ...prev, [other.id]: 0 }));

      channel = supabase.channel(`dm-${[userId, other.id].sort().join("-")}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          const msg = payload.new;
          const ok = (msg.from_agent_id === userId && msg.to_agent_id === other.id) ||
                     (msg.from_agent_id === other.id && msg.to_agent_id === userId);
          if (!ok) return;
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.to_agent_id === userId) {
            supabase.from("messages").update({ read: true }).eq("id", msg.id);
            setUnreadDm(prev => ({ ...prev, [other.id]: 0 }));
          }
        }).subscribe();

    } else {
      const group = activeConv.data;
      supabase.from("group_chat_messages").select("*")
        .eq("chat_id", group.id).order("created_at", { ascending: true })
        .then(({ data }) => setMessages(data || []));
      setUnreadGroups(prev => { const s = new Set(prev); s.delete(group.id); return s; });

      channel = supabase.channel(`group-${group.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `chat_id=eq.${group.id}` },
          (payload) => {
            const msg = payload.new;
            setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          }
        ).subscribe();
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [activeConv, userId]);

  useEffect(() => {
    const dmTotal = Object.values(unreadDm).reduce((s, n) => s + n, 0);
    onUnreadChange?.(dmTotal + unreadGroups.size);
  }, [unreadDm, unreadGroups]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    const body = newMessage.trim();
    setNewMessage("");

    if (activeConv.type === "dm") {
      const { data, error } = await supabase.from("messages")
        .insert({ from_agent_id: userId, to_agent_id: activeConv.data.id, body, read: false })
        .select().single();
      if (!error && data) setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
    } else {
      const { data, error } = await supabase.from("group_chat_messages")
        .insert({ chat_id: activeConv.data.id, from_agent_id: userId, body })
        .select().single();
      if (!error && data) setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
    }
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Create group ───────────────────────────────────────────────────────────
  async function createGroup() {
    if (!newGroupTitle.trim() || newGroupMembers.length === 0) return;
    setCreatingGroup(true);
    const { data: group, error } = await supabase.from("group_chats")
      .insert({ title: newGroupTitle.trim(), created_by: userId })
      .select().single();

    if (!error && group) {
      const memberIds = [...new Set([...newGroupMembers, userId])];
      await supabase.from("group_chat_members")
        .insert(memberIds.map(agent_id => ({ chat_id: group.id, agent_id })));
      await fetchGroups();
      const fullGroup = { ...group, group_chat_members: memberIds.map(id => ({ agent_id: id })) };
      setActiveConv({ type: "group", data: fullGroup });
      setShowNewGroup(false);
      setNewGroupTitle("");
      setNewGroupMembers([]);
    }
    setCreatingGroup(false);
  }

  function toggleMember(id) {
    setNewGroupMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Derived header info ────────────────────────────────────────────────────
  const convHeader = !activeConv ? null
    : activeConv.type === "dm"
    ? { title: activeConv.data.name, sub: activeConv.data.role }
    : {
        title: activeConv.data.title,
        sub: (activeConv.data.group_chat_members || [])
              .map(m => agentMap[m.agent_id]?.name?.split(" ")[0] || "")
              .filter(Boolean).join(", "),
      };

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-[#1e2130]">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
        <div className="px-4 py-4 border-b border-[#1e2130]">
          <h2 className="text-white font-semibold text-sm">Team Messages</h2>
          <p className="text-[#4a5568] text-xs mt-0.5">Chat with your team</p>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Group chats */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <span className="text-[#4a5568] text-[10px] font-bold uppercase tracking-widest">Group Chats</span>
            {isAdmin && (
              <button
                onClick={() => { setShowNewGroup(true); setNewGroupTitle(""); setNewGroupMembers([]); }}
                title="New group"
                className="w-5 h-5 rounded flex items-center justify-center bg-[#1e2130] hover:bg-[#2a3040] text-[#c9a84c] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="text-[#2d3748] text-[11px] text-center px-4 pb-3">
              {isAdmin ? "Click + to create a group" : "No group chats yet"}
            </p>
          ) : (
            groups.map(g => {
              const isSelected = activeConv?.type === "group" && activeConv.data.id === g.id;
              const hasUnread  = unreadGroups.has(g.id) && !isSelected;
              const count      = g.group_chat_members?.length || 0;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveConv({ type: "group", data: g })}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#1e2130] text-left transition-colors ${
                    isSelected ? "bg-[#1e2d4a]" : "hover:bg-[#161b27]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1e2d4a] border border-[#2a3f6a] flex items-center justify-center flex-shrink-0">
                    <GroupIcon className="w-4 h-4 text-[#c9a84c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-[#c9a84c]" : "text-white"}`}>
                      {g.title}
                    </p>
                    <p className="text-[#4a5568] text-xs">{count} member{count !== 1 ? "s" : ""}</p>
                  </div>
                  {hasUnread && (
                    <div className="w-2 h-2 rounded-full bg-[#c9a84c] flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}

          {/* Direct messages */}
          <div className="px-4 pt-3 pb-1.5">
            <span className="text-[#4a5568] text-[10px] font-bold uppercase tracking-widest">Direct Messages</span>
          </div>

          {agents.length === 0 ? (
            <p className="text-[#4a5568] text-xs text-center py-3">No other agents found</p>
          ) : (
            agents.map(a => {
              const unread     = unreadDm[a.id] || 0;
              const isSelected = activeConv?.type === "dm" && activeConv.data.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveConv({ type: "dm", data: a })}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#1e2130] text-left transition-colors ${
                    isSelected ? "bg-[#1e2d4a]" : "hover:bg-[#161b27]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0">
                    {initials(a.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-[#c9a84c]" : "text-white"}`}>
                      {a.name}
                    </p>
                    <p className="text-[#4a5568] text-xs capitalize">{a.role}</p>
                  </div>
                  {unread > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#c9a84c] text-[#080b10] text-xs font-bold flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#080b10] min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#4a5568]">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1e2130] bg-[#0f1117] flex-shrink-0">
              {activeConv.type === "group" ? (
                <div className="w-8 h-8 rounded-full bg-[#1e2d4a] border border-[#2a3f6a] flex items-center justify-center flex-shrink-0">
                  <GroupIcon className="w-4 h-4 text-[#c9a84c]" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0">
                  {initials(activeConv.data.name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">{convHeader?.title}</p>
                <p className="text-[#4a5568] text-xs capitalize truncate">{convHeader?.sub}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#4a5568]">
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe  = msg.from_agent_id === userId;
                  const prev  = messages[i - 1];
                  const showName = activeConv.type === "group" && !isMe &&
                                   prev?.from_agent_id !== msg.from_agent_id;
                  const senderName = agentMap[msg.from_agent_id]?.name || "Unknown";

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showName && (
                        <span className="text-[10px] text-[#4a5568] mb-0.5 ml-1">{senderName}</span>
                      )}
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                        isMe
                          ? "bg-[#c9a84c] text-[#080b10] rounded-br-sm"
                          : "bg-[#1e2130] text-white rounded-bl-sm"
                      }`}>
                        <p>{msg.body}</p>
                        <p className={`text-xs mt-1 ${isMe ? "text-[#080b10]/60" : "text-[#4a5568]"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-[#1e2130] bg-[#0f1117] flex-shrink-0">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeConv.type === "group"
                      ? `Message ${activeConv.data.title}…`
                      : `Message ${activeConv.data.name}…`
                  }
                  rows={1}
                  className="flex-1 bg-[#1e2130] border border-[#2a3040] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-[#c9a84c] transition-colors resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 rounded-xl bg-[#c9a84c] text-[#080b10] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-[#080b10] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[#4a5568] text-xs mt-1.5">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>

      {/* ── New Group Modal ───────────────────────────────────────────────── */}
      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewGroup(false)} />
          <div className="relative bg-[#0d1017] border border-[#1e2130] rounded-2xl shadow-2xl w-96 max-h-[80vh] flex flex-col">

            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2130] flex-shrink-0">
              <h2 className="text-white font-semibold">New Group Chat</h2>
              <button onClick={() => setShowNewGroup(false)} className="text-[#4a5568] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div>
                <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-1.5">
                  Chat Title
                </label>
                <input
                  type="text"
                  value={newGroupTitle}
                  onChange={e => setNewGroupTitle(e.target.value)}
                  placeholder="e.g. Sales Team, Morning Crew…"
                  autoFocus
                  className="w-full bg-[#080b10] border border-[#1e2130] rounded-lg px-3 py-2 text-white text-sm placeholder-[#2d3748] focus:outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-[#4a5568] text-xs font-semibold uppercase tracking-wider block mb-2">
                  Add Members ({newGroupMembers.length} selected)
                </label>
                <div className="space-y-1.5">
                  {agents.map(a => {
                    const checked = newGroupMembers.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleMember(a.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
                          checked
                            ? "bg-[#1e2d4a] border-[#2a3f6a]"
                            : "bg-[#080b10] border-[#1e2130] hover:border-[#2a3040]"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? "bg-[#c9a84c] border-[#c9a84c]" : "border-[#2d3748]"
                        }`}>
                          {checked && (
                            <svg className="w-3 h-3 text-[#080b10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0">
                          {initials(a.name)}
                        </div>
                        <div>
                          <p className="text-white text-sm leading-tight">{a.name}</p>
                          <p className="text-[#4a5568] text-xs capitalize">{a.role}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#1e2130] flex gap-3 flex-shrink-0">
              <button
                onClick={createGroup}
                disabled={!newGroupTitle.trim() || newGroupMembers.length === 0 || creatingGroup}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#e8c96d] text-[#080b10] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {creatingGroup ? "Creating…" : "Create Group"}
              </button>
              <button
                onClick={() => setShowNewGroup(false)}
                className="px-4 py-2.5 bg-[#1e2130] text-[#8892a4] text-sm rounded-lg hover:text-white transition-colors"
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
