import React, { useState, useEffect } from "react";
import { Coffee, Clock, Play } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentDashboardTab({ backendHost, currentUser }) {
  const { text, borderLight } = useTheme();
  const [stats, setStats] = useState({
    inbound: 0,
    outbound: 0,
    missed: 0,
    break_minutes: 0,
    break_seconds: 0,
    active_break: null,
    break_details: [],
    break_logs: []
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [fetchedAtMs, setFetchedAtMs] = useState(() => Date.now());

  const fetchStats = async () => {
    if (!currentUser) return;
    try {
      const protocol = window.location.protocol;
      const params = new URLSearchParams();
      if (currentUser.extension) params.set("extension", String(currentUser.extension));
      if (currentUser.id) params.set("user_id", String(currentUser.id));
      const res = await fetch(`${protocol}//${backendHost}/api/agent/stats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        const now = Date.now();
        setFetchedAtMs(now);
        setNowMs(now);
      }
    } catch (err) {
      console.error("Failed to fetch agent stats", err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    window.addEventListener("AGENT_STATUS_UPDATED", fetchStats);
    return () => {
      clearInterval(interval);
      window.removeEventListener("AGENT_STATUS_UPDATED", fetchStats);
    };
  }, [backendHost, currentUser]);

  // 1-second real-time ticker for active break timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const deltaSec = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));

  const getLiveLogDuration = (log) => {
    if (!log) return 0;
    if (log.is_active) {
      if (log.start_time_utc) {
        const diff = Math.floor((nowMs - new Date(log.start_time_utc).getTime()) / 1000);
        if (!isNaN(diff) && diff >= 0) return diff;
      }
      return (Number(log.duration_seconds) || 0) + deltaSec;
    }
    return Number(log.duration_seconds) || 0;
  };

  const activeBreak = stats.active_break;
  const activeBreakElapsed = activeBreak
    ? activeBreak.start_time_utc
      ? Math.max(0, Math.floor((nowMs - new Date(activeBreak.start_time_utc).getTime()) / 1000))
      : (Number(activeBreak.elapsed_seconds) || 0) + deltaSec
    : 0;

  const breakLogs = Array.isArray(stats.break_logs) ? stats.break_logs : [];
  const rawBreakDetails = Array.isArray(stats.break_details) ? stats.break_details : [];

  // Compute live per-break seconds from break_details + deltaSec if active
  const breakDetails = rawBreakDetails.map((b) => {
    const baseSec = typeof b.seconds === "number" ? b.seconds : (b.minutes || 0) * 60;
    const liveSec = b.is_active ? baseSec + deltaSec : baseSec;
    return {
      ...b,
      liveSeconds: Math.max(0, liveSec)
    };
  });

  const liveTotalBreakSeconds = breakDetails.length > 0
    ? breakDetails.reduce((acc, b) => acc + b.liveSeconds, 0)
    : (Number(stats.break_seconds) || (Number(stats.break_minutes) || 0) * 60) + (activeBreak ? deltaSec : 0);

  const totalBreakWeight = breakDetails.reduce((acc, b) => acc + Math.max(1, b.liveSeconds), 0);

  const totalCalls = (stats.inbound || 0) + (stats.outbound || 0) + (stats.missed || 0);
  const inboundPct = totalCalls > 0 ? (stats.inbound / totalCalls) * 100 : 0;
  const outboundPct = totalCalls > 0 ? (stats.outbound / totalCalls) * 100 : 0;
  const missedPct = totalCalls > 0 ? (stats.missed / totalCalls) * 100 : 0;

  const formatBreakDuration = (sec, minFallback = 0) => {
    const s = Math.max(0, typeof sec === "number" ? Math.round(sec) : minFallback * 60);
    if (s === 0) return "0 sn";
    if (s < 60) return `${s} sn`;
    const hrs = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return rem > 0 ? `${hrs} sa ${m} dk ${rem} sn` : `${hrs} sa ${m} dk`;
    }
    return rem > 0 ? `${m} dk ${rem} sn` : `${m} dk`;
  };

  const formatClockDuration = (sec) => {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const handleEndBreakFromPano = async () => {
    if (!currentUser) return;
    try {
      const protocol = window.location.protocol;
      const payload = {
        is_logged_in: true,
        status: "online",
        current_break: null,
        user_id: currentUser.id,
        extension: currentUser.extension || ""
      };
      const res = await fetch(`${protocol}//${backendHost}/api/agent/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        window.dispatchEvent(new CustomEvent("AGENT_STATUS_UPDATED", { detail: data.agent_state || payload }));
        fetchStats();
      }
    } catch (e) {
      console.error("Failed to end break from Pano:", e);
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Performans Panosu</h2>
          {activeBreak && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <div className="text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  Aktif Mola: {activeBreak.name}
                </span>
                <span className="mx-2 text-amber-400">•</span>
                <span className="font-mono font-extrabold text-amber-700 dark:text-amber-400">
                  {formatBreakDuration(activeBreakElapsed)} ({formatClockDuration(activeBreakElapsed)})
                </span>
              </div>
              <button
                onClick={handleEndBreakFromPano}
                className="ml-2 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm"
              >
                <Play size={12} />
                Molayı Bitir
              </button>
            </div>
          )}
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border ${borderLight} shadow-sm text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Gelen Çağrı</p>
            <p className={`text-3xl font-bold ${text} mt-2`}>{stats.inbound}</p>
          </div>
          <div className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border ${borderLight} shadow-sm text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Giden Çağrı</p>
            <p className={`text-3xl font-bold ${text} mt-2`}>{stats.outbound}</p>
          </div>
          <div className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border ${borderLight} shadow-sm text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Toplam Mola Süresi</p>
            <p className={`text-2xl font-bold ${text} mt-2`}>
              {formatBreakDuration(liveTotalBreakSeconds, stats.break_minutes)}
            </p>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              {formatClockDuration(liveTotalBreakSeconds)}
            </p>
          </div>
          <div className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border ${borderLight} shadow-sm text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Cevapsız</p>
            <p className={`text-3xl font-bold ${text} mt-2`}>{stats.missed}</p>
          </div>
        </div>

        {/* Graphs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Çağrı Dağılımı Grafiği */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col justify-center space-y-6`}>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">Çağrı Dağılımı</h3>
            {totalCalls > 0 ? (
              <>
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  <div style={{width: `${inboundPct}%`}} className="bg-emerald-500 transition-all duration-500" title={`Gelen: ${stats.inbound}`}></div>
                  <div style={{width: `${outboundPct}%`}} className="bg-blue-500 transition-all duration-500" title={`Giden: ${stats.outbound}`}></div>
                  <div style={{width: `${missedPct}%`}} className="bg-rose-500 transition-all duration-500" title={`Cevapsız: ${stats.missed}`}></div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Gelen ({stats.inbound})
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div> Giden ({stats.outbound})
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div> Cevapsız ({stats.missed})
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-500 text-sm">Çağrı verisi bulunmuyor.</div>
            )}
          </div>

          {/* Mola Dağılımı & Kullanım Süreleri Grafiği */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col justify-center space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Mola Dağılımı & Süreler</h3>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {formatBreakDuration(liveTotalBreakSeconds, stats.break_minutes)}
              </span>
            </div>
            {breakDetails.length > 0 ? (
              <>
                <div className="w-full h-5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  {breakDetails.map((b, idx) => {
                    const weight = Math.max(1, b.liveSeconds);
                    const pct = totalBreakWeight > 0 ? (weight / totalBreakWeight) * 100 : 100 / breakDetails.length;
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%` }}
                        className={`${color} transition-all duration-500`}
                        title={`${b.name}: ${formatBreakDuration(b.liveSeconds, b.minutes)}`}
                      ></div>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-1">
                  {breakDetails.map((b, idx) => {
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${color} ${b.is_active ? "animate-ping" : ""}`}></div>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{b.name}</span>
                          {b.count > 1 && (
                            <span className="text-[10px] text-slate-400 font-semibold">({b.count} kez)</span>
                          )}
                          {b.is_active && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                              Aktif
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {formatBreakDuration(b.liveSeconds, b.minutes)}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            ({formatClockDuration(b.liveSeconds)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-500 text-sm">Henüz mola kullanılmadı.</div>
            )}
          </div>

        </div>

        {/* Bugünkü Mola Hareketleri */}
        <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee size={18} className="text-amber-500" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Bugünkü Mola Hareketleri (Ne Kadar Süredir Kullanıldı)</h3>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Toplam Kullanım: {formatBreakDuration(liveTotalBreakSeconds, stats.break_minutes)} ({formatClockDuration(liveTotalBreakSeconds)})
            </span>
          </div>

          {breakLogs.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {breakLogs.map((item, i) => {
                const liveDur = getLiveLogDuration(item);
                return (
                  <div key={item.id || i} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.is_active ? "bg-amber-500 animate-ping" : "bg-slate-400"}`} />
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{item.break_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          <span>Başlangıç: {item.start_time || "-"}</span>
                          {item.end_time ? <span>• Bitiş: {item.end_time}</span> : <span>• Şu anda molada</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_active && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                          Devam Ediyor
                        </span>
                      )}
                      <span className="font-mono font-bold text-xs px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {formatBreakDuration(liveDur)} ({formatClockDuration(liveDur)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-sm">Bugün kayıtlı mola hareketi bulunmuyor.</div>
          )}
        </div>

      </div>
    </div>
  );
}


