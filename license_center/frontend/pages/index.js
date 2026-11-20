import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { 
  Shield,
  ShieldCheck, 
  ShieldAlert, 
  Server, 
  Cpu, 
  Activity, 
  PhoneCall, 
  Clock, 
  Key, 
  Plus, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Power, 
  Users, 
  Building2, 
  Globe, 
  Smartphone,
  Layers,
  LogOut,
  Terminal,
  Sun,
  Moon,
  Bot,
  GitMerge,
  Unlock,
  ExternalLink,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wifi,
  WifiOff,
  HardDrive,
  Database,
  Zap,
  X
} from "lucide-react";

import LoginModal from "../components/LoginModal";
import UserManagementModal from "../components/UserManagementModal";
import AuditLogsModal from "../components/AuditLogsModal";
import SecuritySettingsModal from "../components/SecuritySettingsModal";

const API_BASE = "";

export default function MasterDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    total_clients: 0,
    online_count: 0,
    offline_count: 0,
    expired_count: 0,
    expiring_soon_count: 0,
    total_active_calls: 0,
    total_licensed_subscribers: 0
  });
  const [kpiModalKey, setKpiModalKey] = useState(null);
  const EXPIRING_DAY_OPTIONS = [7, 15, 30, 60, 90, 120];
  const [expiringSoonDays, setExpiringSoonDays] = useState(15);
  const [savingExpiringDays, setSavingExpiringDays] = useState(false);
  const [expiringDaysSavedToast, setExpiringDaysSavedToast] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add Client Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [expiryDate, setExpiryDate] = useState("2027-12-31");
  const [planTier, setPlanTier] = useState("professional");
  const [newMaxConcurrentCalls, setNewMaxConcurrentCalls] = useState(4);
  const [newToleranceConcurrentCalls, setNewToleranceConcurrentCalls] = useState(0);
  const [newAllowedStt, setNewAllowedStt] = useState(["google", "deepgram", "openai", "elevenlabs"]);
  const [newAllowedTts, setNewAllowedTts] = useState(["google", "elevenlabs", "openai"]);
  const [newAllowedLlm, setNewAllowedLlm] = useState(["google", "elevenlabs", "openai", "anthropic", "groq"]);

  // Search, Filter & View Mode
  const [searchTerm, setSearchTerm] = useState("");
  const [showTopbarSearch, setShowTopbarSearch] = useState(false);
  const topbarSearchRef = useRef(null);
  const topbarSearchInputRef = useRef(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [expandedClientIds, setExpandedClientIds] = useState({});
  const [deleteConfirmClient, setDeleteConfirmClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(false);

  const toggleExpandClient = (clientId) => {
    setExpandedClientIds((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  // Key Generator Studio Modal State
  const [keyGenModalClient, setKeyGenModalClient] = useState(null);
  const [genExpiryDate, setGenExpiryDate] = useState("2027-12-31");
  const [genHwId, setGenHwId] = useState("");
  const [generatedResultKey, setGeneratedResultKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  // Modals state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [initialEditUserId, setInitialEditUserId] = useState(null);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(15);
  const [idleLogoutMessage, setIdleLogoutMessage] = useState("");
  const lastActivityRef = useRef(Date.now());
  const [unlockConfirmClient, setUnlockConfirmClient] = useState(null);
  const [unlockingSubdomain, setUnlockingSubdomain] = useState(false);
  const [togglingSshId, setTogglingSshId] = useState(null);
  const [ssoLoadingId, setSsoLoadingId] = useState(null);
  const [otaLoadingId, setOtaLoadingId] = useState(null);
  const [actionBanner, setActionBanner] = useState(null);

  // Live Telemetry & Health Inspector Dashboard Modal State
  const [inspectorClient, setInspectorClient] = useState(null);
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const fetchInspectorDashboard = async (clientId, isInitial = false) => {
    if (!clientId) return;
    if (isInitial) setInspectorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${clientId}/telemetry-dashboard`);
      if (res.ok) {
        const data = await res.json();
        setInspectorData((prev) => {
          const livePt = {
            time: new Date().toLocaleTimeString("tr-TR"),
            cpu: Number(data.cpu_usage || 0),
            ram: Number(data.ram_usage || 0),
            calls: Number(data.active_calls || 0)
          };
          if (prev && Array.isArray(prev.history) && prev.history.length > 0 && !isInitial) {
            const nextHist = [...prev.history, livePt].slice(-30);
            return { ...data, history: nextHist };
          }
          const baseHist = Array.isArray(data.history) && data.history.length > 0 ? data.history : [livePt, livePt];
          return { ...data, history: baseHist };
        });
      }
    } catch (e) {
      console.error("Inspector dashboard error:", e);
    } finally {
      if (isInitial) setInspectorLoading(false);
    }
  };

  const openInspectorModal = (client) => {
    setInspectorClient(client);
    setInspectorData(null);
    fetchInspectorDashboard(client.id, true);
  };

  useEffect(() => {
    if (!inspectorClient) return;
    const timer = setInterval(() => {
      fetchInspectorDashboard(inspectorClient.id, false);
    }, 3000);
    return () => clearInterval(timer);
  }, [inspectorClient]);

  const buildSvgTrendPaths = (list, key, maxVal = 100, width = 480, height = 120) => {
    if (!Array.isArray(list) || list.length === 0) return { line: "", area: "" };
    const pts = list.length === 1 ? [list[0], list[0]] : list;
    const stepX = width / (pts.length - 1);
    const coords = pts.map((item, idx) => {
      const raw = Number(item[key] || 0);
      const clamped = Math.max(0, Math.min(maxVal || 1, raw));
      const x = Math.round(idx * stepX * 10) / 10;
      const y = Math.round((height - (clamped / (maxVal || 1)) * (height - 16) - 8) * 10) / 10;
      return { x, y };
    });
    const line = `M ${coords.map((p) => `${p.x},${p.y}`).join(" L ")}`;
    const area = `${line} L ${width},${height} L 0,${height} Z`;
    return { line, area };
  };

  const showBanner = (text, type = "success") => {
    setActionBanner({ text, type });
    setTimeout(() => setActionBanner(null), 5000);
  };

  const handleRootSsoLogin = async (client) => {
    setSsoLoadingId(client.id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${client.id}/sso-token`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" },
      });
      const data = await res.json();
      if (res.ok && data.sso_url) {
        window.open(data.sso_url, "_blank", "noopener,noreferrer");
        showBanner(`🚀 ${client.company_name} santraline Nornia Root (SSO) tam yetkili oturum açıldı.`, "success");
      } else {
        showBanner(data.detail || "Root SSO bağlantısı oluşturulamadı.", "error");
      }
    } catch (e) {
      showBanner("Root SSO isteği sırasında hata oluştu.", "error");
    } finally {
      setSsoLoadingId(null);
    }
  };

  const handleRemoteOtaUpdate = async (client) => {
    setOtaLoadingId(client.id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${client.id}/ota-update`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" },
      });
      const data = await res.json();
      if (res.ok) {
        showBanner(data.message || `⚡ ${client.company_name} santraline uzaktan OTA güncelleme emri iletildi.`, "success");
      } else {
        showBanner(data.detail || "OTA güncelleme başlatılamadı.", "error");
      }
    } catch (e) {
      showBanner("OTA güncelleme isteği sırasında bağlantı hatası oluştu.", "error");
    } finally {
      setOtaLoadingId(null);
    }
  };

  const handleToggleClientSsh = async (client) => {
    setTogglingSshId(client.id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${client.id}/toggle-ssh`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" },
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error("Toggle SSH error:", e);
    } finally {
      setTogglingSshId(null);
    }
  };

  // Remote Web SSH Terminal Modal state
  const [sshModalClient, setSshModalClient] = useState(null);
  const [sshUsername, setSshUsername] = useState("aida");
  const [sshConnected, setSshConnected] = useState(false);
  const [sshOutput, setSshOutput] = useState("");
  const [sshInputLine, setSshInputLine] = useState("");
  const [sshIsPasswordMode, setSshIsPasswordMode] = useState(false);
  const sshWsRef = useRef(null);
  const sshOutputBoxRef = useRef(null);

  const openSshModal = (client) => {
    if (sshWsRef.current) {
      try { sshWsRef.current.close(); } catch (e) {}
      sshWsRef.current = null;
    }
    setSshModalClient(client);
    setSshConnected(false);
    setSshOutput(
      `🔒 Nornia Connect Sıfır-Port Web SSH Köprüsü Hazır.\r\n` +
      `Hedef Santral: ${client.company_name} (${client.connect_subdomain}.nornia.com.tr | ${client.hardware_id})\r\n` +
      `Merkez SSH Yetkisi: ${client.remote_ssh_enabled !== false ? "AÇIK (Aktif)" : "KAPALI (Merkezden Kilitli)"}\r\n` +
      `Yukarıdan SSH kullanıcı adını (örn: aida veya root) girip "Canlı Terminal Bağlan" butonuna tıklayınız...\r\n`
    );
    setSshInputLine("");
    setSshIsPasswordMode(false);
  };

  const closeSshModal = () => {
    if (sshWsRef.current) {
      try { sshWsRef.current.close(); } catch (e) {}
      sshWsRef.current = null;
    }
    setSshConnected(false);
    setSshModalClient(null);
  };

  const startWebSshSession = () => {
    if (!sshModalClient || !sshModalClient.connect_subdomain) return;
    if (sshWsRef.current) {
      try { sshWsRef.current.close(); } catch (e) {}
      sshWsRef.current = null;
    }
    setSshOutput("");
    setSshIsPasswordMode(false);
    const sub = sshModalClient.connect_subdomain;
    const userClean = (sshUsername || "root").trim() || "root";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "panel.nornia.com.tr"
      ? "connect.nornia.com.tr"
      : `${window.location.hostname}:8050`;
    const wsUrl = `${proto}//${host}/api/v1/connect/web-ssh/${encodeURIComponent(sub)}?user=${encodeURIComponent(userClean)}`;

    try {
      const ws = new WebSocket(wsUrl);
      sshWsRef.current = ws;
      ws.onopen = () => {
        setSshConnected(true);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "output" && msg.data) {
            setSshOutput((prev) => {
              const next = prev + msg.data;
              return next.length > 120000 ? next.slice(-120000) : next;
            });
            const lower = msg.data.toLowerCase();
            if (lower.includes("password:") || lower.includes("parola:")) {
              setSshIsPasswordMode(true);
            } else if (lower.includes("$ ") || lower.includes("# ") || lower.includes("last login")) {
              setSshIsPasswordMode(false);
            }
            setTimeout(() => {
              if (sshOutputBoxRef.current) {
                sshOutputBoxRef.current.scrollTop = sshOutputBoxRef.current.scrollHeight;
              }
            }, 20);
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        setSshConnected(false);
        setSshIsPasswordMode(false);
      };
      ws.onerror = () => {
        setSshOutput((prev) => prev + "\r\n❌ WebSocket SSH tünel bağlantı hatası.\r\n");
        setSshConnected(false);
      };
    } catch (err) {
      setSshOutput((prev) => prev + `\r\n❌ Bağlantı başlatılamadı: ${err.message}\r\n`);
    }
  };

  const sendWebSshCommand = (e) => {
    if (e) e.preventDefault();
    if (!sshWsRef.current || sshWsRef.current.readyState !== WebSocket.OPEN) return;
    sshWsRef.current.send(JSON.stringify({ type: "input", data: sshInputLine + "\n" }));
    setSshInputLine("");
    if (sshIsPasswordMode) {
      setSshIsPasswordMode(false);
    }
  };

  const sendWebSshSignal = (sigChar) => {
    if (!sshWsRef.current || sshWsRef.current.readyState !== WebSocket.OPEN) return;
    sshWsRef.current.send(JSON.stringify({ type: "input", data: sigChar }));
  };

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Check login state on mount
  useEffect(() => {
    const savedUser = sessionStorage.getItem("master_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    const savedIdleMins = sessionStorage.getItem("master_auto_logout_mins");
    if (savedIdleMins !== null) {
      setAutoLogoutMinutes(Number(savedIdleMins));
    }
    setIsAuthChecking(false);

    // Fetch live security policy (auto_logout_minutes)
    fetch("/api/v1/security/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.policy && d.policy.auto_logout_minutes !== undefined) {
          setAutoLogoutMinutes(Number(d.policy.auto_logout_minutes));
          sessionStorage.setItem("master_auto_logout_mins", String(d.policy.auto_logout_minutes));
        }
      })
      .catch(() => {});

    const savedTheme = localStorage.getItem("master_theme");
    const isDark = savedTheme ? savedTheme === "dark" : false;
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDarkMode;
    setIsDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("master_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("master_theme", "light");
    }
  };

  const handleLogout = async (reason = "manual") => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "X-User-Name": currentUser?.username || "admin",
          "X-Logout-Reason": reason
        }
      });
    } catch (e) {}
    sessionStorage.removeItem("master_user");
    setCurrentUser(null);
  };

  // Inactivity Auto-Logout Watcher
  useEffect(() => {
    if (!currentUser || !autoLogoutMinutes || autoLogoutMinutes <= 0) return;

    lastActivityRef.current = Date.now();
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const idleCheckTimer = setInterval(() => {
      const elapsedMs = Date.now() - lastActivityRef.current;
      const limitMs = autoLogoutMinutes * 60 * 1000;
      if (elapsedMs >= limitMs) {
        setIdleLogoutMessage(
          `${autoLogoutMinutes} dakika boyunca işlem yapılmadığı için oturumunuz güvenlik amacıyla otomatik sonlandırıldı.`
        );
        handleLogout("idle_timeout");
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(idleCheckTimer);
    };
  }, [currentUser, autoLogoutMinutes]);

  // Sync per-user expiringSoonDays preference whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    const validOpts = [7, 15, 30, 60, 90, 120];
    const fromUser = Number(currentUser.expiring_soon_days);
    if (validOpts.includes(fromUser)) {
      setExpiringSoonDays(fromUser);
      try {
        localStorage.setItem(`master_expiring_days_${currentUser.id}`, String(fromUser));
      } catch (e) {}
      return;
    }
    try {
      const localVal = Number(localStorage.getItem(`master_expiring_days_${currentUser.id}`));
      if (validOpts.includes(localVal)) {
        setExpiringSoonDays(localVal);
      }
    } catch (e) {}
    // Also fetch latest persisted preference from DB in case sessionStorage predated this field
    fetch("/api/v1/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!Array.isArray(list)) return;
        const me = list.find((u) => u.id === currentUser.id);
        const dbDays = Number(me?.expiring_soon_days);
        if (validOpts.includes(dbDays)) {
          setExpiringSoonDays(dbDays);
          try {
            localStorage.setItem(`master_expiring_days_${currentUser.id}`, String(dbDays));
            const nextUser = { ...currentUser, expiring_soon_days: dbDays };
            sessionStorage.setItem("master_user", JSON.stringify(nextUser));
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.expiring_soon_days]);

  const handleChangeExpiringSoonDays = async (days) => {
    setExpiringSoonDays(days);
    setExpiringDaysSavedToast(false);
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`master_expiring_days_${currentUser.id}`, String(days));
    } catch (e) {}
    setSavingExpiringDays(true);
    try {
      const res = await fetch(`/api/v1/users/${currentUser.id}/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser.username || "admin"
        },
        body: JSON.stringify({ expiring_soon_days: days })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const updatedUser = data?.user || { ...currentUser, expiring_soon_days: days };
        setCurrentUser(updatedUser);
        try {
          sessionStorage.setItem("master_user", JSON.stringify(updatedUser));
        } catch (e) {}
        setExpiringDaysSavedToast(true);
        setTimeout(() => setExpiringDaysSavedToast(false), 2200);
      }
    } catch (e) {
      console.error("Save expiring_soon_days error:", e);
    } finally {
      setSavingExpiringDays(false);
    }
  };

  // Topbar Search Keyboard Shortcut (Cmd/Ctrl+K, Esc) & Click-Outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowTopbarSearch(true);
        setTimeout(() => topbarSearchInputRef.current?.focus(), 30);
      } else if (e.key === "Escape" && showTopbarSearch) {
        setShowTopbarSearch(false);
      }
    };
    const handleClickOutside = (e) => {
      if (showTopbarSearch && topbarSearchRef.current && !topbarSearchRef.current.contains(e.target)) {
        setShowTopbarSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTopbarSearch]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Auto-refresh fleet every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resClients = await fetch(`${API_BASE}/api/v1/clients`);
      if (resClients.ok) {
        const dataClients = await resClients.json();
        setClients(dataClients);
      }

      const resStats = await fetch(`${API_BASE}/api/v1/stats`);
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNewProvider = (listState, setListState, providerId) => {
    setListState((prev) => {
      if (prev.includes(providerId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== providerId);
      }
      return [...prev, providerId];
    });
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!companyName || !tenantCode) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/clients`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          company_name: companyName,
          tenant_code: tenantCode.toLowerCase().trim(),
          hardware_id: hardwareId.trim() || "UNBOUND",
          license_expires_at: expiryDate,
          plan_tier: planTier,
          custom_quotas: {
            max_concurrent_calls: parseInt(newMaxConcurrentCalls, 10) || 4,
            tolerance_concurrent_calls: Math.max(0, parseInt(newToleranceConcurrentCalls, 10) || 0),
            allowed_stt_providers: newAllowedStt,
            allowed_tts_providers: newAllowedTts,
            allowed_llm_providers: newAllowedLlm
          }
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setCompanyName("");
        setTenantCode("");
        setHardwareId("");
        setNewMaxConcurrentCalls(4);
        setNewToleranceConcurrentCalls(0);
        fetchData();
      }
    } catch (e) {
      console.error("Client create error:", e);
    }
  };

  const handleToggleSuspend = async (client) => {
    const newStatus = client.status === "suspended" ? "active" : "suspended";
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${client.id}/status`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Status toggle error:", e);
    }
  };

  const confirmDeleteClient = async () => {
    if (!deleteConfirmClient) return;
    setDeletingClient(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${deleteConfirmClient.id}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        setDeleteConfirmClient(null);
        fetchData();
      }
    } catch (e) {
      console.error("Delete client error:", e);
    } finally {
      setDeletingClient(false);
    }
  };

  const AI_QUOTA_FIELDS = [
    { key: "max_agents", label: "AI Temsilcileri", defaultVal: 10, unit: "Hak" },
    { key: "max_rag_docs", label: "Bilgi Bankası (RAG)", defaultVal: 200, unit: "Doküman" },
    { key: "max_scenarios", label: "Senaryo Editörü", defaultVal: 30, unit: "Akış" }
  ];

  const STT_PROVIDER_LIST = [
    { id: "google", label: "Google Gemini STT (Dahili)" },
    { id: "deepgram", label: "Deepgram Nova-2 STT" },
    { id: "openai", label: "OpenAI Whisper STT" },
    { id: "elevenlabs", label: "ElevenLabs Scribe / ConvAI STT" }
  ];

  const TTS_PROVIDER_LIST = [
    { id: "google", label: "Google Gemini Dahili Ses Motoru" },
    { id: "elevenlabs", label: "ElevenLabs TTS (Kütüphane & Klon Ses)" },
    { id: "openai", label: "OpenAI TTS (Alloy / Nova / Shimmer)" }
  ];

  const LLM_PROVIDER_LIST = [
    { id: "google", label: "Google Gemini (Multimodal Live)" },
    { id: "elevenlabs", label: "ElevenLabs (Conversational AI)" },
    { id: "openai", label: "OpenAI (GPT-4o / Realtime)" },
    { id: "anthropic", label: "Anthropic (Claude 3.5 Sonnet)" },
    { id: "groq", label: "Groq (Fast LLM - Llama 3)" }
  ];

  const PBX_QUOTA_FIELDS = [
    { key: "max_concurrent_calls", label: "Eş Zamanlı Çağrı Kanalı (AI+Dialer+User)", defaultVal: 4, unit: "Kanal" },
    { key: "tolerance_concurrent_calls", label: "Tolerans Eş Zamanlı Çağrı (+Kanal)", defaultVal: 0, unit: "+Kanal" },
    { key: "max_users", label: "Kullanıcılar", defaultVal: 50, unit: "Kişi" },
    { key: "max_trunks", label: "Dış Hat (SIP Trunk)", defaultVal: 10, unit: "Hat" },
    { key: "max_queues", label: "Kuyruklar", defaultVal: 20, unit: "Kuyruk" },
    { key: "max_announcements", label: "Anonslar", defaultVal: 30, unit: "Ses" },
    { key: "max_inbound_rules", label: "Gelen Arama Kuralları", defaultVal: 50, unit: "Kural" },
    { key: "max_outbound_rules", label: "Giden Arama Kuralları", defaultVal: 50, unit: "Kural" },
    { key: "max_pickup_groups", label: "Çağrı Toplama", defaultVal: 15, unit: "Grup" },
    { key: "max_subscriber_groups", label: "Abone Grubu", defaultVal: 15, unit: "Grup" },
    { key: "max_phonebook_contacts", label: "Rehber Kişileri", defaultVal: 2000, unit: "Kişi" },
    { key: "max_conference_rooms", label: "Konferans Odaları", defaultVal: 15, unit: "Oda" },
    { key: "max_speed_dials", label: "Hızlı Arama", defaultVal: 100, unit: "Kayıt" },
    { key: "max_blacklist_entries", label: "Numara Engelleme", defaultVal: 500, unit: "Numara" },
    { key: "max_locations", label: "Lokasyon", defaultVal: 10, unit: "Lokasyon" },
    { key: "max_departments", label: "Departman", defaultVal: 15, unit: "Departman" }
  ];

  const FLOW_QUOTA_FIELDS = [
    { key: "max_call_flows", label: "Arama Akış Yönetimi (Workflows)", defaultVal: 20, unit: "Akış" },
    { key: "max_dialers", label: "Dış Arama Dialer", defaultVal: 10, unit: "Dialer" }
  ];

  const SANTRAL_MODULE_CATEGORIES = [
    {
      id: "operations",
      title: "Operasyon & Canlı İzleme",
      items: [
        { id: "dashboard", label: "Gerçek Zamanlı AI Pano" },
        { id: "wallboard", label: "Canlı İzleme Paneli (Wallboard)" },
        { id: "realtime_calls", label: "Canlı Çağrı İzleme & Müdahale" },
        { id: "supervisor", label: "Süpervizör İşlemleri" },
        { id: "call_monitor", label: "Dinleme / Sufle / Araya Girme" },
        { id: "call_panel", label: "Temsilci Çağrı Paneli (WebPhone)" },
        { id: "cti_integration", label: "CTI & CRM Entegrasyonu" },
        { id: "customer_360", label: "Müşteri 360° Kartı" },
        { id: "callback_tasks", label: "Geri Arama Planlayıcı" },
        { id: "crisis_alerts", label: "Canlı Kriz & Duygu Radarı" },
        { id: "live_translator", label: "Canlı Çeviri & Simultane Tercüman" },
        { id: "omnichannel", label: "Ortak Gelen Kutusu (Omnichannel)" },
        { id: "api_budgets", label: "API Bütçe ve Tüketim" }
      ]
    },
    {
      id: "ai",
      title: "Yapay Zeka & Bilgi Bankası",
      items: [
        { id: "ai_agents", label: "AI Temsilcileri" },
        { id: "ai_config_assistant", label: "AI Konfigürasyon Asistanı" },
        { id: "rag_kb", label: "Bilgi Bankası (RAG)" },
        { id: "rule_editor", label: "Kural & Senaryo Editörü" },
        { id: "ai_providers", label: "Yapay Zeka API Ayarları" },
        { id: "ai_task_routing", label: "AI Görev & Model Yönlendirme" }
      ]
    },
    {
      id: "pbx",
      title: "Santral & Haberleşme",
      items: [
        { id: "users", label: "Kullanıcılar & Dahililer" },
        { id: "announcements", label: "Anons Yönetimi" },
        { id: "acd_queues", label: "ACD Kuyruk" },
        { id: "autoprovision", label: "Oto Provizyon" },
        { id: "outbound_rules", label: "Giden Arama Kuralı" },
        { id: "inbound_rules", label: "Gelen Arama Kuralı" },
        { id: "call_pickup_groups", label: "Çağrı Toplama Grubu" },
        { id: "subscriber_groups", label: "Abone Grubu" },
        { id: "bulk_config", label: "Toplu Konfigürasyon Merkezi" },
        { id: "contacts", label: "Rehber" },
        { id: "trunks", label: "Dış Hat Tanımı (SIP Trunk)" },
        { id: "conferences", label: "Konferans Odaları" },
        { id: "speed_dials", label: "Hızlı Arama" },
        { id: "blacklist", label: "Numara Engelleme" },
        { id: "scheduled_reports", label: "Zamanlanmış Raporlar" }
      ]
    },
    {
      id: "routing",
      title: "Çağrı Akışı & Yönlendirme",
      items: [
        { id: "call_flow", label: "Arama Akış Yönetimi (IVR)" },
        { id: "work_hours", label: "Mesai Saatleri & Resmi Tatiller" },
        { id: "dialer", label: "Dış Arama (Auto-Dialer)" },
        { id: "calendar", label: "Randevu Takvimi" }
      ]
    },
    {
      id: "reports",
      title: "Raporlama & İleri Analitik",
      items: [
        { id: "reports_all", label: "Tüm Standart & Kurumsal Raporlar" },
        { id: "reports_custom_builder", label: "Özel Rapor Tasarımcısı & AI Rapor" },
        { id: "reports_pano", label: "Rapor Panosu" },
        { id: "reports_cdr", label: "CDR Çağrı Kayıtları" },
        { id: "reports_audio", label: "Ses Kayıtları" },
        { id: "reports_transcripts", label: "Çağrı Transkriptleri" },
        { id: "reports_sentiment", label: "Duygu Analizi & Isı Haritası" },
        { id: "reports_qa", label: "AI Kalite Değerlendirmeleri" },
        { id: "reports_perf", label: "Temsilci Performans & KPI" },
        { id: "reports_roi", label: "AI vs İnsan ROI Paneli" },
        { id: "reports_ceo_summary", label: "CEO Özet Raporu" }
      ]
    },
    {
      id: "settings_integrations",
      title: "Entegrasyonlar, Kalite & Sistem",
      items: [
        { id: "pbx", label: "Santral Entegrasyonu" },
        { id: "qa", label: "Çağrı Kalite Kontrol Ayarları" },
        { id: "locations", label: "Lokasyon ve Departmanlar" },
        { id: "numbering_plan", label: "Numara Planı" },
        { id: "lang_detect", label: "Otomatik Dil Algılama" },
        { id: "emotion_management", label: "Dinamik Duygu Yönetimi" },
        { id: "ai_whisper", label: "AI Fısıldama Yönetimi" },
        { id: "voice_biometrics", label: "Biyometrik Ses Analizi" },
        { id: "channels", label: "Kanal Entegrasyonları" },
        { id: "breaks", label: "Mola Tanımları" },
        { id: "canned_responses", label: "Hızlı Cevaplar" },
        { id: "crm_integrations", label: "Hazır CRM Entegrasyon Marketi" },
        { id: "active_directory", label: "Active Directory (LDAP & SSO)" },
        { id: "universal_api", label: "Evrensel API Sihirbazı" },
        { id: "api_management", label: "Kurumsal Dış API & Token" },
        { id: "autoprovision_templates", label: "Otoprovizyon Şablonları" },
        { id: "roi_settings", label: "ROI Rapor Ayarları" },
        { id: "ssl", label: "SSL Sertifikaları" },
        { id: "backup_restore", label: "Sistem Yedekleme" },
        { id: "recording_retention", label: "Kayıt & Saklama Sistemi" },
        { id: "email_notifications", label: "E-Mail Bildirimleri" },
        { id: "restore_points", label: "Geri Yükleme Noktası" },
        { id: "system_status", label: "Sistem Panosu & Sağlık" },
        { id: "logs", label: "Olay Günlükleri" },
        { id: "security", label: "Güvenlik Kalkanı" }
      ]
    }
  ];

  const ALL_SANTRAL_MODULE_IDS = SANTRAL_MODULE_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));

  const SUB_FEATURE_LIST = [
    { id: "whatsapp", label: "WhatsApp Business Cloud API Kanalı" },
    { id: "instagram_meta", label: "Instagram & Facebook Messenger Kanalı" },
    { id: "telegram", label: "Telegram Bot Kanalı" },
    { id: "email", label: "E-Posta (IMAP/SMTP) Kanalı" },
    { id: "live_translation", label: "WebPhone: Anlık Altyazı Konuşma Çevirisi" },
    { id: "voice_interpreter", label: "WebPhone: Simultane Çift Yönlü Sesli Tercüman" },
    { id: "ai_note_assistant", label: "WebPhone: AI Çağrı Özeti & Sonuç Kodu Asistanı" },
    { id: "call_monitor", label: "Süpervizör: Canlı Dinleme / Sufle / Araya Girme" },
    { id: "pause_recording", label: "KVKK & Kredi Kartı Ses Kaydı Maskeleme" },
    { id: "cti_screen_pop", label: "CTI Müşteri Kartı Otomatik Açma (Screen Pop)" }
  ];

  const [genCustomQuotas, setGenCustomQuotas] = useState({});
  const [genPlanTier, setGenPlanTier] = useState("professional");
  const [genIsUnlimited, setGenIsUnlimited] = useState(false);
  const [genStatus, setGenStatus] = useState("active");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [genError, setGenError] = useState("");

  const openKeyGenModal = (client) => {
    setKeyGenModalClient(client);
    const exp = client.license_expires_at || "2027-12-31";
    const isUnl = exp === "unlimited" || client.plan_tier === "unlimited";
    setGenExpiryDate(isUnl ? "" : exp);
    setGenIsUnlimited(isUnl);
    setGenHwId(client.hardware_id || "UNBOUND");
    setGenPlanTier(client.plan_tier || "professional");
    setGenStatus(client.status || "active");
    setGeneratedResultKey("");
    setGenError("");

    const existingQuotas = client.custom_quotas || {};
    const initQ = {};
    [...AI_QUOTA_FIELDS, ...PBX_QUOTA_FIELDS, ...FLOW_QUOTA_FIELDS].forEach(f => {
      initQ[f.key] = existingQuotas[f.key] !== undefined ? existingQuotas[f.key] : f.defaultVal;
    });
    initQ.allowed_stt_providers = Array.isArray(existingQuotas.allowed_stt_providers) && existingQuotas.allowed_stt_providers.length > 0
      ? existingQuotas.allowed_stt_providers
      : STT_PROVIDER_LIST.map(p => p.id);
    initQ.allowed_tts_providers = Array.isArray(existingQuotas.allowed_tts_providers) && existingQuotas.allowed_tts_providers.length > 0
      ? existingQuotas.allowed_tts_providers
      : TTS_PROVIDER_LIST.map(p => p.id);
    initQ.allowed_llm_providers = Array.isArray(existingQuotas.allowed_llm_providers) && existingQuotas.allowed_llm_providers.length > 0
      ? existingQuotas.allowed_llm_providers
      : LLM_PROVIDER_LIST.map(p => p.id);

    initQ.allowed_features = Array.isArray(existingQuotas.allowed_features) && existingQuotas.allowed_features.length > 0 && !existingQuotas.allowed_features.includes("*")
      ? existingQuotas.allowed_features
      : ALL_SANTRAL_MODULE_IDS;
    initQ.allowed_sub_features = Array.isArray(existingQuotas.allowed_sub_features) && existingQuotas.allowed_sub_features.length > 0 && !existingQuotas.allowed_sub_features.includes("*")
      ? existingQuotas.allowed_sub_features
      : SUB_FEATURE_LIST.map(s => s.id);
    initQ.unlicensed_module_mode = existingQuotas.unlicensed_module_mode || "hidden";
    initQ.hide_provider_infra_from_customer_admin = existingQuotas.hide_provider_infra_from_customer_admin !== undefined
      ? Boolean(existingQuotas.hide_provider_infra_from_customer_admin)
      : false;
    initQ.enforced_retention_days = existingQuotas.enforced_retention_days !== undefined
      ? Number(existingQuotas.enforced_retention_days)
      : 0;
    initQ.enforced_max_backups = existingQuotas.enforced_max_backups !== undefined
      ? Number(existingQuotas.enforced_max_backups)
      : 0;

    setGenCustomQuotas(initQ);
  };

  const applyModulePreset = (presetType) => {
    if (presetType === "all") {
      setGenCustomQuotas((prev) => ({ ...prev, allowed_features: [...ALL_SANTRAL_MODULE_IDS] }));
    } else if (presetType === "pbx_only") {
      const pbxAndRoutingIds = [
        "call_panel", "users", "announcements", "acd_queues", "autoprovision",
        "outbound_rules", "inbound_rules", "call_pickup_groups", "subscriber_groups",
        "bulk_config", "contacts", "trunks", "conferences", "speed_dials", "blacklist",
        "call_flow", "work_hours", "reports_pano", "reports_cdr", "reports_audio",
        "pbx", "locations", "numbering_plan", "breaks", "autoprovision_templates",
        "ssl", "backup_restore", "recording_retention", "email_notifications",
        "restore_points", "system_status", "logs", "security"
      ];
      setGenCustomQuotas((prev) => ({ ...prev, allowed_features: pbxAndRoutingIds }));
    } else if (presetType === "professional") {
      const proIds = ALL_SANTRAL_MODULE_IDS.filter(
        (id) => !["voice_biometrics", "live_translator", "crisis_alerts", "reports_custom_builder", "active_directory"].includes(id)
      );
      setGenCustomQuotas((prev) => ({ ...prev, allowed_features: proIds }));
    }
  };

  const toggleCategoryModules = (catItems) => {
    const catIds = catItems.map((i) => i.id);
    setGenCustomQuotas((prev) => {
      const cur = Array.isArray(prev.allowed_features) ? prev.allowed_features : [];
      const allSelected = catIds.every((id) => cur.includes(id));
      if (allSelected) {
        const next = cur.filter((id) => !catIds.includes(id));
        return { ...prev, allowed_features: next.length > 0 ? next : ["call_panel"] };
      } else {
        return { ...prev, allowed_features: Array.from(new Set([...cur, ...catIds])) };
      }
    });
  };

  const toggleProviderOption = (quotaKey, providerId) => {
    setGenCustomQuotas(prev => {
      const currentList = Array.isArray(prev[quotaKey]) ? prev[quotaKey] : [];
      if (currentList.includes(providerId)) {
        if (currentList.length <= 1) return prev; // Keep at least 1 selected
        return { ...prev, [quotaKey]: currentList.filter(id => id !== providerId) };
      } else {
        return { ...prev, [quotaKey]: [...currentList, providerId] };
      }
    });
  };

  const handleGenerateCustomKey = async (e) => {
    e.preventDefault();
    if (!keyGenModalClient) return;

    setIsGeneratingKey(true);
    setGenError("");
    setGeneratedResultKey("");

    const finalExpiry = genIsUnlimited ? "unlimited" : (genExpiryDate || "2027-12-31");
    const finalQuotas = {
      ...genCustomQuotas,
      plan_tier: genPlanTier,
      status: genStatus,
      is_unlimited: genIsUnlimited,
      license_expires_at: finalExpiry
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/licenses/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          client_id: keyGenModalClient.id,
          tenant_code: keyGenModalClient.tenant_code,
          expiry_date: finalExpiry,
          hardware_id: genHwId || keyGenModalClient.hardware_id || "UNBOUND",
          plan_tier: genPlanTier,
          custom_quotas: finalQuotas
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedResultKey(data.license_key);
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setGenError(errData.detail || "Lisans anahtarı üretilirken bir hata oluştu.");
      }
    } catch (e) {
      console.error("Key generate error:", e);
      setGenError("Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleQuotaChange = (key, val) => {
    const num = parseInt(val, 10);
    setGenCustomQuotas(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num
    }));
  };


  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredClients = clients.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchSearch = c.company_name.toLowerCase().includes(q) ||
                        c.tenant_code.toLowerCase().includes(q) ||
                        (c.tenant_serial_number && c.tenant_serial_number.toLowerCase().includes(q)) ||
                        (c.system_serial_number && c.system_serial_number.toLowerCase().includes(q)) ||
                        (c.hardware_id && c.hardware_id.toLowerCase().includes(q));
    if (filterStatus === "online") return matchSearch && c.is_online;
    if (filterStatus === "offline") return matchSearch && !c.is_online;
    if (filterStatus === "suspended") return matchSearch && c.status === "suspended";
    return matchSearch;
  });

  const getClientUserLicenseCount = (c) => {
    const raw = c?.custom_quotas?.max_users;
    if (raw !== undefined && raw !== null && raw !== "" && !Number.isNaN(Number(raw))) {
      return Math.max(0, Number(raw));
    }
    return 50;
  };

  const onlineClientsList = clients.filter((c) => Boolean(c.is_online));
  const offlineClientsList = clients.filter((c) => !c.is_online);
  const expiringSoonClientsList = [...clients]
    .filter(
      (c) =>
        c.status === "active" &&
        typeof c.days_left === "number" &&
        c.days_left >= 0 &&
        c.days_left <= expiringSoonDays
    )
    .sort((a, b) => Number(a.days_left ?? 9999) - Number(b.days_left ?? 9999));
  const expiredClientsList = clients.filter(
    (c) => c.status === "expired" || c.status === "suspended"
  );
  const activeCallClientsList = [...clients]
    .filter((c) => Number(c.active_calls_count || 0) > 0)
    .sort((a, b) => Number(b.active_calls_count || 0) - Number(a.active_calls_count || 0));
  const totalLicensedSubscribers =
    clients.length > 0
      ? clients.reduce((acc, c) => acc + getClientUserLicenseCount(c), 0)
      : Number(stats.total_licensed_subscribers || 0);
  const totalRegisteredSubscribers = clients.reduce(
    (acc, c) => acc + Number(c.total_users_count || 0),
    0
  );

  const kpiModalConfig = (() => {
    if (!kpiModalKey) return null;
    const map = {
      total: {
        title: "Toplam Kurulum — Tüm Sunucular",
        subtitle: "Merkezi lisans otoritesine kayıtlı tüm santral ve tenant sunucuları",
        accent: "indigo",
        filterShortcut: "all",
        list: clients
      },
      online: {
        title: "Canlı Sunucular",
        subtitle: "Aktif Heartbeat veya Nornia Connect tüneli bağlı olan çevrimiçi sunucular",
        accent: "emerald",
        filterShortcut: "online",
        list: onlineClientsList
      },
      offline: {
        title: "Çevrimdışı Sunucular",
        subtitle: "Son 15 dakikada heartbeat veya aktif tünel bağlantısı alınamayan sunucular",
        accent: "slate",
        filterShortcut: "offline",
        list: offlineClientsList
      },
      expiring_soon: {
        title: `Süresi Yaklaşan Sunucular (${expiringSoonDays} Gün)`,
        subtitle: `Lisans bitiş tarihine ${expiringSoonDays} gün veya daha az kalmış aktif sunucular`,
        accent: "amber",
        filterShortcut: null,
        list: expiringSoonClientsList
      },
      expired: {
        title: "Pasif / Durdurulan Sunucular",
        subtitle: "Askıya alınmış veya lisans süresi dolmuş sunucular",
        accent: "rose",
        filterShortcut: "suspended",
        list: expiredClientsList
      },
      subscribers: {
        title: "Toplam Abone Lisans Dağılımı",
        subtitle: `Sunuculardaki kullanıcı lisans kotası toplamı: ${totalLicensedSubscribers.toLocaleString("tr-TR")} Abone (${totalRegisteredSubscribers.toLocaleString("tr-TR")} aktif kayıtlı)`,
        accent: "violet",
        filterShortcut: null,
        list: [...clients].sort(
          (a, b) => getClientUserLicenseCount(b) - getClientUserLicenseCount(a)
        )
      },
      active_calls: {
        title: "Canlı Aktif Çağrı Olan Sunucular",
        subtitle: `Filo genelinde şu an toplam ${stats.total_active_calls || 0} aktif görüşme yürütülüyor`,
        accent: "blue",
        filterShortcut: null,
        list: activeCallClientsList
      }
    };
    return map[kpiModalKey] || null;
  })();

  if (!currentUser && !isAuthChecking) {
    return (
      <LoginModal
        idleLogoutMessage={idleLogoutMessage}
        onLoginSuccess={(user, idleMins) => {
          setIdleLogoutMessage("");
          if (idleMins !== undefined) setAutoLogoutMinutes(Number(idleMins));
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col font-sans">
      <Head>
        <title>Nornia Cloud Center — Merkezi Lisans &amp; Tünel Sunucusu</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xs dark:shadow-none">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center p-1.5 shadow-md shadow-indigo-500/10">
            <img src="/favicon.svg" alt="Nornia" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-300 bg-clip-text text-transparent">
              Nornia Cloud Center
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Merkezi Lisans &amp; Tünel Sunucusu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSecurityModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Merkez Güvenlik Kalkanı (Brute-Force, Engelli IP & Auto-Logout)"
          >
            <Shield size={14} className="text-rose-600 dark:text-rose-400" />
            <span className="hidden sm:inline">Güvenlik Kalkanı</span>
          </button>

          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Sistem İşlem Logları"
          >
            <Terminal size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">İşlem Logları</span>
          </button>

          <button
            onClick={() => {
              setInitialEditUserId(null);
              setShowUsersModal(true);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Master Kullanıcı Yönetimi & Kullanıcı Bazlı 2FA"
          >
            <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Kullanıcılar</span>
          </button>

          {/* Topbar Search Icon & Popover */}
          <div className="relative" ref={topbarSearchRef}>
            <button
              type="button"
              onClick={() => {
                setShowTopbarSearch((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => topbarSearchInputRef.current?.focus(), 30);
                  }
                  return next;
                });
              }}
              className={`h-9 w-9 rounded-xl border transition-colors flex items-center justify-center cursor-pointer shadow-xs dark:shadow-none relative ${
                showTopbarSearch || searchTerm.trim()
                  ? "border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              title="Sunucu / Firma Ara (Ctrl+K)"
            >
              <Search size={15} />
              {searchTerm.trim() && !showTopbarSearch && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {showTopbarSearch && (
              <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fadeIn">
                <div className="relative flex items-center">
                  <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    ref={topbarSearchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Firma, tenant kodu, alt alan adı, Seri No veya Donanım ID ara..."
                    className="w-full text-xs font-semibold pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        topbarSearchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      title="Temizle"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between px-1 pt-2 text-[10px] font-semibold text-slate-400">
                  <span>
                    {searchTerm.trim()
                      ? `${filteredClients.length} sonuç bulundu`
                      : "Anlık filtreleme (ESC ile kapat)"}
                  </span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    ⌘K
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer shadow-xs dark:shadow-none"
            title={isDarkMode ? "Aydınlık Moda Geç" : "Karanlık Moda Geç"}
          >
            {isDarkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
          </button>

          {/* Unified Red Plus (+) Add Button per AGENTS.md rule */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
            title="Yeni Müşteri & Sunucu Ekle"
          >
            <Plus size={16} />
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setInitialEditUserId(currentUser.id || null);
                  setShowUsersModal(true);
                }}
                className="text-right text-xs hidden md:block hover:opacity-80 transition-opacity cursor-pointer"
                title="Profil & Kendi 2FA Ayarlarınız"
              >
                <div className="font-extrabold text-slate-800 dark:text-white leading-tight flex items-center justify-end gap-1.5">
                  <span>{currentUser.full_name}</span>
                  {(currentUser.totp_enabled || currentUser.email_2fa_enabled) && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold">
                      2FA
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">@{currentUser.username}</div>
              </button>
              <button
                onClick={() => handleLogout("manual")}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Çıkış Yap"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1440px] mx-auto w-full">

        {actionBanner && (
          <div className={`p-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-3 animate-fadeIn ${
            actionBanner.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          }`}>
            <span>{actionBanner.text}</span>
            <button onClick={() => setActionBanner(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
          </div>
        )}

        {/* STATS OVERVIEW CARDS (7 CLICKABLE KPI CARDS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
          <button
            type="button"
            onClick={() => setKpiModalKey("total")}
            title="Tüm kayıtlı sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-indigo-400/70 dark:hover:border-indigo-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Toplam Kurulum</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{clients.length || stats.total_clients}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Kayıtlı Santral &amp; Tenant</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Server size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("online")}
            title="Canlı (çevrimiçi) sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-emerald-400/70 dark:hover:border-emerald-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Canlı Sunucular</div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>{onlineClientsList.length}</span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Aktif Heartbeat &amp; Tünel</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("offline")}
            title="Çevrimdışı sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-slate-400 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Çevrimdışı</div>
              <div className="text-2xl font-extrabold text-slate-600 dark:text-slate-300">{offlineClientsList.length}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Bağlantı Bekleyen</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-500/10 dark:bg-slate-500/15 border border-slate-500/20 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <WifiOff size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("expiring_soon")}
            title="Lisans süresi yaklaşan sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-amber-400/70 dark:hover:border-amber-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Süresi Yaklaşan</div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{expiringSoonClientsList.length}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">{expiringSoonDays} Gün İçinde Dolacak</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("expired")}
            title="Pasif veya durdurulan sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-rose-400/70 dark:hover:border-rose-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Pasif / Durdurulan</div>
              <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-500">{expiredClientsList.length}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Askıda veya Süresi Biten</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldAlert size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("subscribers")}
            title="Sunucu bazlı toplam abone lisans dağılımını görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-violet-400/70 dark:hover:border-violet-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Toplam Abone</div>
              <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{totalLicensedSubscribers.toLocaleString("tr-TR")}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Lisanslı Kullanıcı Adeti</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKpiModalKey("active_calls")}
            title="Aktif çağrı yürüten sunucuları görüntülemek için tıklayın"
            className="text-left p-4 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 hover:border-blue-400/70 dark:hover:border-blue-500/60 hover:-translate-y-0.5 transition-all rounded-2xl flex items-center justify-between gap-2 shadow-xs dark:shadow-none cursor-pointer group col-span-2 sm:col-span-1"
          >
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Canlı Aktif Çağrı</div>
              <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{stats.total_active_calls}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">Filo Geneli Görüşme</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PhoneCall size={18} />
            </div>
          </button>
        </div>

        {/* ACTIVE FILTER CHIPS & VIEW MODE SWITCHER */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {filterStatus !== "all" && (
              <span className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5">
                <span>
                  Filtre:{" "}
                  {filterStatus === "online"
                    ? "Canlı"
                    : filterStatus === "offline"
                      ? "Çevrimdışı"
                      : "Askıda"}
                </span>
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className="hover:text-rose-500 cursor-pointer"
                  title="Durum filtresini temizle"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {searchTerm.trim() && (
              <span className="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5">
                <Search size={12} />
                <span>&ldquo;{searchTerm.trim()}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="hover:text-rose-500 cursor-pointer"
                  title="Arama filtresini temizle"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* View Switcher: Icon-only Cards vs Table */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs dark:shadow-none">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Kart Görünümü"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Tablo Görünümü"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* CLIENT SERVER FLEET: MODERN 2-COLUMN CARDS OR TABLE VIEW */}
        {filteredClients.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Server size={22} />
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Eşleşen Sunucu veya Müşteri Bulunamadı</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Arama kriterlerinize uygun kayıtlı bir Nornia kurulumu bulunmuyor veya henüz yeni müşteri eklenmedi.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* CORPORATE TABLE VIEW */
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Müşteri / Tenant</th>
                    <th className="py-3.5 px-4">Santral Seri No &amp; Donanım</th>
                    <th className="py-3.5 px-4">Nornia Connect &amp; SSH</th>
                    <th className="py-3.5 px-4">Kaynak &amp; Kanal</th>
                    <th className="py-3.5 px-4">Lisans Bitiş Tarihi</th>
                    <th className="py-3.5 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                  {filteredClients.map((client) => {
                    const isSuspended = client.status === "suspended";
                    const pbxSerial =
                      client.system_serial_number && client.system_serial_number !== "Henüz Bağlanmadı"
                        ? client.system_serial_number
                        : client.tenant_serial_number || "Henüz Bağlanmadı";
                    return (
                      <tr key={client.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isSuspended ? "bg-rose-500" : client.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`} />
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm">{client.company_name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">{client.tenant_code}</span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {client.plan_tier || "professional"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1.5 font-extrabold text-indigo-700 dark:text-indigo-300">
                            <span>{pbxSerial}</span>
                            {pbxSerial && pbxSerial !== "Henüz Bağlanmadı" && (
                              <button
                                onClick={() => handleCopyText(pbxSerial, `tbl-sn-${client.id}`)}
                                className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                                title="Santral Seri Numarasını Kopyala"
                              >
                                {copiedKey === `tbl-sn-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <span>{client.hardware_id}</span>
                            <button
                              onClick={() => handleCopyText(client.hardware_id, `tbl-hw-${client.id}`)}
                              className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                              title="Donanım ID Kopyala"
                            >
                              {copiedKey === `tbl-hw-${client.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                            <span>•</span>
                            <span>{client.ip_address || "127.0.0.1"}</span>
                            <span>•</span>
                            <span>{client.software_version || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {client.connect_subdomain ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 font-mono text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                  {client.connect_subdomain}
                                </span>
                                <a
                                  href={`https://${client.connect_subdomain}.nornia.com.tr`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{client.connect_subdomain}.nornia.com.tr</span>
                                  <ExternalLink size={11} />
                                </a>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  client.tunnel_connected
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                                }`}>
                                  {client.tunnel_connected ? "Tünel Aktif" : "Bağlı Değil"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={ssoLoadingId === client.id}
                                  onClick={() => handleRootSsoLogin(client)}
                                  className="px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Şifre yazmadan Nornia Root (Servis Sağlayıcı) tam yetkisiyle santrale doğrudan giriş yap"
                                >
                                  <ShieldCheck size={10} />
                                  <span>{ssoLoadingId === client.id ? "..." : "Root SSO"}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={otaLoadingId === client.id || !client.tunnel_connected}
                                  onClick={() => handleRemoteOtaUpdate(client)}
                                  className="px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-300 hover:text-white border border-cyan-500/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                                  title="Nornia Connect tüneli üzerinden santrali uzaktan tek tıkla güncelle (OTA Update)"
                                >
                                  <RefreshCw size={10} className={otaLoadingId === client.id ? "animate-spin" : ""} />
                                  <span>{otaLoadingId === client.id ? "..." : "OTA Güncelle"}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={togglingSshId === client.id}
                                  onClick={() => handleToggleClientSsh(client)}
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                                    client.remote_ssh_enabled !== false
                                      ? "bg-emerald-500/10 hover:bg-rose-600 text-emerald-600 dark:text-emerald-300 hover:text-white border-emerald-500/30"
                                      : "bg-rose-500/10 hover:bg-emerald-600 text-rose-600 dark:text-rose-300 hover:text-white border-rose-500/30"
                                  }`}
                                  title={
                                    client.remote_ssh_enabled !== false
                                      ? "Santralde SSH Erişimi AÇIK — Kapatmak için tıklayın"
                                      : "Santralde SSH Erişimi KAPALI — Açmak için tıklayın"
                                  }
                                >
                                  <Power size={9} />
                                  <span>{togglingSshId === client.id ? "..." : client.remote_ssh_enabled !== false ? "SSH Açık" : "SSH Kapalı"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUnlockConfirmClient(client)}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-300 hover:text-white border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                                  title="Santraldeki Nornia Connect Alt Alan Adı Kilidini Serbest Bırak"
                                >
                                  <Unlock size={10} />
                                  <span>Kilidi Çöz</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Tünel Tanımsız</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold">
                              {client.custom_quotas?.max_concurrent_calls ?? 4} +{client.custom_quotas?.tolerance_concurrent_calls ?? 0} Kanal
                            </span>
                            <span className="text-slate-500">
                              CPU {client.cpu_usage_percent || 0}% • RAM {client.ram_usage_percent || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {client.license_expires_at === "unlimited" ? "♾️ Limitsiz" : (client.license_expires_at || "-")}
                          </div>
                          {client.days_left !== null && client.days_left !== undefined && (
                            <span className={`text-[10px] font-extrabold ${
                              client.days_left <= 7 ? "text-rose-500" : client.days_left <= expiringSoonDays ? "text-amber-500" : "text-emerald-500"
                            }`}>
                              {client.days_left} gün kaldı
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openInspectorModal(client)}
                              className="p-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-600 text-cyan-600 dark:text-cyan-400 hover:text-white border border-cyan-200 dark:border-cyan-500/30 transition-all cursor-pointer"
                              title="Canlı Sistem Sağlığı, CPU/RAM/Disk & Servisler Panosunu İncele"
                            >
                              <Search size={14} />
                            </button>
                            <button
                              onClick={() => openKeyGenModal(client)}
                              className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-500/30 transition-all cursor-pointer"
                              title="Lisans, Modül & Kota Ayarlarını Düzenle"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleSuspend(client)}
                              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                isSuspended
                                  ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-rose-500"
                              }`}
                              title={isSuspended ? "Aktifleştir" : "Askıya Al"}
                            >
                              <Power size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmClient(client)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Müşteriyi Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* MODERN SPACIOUS 2-COLUMN CLIENT CARDS */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredClients.map((client) => {
              const isSuspended = client.status === "suspended";
              const isExpired = client.days_left !== null && client.days_left <= 0;
              const isExpanded = !!expandedClientIds[client.id];
              const sttCount = (client.custom_quotas?.allowed_stt_providers || ["google", "deepgram", "openai", "elevenlabs"]).length;
              const ttsCount = (client.custom_quotas?.allowed_tts_providers || ["google", "elevenlabs", "openai"]).length;
              const llmCount = (client.custom_quotas?.allowed_llm_providers || ["google", "elevenlabs", "openai", "anthropic", "groq"]).length;

              return (
                <div
                  key={client.id}
                  className={`group relative bg-white dark:bg-slate-900/80 border rounded-2xl p-5 space-y-4 transition-all shadow-xs hover:shadow-md dark:shadow-none ${
                    isSuspended
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                      : isExpired
                      ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-slate-200/80 dark:border-slate-800/90 hover:border-indigo-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* 1. Card Header: Company Name, Tenant Pill, Plan Tier & Online/Days Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm border ${
                        isSuspended
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : client.is_online
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                      }`}>
                        {(client.company_name || "N").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                            {client.company_name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                            {client.tenant_code}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                            {client.plan_tier || "professional"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Cpu size={12} className="text-slate-400" />
                            <strong className="text-slate-700 dark:text-slate-300">{client.hardware_id}</strong>
                            <button
                              onClick={() => handleCopyText(client.hardware_id, `hw-${client.id}`)}
                              className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                              title="Donanım ID Kopyala"
                            >
                              {copiedKey === `hw-${client.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                          </span>
                          <span>•</span>
                          <span>{client.ip_address || "127.0.0.1"}</span>
                          <span>•</span>
                          <span>{client.software_version || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 border ${
                        isSuspended
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : client.is_online
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isSuspended ? "bg-rose-500" : client.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        }`} />
                        {isSuspended ? "Askıda" : client.is_online ? "Çevrimiçi" : "Çevrimdışı"}
                      </span>

                      {client.days_left !== null && client.days_left !== undefined && (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          client.days_left <= 7
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : client.days_left <= 30
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}>
                          {client.license_expires_at === "unlimited" ? "♾️ Limitsiz Lisans" : `${client.days_left} gün kaldı`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Nornia Connect & Zero-Port SSH Control Bar */}
                  {client.connect_subdomain && (
                    <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${client.tunnel_connected ? "bg-emerald-500" : "bg-slate-400"}`} />
                        <a
                          href={`https://${client.connect_subdomain}.nornia.com.tr`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
                          title="Nornia Connect Tüneli Üzerinden Santral Arayüzünü Aç"
                        >
                          <span>https://{client.connect_subdomain}.nornia.com.tr</span>
                          <ExternalLink size={12} />
                        </a>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          client.tunnel_connected
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}>
                          {client.tunnel_connected ? "Tünel Aktif" : "Bağlı Değil"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={ssoLoadingId === client.id}
                          onClick={() => handleRootSsoLogin(client)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Şifre yazmadan Nornia Root (Servis Sağlayıcı) tam yetkisiyle santrale doğrudan giriş yap"
                        >
                          <ShieldCheck size={11} />
                          <span>{ssoLoadingId === client.id ? "..." : "Santrali Yönet (SSO)"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={otaLoadingId === client.id || !client.tunnel_connected}
                          onClick={() => handleRemoteOtaUpdate(client)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                          title="Nornia Connect tüneli üzerinden santrali uzaktan tek tıkla güncelle (OTA Update)"
                        >
                          <RefreshCw size={11} className={otaLoadingId === client.id ? "animate-spin" : ""} />
                          <span>{otaLoadingId === client.id ? "Güncelleniyor..." : "OTA Güncelle"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={togglingSshId === client.id}
                          onClick={() => handleToggleClientSsh(client)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer ${
                            client.remote_ssh_enabled !== false
                              ? "bg-emerald-500/15 hover:bg-rose-600 text-emerald-700 dark:text-emerald-300 hover:text-white border-emerald-500/30"
                              : "bg-rose-500/15 hover:bg-emerald-600 text-rose-700 dark:text-rose-300 hover:text-white border-rose-500/30"
                          }`}
                          title={
                            client.remote_ssh_enabled !== false
                              ? "Santralde SSH Erişimi AÇIK — Kapatmak için tıklayın"
                              : "Santralde SSH Erişimi KAPALI — Açmak için tıklayın"
                          }
                        >
                          <Power size={11} />
                          <span>
                            {togglingSshId === client.id
                              ? "..."
                              : client.remote_ssh_enabled !== false
                              ? "SSH Açık"
                              : "SSH Kapalı"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUnlockConfirmClient(client)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-500/30 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Santraldeki Nornia Connect Alt Alan Adı Kilidini Serbest Bırak"
                        >
                          <Unlock size={11} />
                          <span>Kilidi Çöz</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2.5 Key Identity Strip: Santral Seri No, Lisans Bitiş Tarihi & Nornia Connect İsim */}
                  {(() => {
                    const cardSerial =
                      client.system_serial_number && client.system_serial_number !== "Henüz Bağlanmadı"
                        ? client.system_serial_number
                        : client.tenant_serial_number || "Henüz Bağlanmadı";
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Santral Seri No</div>
                          <div className="text-xs font-extrabold font-mono text-indigo-700 dark:text-indigo-300 mt-0.5 flex items-center gap-1.5">
                            <span className="truncate">{cardSerial}</span>
                            {cardSerial && cardSerial !== "Henüz Bağlanmadı" && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(cardSerial, `card-sn-${client.id}`)}
                                className="text-slate-400 hover:text-indigo-500 cursor-pointer shrink-0"
                                title="Santral Seri Numarasını Kopyala"
                              >
                                {copiedKey === `card-sn-${client.id}` ? (
                                  <Check size={11} className="text-emerald-500" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Lisans Bitiş Tarihi</div>
                          <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>
                              {client.license_expires_at === "unlimited"
                                ? "♾️ Limitsiz"
                                : client.license_expires_at || "—"}
                            </span>
                            {client.days_left !== null &&
                              client.days_left !== undefined &&
                              client.license_expires_at !== "unlimited" && (
                                <span
                                  className={`text-[10px] font-extrabold ${
                                    client.days_left <= 7
                                      ? "text-rose-500"
                                      : client.days_left <= expiringSoonDays
                                        ? "text-amber-500"
                                        : "text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  ({client.days_left}g)
                                </span>
                              )}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Nornia Connect Adı</div>
                          <div className="text-xs font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 truncate flex items-center gap-1">
                            <Globe size={12} className="shrink-0 text-emerald-500" />
                            <span className="truncate">
                              {client.connect_subdomain ? client.connect_subdomain : "Tanımsız"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Compact 4-Column Telemetry & Quota Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Çağrı Kanalı</div>
                      <div className="text-xs font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                        {client.custom_quotas?.max_concurrent_calls ?? 4} Kanal
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">
                          (+{client.custom_quotas?.tolerance_concurrent_calls ?? 0})
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Canlı Görüşme</div>
                      <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                        <PhoneCall size={12} className="text-emerald-500" />
                        <span>{client.active_calls_count || 0} Aktif</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                        <span>CPU / RAM</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {client.cpu_usage_percent || 0}% / {client.ram_usage_percent || 0}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5 flex">
                        <div
                          className="bg-indigo-500 h-full transition-all"
                          style={{ width: `${Math.min(100, client.cpu_usage_percent || 4)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">AI Motor Yetkisi</div>
                      <div className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1">
                        <Sparkles size={11} />
                        <span>{sttCount} STT • {ttsCount} TTS • {llmCount} LLM</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Collapsible Technical Details Drawer (Serials, Full License Key, AI Provider Badges) */}
                  {isExpanded && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-slate-500 font-sans font-bold">Tenant Seri No:</span>
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            {client.tenant_serial_number || "-"}
                            {client.tenant_serial_number && (
                              <button
                                onClick={() => handleCopyText(client.tenant_serial_number, `tsn-${client.id}`)}
                                className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                              >
                                {copiedKey === `tsn-${client.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                          <span className="text-slate-500 font-sans font-bold">Sistem Seri No:</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {client.system_serial_number || "-"}
                            {client.system_serial_number && client.system_serial_number !== "Henüz Bağlanmadı" && (
                              <button
                                onClick={() => handleCopyText(client.system_serial_number, `ssn-${client.id}`)}
                                className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                              >
                                {copiedKey === `ssn-${client.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* AI Providers Breakdown */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div>
                          <div className="text-[9px] font-extrabold text-slate-400 uppercase mb-1">İzinli STT</div>
                          <div className="flex flex-wrap gap-1">
                            {(client.custom_quotas?.allowed_stt_providers || ["google", "deepgram", "openai", "elevenlabs"]).map((p) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">{p}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-extrabold text-slate-400 uppercase mb-1">İzinli TTS</div>
                          <div className="flex flex-wrap gap-1">
                            {(client.custom_quotas?.allowed_tts_providers || ["google", "elevenlabs", "openai"]).map((p) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">{p}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-extrabold text-slate-400 uppercase mb-1">İzinli LLM</div>
                          <div className="flex flex-wrap gap-1">
                            {(client.custom_quotas?.allowed_llm_providers || ["google", "elevenlabs", "openai", "anthropic", "groq"]).map((p) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Full License Key Box */}
                      {client.current_license_key && (
                        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg flex items-center justify-between text-[11px] font-mono gap-2">
                          <span className="truncate text-slate-700 dark:text-slate-300 font-bold" title={client.current_license_key}>
                            {client.current_license_key}
                          </span>
                          <button
                            onClick={() => handleCopyText(client.current_license_key, `key-${client.id}`)}
                            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-500 shrink-0 cursor-pointer flex items-center gap-1 font-sans font-bold text-[10px]"
                          >
                            {copiedKey === `key-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            <span>{copiedKey === `key-${client.id}` ? "Kopyalandı" : "Kopyala"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Clean Card Footer Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpandClient(client.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{isExpanded ? "Detayları Gizle" : "Teknik Detay & Seri No"}</span>
                      </button>

                      {client.current_license_key && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(client.current_license_key, `fastkey-${client.id}`)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Mevcut Lisans Anahtarını Kopyala"
                        >
                          {copiedKey === `fastkey-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Key size={12} />}
                          <span>{copiedKey === `fastkey-${client.id}` ? "Key Kopyalandı" : "Key Kopyala"}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openInspectorModal(client)}
                        className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-600 text-cyan-600 dark:text-cyan-400 hover:text-white border border-cyan-200 dark:border-cyan-500/30 transition-all cursor-pointer shadow-xs"
                        title="Canlı Sistem Sağlığı, CPU/RAM/Disk & Servisler Panosunu İncele"
                      >
                        <Search size={15} />
                      </button>

                      <button
                        onClick={() => openKeyGenModal(client)}
                        className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-500/30 transition-all cursor-pointer shadow-xs"
                        title="Lisans, Modül & Kota Ayarlarını Düzenle"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => handleToggleSuspend(client)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          isSuspended
                            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-400"
                        }`}
                        title={isSuspended ? "Uzaktan Aktifleştir" : "Uzaktan Durdur / Askıya Al"}
                      >
                        <Power size={15} />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmClient(client)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Müşteriyi Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* CREATE NEW CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-rose-600 dark:text-rose-500" />
              Yeni Müşteri & On-Premise Sunucu Kaydı
            </h3>

            <form onSubmit={handleCreateClient} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Firma / Müşteri Adı</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Örn: Nolto Teknoloji A.Ş."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Tenant Kodu (Tekil Kod)</label>
                  <input
                    type="text"
                    required
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    placeholder="Örn: nolto"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Sunucu Donanım ID (Opsiyonel / UNBOUND)</label>
                  <input
                    type="text"
                    value={hardwareId}
                    onChange={(e) => setHardwareId(e.target.value)}
                    placeholder="Örn: HW-361B-F973"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-blue-600 dark:text-blue-400 font-extrabold mb-1">Eş Zamanlı Çağrı Kanalı (AI+Dialer+User)</label>
                  <input
                    type="number"
                    min="1"
                    value={newMaxConcurrentCalls}
                    onChange={(e) => setNewMaxConcurrentCalls(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl focus:outline-none focus:border-blue-500 font-mono font-extrabold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-amber-600 dark:text-amber-400 font-extrabold mb-1" title="0 girilirse limit dolunca durur. 1 veya üstü girilirse +N tolerans kanalı devreye girer ve bildirim gönderir.">
                    Tolerans Eş Zamanlı Çağrı (+Kanal)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newToleranceConcurrentCalls}
                    onChange={(e) => setNewToleranceConcurrentCalls(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3.5 py-2.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl focus:outline-none focus:border-amber-500 font-mono font-extrabold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Lisans Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Paket Türü</label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                  >
                    <option value="starter">Starter Paket</option>
                    <option value="professional">Professional Paket</option>
                    <option value="enterprise">Enterprise Paket</option>
                  </select>
                </div>
              </div>

              {/* Allowed STT, TTS, LLM Providers in Add Modal */}
              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Bot size={15} />
                  <span>Lisanslı Yapay Zeka Motorları (STT / TTS / LLM Seçimi)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/40 space-y-1">
                    <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase">STT (Ses Tanıma)</div>
                    {STT_PROVIDER_LIST.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAllowedStt.includes(p.id)}
                          onChange={() => toggleNewProvider(newAllowedStt, setNewAllowedStt, p.id)}
                          className="rounded accent-purple-600 cursor-pointer"
                        />
                        <span className="truncate">{p.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/40 space-y-1">
                    <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase">TTS (Seslendirme)</div>
                    {TTS_PROVIDER_LIST.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAllowedTts.includes(p.id)}
                          onChange={() => toggleNewProvider(newAllowedTts, setNewAllowedTts, p.id)}
                          className="rounded accent-purple-600 cursor-pointer"
                        />
                        <span className="truncate">{p.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/40 space-y-1">
                    <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase">LLM (Dil Modeli)</div>
                    {LLM_PROVIDER_LIST.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAllowedLlm.includes(p.id)}
                          onChange={() => toggleNewProvider(newAllowedLlm, setNewAllowedLlm, p.id)}
                          className="rounded accent-purple-600 cursor-pointer"
                        />
                        <span className="truncate">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  Müşteriyi Kaydet & Key Üret
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KEY GENERATOR MODAL */}
      {keyGenModalClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Key size={18} className="text-rose-600 dark:text-rose-500" />
              Lisans Yenileme Stüdyosu - {keyGenModalClient.company_name}
            </h3>

            <form onSubmit={handleGenerateCustomKey} className="space-y-4 text-xs font-semibold">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span>
                      Tenant Code: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{keyGenModalClient.tenant_code}</span>
                    </span>
                    {keyGenModalClient.tenant_serial_number && (
                      <span className="inline-flex items-center gap-1">
                        Tenant Seri No: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{keyGenModalClient.tenant_serial_number}</strong>
                      </span>
                    )}
                    {keyGenModalClient.system_serial_number && (
                      <span className="inline-flex items-center gap-1">
                        Sistem Seri No: <strong className="font-mono text-slate-800 dark:text-slate-200">{keyGenModalClient.system_serial_number}</strong>
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>Mevcut Lisans Key:</span>
                    {keyGenModalClient.current_license_key ? (
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[11px] truncate max-w-[340px]" title={keyGenModalClient.current_license_key}>
                        {keyGenModalClient.current_license_key.length > 35 
                          ? `${keyGenModalClient.current_license_key.substring(0, 22)}...${keyGenModalClient.current_license_key.slice(-10)}` 
                          : keyGenModalClient.current_license_key}
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400 font-bold">Henüz Üretilmedi</span>
                    )}
                  </div>
                </div>

                {keyGenModalClient.current_license_key && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(keyGenModalClient.current_license_key, "modal-cur-key")}
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
                  >
                    {copiedKey === "modal-cur-key" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedKey === "modal-cur-key" ? "Kopyalandı!" : "Key Kopyala"}</span>
                  </button>
                )}
              </div>

              {/* Key Controls: Plan Tier, Status, Expiry, HW ID & Concurrent Call Limit */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Shield size={16} className="text-rose-500" />
                  <span>Lisans Paketi, Durum & Geçerlilik Yapılandırması</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Lisans Paketi / Planı */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Lisans Paketi / Planı</label>
                    <select
                      value={genPlanTier}
                      onChange={(e) => setGenPlanTier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-slate-900 dark:text-white cursor-pointer text-xs"
                    >
                      <option value="trial">Trial / Deneme Süresi (30 Gün)</option>
                      <option value="starter">Starter / Başlangıç Paket</option>
                      <option value="professional">Professional Paket</option>
                      <option value="enterprise">Enterprise / Kurumsal Özel</option>
                      <option value="unlimited">Limitsiz / Özel Paket</option>
                    </select>
                  </div>

                  {/* Müşteri Durumu */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Müşteri Durumu</label>
                    <select
                      value={genStatus}
                      onChange={(e) => setGenStatus(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-slate-900 dark:text-white cursor-pointer text-xs"
                    >
                      <option value="active">🟢 Aktif (Erişim & AI Açık)</option>
                      <option value="passive">🔴 Pasif (Erişim & AI Kapalı)</option>
                    </select>
                  </div>

                  {/* Eş Zamanlı Çağrı Kanalı Limiti */}
                  <div>
                    <label className="block text-blue-600 dark:text-blue-400 font-extrabold mb-1" title="AI Agent + Otomatik Arama (Dialer) + Kullanıcı Gelen/Giden Çağrı Kanalı">
                      Eş Zamanlı Çağrı Kanalı
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={genCustomQuotas.max_concurrent_calls !== undefined ? genCustomQuotas.max_concurrent_calls : 4}
                      onChange={(e) => handleQuotaChange("max_concurrent_calls", e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-extrabold text-slate-900 dark:text-white text-xs"
                    />
                  </div>

                  {/* Tolerans Eş Zamanlı Çağrı Adeti (+Kanal) */}
                  <div>
                    <label className="block text-amber-600 dark:text-amber-400 font-extrabold mb-1" title="0 girilirse ana limit dolduğunda çağrı durdurulur. 1 veya üstü girilirse çağrı kesilmez, +N tolerans kanalı devreye girer ve E-Posta / WhatsApp bildirimi gönderilir.">
                      Tolerans Çağrı Kanalı (+Adet)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={genCustomQuotas.tolerance_concurrent_calls !== undefined ? genCustomQuotas.tolerance_concurrent_calls : 0}
                      onChange={(e) => handleQuotaChange("tolerance_concurrent_calls", e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl focus:outline-none focus:border-amber-500 font-mono font-extrabold text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Yeni Bitiş Tarihi */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 dark:text-slate-300 font-bold">Lisans Bitiş Tarihi</label>
                      <label className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={genIsUnlimited}
                          onChange={(e) => {
                            setGenIsUnlimited(e.target.checked);
                            if (e.target.checked) setGenExpiryDate("");
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span>♾️ Limitsiz</span>
                      </label>
                    </div>
                    <input
                      type="date"
                      disabled={genIsUnlimited}
                      value={genIsUnlimited ? "" : genExpiryDate}
                      onChange={(e) => setGenExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold text-slate-900 dark:text-white disabled:opacity-40 text-xs"
                    />
                  </div>

                  {/* Hedef Donanım ID */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Hedef Donanım ID (Machine Binding)</label>
                    <input
                      type="text"
                      value={genHwId}
                      onChange={(e) => setGenHwId(e.target.value)}
                      placeholder="UNBOUND veya HW-361B-F973"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Categorized 19 Custom Quotas Editor */}
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">

                {/* 1. YAPAY ZEKA LİSANS HAKLARI & KOTALARI */}
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      <Bot size={18} />
                      <span>1. Yapay Zeka Lisans Hakları & Kotaları</span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                      ⚡ Kotaları Düzenle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {AI_QUOTA_FIELDS.map(q => (
                      <div key={q.key} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{q.label}</span>
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-mono font-bold">{q.unit}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                          onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Allowed STT, TTS, and LLM Engines Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-purple-200/50 dark:border-purple-900/40">
                    {/* STT Providers */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs space-y-2">
                      <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        İzin Verilen STT (Ses Tanıma)
                      </div>
                      <div className="space-y-1.5">
                        {STT_PROVIDER_LIST.map(p => {
                          const checked = (genCustomQuotas.allowed_stt_providers || []).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProviderOption("allowed_stt_providers", p.id)}
                                className="rounded accent-purple-600 cursor-pointer"
                              />
                              <span className="truncate">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* TTS Providers */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs space-y-2">
                      <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        İzin Verilen TTS (Seslendirme)
                      </div>
                      <div className="space-y-1.5">
                        {TTS_PROVIDER_LIST.map(p => {
                          const checked = (genCustomQuotas.allowed_tts_providers || []).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProviderOption("allowed_tts_providers", p.id)}
                                className="rounded accent-purple-600 cursor-pointer"
                              />
                              <span className="truncate">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* LLM Providers */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs space-y-2">
                      <div className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        İzin Verilen LLM (Dil Modeli)
                      </div>
                      <div className="space-y-1.5">
                        {LLM_PROVIDER_LIST.map(p => {
                          const checked = (genCustomQuotas.allowed_llm_providers || []).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProviderOption("allowed_llm_providers", p.id)}
                                className="rounded accent-purple-600 cursor-pointer"
                              />
                              <span className="truncate">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. SANTRAL & DAHİLİ LİSANS HAKLARI & KOTALARI */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      <PhoneCall size={18} />
                      <span>2. Santral & Dahili Lisans Hakları & Kotaları</span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                      ⚡ Kotaları Düzenle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PBX_QUOTA_FIELDS.map(q => (
                      <div key={q.key} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/40 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{q.label}</span>
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-mono font-bold">{q.unit}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                          onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. ÇAĞRI YÖNLENDİRME & AKIŞ LİSANS HAKLARI & KOTALARI */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      <GitMerge size={18} />
                      <span>3. Çağrı Yönlendirme & Akış Lisans Hakları & Kotaları</span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                      ⚡ Kotaları Düzenle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FLOW_QUOTA_FIELDS.map(q => (
                      <div key={q.key} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{q.label}</span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">{q.unit}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                          onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. SANTRAL MODÜL & ROL GÖRÜNÜRLÜK FİLTRESİ (2 KATMANLI YETKİ MİMARİSİ) */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                        <Layers size={18} />
                        <span>4. Santral Modül &amp; Rol Görünürlük Filtresi (Satılan Modüller)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Buradan kapattığınız modüller müşterinin kendi <strong>Sistem Ayarları ➔ Roller</strong> ekranında görünmez; müşteri kendi Admin hesabıyla bile satmadığınız modülü açamaz.
                      </p>
                    </div>

                    {/* Quick Package Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyModulePreset("all")}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold cursor-pointer"
                      >
                        Tüm Modülleri Aç
                      </button>
                      <button
                        type="button"
                        onClick={() => applyModulePreset("professional")}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold cursor-pointer"
                      >
                        Profesyonel Paket
                      </button>
                      <button
                        type="button"
                        onClick={() => applyModulePreset("pbx_only")}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold cursor-pointer"
                      >
                        Sadece Standart IP Santral (AI Kapalı)
                      </button>
                    </div>
                  </div>

                  {/* Unlicensed Module Display Mode & Provider Infrastructure Lock */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                        Satılmayan Modüllerin Santraldeki Davranışı
                      </label>
                      <select
                        value={genCustomQuotas.unlicensed_module_mode || "hidden"}
                        onChange={(e) =>
                          setGenCustomQuotas((prev) => ({ ...prev, unlicensed_module_mode: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="hidden">👻 Tamamen Gizle (Ne Rollerde Ne Sol Menüde Görünür)</option>
                        <option value="teaser">🔒 Vitrinde Kilitli Göster (Rollerde Verilemez, Menüde &apos;🔒 Pro&apos; Tanıtım Ekranı Çıkar)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(genCustomQuotas.hide_provider_infra_from_customer_admin)}
                          onChange={(e) =>
                            setGenCustomQuotas((prev) => ({
                              ...prev,
                              hide_provider_infra_from_customer_admin: e.target.checked
                            }))
                          }
                          className="mt-0.5 rounded accent-indigo-600 cursor-pointer"
                        />
                        <div>
                          <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                            Teknik Altyapı &amp; SSH Ekranlarını Müşteri Admininden Gizle
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                            Nornia Connect, Web SSH, Ağ/IP, NAT, Tenant Yönetimi ve sngrep sadece buradan <strong>&quot;Santrali Yönet (SSO)&quot;</strong> ile girdiğinizde görünür.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Category Grid of Modules */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {SANTRAL_MODULE_CATEGORIES.map((cat) => {
                      const curAllowed = Array.isArray(genCustomQuotas.allowed_features) ? genCustomQuotas.allowed_features : ALL_SANTRAL_MODULE_IDS;
                      const catIds = cat.items.map((i) => i.id);
                      const selectedCount = catIds.filter((id) => curAllowed.includes(id)).length;
                      const allInCat = selectedCount === catIds.length;

                      return (
                        <div key={cat.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-2 flex flex-col">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                              {cat.title} ({selectedCount}/{catIds.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleCategoryModules(cat.items)}
                              className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              {allInCat ? "Kaldır" : "Tümü"}
                            </button>
                          </div>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {cat.items.map((mod) => {
                              const isChecked = curAllowed.includes(mod.id);
                              return (
                                <label key={mod.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleProviderOption("allowed_features", mod.id)}
                                    className="rounded accent-indigo-600 cursor-pointer"
                                  />
                                  <span className="truncate">{mod.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. ALT ÖZELLİK, OMNICHANNEL KANAL & ZORUNLU KAYIT SAKLAMA POLİTİKASI */}
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      <Sparkles size={18} />
                      <span>5. Alt Özellik, Omnichannel Kanal &amp; Zorunlu Kayıt Saklama Politikası</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Sub-Features Checkboxes (2 cols) */}
                    <div className="md:col-span-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                      <div className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        Mikro-Lisanslı Alt Özellikler &amp; Omnichannel Kanalları
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {SUB_FEATURE_LIST.map((sf) => {
                          const curSub = Array.isArray(genCustomQuotas.allowed_sub_features) ? genCustomQuotas.allowed_sub_features : SUB_FEATURE_LIST.map((s) => s.id);
                          const isChecked = curSub.includes(sf.id);
                          return (
                            <label key={sf.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleProviderOption("allowed_sub_features", sf.id)}
                                className="rounded accent-amber-600 cursor-pointer"
                              />
                              <span className="truncate">{sf.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mandatory Retention & Disk Policy */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                      <div className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        Zorunlu Disk &amp; Saklama Politikası
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Zorunlu Ses Kaydı Saklama (Gün)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={genCustomQuotas.enforced_retention_days ?? 0}
                          onChange={(e) => handleQuotaChange("enforced_retention_days", e.target.value)}
                          placeholder="0 = Müşteri Serbest (Örn: 90)"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-extrabold text-slate-900 dark:text-white"
                        />
                        <span className="text-[10px] text-slate-400">0 girilirse müşteri kendisi belirler.</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Maksimum Sistem Yedeği Adedi
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={genCustomQuotas.enforced_max_backups ?? 0}
                          onChange={(e) => handleQuotaChange("enforced_max_backups", e.target.value)}
                          placeholder="0 = Serbest (Örn: 5)"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-extrabold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {genError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{genError}</span>
                </div>
              )}

              {generatedResultKey && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
                  <div className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5">
                    <Check size={16} /> Yeni İmzalı Key Başarıyla Üretildi!
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white flex items-center justify-between shadow-xs">
                    <span className="truncate max-w-[500px]">{generatedResultKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(generatedResultKey, "gen-modal-res")}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      {copiedKey === "gen-modal-res" ? "Kopyalandı!" : "Kopyala"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setKeyGenModalClient(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingKey}
                  className={`px-5 py-2.5 rounded-xl font-extrabold shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-2 transition-all ${
                    isGeneratingKey ? "bg-slate-400 text-white cursor-not-allowed" : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {isGeneratingKey && <RefreshCw size={14} className="animate-spin" />}
                  {isGeneratingKey ? "Key Üretiliyor & Kaydediliyor..." : "Yeni Key Üret & Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* LIVE SERVER TELEMETRY, RESOURCES & SERVICES HEALTH INSPECTOR DASHBOARD MODAL */}
      {inspectorClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
            {/* Modal Top Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Activity size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {inspectorClient.company_name} — Canlı Sistem &amp; Servis Sağlığı Panosu
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      {inspectorClient.tenant_code}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {inspectorClient.hardware_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {inspectorData?.live_tunnel_fetched ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Nornia Connect Tüneli Üzerinden Gerçek Zamanlı Akış ({inspectorClient.connect_subdomain}.nornia.com.tr)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Son Heartbeat Telemetri Verisi ({inspectorClient.ip_address || "127.0.0.1"})</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Gerçek Zamanlı Canlı Akış</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorClient(null);
                    setInspectorData(null);
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 hover:text-rose-500 text-slate-500 transition-colors cursor-pointer"
                  title="Kapat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {inspectorLoading && !inspectorData ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw size={28} className="animate-spin text-cyan-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Santral telemetri, kaynak ve servis durumu sorgulanıyor...
                  </p>
                </div>
              ) : (() => {
                const defaultServices = [
                  {
                    id: "asterisk_ami",
                    name: "Asterisk PBX & AMI Motoru",
                    port: "5038 / 5060",
                    status: inspectorClient.is_online ? "online" : "offline",
                    detail: "PJSIP & Dahili Çağrı Yönlendirme Aktif"
                  },
                  {
                    id: "nornia_connect",
                    name: "Nornia Connect Bulut Tüneli",
                    port: "HTTPS :443",
                    status: inspectorClient.tunnel_connected ? "online" : "offline",
                    detail: inspectorClient.connect_subdomain ? `${inspectorClient.connect_subdomain}.nornia.com.tr (Sıfır-Port Aktif)` : "Tünel Bekleniyor"
                  },
                  {
                    id: "audiosocket_ai",
                    name: "AI Voice AudioSocket & Gemini Live",
                    port: "TCP :9092",
                    status: inspectorClient.is_online ? "online" : "offline",
                    detail: "Gerçek Zamanlı Multimodal Ses Motoru"
                  },
                  {
                    id: "postgresql_db",
                    name: "PostgreSQL & Vektör Veritabanı (RAG)",
                    port: "TCP :5444",
                    status: inspectorClient.is_online ? "online" : "offline",
                    detail: "Kurumsal Veritabanı & Bilgi Bankası"
                  },
                  {
                    id: "webrtc_wss",
                    name: "WebRTC SIP.js & TLS WSS",
                    port: "WSS :8089",
                    status: inspectorClient.is_online ? "online" : "offline",
                    detail: `${inspectorClient.total_users_count || 0} Kayıtlı Kullanıcı / Dahili`
                  },
                  {
                    id: "remote_ssh",
                    name: "Uzaktan Web SSH Köprüsü",
                    port: "Zero-Port PTY",
                    status: inspectorClient.remote_ssh_enabled !== false ? "online" : "locked",
                    detail: inspectorClient.remote_ssh_enabled !== false ? "Merkezden Yetki Açık" : "Merkezden Kilitli"
                  }
                ];

                const d = inspectorData || {
                  cpu_usage: inspectorClient.cpu_usage_percent || 0,
                  ram_usage: inspectorClient.ram_usage_percent || 0,
                  ram_used_gb: 1.8,
                  ram_total_gb: 8.0,
                  disk_usage: 42.0,
                  disk_used_gb: 21.0,
                  disk_total_gb: 50.0,
                  ip_address: inspectorClient.ip_address || "-",
                  software_version: inspectorClient.software_version || "—",
                  active_calls: inspectorClient.active_calls_count || 0,
                  today_calls: 0,
                  max_concurrent_calls: inspectorClient.custom_quotas?.max_concurrent_calls ?? 4,
                  tolerance_concurrent_calls: inspectorClient.custom_quotas?.tolerance_concurrent_calls ?? 0,
                  effective_max_calls: (inspectorClient.custom_quotas?.max_concurrent_calls ?? 4) + (inspectorClient.custom_quotas?.tolerance_concurrent_calls ?? 0),
                  total_users: inspectorClient.total_users_count || 0,
                  rec_file_count: 0,
                  rec_total_size_mb: 0,
                  services: defaultServices,
                  history: [
                    { cpu: inspectorClient.cpu_usage_percent || 1, ram: inspectorClient.ram_usage_percent || 20, calls: inspectorClient.active_calls_count || 0 },
                    { cpu: inspectorClient.cpu_usage_percent || 1, ram: inspectorClient.ram_usage_percent || 20, calls: inspectorClient.active_calls_count || 0 }
                  ]
                };

                const circ = 2 * Math.PI * 26;
                const cpuPct = Math.min(100, Math.max(0, Number(d.cpu_usage || 0)));
                const ramPct = Math.min(100, Math.max(0, Number(d.ram_usage || 0)));
                const diskPct = Math.min(100, Math.max(0, Number(d.disk_usage || 0)));
                const effMaxCalls = Math.max(1, Number(d.effective_max_calls || d.max_concurrent_calls || 4));
                const callPct = Math.min(100, Math.round((Number(d.active_calls || 0) / effMaxCalls) * 100));

                const cpuPaths = buildSvgTrendPaths(d.history, "cpu", 100, 480, 120);
                const ramPaths = buildSvgTrendPaths(d.history, "ram", 100, 480, 120);
                const callPaths = buildSvgTrendPaths(d.history, "calls", Math.max(effMaxCalls, 5), 480, 120);

                return (
                  <>
                    {/* 1. TOP 4 RADIAL GAUGE CARDS: CPU, RAM, DISK, CHANNELS & CALLS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* CPU Gauge Card */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">İşlemci Yükü (CPU)</span>
                          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">{cpuPct}%</div>
                          <div className={`text-[11px] font-bold ${cpuPct > 85 ? "text-rose-500" : cpuPct > 65 ? "text-amber-500" : "text-emerald-500"}`}>
                            {cpuPct > 85 ? "Yüksek Yük" : cpuPct > 65 ? "Orta Yük" : "Optimal Performans"}
                          </div>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5.5" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                            <circle
                              cx="32"
                              cy="32"
                              r="26"
                              stroke="#f59e0b"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={circ}
                              strokeDashoffset={circ * (1 - cpuPct / 100)}
                            />
                          </svg>
                          <Cpu size={18} className="absolute text-amber-500" />
                        </div>
                      </div>

                      {/* RAM Gauge Card */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Bellek (RAM)</span>
                          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">{ramPct}%</div>
                          <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {d.ram_used_gb} GB / {d.ram_total_gb} GB
                          </div>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5.5" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                            <circle
                              cx="32"
                              cy="32"
                              r="26"
                              stroke="#6366f1"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={circ}
                              strokeDashoffset={circ * (1 - ramPct / 100)}
                            />
                          </svg>
                          <Database size={18} className="absolute text-indigo-500" />
                        </div>
                      </div>

                      {/* Disk Storage Gauge Card */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Disk &amp; Kayıt Alanı</span>
                          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">{diskPct}%</div>
                          <div className="text-[11px] font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {d.disk_used_gb} GB / {d.disk_total_gb} GB
                          </div>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5.5" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                            <circle
                              cx="32"
                              cy="32"
                              r="26"
                              stroke="#06b6d4"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={circ}
                              strokeDashoffset={circ * (1 - diskPct / 100)}
                            />
                          </svg>
                          <HardDrive size={18} className="absolute text-cyan-500" />
                        </div>
                      </div>

                      {/* Concurrent Calls & Licensed Channels Card */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Eş Zamanlı Çağrı / Kanal</span>
                          <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                            {d.active_calls} <span className="text-sm text-slate-400">/ {d.max_concurrent_calls}</span>
                            {d.tolerance_concurrent_calls > 0 && (
                              <span className="text-xs text-amber-500 ml-1">(+{d.tolerance_concurrent_calls})</span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Bugün: <strong className="text-slate-800 dark:text-slate-200">{d.today_calls} Çağrı</strong> • <strong className="text-slate-800 dark:text-slate-200">{d.total_users} Abone</strong>
                          </div>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5.5" className="text-slate-200 dark:text-slate-800" fill="transparent" />
                            <circle
                              cx="32"
                              cy="32"
                              r="26"
                              stroke="#10b981"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={circ}
                              strokeDashoffset={circ * (1 - callPct / 100)}
                            />
                          </svg>
                          <PhoneCall size={18} className="absolute text-emerald-500" />
                        </div>
                      </div>
                    </div>

                    {/* 2. DUAL INTERACTIVE SVG TIME-SERIES CHARTS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* CPU & RAM Area Chart */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>CPU &amp; Bellek (RAM) Performans Grafiği</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Gerçek zamanlı sistem kaynak kullanım eğrisi (%)</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-extrabold font-mono">
                            <span className="flex items-center gap-1.5 text-amber-500">
                              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                              CPU {cpuPct}%
                            </span>
                            <span className="flex items-center gap-1.5 text-indigo-500">
                              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                              RAM {ramPct}%
                            </span>
                          </div>
                        </div>

                        <div className="relative h-36 w-full bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/70 dark:border-slate-800/80 overflow-hidden">
                          <svg className="w-full h-full" viewBox="0 0 480 120" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="inspCpuGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="inspRamGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="30" x2="480" y2="30" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            <line x1="0" y1="60" x2="480" y2="60" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            <line x1="0" y1="90" x2="480" y2="90" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            {ramPaths.area && <path d={ramPaths.area} fill="url(#inspRamGrad)" />}
                            {ramPaths.line && <path d={ramPaths.line} fill="transparent" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" />}
                            {cpuPaths.area && <path d={cpuPaths.area} fill="url(#inspCpuGrad)" />}
                            {cpuPaths.line && <path d={cpuPaths.line} fill="transparent" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />}
                          </svg>
                        </div>
                      </div>

                      {/* Concurrent Calls & Channel Capacity Chart */}
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Eş Zamanlı Çağrı &amp; Kanal Trafik Grafiği</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Lisanslı Kanal: <strong>{d.max_concurrent_calls} Kanal</strong> (+{d.tolerance_concurrent_calls} Tolerans) • Ses Kaydı: <strong>{d.rec_file_count} .wav ({d.rec_total_size_mb} MB)</strong>
                            </p>
                          </div>
                          <div className="text-xs font-extrabold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                            {d.active_calls} Aktif Çağrı
                          </div>
                        </div>

                        <div className="relative h-36 w-full bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/70 dark:border-slate-800/80 overflow-hidden">
                          <svg className="w-full h-full" viewBox="0 0 480 120" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="inspCallGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="30" x2="480" y2="30" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            <line x1="0" y1="60" x2="480" y2="60" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            <line x1="0" y1="90" x2="480" y2="90" stroke="currentColor" className="text-slate-200/70 dark:text-slate-800/70" strokeDasharray="3,3" />
                            {callPaths.area && <path d={callPaths.area} fill="url(#inspCallGrad)" />}
                            {callPaths.line && <path d={callPaths.line} fill="transparent" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />}
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* 3. CORE SERVICES & ENGINE HEALTH MATRIX */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Server size={15} className="text-cyan-500" />
                          <span>Santral Çekirdek Servisleri &amp; Motor Durumları</span>
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          Sürüm: {d.software_version || "—"} • IP: {d.ip_address || "127.0.0.1"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(d.services || []).map((srv) => {
                          const isOnline = srv.status === "online";
                          const isLocked = srv.status === "locked";
                          return (
                            <div
                              key={srv.id}
                              className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    isOnline ? "bg-emerald-500 animate-pulse" : isLocked ? "bg-amber-500" : "bg-rose-500"
                                  }`} />
                                  <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {srv.name}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {srv.detail}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                  isOnline
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : isLocked
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                }`}>
                                  {isOnline ? "AKTİF" : isLocked ? "KİLİTLİ" : "PASİF"}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{srv.port}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteConfirmClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 animate-pulse">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Müşteri &amp; Lisans Kaydını Sil
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <strong>{deleteConfirmClient.company_name}</strong> (<code className="font-mono font-bold text-rose-600 dark:text-rose-400">{deleteConfirmClient.tenant_code}</code>) müşterisini ve bu kayda ait tüm lisans/telemetri geçmişini kalıcı olarak silmek istediğinize emin misiniz?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={deletingClient}
                onClick={() => setDeleteConfirmClient(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deletingClient}
                onClick={confirmDeleteClient}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 size={13} />
                <span>{deletingClient ? "Siliniyor..." : "Sil"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBDOMAIN UNLOCK CONFIRMATION MODAL */}
      {unlockConfirmClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                <Unlock size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Nornia Connect İsim Kilidini Serbest Bırak
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <strong>{unlockConfirmClient.company_name}</strong> ({unlockConfirmClient.hardware_id}) sunucusuna tanımlı{" "}
                  <code className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {unlockConfirmClient.connect_subdomain}.nornia.com.tr
                  </code>{" "}
                  alt alan adı kilidini kaldırmak istediğinize emin misiniz?
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Bu işlem sonucunda mevcut tünel sonlandırılır, isim boşa çıkar ve santral arayüzünden yeni bir alt alan adı tanımlanmasına izin verilir.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={unlockingSubdomain}
                onClick={() => setUnlockConfirmClient(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={unlockingSubdomain}
                onClick={async () => {
                  setUnlockingSubdomain(true);
                  try {
                    const res = await fetch(`${API_BASE}/api/v1/clients/${unlockConfirmClient.id}/unlock-subdomain`, {
                      method: "POST",
                      headers: { "X-User-Name": currentUser?.username || "admin" },
                    });
                    if (res.ok) {
                      setUnlockConfirmClient(null);
                      fetchData();
                    }
                  } catch (e) {
                    console.error("Unlock subdomain error:", e);
                  } finally {
                    setUnlockingSubdomain(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Unlock size={13} />
                <span>{unlockingSubdomain ? "Kilit Açılıyor..." : "Kilidi Aç & Serbest Bırak"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NORNIA CONNECT REMOTE WEB SSH TERMINAL MODAL */}
      {sshModalClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                  <Terminal size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>Nornia Connect Sıfır-Port Web SSH Terminali</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      {sshModalClient.connect_subdomain}.nornia.com.tr (Sıfır-Port HTTPS :443)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Hiçbir ek TCP portu harcamadan, doğrudan mevcut Nornia Connect HTTPS tüneli üzerinden santral kabuğuna erişin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSshModal}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Kapat ✕
              </button>
            </div>

            {/* Native Terminal & PBX Web UI SSH Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] font-extrabold text-emerald-400 uppercase">
                  1. Santralin Kendi Web Arayüzündeki Dahili Web SSH Terminali:
                </div>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px]">
                  <span className="text-slate-300 truncate">
                    https://{sshModalClient.connect_subdomain}.nornia.com.tr (Sistem Ayarları ➔ Nornia Connect)
                  </span>
                  <a
                    href={`https://${sshModalClient.connect_subdomain}.nornia.com.tr`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 ml-2"
                  >
                    <span>Santrali Aç</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-extrabold text-indigo-400 uppercase">
                  2. Kendi Bilgisayarınızdan (Mac / Linux — Port 443 HTTPS Sıfır-Port SSH):
                </div>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 font-mono text-[11px] text-emerald-300">
                  <span className="truncate">
                    {`ssh -o ProxyCommand='python3 -c "import urllib.request; exec(urllib.request.urlopen(\\"https://connect.nornia.com.tr/ssh/${sshModalClient.connect_subdomain}\\").read())"' ${sshUsername || "aida"}@${sshModalClient.connect_subdomain}.nornia.com.tr`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        `ssh -o ProxyCommand='python3 -c "import urllib.request; exec(urllib.request.urlopen(\\"https://connect.nornia.com.tr/ssh/${sshModalClient.connect_subdomain}\\").read())"' ${sshUsername || "aida"}@${sshModalClient.connect_subdomain}.nornia.com.tr`,
                        "ssh-ext-cmd"
                      )
                    }
                    className="text-slate-400 hover:text-white ml-2 shrink-0 cursor-pointer"
                    title="Komutu Kopyala"
                  >
                    {copiedKey === "ssh-ext-cmd" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Web SSH Interactive Connection Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Santral SSH Kullanıcısı:</span>
                <input
                  type="text"
                  value={sshUsername}
                  onChange={(e) => setSshUsername(e.target.value)}
                  placeholder="root veya aida"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white w-36 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={startWebSshSession}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Terminal size={13} />
                  <span>{sshConnected ? "Yeniden Bağlan" : "⚡ Canlı Terminal Bağlan"}</span>
                </button>
              </div>

              {sshConnected && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendWebSshSignal("\x03")}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-mono font-bold cursor-pointer"
                  >
                    Ctrl+C
                  </button>
                  <button
                    type="button"
                    onClick={() => setSshOutput("")}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                  >
                    Ekranı Temizle
                  </button>
                </div>
              )}
            </div>

            {/* Terminal Screen */}
            <div
              ref={sshOutputBoxRef}
              className="bg-black border border-slate-800 rounded-2xl p-4 h-80 overflow-y-auto font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed select-text"
            >
              {sshOutput || "Terminal çıktısı bekleniyor..."}
            </div>

            {/* Terminal Input Form */}
            <form onSubmit={sendWebSshCommand} className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold text-indigo-400 px-2">
                {sshIsPasswordMode ? "🔑 Parola:" : `${sshUsername || "root"}@${sshModalClient.connect_subdomain}:~#`}
              </span>
              <input
                type={sshIsPasswordMode ? "password" : "text"}
                value={sshInputLine}
                onChange={(e) => setSshInputLine(e.target.value)}
                disabled={!sshConnected}
                placeholder={
                  !sshConnected
                    ? "Önce yukarıdan 'Canlı Terminal Bağlan' butonuna tıklayın..."
                    : sshIsPasswordMode
                    ? "Santral SSH parolasını yazıp Enter'a basın..."
                    : "Komut yazıp Enter'a basın (örn: pm2 status, ip a, asterisk -rx 'core show channels')..."
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!sshConnected}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
              >
                Gönder ↵
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KPI STATUS SERVERS POPUP MODAL */}
      {kpiModalConfig && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setKpiModalKey(null)}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                    kpiModalConfig.accent === "emerald"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : kpiModalConfig.accent === "amber"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : kpiModalConfig.accent === "rose"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : kpiModalConfig.accent === "violet"
                            ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
                            : kpiModalConfig.accent === "blue"
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                              : kpiModalConfig.accent === "slate"
                                ? "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30"
                                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                  }`}
                >
                  {kpiModalKey === "online" ? (
                    <Activity size={19} />
                  ) : kpiModalKey === "offline" ? (
                    <WifiOff size={19} />
                  ) : kpiModalKey === "expiring_soon" ? (
                    <Clock size={19} />
                  ) : kpiModalKey === "expired" ? (
                    <ShieldAlert size={19} />
                  ) : kpiModalKey === "subscribers" ? (
                    <Users size={19} />
                  ) : kpiModalKey === "active_calls" ? (
                    <PhoneCall size={19} />
                  ) : (
                    <Server size={19} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <span className="truncate">{kpiModalConfig.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {kpiModalConfig.list.length} Sunucu
                    </span>
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {kpiModalConfig.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setKpiModalKey(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Per-User Expiring Soon Threshold Selector (7-15-30-60-90-120 Days) */}
            {kpiModalKey === "expiring_soon" && (
              <div className="px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                    Uyarı Süresi:
                  </span>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {EXPIRING_DAY_OPTIONS.map((d) => {
                      const active = expiringSoonDays === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={savingExpiringDays}
                          onClick={() => handleChangeExpiringSoonDays(d)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            active
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          {d} Gün
                        </button>
                      );
                    })}
                  </div>
                </div>

                {expiringDaysSavedToast && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 animate-fadeIn">
                    <Check size={11} />
                    <span>Kaydedildi</span>
                  </span>
                )}
              </div>
            )}

            {/* Body Server List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
              {kpiModalConfig.list.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                    Bu kategoride kayıtlı sunucu bulunmuyor.
                  </div>
                  <p className="text-xs text-slate-400">
                    Filo durumu güncellendiğinde ilgili sunucular burada otomatik listelenir.
                  </p>
                </div>
              ) : (
                kpiModalConfig.list.map((c) => {
                  const userQuota = getClientUserLicenseCount(c);
                  const maxCalls = Number(c.custom_quotas?.max_concurrent_calls ?? 4);
                  const tolCalls = Number(c.custom_quotas?.tolerance_concurrent_calls ?? 0);
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            c.is_online
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/60"
                              : "bg-slate-400"
                          }`}
                          title={c.is_online ? "Çevrimiçi" : "Çevrimdışı"}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {c.company_name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              @{c.tenant_code}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                c.status === "suspended" || c.status === "expired"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : c.is_online
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {c.status === "suspended"
                                ? "Askıda"
                                : c.status === "expired"
                                  ? "Süresi Doldu"
                                  : c.is_online
                                    ? "Canlı"
                                    : "Çevrimdışı"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {c.domain_name && <span className="font-mono">{c.domain_name}</span>}
                            {c.ip_address && <span className="font-mono">{c.ip_address}</span>}
                            <span>
                              Bitiş:{" "}
                              <strong className="text-slate-700 dark:text-slate-300">
                                {c.license_expires_at === "unlimited"
                                  ? "Sınırsız"
                                  : c.license_expires_at || "—"}
                              </strong>
                              {typeof c.days_left === "number" && (
                                <span className="ml-1 text-amber-600 dark:text-amber-400 font-bold">
                                  ({c.days_left} gün)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contextual Metric + Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {kpiModalKey === "subscribers" ? (
                          <div className="px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/25 text-right">
                            <div className="text-xs font-extrabold text-violet-700 dark:text-violet-300">
                              {userQuota.toLocaleString("tr-TR")} Abone Lisansı
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                              {Number(c.total_users_count || 0)} aktif kullanıcı
                            </div>
                          </div>
                        ) : kpiModalKey === "active_calls" ? (
                          <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-right">
                            <div className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                              {Number(c.active_calls_count || 0)} Aktif Çağrı
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                              Kapasite: {maxCalls}{tolCalls > 0 ? ` (+${tolCalls})` : ""} Kanal
                            </div>
                          </div>
                        ) : (
                          <div className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {userQuota} Abone • {Number(c.active_calls_count || 0)} Çağrı
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setKpiModalKey(null);
                            openInspectorModal(c);
                          }}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors"
                          title="Canlı Sağlık & Telemetri Denetçisi"
                        >
                          <Activity size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKpiModalKey(null);
                            openKeyGenModal(c);
                          }}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors"
                          title="Lisans & Kota Düzenle"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-slate-500 dark:text-slate-400">
                {kpiModalKey === "subscribers" ? (
                  <span>
                    Genel Toplam:{" "}
                    <strong className="text-violet-600 dark:text-violet-400">
                      {totalLicensedSubscribers.toLocaleString("tr-TR")} Lisanslı Abone
                    </strong>{" "}
                    ({totalRegisteredSubscribers.toLocaleString("tr-TR")} aktif kayıtlı)
                  </span>
                ) : (
                  <span>Toplam {kpiModalConfig.list.length} sunucu listeleniyor</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {kpiModalConfig.filterShortcut && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus(kpiModalConfig.filterShortcut);
                      setKpiModalKey(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    Ana Listede Filtrele
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setKpiModalKey(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer transition-colors"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER MANAGEMENT MODAL */}
      <UserManagementModal
        isOpen={showUsersModal}
        onClose={() => {
          setShowUsersModal(false);
          setInitialEditUserId(null);
        }}
        currentUser={currentUser}
        onCurrentUserUpdated={(u) => setCurrentUser(u)}
        onOpenSecuritySmtp={() => {
          setShowUsersModal(false);
          setInitialEditUserId(null);
          setShowSecurityModal(true);
        }}
        initialEditUserId={initialEditUserId}
      />

      {/* AUDIT LOGS MODAL */}
      <AuditLogsModal
        isOpen={showAuditLogsModal}
        onClose={() => setShowAuditLogsModal(false)}
      />

      {/* CENTRAL SECURITY SHIELD MODAL */}
      <SecuritySettingsModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        currentUser={currentUser}
        onOpenUser2FA={(uid) => {
          setShowSecurityModal(false);
          setInitialEditUserId(uid || null);
          setShowUsersModal(true);
        }}
        onPolicyUpdated={(pol) => {
          if (pol?.auto_logout_minutes !== undefined) {
            setAutoLogoutMinutes(Number(pol.auto_logout_minutes));
          }
        }}
      />
    </div>
  );
}
