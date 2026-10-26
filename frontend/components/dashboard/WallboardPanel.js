import React, { useState, useEffect, useRef } from "react";
import {
  Monitor,
  Users,
  PhoneCall,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Volume2,
  ShieldCheck,
  Headphones,
  Mic,
  Bot,
  Send,
  X,
  Sliders,
  LayoutGrid,
  Sparkles,
  RotateCcw,
  Save,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Trophy,
  Coffee,
  PhoneMissed,
  PhoneIncoming,
  Timer,
  Filter,
  Search,
  AlertTriangle,
  Layers
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const DEFAULT_KPI_CARDS = [
  { id: "queue_waiting", label: "Sırada Bekleyen", unit: "Kişi", enabled: true },
  { id: "ai_resolved", label: "AI Başarılı Çözüm", unit: "Çağrı", enabled: true },
  { id: "service_level", label: "Servis Seviyesi", unit: "SL %", enabled: true },
  { id: "available_agents", label: "Müsait", unit: "Temsilci", enabled: true },
  { id: "busy_agents", label: "Meşgul", unit: "Görüşmede", enabled: true },
  { id: "break_agents", label: "Molada", unit: "Temsilci", enabled: true },
  { id: "missed_calls", label: "Cevapsız Çağrı", unit: "Bugün", enabled: false },
  { id: "avg_talk_time", label: "Ort. Konuşma (AHT)", unit: "Saniye", enabled: false },
  { id: "total_calls", label: "Toplam Çağrı", unit: "Bugün", enabled: false }
];

const DEFAULT_MAIN_WIDGETS = [
  {
    id: "agents_grid",
    title: "Temsilci & AI Çağrı Meşguliyet Durumları",
    description: "Tüm insan ve AI temsilcilerin anlık meşguliyet, mola ve dinleme kartları",
    enabled: true,
    colSpan: 12
  },
  {
    id: "active_calls_table",
    title: "Canlı Aktif Görüşmeler Listesi",
    description: "Devam eden çağrıların arayan, aranan, süre ve hızlı müdahale tablosu",
    enabled: false,
    colSpan: 6
  },
  {
    id: "queues_table",
    title: "Canlı Kuyruk (ACD) Durum Tablosu",
    description: "Kuyruk bazlı temsilci dağılımı, müsaitlik ve strateji özeti",
    enabled: false,
    colSpan: 6
  },
  {
    id: "leaderboard",
    title: "Günün En'leri (Performans Sıralaması)",
    description: "Bugün en çok çağrı karşılayan temsilcilerin canlı sıralaması",
    enabled: false,
    colSpan: 6
  },
  {
    id: "break_tracker",
    title: "Canlı Mola Takip Kutusu",
    description: "Moladaki temsilciler, mola türleri ve mola süresi aşım uyarıları",
    enabled: false,
    colSpan: 6
  }
];

const DEFAULT_THRESHOLDS = {
  maxQueueWaiters: 3,
  minServiceLevel: 80,
  maxCallDurationSec: 300,
  maxBreakDurationSec: 900
};

const PRESET_TEMPLATES = {
  standard: {
    name: "Standart Görünüm",
    description: "6 temel KPI kartı ve tam genişlikte Temsilci & AI Meşguliyet Panosu",
    kpiCards: DEFAULT_KPI_CARDS,
    mainWidgets: DEFAULT_MAIN_WIDGETS,
    agentCardDensity: "standard",
    agentSortBy: "status"
  },
  supervisor: {
    name: "Süpervizör Komuta Merkezi",
    description: "Tüm KPI sayaçları, Temsilci Panosu, Aktif Görüşmeler, Kuyruklar ve Mola Takibi bir arada",
    kpiCards: DEFAULT_KPI_CARDS.map((c) => ({ ...c, enabled: true })),
    mainWidgets: [
      { ...DEFAULT_MAIN_WIDGETS[0], enabled: true, colSpan: 8 },
      { ...DEFAULT_MAIN_WIDGETS[1], enabled: true, colSpan: 4 },
      { ...DEFAULT_MAIN_WIDGETS[2], enabled: true, colSpan: 4 },
      { ...DEFAULT_MAIN_WIDGETS[3], enabled: true, colSpan: 4 },
      { ...DEFAULT_MAIN_WIDGETS[4], enabled: true, colSpan: 4 }
    ],
    agentCardDensity: "detailed",
    agentSortBy: "status"
  },
  queue_focus: {
    name: "Kuyruk & Çağrı Odaklı",
    description: "Kuyruk performansı, aktif çağrı tablosu ve temsilci meşguliyet görünümü",
    kpiCards: DEFAULT_KPI_CARDS.map((c) => ({
      ...c,
      enabled: ["queue_waiting", "service_level", "available_agents", "busy_agents", "missed_calls", "total_calls"].includes(c.id)
    })),
    mainWidgets: [
      { ...DEFAULT_MAIN_WIDGETS[1], enabled: true, colSpan: 6 },
      { ...DEFAULT_MAIN_WIDGETS[2], enabled: true, colSpan: 6 },
      { ...DEFAULT_MAIN_WIDGETS[0], enabled: true, colSpan: 12 },
      { ...DEFAULT_MAIN_WIDGETS[3], enabled: false, colSpan: 6 },
      { ...DEFAULT_MAIN_WIDGETS[4], enabled: false, colSpan: 6 }
    ],
    agentCardDensity: "standard",
    agentSortBy: "calls_desc"
  },
  compact_dense: {
    name: "Kompakt Yoğun Görünüm",
    description: "Çok sayıda temsilciyi tek ekranda kompakt kartlarla ve liderlik tablosuyla izleyin",
    kpiCards: DEFAULT_KPI_CARDS,
    mainWidgets: [
      { ...DEFAULT_MAIN_WIDGETS[0], enabled: true, colSpan: 8 },
      { ...DEFAULT_MAIN_WIDGETS[3], enabled: true, colSpan: 4 },
      { ...DEFAULT_MAIN_WIDGETS[1], enabled: false, colSpan: 6 },
      { ...DEFAULT_MAIN_WIDGETS[2], enabled: false, colSpan: 6 },
      { ...DEFAULT_MAIN_WIDGETS[4], enabled: false, colSpan: 6 }
    ],
    agentCardDensity: "compact",
    agentSortBy: "status"
  }
};

export default function WallboardPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [authorized, setAuthorized] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [queues, setQueues] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);
  const [activeCallsList, setActiveCallsList] = useState([]);

  // Monitor permissions & current user info
  const [currentUserExt, setCurrentUserExt] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [monitorPerms, setMonitorPerms] = useState({
    listen: true,
    whisper: true,
    barge: true
  });

  // Dropdown & Toast states for Call Monitoring (Araya Gir / Sufle / Fısılda)
  const [openMenuCardId, setOpenMenuCardId] = useState(null);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [monitorLoadingId, setMonitorLoadingId] = useState(null);
  const [aiWhisperTargetCall, setAiWhisperTargetCall] = useState(null);
  const [aiWhisperInput, setAiWhisperInput] = useState("");
  const [sendingAiWhisper, setSendingAiWhisper] = useState(false);
  const menuContainerRef = useRef(null);

  // Real-time wallboard metrics
  const [queueCount, setQueueCount] = useState(0);
  const [aiResolvedCount, setAiResolvedCount] = useState(0);
  const [activeCallsCount, setActiveCallsCount] = useState(0);
  const [avgHoldTime, setAvgHoldTime] = useState(0);
  const [serviceLevel, setServiceLevel] = useState(100.0);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [totalTodayCalls, setTotalTodayCalls] = useState(0);
  const [agentsState, setAgentsState] = useState({});

  // Customizer & Personal Layout States
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizerTab, setCustomizerTab] = useState("widgets"); // 'widgets' | 'cards' | 'thresholds'
  const [kpiCards, setKpiCards] = useState(DEFAULT_KPI_CARDS);
  const [mainWidgets, setMainWidgets] = useState(DEFAULT_MAIN_WIDGETS);
  const [agentCardDensity, setAgentCardDensity] = useState("standard"); // 'compact' | 'standard' | 'detailed'
  const [agentSortBy, setAgentSortBy] = useState("status"); // 'status' | 'calls_desc' | 'name' | 'extension'
  const [agentStatusFilter, setAgentStatusFilter] = useState("ALL"); // 'ALL' | 'Görüşmede' | 'Müsait' | 'Molada' | 'Çevrimdışı'
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [activePresetKey, setActivePresetKey] = useState("standard");
  const [savingLayout, setSavingLayout] = useState(false);

  // Drag and Drop state
  const [draggedKpiIndex, setDraggedKpiIndex] = useState(null);
  const [draggedWidgetIndex, setDraggedWidgetIndex] = useState(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setOpenMenuCardId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Merge saved layout safely with defaults so newly added widgets/cards are preserved
  const applyLoadedLayout = (saved) => {
    if (!saved || typeof saved !== "object") return;

    if (Array.isArray(saved.kpiCards) && saved.kpiCards.length > 0) {
      const savedMap = new Map(saved.kpiCards.map((c) => [c.id, c]));
      const ordered = [];
      saved.kpiCards.forEach((sc) => {
        const def = DEFAULT_KPI_CARDS.find((d) => d.id === sc.id);
        if (def) ordered.push({ ...def, enabled: Boolean(sc.enabled) });
      });
      DEFAULT_KPI_CARDS.forEach((def) => {
        if (!savedMap.has(def.id)) ordered.push(def);
      });
      setKpiCards(ordered);
    }

    if (Array.isArray(saved.mainWidgets) && saved.mainWidgets.length > 0) {
      const savedMap = new Map(saved.mainWidgets.map((w) => [w.id, w]));
      const ordered = [];
      saved.mainWidgets.forEach((sw) => {
        const def = DEFAULT_MAIN_WIDGETS.find((d) => d.id === sw.id);
        if (def) {
          ordered.push({
            ...def,
            enabled: Boolean(sw.enabled),
            colSpan: Number(sw.colSpan) || def.colSpan
          });
        }
      });
      DEFAULT_MAIN_WIDGETS.forEach((def) => {
        if (!savedMap.has(def.id)) ordered.push(def);
      });
      setMainWidgets(ordered);
    }

    if (saved.agentCardDensity) setAgentCardDensity(saved.agentCardDensity);
    if (saved.agentSortBy) setAgentSortBy(saved.agentSortBy);
    if (saved.thresholds && typeof saved.thresholds === "object") {
      setThresholds({ ...DEFAULT_THRESHOLDS, ...saved.thresholds });
    }
    if (saved.activePresetKey) setActivePresetKey(saved.activePresetKey);
  };

  const loadUserLayout = async (uid) => {
    const effectiveUid = String(uid || "admin");
    try {
      const localRaw = typeof window !== "undefined" ? localStorage.getItem(`wallboard_layout_${effectiveUid}`) : null;
      if (localRaw) {
        applyLoadedLayout(JSON.parse(localRaw));
      }
    } catch (e) {}

    try {
      const res = await fetch(`${API_BASE}/api/wallboard/layout?user_id=${encodeURIComponent(effectiveUid)}`, {
        headers: { "X-User-ID": effectiveUid }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.layout) {
          applyLoadedLayout(data.layout);
          if (typeof window !== "undefined") {
            localStorage.setItem(`wallboard_layout_${effectiveUid}`, JSON.stringify(data.layout));
          }
        }
      }
    } catch (err) {
      console.error("Wallboard layout load error:", err);
    }
  };

  const saveUserLayout = async (customPayload = null, showFeedback = true) => {
    const effectiveUid = String(currentUserId || (typeof window !== "undefined" ? localStorage.getItem("current_user_id") : null) || "admin");
    const layoutPayload = customPayload || {
      kpiCards,
      mainWidgets,
      agentCardDensity,
      agentSortBy,
      thresholds,
      activePresetKey
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`wallboard_layout_${effectiveUid}`, JSON.stringify(layoutPayload));
    }

    setSavingLayout(true);
    try {
      await fetch(`${API_BASE}/api/wallboard/layout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": effectiveUid
        },
        body: JSON.stringify({
          user_id: effectiveUid,
          layout: layoutPayload
        })
      });
      if (showFeedback) {
        setMonitorStatus({
          type: "success",
          text: "Kişisel Canlı İzleme Paneli tasarımınız başarıyla kaydedildi."
        });
        setTimeout(() => setMonitorStatus(null), 3500);
      }
    } catch (err) {
      console.error("Failed to save wallboard layout:", err);
    } finally {
      setSavingLayout(false);
    }
  };

  const applyPreset = (presetKey) => {
    const preset = PRESET_TEMPLATES[presetKey];
    if (!preset) return;
    setKpiCards(preset.kpiCards);
    setMainWidgets(preset.mainWidgets);
    setAgentCardDensity(preset.agentCardDensity);
    setAgentSortBy(preset.agentSortBy);
    setActivePresetKey(presetKey);

    saveUserLayout(
      {
        kpiCards: preset.kpiCards,
        mainWidgets: preset.mainWidgets,
        agentCardDensity: preset.agentCardDensity,
        agentSortBy: preset.agentSortBy,
        thresholds,
        activePresetKey: presetKey
      },
      true
    );
  };

  const handleResetDefault = () => {
    applyPreset("standard");
    setThresholds(DEFAULT_THRESHOLDS);
  };

  const checkAccess = async () => {
    try {
      const storedUserId = typeof window !== "undefined" ? localStorage.getItem("current_user_id") : null;
      const resStatus = await fetch(`${API_BASE}/api/agent/status`, { cache: "no-store" });
      const statusData = await resStatus.json();

      const [resUsers, resRoles] = await Promise.all([
        fetch(`${API_BASE}/api/settings/users`),
        fetch(`${API_BASE}/api/settings/roles`)
      ]);
      const usersDataRaw = await resUsers.json();
      const usersList = Array.isArray(usersDataRaw) ? usersDataRaw : (usersDataRaw?.users || []);
      const rolesDataRaw = await resRoles.json();
      const rolesList = Array.isArray(rolesDataRaw) ? rolesDataRaw : (rolesDataRaw?.roles || []);

      const resolvedUid = storedUserId || (statusData.is_logged_in ? statusData.user_id : "admin");
      const uidStr = String(resolvedUid || "admin");
      setCurrentUserId(uidStr);
      loadUserLayout(uidStr);

      if (uidStr.toLowerCase() === "admin") {
        setAuthorized(true);
        setMonitorPerms({ listen: true, whisper: true, barge: true });
        return;
      }

      const currentUser = usersList.find(
        (u) => String(u.id) === uidStr || String(u.extension) === uidStr
      );
      if (!currentUser) {
        setAuthorized(true);
        setMonitorPerms({ listen: true, whisper: true, barge: true });
        return;
      }

      if (currentUser.extension) {
        setCurrentUserExt(String(currentUser.extension));
      }

      const currentRole = rolesList.find(
        (r) => String(r.role_code || "").toLowerCase() === String(currentUser.role || "").toLowerCase()
      );
      if (!currentRole || String(currentRole.role_code).toLowerCase() === "admin") {
        setAuthorized(true);
        setMonitorPerms({ listen: true, whisper: true, barge: true });
        return;
      }

      const perms = Array.isArray(currentRole.permissions) ? currentRole.permissions : [];
      const hasAccess = perms.includes("wallboard:access") || perms.includes("wallboard");
      setAuthorized(hasAccess);

      const hasLegacyAiWhisper =
        perms.includes("ai_whisper:write") ||
        perms.includes("ai_whisper:access") ||
        perms.includes("ai_whisper");

      setMonitorPerms({
        listen: perms.includes("call_monitor:listen") || perms.includes("ai_whisper:read") || hasLegacyAiWhisper,
        whisper: perms.includes("call_monitor:whisper") || hasLegacyAiWhisper,
        barge: perms.includes("call_monitor:barge") || hasLegacyAiWhisper
      });
    } catch (err) {
      console.error("Wallboard access check failed:", err);
      setAuthorized(true);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [resUsers, resRoles, resBreaks, resQueues, resAi] = await Promise.all([
        fetch(`${API_BASE}/api/settings/users`),
        fetch(`${API_BASE}/api/settings/roles`),
        fetch(`${API_BASE}/api/settings/breaks`),
        fetch(`${API_BASE}/api/settings/queues`).catch(() => null),
        fetch(`${API_BASE}/api/settings/ai-agents`).catch(() => null)
      ]);
      const usersData = await resUsers.json();
      setUsers(Array.isArray(usersData) ? usersData : (usersData?.users || []));

      const rolesData = await resRoles.json();
      setRoles(Array.isArray(rolesData) ? rolesData : (rolesData?.roles || []));

      const breaksData = await resBreaks.json();
      setBreaks(Array.isArray(breaksData) ? breaksData : (breaksData?.breaks || []));

      if (resQueues && resQueues.ok) {
        const qData = await resQueues.json();
        setQueues(Array.isArray(qData) ? qData : (qData?.queues || []));
      }

      if (resAi && resAi.ok) {
        const aiData = await resAi.json();
        setAiAgents(Array.isArray(aiData) ? aiData : (aiData?.agents || []));
      }
    } catch (err) {
      console.error("Wallboard initial load failed:", err);
    }
  };

  const fetchActiveCalls = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calls/active`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setActiveCallsList(data);
        setActiveCallsCount(data.length);
      }
    } catch (err) {
      console.error("Wallboard active calls poll error:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    checkAccess();
    fetchActiveCalls();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveCalls();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWallboardData = async () => {
      try {
        const [wbRes, agentsRes] = await Promise.all([
          fetch(`${API_BASE}/api/reports/wallboard`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/reports/agents`, { cache: "no-store" })
        ]);

        if (wbRes.ok) {
          const wbData = await wbRes.json();
          setQueueCount(wbData.queueCount || 0);
          setAiResolvedCount(wbData.aiResolvedCount || 0);
          setActiveCallsCount(wbData.activeCallsCount || 0);
          setAvgHoldTime(wbData.avgHoldTime || 0);
          setServiceLevel(wbData.serviceLevel ?? 100.0);
          setMissedCallsCount(wbData.missedCallsCount || 0);
          setTotalTodayCalls(wbData.totalTodayCalls || 0);
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

  const canMonitorAny = monitorPerms.listen || monitorPerms.whisper || monitorPerms.barge;

  const handleTriggerMonitor = async ({ mode, callId, targetExt, callerNumber, label, isAiCall = false }) => {
    setOpenMenuCardId(null);
    setMonitorStatus(null);

    const modeTitles = {
      barge: "Araya Girme",
      whisper: "Sufle Verme",
      listen: "Fısıldama (Sessiz Dinleme)"
    };
    const modeTitle = modeTitles[mode] || "Canlı Dinleme";

    if (!callId && !targetExt && !callerNumber) {
      setMonitorStatus({
        type: "error",
        text: `${label || "Seçilen temsilci"} şu anda aktif bir görüşmede değil.`
      });
      setTimeout(() => setMonitorStatus(null), 4000);
      return;
    }

    const effectiveCallId = callId || "active";
    setMonitorLoadingId(`${effectiveCallId}-${targetExt || callerNumber}`);

    try {
      const res = await fetch(`${API_BASE}/api/calls/${encodeURIComponent(effectiveCallId)}/spy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": currentUserId || localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          mode,
          agent_ext: currentUserExt || undefined,
          target_ext: targetExt || undefined,
          caller_number: callerNumber || undefined,
          user_id: currentUserId || localStorage.getItem("current_user_id") || "admin"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMonitorStatus({
          type: "success",
          text: `${modeTitle} başlatıldı (${label})! WebPhone veya masa telefonunuz otomatik olarak çağrıya bağlanıyor.`
        });
        if (isAiCall && mode === "whisper" && callId) {
          setAiWhisperTargetCall({ id: callId, label });
        }
      } else {
        setMonitorStatus({
          type: "error",
          text: data.detail || `${modeTitle} başlatılamadı.`
        });
      }
    } catch (err) {
      setMonitorStatus({
        type: "error",
        text: "Sunucu bağlantı hatası oluştu."
      });
    } finally {
      setMonitorLoadingId(null);
      setTimeout(() => setMonitorStatus(null), 6000);
    }
  };

  const handleSendAiWhisperPrompt = async (e) => {
    e.preventDefault();
    if (!aiWhisperTargetCall?.id || !aiWhisperInput.trim()) return;
    setSendingAiWhisper(true);
    try {
      const res = await fetch(`${API_BASE}/api/calls/${encodeURIComponent(aiWhisperTargetCall.id)}/whisper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiWhisperInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMonitorStatus({
          type: "success",
          text: `Yapay zekaya sufle iletildi: "${aiWhisperInput.trim()}"`
        });
        setAiWhisperInput("");
        setAiWhisperTargetCall(null);
      } else {
        setMonitorStatus({
          type: "error",
          text: data.detail || "AI sufle iletilemedi."
        });
      }
    } catch (err) {
      setMonitorStatus({
        type: "error",
        text: "Bağlantı hatası oluştu."
      });
    } finally {
      setSendingAiWhisper(false);
    }
  };

  const formatSeconds = (sec) => {
    const s = Math.max(0, Number(sec) || 0);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const availableCount = users.filter((u) => {
    const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
    return st?.status === "Müsait";
  }).length;

  const busyCount =
    users.filter((u) => {
      const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
      return st?.status === "Görüşmede" || st?.status === "Meşgul";
    }).length + activeCallsList.length;

  const breakCount = users.filter((u) => {
    const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
    return st?.status === "Molada";
  }).length;

  // KPI Card Reorder & Toggle Helpers
  const toggleKpiCard = (id) => {
    setKpiCards((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
    setActivePresetKey("custom");
  };

  const moveKpiCard = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= kpiCards.length) return;
    const updated = [...kpiCards];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setKpiCards(updated);
    setActivePresetKey("custom");
  };

  const handleKpiDrop = (targetIdx) => {
    if (draggedKpiIndex === null || draggedKpiIndex === targetIdx) return;
    const updated = [...kpiCards];
    const [moved] = updated.splice(draggedKpiIndex, 1);
    updated.splice(targetIdx, 0, moved);
    setKpiCards(updated);
    setDraggedKpiIndex(null);
    setActivePresetKey("custom");
  };

  // Main Widget Reorder, Toggle & Resize Helpers
  const toggleMainWidget = (id) => {
    setMainWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
    setActivePresetKey("custom");
  };

  const setWidgetColSpan = (id, colSpan) => {
    setMainWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, colSpan: Number(colSpan) } : w)));
    setActivePresetKey("custom");
  };

  const moveMainWidget = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mainWidgets.length) return;
    const updated = [...mainWidgets];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setMainWidgets(updated);
    setActivePresetKey("custom");
  };

  const handleWidgetDrop = (targetIdx) => {
    if (draggedWidgetIndex === null || draggedWidgetIndex === targetIdx) return;
    const updated = [...mainWidgets];
    const [moved] = updated.splice(draggedWidgetIndex, 1);
    updated.splice(targetIdx, 0, moved);
    setMainWidgets(updated);
    setDraggedWidgetIndex(null);
    setActivePresetKey("custom");
  };

  // Render individual KPI Card data
  const getKpiCardMeta = (cardId) => {
    const isQueueAlarm = queueCount >= (Number(thresholds.maxQueueWaiters) || 3) && queueCount > 0;
    const isSlAlarm = serviceLevel < (Number(thresholds.minServiceLevel) || 80);

    switch (cardId) {
      case "queue_waiting":
        return {
          title: "SIRADA BEKLEYEN",
          value: queueCount,
          unit: "Kişi",
          icon: <Users size={14} />,
          iconClass: "bg-rose-50 dark:bg-rose-950/20 text-rose-500",
          barClass: `from-rose-500 to-pink-500 ${queueCount > 0 ? "animate-pulse" : "opacity-60"}`,
          alarm: isQueueAlarm,
          alarmText: "Eşik Aşıldı"
        };
      case "ai_resolved":
        return {
          title: "AI BAŞARILI ÇÖZÜM",
          value: aiResolvedCount,
          unit: "Çağrı",
          icon: <CheckCircle2 size={14} />,
          iconClass: "bg-violet-50 dark:bg-violet-950/20 text-violet-500",
          barClass: "from-violet-500 to-indigo-500",
          alarm: false
        };
      case "service_level":
        return {
          title: "SERVİS SEVİYESİ",
          value: `${serviceLevel}%`,
          badge: `${avgHoldTime}s`,
          icon: <Clock size={14} />,
          iconClass: "bg-amber-50 dark:bg-amber-950/20 text-amber-500",
          barClass: "from-amber-500 to-orange-500",
          alarm: isSlAlarm,
          alarmText: `SL < %${thresholds.minServiceLevel}`
        };
      case "available_agents":
        return {
          title: "MÜSAİT",
          value: availableCount,
          unit: "Temsilci",
          icon: <ShieldCheck size={14} />,
          iconClass: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500",
          barClass: "from-emerald-500 to-teal-500",
          alarm: false
        };
      case "busy_agents":
        return {
          title: "MEŞGUL",
          value: busyCount,
          unit: "Görüşmede",
          icon: <PhoneCall size={14} />,
          iconClass: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500",
          barClass: "from-indigo-500 to-blue-500",
          alarm: false
        };
      case "break_agents":
        return {
          title: "MOLADA",
          value: breakCount,
          unit: "Temsilci",
          icon: <Clock size={14} />,
          iconClass: "bg-orange-50 dark:bg-orange-950/20 text-orange-500",
          barClass: "from-orange-500 to-amber-500",
          alarm: false
        };
      case "missed_calls":
        return {
          title: "CEVAPSIZ ÇAĞRI",
          value: missedCallsCount,
          unit: "Çağrı",
          icon: <PhoneMissed size={14} />,
          iconClass: "bg-red-50 dark:bg-red-950/20 text-red-500",
          barClass: "from-red-500 to-rose-500",
          alarm: false
        };
      case "avg_talk_time":
        return {
          title: "ORT. KONUŞMA (AHT)",
          value: `${avgHoldTime}s`,
          unit: "Süre",
          icon: <Timer size={14} />,
          iconClass: "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-500",
          barClass: "from-cyan-500 to-sky-500",
          alarm: false
        };
      case "total_calls":
        return {
          title: "BUGÜNKÜ TOPLAM",
          value: totalTodayCalls,
          unit: "Çağrı",
          icon: <PhoneIncoming size={14} />,
          iconClass: "bg-blue-50 dark:bg-blue-950/20 text-blue-500",
          barClass: "from-blue-500 to-indigo-500",
          alarm: false
        };
      default:
        return null;
    }
  };

  // Filtered & Sorted Human Agents for `agents_grid`
  const getFilteredAndSortedUsers = () => {
    const statusPriority = {
      Görüşmede: 1,
      Meşgul: 1,
      Müsait: 2,
      Molada: 3,
      Çevrimdışı: 4
    };

    return users
      .filter((u) => {
        const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)] || { status: "Çevrimdışı" };
        if (agentStatusFilter !== "ALL" && st.status !== agentStatusFilter) {
          return false;
        }
        if (agentSearchQuery.trim()) {
          const q = agentSearchQuery.toLowerCase();
          const matchName = String(u.full_name || "").toLowerCase().includes(q);
          const matchExt = String(u.extension || "").toLowerCase().includes(q);
          return matchName || matchExt;
        }
        return true;
      })
      .sort((a, b) => {
        const stA = agentsState[a.id] || agentsState[String(a.id)] || agentsState[String(a.extension)] || { status: "Çevrimdışı", callsToday: 0 };
        const stB = agentsState[b.id] || agentsState[String(b.id)] || agentsState[String(b.extension)] || { status: "Çevrimdışı", callsToday: 0 };

        if (agentSortBy === "calls_desc") {
          return (Number(stB.callsToday) || 0) - (Number(stA.callsToday) || 0);
        }
        if (agentSortBy === "name") {
          return String(a.full_name || "").localeCompare(String(b.full_name || ""), "tr");
        }
        if (agentSortBy === "extension") {
          return String(a.extension || "").localeCompare(String(b.extension || ""), undefined, { numeric: true });
        }
        // Default: status priority
        const pA = statusPriority[stA.status] || 99;
        const pB = statusPriority[stB.status] || 99;
        if (pA !== pB) return pA - pB;
        return String(a.full_name || "").localeCompare(String(b.full_name || ""), "tr");
      });
  };

  const enabledKpiCards = kpiCards.filter((c) => c.enabled);
  const enabledMainWidgets = mainWidgets.filter((w) => w.enabled);

  const getColSpanClass = (span) => {
    switch (Number(span)) {
      case 4:
        return "xl:col-span-4";
      case 6:
        return "xl:col-span-6";
      case 8:
        return "xl:col-span-8";
      case 12:
      default:
        return "xl:col-span-12";
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

  const filteredUsers = getFilteredAndSortedUsers();
  const onBreakUsers = users.filter((u) => {
    const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
    return st?.status === "Molada";
  });

  const rankedLeaderboardUsers = [...users]
    .map((u) => {
      const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)] || { status: "Çevrimdışı", callsToday: 0 };
      return { ...u, state: st, callsToday: Number(st.callsToday) || 0 };
    })
    .sort((a, b) => b.callsToday - a.callsToday);

  const maxCallsToday = Math.max(1, ...(rankedLeaderboardUsers.map((u) => u.callsToday) || [1]));

  return (
    <div ref={menuContainerRef} className="w-full space-y-5 max-h-[90vh] overflow-y-auto pr-1">
      {/* Wallboard Header - Full Width with Customization Controls */}
      <div className="p-5 bg-gradient-to-br from-white via-white to-slate-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
              Kendi çalışma tarzınıza göre sayaçları, tabloları ve temsilci kartlarını özelleştirin; düzeniniz hesabınıza özel kaydedilir.
            </p>
          </div>
        </div>

        {/* Right Header Controls: Presets + Customize Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Preset Selector */}
          <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/70 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
            {[
              { key: "standard", label: "Standart" },
              { key: "supervisor", label: "Süpervizör" },
              { key: "queue_focus", label: "Kuyruk & Çağrı" },
              { key: "compact_dense", label: "Kompakt" }
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold transition-all ${
                  activePresetKey === p.key
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCustomizing(!isCustomizing)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold border flex items-center gap-2 transition-all ${
              isCustomizing
                ? `${bg} text-white border-transparent shadow-md`
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <Sliders size={14} />
            <span>{isCustomizing ? "Özelleştirmeyi Kapat" : "Paneli Özelleştir"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Wallboard Studio Customizer Drawer */}
      {isCustomizing && (
        <div className="p-5 bg-white dark:bg-slate-900 border-2 border-dashed border-violet-300 dark:border-violet-800/70 rounded-3xl shadow-lg space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  Kişisel Wallboard Tasarım Stüdyosu
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Bileşenleri açıp kapatın, sürükleyerek veya oklarla sıralayın, genişliklerini ve kişisel alarm eşiklerinizi belirleyin.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Varsayılana Dön</span>
              </button>
              <button
                type="button"
                disabled={savingLayout}
                onClick={() => {
                  saveUserLayout(null, true);
                  setIsCustomizing(false);
                }}
                className={`px-4 py-1.5 rounded-xl text-[11px] font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-1.5`}
              >
                <Save size={13} />
                <span>{savingLayout ? "Kaydediliyor..." : "Düzeni Kaydet"}</span>
              </button>
            </div>
          </div>

          {/* Studio Sub-tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "widgets", label: "Ana Modüller & Genişlik", icon: <LayoutGrid size={13} /> },
              { id: "cards", label: "Üst KPI Sayaç Kartları", icon: <Layers size={13} /> },
              { id: "thresholds", label: "Kart Görünümü & Alarm Eşikleri", icon: <AlertTriangle size={13} /> }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCustomizerTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 border transition-all ${
                  customizerTab === t.id
                    ? `${lightBg} ${text} ${borderLight}`
                    : "bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200/60 dark:border-slate-800"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Main Widgets Management */}
          {customizerTab === "widgets" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {mainWidgets.map((w, idx) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => setDraggedWidgetIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleWidgetDrop(idx)}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-grab active:cursor-grabbing ${
                    w.enabled
                      ? "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                      : "bg-slate-50/30 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-800/40 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <GripVertical size={15} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-white">{w.title}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{w.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMainWidget(w.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                        w.enabled
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {w.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>{w.enabled ? "Açık" : "Gizli"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Genişlik:</span>
                      {[
                        { span: 4, label: "1/3" },
                        { span: 6, label: "1/2" },
                        { span: 8, label: "2/3" },
                        { span: 12, label: "Tam" }
                      ].map((sz) => (
                        <button
                          key={sz.span}
                          type="button"
                          onClick={() => setWidgetColSpan(w.id, sz.span)}
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                            Number(w.colSpan) === sz.span
                              ? `${bg} text-white border-transparent`
                              : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveMainWidget(idx, -1)}
                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800"
                        title="Yukarı / Öne Taşı"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === mainWidgets.length - 1}
                        onClick={() => moveMainWidget(idx, 1)}
                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800"
                        title="Aşağı / Arkaya Taşı"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: KPI Cards Selection & Ordering */}
          {customizerTab === "cards" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {kpiCards.map((c, idx) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDraggedKpiIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleKpiDrop(idx)}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${
                    c.enabled
                      ? "bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                      : "bg-slate-50/30 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-800/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical size={14} className="text-slate-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">{c.label}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{c.unit}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveKpiCard(idx, -1)}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30"
                      title="Sola Taşı"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === kpiCards.length - 1}
                      onClick={() => moveKpiCard(idx, 1)}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30"
                      title="Sağa Taşı"
                    >
                      <ArrowRight size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleKpiCard(c.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                        c.enabled
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {c.enabled ? "Açık" : "Gizli"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Card Density, Default Sort & Personal Thresholds */}
          {customizerTab === "thresholds" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <h5 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                  Temsilci Kartı Görünüm Yoğunluğu & Sıralama
                </h5>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500">Kart Boyutu / Detay Seviyesi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "compact", label: "Kompakt (Mini)" },
                      { id: "standard", label: "Standart" },
                      { id: "detailed", label: "Detaylı (+Sayaç)" }
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setAgentCardDensity(d.id)}
                        className={`py-2 px-2.5 rounded-xl text-[10px] font-extrabold border ${
                          agentCardDensity === d.id
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-bold text-slate-500">Varsayılan Temsilci Sıralaması</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "status", label: "Duruma Göre" },
                      { id: "calls_desc", label: "En Çok Çağrı" },
                      { id: "name", label: "İsme Göre" },
                      { id: "extension", label: "Dahili No" }
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setAgentSortBy(s.id)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-extrabold border ${
                          agentSortBy === s.id
                            ? `${lightBg} ${text} ${borderLight}`
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <h5 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                  Kişisel Görsel Alarm Eşikleri
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Sırada Bekleyen Alarm Eşiği (Kişi)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={thresholds.maxQueueWaiters}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, maxQueueWaiters: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Min. Servis Seviyesi Alarmı (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={thresholds.minServiceLevel}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, minServiceLevel: Math.max(1, Number(e.target.value) || 80) })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Uzun Görüşme Uyarı Süresi (Sn)
                    </label>
                    <input
                      type="number"
                      min="30"
                      value={thresholds.maxCallDurationSec}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, maxCallDurationSec: Math.max(30, Number(e.target.value) || 300) })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Uzun Mola Uyarı Süresi (Sn)
                    </label>
                    <input
                      type="number"
                      min="60"
                      value={thresholds.maxBreakDurationSec}
                      onChange={(e) =>
                        setThresholds({ ...thresholds, maxBreakDurationSec: Math.max(60, Number(e.target.value) || 900) })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monitor Status Notification Banner */}
      {monitorStatus && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            monitorStatus.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Headphones size={15} className="shrink-0" />
            <span>{monitorStatus.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMonitorStatus(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Optional Quick AI Text Sufle Bar when Sufle is selected on an AI Call */}
      {aiWhisperTargetCall && (
        <form
          onSubmit={handleSendAiWhisperPrompt}
          className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 shrink-0">
            <Bot size={16} className="text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
              AI Sufle ({aiWhisperTargetCall.label}):
            </span>
          </div>
          <input
            type="text"
            value={aiWhisperInput}
            onChange={(e) => setAiWhisperInput(e.target.value)}
            placeholder="Yapay zekaya anlık yazılı sufle / yönlendirme komutu gönderin..."
            className="flex-1 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={sendingAiWhisper || !aiWhisperInput.trim()}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} disabled:opacity-50 flex items-center gap-1.5`}
            >
              <Send size={12} />
              <span>{sendingAiWhisper ? "İletiliyor..." : "Sufle Gönder"}</span>
            </button>
            <button
              type="button"
              onClick={() => setAiWhisperTargetCall(null)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        </form>
      )}

      {/* Dynamic Wallboard Content */}
      <div className="w-full space-y-6">
        {/* Customizable KPI Counter Cards Grid */}
        {enabledKpiCards.length > 0 && (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 ${
              enabledKpiCards.length >= 6
                ? "lg:grid-cols-6"
                : enabledKpiCards.length === 5
                  ? "lg:grid-cols-5"
                  : enabledKpiCards.length === 4
                    ? "lg:grid-cols-4"
                    : "lg:grid-cols-3"
            } gap-4`}
          >
            {enabledKpiCards.map((card) => {
              const meta = getKpiCardMeta(card.id);
              if (!meta) return null;

              return (
                <div
                  key={card.id}
                  className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm space-y-2 relative overflow-hidden group transition-all ${
                    meta.alarm
                      ? "border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                      {meta.title}
                    </span>
                    <div className={`p-2 rounded-xl shrink-0 ${meta.iconClass}`}>{meta.icon}</div>
                  </div>
                  <div className="flex items-baseline gap-1.5 justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-850 dark:text-white tracking-tight font-mono">
                        {meta.value}
                      </span>
                      {meta.unit && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{meta.unit}</span>
                      )}
                    </div>
                    {meta.badge && (
                      <span className="text-[8px] font-extrabold text-slate-450 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-850/60 shrink-0">
                        {meta.badge}
                      </span>
                    )}
                    {meta.alarm && meta.alarmText && (
                      <span className="text-[8px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 animate-pulse shrink-0">
                        {meta.alarmText}
                      </span>
                    )}
                  </div>
                  <span className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${meta.barClass}`} />
                </div>
              );
            })}
          </div>
        )}

        {/* Customizable 12-Column Main Widgets Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {enabledMainWidgets.map((widget) => {
            const colClass = getColSpanClass(widget.colSpan);

            /* WIDGET 1: Temsilci & AI Çağrı Meşguliyet Durumları */
            if (widget.id === "agents_grid") {
              const gridColsClass =
                agentCardDensity === "compact"
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
                  : agentCardDensity === "detailed"
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

              return (
                <div
                  key={widget.id}
                  className={`${colClass} p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4 min-h-[380px]`}
                >
                  {/* Widget Header & Quick Filter / Density Toolbar */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
                    <div className="flex items-center gap-2">
                      <Volume2 size={15} className="text-violet-500 shrink-0" />
                      <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                        Temsilci & AI Çağrı Meşguliyet Durumları
                      </h4>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-[9px] font-extrabold text-slate-500 uppercase">
                        {filteredUsers.length}/{users.length} Temsilci{" "}
                        {activeCallsList.length > 0 ? `• ${activeCallsList.length} AI/Aktif` : ""}
                      </span>
                    </div>

                    {/* Quick Filters, Search & Card Density Switcher */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Filter Pills */}
                      <div className="flex items-center bg-slate-100/70 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        {[
                          { id: "ALL", label: "Tümü" },
                          { id: "Görüşmede", label: "Görüşmede" },
                          { id: "Müsait", label: "Müsait" },
                          { id: "Molada", label: "Molada" },
                          { id: "Çevrimdışı", label: "Çevrimdışı" }
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setAgentStatusFilter(st.id)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold transition-all ${
                              agentStatusFilter === st.id
                                ? `${bg} text-white shadow-sm`
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      {/* Search Box */}
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={agentSearchQuery}
                          onChange={(e) => setAgentSearchQuery(e.target.value)}
                          placeholder="İsim veya dahili..."
                          className="pl-7 pr-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none w-32"
                        />
                      </div>

                      {/* Density Quick Switch */}
                      <div className="flex items-center bg-slate-100/70 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        {[
                          { id: "compact", label: "Mini" },
                          { id: "standard", label: "Normal" },
                          { id: "detailed", label: "Detay" }
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setAgentCardDensity(d.id)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold ${
                              agentCardDensity === d.id
                                ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {filteredUsers.length === 0 && activeCallsList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic">
                      Seçilen filtreye uygun temsilci bulunamadı.
                    </div>
                  ) : (
                    <div className={`grid ${gridColsClass}`}>
                      {/* Active AI Calls Cards */}
                      {(agentStatusFilter === "ALL" || agentStatusFilter === "Görüşmede") &&
                        activeCallsList.map((ac) => {
                          const cardId = `ai-call-${ac.id}`;
                          const isMenuOpen = openMenuCardId === cardId;
                          const callerDisplay = ac.caller_name
                            ? `${ac.caller_name} (${ac.caller_number})`
                            : ac.caller_number || "Bilinmeyen Numara";

                          return (
                            <div
                              key={cardId}
                              className={`${
                                agentCardDensity === "compact" ? "p-2.5" : "p-3.5"
                              } bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl flex items-center justify-between gap-2 shadow-inner relative`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="relative shrink-0">
                                  <div
                                    className={`${
                                      agentCardDensity === "compact" ? "w-8 h-8" : "w-10 h-10"
                                    } rounded-xl bg-purple-100 dark:bg-purple-900/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300`}
                                  >
                                    <Bot size={agentCardDensity === "compact" ? 16 : 20} />
                                  </div>
                                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100/50">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 bg-purple-500 animate-ping"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600"></span>
                                    </span>
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">
                                    AI Asistan ({ac.callee_number || "200"})
                                  </p>
                                  <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 truncate mt-0.5">
                                    {callerDisplay}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-1.5 py-0.5 rounded-lg border text-[8px] font-extrabold uppercase bg-purple-100/80 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                  AI Görüşmede
                                </span>

                                {canMonitorAny && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuCardId(isMenuOpen ? null : cardId);
                                      }}
                                      title="Çağrıya Müdahale Et (Araya Gir / Sufle / Fısılda)"
                                      className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-all ${
                                        isMenuOpen
                                          ? `${bg} text-white border-transparent shadow-sm`
                                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400"
                                      }`}
                                    >
                                      <Headphones size={13} />
                                    </button>

                                    {isMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-8 z-40 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                                      >
                                        {monitorPerms.barge && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "barge",
                                                callId: ac.id,
                                                targetExt: ac.callee_number || "200",
                                                callerNumber: ac.caller_number,
                                                label: `AI Çağrısı (${callerDisplay})`,
                                                isAiCall: true
                                              })
                                            }
                                            className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                          >
                                            <PhoneCall size={12} className="text-rose-500 shrink-0" />
                                            <span>Araya Gir</span>
                                          </button>
                                        )}
                                        {monitorPerms.whisper && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "whisper",
                                                callId: ac.id,
                                                targetExt: ac.callee_number || "200",
                                                callerNumber: ac.caller_number,
                                                label: `AI Çağrısı (${callerDisplay})`,
                                                isAiCall: true
                                              })
                                            }
                                            className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                          >
                                            <Mic size={12} className="text-amber-500 shrink-0" />
                                            <span>Sufle</span>
                                          </button>
                                        )}
                                        {monitorPerms.listen && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "listen",
                                                callId: ac.id,
                                                targetExt: ac.callee_number || "200",
                                                callerNumber: ac.caller_number,
                                                label: `AI Çağrısı (${callerDisplay})`,
                                                isAiCall: true
                                              })
                                            }
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
                          );
                        })}

                      {/* Human Agents Cards */}
                      {filteredUsers.map((u) => {
                        const state = agentsState[u.id] ||
                          agentsState[String(u.id)] ||
                          agentsState[String(u.extension)] || { status: "Çevrimdışı", duration: 0, callsToday: 0 };
                        const cardId = `user-${u.id}`;
                        const isMenuOpen = openMenuCardId === cardId;

                        const isLongCallAlarm =
                          state.status === "Görüşmede" &&
                          Number(state.duration) >= (Number(thresholds.maxCallDurationSec) || 300);
                        const isLongBreakAlarm =
                          state.status === "Molada" &&
                          Number(state.duration) >= (Number(thresholds.maxBreakDurationSec) || 900);

                        let statusBorder = "border-slate-200/70 dark:border-slate-800/80";
                        let dotColor = "bg-slate-400";
                        let radarPulse = null;
                        let detailsText = `Dahili: ${u.extension}`;

                        if (state.status === "Müsait") {
                          statusBorder = "border-emerald-200/80 dark:border-emerald-900/30";
                          dotColor = "bg-primary";
                          radarPulse = "bg-emerald-450 animate-ping";
                        } else if (state.status === "Görüşmede") {
                          statusBorder = isLongCallAlarm
                            ? "border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20"
                            : "border-indigo-200/80 dark:border-indigo-900/30";
                          dotColor = "bg-primary";
                          radarPulse = "bg-primary animate-ping";
                          detailsText = `${state.caller || "Aktif Çağrı"} (${formatSeconds(state.duration)})`;
                        } else if (state.status === "Molada") {
                          statusBorder = isLongBreakAlarm
                            ? "border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20"
                            : "border-orange-200/80 dark:border-orange-900/30";
                          dotColor = "bg-orange-500";
                          detailsText = `${state.breakType || "Mola"} (${formatSeconds(state.duration)})`;
                        }

                        return (
                          <div
                            key={u.id}
                            className={`${
                              agentCardDensity === "compact" ? "p-2.5" : "p-3.5"
                            } bg-slate-50/50 dark:bg-slate-950/20 border rounded-2xl flex flex-col justify-between gap-2 shadow-inner relative ${statusBorder}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="relative shrink-0">
                                  <img
                                    src={u.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                                    alt={u.full_name}
                                    className={`${
                                      agentCardDensity === "compact" ? "w-8 h-8" : "w-10 h-10"
                                    } rounded-xl bg-white dark:bg-slate-900 border border-slate-200/40`}
                                  />
                                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100/50">
                                    <span className="relative flex h-2.5 w-2.5">
                                      {radarPulse && (
                                        <span
                                          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${radarPulse}`}
                                        ></span>
                                      )}
                                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
                                    </span>
                                  </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">
                                    {u.full_name}
                                  </p>
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

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded-lg border text-[8px] font-extrabold uppercase shrink-0 ${
                                    state.status === "Müsait"
                                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100"
                                      : state.status === "Görüşmede"
                                        ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100"
                                        : state.status === "Molada"
                                          ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-455 border-orange-100"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {state.status}
                                </span>

                                {canMonitorAny && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuCardId(isMenuOpen ? null : cardId);
                                      }}
                                      title="Dinleme / Müdahale Seçenekleri (Araya Gir - Sufle - Fısılda)"
                                      className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-all ${
                                        isMenuOpen
                                          ? `${bg} text-white border-transparent shadow-sm`
                                          : state.status === "Görüşmede"
                                            ? `${lightBg} ${text} ${borderLight} hover:opacity-90`
                                            : "bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800"
                                      }`}
                                    >
                                      <Headphones size={13} />
                                    </button>

                                    {isMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-8 z-40 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                                      >
                                        {monitorPerms.barge && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "barge",
                                                callId: state.call_id || "active",
                                                targetExt: String(u.extension || ""),
                                                callerNumber: state.caller || "",
                                                label: `${u.full_name} (${u.extension})`
                                              })
                                            }
                                            className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                          >
                                            <PhoneCall size={12} className="text-rose-500 shrink-0" />
                                            <span>Araya Gir</span>
                                          </button>
                                        )}
                                        {monitorPerms.whisper && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "whisper",
                                                callId: state.call_id || "active",
                                                targetExt: String(u.extension || ""),
                                                callerNumber: state.caller || "",
                                                label: `${u.full_name} (${u.extension})`
                                              })
                                            }
                                            className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                          >
                                            <Mic size={12} className="text-amber-500 shrink-0" />
                                            <span>Sufle</span>
                                          </button>
                                        )}
                                        {monitorPerms.listen && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerMonitor({
                                                mode: "listen",
                                                callId: state.call_id || "active",
                                                targetExt: String(u.extension || ""),
                                                callerNumber: state.caller || "",
                                                label: `${u.full_name} (${u.extension})`
                                              })
                                            }
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

                            {/* Detailed Density Extra Footer Row */}
                            {agentCardDensity === "detailed" && (
                              <div className="pt-2 mt-1 border-t border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between text-[9px] font-bold text-slate-500">
                                <span>Dahili: #{u.extension}</span>
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 font-extrabold text-slate-700 dark:text-slate-300">
                                  Bugün: {state.callsToday || 0} Çağrı
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            /* WIDGET 2: Canlı Aktif Görüşmeler Listesi */
            if (widget.id === "active_calls_table") {
              const busyHumanUsers = users.filter((u) => {
                const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
                return st?.status === "Görüşmede";
              });

              return (
                <div
                  key={widget.id}
                  className={`${colClass} p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <PhoneCall size={15} className="text-indigo-500" />
                      <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                        Canlı Aktif Görüşmeler Listesi
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold">
                      {activeCallsList.length + busyHumanUsers.length} Aktif Görüşme
                    </span>
                  </div>

                  {activeCallsList.length === 0 && busyHumanUsers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 italic">
                      Şu anda devam eden aktif bir görüşme bulunmuyor.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {activeCallsList.map((ac) => (
                        <div
                          key={`tbl-ai-${ac.id}`}
                          className="p-3 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
                              <Bot size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                {ac.caller_name || ac.caller_number || "Arayan Müşteri"} → AI Asistan ({ac.callee_number || "200"})
                              </p>
                              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                Kanal: Yapay Zeka Sesli Asistan
                              </p>
                            </div>
                          </div>

                          {canMonitorAny && (
                            <div className="flex items-center gap-1 shrink-0">
                              {monitorPerms.barge && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTriggerMonitor({
                                      mode: "barge",
                                      callId: ac.id,
                                      targetExt: ac.callee_number || "200",
                                      callerNumber: ac.caller_number,
                                      label: `AI (${ac.caller_number})`,
                                      isAiCall: true
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[9px] font-extrabold hover:bg-rose-100"
                                >
                                  Araya Gir
                                </button>
                              )}
                              {monitorPerms.whisper && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTriggerMonitor({
                                      mode: "whisper",
                                      callId: ac.id,
                                      targetExt: ac.callee_number || "200",
                                      callerNumber: ac.caller_number,
                                      label: `AI (${ac.caller_number})`,
                                      isAiCall: true
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-extrabold hover:bg-amber-100"
                                >
                                  Sufle
                                </button>
                              )}
                              {monitorPerms.listen && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTriggerMonitor({
                                      mode: "listen",
                                      callId: ac.id,
                                      targetExt: ac.callee_number || "200",
                                      callerNumber: ac.caller_number,
                                      label: `AI (${ac.caller_number})`,
                                      isAiCall: true
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-extrabold hover:bg-indigo-100"
                                >
                                  Fısılda
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {busyHumanUsers.map((u) => {
                        const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)] || {};
                        return (
                          <div
                            key={`tbl-hum-${u.id}`}
                            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={u.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                                alt={u.full_name}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                  {u.full_name} (#{u.extension}) ↔ {st.caller || "Aktif Çağrı"}
                                </p>
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                  Süre: {formatSeconds(st.duration)}
                                </p>
                              </div>
                            </div>

                            {canMonitorAny && (
                              <div className="flex items-center gap-1 shrink-0">
                                {monitorPerms.barge && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerMonitor({
                                        mode: "barge",
                                        callId: st.call_id || "active",
                                        targetExt: String(u.extension || ""),
                                        callerNumber: st.caller || "",
                                        label: `${u.full_name} (${u.extension})`
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[9px] font-extrabold"
                                  >
                                    Araya Gir
                                  </button>
                                )}
                                {monitorPerms.whisper && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerMonitor({
                                        mode: "whisper",
                                        callId: st.call_id || "active",
                                        targetExt: String(u.extension || ""),
                                        callerNumber: st.caller || "",
                                        label: `${u.full_name} (${u.extension})`
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-extrabold"
                                  >
                                    Sufle
                                  </button>
                                )}
                                {monitorPerms.listen && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerMonitor({
                                        mode: "listen",
                                        callId: st.call_id || "active",
                                        targetExt: String(u.extension || ""),
                                        callerNumber: st.caller || "",
                                        label: `${u.full_name} (${u.extension})`
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-extrabold"
                                  >
                                    Fısılda
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            /* WIDGET 3: Canlı Kuyruk (ACD) Durum Tablosu */
            if (widget.id === "queues_table") {
              return (
                <div
                  key={widget.id}
                  className={`${colClass} p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Users size={15} className="text-emerald-500" />
                      <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                        Canlı Kuyruk (ACD) Durum Tablosu
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-extrabold">
                      {queues.length} Kuyruk
                    </span>
                  </div>

                  {queues.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 italic">Tanımlı çağrı kuyruğu bulunamadı.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-[9px] font-extrabold text-slate-400 uppercase">
                            <th className="py-2 pr-2">Kuyruk Adı</th>
                            <th className="py-2 px-2">Strateji</th>
                            <th className="py-2 px-2 text-center">Üye</th>
                            <th className="py-2 px-2 text-center">Müsait</th>
                            <th className="py-2 pl-2 text-right">Görüşmede</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                          {queues.map((q) => {
                            const memberList = Array.isArray(q.members) ? q.members : [];
                            const qUsers = users.filter(
                              (u) =>
                                memberList.includes(String(u.extension)) ||
                                memberList.includes(String(u.id)) ||
                                memberList.includes(u.full_name)
                            );
                            const qAvail = qUsers.filter((u) => {
                              const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
                              return st?.status === "Müsait";
                            }).length;
                            const qBusy = qUsers.filter((u) => {
                              const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)];
                              return st?.status === "Görüşmede";
                            }).length;

                            return (
                              <tr key={q.id || q.name}>
                                <td className="py-2.5 pr-2 font-extrabold text-slate-800 dark:text-white">
                                  {q.name || q.queue_name}
                                </td>
                                <td className="py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase">
                                  {q.strategy || "ringall"}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {memberList.length || qUsers.length}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-extrabold">
                                    {qAvail}
                                  </span>
                                </td>
                                <td className="py-2.5 pl-2 text-right">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-extrabold">
                                    {qBusy}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            }

            /* WIDGET 4: Günün En'leri (Performans Sıralaması) */
            if (widget.id === "leaderboard") {
              return (
                <div
                  key={widget.id}
                  className={`${colClass} p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Trophy size={15} className="text-amber-500" />
                      <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                        Günün En'leri (Çağrı Liderlik Tablosu)
                      </h4>
                    </div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase">Bugün (00:00'dan İtibaren)</span>
                  </div>

                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {rankedLeaderboardUsers.slice(0, 8).map((u, idx) => {
                      const pct = Math.min(100, Math.round((u.callsToday / maxCallsToday) * 100));
                      return (
                        <div key={`lb-${u.id}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${
                                  idx === 0
                                    ? "bg-amber-100 text-amber-700"
                                    : idx === 1
                                      ? "bg-slate-200 text-slate-700"
                                      : idx === 2
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-white truncate">{u.full_name}</span>
                              <span className="text-[10px] font-bold text-slate-400">#{u.extension}</span>
                            </div>
                            <span className="font-mono font-black text-slate-800 dark:text-white">
                              {u.callsToday} <span className="text-[9px] font-bold text-slate-400 uppercase">Çağrı</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full ${bg} transition-all duration-500`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            /* WIDGET 5: Canlı Mola Takip Kutusu */
            if (widget.id === "break_tracker") {
              return (
                <div
                  key={widget.id}
                  className={`${colClass} p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Coffee size={15} className="text-orange-500" />
                      <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">
                        Canlı Mola Takip Kutusu
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-[9px] font-extrabold">
                      {onBreakUsers.length} Temsilci Molada
                    </span>
                  </div>

                  {onBreakUsers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 italic">
                      Şu anda molada olan temsilci bulunmuyor.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {onBreakUsers.map((u) => {
                        const st = agentsState[u.id] || agentsState[String(u.id)] || agentsState[String(u.extension)] || {};
                        const exceeded = Number(st.duration) >= (Number(thresholds.maxBreakDurationSec) || 900);
                        return (
                          <div
                            key={`brk-${u.id}`}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                              exceeded
                                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                                : "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900/40"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={u.avatar || "https://api.dicebear.com/7.x/avataaars/svg"}
                                alt={u.full_name}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                  {u.full_name} (#{u.extension})
                                </p>
                                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                  {st.breakType || "Mola"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono text-xs font-black ${
                                  exceeded ? "text-rose-600 dark:text-rose-400 animate-pulse" : "text-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {formatSeconds(st.duration)}
                              </span>
                              {exceeded && (
                                <p className="text-[8px] font-extrabold text-rose-500 uppercase">Süre Aşıldı</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
