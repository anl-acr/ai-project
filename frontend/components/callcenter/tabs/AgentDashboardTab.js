import React, { useState, useEffect } from "react";
import { Coffee, Clock } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentDashboardTab({ backendHost, currentUser }) {
  const { text, borderLight } = useTheme();
  const [stats, setStats] = useState({
    inbound: 0,
    outbound: 0,
    missed: 0,
    break_minutes: 0,
    break_seconds: 0,
    break_details: [],
    break_logs: []
  });

  useEffect(() => {
    if (!currentUser) return;
    const fetchStats = async () => {
      try {
        const protocol = window.location.protocol;
        const params = new URLSearchParams();
        if (currentUser.extension) params.set("extension", String(currentUser.extension));
        if (currentUser.id) params.set("user_id", String(currentUser.id));
        const res = await fetch(`${protocol}//${backendHost}/api/agent/stats?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch agent stats", err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    window.addEventListener("AGENT_STATUS_UPDATED", fetchStats);
    return () => {
      clearInterval(interval);
      window.removeEventListener("AGENT_STATUS_UPDATED", fetchStats);
    };
  }, [backendHost, currentUser]);

  const totalCalls = (stats.inbound || 0) + (stats.outbound || 0) + (stats.missed || 0);
  const inboundPct = totalCalls > 0 ? (stats.inbound / totalCalls) * 100 : 0;
  const outboundPct = totalCalls > 0 ? (stats.outbound / totalCalls) * 100 : 0;
  const missedPct = totalCalls > 0 ? (stats.missed / totalCalls) * 100 : 0;

  const breakDetails = Array.isArray(stats.break_details) ? stats.break_details : [];
  const breakLogs = Array.isArray(stats.break_logs) ? stats.break_logs : [];
  const totalBreakWeight = breakDetails.reduce((acc, b) => acc + Math.max(1, b.seconds || (b.minutes || 0) * 60 || 1), 0);

  const formatBreakDuration = (sec, minFallback = 0) => {
    const s = typeof sec === "number" ? sec : minFallback * 60;
    if (s > 0 && s < 60) return `${s} sn`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem > 0 && m < 10) return `${m} dk ${rem} sn`;
    return `${m || minFallback || 0} dk`;
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Performans Panosu</h2>
        
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
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Mola (Dk)</p>
            <p className={`text-3xl font-bold ${text} mt-2`}>{stats.break_minutes}</p>
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

          {/* Mola Dağılımı Grafiği */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col justify-center space-y-6`}>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">Mola Dağılımı</h3>
            {breakDetails.length > 0 ? (
              <>
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  {breakDetails.map((b, idx) => {
                    const weight = Math.max(1, b.seconds || (b.minutes || 0) * 60 || 1);
                    const pct = totalBreakWeight > 0 ? (weight / totalBreakWeight) * 100 : 100 / breakDetails.length;
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%` }}
                        className={`${color} transition-all duration-500`}
                        title={`${b.name}: ${formatBreakDuration(b.seconds, b.minutes)}`}
                      ></div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
                  {breakDetails.map((b, idx) => {
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div> {b.name} ({formatBreakDuration(b.seconds, b.minutes)})
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
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Bugünkü Mola Hareketleri</h3>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Toplam: {formatBreakDuration(stats.break_seconds, stats.break_minutes)}
            </span>
          </div>

          {breakLogs.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {breakLogs.map((item, i) => (
                <div key={item.id || i} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.is_active ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{item.break_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock size={12} />
                        <span>Başlangıç: {item.start_time || "-"}</span>
                        {item.end_time ? <span>• Bitiş: {item.end_time}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_active && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                        Devam Ediyor
                      </span>
                    )}
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {formatBreakDuration(item.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-500 text-sm">Bugün kayıtlı mola hareketi bulunmuyor.</div>
          )}
        </div>

      </div>
    </div>
  );
}

