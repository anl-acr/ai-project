import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  User, 
  Volume2, 
  PhoneForwarded, 
  Activity, 
  Smile, 
  Meh, 
  Frown, 
  Cpu, 
  Layers, 
  Wifi, 
  ShieldAlert,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Headphones,
  Mic,
  PhoneCall,
  Sliders,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Calendar,
  AlarmClock,
  Users,
  Database,
  AlertTriangle,
  RotateCcw,
  X
} from "lucide-react";
import AddContactModal from "./AddContactModal";
import { useTheme } from "../../utils/theme";

const DASHBOARD_WIDGET_CATALOG = [
  {
    id: "crisis_radar",
    label: "Canlı Kriz & Negatif Duygu Alarm Radarı",
    description: "Aktif çağrılarda gerginlik veya şikayet algılandığında tek tıkla dinleme/sufle/devralma kartı.",
  },
  {
    id: "kpi_metrics",
    label: "Anlık Kanal & Sunucu Performans Kartları",
    description: "Aktif görüşme sayısı, AI CPU yükü, RAM kullanımı ve açık WebSocket kanalları.",
  },
  {
    id: "active_calls_console",
    label: "Canlı Arama Listesi & Gerçek Zamanlı Konsol",
    description: "Aktif aramalar, canlı akan konuşma dökümü, AI sufle kutusu ve temsilci notları.",
  },
  {
    id: "ops_queues_appointments",
    label: "Kuyruk Özeti, Bugünkü Randevular & Geri Aramalar",
    description: "Aktif ACD kuyruk dağılımı, bugünkü randevular ve bekleyen geri arama görevleri.",
  },
  {
    id: "ai_budget_top_callers",
    label: "AI Maliyet Özeti & Bugün En Çok Arayanlar",
    description: "Yapay zeka sağlayıcı kredi tüketimi ve gün içi en yoğun arayan numaralar.",
  },
];

const DEFAULT_WIDGET_ORDER = DASHBOARD_WIDGET_CATALOG.map((w) => w.id);

export default function LiveDashboardPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [activeCalls, setActiveCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [loadingSpy, setLoadingSpy] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [agentTopic, setAgentTopic] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  const [whisperText, setWhisperText] = useState("");
  const [sendingWhisper, setSendingWhisper] = useState(false);
  const [hasWhisperPermission, setHasWhisperPermission] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Granular Call Monitoring Permissions & User Extension
  const [currentUserExt, setCurrentUserExt] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [monitorPerms, setMonitorPerms] = useState({
    listen: true,
    whisper: true,
    barge: true
  });
  const [openMenuCallId, setOpenMenuCallId] = useState(null);
  const panelRef = useRef(null);
  const whisperInputRef = useRef(null);

  // Real-time system metrics
  const [metrics, setMetrics] = useState({
    cpu: 18,
    ram: 42,
    activeWs: 0
  });

  // Customizable Dashboard Widgets & Live Crisis Radar State
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState([]);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [crisisAlerts, setCrisisAlerts] = useState([]);
  const [widgetsSummary, setWidgetsSummary] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);

  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  // Load saved per-user widget layout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid =
      currentUserId ||
      sessionStorage.getItem("current_user_id") ||
      localStorage.getItem("current_user_id") ||
      "default";
    try {
      const raw = localStorage.getItem(`aida_dashboard_widgets_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order) && parsed.order.length > 0) {
          const valid = parsed.order.filter((id) => DEFAULT_WIDGET_ORDER.includes(id));
          for (const defId of DEFAULT_WIDGET_ORDER) {
            if (!valid.includes(defId)) valid.push(defId);
          }
          setWidgetOrder(valid);
        }
        if (Array.isArray(parsed.hidden)) {
          setHiddenWidgets(parsed.hidden.filter((id) => DEFAULT_WIDGET_ORDER.includes(id)));
        }
      }
    } catch (e) {}
  }, [currentUserId]);

  const persistWidgetLayout = (nextOrder, nextHidden) => {
    setWidgetOrder(nextOrder);
    setHiddenWidgets(nextHidden);
    if (typeof window === "undefined") return;
    const uid =
      currentUserId ||
      sessionStorage.getItem("current_user_id") ||
      localStorage.getItem("current_user_id") ||
      "default";
    try {
      localStorage.setItem(
        `aida_dashboard_widgets_${uid}`,
        JSON.stringify({ order: nextOrder, hidden: nextHidden })
      );
      if (uid && uid !== "default") {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        fetch(`${protocol}//${backendHost}/api/agent/profile/${encodeURIComponent(uid)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_panel_prefs: {
              dashboardWidgets: { order: nextOrder, hidden: nextHidden },
            },
          }),
        }).catch(() => {});
      }
    } catch (e) {}
  };

  // Poll live crisis alerts & customizable widget summary (paused when tab is hidden)
  useEffect(() => {
    const fetchCrisisAndSummary = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const tenantId =
        (typeof window !== "undefined" && localStorage.getItem("selected_tenant_id")) ||
        "tenant-default";
      const headers = {
        "X-Tenant-ID": tenantId,
        "X-User-ID": currentUserId || "admin",
      };
      try {
        const [crRes, sumRes, budRes] = await Promise.all([
          fetch(`${protocol}//${backendHost}/api/workspace/crisis-alerts`, { headers }).catch(() => null),
          fetch(`${protocol}//${backendHost}/api/workspace/dashboard-widgets-summary`, { headers }).catch(() => null),
          fetch(`${protocol}//${backendHost}/api/settings/api-budgets`, { headers }).catch(() => null),
        ]);
        if (crRes && crRes.ok) {
          const crData = await crRes.json();
          setCrisisAlerts(Array.isArray(crData.alerts) ? crData.alerts : []);
        }
        if (sumRes && sumRes.ok) {
          const sumData = await sumRes.json();
          setWidgetsSummary(sumData);
        }
        if (budRes && budRes.ok) {
          const budData = await budRes.json();
          setBudgetSummary(budData);
        }
      } catch (e) {}
    };

    fetchCrisisAndSummary();
    const timer = setInterval(fetchCrisisAndSummary, 8000);
    return () => clearInterval(timer);
  }, [backendHost, currentUserId]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpenMenuCallId(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Poll active calls from the Asterisk/FastAPI backend
  useEffect(() => {
    const fetchActiveCalls = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      fetch(`${protocol}//${backendHost}/api/calls/active`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setActiveCalls(data);
            
            // If the currently selected call is no longer active, deselect it
            if (selectedCall && !data.some(c => c.id === selectedCall.id)) {
              setSelectedCall(null);
              setTranscripts([]);
              if (wsRef.current) wsRef.current.close();
            }
          }
        })
        .catch((err) => console.error("Aktif aramalar alinamadi:", err));
    };

    fetchActiveCalls();
    const interval = setInterval(fetchActiveCalls, 2000);
    return () => clearInterval(interval);
  }, [backendHost, selectedCall]);

  // Fetch real system resource metrics
  useEffect(() => {
    const fetchStats = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const res = await fetch(`${protocol}//${backendHost}/api/system/stats`);
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            cpu: Math.round(data.cpu_usage || 0),
            ram: Math.round(data.ram_usage || 0),
            activeWs: activeCalls.length * 2 + 1
          });
        }
      } catch (err) {
        console.error("Failed to fetch system stats:", err);
      }
    };
    
    fetchStats();
    const timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, [activeCalls, backendHost]);

  // Check AI Whisperer & Call Monitoring permissions on load
  useEffect(() => {
    const checkWhisperPermission = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const storedUserId = typeof window !== "undefined" ? localStorage.getItem("current_user_id") : null;
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();

        const [resUsers, resRoles] = await Promise.all([
          fetch(`${protocol}//${backendHost}/api/settings/users`),
          fetch(`${protocol}//${backendHost}/api/settings/roles`)
        ]);
        const usersRaw = await resUsers.json();
        const usersData = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.users || []);
        const rolesRaw = await resRoles.json();
        const rolesData = Array.isArray(rolesRaw) ? rolesRaw : (rolesRaw?.roles || []);

        const resolvedUid = storedUserId || (statusData.is_logged_in ? statusData.user_id : "admin");
        setCurrentUserId(String(resolvedUid || "admin"));

        if (String(resolvedUid).toLowerCase() === "admin") {
          setHasWhisperPermission(true);
          setMonitorPerms({ listen: true, whisper: true, barge: true });
          return;
        }

        const currentUser = usersData.find(
          u => String(u.id) === String(resolvedUid) || String(u.extension) === String(resolvedUid)
        );
        if (!currentUser) {
          setHasWhisperPermission(true);
          setMonitorPerms({ listen: true, whisper: true, barge: true });
          return;
        }

        if (currentUser.extension) {
          setCurrentUserExt(String(currentUser.extension));
        }

        const currentRole = rolesData.find(
          r => String(r.role_code || "").toLowerCase() === String(currentUser.role || "").toLowerCase()
        );
        if (!currentRole || String(currentRole.role_code).toLowerCase() === "admin") {
          setHasWhisperPermission(true);
          setMonitorPerms({ listen: true, whisper: true, barge: true });
          return;
        }

        const perms = Array.isArray(currentRole.permissions) ? currentRole.permissions : [];
        const hasLegacyWhisper =
          perms.includes("ai_whisper:access") ||
          perms.includes("ai_whisper:write") ||
          perms.includes("ai_whisper");

        const canListen = perms.includes("call_monitor:listen") || perms.includes("ai_whisper:read") || hasLegacyWhisper;
        const canWhisper = perms.includes("call_monitor:whisper") || hasLegacyWhisper;
        const canBarge = perms.includes("call_monitor:barge") || hasLegacyWhisper;

        setHasWhisperPermission(canWhisper || hasLegacyWhisper);
        setMonitorPerms({
          listen: canListen,
          whisper: canWhisper,
          barge: canBarge
        });
      } catch (err) {
        console.error("Whisper permission check failed:", err);
        setHasWhisperPermission(true);
        setMonitorPerms({ listen: true, whisper: true, barge: true });
      }
    };

    checkWhisperPermission();
  }, [backendHost]);

  const canMonitorAny = monitorPerms.listen || monitorPerms.whisper || monitorPerms.barge;

  const handleSendWhisper = async (e) => {
    e.preventDefault();
    if (!selectedCall || !whisperText.trim()) return;
    setSendingWhisper(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/whisper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: whisperText })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Sufle / Fısıltı AI'a başarıyla iletildi.");
        setWhisperText("");
      } else {
        setErrorMsg(data.detail || "Fısıltı gönderilemedi.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setSendingWhisper(false);
    }
  };

  // Connect to live transcript stream when selectedCall changes
  useEffect(() => {
    if (!selectedCall) {
      setTranscripts([]);
      return;
    }

    setTranscripts([]);
    setWsStatus("connecting");

    // Fetch initial transcripts
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/transcripts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTranscripts(data);
        }
      })
      .catch((err) => console.error("Gecmis transkriptler alinamadi:", err));

    // Connect WebSocket
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendHost}/ws/transcripts/${selectedCall.id}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "transcript") {
          setTranscripts((prev) => [
            ...prev,
            {
              speaker: message.speaker,
              text: message.text,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error("WS transcript error:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [selectedCall, backendHost]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Sync selectedCall agent notes and topic
  useEffect(() => {
    if (selectedCall) {
      setAgentTopic(selectedCall.agent_topic || "");
      setAgentNotes(selectedCall.agent_notes || "");
    } else {
      setAgentTopic("");
      setAgentNotes("");
    }
  }, [selectedCall]);

  const handleSaveNotes = async (e) => {
    e.preventDefault();
    if (!selectedCall) return;
    if (!agentTopic) {
      setErrorMsg("Lütfen önce bir konu seçin.");
      return;
    }
    setSavingNotes(true);
    setNotesSuccess(false);
    setErrorMsg("");
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: agentTopic, notes: agentNotes })
      });
      if (res.ok) {
        setNotesSuccess(true);
        setTimeout(() => setNotesSuccess(false), 3000);
      } else {
        setErrorMsg("Not kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setErrorMsg("Ağ hatası oluştu.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Call Sentiment analysis based on transcripts keywords
  const getCallSentiment = (transcriptList) => {
    let score = 0;
    const positiveWords = ["teşekkür", "harika", "iyi", "evet", "tamam", "sağol", "memnun", "güzel"];
    const negativeWords = ["hata", "şikayet", "kötü", "bekliyorum", "hayır", "iptal", "yanlış", "yok"];

    transcriptList.forEach((t) => {
      const text = t.text.toLowerCase();
      positiveWords.forEach(w => { if (text.includes(w)) score += 1; });
      negativeWords.forEach(w => { if (text.includes(w)) score -= 1; });
    });

    if (score > 0) return { type: "Pozitif", color: "text-emerald-400", bg: "bg-primary/10 border-emerald-500/30", icon: <Smile size={16} /> };
    if (score < 0) return { type: "Negatif / Kızgın", color: "text-rose-400", bg: "bg-primary/10 border-rose-500/30", icon: <Frown size={16} /> };
    return { type: "Nötr", color: "text-slate-400", bg: "bg-slate-800 border-slate-700", icon: <Meh size={16} /> };
  };

  const sentiment = getCallSentiment(transcripts);

  // Trigger ChanSpy (listen / whisper / barge) via user's extension
  const handleChanSpy = async (mode = "listen", callObj = null) => {
    const targetCall = callObj || selectedCall;
    if (!targetCall) return;
    if (callObj && (!selectedCall || selectedCall.id !== callObj.id)) {
      setSelectedCall(callObj);
    }
    setOpenMenuCallId(null);
    setLoadingSpy(true);
    setErrorMsg("");
    setSuccessMsg("");

    const modeLabels = {
      barge: "Araya Girme (Barge-In)",
      whisper: "Sufle Verme (Whisper)",
      listen: "Fısıldama / Sessiz Dinleme"
    };
    const modeTitle = modeLabels[mode] || "Canlı Dinleme";

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${encodeURIComponent(targetCall.id)}/spy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": currentUserId || localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          mode,
          agent_ext: currentUserExt || undefined,
          target_ext: targetCall.callee_number || undefined,
          caller_number: targetCall.caller_number || undefined,
          user_id: currentUserId || localStorage.getItem("current_user_id") || "admin"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`${modeTitle} başlatıldı! Web Telefon veya masa telefonunuz otomatik olarak çağrıya bağlanıyor.`);
        if (mode === "whisper" && whisperInputRef.current) {
          setTimeout(() => whisperInputRef.current?.focus(), 150);
        }
      } else {
        setErrorMsg(data.detail || `${modeTitle} başlatılamadı.`);
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoadingSpy(false);
    }
  };

  // Redirect/transfer call to representative
  const handleTransfer = async () => {
    if (!selectedCall) return;
    setLoadingTransfer(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/transfer`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Çağrı başarıyla temsilci kuyruğuna (temsilci_kuyrugu) yönlendirildi.");
        setSelectedCall(null);
        setTranscripts([]);
      } else {
        setErrorMsg(data.detail || "Çağrı aktarılamadı.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoadingTransfer(false);
    }
  };

  const toggleWidgetVisibility = (wId) => {
    const isHidden = hiddenWidgets.includes(wId);
    const nextHidden = isHidden
      ? hiddenWidgets.filter((x) => x !== wId)
      : [...hiddenWidgets, wId];
    persistWidgetLayout(widgetOrder, nextHidden);
  };

  const moveWidgetOrder = (idx, dir) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= widgetOrder.length) return;
    const nextOrder = [...widgetOrder];
    const [moved] = nextOrder.splice(idx, 1);
    nextOrder.splice(targetIdx, 0, moved);
    persistWidgetLayout(nextOrder, hiddenWidgets);
  };

  const visibleWidgets = widgetOrder.filter((id) => !hiddenWidgets.includes(id));

  const renderCrisisRadarWidget = () => {
    if (crisisAlerts.length === 0) return null;
    return (
      <div
        key="crisis_radar"
        className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/30 border-2 border-rose-500/70 shadow-sm space-y-3 animate-in fade-in duration-200"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h4 className="text-xs font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                Canlı Kriz / Negatif Duygu Alarm Radarı ({crisisAlerts.length} Aktif Çağrı)
              </h4>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium">
                Müşteri ses tonunda veya ifadelerinde gerginlik/şikayet saptandı. Tek tıkla müdahale edebilirsiniz.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {crisisAlerts.map((al) => {
            const matchedActive = activeCalls.find((c) => c.id === al.call_id) || {
              id: al.call_id,
              caller_number: al.caller_number,
              caller_name: al.caller_name,
              callee_number: al.callee_number,
            };
            return (
              <div
                key={al.call_id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 flex flex-col justify-between gap-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                      <span>
                        {al.caller_name
                          ? `${al.caller_name} (${al.caller_number})`
                          : al.caller_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase">
                        {al.severity === "critical" ? "Kritik Kriz" : "Gerginlik"}
                      </span>
                    </div>
                    {al.latest_customer_text && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-1 line-clamp-2">
                        &ldquo;{al.latest_customer_text}&rdquo;
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCall(matchedActive)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${lightBg} ${text} ${borderLight} shrink-0 cursor-pointer`}
                  >
                    Konsolda Aç
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {monitorPerms.listen && (
                    <button
                      type="button"
                      disabled={loadingSpy}
                      onClick={() => handleChanSpy("listen", matchedActive)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <Headphones size={11} />
                      <span>Dinle</span>
                    </button>
                  )}
                  {monitorPerms.whisper && (
                    <button
                      type="button"
                      disabled={loadingSpy}
                      onClick={() => handleChanSpy("whisper", matchedActive)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <Mic size={11} />
                      <span>Sufle Ver</span>
                    </button>
                  )}
                  {monitorPerms.barge && (
                    <button
                      type="button"
                      disabled={loadingSpy}
                      onClick={() => handleChanSpy("barge", matchedActive)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <PhoneCall size={11} />
                      <span>Araya Gir</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("OPEN_CUSTOMER_360", {
                          detail: { phone: al.caller_number, name: al.caller_name },
                        })
                      )
                    }
                    className="ml-auto px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    360° Kart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={panelRef} className="w-full h-full flex flex-col gap-5">
      {/* Top Personalization Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {widgetsSummary?.today_stats && (
            <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
              <span>
                Bugün: <strong className="text-slate-900 dark:text-white">{widgetsSummary.today_stats.total_calls}</strong> çağrı
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Yanıt Oranı: <strong className="text-emerald-600 dark:text-emerald-400">%{widgetsSummary.today_stats.answered_rate}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                AI Karşılama: <strong className={text}>{widgetsSummary.today_stats.ai_handled_calls}</strong>
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCustomizeModal(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-sm transition cursor-pointer"
        >
          <Sliders size={13} className={text} />
          <span>Panoyu Özelleştir ({visibleWidgets.length}/{DEFAULT_WIDGET_ORDER.length})</span>
        </button>
      </div>

      {visibleWidgets.map((wId) => {
        if (wId === "crisis_radar") {
          return renderCrisisRadarWidget();
        }

        if (wId === "kpi_metrics") {
          return (
            <div key="kpi_metrics" className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Active Calls Stat */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl flex items-center justify-between shadow-sm transition-colors duration-300">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Aktif Görüşmeler</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white flex items-center gap-2">
                    {activeCalls.length}
                    {activeCalls.length > 0 && (
                      <span className="h-2 w-2 rounded-full bg-primary dark:bg-emerald-400 animate-ping"></span>
                    )}
                  </h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 flex items-center justify-center text-primary dark:text-purple-400">
                  <Activity size={20} className={activeCalls.length > 0 ? "animate-pulse" : ""} />
                </div>
              </div>

              {/* Live CPU Meter */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Yapay Zeka CPU Yükü</span>
                  <Cpu size={14} className="text-primary dark:text-indigo-400" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-105 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-850">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                      style={{ width: `${metrics.cpu}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{metrics.cpu}%</span>
                </div>
              </div>

              {/* Live RAM Meter */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Bellek (RAM)</span>
                  <Layers size={14} className="text-pink-500 dark:text-pink-400" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-105 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-850">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-1000"
                      style={{ width: `${metrics.ram}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{metrics.ram}%</span>
                </div>
              </div>

              {/* Active Websockets */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl flex items-center justify-between shadow-sm transition-colors duration-300">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">WebSocket Kanalları</p>
                  <h3 className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-200 font-mono">
                    {metrics.activeWs} <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">bağlantı</span>
                  </h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-primary dark:text-emerald-400">
                  <Wifi size={18} />
                </div>
              </div>
            </div>
          );
        }

        if (wId === "ops_queues_appointments") {
          return (
            <div key="ops_queues_appointments" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Queues Card */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className={text} /> ACD Kuyruk Özeti
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {(widgetsSummary?.queues_summary || []).length} Kuyruk
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(widgetsSummary?.queues_summary || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Tanımlı kuyruk bulunmuyor.</p>
                  ) : (
                    widgetsSummary.queues_summary.map((q) => (
                      <div
                        key={q.id || q.extension}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{q.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 ml-1.5">#{q.extension}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text}`}>
                          {q.member_count} Üye
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Today's Appointments Card */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className={text} /> Bugünkü Randevular
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {(widgetsSummary?.today_appointments || []).length} Kayıt
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(widgetsSummary?.today_appointments || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Bugün için kayıtlı randevu yok.</p>
                  ) : (
                    widgetsSummary.today_appointments.map((ap) => (
                      <div
                        key={ap.id}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: { phone: ap.customer_phone, name: ap.customer_name },
                            })
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 transition"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{ap.customer_name}</p>
                          <span className="text-[10px] font-mono text-slate-400">{ap.customer_phone}</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {ap.appointment_time
                            ? new Date(
                                String(ap.appointment_time).endsWith("Z")
                                  ? ap.appointment_time
                                  : `${ap.appointment_time}Z`
                              ).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Upcoming Callbacks Card */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlarmClock size={14} className={text} /> Bekleyen Geri Aramalar
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {widgetsSummary?.pending_callbacks_total || 0} Görev
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(widgetsSummary?.upcoming_callbacks || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Bekleyen geri arama görevi yok.</p>
                  ) : (
                    widgetsSummary.upcoming_callbacks.map((cb) => (
                      <div
                        key={cb.id}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: { phone: cb.customer_phone, name: cb.customer_name },
                            })
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 transition"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {cb.customer_name || cb.customer_phone}
                          </p>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {cb.note || cb.assigned_user_name || ""}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          {cb.scheduled_at
                            ? new Date(
                                String(cb.scheduled_at).endsWith("Z")
                                  ? cb.scheduled_at
                                  : `${cb.scheduled_at}Z`
                              ).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (wId === "ai_budget_top_callers") {
          const providers = budgetSummary && typeof budgetSummary === "object"
            ? Object.entries(budgetSummary).filter(([, val]) => val && typeof val === "object" && "spent_credit" in val).slice(0, 4)
            : [];
          return (
            <div key="ai_budget_top_callers" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={14} className={text} /> AI Bütçe & Kredi Tüketim Özeti
                  </span>
                </div>
                {providers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Bütçe verisi yükleniyor veya tanımlı değil.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {providers.map(([prov, info]) => (
                      <div
                        key={prov}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800"
                      >
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase block">{prov}</span>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                          ${Number(info.spent_credit || 0).toFixed(2)}
                          <span className="text-[10px] text-slate-400 font-normal">
                            {" "}/ ${Number(info.loaded_credit || 0).toFixed(0)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall size={14} className={text} /> Bugün En Çok Arayan Numaralar
                </span>
                <div className="space-y-2">
                  {(widgetsSummary?.top_callers_today || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Bugün henüz çağrı kaydı oluşmadı.</p>
                  ) : (
                    widgetsSummary.top_callers_today.map((tc) => (
                      <div
                        key={tc.caller_number}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: { phone: tc.caller_number },
                            })
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 transition"
                      >
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {tc.caller_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text}`}>
                          {tc.count} Çağrı • 360°
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (wId !== "active_calls_console") return null;

        return (
          /* Main Panel Content Split */
          <div key="active_calls_console" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Active Calls List */}
        <div className="lg:col-span-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl p-4 shadow-sm min-h-[500px] transition-colors duration-300">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
            <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
              Aktif Arama Listesi
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-1.5">Gerçek zamanlı olarak Asterisk kanallarından çekilmektedir.</p>
          </div>

          {activeCalls.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-555">
              <ShieldAlert size={36} className="text-slate-300 dark:text-slate-700 mb-2 animate-bounce" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Aktif Görüşme Bulunmuyor</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-650 mt-1">Telefon hattı boşta. Arama yapıldığında listelenecektir.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {activeCalls.map((call) => {
                const menuKey = `list-${call.id}`;
                const isMenuOpen = openMenuCallId === menuKey;

                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 cursor-pointer relative ${
                      selectedCall?.id === call.id
                        ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 shadow-sm"
                        : "bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-850/65 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-955"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {call.caller_name ? `${call.caller_name} (${call.caller_number})` : call.caller_number}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-755 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200/50 dark:border-purple-900/50">
                          Yapay Zeka
                        </span>

                        {canMonitorAny && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuCallId(isMenuOpen ? null : menuKey);
                              }}
                              title="Dinleme / Müdahale Seçenekleri (Araya Gir - Sufle - Fısılda)"
                              className={`h-6 w-6 rounded-lg border flex items-center justify-center transition-all ${
                                isMenuOpen
                                  ? `${bg} text-white border-transparent shadow-sm`
                                  : `${lightBg} ${text} ${borderLight} hover:opacity-90`
                              }`}
                            >
                              <Headphones size={12} />
                            </button>

                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-7 z-40 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                              >
                                {monitorPerms.barge && (
                                  <button
                                    type="button"
                                    onClick={() => handleChanSpy("barge", call)}
                                    className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                  >
                                    <PhoneCall size={12} className="text-rose-500 shrink-0" />
                                    <span>Araya Gir</span>
                                  </button>
                                )}
                                {monitorPerms.whisper && (
                                  <button
                                    type="button"
                                    onClick={() => handleChanSpy("whisper", call)}
                                    className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                  >
                                    <Mic size={12} className="text-amber-500 shrink-0" />
                                    <span>Sufle</span>
                                  </button>
                                )}
                                {monitorPerms.listen && (
                                  <button
                                    type="button"
                                    onClick={() => handleChanSpy("listen", call)}
                                    className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                  >
                                    <Headphones size={12} className="text-indigo-500 shrink-0" />
                                    <span>Fısılda</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                      <span>DID: {call.callee_number}</span>
                      <span>Kanal: {call.channel ? call.channel.split("/")[0] : "AudioSocket"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Selected Call Real-time Console */}
        <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm min-h-[500px] overflow-hidden transition-colors duration-300">
          
          {!selectedCall ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500 text-center">
              <Bot size={48} className="text-slate-200 dark:text-slate-800 mb-3 animate-pulse" />
              <p className="text-xs font-bold text-slate-550 dark:text-slate-400">Canlı Arama Konsolu</p>
              <p className="text-[10px] text-slate-450 dark:text-slate-600 mt-1">İzlemek istediğiniz aktif bir aramayı soldaki listeden seçin.</p>
            </div>
          ) : (
            <>
              {/* Console Header */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-primary/15 border border-purple-100 dark:border-purple-800/35 flex items-center justify-center text-primary dark:text-purple-400">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Çağrı: {selectedCall.caller_name ? `${selectedCall.caller_name} (${selectedCall.caller_number})` : selectedCall.caller_number}</span>
                      {!selectedCall.caller_name && (
                        <button
                          type="button"
                          onClick={() => setShowAddContactModal(true)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/35 text-primary dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 rounded text-[9px] font-extrabold transition shrink-0"
                        >
                          Rehbere Kaydet
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: {
                                phone: selectedCall.caller_number,
                                name: selectedCall.caller_name || "",
                              },
                            })
                          )
                        }
                        className={`px-2 py-0.5 ${lightBg} ${text} border ${borderLight} rounded text-[9px] font-extrabold transition shrink-0 cursor-pointer`}
                      >
                        360° Kart
                      </button>
                    </h4>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-xs">{selectedCall.id}</p>
                  </div>
                </div>

                {/* Call Sentiment pill & Small Listen Dropdown Icon */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${sentiment.bg} ${sentiment.color}`}>
                    {sentiment.icon}
                    <span>Müşteri Hali: {sentiment.type}</span>
                  </div>

                  {canMonitorAny && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuCallId(openMenuCallId === "console-header" ? null : "console-header");
                        }}
                        title="Dinleme / Müdahale Seçenekleri (Araya Gir - Sufle - Fısılda)"
                        className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all ${
                          openMenuCallId === "console-header"
                            ? `${bg} text-white border-transparent shadow-sm`
                            : `${lightBg} ${text} ${borderLight} hover:opacity-90`
                        }`}
                      >
                        <Headphones size={15} />
                      </button>

                      {openMenuCallId === "console-header" && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-9 z-40 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                        >
                          {monitorPerms.barge && (
                            <button
                              type="button"
                              onClick={() => handleChanSpy("barge", selectedCall)}
                              className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                            >
                              <PhoneCall size={12} className="text-rose-500 shrink-0" />
                              <span>Araya Gir</span>
                            </button>
                          )}
                          {monitorPerms.whisper && (
                            <button
                              type="button"
                              onClick={() => handleChanSpy("whisper", selectedCall)}
                              className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                            >
                              <Mic size={12} className="text-amber-500 shrink-0" />
                              <span>Sufle</span>
                            </button>
                          )}
                          {monitorPerms.listen && (
                            <button
                              type="button"
                              onClick={() => handleChanSpy("listen", selectedCall)}
                              className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                            >
                              <Headphones size={12} className="text-indigo-500 shrink-0" />
                              <span>Fısılda</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Alert Messages */}
              {successMsg && (
                <div className="mx-4 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <Activity size={14} className="shrink-0" />
                  <span className="font-semibold">{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mx-4 mt-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {/* Console Action Bar */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/20 dark:bg-slate-950/20 flex flex-wrap gap-2">
                {monitorPerms.listen && (
                  <button
                    onClick={() => handleChanSpy("listen", selectedCall)}
                    disabled={loadingSpy}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-sm transition duration-150"
                  >
                    <Headphones size={13} />
                    <span>{loadingSpy ? "Bağlanıyor..." : "Fısılda (Dinle)"}</span>
                  </button>
                )}

                {monitorPerms.whisper && (
                  <button
                    onClick={() => handleChanSpy("whisper", selectedCall)}
                    disabled={loadingSpy}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-sm transition duration-150"
                  >
                    <Mic size={13} />
                    <span>Sufle Ver</span>
                  </button>
                )}

                {monitorPerms.barge && (
                  <button
                    onClick={() => handleChanSpy("barge", selectedCall)}
                    disabled={loadingSpy}
                    className={`flex items-center gap-1.5 px-3.5 py-2 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-sm transition duration-150`}
                  >
                    <PhoneCall size={13} />
                    <span>Araya Gir</span>
                  </button>
                )}

                <button
                  onClick={handleTransfer}
                  disabled={loadingTransfer}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold shadow-sm transition duration-150"
                >
                  <PhoneForwarded size={13} />
                  <span>{loadingTransfer ? "Aktarılıyor..." : "Temsilciye Yönlendir"}</span>
                </button>
              </div>

              {/* Live Waveform visualizer (Pulsing micro-animation) */}
              <div className="px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-950/10 flex items-center gap-4">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Ses Genliği (Anlık):</span>
                <div className="flex items-center gap-[3px] h-6">
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.8s_infinite] h-2"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.5s_infinite] h-4"></span>
                  <span className="w-[3px] bg-purple-400 rounded-full animate-[pulse_0.7s_infinite] h-5"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.6s_infinite] h-3"></span>
                  <span className="w-[3px] bg-indigo-400 rounded-full animate-[pulse_0.4s_infinite] h-5"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.9s_infinite] h-2"></span>
                </div>
              </div>

              {/* Real-time Streaming Transcript Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/10 dark:bg-slate-950/10 max-h-[350px]">
                {transcripts.length === 0 ? (
                  <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {wsStatus === "connecting" ? "Bağlanıyor..." : "Konuşma bekleniyor..."}
                  </div>
                ) : (
                  transcripts.map((t, idx) => {
                    const isAI = t.speaker && (t.speaker.toLowerCase() === "ai" || t.speaker.toLowerCase() === "agent");
                    const isWhisper = t.speaker && t.speaker.toLowerCase() === "supervisor_whisper";
                    
                    if (isWhisper) {
                      return (
                        <div key={idx} className="flex flex-col items-center mx-auto max-w-[90%] my-2">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-amber-500/20 text-primary dark:text-amber-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                            <Bot size={10} />
                            <span>SÜPERVİZÖR FISILTISI</span>
                          </div>
                          <div className="mt-1 px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-850 dark:text-amber-300/90 rounded-2xl text-[11px] leading-relaxed shadow-sm text-center italic font-semibold">
                            "{t.text}"
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 max-w-[85%] ${
                          isAI ? "mr-auto" : "ml-auto flex-row-reverse"
                        }`}
                      >
                        <div
                          className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 border ${
                            isAI
                              ? "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800/40 text-primary dark:text-purple-400"
                              : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350"
                          }`}
                        >
                          {isAI ? <Bot size={13} /> : <User size={13} />}
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm border ${
                            isAI
                              ? "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 text-purple-750 dark:text-purple-350/90 rounded-tl-none"
                              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-none"
                          }`}
                        >
                          {t.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* AI Whisperer Input Box */}
              {(hasWhisperPermission || monitorPerms.whisper) && (
                <form onSubmit={handleSendWhisper} className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-primary/[0.02] dark:bg-primary/[0.01] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-ping"></span>
                    <span className="text-[10px] text-primary dark:text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                      AI'a Sufle Ver / Fısılda (Canlı Prompt Müdahalesi)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={whisperInputRef}
                      type="text"
                      placeholder="Yapay zekanın bir sonraki cevabı için anlık yönlendirme yazın..."
                      value={whisperText}
                      onChange={(e) => setWhisperText(e.target.value)}
                      disabled={sendingWhisper}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 font-semibold shadow-sm transition"
                    />
                    <button
                      type="submit"
                      disabled={sendingWhisper || !whisperText.trim()}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-white rounded-xl text-[11px] font-extrabold shadow-md shadow-amber-500/10 transition shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>{sendingWhisper ? "İletiliyor..." : "Sufle Gönder"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Agent Call Notes Form */}
              <form onSubmit={handleSaveNotes} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Temsilci Çağrı Notu</span>
                  {notesSuccess && (
                    <span className="text-[9px] text-primary dark:text-emerald-450 font-bold flex items-center gap-1">
                      <CheckCircle size={10} /> Not Kaydedildi
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      value={agentTopic}
                      onChange={(e) => setAgentTopic(e.target.value)}
                      required
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                    >
                      <option value="">Konu Seçin...</option>
                      <option value="Destek">Destek / Teknik</option>
                      <option value="Satış">Satış / Sipariş</option>
                      <option value="Ödeme">Ödeme / Fatura</option>
                      <option value="Şikayet">Şikayet / İptal</option>
                      <option value="Bilgi">Bilgi Talebi</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Çağrı ile ilgili notlarınızı yazın..."
                      value={agentNotes}
                      onChange={(e) => setAgentNotes(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary text-white rounded-xl text-[11px] font-bold shadow-md shadow-purple-500/10 transition shrink-0"
                    >
                      {savingNotes ? "..." : "Kaydet"}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

        </div>

      </div>
        );
      })}

      {/* Widget Customizer Modal */}
      {showCustomizeModal && (
        <div
          onClick={() => setShowCustomizeModal(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[165] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={14} className={text} />
                  Kişisel Özet Ekranı Düzeni
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Görmek istediğiniz modülleri açıp kapatın ve yukarı/aşağı oklarla sıralayın.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => persistWidgetLayout([...DEFAULT_WIDGET_ORDER], [])}
                  title="Varsayılan Düzene Sıfırla"
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Sıfırla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-2.5 max-h-[65vh] overflow-y-auto">
              {widgetOrder.map((wId, idx) => {
                const meta = DASHBOARD_WIDGET_CATALOG.find((w) => w.id === wId);
                if (!meta) return null;
                const isVisible = !hiddenWidgets.includes(wId);

                return (
                  <div
                    key={wId}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      isVisible
                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        : "bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{meta.description}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveWidgetOrder(idx, -1)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Yukarı Taşı"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === widgetOrder.length - 1}
                        onClick={() => moveWidgetOrder(idx, 1)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Aşağı Taşı"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWidgetVisibility(wId)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                          isVisible
                            ? `${bg} text-white`
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span>{isVisible ? "Açık" : "Gizli"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        initialPhone={selectedCall?.caller_number || ""}
        backendHost={backendHost}
        onSaveSuccess={() => {
          // Instantly set caller_name locally for better responsiveness
          if (selectedCall) {
            setSelectedCall(prev => ({ ...prev, caller_name: "Yeni Rehber Kaydı" }));
          }
        }}
      />

    </div>
  );
}
