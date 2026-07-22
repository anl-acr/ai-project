import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Server, Zap, Activity, Radio } from 'lucide-react';
import { useTheme } from '../../utils/theme';

const formatUptimeTR = (uptimeStr) => {
  if (!uptimeStr || uptimeStr === "Unknown" || uptimeStr === "Bilinmiyor") return "Bilinmiyor";
  return uptimeStr
    .replace(/years?/gi, 'yıl')
    .replace(/weeks?/gi, 'hafta')
    .replace(/days?/gi, 'gün')
    .replace(/hours?/gi, 'saat')
    .replace(/minutes?/gi, 'dakika')
    .replace(/seconds?/gi, 'saniye');
};

export default function SystemHealthWidget({ backendHost = "localhost:8000" }) {
  const { bg, text, lightBg } = useTheme();
  
  const [stats, setStats] = useState({
    cpu: 0,
    ram: 0,
    disk: 0,
    uptime: "Yükleniyor...",
    amiStatus: "Bağlı",
    activeCalls: 0
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
            uptime: formatUptimeTR(data.asterisk_uptime) || "Aktif",
            amiStatus: data.ami_status || "Bağlı",
            activeCalls: data.active_calls || 0
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-[24px] p-5 shadow-sm mb-6 flex flex-col lg:flex-row gap-5 lg:items-center justify-between transition-all duration-300">
      
      {/* Title Area */}
      <div className="flex items-center gap-3.5 shrink-0 pr-2 lg:border-r lg:border-slate-200/60 dark:lg:border-slate-800/60 lg:pr-5">
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

      {/* Metrics Area - Evenly spread across 5 equal grid columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 flex-1 w-full items-stretch">
        
        {/* CPU */}
        <div className={`flex flex-col justify-between p-3.5 rounded-2xl border ${getColorClass(stats.cpu)} transition-all duration-200 hover:shadow-sm w-full`}>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-85 uppercase tracking-wider">
              <Cpu size={15} /> CPU
            </div>
            <span className="text-sm font-extrabold">{stats.cpu}%</span>
          </div>
          <div className="w-full bg-slate-200/60 dark:bg-black/30 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.cpu)} transition-all duration-500 ease-out rounded-full`} style={{ width: `${stats.cpu}%` }}></div>
          </div>
        </div>

        {/* RAM */}
        <div className={`flex flex-col justify-between p-3.5 rounded-2xl border ${getColorClass(stats.ram)} transition-all duration-200 hover:shadow-sm w-full`}>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-85 uppercase tracking-wider">
              <Zap size={15} /> RAM
            </div>
            <span className="text-sm font-extrabold">{stats.ram}%</span>
          </div>
          <div className="w-full bg-slate-200/60 dark:bg-black/30 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.ram)} transition-all duration-500 ease-out rounded-full`} style={{ width: `${stats.ram}%` }}></div>
          </div>
        </div>

        {/* Disk */}
        <div className={`flex flex-col justify-between p-3.5 rounded-2xl border ${getColorClass(stats.disk)} transition-all duration-200 hover:shadow-sm w-full`}>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-85 uppercase tracking-wider">
              <HardDrive size={15} /> DİSK
            </div>
            <span className="text-sm font-extrabold">{stats.disk}%</span>
          </div>
          <div className="w-full bg-slate-200/60 dark:bg-black/30 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div className={`h-full ${getProgressColor(stats.disk)} transition-all duration-500 ease-out rounded-full`} style={{ width: `${stats.disk}%` }}></div>
          </div>
        </div>

        {/* AMI / PBX Status */}
        <div className="flex flex-col justify-between p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 transition-all duration-200 hover:shadow-sm w-full">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-85 uppercase tracking-wider">
              <Radio size={15} /> AMI SERVİSİ
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-sm font-extrabold">{stats.amiStatus || "Bağlı"}</span>
            <span className="text-[10px] font-semibold opacity-75">
              {stats.activeCalls > 0 ? `${stats.activeCalls} Aktif Arama` : "Boşta"}
            </span>
          </div>
        </div>
        
        {/* Asterisk Uptime */}
        <div className="flex flex-col justify-between p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 transition-all duration-200 hover:shadow-sm w-full">
          <div className="flex items-center gap-1.5 text-xs font-bold opacity-85 uppercase tracking-wider">
            <Server size={15} /> SANTRAL UPTIME
          </div>
          <span className="text-[13px] font-extrabold truncate mt-1.5" title={stats.uptime}>{stats.uptime}</span>
        </div>

      </div>
    </div>
  );
}
