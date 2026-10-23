import React, { useState, useEffect } from "react";
import {
  Users,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Coffee,
  CheckCircle2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Headphones,
  Radio
} from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentQueuePeersTab({ backendHost, currentUser, callPanelPerms }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const canSeeStatus = callPanelPerms ? callPanelPerms.agentsCanSeeStatus !== false : true;
  const canSeeDuration = callPanelPerms ? callPanelPerms.agentsCanSeeDuration !== false : true;
  const canSeeCallCounts = callPanelPerms ? callPanelPerms.agentsCanSeeCallCounts !== false : true;
  const canSeeLoginLogout = callPanelPerms ? callPanelPerms.agentsCanSeeLoginLogout !== false : true;
  const [data, setData] = useState({ queues: [], agents: [] });
  const [loading, setLoading] = useState(true);
  const [selectedQueueId, setSelectedQueueId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
  const API_BASE = `${typeof window !== "undefined" ? window.location.protocol : "http:"}//${host}`;

  const myUserId = currentUser?.id ? String(currentUser.id) : "";
  const myExtension = currentUser?.extension ? String(currentUser.extension) : "";

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

  const filteredAgents = data.agents.filter((agent) => {
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
  });

  const counts = {
    all: data.agents.length,
    available: data.agents.filter((a) => a.status === "available").length,
    busy: data.agents.filter((a) => a.status === "busy").length,
    break: data.agents.filter((a) => a.status === "break").length,
    offline: data.agents.filter((a) => a.status === "offline").length
  };

  const getStatusMeta = (agent, liveSec) => {
    const durText = formatDurationText(liveSec);
    if (agent.status === "busy") {
      return {
        badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        dot: "bg-rose-500 animate-ping",
        solidDot: "bg-rose-500",
        title: "Meşgul (Çağrıda)",
        durationPhrase: `${durText} süredir meşgul`
      };
    }
    if (agent.status === "break") {
      return {
        badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        dot: "bg-amber-500 animate-pulse",
        solidDot: "bg-amber-500",
        title: agent.break_reason ? `Molada (${agent.break_reason})` : "Molada",
        durationPhrase: `${durText} süredir molada`
      };
    }
    if (agent.status === "available") {
      return {
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        dot: "bg-emerald-500",
        solidDot: "bg-emerald-500",
        title: "Müsait",
        durationPhrase: `${durText} süredir müsait`
      };
    }
    return {
      badgeBg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      dot: "bg-slate-400",
      solidDot: "bg-slate-400",
      title: "Çevrimdışı",
      durationPhrase: liveSec > 0 ? `${durText} süredir çevrimdışı` : "Çevrimdışı"
    };
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
              <Headphones size={22} className={text} />
              Kuyruk Temsilcileri (Canlı Durum)
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Radio size={12} className="animate-pulse" />
                Realtime
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Bulunduğunuz kuyruktaki diğer temsilcilerin anlık durumları, durum süreleri, çağrı adetleri ve giriş/çıkış saatleri.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Temsilci veya dahili ara..."
                className="text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none w-56"
              />
            </div>
            <button
              onClick={() => fetchQueuePeers(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
              title="Şimdi Yenile"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Yenile
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => setStatusFilter("all")}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              statusFilter === "all"
                ? `${lightBg} ${border} shadow-sm`
                : `bg-white dark:bg-slate-900 ${borderLight}`
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Toplam Temsilci</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{counts.all}</p>
          </button>

          <button
            onClick={() => setStatusFilter("available")}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              statusFilter === "available"
                ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                : `bg-white dark:bg-slate-900 ${borderLight}`
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Müsait
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{counts.available}</p>
          </button>

          <button
            onClick={() => setStatusFilter("busy")}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              statusFilter === "busy"
                ? "bg-rose-500/10 border-rose-500/40 shadow-sm"
                : `bg-white dark:bg-slate-900 ${borderLight}`
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              Meşgul
            </p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{counts.busy}</p>
          </button>

          <button
            onClick={() => setStatusFilter("break")}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              statusFilter === "break"
                ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                : `bg-white dark:bg-slate-900 ${borderLight}`
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Molada
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{counts.break}</p>
          </button>

          <button
            onClick={() => setStatusFilter("offline")}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              statusFilter === "offline"
                ? "bg-slate-500/10 border-slate-400/40 shadow-sm"
                : `bg-white dark:bg-slate-900 ${borderLight}`
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Çevrimdışı
            </p>
            <p className="text-2xl font-black text-slate-600 dark:text-slate-300 mt-1">{counts.offline}</p>
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

        {/* Agents Table / Cards */}
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
                      Filtreye uygun temsilci bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const liveSec = getLiveDurationSeconds(agent);
                    const meta = getStatusMeta(agent, liveSec);
                    const isSelf =
                      Boolean(agent.is_self) ||
                      (myExtension && String(agent.extension) === myExtension) ||
                      (myUserId && String(agent.id) === myUserId);

                    return (
                      <tr
                        key={`${agent.id}-${agent.extension}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Agent Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${lightBg} ${text}`}>
                                {(agent.name || "T").charAt(0).toUpperCase()}
                              </div>
                              {canSeeStatus && (
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${meta.solidDot}`}></span>
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
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${meta.badgeBg}`}>
                                  <span className="relative flex h-2 w-2">
                                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${meta.dot}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${meta.solidDot}`}></span>
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
      </div>
    </div>
  );
}
