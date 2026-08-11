import React, { useState, useEffect } from "react";
import { Monitor, Users, PhoneCall, CheckCircle2, Clock, ShieldAlert, Volume2, MessageSquare, AlertCircle, Play, ShieldCheck, Activity } from "lucide-react";

export default function WallboardPanel({ backendHost = "localhost:8000" }) {
  const [authorized, setAuthorized] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [breaks, setBreaks] = useState([]);
  
  // Real-time wallboard metrics
  const [queueCount, setQueueCount] = useState(0);
  const [aiResolvedCount, setAiResolvedCount] = useState(0);
  const [activeCallsCount, setActiveCallsCount] = useState(0);
  const [avgHoldTime, setAvgHoldTime] = useState(0); // seconds
  const [serviceLevel, setServiceLevel] = useState(100.0); // percentage

  const [agentsState, setAgentsState] = useState({});
  const [eventLogs, setEventLogs] = useState([]);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchInitialData();
    checkAccess();
  }, []);

  // Poll active stats every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveCalls();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real wallboard data from endpoints
  useEffect(() => {
    const fetchWallboardData = async () => {
      try {
        const [wbRes, agentsRes] = await Promise.all([
          fetch(`${API_BASE}/api/reports/wallboard`, { cache: 'no-store' }),
          fetch(`${API_BASE}/api/reports/agents`, { cache: 'no-store' })
        ]);
        
        if (wbRes.ok) {
          const wbData = await wbRes.json();
          setQueueCount(wbData.queueCount || 0);
          setAiResolvedCount(wbData.aiResolvedCount || 0);
          setActiveCallsCount(wbData.activeCallsCount || 0);
          setAvgHoldTime(wbData.avgHoldTime || 0);
          setServiceLevel(wbData.serviceLevel ?? 100.0);
          if (Array.isArray(wbData.recentLogs) && wbData.recentLogs.length > 0) {
            setEventLogs(wbData.recentLogs);
          }
        }
        
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgentsState(agentsData);
        }
      } catch (err) {
        console.error("Failed to fetch wallboard data:", err);
      }
    };

    fetchWallboardData();
    const interval = setInterval(fetchWallboardData, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (time, type, text) => {
    setEventLogs(prev => [
      { id: Date.now() + Math.random(), time, type, text },
      ...prev.slice(0, 7) // Keep recent 8 logs
    ]);
  };

  const checkAccess = async () => {
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`, { cache: 'no-store' });
      const statusData = await resStatus.json();
      if (!statusData.is_logged_in) {
        setAuthorized(true); // Allow guest/admin by default
        return;
      }
      
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const usersData = await resUsers.json();
      const currentUser = usersData.find(u => u.id === statusData.user_id);
      if (!currentUser) {
        setAuthorized(true);
        return;
      }

      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const rolesData = await resRoles.json();
      const currentRole = rolesData.find(r => r.role_code === currentUser.role);
      if (!currentRole) {
        setAuthorized(true);
        return;
      }

      const hasAccess = currentRole.permissions.includes("wallboard:access");
      setAuthorized(hasAccess);
    } catch (err) {
      console.error("Wallboard access check failed:", err);
      setAuthorized(true);
    }
  };

  const fetchInitialData = async () => {
    try {
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const usersData = await resUsers.json();
      setUsers(Array.isArray(usersData) ? usersData : (usersData?.users || []));

      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const rolesData = await resRoles.json();
      setRoles(Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []));

      const resBreaks = await fetch(`${API_BASE}/api/settings/breaks`);
      const breaksData = await resBreaks.json();
      setBreaks(Array.isArray(breaksData) ? breaksData : (breaksData?.breaks || []));

    } catch (err) {
      console.error("Wallboard initial load failed:", err);
    }
  };

  const fetchActiveCalls = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calls/active`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setActiveCallsCount(data.length);
      }

      // Gerçek Temsilci Durumunu Senkronize Et
      const resStatus = await fetch(`${API_BASE}/api/agent/status`, { cache: 'no-store' });
      const statusData = await resStatus.json();
      
      if (statusData && statusData.user_id) {
        setAgentsState(prev => {
          const updated = { ...prev };
          let realStatus = "Çevrimdışı";
          let breakType = null;
          let breakColor = null;

          if (statusData.is_logged_in) {
            if (statusData.status === "online") {
              realStatus = "Müsait";
            } else if (statusData.status === "break") {
              realStatus = "Molada";
              breakType = statusData.current_break?.name || "Mola";
              breakColor = statusData.current_break?.color || "#f97316";
            }
          }
          
          if (updated[statusData.user_id]?.status !== "Görüşmede" || realStatus === "Molada" || realStatus === "Çevrimdışı") {
            updated[statusData.user_id] = {
                ...updated[statusData.user_id],
                status: realStatus,
                breakType: breakType,
                breakColor: breakColor,
                duration: realStatus === "Molada" || realStatus === "Çevrimdışı" ? 0 : updated[statusData.user_id]?.duration
            };
          }

          return updated;
        });
      }
    } catch (err) {
      console.error("Wallboard active calls poll error:", err);
    }
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLogTypeBadge = (type) => {
    switch (type) {
      case "warning":
        return "bg-rose-50 dark:bg-rose-950/20 text-primary border-rose-200/40";
      case "system":
        return "bg-emerald-50 dark:bg-emerald-950/20 text-primary border-emerald-200/40";
      case "call":
        return "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-200/40";
      default:
        return "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200/40";
    }
  };

  if (!authorized) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
          <div className="h-16 w-16 bg-rose-50 dark:bg-rose-950/20 text-primary rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
            <ShieldAlert size={30} />
          </div>
          <h3 className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider text-sm">YETKİSİZ ERİŞİM</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Bu kullanıcı rolü için **Canlı İzleme Paneli (Wallboard)** modülüne erişim yetkisi bulunmamaktadır. Lütfen yetkilendirme ayarlarınızı kontrol edin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 max-h-[90vh] overflow-y-auto pr-1">
      
      {/* Wallboard Header - Full Width */}
      <div className="p-6 bg-gradient-to-br from-white via-white to-slate-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-violet-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-violet-500/10">
            <Monitor size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">CANLI İZLEME PANELİ</h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest">LIVE</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
              Kuyruk durumlarını, temsilci meşguliyetlerini ve yapay zeka başarı metriklerini anlık takip edin.
            </p>
          </div>
        </div>

      </div>

      {/* Main 2-Column Responsive Dashboard Grid (8 cols / 4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
        
        {/* Left Side: Metrics Grid & Agents Grid (8/12 Columns) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Primary Wallboard Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Card 1: Queue Callers */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SIRADA BEKLEYEN</span>
                <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-primary rounded-xl">
                  <Users size={14} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                {/* Fixed Mono font prevents layout shift */}
                <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono w-8 text-left">{queueCount}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Kişi</span>
              </div>
              {queueCount > 0 && (
                <span className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 animate-pulse" />
              )}
            </div>

            {/* Card 2: AI Resolutions */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">AI BAŞARILI ÇÖZÜM</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-primary rounded-xl">
                  <CheckCircle2 size={14} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                {/* Fixed Mono font prevents layout shift */}
                <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono w-14 text-left">{aiResolvedCount}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Çağrı</span>
              </div>
              <span className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>

            {/* Card 3: Concurrent Active Calls */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">AKTİF GÖRÜŞME</span>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-primary rounded-xl">
                  <PhoneCall size={14} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                {/* Fixed Mono font prevents layout shift */}
                <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono w-8 text-left">{activeCallsCount}</span>
                <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase">Kanal / 10</span>
              </div>
              <span className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>

            {/* Card 4: Service Level & Wait Time */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SERVİS SEVİYESİ</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 text-primary rounded-xl">
                  <Clock size={14} />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 justify-between">
                {/* Fixed Mono font prevents layout shift */}
                <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono w-16 text-left">{serviceLevel}%</span>
                <span className="text-[8px] font-extrabold text-slate-450 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/50 px-1 py-0.5 rounded border border-slate-100 dark:border-slate-850/60 shrink-0">
                  {avgHoldTime}s
                </span>
              </div>
              <span className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            </div>

          </div>

          {/* Temsilci Meşguliyet Durumları Grid */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Volume2 size={15} className="text-violet-500" />
                <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">Temsilci Meşguliyet Durumları</h4>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                Kayıtlı: {users.length}
              </span>
            </div>

            {users.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-505 italic">Temsilci bulunamadı.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((u) => {
                  const state = agentsState[u.id] || { status: "Çevrimdışı", duration: 0 };
                  
                  let statusBorder = "border-slate-200/70 dark:border-slate-800/80";
                  let dotColor = "bg-slate-400";
                  let radarPulse = null;
                  let detailsText = `Dahili: ${u.extension}`;

                  if (state.status === "Müsait") {
                    statusBorder = "border-emerald-200/80 dark:border-emerald-900/30";
                    dotColor = "bg-primary";
                    radarPulse = "bg-emerald-450 animate-ping";
                  } else if (state.status === "Görüşmede") {
                    statusBorder = "border-indigo-200/80 dark:border-indigo-900/30";
                    dotColor = "bg-primary";
                    radarPulse = "bg-primary animate-ping";
                    detailsText = `${state.caller || "Gizli"} (${formatSeconds(state.duration)})`;
                  } else if (state.status === "Molada") {
                    statusBorder = "border-orange-200/80 dark:border-orange-900/30";
                    dotColor = "bg-orange-500";
                    detailsText = `${state.breakType || "Mola"}`;
                  }

                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 bg-slate-50/50 dark:bg-slate-950/20 border rounded-2xl flex items-center justify-between gap-3 shadow-inner ${statusBorder}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="relative shrink-0">
                          <img
                            src={u.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                            alt={u.full_name}
                            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/40"
                          />
                          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100/50">
                            <span className="relative flex h-2.5 w-2.5">
                              {radarPulse && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${radarPulse}`}></span>}
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
                            </span>
                          </span>
                        </div>

                        <div className="truncate">
                          <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">{u.full_name}</p>
                          <p className="text-[9px] font-bold text-slate-450 dark:text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            {state.status === "Molada" && (
                              <span
                                style={{ backgroundColor: state.breakColor || "#f97316" }}
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                              />
                            )}
                            {detailsText}
                          </p>
                        </div>
                      </div>

                      <span className={`px-1.5 py-0.5 rounded-lg border text-[8px] font-extrabold uppercase shrink-0 ${
                        state.status === "Müsait" 
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100"
                          : state.status === "Görüşmede"
                            ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100"
                            : state.status === "Molada"
                              ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-455 border-orange-100"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200"
                      }`}>
                        {state.status.slice(0, 7)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Animated Waveform Section */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Activity size={15} className="text-violet-500" />
              <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">Canlı Santral Trafik Akışı</h4>
            </div>
            <div className="h-24 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-900 flex items-center justify-center overflow-hidden relative">
              <svg className="w-full h-full text-violet-500/10 dark:text-violet-500/5" viewBox="0 0 400 100" preserveAspectRatio="none">
                <path d="M 0 50 C 50 30, 80 70, 120 40 C 160 10, 200 90, 250 50 C 300 10, 350 70, 400 50 L 400 100 L 0 100 Z" fill="currentColor" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-around px-8">
                {[...Array(24)].map((_, i) => {
                  const height = 10 + Math.floor(Math.random() * 45);
                  const delay = i * 0.05;
                  return (
                    <div
                      key={i}
                      style={{
                        height: `${height}px`,
                        animationDelay: `${delay}s`,
                        animationDuration: `${1.2 + Math.random()}s`
                      }}
                      className="w-1 bg-gradient-to-t from-violet-600 to-pink-500 rounded-full animate-bounce shrink-0"
                    />
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Operational Log Feeds & Queue Alerts (4/12 Columns) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* SLA Alerts & Target Panel */}
          <div className="p-6 bg-gradient-to-tr from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850/60 pb-3">
              <ShieldCheck size={16} className="text-violet-500" />
              <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">Hedef & Eşik Durumu</h4>
            </div>

            <div className="space-y-3">
              {/* SLA Target Item */}
              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">SLA HEDEFİ</span>
                <span className="text-[10px] font-extrabold text-slate-800 dark:text-white">%90 Hedef (Kritik %80)</span>
              </div>

              {/* Waiting Duration Threshold */}
              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">EŞİK SÜRESİ</span>
                <span className="text-[10px] font-extrabold text-slate-800 dark:text-white">Maks: 30 Saniye</span>
              </div>

              {/* Queue Status Alert Banner */}
              {queueCount > 3 ? (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-primary dark:text-rose-455 rounded-xl flex items-center gap-2 animate-pulse">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-[10px] font-bold">Kritik Yoğunluk! Sırada bekleyen {queueCount} kişi var.</span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 text-primary dark:text-emerald-450 rounded-xl flex items-center gap-2">
                  <ShieldCheck size={14} className="shrink-0" />
                  <span className="text-[10px] font-bold">Kuyruk durumu normal, hat meşguliyeti dengeli.</span>
                </div>
              )}
            </div>
          </div>

          {/* Operational Log Feed Panel */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Monitor size={15} className="text-violet-500" />
                <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">Çağrı Olay Günlüğü</h4>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            </div>

            {/* Scrollable logs stream */}
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {eventLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-850/60 rounded-2xl space-y-1.5 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-black font-mono text-slate-400 uppercase">{log.time}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[7px] font-extrabold uppercase ${getLogTypeBadge(log.type)}`}>
                      {log.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 dark:text-slate-350 leading-relaxed font-semibold">
                    {log.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
