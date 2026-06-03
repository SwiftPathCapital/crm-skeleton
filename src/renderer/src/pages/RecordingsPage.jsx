import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";

const API_BASE = window.location?.protocol === "file:" ? "http://localhost:3001" : "";

function fmtDuration(ms) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={copy} title="Copy" style={{ marginLeft: 6, padding: "1px 6px", fontSize: 10, borderRadius: 4, border: "1px solid #2a3040", background: "#1e2130", color: copied ? "#c9a84c" : "#5a6580", cursor: "pointer", fontFamily: "monospace" }}>
      {copied ? "✓" : "copy"}
    </button>
  );
}

function SourceBadge({ source }) {
  const isConf = (source || "").toLowerCase() === "conference";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em", textTransform: "uppercase", background: isConf ? "rgba(91,156,246,0.12)" : "rgba(64,196,160,0.12)", color: isConf ? "#5b9cf6" : "#40c4a0", border: `1px solid ${isConf ? "#5b9cf644" : "#40c4a044"}` }}>
      {source || "—"}
    </span>
  );
}

function ChannelBadge({ channels }) {
  const isDual = (channels || "").toLowerCase() === "dual";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em", textTransform: "uppercase", background: isDual ? "rgba(167,139,250,0.12)" : "rgba(240,160,96,0.1)", color: isDual ? "#a78bfa" : "#f0a060", border: `1px solid ${isDual ? "#a78bfa44" : "#f0a06044"}` }}>
      {channels || "—"}
    </span>
  );
}

function RecordingRow({ rec, playing, onPlay, onStop }) {
  const progress = 0;

  return (
    <div style={{ background: "#0f1117", border: "1px solid #1e2130", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* Play button */}
        <button
          onClick={playing ? onStop : onPlay}
          disabled={!rec.download_url}
          style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, border: "none", background: rec.download_url ? (playing ? "#c9a84c" : "#1e2d4a") : "#1e2130", color: rec.download_url ? (playing ? "#080b10" : "#c9a84c") : "#3a4050", cursor: rec.download_url ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "all 0.15s" }}
          title={rec.download_url ? (playing ? "Pause" : "Play") : "No audio available"}
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Date */}
        <div style={{ minWidth: 170 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0ee" }}>{fmtDate(rec.recording_started_at)}</div>
          <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>Started</div>
        </div>

        {/* Duration */}
        <div style={{ minWidth: 70 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0ee", fontFamily: "monospace" }}>{fmtDuration(rec.duration_millis)}</div>
          <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>Duration</div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SourceBadge source={rec.source} />
          <ChannelBadge channels={rec.channels} />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Download */}
        {rec.download_url && (
          <a
            href={rec.download_url}
            download
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "1px solid #2a3f6a", background: "#1e2d4a", color: "#c9a84c", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            ↓ MP3
          </a>
        )}
        {rec.download_url_wav && (
          <a
            href={rec.download_url_wav}
            download
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "1px solid #2a3040", background: "#1e2130", color: "#8892a4", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            ↓ WAV
          </a>
        )}
      </div>

      {/* Playing bar */}
      {playing && (
        <div style={{ height: 3, borderRadius: 2, background: "#1e2130", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #c9a84c, #e8c96d)", borderRadius: 2, animation: "recordingPlay 0.8s ease-in-out infinite alternate" }} />
        </div>
      )}

      {/* Detail IDs */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {rec.call_session_id && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Session ID</div>
            <div style={{ fontSize: 12, color: "#8892a4", fontFamily: "monospace" }}>
              {rec.call_session_id.slice(0, 20)}…
              <CopyBtn text={rec.call_session_id} />
            </div>
          </div>
        )}
        {rec.call_leg_id && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Leg ID</div>
            <div style={{ fontSize: 12, color: "#8892a4", fontFamily: "monospace" }}>
              {rec.call_leg_id.slice(0, 20)}…
              <CopyBtn text={rec.call_leg_id} />
            </div>
          </div>
        )}
        {rec.connection_id && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Connection ID</div>
            <div style={{ fontSize: 12, color: "#8892a4", fontFamily: "monospace" }}>
              {rec.connection_id}
              <CopyBtn text={rec.connection_id} />
            </div>
          </div>
        )}
        {rec.conference_id && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Conference ID</div>
            <div style={{ fontSize: 12, color: "#8892a4", fontFamily: "monospace" }}>
              {rec.conference_id}
              <CopyBtn text={rec.conference_id} />
            </div>
          </div>
        )}
        {rec.recording_ended_at && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Ended</div>
            <div style={{ fontSize: 12, color: "#8892a4" }}>{fmtDate(rec.recording_ended_at)}</div>
          </div>
        )}
        {rec.id && (
          <div>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recording ID</div>
            <div style={{ fontSize: 12, color: "#8892a4", fontFamily: "monospace" }}>
              {rec.id.slice(0, 20)}…
              <CopyBtn text={rec.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecordingsPage() {
  const { getAuthToken } = useApp();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [sortDir, setSortDir]       = useState("desc");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [playingId, setPlayingId]   = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const r = await fetch(`${API_BASE}/api/recordings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        if (d.error) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error));
        setRecordings(d.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Clean up audio on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handlePlay = useCallback((rec) => {
    if (!rec.download_url) return;
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    const audio = new Audio(rec.download_url);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(rec.id);
  }, [playingId]);

  const handleStop = useCallback(() => {
    audioRef.current?.pause();
    setPlayingId(null);
  }, []);

  const sources = ["all", ...new Set(recordings.map(r => r.source).filter(Boolean))];

  const filtered = recordings
    .filter(r => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.call_session_id || "").toLowerCase().includes(q) ||
        (r.call_leg_id     || "").toLowerCase().includes(q) ||
        (r.connection_id   || "").toLowerCase().includes(q) ||
        (r.id              || "").toLowerCase().includes(q) ||
        (r.source          || "").toLowerCase().includes(q) ||
        (r.channels        || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const da = new Date(a.recording_started_at || a.created_at || 0);
      const db = new Date(b.recording_started_at || b.created_at || 0);
      return sortDir === "desc" ? db - da : da - db;
    });

  const totalDuration = recordings.reduce((sum, r) => sum + (r.duration_millis || 0), 0);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: "2px solid #c9a84c", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: "#4a5568", fontSize: 14 }}>Fetching all recordings from Telnyx…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "rgba(240,96,96,0.08)", border: "1px solid rgba(240,96,96,0.3)", borderRadius: 10, padding: 24, color: "#f06060", fontSize: 14 }}>
        <strong>Failed to load recordings</strong><br />
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#9a9d9e", marginTop: 8, display: "block" }}>{error}</span>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes recordingPlay { from { opacity: 0.5 } to { opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0ee", marginBottom: 4 }}>Call Recordings</h1>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#4a5568" }}>{recordings.length} total recordings</span>
          <span style={{ fontSize: 13, color: "#4a5568" }}>Total duration: {fmtDuration(totalDuration)}</span>
          {filtered.length !== recordings.length && (
            <span style={{ fontSize: 13, color: "#c9a84c" }}>{filtered.length} shown</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by session ID, leg ID, source…"
          style={{ flex: "1 1 260px", minWidth: 220, background: "#0f1117", border: "1px solid #1e2130", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#f0f0ee", outline: "none", fontFamily: "monospace" }}
          onFocus={e => e.target.style.borderColor = "#c9a84c"}
          onBlur={e => e.target.style.borderColor = "#1e2130"}
        />

        {/* Source filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {sources.map(s => (
            <button key={s} onClick={() => setSourceFilter(s)} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: `1px solid ${sourceFilter === s ? "#c9a84c" : "#1e2130"}`, background: sourceFilter === s ? "rgba(201,168,76,0.1)" : "#0f1117", color: sourceFilter === s ? "#c9a84c" : "#5a6580", cursor: "pointer", textTransform: "capitalize" }}>
              {s === "all" ? "All Sources" : s}
            </button>
          ))}
        </div>

        {/* Sort */}
        <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: "1px solid #1e2130", background: "#0f1117", color: "#8892a4", cursor: "pointer" }}>
          {sortDir === "desc" ? "↓ Newest First" : "↑ Oldest First"}
        </button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(rec => (
          <RecordingRow
            key={rec.id}
            rec={rec}
            playing={playingId === rec.id}
            onPlay={() => handlePlay(rec)}
            onStop={handleStop}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#4a5568", fontSize: 14 }}>
            No recordings match your search.
          </div>
        )}
      </div>
    </div>
  );
}
