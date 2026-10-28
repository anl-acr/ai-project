import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LogIn, LogOut, Coffee, ShieldAlert, UserCheck, Play, ChevronDown, ChevronUp, User, Clock, CheckCircle2, Tag, AlertTriangle, X } from "lucide-react";
import { webphoneManager } from "../../utils/webphoneManager";
import { useTheme } from "../../utils/theme";

const DEFAULT_DISPOSITIONS = [
  "Satış Yapıldı",
  "Bilgi Verildi",
  "Tekrar Aranacak",
  "Teknik Destek",
  "İptal / Şikayet"
];

export default function AgentSessionCard({ backendHost = "localhost:8000", currentUser, activeCallId = null, compact = false }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [agentState, setAgentState] = useState({
    is_logged_in: false,
    status: "offline",
    current_break: null,
    user_id: null
  });

  const [breaks, setBreaks] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [queues, setQueues] = useState([]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveBreakSeconds, setLiveBreakSeconds] = useState(0);
  const [breakError, setBreakError] = useState("");

  // ACW & Disposition states
  const [acwRemaining, setAcwRemaining] = useState(0);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [dispositionSaved, setDispositionSaved] = useState(false);
  const [lastEndedCallId, setLastEndedCallId] = useState(null);
  const prevCallStatusRef = useRef("Idle");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchAgentStatus();
    fetchUsersAndRolesAndBreaks();
    const interval = setInterval(fetchAgentStatus, 5000);
    const onStatusUpdated = () => fetchAgentStatus();
    window.addEventListener("AGENT_STATUS_UPDATED", onStatusUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("AGENT_STATUS_UPDATED", onStatusUpdated);
    };
  }, [currentUser]);

  useEffect(() => {
    if (activeCallId) {
      setLastEndedCallId(activeCallId);
    }
  }, [activeCallId]);

  // Resolve agent's queue ACW duration and Disposition Codes
  const getAgentQueueConfig = () => {
    const ext = String(currentUser?.extension || agentState?.extension || "").trim();
    const uid = String(currentUser?.id || agentState?.user_id || "").trim();
    const safeQueues = Array.isArray(queues) ? queues : [];
    const myQueues = safeQueues.filter((q) => {
      const members = q.queueMembers || q.members || [];
      return members.some((m) => {
        const mExt = typeof m === "object" ? String(m.extension || m.user_id || m.id || "").trim() : String(m).trim();
        return (ext && mExt === ext) || (uid && mExt === uid);
      });
    });

    const targetQueues = myQueues.length > 0 ? myQueues : safeQueues;
    let acwTime = 15;
    const dispSet = new Set();

    targetQueues.forEach((q) => {
      if (typeof q.acw_time === "number" && q.acw_time >= 0) {
        acwTime = q.acw_time;
      }
      if (Array.isArray(q.disposition_codes)) {
        q.disposition_codes.forEach((c) => {
          if (c && String(c).trim()) dispSet.add(String(c).trim());
        });
      }
    });

    return {
      acwTime,
      dispositionCodes: dispSet.size > 0 ? Array.from(dispSet) : DEFAULT_DISPOSITIONS
    };
  };

  // Detect WebPhone call end (InCall -> Idle) to automatically enter ACW
  useEffect(() => {
    const unsub = webphoneManager.subscribe((wpState) => {
      const currStatus = wpState?.callStatus || "Idle";
      if (prevCallStatusRef.current === "InCall" && currStatus === "Idle") {
        const { acwTime } = getAgentQueueConfig();
        if (acwTime > 0) {
          setAcwRemaining(acwTime);
          setSelectedDisposition("");
          setDispositionSaved(false);
          updateStateOnBackend({
            is_logged_in: true,
            status: "acw",
            current_break: null,
            user_id: currentUser?.id || agentState?.user_id,
            extension: currentUser?.extension || agentState?.extension
          });
        }
      }
      prevCallStatusRef.current = currStatus;
    });
    return () => unsub();
  }, [currentUser, queues, agentState?.user_id, agentState?.extension]);

  // ACW countdown timer
  useEffect(() => {
    if (agentState?.status !== "acw") {
      return;
    }
    if (acwRemaining <= 0) {
      const { acwTime } = getAgentQueueConfig();
      setAcwRemaining(acwTime > 0 ? acwTime : 15);
      return;
    }
    const timer = setInterval(() => {
      setAcwRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleEndBreak();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [agentState?.status, acwRemaining]);

  // 1-second live timer when logged in (online, break, or acw)
  useEffect(() => {
    if (!agentState?.is_logged_in || !["break", "online", "acw"].includes(agentState?.status)) {
      setLiveBreakSeconds(0);
      return;
    }
    const calcElapsed = () => {
      const startIso =
        agentState?.status === "break"
          ? agentState?.break_start_utc || agentState?.current_break?.start_time_utc || agentState?.status_since_utc
          : agentState?.status_since_utc;
      if (startIso) {
        const ms = Date.now() - new Date(startIso).getTime();
        if (!isNaN(ms) && ms >= 0) {
          return Math.floor(ms / 1000);
        }
      }
      return typeof agentState?.elapsed_seconds === "number" ? agentState.elapsed_seconds : 0;
    };
    setLiveBreakSeconds(calcElapsed());
    const timer = setInterval(() => {
      setLiveBreakSeconds((prev) => {
        const fromIso = calcElapsed();
        return fromIso > 0 ? fromIso : prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [agentState]);

  const formatTimer = (sec) => {
    const s = Math.max(0, Number(sec) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const fetchAgentStatus = () => {
    const params = new URLSearchParams();
    if (currentUser?.id) params.set("user_id", String(currentUser.id));
    if (currentUser?.extension) params.set("extension", String(currentUser.extension));
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`${API_BASE}/api/agent/status${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setAgentState(data.agent_state || data.state || data);
        }
      })
      .catch((err) => console.error("Temsilci durumu alınamadı:", err));
  };

  const fetchUsersAndRolesAndBreaks = async () => {
    try {
      const [resUsers, resRoles, resBreaks, resQueues] = await Promise.all([
        fetch(`${API_BASE}/api/settings/users`),
        fetch(`${API_BASE}/api/settings/roles`),
        fetch(`${API_BASE}/api/settings/breaks`),
        fetch(`${API_BASE}/api/settings/queues`)
      ]);
      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsers(Array.isArray(dataUsers) ? dataUsers : (dataUsers?.users || []));
      }
      if (resRoles.ok) {
        const dataRoles = await resRoles.json();
        setRoles(Array.isArray(dataRoles) ? dataRoles : (dataRoles?.roles || []));
      }
      if (resBreaks.ok) {
        const dataBreaks = await resBreaks.json();
        setBreaks(Array.isArray(dataBreaks) ? dataBreaks : (dataBreaks?.breaks || []));
      }
      if (resQueues.ok) {
        const dataQueues = await resQueues.json();
        setQueues(Array.isArray(dataQueues) ? dataQueues : (dataQueues?.queues || []));
      }
    } catch (err) {
      console.error("Agent verileri yüklenemedi:", err);
    }
  };

  const updateStateOnBackend = async (newState) => {
    setLoading(true);
    setBreakError("");
    try {
      const payload = {
        ...newState,
        user_id: newState.user_id !== undefined ? newState.user_id : (currentUser?.id || agentState?.user_id),
        extension: currentUser?.extension || newState.extension || ""
      };
      const res = await fetch(`${API_BASE}/api/agent/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const updated = data.agent_state || data.state || payload;
        setAgentState(updated);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("AGENT_STATUS_UPDATED", { detail: updated }));
        }
      } else if (!res.ok) {
        setBreakError(data?.detail || "Durum değiştirilemedi (kota/limit dolu olabilir).");
      }
    } catch (err) {
      console.error("Agent durumu güncellenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDisposition = async (code) => {
    setSelectedDisposition(code);
    const targetCallId = activeCallId || lastEndedCallId;
    if (targetCallId) {
      try {
        await fetch(`${API_BASE}/api/calls/${targetCallId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: code,
            notes: `Çağrı Sonuç Kodu (Disposition): ${code}`
          })
        });
      } catch (e) {
        console.error("Disposition kaydedilemedi:", e);
      }
    }
    setDispositionSaved(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("CALL_DISPOSITION_SELECTED", { detail: { code, callId: targetCallId } }));
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeRoles = Array.isArray(roles) ? roles : [];
  const safeBreaks = Array.isArray(breaks) ? breaks : [];

  const effectiveUserId = currentUser?.id || agentState?.user_id;

  const handleLogin = () => {
    if (!currentUser) return;
    const newState = {
      is_logged_in: true,
      status: "online",
      current_break: null,
      user_id: currentUser.id,
      extension: currentUser.extension
    };
    updateStateOnBackend(newState);
  };

  const handleLogout = () => {
    const newState = {
      is_logged_in: false,
      status: "offline",
      current_break: null,
      user_id: effectiveUserId,
      extension: currentUser?.extension
    };
    updateStateOnBackend(newState);
    setShowDropdown(false);
  };

  const handleSelectBreak = (breakItem) => {
    const newState = {
      is_logged_in: true,
      status: "break",
      current_break: breakItem,
      user_id: effectiveUserId,
      extension: currentUser?.extension
    };
    updateStateOnBackend(newState);
    setShowDropdown(false);
  };

  const handleEndBreak = () => {
    setAcwRemaining(0);
    const newState = {
      is_logged_in: true,
      status: "online",
      current_break: null,
      user_id: effectiveUserId,
      extension: currentUser?.extension
    };
    updateStateOnBackend(newState);
  };

  // Find currently logged in user profile
  const loggedInUser = safeUsers.find(u => String(u.id) === String(effectiveUserId) || (currentUser?.extension && String(u.extension) === String(currentUser.extension))) || currentUser;
  const loggedInUserRoleObj = loggedInUser ? safeRoles.find(r => r.role_code === loggedInUser.role) : null;

  // Filter breaks allowed for this user's role (fallback to all breaks if role has no restriction or is admin)
  const allowedBreakIds = loggedInUserRoleObj ? loggedInUserRoleObj.allowed_breaks || [] : [];
  const roleFiltered = safeBreaks.filter(b => allowedBreakIds.includes(b.id));
  const filteredBreaks = roleFiltered.length > 0 ? roleFiltered : safeBreaks;

  // Check if current break exceeded max_duration_minutes
  const activeBreakMaxMin = Number(agentState?.current_break?.max_duration_minutes || 0);
  const isBreakOvertime = agentState?.status === "break" && activeBreakMaxMin > 0 && liveBreakSeconds > activeBreakMaxMin * 60;

  const { dispositionCodes } = getAgentQueueConfig();

  const isCurrentBreakAuto =
    agentState?.status === "break" &&
    (Boolean(agentState?.current_break?.is_auto_break) ||
      String(agentState?.current_break?.name || "").toLowerCase().startsWith("otomatik mola") ||
      String(agentState?.current_break?.name || "").toLowerCase().includes("çağrı kaçırma") ||
      String(agentState?.current_break?.name || "").toLowerCase().includes("bağlantı koptu"));

  // Status style helper
  const getStatusDisplay = () => {
    if (!agentState?.is_logged_in) {
      return {
        text: "Çevrimdışı (Giriş Yapılmadı)",
        badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50",
        indicatorClass: "bg-slate-400"
      };
    }
    if (agentState?.status === "online") {
      return {
        text: `Müsait (Çağrı Alabilir) • ${formatTimer(liveBreakSeconds)}`,
        badgeClass: "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30",
        indicatorClass: "bg-primary animate-pulse"
      };
    }
    if (agentState?.status === "acw") {
      return {
        text: `ACW (Çağrı Sonrası İşlem) • ${formatTimer(acwRemaining || liveBreakSeconds)}`,
        badgeClass: `${lightBg} ${text} ${borderLight}`,
        indicatorClass: `${bg} animate-pulse`
      };
    }
    if (agentState?.status === "break" && agentState?.current_break) {
      if (isCurrentBreakAuto) {
        return {
          text: `${agentState.current_break.name} • ${formatTimer(liveBreakSeconds)}`,
          badgeClass: "bg-slate-800 text-white dark:bg-slate-700 border-slate-600",
          indicatorClass: "bg-white animate-pulse",
          customColor: "#ffffff"
        };
      }
      return {
        text: `Molada (${agentState.current_break.name}) • ${formatTimer(liveBreakSeconds)}`,
        badgeClass: isBreakOvertime
          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse"
          : "bg-amber-50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
        indicatorClass: "bg-primary animate-pulse",
        customColor: agentState.current_break.color
      };
    }
    return {
      text: "Bilinmeyen Durum",
      badgeClass: "bg-slate-100 text-slate-600",
      indicatorClass: "bg-slate-400"
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      className={`${
        compact
          ? "p-3.5 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl"
          : "p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm"
      } transition-all duration-300`}
    >
      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3 flex flex-col gap-2">
        <div className={`flex ${compact ? "flex-col items-start gap-1.5" : "items-center justify-between"}`}>
          <h4 className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Temsilci Oturumu
          </h4>
          
          {/* Status Indicator Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${statusDisplay.badgeClass}`}>
            <span 
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDisplay.customColor ? "" : statusDisplay.indicatorClass}`} 
              style={statusDisplay.customColor ? { backgroundColor: statusDisplay.customColor } : {}}
            />
            <span className="truncate">{statusDisplay.text}</span>
          </span>
        </div>

        {/* Logged In User Profile Summary */}
        {agentState.is_logged_in && loggedInUser && (
          <div className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-xl mt-0.5">
            <img src={loggedInUser.avatar} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/20 shrink-0" alt="" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-800 dark:text-white leading-tight truncate">{loggedInUser.full_name}</p>
              <p className="text-[8px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate">
                Dahili: {loggedInUser.extension} • {loggedInUserRoleObj ? loggedInUserRoleObj.name : loggedInUser.role}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Automatic Break (RONA / Disconnect) Anthracite Warning Banner */}
      {isCurrentBreakAuto && (
        <div className="mb-3 p-3 rounded-xl bg-slate-800 text-white border border-slate-600 flex items-start gap-2.5 text-[11px] font-semibold shadow-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1">
            <div className="font-extrabold">Otomatik Mola Aktif ({agentState?.current_break?.name})</div>
            <div className="text-[10px] text-slate-300 mt-0.5">
              Çağrı kaçırma veya bağlantı kopması nedeniyle sistem sizi otomatik molaya aldı. Çağrı alabilmek için &quot;Molayı Bitir&quot; butonuna tıklayın.
            </div>
          </div>
        </div>
      )}

      {/* Break Quota / Concurrent Limit Warning Banner */}
      {breakError && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-600 dark:text-rose-400 text-[11px] font-semibold">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">{breakError}</div>
          <button onClick={() => setBreakError("")} className="text-[10px] font-bold underline">Kapat</button>
        </div>
      )}

      {/* Break Overtime Warning Banner */}
      {isBreakOvertime && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-amber-700 dark:text-amber-300 text-[11px] font-bold animate-pulse">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Mola süre sınırını ({activeBreakMaxMin} dk) aştınız! Lütfen oturuma dönün.</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-xs text-slate-500">Güncelleniyor...</div>
      ) : (
        <div className="space-y-3 relative">
          
          {/* OFFLINE: User select and Login Button */}
          {!agentState.is_logged_in && (
            <div className="space-y-2.5">
              <button
                onClick={handleLogin}
                disabled={!currentUser || loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/10"
              >
                <LogIn size={15} />
                <span>Sistem Girişi Yap</span>
              </button>
            </div>
          )}

          {/* ACW MODE: Countdown + Quick Disposition Selector + Finish ACW Button */}
          {agentState.is_logged_in && agentState.status === "acw" && (
            <div className={`p-3.5 rounded-xl border ${borderLight} ${lightBg} space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className={text} />
                  <span className={`text-xs font-extrabold ${text}`}>Çağrı Sonrası İşlem (ACW)</span>
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono ${bg} text-white`}>
                  {formatTimer(acwRemaining)}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Tag size={11} /> Çağrı Sonuç Kodu Seçin:
                  </span>
                  {dispositionSaved && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Kaydedildi
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dispositionCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleSaveDisposition(code)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        selectedDisposition === code
                          ? `${bg} text-white ${border} shadow-sm`
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleEndBreak}
                className={`w-full flex items-center justify-center gap-2 py-2.5 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm`}
              >
                <Play size={14} />
                <span>Hazırım (ACW Bitir & Müsait Ol)</span>
              </button>
            </div>
          )}

          {/* ONLINE/BREAK: Interactive Buttons */}
          {agentState.is_logged_in && agentState.status !== "acw" && (
            <div className="space-y-2">
              
              {agentState.status === "break" ? (
                /* IN BREAK: End Break Button */
                <button
                  onClick={handleEndBreak}
                  className={`w-full flex items-center justify-center gap-2 py-3 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer`}
                >
                  <Play size={15} />
                  <span>Molayı Bitir ({formatTimer(liveBreakSeconds)})</span>
                </button>
              ) : (
                /* ONLINE: Break Options Modal Trigger */
                <button
                  onClick={() => setShowDropdown(true)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer`}
                >
                  <div className="flex items-center gap-2">
                    <Coffee size={15} />
                    <span>Mola Durumları</span>
                  </div>
                  <ChevronDown size={15} />
                </button>
              )}

              {/* Mola Toggle Helper for break state */}
              {agentState.status === "break" && (
                <button
                  onClick={() => setShowDropdown(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Coffee size={13} className={text} />
                    Mola Değiştir / Oturumu Kapat
                  </span>
                  <ChevronDown size={13} />
                </button>
              )}

              {/* Break Status & Session Popup Modal (Portal) */}
              {showDropdown && typeof document !== "undefined" && createPortal(
                <div
                  className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
                  onClick={() => setShowDropdown(false)}
                >
                  <div
                    className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${lightBg} ${text} border ${borderLight}`}>
                          <Coffee size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Mola Durumları & Oturum
                          </h3>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {agentState.status === "break" && agentState?.current_break
                              ? `Aktif Mola: ${agentState.current_break.name} (${formatTimer(liveBreakSeconds)})`
                              : `Durum: Müsait • ${formatTimer(liveBreakSeconds)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDropdown(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Kapat"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-5 overflow-y-auto space-y-4">
                      {/* Full-width red Logout Button above break options */}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                      >
                        <LogOut size={16} />
                        <span>Oturumu Kapat (Logout)</span>
                      </button>

                      {/* If currently on break, show quick Resume button */}
                      {agentState.status === "break" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            handleEndBreak();
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${bg} ${hover} text-white text-xs font-bold shadow-md transition-all cursor-pointer`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Play size={15} />
                            <span>Molayı Bitir ve Müsait Duruma Geç</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-mono">
                            {formatTimer(liveBreakSeconds)}
                          </span>
                        </button>
                      )}

                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2.5 pt-2">
                          <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Mola Türü Seçin ({filteredBreaks.length})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Tıklayarak molaya ayrılabilirsiniz
                          </span>
                        </div>

                        {filteredBreaks.length === 0 ? (
                          <div className="text-xs text-slate-450 text-center py-6 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 italic">
                            Bu role izin verilen mola bulunmamaktadır.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {filteredBreaks.map((b) => {
                              const isCurrent = agentState.status === "break" && String(agentState?.current_break?.id) === String(b.id);
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => handleSelectBreak(b)}
                                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                    isCurrent
                                      ? `${lightBg} ${border} ring-1 ring-current`
                                      : "bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className="h-3 w-3 rounded-full shrink-0 shadow-sm ring-2 ring-white dark:ring-slate-900"
                                      style={{ backgroundColor: b.color || "#f59e0b" }}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                        {b.name}
                                      </div>
                                      {Number(b.max_duration_minutes) > 0 ? (
                                        <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                                          <Clock size={10} /> Maks {b.max_duration_minutes} dk
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          Süre sınırı yok
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isCurrent && (
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${bg} text-white shrink-0`}>
                                      Aktif
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDropdown(false)}
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}
