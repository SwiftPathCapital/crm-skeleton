import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

function initials(name) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";
}

export default function Messaging() {
  const { userId, agent } = useApp();
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("agents")
      .select("id, full_name, role, email")
      .neq("id", userId)
      .order("full_name")
      .then(({ data }) => setAgents(data || []));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("messages")
      .select("from_agent_id")
      .eq("to_agent_id", userId)
      .eq("read", false)
      .then(({ data }) => {
        const counts = {};
        (data || []).forEach((m) => {
          counts[m.from_agent_id] = (counts[m.from_agent_id] || 0) + 1;
        });
        setUnreadCounts(counts);
      });

    const channel = supabase
      .channel(`unread-badge-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `to_agent_id=eq.${userId}` },
        (payload) => {
          const from = payload.new.from_agent_id;
          setUnreadCounts((prev) => ({
            ...prev,
            [from]: (prev[from] || 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  useEffect(() => {
    if (!selectedAgent || !userId) return;
    setMessages([]);

    supabase
      .from("messages")
      .select("*")
      .or(
        `and(from_agent_id.eq.${userId},to_agent_id.eq.${selectedAgent.id}),and(from_agent_id.eq.${selectedAgent.id},to_agent_id.eq.${userId})`
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data || []));

    supabase
      .from("messages")
      .update({ read: true })
      .eq("to_agent_id", userId)
      .eq("from_agent_id", selectedAgent.id)
      .eq("read", false);

    setUnreadCounts((prev) => ({ ...prev, [selectedAgent.id]: 0 }));

    const channel = supabase
      .channel(`chat-${[userId, selectedAgent.id].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        const relevant =
          (msg.from_agent_id === userId && msg.to_agent_id === selectedAgent.id) ||
          (msg.from_agent_id === selectedAgent.id && msg.to_agent_id === userId);
        if (!relevant) return;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.to_agent_id === userId) {
          supabase.from("messages").update({ read: true }).eq("id", msg.id);
          setUnreadCounts((prev) => ({ ...prev, [selectedAgent.id]: 0 }));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedAgent, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !selectedAgent || sending) return;
    setSending(true);
    const body = newMessage.trim();
    setNewMessage("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ from_agent_id: userId, to_agent_id: selectedAgent.id, body, read: false })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden rounded-xl border border-[#1e2130]">
      {/* Agent list sidebar */}
      <div className="w-64 flex-shrink-0 bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
        <div className="px-4 py-4 border-b border-[#1e2130]">
          <h2 className="text-white font-semibold text-sm">Team Messages</h2>
          <p className="text-[#4a5568] text-xs mt-0.5">Chat with your team</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 ? (
            <p className="text-[#4a5568] text-xs text-center py-8">No other agents found</p>
          ) : (
            agents.map((a) => {
              const unread = unreadCounts[a.id] || 0;
              const isSelected = selectedAgent?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#1e2130] text-left transition-colors ${
                    isSelected ? "bg-[#1e2d4a]" : "hover:bg-[#161b27]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold flex-shrink-0">
                    {initials(a.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-[#c9a84c]" : "text-white"}`}>
                      {a.full_name}
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

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#080b10]">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#4a5568]">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm">Select a team member to start chatting</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1e2130] bg-[#0f1117]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e8c96d] flex items-center justify-center text-[#080b10] text-xs font-bold">
                {initials(selectedAgent.full_name)}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{selectedAgent.full_name}</p>
                <p className="text-[#4a5568] text-xs capitalize">{selectedAgent.role}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#4a5568]">
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.from_agent_id === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                          isMe
                            ? "bg-[#c9a84c] text-[#080b10] rounded-br-sm"
                            : "bg-[#1e2130] text-white rounded-bl-sm"
                        }`}
                      >
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

            <div className="px-5 py-4 border-t border-[#1e2130] bg-[#0f1117]">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedAgent.full_name}…`}
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
    </div>
  );
}
