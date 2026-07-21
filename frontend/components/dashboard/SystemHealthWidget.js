import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Server, Zap, Activity } from 'lucide-react';
import { useTheme } from '../../utils/theme';

export default function SystemHealthWidget({ backendHost = "localhost:8000" }) {
  const { bg, text, lightBg } = useTheme();
  
  const [stats, setStats] = useState({
    cpu: 0,
    ram: 0,
    disk: 0,
    uptime: "Yükleniyor..."
  });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const res = await fetch(`${protocol}//${backendHost}/api/system/health`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            cpu: Math.round(data.cpu),
            ram: Math.round(data.ram),
            disk: Math.round(data.disk),
            uptime: data.asterisk_uptime || "Aktif"
          });
        }
      } catch (err) {
        console.error("System health fetch error:", err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [backendHost]);

  const getColorClass = (val) => {
    if (val < 60) return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50";
    if (val < 85) return "text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50";
    return "text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50";
  };

  const getProgressColor = (val) => {
    if (val < 60) return "bg-emerald-500";
    if (val < 85) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-[24px] p-5 shadow-sm mb-6 flex flex-col md:flex-row gap-6 md:items-center justify-between animate-in fade-in slide-in-from-top-2">
      
      {/* Title Area */}
      <div className="flex items-center gap-3 shrink-0">
        <div className={`w-12 h-12 rounded-[16px] ${lightBg} flex items-center justify-center shrink-0`}>
          <Activity size={24} className={text} />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Sistem Sağlığı</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Canlı İzleme Aktif
          </p>
        </div>
      </div>

      {/* Metrics Area */}
      <div className="grid grid-cols-2 md:flex flex-wrap items-center gap-4 md:gap-8 flex-1">
        
        {/* CPU */}
        <div className={`flex flex-col gap-1.5 min-w-[120px] p-3 rounded-2xl border ${getColorClass(stats.cpu)} transition-colors`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-80 uppercase tracking-wider">
              <Cpu size={14} /> CPU
            </div>
            <span className="text-sm font-extrabold">{stats.cpu}%</span>
          </div>
          <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.cpu)} transition-all duration-500 ease-out`} style={{ width: `${stats.cpu}%` }}></div>
          </div>
        </div>

        {/* RAM */}
        <div className={`flex flex-col gap-1.5 min-w-[120px] p-3 rounded-2xl border ${getColorClass(stats.ram)} transition-colors`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-80 uppercase tracking-wider">
              <Zap size={14} /> RAM
            </div>
            <span className="text-sm font-extrabold">{stats.ram}%</span>
          </div>
          <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.ram)} transition-all duration-500 ease-out`} style={{ width: `${stats.ram}%` }}></div>
          </div>
        </div>

        {/* Disk */}
        <div className={`flex flex-col gap-1.5 min-w-[120px] p-3 rounded-2xl border ${getColorClass(stats.disk)} transition-colors`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-80 uppercase tracking-wider">
              <HardDrive size={14} /> DİSK
            </div>
            <span className="text-sm font-extrabold">{stats.disk}%</span>
          </div>
          <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.disk)} transition-all duration-500 ease-out`} style={{ width: `${stats.disk}%` }}></div>
          </div>
        </div>
        
        {/* Asterisk Uptime */}
        <div className="flex flex-col gap-1.5 min-w-[120px] p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-80 uppercase tracking-wider">
              <Server size={14} /> PBX UPTIME
            </div>
          </div>
          <span className="text-[13px] font-extrabold truncate" title={stats.uptime}>{stats.uptime}</span>
        </div>

      </div>
    </div>
  );
}
