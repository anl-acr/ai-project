import React, { useState, useEffect } from "react";
import { useTheme } from "../../../utils/theme";

export default function AgentDashboardTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [stats, setStats] = useState({
    inbound: 0,
    outbound: 0,
    missed: 0,
    break_minutes: 0,
    break_details: []
  });

  useEffect(() => {
    if (!currentUser) return;
    const fetchStats = async () => {
      try {
        const protocol = window.location.protocol;
        const res = await fetch(`${protocol}//${backendHost}/api/agent/stats?extension=${currentUser.extension || currentUser.id}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch agent stats", err);
      }
    };
    fetchStats();
    // Poll every 10 seconds for MVP
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [backendHost, currentUser]);

  const totalCalls = stats.inbound + stats.outbound + stats.missed;
  const inboundPct = totalCalls > 0 ? (stats.inbound / totalCalls) * 100 : 0;
  const outboundPct = totalCalls > 0 ? (stats.outbound / totalCalls) * 100 : 0;
  const missedPct = totalCalls > 0 ? (stats.missed / totalCalls) * 100 : 0;

  const totalBreak = stats.break_details ? stats.break_details.reduce((acc, b) => acc + b.minutes, 0) : 0;

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
            {stats.break_details && stats.break_details.length > 0 && totalBreak > 0 ? (
              <>
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  {stats.break_details.map((b, idx) => {
                    const pct = totalBreak > 0 ? (b.minutes / totalBreak) * 100 : 0;
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return <div key={idx} style={{width: `${pct}%`}} className={`${color} transition-all duration-500`} title={`${b.name}: ${b.minutes} dk`}></div>
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
                  {stats.break_details.map((b, idx) => {
                    const colors = ["bg-amber-400", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div> {b.name} ({b.minutes} dk)
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-500 text-sm">Henüz mola kullanılmadı.</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
