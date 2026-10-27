import React, { useState, useEffect } from "react";
import {
  Users,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  RefreshCw,
  Headphones,
  ShieldCheck,
  Search,
  X,
  Volume2,
  Palette,
  RotateCcw
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { loadCallPanelPrefs } from "../AgentPanel";
import {
  DEFAULT_STATUS_COLORS,
  COLOR_SWATCHES,
  hexToRgba,
  normalizeWallboardLayout
} from "../../dashboard/WallboardPanel";

/**
 * CallPanelAgentsAppearanceSettings:
 * Rendered inside Profile Settings -> "Çağrı Paneli" tab so users can customize
 * agent card density (Kompakt / Standart / Detaylı), sort order, and status/break box colors.
 */
export function CallPanelAgentsAppearanceSettings({
  backendHost = "localhost:8000",
  currentUserId = "admin"
}) {
  const { bg, text, lightBg, borderLight } = useTheme();
  const [agentCardDensity, setAgentCardDensity] = useState("standard");
  const [agentSortBy, setAgentSortBy] = useState("status");
  const [statusColors, setStatusColors] = useState({ ...DEFAULT_STATUS_COLORS, breakColors: {} });
  const [systemBreaks, setSystemBreaks] = useState([]);

  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : "";
  const effectiveUid = String(
    currentUserId || (typeof window !== "undefined" ? localStorage.getItem("current_user_id") : null) || "admin"
  );

  useEffect(() => {
    try {
      const localRaw = typeof window !== "undefined" ? localStorage.getItem(`wallboard_layout_${effectiveUid}`) : null;
      if (localRaw) {
        const norm = normalizeWallboardLayout(JSON.parse(localRaw));
        setAgentCardDensity(norm.agentCardDensity || "standard");
        setAgentSortBy(norm.agentSortBy || "status");
        setStatusColors(norm.statusColors);
      }
    } catch (e) {}

    fetch(`${API_BASE}/api/settings/breaks`)
      .then((res) => (res.ok ? res.json() : []))
      .then((bData) => {
        const list = Array.isArray(bData) ? bData : bData?.breaks || [];
        setSystemBreaks(list);
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/wallboard/layout?user_id=${encodeURIComponent(effectiveUid)}`, {
      headers: { "X-User-ID": effectiveUid }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.layout) {
          const norm = normalizeWallboardLayout(resData.layout);
          setAgentCardDensity(norm.agentCardDensity || "standard");
          setAgentSortBy(norm.agentSortBy || "status");
          setStatusColors(norm.statusColors);
          if (typeof window !== "undefined") {
            localStorage.setItem(`wallboard_layout_${effectiveUid}`, JSON.stringify(norm));
          }
        }
      })
      .catch(() => {});
  }, [effectiveUid, API_BASE]);

  const syncAppearance = (patch = {}) => {
    let existing = {};
    try {
      const localRaw = typeof window !== "undefined" ? localStorage.getItem(`wallboard_layout_${effectiveUid}`) : null;
      if (localRaw) existing = JSON.parse(localRaw) || {};
    } catch (e) {}

    const payload = {
      ...existing,
      agentCardDensity: patch.agentCardDensity ?? agentCardDensity,
      agentSortBy: patch.agentSortBy ?? agentSortBy,
      statusColors: patch.statusColors ?? statusColors
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`wallboard_layout_${effectiveUid}`, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("wallboard-layout-updated", { detail: payload }));
    }

    fetch(`${API_BASE}/api/wallboard/layout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": effectiveUid
      },
      body: JSON.stringify({
        user_id: effectiveUid,
        layout: payload
      })
    }).catch(() => {});
  };

  return (
    <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette size={15} className={text} />
          <div>
            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
              Temsilciler Sekmesi Kutucuk Yapısı &amp; Durum Renkleri
            </h5>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Canlı İzleme Paneli ile uyumlu temsilci kutucuk boyutunu, sıralamayı ve durum/mola renklerini özelleştirin.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const resetColors = { ...DEFAULT_STATUS_COLORS, breakColors: {} };
            setAgentCardDensity("standard");
            setAgentSortBy("status");
            setStatusColors(resetColors);
            syncAppearance({
              agentCardDensity: "standard",
              agentSortBy: "status",
              statusColors: resetColors
            });
          }}
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 shrink-0"
        >
          <RotateCcw size={11} />
          <span>Varsayılan Renk &amp; Boyut</span>
        </button>
      </div>

      {/* Kart Boyutu & Sıralama */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500">
            Temsilci Kutucuk Boyutu / Detay Seviyesi
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "compact", label: "Kompakt (Mini)" },
              { id: "standard", label: "Standart" },
              { id: "detailed", label: "Detaylı (+Sayaç)" }
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setAgentCardDensity(d.id);
                  syncAppearance({ agentCardDensity: d.id });
                }}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-extrabold border transition-all ${
                  agentCardDensity === d.id
                    ? `${bg} text-white border-transparent shadow-sm`
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500">
            Temsilci Sıralama Ölçütü
          </label>
          <select
            value={agentSortBy}
            onChange={(e) => {
              setAgentSortBy(e.target.value);
              syncAppearance({ agentSortBy: e.target.value });
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="status">Duruma Göre (Görüşmede &gt; Müsait &gt; Molada)</option>
            <option value="calls_desc">Bugün En Çok Çağrı Alan</option>
            <option value="name">İsme Göre (A-Z)</option>
            <option value="extension">Dahili Numarasına Göre</option>
          </select>
        </div>
      </div>

      {/* Durum Kutucuğu Renkleri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
        {[
          {
            key: "available",
            title: "Login / Müsait",
            subtitle: "Çağrı Bekleyen",
            badge: "MÜSAİT",
            defaultHex: DEFAULT_STATUS_COLORS.available
          },
          {
            key: "busy",
            title: "Meşgul / Çağrıda",
            subtitle: "Aktif Görüşmede",
            badge: "MEŞGUL",
            defaultHex: DEFAULT_STATUS_COLORS.busy
          },
          {
            key: "break",
            title: "Molada (Genel)",
            subtitle: "Varsayılan Mola",
            badge: "MOLADA",
            defaultHex: DEFAULT_STATUS_COLORS.break
          },
          {
            key: "autoBreak",
            title: "Otomatik Mola",
            subtitle: "Çağrı Kaçırma / Kopma",
            badge: "OTO MOLA",
            defaultHex: DEFAULT_STATUS_COLORS.autoBreak
          }
        ].map((item) => {
          const currentHex = statusColors?.[item.key] || item.defaultHex;
          return (
            <div
              key={item.key}
              style={{
                backgroundColor: hexToRgba(currentHex, 0.10),
                borderColor: hexToRgba(currentHex, 0.55)
              }}
              className="p-3 rounded-2xl border space-y-2.5 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    style={{ backgroundColor: currentHex }}
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                  />
                  <div className="truncate">
                    <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">{item.title}</p>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: hexToRgba(currentHex, 0.18),
                    borderColor: hexToRgba(currentHex, 0.5),
                    color: currentHex
                  }}
                  className="px-1.5 py-0.5 rounded-lg border text-[8px] font-extrabold uppercase shrink-0"
                >
                  {item.badge}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                <div className="flex flex-wrap items-center gap-1">
                  {COLOR_SWATCHES.slice(0, 6).map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      onClick={() => {
                        const next = { ...statusColors, [item.key]: sw.hex };
                        setStatusColors(next);
                        syncAppearance({ statusColors: next });
                      }}
                      style={{ backgroundColor: sw.hex }}
                      className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                        currentHex.toLowerCase() === sw.hex.toLowerCase()
                          ? "scale-125 ring-2 ring-slate-800 dark:ring-white border-white"
                          : "border-black/10 hover:scale-110"
                      }`}
                    />
                  ))}
                </div>

                <label
                  title="Özel Renk Seç"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                >
                  <input
                    type="color"
                    value={currentHex}
                    onChange={(e) => {
                      const next = { ...statusColors, [item.key]: e.target.value };
                      setStatusColors(next);
                      syncAppearance({ statusColors: next });
                    }}
                    className="w-3.5 h-3.5 rounded border-0 p-0 bg-transparent cursor-pointer"
                  />
                  <span className="text-[8px] font-mono font-bold text-slate-600 dark:text-slate-300 uppercase">
                    {currentHex}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mola Türlerine Özel Renkler */}
      {systemBreaks.length > 0 && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
          <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
            Mola Türlerine Özel Renkler
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {systemBreaks.map((b) => {
              const bIdStr = String(b.id ?? "");
              const bNameStr = String(b.name || "").trim();
              const bcMap = statusColors?.breakColors || {};
              const customHex = (bIdStr && bcMap[bIdStr]) || (bNameStr && bcMap[bNameStr]) || "";
              const effectiveHex = customHex || statusColors?.break || DEFAULT_STATUS_COLORS.break;

              const handleSetBreakColor = (newHex) => {
                const nextBreakColors = { ...(statusColors?.breakColors || {}) };
                if (bIdStr) nextBreakColors[bIdStr] = newHex;
                if (bNameStr) nextBreakColors[bNameStr] = newHex;
                const next = { ...statusColors, breakColors: nextBreakColors };
                setStatusColors(next);
                syncAppearance({ statusColors: next });
              };

              return (
                <div
                  key={b.id || b.name}
                  style={{
                    backgroundColor: hexToRgba(effectiveHex, 0.08),
                    borderColor: hexToRgba(effectiveHex, 0.45)
                  }}
                  className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      style={{ backgroundColor: effectiveHex }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                      {b.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {COLOR_SWATCHES.slice(0, 5).map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.label}
                        onClick={() => handleSetBreakColor(sw.hex)}
                        style={{ backgroundColor: sw.hex }}
                        className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                          effectiveHex.toLowerCase() === sw.hex.toLowerCase()
                            ? "scale-125 ring-2 ring-slate-800 dark:ring-white border-white"
                            : "border-black/10 hover:scale-110"
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      value={effectiveHex}
                      onChange={(e) => handleSetBreakColor(e.target.value)}
                      className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentQueuePeersTab({ backendHost, currentUser, callPanelPerms, panelPrefs }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const canSeeStatus = callPanelPerms ? callPanelPerms.agentsCanSeeStatus !== false : true;
  const canSeeDuration = callPanelPerms ? callPanelPerms.agentsCanSeeDuration !== false : true;
  const canSeeCallCounts = callPanelPerms ? callPanelPerms.agentsCanSeeCallCounts !== false : true;
  const canSeeLoginLogout = callPanelPerms ? callPanelPerms.agentsCanSeeLoginLogout !== false : true;

  const [data, setData] = useState({ queues: [], agents: [] });
  const [loading, setLoading] = useState(true);
  const [selectedQueueId, setSelectedQueueId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localPrefs, setLocalPrefs] = useState(() => panelPrefs || loadCallPanelPrefs(currentUser));
  const [statusColors, setStatusColors] = useState(() => ({ ...DEFAULT_STATUS_COLORS, breakColors: {} }));
  const [agentCardDensity, setAgentCardDensity] = useState("standard");
  const [agentSortBy, setAgentSortBy] = useState("status");

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
  const API_BASE = `${typeof window !== "undefined" ? window.location.protocol : "http:"}//${host}`;

  const myUserId = currentUser?.id ? String(currentUser.id) : "";
  const myExtension = currentUser?.extension ? String(currentUser.extension) : "";
  const effectiveUid = String(
    myUserId || (typeof window !== "undefined" ? localStorage.getItem("current_user_id") : null) || "admin"
  );

  useEffect(() => {
    if (panelPrefs) {
      setLocalPrefs(panelPrefs);
    } else {
      setLocalPrefs(loadCallPanelPrefs(currentUser));
    }
  }, [panelPrefs, currentUser]);

  // Load Wallboard layout & status colors so agent cards use the exact same box density, sort & colors
  useEffect(() => {
    try {
      const localRaw = typeof window !== "undefined" ? localStorage.getItem(`wallboard_layout_${effectiveUid}`) : null;
      if (localRaw) {
        const norm = normalizeWallboardLayout(JSON.parse(localRaw));
        setStatusColors(norm.statusColors);
        setAgentCardDensity(norm.agentCardDensity || "standard");
        setAgentSortBy(norm.agentSortBy || "status");
      }
    } catch (e) {}

    fetch(`${API_BASE}/api/wallboard/layout?user_id=${encodeURIComponent(effectiveUid)}`, {
      headers: { "X-User-ID": effectiveUid }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.layout) {
          const norm = normalizeWallboardLayout(resData.layout);
          setStatusColors(norm.statusColors);
          setAgentCardDensity(norm.agentCardDensity || "standard");
          setAgentSortBy(norm.agentSortBy || "status");
        }
      })
      .catch(() => {});

    const handleLayoutUpdated = (e) => {
      if (e?.detail) {
        const norm = normalizeWallboardLayout(e.detail);
        setStatusColors(norm.statusColors);
        setAgentCardDensity(norm.agentCardDensity || "standard");
        setAgentSortBy(norm.agentSortBy || "status");
      }
    };
    window.addEventListener("wallboard-layout-updated", handleLayoutUpdated);
    return () => window.removeEventListener("wallboard-layout-updated", handleLayoutUpdated);
  }, [effectiveUid, API_BASE]);

  const viewMode = localPrefs?.viewMode === "box" ? "box" : "list";
  // Support both Wallboard density ("compact" | "standard" | "detailed") and CallPanel boxSize ("small" | "large")
  const effectiveDensity =
    localPrefs?.boxSize === "small" && agentCardDensity === "standard"
      ? "compact"
      : agentCardDensity || "standard";

  const fetchQueuePeers = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (myUserId) params.set("user_id", myUserId);
      if (myExtension) params.set("extension", myExtension);
      const res = await fetch(`${API_BASE}/api/agent/queue-peers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData({
          queues: Array.isArray(json.queues) ? json.queues : [],
          agents: Array.isArray(json.agents) ? json.agents : []
        });
      }
    } catch (err) {
      console.error("[AgentQueuePeersTab] Error fetching queue peers:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueuePeers(true);
    const pollInterval = setInterval(() => fetchQueuePeers(false), 3000);
    return () => clearInterval(pollInterval);
  }, [myUserId, myExtension, host]);

  useEffect(() => {
    const tickInterval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const getLiveDurationSeconds = (agent) => {
    if (agent.status_since_utc) {
      const parsed = Date.parse(agent.status_since_utc);
      if (!Number.isNaN(parsed)) {
        return Math.max(0, Math.floor((nowMs - parsed) / 1000));
      }
    }
    return Number(agent.status_duration_seconds || 0);
  };

  const formatSeconds = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatDurationText = (totalSec) => {
    const sec = Math.max(0, Math.floor(Number(totalSec || 0)));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remSec = sec % 60;
    if (hrs > 0) {
      return `${hrs} sa ${mins} dk ${remSec} sn`;
    }
    if (mins > 0) {
      return `${mins} dk ${remSec} sn`;
    }
    return `${remSec} sn`;
  };

  const formatClockDuration = (totalSec) => {
    const sec = Math.max(0, Math.floor(Number(totalSec || 0)));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remSec = sec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(remSec).padStart(2, "0")}`;
  };

  const handleCallAgent = (ext) => {
    if (!ext) return;
    window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: String(ext) }));
  };

  // Strictly show only logged-in agents (matching Canlı İzleme Paneli)
  const loggedInAgents = data.agents.filter(
    (agent) => agent.status !== "offline" && agent.is_logged_in !== false
  );

  const statusPriority = {
    busy: 1,
    available: 2,
    acw: 3,
    break: 4
  };

  const filteredAgents = loggedInAgents
    .filter((agent) => {
      if (selectedQueueId !== "all") {
        const inQueue = Array.isArray(agent.queues) && agent.queues.some((q) => String(q.id) === String(selectedQueueId));
        if (!inQueue) return false;
      }
      if (statusFilter !== "all" && agent.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (agent.name || "").toLowerCase().includes(q);
        const extMatch = String(agent.extension || "").toLowerCase().includes(q);
        const queueMatch = Array.isArray(agent.queues) && agent.queues.some((qu) => (qu.name || "").toLowerCase().includes(q));
        return nameMatch || extMatch || queueMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (agentSortBy === "calls_desc") {
        return (Number(b.total_calls) || 0) - (Number(a.total_calls) || 0);
      }
      if (agentSortBy === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "tr");
      }
      if (agentSortBy === "extension") {
        return String(a.extension || "").localeCompare(String(b.extension || ""), undefined, { numeric: true });
      }
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return String(a.name || "").localeCompare(String(b.name || ""), "tr");
    });

  const counts = {
    all: loggedInAgents.length,
    available: loggedInAgents.filter((a) => a.status === "available").length,
    busy: loggedInAgents.filter((a) => a.status === "busy").length,
    break: loggedInAgents.filter((a) => a.status === "break").length
  };

  const availHex = statusColors?.available || DEFAULT_STATUS_COLORS.available;
  const busyHex = statusColors?.busy || DEFAULT_STATUS_COLORS.busy;
  const breakHex = statusColors?.break || DEFAULT_STATUS_COLORS.break;

  const getStatusMeta = (agent, liveSec) => {
    const durText = formatDurationText(liveSec);
    const colors = statusColors || DEFAULT_STATUS_COLORS;

    if (agent.status === "busy") {
      const hex = colors.busy || DEFAULT_STATUS_COLORS.busy;
      return {
        hex,
        badgeLabel: "Görüşmede",
        title: agent.active_call_with ? `Meşgul (${agent.active_call_with})` : "Meşgul (Çağrıda)",
        detailsText: `${agent.active_call_with || "Aktif Çağrı"} (${formatSeconds(liveSec)})`,
        durationPhrase: `${durText} süredir meşgul`
      };
    }

    if (agent.status === "acw") {
      return {
        hex: "#8b5cf6",
        badgeLabel: "ACW / İşlemde",
        title: "ACW / İşlemde",
        detailsText: `Çağrı Sonrası İşlem (${formatSeconds(liveSec)})`,
        durationPhrase: `${durText} süredir işlemde`
      };
    }

    if (agent.status === "break") {
      const bReason = agent.break_reason || agent.break_name || "Mola";
      const isAuto =
        Boolean(agent.is_auto_break) ||
        String(bReason).toLowerCase().startsWith("otomatik mola") ||
        String(bReason).toLowerCase().includes("çağrı kaçırma") ||
        String(bReason).toLowerCase().includes("bağlantı koptu");

      if (isAuto) {
        return {
          hex: colors.autoBreak || DEFAULT_STATUS_COLORS.autoBreak,
          badgeLabel: "Otomatik Mola",
          title: bReason || "Otomatik Mola",
          detailsText: `${bReason || "Otomatik Mola"} (${formatSeconds(liveSec)})`,
          durationPhrase: `${durText} süredir otomatik molada`
        };
      }

      const bcMap = colors.breakColors || {};
      const bIdKey = agent.break_id != null ? String(agent.break_id) : "";
      const bNameKey = bReason ? String(bReason).trim() : "";
      const resolvedBreakHex =
        (bIdKey && bcMap[bIdKey]) ||
        (bNameKey && bcMap[bNameKey]) ||
        agent.break_color ||
        colors.break ||
        DEFAULT_STATUS_COLORS.break;

      return {
        hex: resolvedBreakHex,
        badgeLabel: "Molada",
        title: bReason ? `Molada (${bReason})` : "Molada",
        detailsText: `${bReason} (${formatSeconds(liveSec)})`,
        durationPhrase: `${durText} süredir molada`
      };
    }

    return {
      hex: colors.available || DEFAULT_STATUS_COLORS.available,
      badgeLabel: "Müsait",
      title: "Müsait",
      detailsText: `Dahili: ${agent.extension} (${formatSeconds(liveSec)})`,
      durationPhrase: `${durText} süredir müsait`
    };
  };

  const gridColsClass =
    effectiveDensity === "compact"
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
      : effectiveDensity === "detailed"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Wallboard-style KPI Counter Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Aktif (Login) Temsilci */}
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm space-y-2 relative overflow-hidden text-left transition-all ${
              statusFilter === "all"
                ? `${border} ring-2 ring-primary/20`
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                AKTİF TEMSİLCİ
              </span>
              <div className={`p-2 rounded-xl shrink-0 ${lightBg} ${text}`}>
                <Users size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono">
                {counts.all}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Login</span>
            </div>
            <span className={`absolute bottom-0 inset-x-0 h-1 ${bg}`} />
          </button>

          {/* Card 2: Müsait */}
          <button
            type="button"
            onClick={() => setStatusFilter("available")}
            style={
              statusFilter === "available"
                ? { borderColor: availHex, boxShadow: `0 0 0 2px ${hexToRgba(availHex, 0.2)}` }
                : undefined
            }
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden text-left transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                MÜSAİT
              </span>
              <div
                style={{
                  backgroundColor: hexToRgba(availHex, 0.14),
                  color: availHex
                }}
                className="p-2 rounded-xl shrink-0"
              >
                <ShieldCheck size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono">
                {counts.available}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Temsilci</span>
            </div>
            <span style={{ backgroundColor: availHex }} className="absolute bottom-0 inset-x-0 h-1" />
          </button>

          {/* Card 3: Meşgul */}
          <button
            type="button"
            onClick={() => setStatusFilter("busy")}
            style={
              statusFilter === "busy"
                ? { borderColor: busyHex, boxShadow: `0 0 0 2px ${hexToRgba(busyHex, 0.2)}` }
                : undefined
            }
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden text-left transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                MEŞGUL
              </span>
              <div
                style={{
                  backgroundColor: hexToRgba(busyHex, 0.14),
                  color: busyHex
                }}
                className="p-2 rounded-xl shrink-0"
              >
                <PhoneCall size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono">
                {counts.busy}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Görüşmede</span>
            </div>
            <span style={{ backgroundColor: busyHex }} className="absolute bottom-0 inset-x-0 h-1" />
          </button>

          {/* Card 4: Molada */}
          <button
            type="button"
            onClick={() => setStatusFilter("break")}
            style={
              statusFilter === "break"
                ? { borderColor: breakHex, boxShadow: `0 0 0 2px ${hexToRgba(breakHex, 0.2)}` }
                : undefined
            }
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden text-left transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                MOLADA
              </span>
              <div
                style={{
                  backgroundColor: hexToRgba(breakHex, 0.14),
                  color: breakHex
                }}
                className="p-2 rounded-xl shrink-0"
              >
                <Clock size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono">
                {counts.break}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Temsilci</span>
            </div>
            <span style={{ backgroundColor: breakHex }} className="absolute bottom-0 inset-x-0 h-1" />
          </button>
        </div>

        {/* Queue Filter Pills */}
        {data.queues.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Kuyruklar:</span>
            <button
              onClick={() => setSelectedQueueId("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedQueueId === "all"
                  ? `${bg} text-white shadow-sm`
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              }`}
            >
              Tüm Kuyruklarım ({data.queues.length})
            </button>
            {data.queues.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQueueId(String(q.id))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  String(selectedQueueId) === String(q.id)
                    ? `${bg} text-white shadow-sm`
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {q.name}
              </button>
            ))}
          </div>
        )}

        {/* Main Agents Box Container (Identical to WallboardPanel's Temsilci Meşguliyet Durumları) */}
        {viewMode === "box" ? (
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4 min-h-[380px]">
            {/* Widget Header with Right-Aligned Magnifying Glass Search Icon */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
              <div className="flex items-center gap-2">
                <Volume2 size={15} className={text} />
                <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                  Temsilci Çağrı Meşguliyet Durumları
                </h4>
                <span className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-[9px] font-extrabold text-slate-500 uppercase">
                  {statusFilter === "all" && !searchQuery.trim()
                    ? `${loggedInAgents.length} Aktif Temsilci`
                    : `${filteredAgents.length}/${loggedInAgents.length} Aktif Temsilci`}
                </span>
              </div>

              {/* Right-aligned Magnifying Glass Icon */}
              <div className="flex items-center gap-1.5">
                {(isSearchOpen || searchQuery) && (
                  <div className="relative flex items-center animate-in fade-in duration-150">
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="İsim veya dahili..."
                      className="pl-2.5 pr-6 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none w-36"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setIsSearchOpen(false);
                        }}
                        className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isSearchOpen && searchQuery) {
                      setSearchQuery("");
                    }
                    setIsSearchOpen(!isSearchOpen);
                  }}
                  title="Temsilci Ara"
                  className={`h-7 w-7 rounded-xl border flex items-center justify-center transition-all ${
                    isSearchOpen || searchQuery
                      ? `${bg} text-white border-transparent shadow-sm`
                      : "bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200/70 dark:border-slate-800"
                  }`}
                >
                  <Search size={13} />
                </button>
              </div>
            </div>

            {loading && filteredAgents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary" />
                Temsilci bilgileri yükleniyor...
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                {loggedInAgents.length === 0
                  ? "Şu anda çağrı merkezi oturumu açmış (Login) aktif temsilci bulunmuyor."
                  : "Seçilen filtreye uygun aktif temsilci bulunamadı."}
              </div>
            ) : (
              <div className={`grid ${gridColsClass}`}>
                {filteredAgents.map((agent) => {
                  const liveSec = getLiveDurationSeconds(agent);
                  const meta = getStatusMeta(agent, liveSec);
                  const activeHex = meta.hex;
                  const isSelf =
                    Boolean(agent.is_me || agent.is_self) ||
                    (myExtension && String(agent.extension) === myExtension) ||
                    (myUserId && String(agent.id) === myUserId);

                  return (
                    <div
                      key={`${agent.id}-${agent.extension}`}
                      style={{
                        backgroundColor: hexToRgba(activeHex, 0.10),
                        borderColor: hexToRgba(activeHex, 0.60),
                        boxShadow: `0 4px 14px -4px ${hexToRgba(activeHex, 0.18)}`
                      }}
                      className={`${
                        effectiveDensity === "compact" ? "p-2.5" : "p-3.5"
                      } border rounded-2xl flex flex-col justify-between gap-2 relative transition-all`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <img
                              src={agent.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                              alt={agent.name}
                              className={`${
                                effectiveDensity === "compact" ? "w-8 h-8" : "w-10 h-10"
                              } rounded-xl bg-white dark:bg-slate-900 border border-slate-200/40 object-cover`}
                            />
                            {canSeeStatus && (
                              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100/50">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span
                                    style={{ backgroundColor: activeHex }}
                                    className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                                  />
                                  <span
                                    style={{ backgroundColor: activeHex }}
                                    className="relative inline-flex rounded-full h-2.5 w-2.5"
                                  />
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">
                                {agent.name}
                              </p>
                              {isSelf && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${lightBg} ${text}`}>
                                  Siz
                                </span>
                              )}
                            </div>
                            {canSeeDuration && (
                              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 truncate mt-0.5 flex items-center gap-1">
                                {agent.status === "break" && (
                                  <span
                                    style={{ backgroundColor: activeHex }}
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                  />
                                )}
                                {meta.detailsText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canSeeStatus && (
                            <span
                              style={{
                                backgroundColor: hexToRgba(activeHex, 0.18),
                                borderColor: hexToRgba(activeHex, 0.50),
                                color: activeHex
                              }}
                              className="px-2 py-0.5 rounded-lg border text-[8px] font-extrabold uppercase shrink-0"
                            >
                              {meta.badgeLabel}
                            </span>
                          )}

                          {!isSelf && agent.extension && (
                            <button
                              type="button"
                              onClick={() => handleCallAgent(agent.extension)}
                              title={`${agent.name} (${agent.extension}) Dahilisini Ara`}
                              className={`h-7 w-7 rounded-lg border border-transparent flex items-center justify-center text-white shadow-sm transition-all ${bg} ${hover}`}
                            >
                              <PhoneCall size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {effectiveDensity === "detailed" && (canSeeCallCounts || canSeeLoginLogout) && (
                        <div
                          style={{ borderColor: hexToRgba(activeHex, 0.25) }}
                          className="pt-2 mt-1 border-t flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold text-slate-600 dark:text-slate-300"
                        >
                          <span>
                            Dahili: {agent.extension}
                            {canSeeLoginLogout && agent.login_time && agent.login_time !== "-"
                              ? ` • Giriş: ${agent.login_time}`
                              : ""}
                          </span>
                          {canSeeCallCounts && (
                            <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 font-extrabold text-slate-700 dark:text-slate-200">
                              Bugün: {agent.total_calls || 0} Çağrı (G:{agent.inbound_calls || 0} • Ç:{agent.outbound_calls || 0})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* LİSTE GÖRÜNÜMÜ (TABLO - Canlı İzleme Renk Mantığı) */
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${borderLight} bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-400`}>
                    <th className="py-3.5 px-4">Temsilci</th>
                    {(canSeeStatus || canSeeDuration) && (
                      <th className="py-3.5 px-4">
                        {canSeeStatus && canSeeDuration ? "Anlık Durum & Süre" : canSeeStatus ? "Anlık Durum" : "Durum Süresi"}
                      </th>
                    )}
                    {canSeeCallCounts && <th className="py-3.5 px-4 text-center">Çağrı Adetleri (Bugün)</th>}
                    {canSeeDuration && <th className="py-3.5 px-4 text-center">Mola / Konuşma</th>}
                    {canSeeLoginLogout && <th className="py-3.5 px-4 text-center">Login / Logout Zamanı</th>}
                    <th className="py-3.5 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {loading && filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
                        Temsilci bilgileri yükleniyor...
                      </td>
                    </tr>
                  ) : filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        <Users size={28} className="mx-auto mb-2 opacity-40" />
                        {loggedInAgents.length === 0
                          ? "Şu anda çağrı merkezi oturumu açmış (Login) aktif temsilci bulunmuyor."
                          : "Seçilen filtreye uygun aktif temsilci bulunamadı."}
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map((agent) => {
                      const liveSec = getLiveDurationSeconds(agent);
                      const meta = getStatusMeta(agent, liveSec);
                      const activeHex = meta.hex;
                      const isSelf =
                        Boolean(agent.is_me || agent.is_self) ||
                        (myExtension && String(agent.extension) === myExtension) ||
                        (myUserId && String(agent.id) === myUserId);

                      return (
                        <tr
                          key={`${agent.id}-${agent.extension}`}
                          style={{
                            backgroundColor: hexToRgba(activeHex, 0.06)
                          }}
                          className="transition-colors"
                        >
                          {/* Agent Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={agent.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                                  alt={agent.name}
                                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/40 object-cover"
                                />
                                {canSeeStatus && (
                                  <span
                                    style={{ backgroundColor: activeHex }}
                                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900"
                                  />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                  <span>{agent.name}</span>
                                  {isSelf && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${lightBg} ${text}`}>
                                      Siz
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                                    Dahili: {agent.extension}
                                  </span>
                                  {Array.isArray(agent.queues) &&
                                    agent.queues.map((q) => (
                                      <span
                                        key={q.id}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                      >
                                        {q.name}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Live Status & Duration */}
                          {(canSeeStatus || canSeeDuration) && (
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col items-start gap-1">
                                {canSeeStatus && (
                                  <span
                                    style={{
                                      backgroundColor: hexToRgba(activeHex, 0.18),
                                      borderColor: hexToRgba(activeHex, 0.50),
                                      color: activeHex
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase border"
                                  >
                                    <span className="relative flex h-2 w-2">
                                      <span
                                        style={{ backgroundColor: activeHex }}
                                        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                                      />
                                      <span
                                        style={{ backgroundColor: activeHex }}
                                        className="relative inline-flex rounded-full h-2 w-2"
                                      />
                                    </span>
                                    {meta.title}
                                  </span>
                                )}
                                {canSeeDuration && (
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 pl-1">
                                    <Clock size={12} className="text-slate-400 shrink-0" />
                                    <span>{meta.durationPhrase}</span>
                                    {liveSec > 0 && (
                                      <span className="text-[11px] font-mono text-slate-400">
                                        ({formatClockDuration(liveSec)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Call Counts */}
                          {canSeeCallCounts && (
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-center min-w-[54px]" title="Toplam Çağrı">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Toplam</p>
                                  <p className="text-sm font-black text-slate-800 dark:text-white">{agent.total_calls || 0}</p>
                                </div>
                                <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-center min-w-[50px]" title="Gelen Çağrı">
                                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center justify-center gap-0.5">
                                    <PhoneIncoming size={10} /> Gelen
                                  </p>
                                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{agent.inbound_calls || 0}</p>
                                </div>
                                <div className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 text-center min-w-[50px]" title="Giden Çağrı">
                                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center justify-center gap-0.5">
                                    <PhoneOutgoing size={10} /> Giden
                                  </p>
                                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{agent.outbound_calls || 0}</p>
                                </div>
                                <div className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-center min-w-[50px]" title="Cevapsız Çağrı">
                                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center justify-center gap-0.5">
                                    <PhoneMissed size={10} /> Kaçan
                                  </p>
                                  <p className="text-sm font-black text-rose-600 dark:text-rose-400">{agent.missed_calls || 0}</p>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Break & Talk Totals Today */}
                          {canSeeDuration && (
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex flex-col gap-1 text-xs">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                                  <PhoneCall size={12} className="text-emerald-500" />
                                  Konuşma: {formatDurationText(agent.talk_duration_seconds || 0)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                  <Coffee size={12} />
                                  Mola:{" "}
                                  {formatDurationText(
                                    (agent.break_duration_seconds || 0) + (agent.status === "break" ? liveSec : 0)
                                  )}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Login / Logout Time */}
                          {canSeeLoginLogout && (
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex flex-col gap-1 text-xs font-mono">
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  <LogIn size={12} />
                                  Login: {agent.login_time || "-"}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                                  <LogOut size={12} />
                                  Logout: {agent.logout_time || "-"}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            {!isSelf && agent.extension ? (
                              <button
                                onClick={() => handleCallAgent(agent.extension)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${bg} ${hover}`}
                                title={`${agent.name} (${agent.extension}) dahilisini ara`}
                              >
                                <PhoneCall size={13} />
                                Ara
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
