import React, { useState, useEffect } from "react";
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
  GitMerge
} from "lucide-react";

import LoginModal from "../components/LoginModal";
import UserManagementModal from "../components/UserManagementModal";
import AuditLogsModal from "../components/AuditLogsModal";

const API_BASE = "http://localhost:8050";

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

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Key Generator Studio Modal State
  const [keyGenModalClient, setKeyGenModalClient] = useState(null);
  const [genExpiryDate, setGenExpiryDate] = useState("2027-12-31");
  const [genHwId, setGenHwId] = useState("");
  const [generatedResultKey, setGeneratedResultKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  // Modals state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);

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
          plan_tier: planTier
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setCompanyName("");
        setTenantCode("");
        setHardwareId("");
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

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm("Bu müşteriyi ve tüm kayıtlarını silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/clients/${clientId}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Delete client error:", e);
    }
  };

  const AI_QUOTA_FIELDS = [
    { key: "max_agents", label: "AI Temsilcileri", defaultVal: 10, unit: "Hak" },
    { key: "max_rag_docs", label: "Bilgi Bankası (RAG)", defaultVal: 200, unit: "Doküman" },
    { key: "max_scenarios", label: "Senaryo Editörü", defaultVal: 30, unit: "Akış" }
  ];

  const PBX_QUOTA_FIELDS = [
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
    setGenCustomQuotas(initQ);
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
    const matchSearch = c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.tenant_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (c.hardware_id && c.hardware_id.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === "online") return matchSearch && c.is_online;
    if (filterStatus === "offline") return matchSearch && !c.is_online;
    if (filterStatus === "suspended") return matchSearch && c.status === "suspended";
    return matchSearch;
  });

  if (!currentUser && !isAuthChecking) {
    return <LoginModal onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col font-sans">
      <Head>
        <title>AIDA Master Console - Merkezi Lisans & Filo Yönetimi</title>
      </Head>

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs dark:shadow-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-rose-600/30">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              AIDA Control Center <span className="text-[10px] bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30 px-2 py-0.5 rounded-full font-bold">v1.0 Master</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Merkezi Lisans Otoritesi ve Sunucu İzleme Konsolu</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Sistem İşlem Logları"
          >
            <Terminal size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>İşlem Logları</span>
          </button>

          <button
            onClick={() => setShowUsersModal(true)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer shadow-xs dark:shadow-none"
            title="Master Kullanıcı Yönetimi"
          >
            <Users size={14} className="text-rose-600 dark:text-rose-400" />
            <span>Kullanıcılar</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold shadow-xs dark:shadow-none cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-rose-500" : ""} />
            <span>Yenile</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-xs dark:shadow-none"
            title={isDarkMode ? "Aydınlık Moda Geç" : "Karanlık Moda Geç"}
          >
            {isDarkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-rose-600" />}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Yeni Müşteri & Sunucu Ekle</span>
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right text-xs">
                <div className="font-extrabold text-slate-800 dark:text-white">{currentUser.full_name}</div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono font-bold">@{currentUser.username}</div>
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
      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Toplam Kurulum</span>
              <Server size={18} className="text-rose-600 dark:text-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.total_clients}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">Kayıtlı On-Premise Sunucu</div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Canlı Sunucular</span>
              <Activity size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              {stats.online_count}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">Son 15 dk'da Heartbeat Alan</div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Süresi Yaklaşan</span>
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{stats.expiring_soon_count}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">15 Gün İçinde Dolacak</div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Pasif / Durdurulan</span>
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-500">{stats.expired_count}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">Lisanssız veya İptal Edilmiş</div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Canlı Aktif Çağrı</span>
              <PhoneCall size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{stats.total_active_calls}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">Tüm Sunucularda Anlık Görüşme</div>
          </div>
        </div>

        {/* FILTER & SEARCH BAR */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-none">
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Firma adı, tenant kodu veya Donanım ID ara..."
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "all" ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            >
              Tümü ({clients.length})
            </button>
            <button
              onClick={() => setFilterStatus("online")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "online" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            >
              🟢 Canlı ({stats.online_count})
            </button>
            <button
              onClick={() => setFilterStatus("offline")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "offline" ? "bg-slate-700 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            >
              ⚫ Çevrimdışı ({stats.offline_count})
            </button>
            <button
              onClick={() => setFilterStatus("suspended")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "suspended" ? "bg-rose-700 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800"}`}
            >
              🔴 İptal Edilen ({stats.expired_count})
            </button>
          </div>
        </div>

        {/* CLIENT SERVER FLEET GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const isSuspended = client.status === "suspended";
            const isExpired = client.days_left !== null && client.days_left <= 0;

            return (
              <div 
                key={client.id}
                className={`relative bg-white dark:bg-slate-900/80 border rounded-3xl p-6 space-y-5 transition-all shadow-sm hover:shadow-md dark:shadow-xl ${
                  isSuspended ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/10" :
                  isExpired ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/10" : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${client.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-600"}`} />
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{client.company_name}</h3>
                    </div>
                    <p className="text-xs font-mono font-semibold text-rose-600 dark:text-rose-400">
                      Tenant Code: <span className="text-slate-900 dark:text-white font-bold">{client.tenant_code}</span>
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase border ${
                    isSuspended ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" :
                    client.is_online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}>
                    {isSuspended ? "🔴 İptal Edildi" : client.is_online ? "🟢 Online" : "⚫ Offline"}
                  </span>
                </div>

                {/* Server Specs & Hardware ID */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans font-bold">
                      <Cpu size={13} /> Donanım ID:
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                      {client.hardware_id}
                      <button 
                        onClick={() => handleCopyText(client.hardware_id, `hw-${client.id}`)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 ml-1"
                        title="Donanım ID Kopyala"
                      >
                        {copiedKey === `hw-${client.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans font-bold">
                      <Globe size={13} /> IP / Sürüm:
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {client.ip_address || "127.0.0.1"} ({client.software_version || "v2.4.8"})
                    </span>
                  </div>
                </div>

                {/* Live Telemetry Health Bar */}
                <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/40 rounded-2xl">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">CPU Kullanımı</div>
                    <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200">{client.cpu_usage_percent || 0}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">RAM Kullanımı</div>
                    <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200">{client.ram_usage_percent || 0}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Canlı Çağrı</div>
                    <div className="text-xs font-extrabold font-mono text-blue-600 dark:text-blue-400">{client.active_calls_count || 0}</div>
                  </div>
                </div>

                {/* License Expiration Info */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Lisans Bitiş Tarihi</div>
                    <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                      {client.license_expires_at === "unlimited" ? "♾️ Limitsiz" : (client.license_expires_at || "Belirtilmedi")}
                    </div>
                  </div>

                  {client.days_left !== null && client.days_left !== undefined && (
                    <div className={`text-xs font-extrabold px-2.5 py-1 rounded-xl ${
                      client.days_left <= 7 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse" :
                      client.days_left <= 30 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {client.days_left} gün kaldı
                    </div>
                  )}
                </div>

                {/* License Key Box */}
                {client.current_license_key && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between text-[11px] font-mono gap-2">
                    <span className="truncate text-slate-700 dark:text-slate-300 font-bold max-w-[210px]" title={client.current_license_key}>
                      {client.current_license_key.length > 32 
                        ? `${client.current_license_key.substring(0, 20)}...${client.current_license_key.slice(-8)}` 
                        : client.current_license_key}
                    </span>
                    <button
                      onClick={() => handleCopyText(client.current_license_key, `key-${client.id}`)}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                      title="Lisans Key Kopyala"
                    >
                      {copiedKey === `key-${client.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/60">
                  <button
                    onClick={() => openKeyGenModal(client)}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/30 transition-all text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs dark:shadow-none"
                    title="Müşteri lisans kotalarını düzenle veya yeni anahtar üret"
                  >
                    <Edit3 size={13} />
                    <span>Lisans & Kotaları Düzenle / Key Üret</span>
                  </button>

                  <button
                    onClick={() => handleToggleSuspend(client)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isSuspended ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-400"
                    }`}
                    title={isSuspended ? "Uzaktan Aktifleştir" : "Uzaktan Durdur / Suspend"}
                  >
                    <Power size={15} />
                  </button>

                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Müşteriyi Sil"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* CREATE NEW CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-rose-600 dark:text-rose-500" />
              Yeni Müşteri & On-Premise Sunucu Kaydı
            </h3>

            <form onSubmit={handleCreateClient} className="space-y-4 text-xs font-semibold">
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

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Sunucu Donanım ID (Opsiyonel / UNBOUND)</label>
                <input
                  type="text"
                  value={hardwareId}
                  onChange={(e) => setHardwareId(e.target.value)}
                  placeholder="Örn: HW-361B-F973 (Boş bırakılırsa serbest kalır)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white"
                />
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
                  <div className="text-slate-500 dark:text-slate-400">
                    Tenant Code: <span className="font-mono text-slate-900 dark:text-white font-extrabold">{keyGenModalClient.tenant_code}</span>
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

              {/* Key Controls: Plan Tier, Status, Expiry, HW ID */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Shield size={16} className="text-rose-500" />
                  <span>Lisans Paketi, Durum & Geçerlilik Yapılandırması</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
