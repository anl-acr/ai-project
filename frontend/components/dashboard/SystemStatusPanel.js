import React, { useState, useEffect, useRef } from "react";
import { 
  Cpu, 
  Database, 
  Activity, 
  HardDrive, 
  Network, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Server
} from "lucide-react";

export default function SystemStatusPanel({ backendHost = "localhost:8000" }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [networkHistory, setNetworkHistory] = useState([]);
  const prevNetRef = useRef(null);

  // Poll system stats from FastAPI backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const res = await fetch(`${protocol}//${backendHost}/api/system/stats`);
        const data = await res.json();
        
        setStats(data);
        setLoading(false);

        // Update CPU and RAM history
        setHistory(prev => {
          const newPoint = { cpu: data.cpu_usage, ram: data.ram_usage, time: new Date().toLocaleTimeString() };
          const updated = [...prev, newPoint];
          if (updated.length > 20) updated.shift();
          return updated;
        });

        // Compute Network Throughput (diff from previous poll)
        const prevNet = prevNetRef.current;
        if (prevNet) {
          const timeDiff = 5; // 5 seconds interval
          const sentDiff = Math.max(0, data.net_sent_mb - prevNet.sent);
          const recvDiff = Math.max(0, data.net_recv_mb - prevNet.recv);
          
          setNetworkHistory(prev => {
            const newPoint = { 
              up: parseFloat((sentDiff / timeDiff).toFixed(2)), 
              down: parseFloat((recvDiff / timeDiff).toFixed(2)) 
            };
            const updated = [...prev, newPoint];
            if (updated.length > 20) updated.shift();
            return updated;
          });
        } else {
          // Initialize with 0s
          setNetworkHistory([{ up: 0, down: 0 }]);
        }

        prevNetRef.current = { sent: data.net_sent_mb, recv: data.net_recv_mb };

      } catch (err) {
        console.error("Sistem istatistikleri alınamadı:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [backendHost]);

  // SVG Chart path generator helpers
  const generateChartPaths = (dataList, key, maxVal = 100, width = 500, height = 120) => {
    if (dataList.length < 2) return { line: "", area: "" };
    
    const stepX = width / (dataList.length - 1);
    const points = dataList.map((item, idx) => {
      const val = item[key] || 0;
      const x = idx * stepX;
      const y = height - (val / (maxVal || 1)) * (height - 10) - 5;
      return { x, y };
    });

    const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;
    const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
    
    return { line: linePath, area: areaPath };
  };

  if (loading || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Activity className="animate-spin text-primary mb-4" size={32} />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Sistem Sağlık Verileri Yükleniyor...</p>
      </div>
    );
  }

  // Network throughput display
  const currentNetSpeed = networkHistory[networkHistory.length - 1] || { up: 0, down: 0 };

  return (
    <div className="w-full space-y-6">
      
      {/* Page Title & Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Sistem Panosu & Sağlık Durumu
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Yapay zeka çağrı merkezi fiziksel kaynakları ve entegrasyon servislerinin gerçek zamanlı izlenmesi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-primary dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-250/30 dark:border-emerald-900/30 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            Tüm Servisler Aktif
          </span>
        </div>
      </div>

      {/* Integration Services Status (AMI & Gemini API Indicators) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Asterisk AMI Status Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex items-start gap-4">
          <div className={`p-3 rounded-xl ${stats.asterisk_ami_status === "OK" ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-450" : "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-450"}`}>
            <Server size={22} className={stats.asterisk_ami_status === "OK" ? "animate-pulse" : ""} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Asterisk AMI Bağlantısı</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                stats.asterisk_ami_status === "OK" 
                  ? "bg-emerald-50/50 dark:bg-emerald-950/10 text-primary dark:text-emerald-450 border-emerald-200/50 dark:border-emerald-900/30" 
                  : "bg-rose-50/50 dark:bg-rose-950/10 text-primary dark:text-rose-450 border-rose-200/50 dark:border-rose-900/30"
              }`}>
                {stats.asterisk_ami_status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Santral çağrı olaylarını yakalayan ve yönlendiren yönetici kanalı bağlantısı.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <p>Adres: <b className="text-slate-700 dark:text-slate-300">127.0.0.1:5038</b></p>
              <p>Kullanıcı: <b className="text-slate-700 dark:text-slate-300">ai_backend_user</b></p>
            </div>
          </div>
        </div>

        {/* Gemini Live API Status Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex items-start gap-4">
          <div className={`p-3 rounded-xl ${stats.gemini_live_status === "OK" ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400" : "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-450"}`}>
            <Zap size={22} className={stats.gemini_live_status === "OK" ? "animate-bounce" : ""} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Gemini Live Audio API</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                stats.gemini_live_status === "OK" 
                  ? "bg-indigo-50/50 dark:bg-indigo-950/10 text-primary dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30" 
                  : "bg-rose-50/50 dark:bg-rose-950/10 text-primary dark:text-rose-450 border-rose-200/50 dark:border-rose-900/30"
              }`}>
                {stats.gemini_live_status === "OK" ? "AKTİF" : "HATA"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Düşük gecikmeli, ses-giriş ses-çıkış multimodal yapay zeka asistan motoru.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <p>Model: <b className="text-slate-700 dark:text-slate-300">gemini-2.5-flash-audio</b></p>
              <p>API Key: <b className="text-primary dark:text-emerald-400">Doğrulandı ✓</b></p>
            </div>
          </div>
        </div>

      </div>

      {/* KPI Cards: CPU, RAM, Disk, Network */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CPU Util Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform duration-200">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">İşlemci (CPU)</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.cpu_usage}%</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1.5">Sistem yük derecesi</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center">
            <svg className="absolute transform -rotate-90 w-full h-full">
              <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4.5" className="text-slate-100 dark:text-slate-800" fill="transparent" />
              <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4.5" className="text-primary" fill="transparent"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={2 * Math.PI * 22 * (1 - stats.cpu_usage / 100)}
              />
            </svg>
            <Cpu size={18} className="text-primary" />
          </div>
        </div>

        {/* RAM Usage Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform duration-200">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Bellek (RAM)</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.ram_usage}%</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1.5">{stats.ram_used_gb} GB / {stats.ram_total_gb} GB</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center">
            <svg className="absolute transform -rotate-90 w-full h-full">
              <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4.5" className="text-slate-100 dark:text-slate-800" fill="transparent" />
              <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4.5" className="text-primary" fill="transparent"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={2 * Math.PI * 22 * (1 - stats.ram_usage / 100)}
              />
            </svg>
            <Database size={18} className="text-primary" />
          </div>
        </div>

        {/* Disk Space Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Disk Depolama</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.disk_usage}%</p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 text-primary rounded-xl">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${stats.disk_usage}%` }}></div>
            </div>
            <div className="flex justify-between text-[9px] font-semibold text-slate-500 dark:text-slate-400">
              <span>{stats.disk_used_gb} GB Kullanılan</span>
              <span>{stats.disk_total_gb} GB Toplam</span>
            </div>
          </div>
        </div>

        {/* Network Activity Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Anlık Ağ Hızı</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white">{currentNetSpeed.down}</span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">MB/s</span>
              </div>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-primary rounded-xl">
              <Network size={18} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
            <div className="flex items-center gap-1">
              <ArrowDownLeft size={10} className="text-primary" />
              <span>Giriş: {stats.net_recv_mb > 1024 ? `${(stats.net_recv_mb/1024).toFixed(1)} GB` : `${stats.net_recv_mb} MB`}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight size={10} className="text-primary" />
              <span>Çıkış: {stats.net_sent_mb > 1024 ? `${(stats.net_sent_mb/1024).toFixed(1)} GB` : `${stats.net_sent_mb} MB`}</span>
            </div>
          </div>
        </div>

      </div>

      {/* AI PBX extended Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* NAS Recording Storage Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3.5">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">Ses Kayıt Depolama (NAS)</h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
              stats.nas_mounted 
                ? "bg-emerald-50/50 dark:bg-emerald-950/10 text-primary dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30" 
                : "bg-amber-50/50 dark:bg-amber-950/10 text-primary dark:text-primary border-amber-200/50 dark:border-amber-900/30"
            }`}>
              {stats.nas_mounted ? "Bağlı ✓" : "Yerel Mod"}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Dosya Adedi:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.rec_file_count} .wav</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Toplam Boyut:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.rec_total_size_mb} MB</span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800 font-mono truncate" title={stats.nas_mount_path}>
              Yol: {stats.nas_mount_path}
            </div>
          </div>
        </div>

        {/* RAG Knowledge Base Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3.5">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">Bilgi Bankası (RAG)</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border bg-blue-50/50 dark:bg-blue-950/10 text-primary dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30">
              Vektör DB
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Kaynak Dökümanlar:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.total_sources} döküman</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Toplam Vektör (Chunk):</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.total_chunks} adet</span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold">
              Gemini Text Embedding-004 aktif
            </div>
          </div>
        </div>

        {/* Real-time Call Stats Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3.5">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">Çağrı Sağlığı & Kapasite</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border bg-indigo-50/50 dark:bg-indigo-950/10 text-primary dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30">
              Canlı Akış
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Anlık Eşzamanlı Çağrı:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${stats.active_calls_count > 0 ? "bg-primary animate-ping" : "bg-slate-400"}`}></span>
                {stats.active_calls_count} / 10 kanal
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Bugün Toplam Çağrı:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.today_calls_count} çağrı</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Yapay Zeka API Gecikmesi:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{stats.gemini_latency_ms} ms</span>
            </div>
          </div>
        </div>

      </div>

      {/* SVG Charts: Resources Trends over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CPU & RAM Graph Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
                KAYNAK KULLANIM AKIŞI (CPU / RAM)
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Son 60 saniyedeki yük eğrileri.</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-extrabold">
              <span className="flex items-center gap-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary"></span> CPU
              </span>
              <span className="flex items-center gap-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary"></span> RAM
              </span>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative h-32 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80 overflow-hidden flex items-end">
            {history.length >= 2 ? (
              <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                
                {/* CPU Area & Line */}
                <path d={generateChartPaths(history, "cpu", 100, 500, 120).area} fill="url(#cpuGrad)" />
                <path d={generateChartPaths(history, "cpu", 100, 500, 120).line} fill="transparent" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />

                {/* RAM Area & Line */}
                <path d={generateChartPaths(history, "ram", 100, 500, 120).area} fill="url(#ramGrad)" />
                <path d={generateChartPaths(history, "ram", 100, 500, 120).line} fill="transparent" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400">Grafik için veri bekleniyor...</div>
            )}
          </div>
        </div>

        {/* Network Activity Graph Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
                AĞ TRAFİĞİ ETKİNLİĞİ (THROUGHPUT)
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Saniye başına indirilen/yüklenen veri hızı.</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-extrabold">
              <span className="flex items-center gap-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary"></span> İNDİRME
              </span>
              <span className="flex items-center gap-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary"></span> YÜKLEME
              </span>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="relative h-32 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80 overflow-hidden flex items-end">
            {networkHistory.length >= 2 ? (
              <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeDasharray="3,3" />
                
                {/* Download (down) Area & Line */}
                <path d={generateChartPaths(networkHistory, "down", 15, 500, 120).area} fill="url(#downGrad)" />
                <path d={generateChartPaths(networkHistory, "down", 15, 500, 120).line} fill="transparent" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

                {/* Upload (up) Area & Line */}
                <path d={generateChartPaths(networkHistory, "up", 15, 500, 120).area} fill="url(#upGrad)" />
                <path d={generateChartPaths(networkHistory, "up", 15, 500, 120).line} fill="transparent" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400">Ağ veri hareketi bekleniyor...</div>
            )}
          </div>
        </div>

      </div>

      {/* Live System Log Console */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col font-mono text-xs text-slate-800 dark:text-slate-200 transition-all duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            <span>Canlı Sistem Log Terminali</span>
          </div>
          <div>Bileşen: backend.main</div>
        </div>
        <div className="h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800/80 text-left">
          {stats.system_logs && stats.system_logs.length > 0 ? (
            stats.system_logs.map((log, index) => {
              let sourceColor = "text-primary dark:text-indigo-400";
              if (log.source === "ASTERISK") sourceColor = "text-primary dark:text-purple-400";
              if (log.source === "BROWSER") sourceColor = "text-cyan-600 dark:text-cyan-400";
              if (log.source === "DATABASE") sourceColor = "text-primary dark:text-amber-400";

              let levelColor = "text-slate-500 dark:text-slate-400";
              if (log.level === "ERROR") levelColor = "text-primary dark:text-primary font-bold animate-pulse";
              if (log.level === "WARN") levelColor = "text-primary dark:text-primary font-bold";
              if (log.level === "INFO") levelColor = "text-primary dark:text-primary";

              return (
                <div key={index} className="flex gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 p-0.5 rounded transition-colors text-[10px]">
                  <span className="text-slate-400 dark:text-slate-600 font-semibold">{log.timestamp}</span>
                  <span className={`font-extrabold ${sourceColor}`}>[{log.source}]</span>
                  <span className={`font-extrabold uppercase ${levelColor}`}>{log.level}:</span>
                  <span className="text-slate-700 dark:text-slate-200">{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-450 dark:text-slate-600 text-center pt-16">Terminal log akışı bekleniyor...</div>
          )}
        </div>
      </div>

    </div>
  );
}
