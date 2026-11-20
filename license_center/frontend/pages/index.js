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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wifi,
  WifiOff,
  HardDrive,
  Database,
  Zap,
  X,
  Settings
} from "lucide-react";

import LoginModal from "../components/LoginModal";
import UserManagementModal from "../components/UserManagementModal";
import AuditLogsModal from "../components/AuditLogsModal";
import SecuritySettingsModal from "../components/SecuritySettingsModal";
import AccountSettingsModal, { getUserInitials } from "../components/AccountSettingsModal";
import PackageTemplatesModal from "../components/PackageTemplatesModal";
import {
  STT_PROVIDER_LIST,
  TTS_PROVIDER_LIST,
  LLM_PROVIDER_LIST,
  SANTRAL_MODULE_CATEGORIES,
  ALL_SANTRAL_MODULE_IDS,
  SUB_FEATURE_LIST,
  ALL_SUB_FEATURE_IDS,
  DEFAULT_PACKAGE_TEMPLATES,
  PACKAGE_TIER_ORDER,
  mergePackageTemplates,
  computeDatePlusDaysISO
} from "../utils/licensePackages";

const API_BASE = "";

function MiniTachometerGauge({ label, value }) {
  const numVal = Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamped = Math.max(0, Math.min(100, numVal));
  const r = 24;
  const arcLen = Math.PI * r; // ~75.398
  const dashOffset = arcLen * (1 - clamped / 100);
  const needleAngle = -90 + (clamped / 100) * 180;
  const strokeColor =
    clamped >= 80 ? "#f43f5e" : clamped >= 60 ? "#f59e0b" : "#10b981";
  const textClass =
    clamped >= 80
      ? "text-rose-600 dark:text-rose-400"
      : clamped >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-800 dark:text-slate-100";

  // Subtle redline zone arc (80% -> 100%, i.e. 144deg -> 180deg)
  const redStartAngle = (180 - 144) * (Math.PI / 180); // 36deg from right
  const rx1 = 32 + r * Math.cos(redStartAngle);
  const ry1 = 34 - r * Math.sin(redStartAngle);

  return (
    <div
      className={`flex flex-col items-center justify-center px-1.5 py-1 rounded-xl border min-w-[68px] ${
        numVal >= 85
          ? "bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700/80"
          : "bg-slate-50/90 dark:bg-slate-950/70 border-slate-200/70 dark:border-slate-800/80"
      }`}
      title={`${label} Kullanımı: %${numVal}`}
    >
      <svg viewBox="0 0 64 40" className="w-[58px] h-[36px] overflow-visible">
        {/* Background semi-circle track */}
        <path
          d="M 8 34 A 24 24 0 0 1 56 34"
          fill="none"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-800"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* Subtle Redline zone (80%-100%) */}
        <path
          d={`M ${rx1.toFixed(2)} ${ry1.toFixed(2)} A 24 24 0 0 1 56 34`}
          fill="none"
          stroke="rgba(244, 63, 94, 0.25)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* Active progress arc */}
        <path
          d="M 8 34 A 24 24 0 0 1 56 34"
          fill="none"
          stroke={strokeColor}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.45s ease, stroke 0.3s ease" }}
        />
        {/* Tachometer needle */}
        <g
          transform={`rotate(${needleAngle.toFixed(1)}, 32, 34)`}
          style={{ transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <line
            x1="32"
            y1="34"
            x2="32"
            y2="14"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        {/* Center pivot hub */}
        <circle cx="32" cy="34" r="3" fill={strokeColor} />
        <circle cx="32" cy="34" r="1.2" className="fill-white dark:fill-slate-900" />
      </svg>
      <div className="flex items-baseline gap-1 -mt-0.5 font-mono leading-none">
        <span className="text-[9px] font-bold text-slate-400">{label}</span>
        <span className={`text-[10px] font-extrabold ${textClass}`}>%{numVal}</span>
      </div>
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState("table"); // default corporate list/table view
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedClientIds, setExpandedClientIds] = useState({});
  const [deleteConfirmClient, setDeleteConfirmClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, pageSize]);

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
  const [showPackagesModal, setShowPackagesModal] = useState(false);
  const [packageTemplates, setPackageTemplates] = useState(() => mergePackageTemplates([]));
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef(null);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState("password");

  useEffect(() => {
    if (!showAvatarMenu) return;
    const handleOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setShowAvatarMenu(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setShowAvatarMenu(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showAvatarMenu]);
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
    if (savedIdleMins !== null && !Number.isNaN(Number(savedIdleMins))) {
      setAutoLogoutMinutes(Number(savedIdleMins));
    }
    setIsAuthChecking(false);

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

  // Sync per-user preferences (auto_logout_minutes & expiring_soon_days) whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    // 1. Sync per-user Auto-Logout preference
    if (currentUser.auto_logout_minutes !== undefined && currentUser.auto_logout_minutes !== null) {
      const mins = Number(currentUser.auto_logout_minutes);
      if (!Number.isNaN(mins) && mins >= 0) {
        setAutoLogoutMinutes(mins);
        try {
          sessionStorage.setItem("master_auto_logout_mins", String(mins));
        } catch (e) {}
      }
    } else {
      fetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : null))
        .then((list) => {
          if (!Array.isArray(list)) return;
          const me = list.find((u) => u.id === currentUser.id);
          if (me && me.auto_logout_minutes !== undefined && me.auto_logout_minutes !== null) {
            const dbMins = Number(me.auto_logout_minutes);
            if (!Number.isNaN(dbMins) && dbMins >= 0) {
              setAutoLogoutMinutes(dbMins);
              try {
                sessionStorage.setItem("master_auto_logout_mins", String(dbMins));
              } catch (e) {}
            }
          }
        })
        .catch(() => {});
    }

    // 2. Sync per-user expiringSoonDays preference
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

  const fetchPackageTemplates = async () => {
    try {
      const resPkg = await fetch(`${API_BASE}/api/v1/packages`);
      if (resPkg.ok) {
        const dPkg = await resPkg.json();
        setPackageTemplates(mergePackageTemplates(dPkg?.packages || []));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchPackageTemplates();
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
        return prev.filter((id) => id !== providerId);
      }
      return [...prev, providerId];
    });
  };

  const handleSelectNewPlanTier = (nextTier) => {
    setPlanTier(nextTier);
    const tpl = (packageTemplates && packageTemplates[nextTier]) || DEFAULT_PACKAGE_TEMPLATES[nextTier];
    if (!tpl) return;
    setNewAllowedStt(Array.isArray(tpl.allowed_stt_providers) ? [...tpl.allowed_stt_providers] : []);
    setNewAllowedTts(Array.isArray(tpl.allowed_tts_providers) ? [...tpl.allowed_tts_providers] : []);
    setNewAllowedLlm(Array.isArray(tpl.allowed_llm_providers) ? [...tpl.allowed_llm_providers] : []);
    if (tpl.auto_expiry_days) {
      setExpiryDate(computeDatePlusDaysISO(tpl.auto_expiry_days));
    } else if (tpl.auto_unlimited) {
      setExpiryDate("unlimited");
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!companyName || !tenantCode) return;

    const tpl = (packageTemplates && packageTemplates[planTier]) || DEFAULT_PACKAGE_TEMPLATES[planTier] || DEFAULT_PACKAGE_TEMPLATES.professional;
    const tplFeatures = Array.isArray(tpl.allowed_features)
      ? tpl.allowed_features.includes("*")
        ? ["*"]
        : [...tpl.allowed_features]
      : [...ALL_SANTRAL_MODULE_IDS];
    const tplSubs = Array.isArray(tpl.allowed_sub_features)
      ? tpl.allowed_sub_features.includes("*")
        ? ["*"]
        : [...tpl.allowed_sub_features]
      : [...ALL_SUB_FEATURE_IDS];

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
          license_expires_at: tpl.auto_unlimited ? "unlimited" : expiryDate,
          plan_tier: planTier,
          custom_quotas: {
            plan_tier: planTier,
            is_unlimited: Boolean(tpl.auto_unlimited),
            max_concurrent_calls: parseInt(newMaxConcurrentCalls, 10) || 4,
            tolerance_concurrent_calls: Math.max(0, parseInt(newToleranceConcurrentCalls, 10) || 0),
            allowed_stt_providers: newAllowedStt,
            allowed_tts_providers: newAllowedTts,
            allowed_llm_providers: newAllowedLlm,
            allowed_features: tplFeatures,
            allowed_sub_features: tplSubs,
            unlicensed_module_mode: tpl.unlicensed_module_mode || "hidden"
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

  const [genCustomQuotas, setGenCustomQuotas] = useState({});
  const [genPlanTier, setGenPlanTier] = useState("professional");
  const [genIsUnlimited, setGenIsUnlimited] = useState(false);
  const [genStatus, setGenStatus] = useState("active");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [genError, setGenError] = useState("");
  const [keyGenActiveTab, setKeyGenActiveTab] = useState("general");
  const [keyGenModuleSearch, setKeyGenModuleSearch] = useState("");

  const openKeyGenModal = (client) => {
    setKeyGenModalClient(client);
    setKeyGenActiveTab("general");
    setKeyGenModuleSearch("");
    const exp = resolveClientExpiryDate(client) || "2027-12-31";
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
    initQ.allowed_stt_providers = Array.isArray(existingQuotas.allowed_stt_providers)
      ? existingQuotas.allowed_stt_providers
      : STT_PROVIDER_LIST.map(p => p.id);
    initQ.allowed_tts_providers = Array.isArray(existingQuotas.allowed_tts_providers)
      ? existingQuotas.allowed_tts_providers
      : TTS_PROVIDER_LIST.map(p => p.id);
    initQ.allowed_llm_providers = Array.isArray(existingQuotas.allowed_llm_providers)
      ? existingQuotas.allowed_llm_providers
      : LLM_PROVIDER_LIST.map(p => p.id);

    initQ.allowed_features = Array.isArray(existingQuotas.allowed_features) && existingQuotas.allowed_features.length > 0 && !existingQuotas.allowed_features.includes("*")
      ? existingQuotas.allowed_features
      : [...ALL_SANTRAL_MODULE_IDS];
    initQ.allowed_sub_features = Array.isArray(existingQuotas.allowed_sub_features) && !existingQuotas.allowed_sub_features.includes("*")
      ? existingQuotas.allowed_sub_features
      : [...ALL_SUB_FEATURE_IDS];
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

  const applyPackageTemplateToKeyGen = (tierKey) => {
    const tpl = (packageTemplates && packageTemplates[tierKey]) || DEFAULT_PACKAGE_TEMPLATES[tierKey];
    if (!tpl) return;
    setGenPlanTier(tierKey);

    const featList = Array.isArray(tpl.allowed_features)
      ? tpl.allowed_features.includes("*")
        ? [...ALL_SANTRAL_MODULE_IDS]
        : [...tpl.allowed_features]
      : [...ALL_SANTRAL_MODULE_IDS];
    const subList = Array.isArray(tpl.allowed_sub_features)
      ? tpl.allowed_sub_features.includes("*")
        ? [...ALL_SUB_FEATURE_IDS]
        : [...tpl.allowed_sub_features]
      : [...ALL_SUB_FEATURE_IDS];

    // Apply ONLY feature/module/AI-engine template — preserve customer-specific user/channel quotas!
    setGenCustomQuotas((prev) => ({
      ...prev,
      allowed_features: featList,
      allowed_sub_features: subList,
      allowed_stt_providers: Array.isArray(tpl.allowed_stt_providers) ? [...tpl.allowed_stt_providers] : [],
      allowed_tts_providers: Array.isArray(tpl.allowed_tts_providers) ? [...tpl.allowed_tts_providers] : [],
      allowed_llm_providers: Array.isArray(tpl.allowed_llm_providers) ? [...tpl.allowed_llm_providers] : [],
      unlicensed_module_mode: tpl.unlicensed_module_mode || prev.unlicensed_module_mode || "hidden"
    }));

    if (tpl.auto_unlimited) {
      setGenIsUnlimited(true);
    } else if (tpl.auto_expiry_days) {
      setGenIsUnlimited(false);
      setGenExpiryDate(computeDatePlusDaysISO(tpl.auto_expiry_days));
    } else if (genIsUnlimited) {
      setGenIsUnlimited(false);
      if (!genExpiryDate) {
        setGenExpiryDate(computeDatePlusDaysISO(365));
      }
    }
  };

  const applyModulePreset = (presetType) => {
    if (presetType === "all") {
      applyPackageTemplateToKeyGen("enterprise");
    } else if (presetType === "pbx_only" || presetType === "starter") {
      applyPackageTemplateToKeyGen("starter");
    } else if (presetType === "professional") {
      applyPackageTemplateToKeyGen("professional");
    } else if (presetType === "enterprise" || presetType === "unlimited" || presetType === "trial") {
      applyPackageTemplateToKeyGen(presetType);
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

  const getClientAlertReasons = (c) => {
    if (!c) return [];
    const reasons = [];
    const pushUnique = (msg) => {
      if (msg && !reasons.includes(msg)) reasons.push(msg);
    };
    if (Array.isArray(c.alert_reasons) && c.alert_reasons.length > 0) {
      c.alert_reasons.forEach((r) => pushUnique(String(r)));
    }
    const cpuV = Math.round(Number(c.cpu_usage_percent || 0) * 10) / 10;
    const ramV = Math.round(Number(c.ram_usage_percent || 0) * 10) / 10;
    const diskV = Math.round(Number(c.disk_usage_percent || 0) * 10) / 10;
    if (!c.is_online) pushUnique("Sunucu Çevrimdışı");
    if (c.connect_subdomain && !c.tunnel_connected) pushUnique("Tünel Kopuk");
    if (cpuV >= 85 && !reasons.some((r) => r.startsWith("Kritik CPU"))) {
      pushUnique(`Kritik CPU (%${cpuV})`);
    }
    if (ramV >= 85 && !reasons.some((r) => r.startsWith("Kritik RAM"))) {
      pushUnique(`Kritik RAM (%${ramV})`);
    }
    if (diskV >= 85 && !reasons.some((r) => r.startsWith("Kritik Disk"))) {
      pushUnique(`Kritik Disk (%${diskV})`);
    }
    if (Array.isArray(c.failed_services)) {
      c.failed_services.forEach((svc) => {
        if (svc) pushUnique(`Servis Kapalı: ${svc}`);
      });
    }
    return reasons;
  };

  const sortedClients = [...filteredClients].sort((a, b) => {
    const alertsA = getClientAlertReasons(a);
    const alertsB = getClientAlertReasons(b);
    const hasA = alertsA.length > 0 ? 1 : 0;
    const hasB = alertsB.length > 0 ? 1 : 0;
    if (hasA !== hasB) return hasB - hasA;
    if (alertsA.length !== alertsB.length) return alertsB.length - alertsA.length;
    return 0;
  });

  const alertServersCount = sortedClients.filter((c) => getClientAlertReasons(c).length > 0).length;
  const totalPages = Math.max(1, Math.ceil(sortedClients.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedClients = sortedClients.slice(pageStartIndex, pageStartIndex + pageSize);

  const getPaginationNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    if (start > 2) pages.push("...");
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const resolveClientExpiryDate = (c) => {
    if (c?.license_expires_at) return c.license_expires_at;
    const rawKey = c?.current_license_key || "";
    if (!rawKey) return null;
    const basePart = String(rawKey).trim().split(".")[0];
    const parts = basePart.split("-");
    if (parts.length >= 5) {
      const seg = (parts[parts.length - 3] || "").trim().toUpperCase();
      if (seg === "UNLIMITED") return "unlimited";
      if (/^\d{8}$/.test(seg)) {
        return `${seg.slice(0, 4)}-${seg.slice(4, 6)}-${seg.slice(6, 8)}`;
      }
    }
    return null;
  };

  const formatExpiryDateTR = (expStr) => {
    if (!expStr) return "—";
    if (expStr === "unlimited") return "♾️ Limitsiz";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(expStr).trim());
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    return expStr;
  };

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
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl px-6 lg:px-10 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs dark:shadow-none">
        {/* Left: Brand */}
        <div className="flex-1 flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center p-1.5 shadow-md shadow-indigo-500/10">
            <img src="/favicon.svg" alt="Nornia" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-300 bg-clip-text text-transparent truncate">
              Nornia Cloud Center
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              Merkezi Lisans &amp; Tünel Sunucusu
            </p>
          </div>
        </div>

        {/* Center: Primary Navigation Actions */}
        <nav className="flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => setShowPackagesModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none whitespace-nowrap"
            title="Lisans Paket Şablonlarını Düzenle (Starter / Professional / Enterprise Özellikleri)"
          >
            <Layers size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="hidden lg:inline">Paketler</span>
          </button>

          <button
            onClick={() => setShowSecurityModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none whitespace-nowrap"
            title="Merkez Güvenlik Kalkanı (SMTP, Brute-Force & IP Yönetimi)"
          >
            <Shield size={14} className="text-rose-600 dark:text-rose-400" />
            <span className="hidden lg:inline">Güvenlik Kalkanı</span>
          </button>

          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none whitespace-nowrap"
            title="Sistem İşlem Logları"
          >
            <Terminal size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="hidden lg:inline">İşlem Logları</span>
          </button>

          <button
            onClick={() => {
              setInitialEditUserId(null);
              setShowUsersModal(true);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none whitespace-nowrap"
            title="Master Kullanıcı Yönetimi & Kullanıcı Bazlı 2FA"
          >
            <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden lg:inline">Kullanıcılar</span>
          </button>
        </nav>

        {/* Right: Utilities & Avatar */}
        <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">

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

          {/* User Avatar Dropdown Menu */}
          {currentUser && (
            <div ref={avatarMenuRef} className="relative pl-2.5 ml-0.5 border-l border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAvatarMenu((prev) => !prev)}
                className="flex items-center gap-2.5 px-2 py-1 rounded-2xl hover:bg-slate-100/90 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Hesap Menüsü"
                aria-expanded={showAvatarMenu}
                aria-haspopup="menu"
              >
                <div className="text-right text-xs hidden md:block">
                  <div className="font-extrabold text-slate-800 dark:text-white leading-tight flex items-center justify-end gap-1.5">
                    <span>{currentUser.full_name}</span>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-indigo-500/25 ring-2 ring-white dark:ring-slate-900">
                    {getUserInitials(currentUser)}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      currentUser.two_factor_enabled || currentUser.totp_enabled || currentUser.email_2fa_enabled
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                    title={
                      currentUser.two_factor_enabled || currentUser.totp_enabled || currentUser.email_2fa_enabled
                        ? "2FA Koruması Aktif"
                        : "2FA Kapalı"
                    }
                  />
                </div>

                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-150 ${
                    showAvatarMenu ? "rotate-180 text-indigo-500" : ""
                  }`}
                />
              </button>

              {showAvatarMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-950/15 dark:shadow-black/50 overflow-hidden z-50 animate-fadeIn"
                >
                  {/* Profile Header */}
                  <div className="px-4 py-3.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {getUserInitials(currentUser)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {currentUser.full_name}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                            currentUser.two_factor_enabled || currentUser.totp_enabled || currentUser.email_2fa_enabled
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                              : "bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <ShieldCheck size={9} />
                          {currentUser.two_factor_enabled || currentUser.totp_enabled || currentUser.email_2fa_enabled
                            ? "2FA Aktif"
                            : "2FA Kapalı"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Settings Item */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setAccountSettingsTab("password");
                        setShowAccountSettingsModal(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left flex items-center gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                        <Settings size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                          Ayarlar
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          Şifre, 2FA ve otomatik oturum
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Bottom Logout Button */}
                  <div className="p-1.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        handleLogout("manual");
                      }}
                      className="w-full px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-left flex items-center gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                        <LogOut size={15} />
                      </div>
                      <div className="text-xs font-extrabold">Çıkış Yap</div>
                    </button>
                  </div>
                </div>
              )}
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

        {/* ACTIVE FILTER CHIPS (ONLY VISIBLE WHEN A FILTER OR SEARCH IS ACTIVE) */}
        {(filterStatus !== "all" || searchTerm.trim()) && (
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
        )}

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
                    <th className="py-3.5 px-4 whitespace-nowrap">Müşteri / Tenant</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Santral Seri No &amp; Donanım</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Nornia Connect &amp; SSH</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Kaynaklar &amp; Kanal</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Lisans Bitiş</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                  {paginatedClients.map((client) => {
                    const isSuspended = client.status === "suspended";
                    const alertReasons = getClientAlertReasons(client);
                    const hasAlert = alertReasons.length > 0;
                    const pbxSerial =
                      client.system_serial_number && client.system_serial_number !== "Henüz Bağlanmadı"
                        ? client.system_serial_number
                        : client.tenant_serial_number || "Henüz Bağlanmadı";
                    const cpuVal = Math.round(Number(client.cpu_usage_percent || 0) * 10) / 10;
                    const ramVal = Math.round(Number(client.ram_usage_percent || 0) * 10) / 10;
                    const diskVal = Math.round(Number(client.disk_usage_percent || 0) * 10) / 10;
                    const maxCalls = client.custom_quotas?.max_concurrent_calls ?? 4;
                    const tolCalls = client.custom_quotas?.tolerance_concurrent_calls ?? 0;
                    const userQuota = getClientUserLicenseCount(client);

                    return (
                      <tr
                        key={client.id}
                        className={`transition-colors align-middle ${
                          hasAlert
                            ? "bg-rose-50/95 dark:bg-rose-950/45 hover:bg-rose-100/90 dark:hover:bg-rose-950/65 shadow-[inset_4px_0_0_0_#e11d48]"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* 1. Müşteri / Tenant */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                              hasAlert
                                ? "bg-rose-600 animate-pulse ring-4 ring-rose-500/25"
                                : isSuspended
                                  ? "bg-rose-500"
                                  : client.is_online
                                    ? "bg-emerald-500 animate-pulse"
                                    : "bg-slate-400"
                            }`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-extrabold text-sm leading-tight ${
                                  hasAlert ? "text-rose-950 dark:text-rose-100" : "text-slate-900 dark:text-white"
                                }`}>
                                  {client.company_name}
                                </span>
                                {hasAlert && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                                    <AlertTriangle size={9} />
                                    ALARM
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                                  {client.tenant_code}
                                </span>
                                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700">
                                  {client.plan_tier || "professional"}
                                </span>
                              </div>
                              {hasAlert && (
                                <div className="flex flex-wrap gap-1 mt-1.5 max-w-[280px]">
                                  {alertReasons.map((reason, rIdx) => (
                                    <span
                                      key={rIdx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-600/15 dark:bg-rose-500/25 border border-rose-500/35 text-rose-700 dark:text-rose-200 text-[10px] font-extrabold leading-tight"
                                    >
                                      <AlertTriangle size={9} className="shrink-0" />
                                      <span>{reason}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Santral Seri No & Donanım */}
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-extrabold text-indigo-700 dark:text-indigo-300 text-[12px]">
                            <span>{pbxSerial}</span>
                            {pbxSerial && pbxSerial !== "Henüz Bağlanmadı" && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(pbxSerial, `tbl-sn-${client.id}`)}
                                className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                                title="Santral Seri Numarasını Kopyala"
                              >
                                {copiedKey === `tbl-sn-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{client.hardware_id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(client.hardware_id, `tbl-hw-${client.id}`)}
                              className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                              title="Donanım ID Kopyala"
                            >
                              {copiedKey === `tbl-hw-${client.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>{client.ip_address || "127.0.0.1"}</span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {client.software_version || "—"}
                            </span>
                          </div>
                        </td>

                        {/* 3. Nornia Connect (Root SSO on click) & SSH */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {client.connect_subdomain ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={ssoLoadingId === client.id}
                                  onClick={() => handleRootSsoLogin(client)}
                                  className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                  title="Root SSO ile şifre girmeden santral paneline doğrudan bağlan"
                                >
                                  <ShieldCheck size={13} className="text-indigo-500 shrink-0" />
                                  <span>
                                    {ssoLoadingId === client.id
                                      ? "Bağlanıyor..."
                                      : `${client.connect_subdomain}.nornia.com.tr`}
                                  </span>
                                  <ExternalLink size={11} className="opacity-70 shrink-0" />
                                </button>
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                                  client.tunnel_connected
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-500 border border-slate-300/60 dark:border-slate-700"
                                }`}>
                                  {client.tunnel_connected ? "Tünel Aktif" : "Bağlı Değil"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={otaLoadingId === client.id || !client.tunnel_connected}
                                  onClick={() => handleRemoteOtaUpdate(client)}
                                  className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-300 hover:text-white border border-cyan-500/25 text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-40"
                                  title="Nornia Connect tüneli üzerinden santrali uzaktan tek tıkla güncelle (OTA Update)"
                                >
                                  <RefreshCw size={10} className={otaLoadingId === client.id ? "animate-spin" : ""} />
                                  <span>{otaLoadingId === client.id ? "Güncelleniyor..." : "OTA Güncelle"}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={togglingSshId === client.id}
                                  onClick={() => handleToggleClientSsh(client)}
                                  className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                                    client.remote_ssh_enabled !== false
                                      ? "bg-emerald-500/10 hover:bg-rose-600 text-emerald-700 dark:text-emerald-300 hover:text-white border-emerald-500/25"
                                      : "bg-rose-500/10 hover:bg-emerald-600 text-rose-700 dark:text-rose-300 hover:text-white border-rose-500/25"
                                  }`}
                                  title={
                                    client.remote_ssh_enabled !== false
                                      ? "Santralde SSH Erişimi AÇIK — Kapatmak için tıklayın"
                                      : "Santralde SSH Erişimi KAPALI — Açmak için tıklayın"
                                  }
                                >
                                  <Power size={10} />
                                  <span>{togglingSshId === client.id ? "..." : client.remote_ssh_enabled !== false ? "SSH Açık" : "SSH Kapalı"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUnlockConfirmClient(client)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-500/25 text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                                  title="Santraldeki Nornia Connect Alt Alan Adı Kilidini Serbest Bırak"
                                >
                                  <Unlock size={10} />
                                  <span>Kilidi Çöz</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-semibold">Tünel Tanımsız</span>
                          )}
                        </td>

                        {/* 4. Kaynaklar (CPU / RAM / DISK Devir Saati) & Kapasite */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-extrabold">
                                {maxCalls}{tolCalls > 0 ? `+${tolCalls}` : ""} Kanal
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 font-mono text-[10px] font-extrabold">
                                {userQuota} Abone
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MiniTachometerGauge label="CPU" value={cpuVal} />
                              <MiniTachometerGauge label="RAM" value={ramVal} />
                              <MiniTachometerGauge label="DİSK" value={diskVal} />
                            </div>
                          </div>
                        </td>

                        {/* 5. Lisans Bitiş */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {(() => {
                            const effExp = resolveClientExpiryDate(client);
                            return (
                              <>
                                <div className="font-mono font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                                  {formatExpiryDateTR(effExp)}
                                </div>
                                {client.days_left !== null && client.days_left !== undefined && effExp !== "unlimited" ? (
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                    client.days_left <= 7
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                      : client.days_left <= expiringSoonDays
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  }`}>
                                    {client.days_left} gün kaldı
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {effExp === "unlimited" ? "Süresiz" : effExp ? "" : "Tarih yok"}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </td>

                        {/* 6. İşlemler */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
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

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">
                  Gösterilen:{" "}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {sortedClients.length === 0 ? 0 : pageStartIndex + 1}–{Math.min(pageStartIndex + pageSize, sortedClients.length)}
                  </strong>{" "}
                  / <strong className="text-slate-900 dark:text-white font-mono">{sortedClients.length}</strong> sunucu
                </span>
                {alertServersCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-extrabold">
                    <AlertTriangle size={11} />
                    {alertServersCount} Alarmlı Sunucu Üstte
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sayfa başı:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    {[10, 25, 50, 100].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-[11px] transition-colors cursor-pointer"
                    title="Önceki Sayfa"
                  >
                    <ChevronLeft size={13} />
                    <span>Önceki</span>
                  </button>

                  {getPaginationNumbers().map((pg, idx) =>
                    pg === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-bold select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setCurrentPage(pg)}
                        className={`min-w-[30px] h-[30px] px-2 rounded-lg font-mono text-xs font-extrabold transition-colors cursor-pointer ${
                          pg === safeCurrentPage
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-[11px] transition-colors cursor-pointer"
                    title="Sonraki Sayfa"
                  >
                    <span>Sonraki</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
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
                          {(() => {
                            const effExp = resolveClientExpiryDate(client);
                            return (
                              <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{formatExpiryDateTR(effExp)}</span>
                                {client.days_left !== null &&
                                  client.days_left !== undefined &&
                                  effExp !== "unlimited" && (
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
                            );
                          })()}
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

                    <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">CPU / RAM / DİSK</div>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                        {[
                          { k: "C", v: Math.round(Number(client.cpu_usage_percent || 0)) },
                          { k: "R", v: Math.round(Number(client.ram_usage_percent || 0)) },
                          { k: "D", v: Math.round(Number(client.disk_usage_percent || 0)) }
                        ].map((m) => (
                          <div key={m.k} className="space-y-0.5">
                            <div className="font-extrabold text-slate-700 dark:text-slate-200">
                              {m.k}:{m.v}%
                            </div>
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  m.v >= 85 ? "bg-rose-500" : m.v >= 70 ? "bg-amber-500" : "bg-indigo-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(6, m.v))}%` }}
                              />
                            </div>
                          </div>
                        ))}
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
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Paket Türü (Özellik Şablonu)</label>
                  <select
                    value={planTier}
                    onChange={(e) => handleSelectNewPlanTier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                  >
                    {PACKAGE_TIER_ORDER.map((tk) => {
                      const tpl = (packageTemplates && packageTemplates[tk]) || DEFAULT_PACKAGE_TEMPLATES[tk];
                      return (
                        <option key={tk} value={tk}>
                          {tpl.name}
                        </option>
                      );
                    })}
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

      {/* KEY GENERATOR MODAL — ROLE-STYLE LEFT SIDEBAR SPLIT STUDIO */}
      {keyGenModalClient && (() => {
        const activeTpl = (packageTemplates && packageTemplates[genPlanTier]) || DEFAULT_PACKAGE_TEMPLATES[genPlanTier] || DEFAULT_PACKAGE_TEMPLATES.professional;
        const curAllowedMods = Array.isArray(genCustomQuotas.allowed_features)
          ? genCustomQuotas.allowed_features.includes("*")
            ? [...ALL_SANTRAL_MODULE_IDS]
            : genCustomQuotas.allowed_features
          : [...ALL_SANTRAL_MODULE_IDS];
        const curAllowedSubs = Array.isArray(genCustomQuotas.allowed_sub_features)
          ? genCustomQuotas.allowed_sub_features.includes("*")
            ? [...ALL_SUB_FEATURE_IDS]
            : genCustomQuotas.allowed_sub_features
          : [...ALL_SUB_FEATURE_IDS];
        const aiEngineCnt =
          (genCustomQuotas.allowed_stt_providers || []).length +
          (genCustomQuotas.allowed_tts_providers || []).length +
          (genCustomQuotas.allowed_llm_providers || []).length;
        const maxCallsVal = genCustomQuotas.max_concurrent_calls !== undefined ? genCustomQuotas.max_concurrent_calls : 4;
        const maxUsersVal = genCustomQuotas.max_users !== undefined ? genCustomQuotas.max_users : 50;
        const retentionVal = Number(genCustomQuotas.enforced_retention_days ?? 0);

        const studioTabs = [
          {
            id: "general",
            label: "Paket & Geçerlilik",
            desc: "Plan, durum, süre & donanım",
            icon: Shield,
            badge: activeTpl.shortName || genPlanTier
          },
          {
            id: "modules",
            label: "Modüller & Raporlar",
            desc: "Santral modül görünürlüğü",
            icon: Layers,
            badge: `${curAllowedMods.length}/${ALL_SANTRAL_MODULE_IDS.length}`
          },
          {
            id: "subfeatures",
            label: "Alt Özellikler & Kanallar",
            desc: "WebPhone & Omnichannel",
            icon: Sparkles,
            badge: `${curAllowedSubs.length}/${ALL_SUB_FEATURE_IDS.length}`
          },
          {
            id: "ai",
            label: "Yapay Zeka & Motorlar",
            desc: "AI hakları, STT / TTS / LLM",
            icon: Bot,
            badge: `${aiEngineCnt} Motor`
          },
          {
            id: "pbx",
            label: "Santral & Akış Kotaları",
            desc: "Kanal, abone, hat & kuyruk",
            icon: PhoneCall,
            badge: `${maxCallsVal}K • ${maxUsersVal}A`
          },
          {
            id: "retention",
            label: "Saklama & Güvenlik",
            desc: "Kayıt süresi, yedek & altyapı",
            icon: HardDrive,
            badge: retentionVal > 0 ? `${retentionVal} Gün` : "Serbest"
          }
        ];

        const modQ = keyGenModuleSearch.trim().toLowerCase();
        const subGroups = ["Abone & WebPhone", "Omnichannel Kanalları", "AI WebPhone"];

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <form
              onSubmit={handleGenerateCustomKey}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
            >
              {/* Top Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                    <Key size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                        Lisans Yenileme Stüdyosu — {keyGenModalClient.company_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                        {keyGenModalClient.tenant_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {keyGenModalClient.system_serial_number && (
                        <span>
                          Santral Seri: <strong className="text-slate-700 dark:text-slate-200">{keyGenModalClient.system_serial_number}</strong>
                        </span>
                      )}
                      {keyGenModalClient.tenant_serial_number && (
                        <span>
                          • Tenant Seri: <strong className="text-indigo-600 dark:text-indigo-400">{keyGenModalClient.tenant_serial_number}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {keyGenModalClient.current_license_key && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(keyGenModalClient.current_license_key, "modal-cur-key")}
                      className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedKey === "modal-cur-key" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      <span>{copiedKey === "modal-cur-key" ? "Kopyalandı!" : "Key Kopyala"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setKeyGenModalClient(null)}
                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                    title="Kapat"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Split Body: Left Sidebar Headings + Right Editor Panel */}
              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Left Sidebar Tabs (RoleSettings style) */}
                <aside className="w-60 sm:w-68 lg:w-72 bg-slate-50/70 dark:bg-slate-950/40 border-r border-slate-200/80 dark:border-slate-800/80 p-3.5 shrink-0 overflow-y-auto flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-2.5">
                      Lisans Başlıkları
                    </div>
                    <nav className="space-y-1">
                      {studioTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        const isActive = keyGenActiveTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setKeyGenActiveTab(tab.id)}
                            className={`w-full px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                              isActive
                                ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/80 shadow-xs text-indigo-700 dark:text-indigo-300"
                                : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                  isActive
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                <TabIcon size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold truncate">{tab.label}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                  {tab.desc}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-extrabold shrink-0 ${
                                isActive
                                  ? "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
                                  : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {tab.badge}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>

                  {/* Compact Live License Summary Card at Sidebar Bottom */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Özet</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          genStatus === "active"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {genStatus === "active" ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans font-semibold">Bitiş:</span>
                        <strong className="text-slate-800 dark:text-slate-100">
                          {genIsUnlimited ? "♾️ Limitsiz" : formatExpiryDateTR(genExpiryDate)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans font-semibold">Donanım:</span>
                        <strong className="text-slate-800 dark:text-slate-100 truncate max-w-[125px]" title={genHwId}>
                          {genHwId || "UNBOUND"}
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPackagesModal(true)}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 text-slate-700 dark:text-slate-300 hover:text-white text-[10px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Layers size={11} />
                      <span>Paket Şablonlarını Düzenle</span>
                    </button>
                  </div>
                </aside>

                {/* Right Detail Content Panel */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs font-semibold">
                  {/* TAB 1: PAKET & GEÇERLİLİK */}
                  {keyGenActiveTab === "general" && (
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <Shield size={16} className="text-rose-500" />
                          <span>Lisans Paketi, Durum &amp; Geçerlilik Yapılandırması</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          Paket değiştirdiğinizde özellik/modül şablonu otomatik uygulanır; çağrı kanalı ve abone kotaları korunur.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                        {/* Lisans Paketi */}
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                            Lisans Paketi / Planı
                          </label>
                          <select
                            value={genPlanTier}
                            onChange={(e) => applyPackageTemplateToKeyGen(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-900 dark:text-white cursor-pointer text-xs"
                          >
                            {PACKAGE_TIER_ORDER.map((tk) => {
                              const tpl = (packageTemplates && packageTemplates[tk]) || DEFAULT_PACKAGE_TEMPLATES[tk];
                              return (
                                <option key={tk} value={tk}>
                                  {tpl.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Müşteri Durumu */}
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                            Müşteri Durumu
                          </label>
                          <select
                            value={genStatus}
                            onChange={(e) => setGenStatus(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-900 dark:text-white cursor-pointer text-xs"
                          >
                            <option value="active">🟢 Aktif (Erişim &amp; AI Açık)</option>
                            <option value="passive">🔴 Pasif (Erişim &amp; AI Kapalı)</option>
                          </select>
                        </div>

                        {/* Eş Zamanlı Çağrı Kanalı */}
                        <div>
                          <label className="block text-blue-600 dark:text-blue-400 font-extrabold mb-1.5" title="AI Agent + Otomatik Arama (Dialer) + Kullanıcı Gelen/Giden Çağrı Kanalı">
                            Eş Zamanlı Çağrı Kanalı
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={maxCallsVal}
                            onChange={(e) => handleQuotaChange("max_concurrent_calls", e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-extrabold text-slate-900 dark:text-white text-xs"
                          />
                        </div>

                        {/* Tolerans Çağrı Kanalı */}
                        <div>
                          <label className="block text-amber-600 dark:text-amber-400 font-extrabold mb-1.5" title="0 girilirse ana limit dolduğunda çağrı durdurulur. 1 veya üstü girilirse çağrı kesilmez, +N tolerans kanalı devreye girer.">
                            Tolerans Çağrı Kanalı
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={genCustomQuotas.tolerance_concurrent_calls !== undefined ? genCustomQuotas.tolerance_concurrent_calls : 0}
                            onChange={(e) => handleQuotaChange("tolerance_concurrent_calls", e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl focus:outline-none focus:border-amber-500 font-mono font-extrabold text-slate-900 dark:text-white text-xs"
                          />
                        </div>

                        {/* Lisans Bitiş Tarihi */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
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
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold text-slate-900 dark:text-white disabled:opacity-40 text-xs"
                          />
                        </div>

                        {/* Hedef Donanım ID */}
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                            Hedef Donanım ID (Machine Binding)
                          </label>
                          <input
                            type="text"
                            value={genHwId}
                            onChange={(e) => setGenHwId(e.target.value)}
                            placeholder="UNBOUND veya HW-361B-F973"
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-mono font-bold text-slate-900 dark:text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* Active Package Feature Summary */}
                      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold ${activeTpl.badgeClass || "bg-indigo-500/15 text-indigo-700 border-indigo-500/30"}`}>
                              {activeTpl.name}
                            </span>
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">{curAllowedMods.length}/{ALL_SANTRAL_MODULE_IDS.length}</span> Modül •{" "}
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">{curAllowedSubs.length}/{ALL_SUB_FEATURE_IDS.length}</span> Alt Özellik •{" "}
                              <span className="font-mono text-purple-600 dark:text-purple-400">{aiEngineCnt}</span> AI Motoru
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            {activeTpl.tagline}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyPackageTemplateToKeyGen(genPlanTier)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold cursor-pointer transition-colors shrink-0"
                        >
                          Şablonu Tekrar Uygula
                        </button>
                      </div>

                      {/* Current Key Strip */}
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Mevcut Lisans Anahtarı
                        </div>
                        <div className="font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
                          {keyGenModalClient.current_license_key
                            ? keyGenModalClient.current_license_key.length > 70
                              ? `${keyGenModalClient.current_license_key.substring(0, 48)}...${keyGenModalClient.current_license_key.slice(-14)}`
                              : keyGenModalClient.current_license_key
                            : "Henüz üretilmedi"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MODÜLLER & RAPORLAR */}
                  {keyGenActiveTab === "modules" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers size={16} className="text-indigo-500" />
                            <span>Santral Modül &amp; Rapor Yetkileri ({curAllowedMods.length}/{ALL_SANTRAL_MODULE_IDS.length})</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            Kapattığınız modüller müşterinin santralinde ve Roller ekranında görünmez; müşteri Admin hesabıyla bile açamaz.
                          </p>
                        </div>

                        <div className="relative w-full sm:w-60">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={keyGenModuleSearch}
                            onChange={(e) => setKeyGenModuleSearch(e.target.value)}
                            placeholder="Modül veya rapor ara..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Quick Package Presets + Unlicensed Behavior */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                            Hızlı Şablon:
                          </span>
                          {[
                            { id: "starter", label: "Starter", cls: "bg-sky-600 border-sky-600" },
                            { id: "professional", label: "Professional", cls: "bg-indigo-600 border-indigo-600" },
                            { id: "enterprise", label: "Enterprise", cls: "bg-purple-600 border-purple-600" },
                            { id: "unlimited", label: "Limitsiz", cls: "bg-emerald-600 border-emerald-600" }
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyPackageTemplateToKeyGen(p.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-colors ${
                                genPlanTier === p.id
                                  ? `${p.cls} text-white`
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        <select
                          value={genCustomQuotas.unlicensed_module_mode || "hidden"}
                          onChange={(e) =>
                            setGenCustomQuotas((prev) => ({ ...prev, unlicensed_module_mode: e.target.value }))
                          }
                          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
                          title="Satılmayan modüllerin santraldeki davranışı"
                        >
                          <option value="hidden">👻 Lisanssız Modülleri Gizle</option>
                          <option value="teaser">🔒 Kilitli Göster (Teaser)</option>
                        </select>
                      </div>

                      {/* 2-Column Clean Category Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {SANTRAL_MODULE_CATEGORIES.map((cat) => {
                          const catItems = modQ
                            ? cat.items.filter(
                                (it) => it.label.toLowerCase().includes(modQ) || it.id.toLowerCase().includes(modQ)
                              )
                            : cat.items;
                          if (modQ && catItems.length === 0) return null;
                          const catIds = cat.items.map((i) => i.id);
                          const selectedCount = catIds.filter((id) => curAllowedMods.includes(id)).length;
                          const allInCat = selectedCount === catIds.length;

                          return (
                            <div
                              key={cat.id}
                              className="bg-slate-50/60 dark:bg-slate-950/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 flex flex-col"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800">
                                <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                                  {cat.title}{" "}
                                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                    ({selectedCount}/{catIds.length})
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleCategoryModules(cat.items)}
                                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer"
                                >
                                  {allInCat ? "Kaldır" : "Tümü"}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {catItems.map((mod) => {
                                  const isChecked = curAllowedMods.includes(mod.id);
                                  return (
                                    <label
                                      key={mod.id}
                                      className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors select-none ${
                                        isChecked
                                          ? "bg-white dark:bg-slate-900 border-indigo-400/70 dark:border-indigo-700 text-slate-900 dark:text-white font-bold"
                                          : "bg-white/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleProviderOption("allowed_features", mod.id)}
                                        className="rounded accent-indigo-600 cursor-pointer shrink-0"
                                      />
                                      <span className="text-[11px] truncate" title={mod.label}>
                                        {mod.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ALT ÖZELLİKLER & KANALLAR */}
                  {keyGenActiveTab === "subfeatures" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" />
                            <span>Gelişmiş Abone, WebPhone &amp; Omnichannel Alt Özellikleri ({curAllowedSubs.length}/{ALL_SUB_FEATURE_IDS.length})</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            Müşterinin santralinde açık olacak kanalları ve WebPhone / abone yeteneklerini seçin.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setGenCustomQuotas((prev) => ({ ...prev, allowed_sub_features: [...ALL_SUB_FEATURE_IDS] }))}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-extrabold cursor-pointer"
                          >
                            Tümünü Aç
                          </button>
                          <button
                            type="button"
                            onClick={() => setGenCustomQuotas((prev) => ({ ...prev, allowed_sub_features: [] }))}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 text-[11px] font-extrabold cursor-pointer"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {subGroups.map((grp) => (
                          <div
                            key={grp}
                            className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                          >
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                              {grp}
                            </div>
                            <div className="space-y-1.5">
                              {SUB_FEATURE_LIST.filter((s) => s.group === grp).map((sf) => {
                                const isChecked = curAllowedSubs.includes(sf.id);
                                return (
                                  <label
                                    key={sf.id}
                                    className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors select-none ${
                                      isChecked
                                        ? "bg-white dark:bg-slate-900 border-amber-400/70 dark:border-amber-700 text-slate-900 dark:text-white font-bold"
                                        : "bg-white/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleProviderOption("allowed_sub_features", sf.id)}
                                      className="rounded accent-amber-600 cursor-pointer shrink-0"
                                    />
                                    <span className="text-[11px] leading-snug">{sf.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: YAPAY ZEKA & MOTORLAR */}
                  {keyGenActiveTab === "ai" && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <Bot size={16} className="text-purple-500" />
                            <span>Yapay Zeka Lisans Hakları &amp; Motor Yetkileri</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            AI temsilci, bilgi bankası ve senaryo haklarını ile izin verilen STT / TTS / LLM motorlarını yönetin.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setGenCustomQuotas((prev) => ({
                                ...prev,
                                allowed_stt_providers: STT_PROVIDER_LIST.map((p) => p.id),
                                allowed_tts_providers: TTS_PROVIDER_LIST.map((p) => p.id),
                                allowed_llm_providers: LLM_PROVIDER_LIST.map((p) => p.id)
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-extrabold cursor-pointer"
                          >
                            Tüm Motorları Aç
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGenCustomQuotas((prev) => ({
                                ...prev,
                                allowed_stt_providers: [],
                                allowed_tts_providers: [],
                                allowed_llm_providers: []
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 text-[11px] font-extrabold cursor-pointer"
                          >
                            Tümünü Kapat
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {AI_QUOTA_FIELDS.map((q) => (
                          <div
                            key={q.key}
                            className="bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-2xl border border-purple-200/70 dark:border-purple-900/40 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{q.label}</span>
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold">{q.unit}</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                              onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                        {[
                          { title: "İzin Verilen STT (Ses Tanıma)", key: "allowed_stt_providers", list: STT_PROVIDER_LIST },
                          { title: "İzin Verilen TTS (Seslendirme)", key: "allowed_tts_providers", list: TTS_PROVIDER_LIST },
                          { title: "İzin Verilen LLM (Dil Modeli)", key: "allowed_llm_providers", list: LLM_PROVIDER_LIST }
                        ].map((grp) => (
                          <div
                            key={grp.key}
                            className="bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-2xl border border-purple-200/70 dark:border-purple-900/40 space-y-2.5"
                          >
                            <div className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider pb-1.5 border-b border-purple-200/50 dark:border-purple-900/40">
                              {grp.title}
                            </div>
                            <div className="space-y-1.5">
                              {grp.list.map((p) => {
                                const checked = (genCustomQuotas[grp.key] || []).includes(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    className={`px-2.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer select-none ${
                                      checked
                                        ? "bg-white dark:bg-slate-900 border-purple-400/70 dark:border-purple-700 text-slate-900 dark:text-white font-bold"
                                        : "bg-white/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 text-slate-500"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleProviderOption(grp.key, p.id)}
                                      className="rounded accent-purple-600 cursor-pointer shrink-0"
                                    />
                                    <span className="text-[11px] leading-snug">{p.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: SANTRAL & AKIŞ KOTALARI */}
                  {keyGenActiveTab === "pbx" && (
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <PhoneCall size={16} className="text-blue-500" />
                          <span>Santral, Dahili &amp; Çağrı Akışı Kapasite Kotaları</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          Bu sayılar müşteriye özeldir ve paket şablonu değiştiğinde ezilmez.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Santral &amp; Dahili Limitleri
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {PBX_QUOTA_FIELDS.map((q) => (
                            <div
                              key={q.key}
                              className="bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{q.label}</span>
                                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-mono font-bold shrink-0">{q.unit}</span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                                onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Çağrı Yönlendirme &amp; Akış Limitleri
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {FLOW_QUOTA_FIELDS.map((q) => (
                            <div
                              key={q.key}
                              className="bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{q.label}</span>
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">{q.unit}</span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={genCustomQuotas[q.key] !== undefined ? genCustomQuotas[q.key] : q.defaultVal}
                                onChange={(e) => handleQuotaChange(q.key, e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: SAKLAMA & GÜVENLİK POLİTİKASI */}
                  {keyGenActiveTab === "retention" && (
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <HardDrive size={16} className="text-amber-500" />
                          <span>Zorunlu Saklama, Yedekleme &amp; Altyapı Görünürlük Politikası</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          Merkezden zorunlu ses kaydı saklama süresi, maksimum yedek adedi ve servis sağlayıcı altyapı kilidini ayarlayın.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                            Zorunlu Ses Kaydı Saklama Süresi (Gün)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={genCustomQuotas.enforced_retention_days ?? 0}
                            onChange={(e) => handleQuotaChange("enforced_retention_days", e.target.value)}
                            placeholder="0 = Müşteri Serbest (Örn: 90)"
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white"
                          />
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            0 girilirse müşteri santral içinden kendi saklama süresini belirler. 0&apos;dan büyük bir değer girilirse santralde kilitlenir.
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                            Maksimum Sistem Yedeği Adedi
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={genCustomQuotas.enforced_max_backups ?? 0}
                            onChange={(e) => handleQuotaChange("enforced_max_backups", e.target.value)}
                            placeholder="0 = Serbest (Örn: 5)"
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white"
                          />
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Disk dolmasını önlemek için santralde tutulabilecek en fazla yedek sayısını sınırlar (0 = sınırsız).
                          </p>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/50">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(genCustomQuotas.hide_provider_infra_from_customer_admin)}
                            onChange={(e) =>
                              setGenCustomQuotas((prev) => ({
                                ...prev,
                                hide_provider_infra_from_customer_admin: e.target.checked
                              }))
                            }
                            className="mt-1 rounded accent-indigo-600 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                              Teknik Altyapı &amp; SSH Ekranlarını Müşteri Admininden Gizle
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed font-medium">
                              İşaretlendiğinde Nornia Connect, Web SSH Terminali, Ağ/IP, NAT, Multi-Tenant ve sngrep ekranları müşteri yöneticisinden gizlenir; yalnızca bu panelden Root SSO ile giriş yaptığınızda görünür.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {genError && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{genError}</span>
                    </div>
                  )}

                  {generatedResultKey && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
                      <div className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5">
                        <Check size={16} /> Yeni İmzalı Key Başarıyla Üretildi ve Santrale İletildi!
                      </div>
                      <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white flex items-center justify-between gap-2 shadow-xs">
                        <span className="truncate">{generatedResultKey}</span>
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
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold">{activeTpl.name}</span> •{" "}
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{curAllowedMods.length}</span> modül •{" "}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{curAllowedSubs.length}</span> alt özellik
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setKeyGenModalClient(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Kapat
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingKey}
                    className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-2 transition-all ${
                      isGeneratingKey ? "bg-slate-400 text-white cursor-not-allowed" : "bg-rose-600 hover:bg-rose-500 text-white"
                    }`}
                  >
                    {isGeneratingKey ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                    <span>{isGeneratingKey ? "Key Üretiliyor & Kaydediliyor..." : "Yeni Key Üret & Kaydet"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}


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
      />
      {/* PACKAGE TEMPLATES MANAGEMENT MODAL */}
      <PackageTemplatesModal
        isOpen={showPackagesModal}
        onClose={() => setShowPackagesModal(false)}
        currentUser={currentUser}
        packageTemplates={packageTemplates}
        onTemplatesUpdated={fetchPackageTemplates}
      />

      {/* PERSONAL ACCOUNT SETTINGS MODAL (PASSWORD & 2FA) */}
      <AccountSettingsModal
        isOpen={showAccountSettingsModal}
        onClose={() => setShowAccountSettingsModal(false)}
        currentUser={currentUser}
        onCurrentUserUpdated={(u) => setCurrentUser(u)}
        onOpenSecuritySmtp={() => {
          setShowAccountSettingsModal(false);
          setShowSecurityModal(true);
        }}
        initialTab={accountSettingsTab}
      />
    </div>
  );
}
