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
  Wifi
} from "lucide-react";

import LoginModal from "../components/LoginModal";
import UserManagementModal from "../components/UserManagementModal";
import AuditLogsModal from "../components/AuditLogsModal";

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
    total_active_calls: 0
  });
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
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [unlockConfirmClient, setUnlockConfirmClient] = useState(null);
  const [unlockingSubdomain, setUnlockingSubdomain] = useState(false);
  const [togglingSshId, setTogglingSshId] = useState(null);

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

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
    } catch (e) {}
    sessionStorage.removeItem("master_user");
    setCurrentUser(null);
  };

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

    setGenCustomQuotas(initQ);
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

  if (!currentUser && !isAuthChecking) {
    return <LoginModal onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col font-sans">
      <Head>
        <title>Nornia Cloud Center — Merkezi Lisans &amp; Filo Yönetimi</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xs dark:shadow-none">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center p-1.5 shadow-md shadow-indigo-500/10">
            <img src="/favicon.svg" alt="Nornia" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-300 bg-clip-text text-transparent">
                Nornia Cloud Center
              </h1>
              <span className="text-[10px] bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30 px-2 py-0.5 rounded-full font-extrabold tracking-wide">
                v2.5 Master
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Merkezi Lisans Otoritesi, Nornia Connect &amp; Filo Yönetim Konsolu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Sistem İşlem Logları"
          >
            <Terminal size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">İşlem Logları</span>
          </button>

          <button
            onClick={() => setShowUsersModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Master Kullanıcı Yönetimi"
          >
            <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Kullanıcılar</span>
          </button>

          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-xs dark:shadow-none cursor-pointer"
            title="Filo Verilerini Yenile"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-500" : ""} />
            <span className="hidden sm:inline">Yenile</span>
          </button>

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
              <div className="text-right text-xs hidden md:block">
                <div className="font-extrabold text-slate-800 dark:text-white leading-tight">{currentUser.full_name}</div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">@{currentUser.username}</div>
              </div>
              <button
                onClick={handleLogout}
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

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 lg:p-5 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xs dark:shadow-none">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Toplam Kurulum</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">{stats.total_clients}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Kayıtlı Santral &amp; Tenant</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Server size={20} />
            </div>
          </div>

          <div className="p-4 lg:p-5 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xs dark:shadow-none">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Canlı Sunucular</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{stats.online_count}</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Aktif Heartbeat &amp; Tünel</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity size={20} />
            </div>
          </div>

          <div className="p-4 lg:p-5 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xs dark:shadow-none">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Süresi Yaklaşan</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400">{stats.expiring_soon_count}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">15 Gün İçinde Dolacak</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
          </div>

          <div className="p-4 lg:p-5 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xs dark:shadow-none">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasif / Durdurulan</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-rose-600 dark:text-rose-500">{stats.expired_count}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Askıda veya Süresi Biten</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-500 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
          </div>

          <div className="p-4 lg:p-5 bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xs dark:shadow-none col-span-2 md:col-span-1">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Canlı Aktif Çağrı</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stats.total_active_calls}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Filo Geneli Görüşme</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <PhoneCall size={20} />
            </div>
          </div>
        </div>

        {/* FILTER, SEARCH & VIEW MODE BAR */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs dark:shadow-none">
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Firma adı, tenant kodu, alt alan adı (.nornia.com.tr), Seri No veya Donanım ID ara..."
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/90 border border-slate-200/90 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === "all"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tümü ({clients.length})
              </button>
              <button
                onClick={() => setFilterStatus("online")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "online"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${filterStatus === "online" ? "bg-white" : "bg-emerald-500"}`} />
                <span>Canlı ({stats.online_count})</span>
              </button>
              <button
                onClick={() => setFilterStatus("offline")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "offline"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Çevrimdışı ({stats.offline_count})</span>
              </button>
              <button
                onClick={() => setFilterStatus("suspended")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "suspended"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${filterStatus === "suspended" ? "bg-white" : "bg-rose-500"}`} />
                <span>Askıda ({stats.expired_count})</span>
              </button>
            </div>

            {/* View Switcher: Cards vs Table */}
            <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Modern Kart Görünümü"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Kartlar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Kurumsal Tablo Görünümü"
              >
                <List size={14} />
                <span className="hidden sm:inline">Tablo</span>
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
                    <th className="py-3.5 px-4">Nornia Connect &amp; SSH</th>
                    <th className="py-3.5 px-4">Donanım &amp; Sürüm</th>
                    <th className="py-3.5 px-4">Kaynak &amp; Kanal</th>
                    <th className="py-3.5 px-4">Lisans Bitiş</th>
                    <th className="py-3.5 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                  {filteredClients.map((client) => {
                    const isSuspended = client.status === "suspended";
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
                        <td className="py-3.5 px-4">
                          {client.connect_subdomain ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`https://${client.connect_subdomain}.nornia.com.tr`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
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
                                  disabled={togglingSshId === client.id}
                                  onClick={() => handleToggleClientSsh(client)}
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                                    client.remote_ssh_enabled !== false
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30"
                                  }`}
                                >
                                  <Power size={9} />
                                  <span>{client.remote_ssh_enabled !== false ? "SSH Açık" : "SSH Kapalı"}</span>
                                </button>
                                {client.remote_ssh_enabled !== false && (
                                  <button
                                    type="button"
                                    onClick={() => openSshModal(client)}
                                    className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Terminal size={10} />
                                    <span>Web SSH</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setUnlockConfirmClient(client)}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-300 hover:text-white border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
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
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <span>{client.hardware_id}</span>
                            <button
                              onClick={() => handleCopyText(client.hardware_id, `tbl-hw-${client.id}`)}
                              className="text-slate-400 hover:text-indigo-500 cursor-pointer"
                            >
                              {copiedKey === `tbl-hw-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {client.ip_address || "127.0.0.1"} • {client.software_version || "v2.4.8"}
                          </div>
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
                              client.days_left <= 7 ? "text-rose-500" : client.days_left <= 30 ? "text-amber-500" : "text-emerald-500"
                            }`}>
                              {client.days_left} gün kaldı
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openKeyGenModal(client)}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-500/30 text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Edit3 size={12} />
                              <span>Lisans &amp; Kota</span>
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
                          <span>{client.software_version || "v2.4.8"}</span>
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

                        {client.remote_ssh_enabled !== false && (
                          <button
                            type="button"
                            onClick={() => openSshModal(client)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Nornia Connect Sıfır-Port Web SSH Terminali Aç"
                          >
                            <Terminal size={11} />
                            <span>Web SSH</span>
                          </button>
                        )}

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
                        onClick={() => openKeyGenModal(client)}
                        className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Müşteri lisans kotalarını düzenle veya yeni anahtar üret"
                      >
                        <Edit3 size={13} />
                        <span>Lisans &amp; Kota Yönetimi</span>
                      </button>

                      <button
                        onClick={() => handleToggleSuspend(client)}
                        className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
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
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
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

      {/* USER MANAGEMENT MODAL */}
      <UserManagementModal
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        currentUser={currentUser}
      />

      {/* AUDIT LOGS MODAL */}
      <AuditLogsModal
        isOpen={showAuditLogsModal}
        onClose={() => setShowAuditLogsModal(false)}
      />
    </div>
  );
}
