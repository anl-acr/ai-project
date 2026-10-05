import React, { useState, useEffect } from "react";
import Head from "next/head";
import { 
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
  Terminal
} from "lucide-react";

import LoginModal from "../components/LoginModal";
import UserManagementModal from "../components/UserManagementModal";
import AuditLogsModal from "../components/AuditLogsModal";

const API_BASE = "http://localhost:8050";

export default function MasterDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [stats, setStats] = useState({
    total_clients: 0,
    online_count: 0,
    offline_count: 0,
    expiring_soon_count: 0,
    expired_count: 0,
    total_active_calls: 0
  });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [expiryDate, setExpiryDate] = useState("2027-12-31");
  const [planTier, setPlanTier] = useState("professional");
  const [copiedKey, setCopiedKey] = useState(null);

  // Key generator modal state
  const [keyGenModalClient, setKeyGenModalClient] = useState(null);
  const [genExpiryDate, setGenExpiryDate] = useState("2027-12-31");
  const [genHwId, setGenHwId] = useState("");
  const [generatedResultKey, setGeneratedResultKey] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("master_user");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch (e) {}
      }
      setIsAuthChecking(false);
    }
  }, []);

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
      const [resStats, resClients] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dashboard/stats`),
        fetch(`${API_BASE}/api/v1/clients`)
      ]);
      if (resStats.ok) setStats(await resStats.json());
      if (resClients.ok) setClients(await resClients.json());
    } catch (e) {
      console.error("Master Portal fetch error:", e);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          tenant_code: tenantCode,
          hardware_id: hardwareId || "UNBOUND",
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
      console.error("Create client error:", e);
    }
  };

  const handleToggleSuspend = async (client) => {
    const newStatus = client.status === "suspended" ? "active" : "suspended";
    try {
      await fetch(`${API_BASE}/api/v1/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: client.company_name,
          tenant_code: client.tenant_code,
          status: newStatus,
          license_expires_at: client.license_expires_at
        })
      });
      fetchData();
    } catch (e) {
      console.error("Toggle suspend error:", e);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm("Bu müşteriyi merkezi portal kayıtlarından silmek istediğinize emin misiniz?")) return;
    try {
      await fetch(`${API_BASE}/api/v1/clients/${clientId}`, { method: "DELETE" });
      fetchData();
    } catch (e) {
      console.error("Delete client error:", e);
    }
  };

  const handleGenerateCustomKey = async (e) => {
    e.preventDefault();
    if (!keyGenModalClient) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/licenses/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: keyGenModalClient.id,
          tenant_code: keyGenModalClient.tenant_code,
          expiry_date: genExpiryDate,
          hardware_id: genHwId || keyGenModalClient.hardware_id || "UNBOUND",
          plan_tier: keyGenModalClient.plan_tier
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedResultKey(data.license_key);
        fetchData();
      }
    } catch (e) {
      console.error("Key generate error:", e);
    }
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Head>
        <title>AIDA Master Console - Merkezi Lisans & Filo Yönetimi</title>
      </Head>

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-rose-600/30">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              AIDA Control Center <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">v1.0 Master</span>
            </h1>
            <p className="text-xs text-slate-400">Merkezi Lisans Otoritesi ve Sunucu İzleme Konsolu</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
            title="Sistem İşlem Logları"
          >
            <Terminal size={14} className="text-cyan-400" />
            <span>İşlem Logları</span>
          </button>

          <button
            onClick={() => setShowUsersModal(true)}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
            title="Master Kullanıcı Yönetimi"
          >
            <Users size={14} className="text-rose-400" />
            <span>Kullanıcılar</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-rose-500" : ""} />
            <span>Yenile</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Yeni Müşteri & Sunucu Ekle</span>
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right text-xs">
                <div className="font-extrabold text-white">{currentUser.full_name}</div>
                <div className="text-[10px] text-rose-400 font-mono">@{currentUser.username}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
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
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Toplam Kurulum</span>
              <Server size={18} className="text-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-white">{stats.total_clients}</div>
            <div className="text-[11px] text-slate-500 font-semibold">Kayıtlı On-Premise Sunucu</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Canlı Sunucular</span>
              <Activity size={18} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              {stats.online_count}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold">Son 15 dk'da Heartbeat Alan</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Süresi Yaklaşan</span>
              <Clock size={18} className="text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400">{stats.expiring_soon_count}</div>
            <div className="text-[11px] text-slate-500 font-semibold">15 Gün İçinde Dolacak</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Pasif / Durdurulan</span>
              <ShieldAlert size={18} className="text-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-rose-500">{stats.expired_count}</div>
            <div className="text-[11px] text-slate-500 font-semibold">Lisanssız veya İptal Edilmiş</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Canlı Aktif Çağrı</span>
              <PhoneCall size={18} className="text-blue-400" />
            </div>
            <div className="text-3xl font-extrabold text-blue-400">{stats.total_active_calls}</div>
            <div className="text-[11px] text-slate-500 font-semibold">Tüm Sunucularda Anlık Görüşme</div>
          </div>
        </div>

        {/* FILTER & SEARCH BAR */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/80">
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Firma adı, tenant kodu veya Donanım ID ara..."
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "all" ? "bg-rose-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800"}`}
            >
              Tümü ({clients.length})
            </button>
            <button
              onClick={() => setFilterStatus("online")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "online" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800"}`}
            >
              🟢 Canlı ({stats.online_count})
            </button>
            <button
              onClick={() => setFilterStatus("offline")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "offline" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400 border border-slate-800"}`}
            >
              ⚫ Çevrimdışı ({stats.offline_count})
            </button>
            <button
              onClick={() => setFilterStatus("suspended")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterStatus === "suspended" ? "bg-rose-900/60 text-rose-300 border border-rose-800" : "bg-slate-900 text-slate-400 border border-slate-800"}`}
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
                className={`relative bg-slate-900/80 border rounded-3xl p-6 space-y-5 transition-all shadow-xl ${
                  isSuspended ? "border-rose-900/60 bg-rose-950/10" :
                  isExpired ? "border-amber-900/60 bg-amber-950/10" : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${client.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                      <h3 className="font-extrabold text-base text-white">{client.company_name}</h3>
                    </div>
                    <p className="text-xs font-mono font-semibold text-rose-400">
                      Tenant Code: <span className="text-white">{client.tenant_code}</span>
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase border ${
                    isSuspended ? "bg-rose-500/10 text-rose-400 border-rose-500/30" :
                    client.is_online ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>
                    {isSuspended ? "🔴 İptal Edildi" : client.is_online ? "🟢 Online" : "⚫ Offline"}
                  </span>
                </div>

                {/* Server Specs & Hardware ID */}
                <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-500 font-sans font-bold">
                      <Cpu size={13} /> Donanım ID:
                    </span>
                    <span className="font-extrabold text-white flex items-center gap-1">
                      {client.hardware_id}
                      <button 
                        onClick={() => handleCopyText(client.hardware_id, `hw-${client.id}`)}
                        className="hover:text-rose-400 ml-1"
                        title="Donanım ID Kopyala"
                      >
                        {copiedKey === `hw-${client.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-500 font-sans font-bold">
                      <Globe size={13} /> IP / Sürüm:
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {client.ip_address || "127.0.0.1"} ({client.software_version || "v2.4.8"})
                    </span>
                  </div>
                </div>

                {/* Live Telemetry Health Bar */}
                <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-950/60 border border-slate-800/40 rounded-2xl">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">CPU Kullanımı</div>
                    <div className="text-xs font-extrabold font-mono text-slate-200">{client.cpu_usage_percent || 0}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">RAM Kullanımı</div>
                    <div className="text-xs font-extrabold font-mono text-slate-200">{client.ram_usage_percent || 0}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Canlı Çağrı</div>
                    <div className="text-xs font-extrabold font-mono text-blue-400">{client.active_calls_count || 0}</div>
                  </div>
                </div>

                {/* License Expiration Info */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-slate-400">Lisans Bitiş Tarihi</div>
                    <div className="font-mono font-extrabold text-white">
                      {client.license_expires_at === "unlimited" ? "♾️ Limitsiz" : (client.license_expires_at || "Belirtilmedi")}
                    </div>
                  </div>

                  {client.days_left !== null && client.days_left !== undefined && (
                    <div className={`text-xs font-extrabold px-2.5 py-1 rounded-xl ${
                      client.days_left <= 7 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" :
                      client.days_left <= 30 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {client.days_left} gün kaldı
                    </div>
                  )}
                </div>

                {/* License Key Box */}
                {client.current_license_key && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-[11px] font-mono">
                    <span className="truncate text-slate-400 max-w-[210px]">{client.current_license_key}</span>
                    <button
                      onClick={() => handleCopyText(client.current_license_key, `key-${client.id}`)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Lisans Key Kopyala"
                    >
                      {copiedKey === `key-${client.id}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      setKeyGenModalClient(client);
                      setGenExpiryDate(client.license_expires_at || "2027-12-31");
                      setGenHwId(client.hardware_id || "UNBOUND");
                      setGeneratedResultKey("");
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition-all text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Key size={13} />
                    <span>Lisans Yenile / Key Üret</span>
                  </button>

                  <button
                    onClick={() => handleToggleSuspend(client)}
                    className={`p-2 rounded-xl border transition-colors ${
                      isSuspended ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-rose-900/40 hover:text-rose-400"
                    }`}
                    title={isSuspended ? "Uzaktan Aktifleştir" : "Uzaktan Durdur / Suspend"}
                  >
                    <Power size={15} />
                  </button>

                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-900/40 hover:text-rose-400 border border-slate-700 transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Building2 size={18} className="text-rose-500" />
              Yeni Müşteri & On-Premise Sunucu Kaydı
            </h3>

            <form onSubmit={handleCreateClient} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-400 mb-1">Firma / Müşteri Adı</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Örn: Nolto Teknoloji A.Ş."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tenant Kodu (Tekil Kod)</label>
                <input
                  type="text"
                  required
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value)}
                  placeholder="Örn: nolto"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Sunucu Donanım ID (Opsiyonel / UNBOUND)</label>
                <input
                  type="text"
                  value={hardwareId}
                  onChange={(e) => setHardwareId(e.target.value)}
                  placeholder="Örn: HW-361B-F973 (Boş bırakılırsa serbest kalır)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Lisans Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Paket Türü</label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white"
                  >
                    <option value="starter">Starter Paket</option>
                    <option value="professional">Professional Paket</option>
                    <option value="enterprise">Enterprise Paket</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/20"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Key size={18} className="text-rose-500" />
              Lisans Yenileme Stüdyosu - {keyGenModalClient.company_name}
            </h3>

            <form onSubmit={handleGenerateCustomKey} className="space-y-4 text-xs font-semibold">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-slate-500">Tenant Code: <span className="font-mono text-white font-bold">{keyGenModalClient.tenant_code}</span></div>
                <div className="text-slate-500">Mevcut Lisans Key: <span className="font-mono text-slate-300">{keyGenModalClient.current_license_key || "Yok"}</span></div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Yeni Bitiş Tarihi</label>
                <input
                  type="date"
                  value={genExpiryDate}
                  onChange={(e) => setGenExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Hedef Donanım ID (Hardware Binding)</label>
                <input
                  type="text"
                  value={genHwId}
                  onChange={(e) => setGenHwId(e.target.value)}
                  placeholder="UNBOUND veya HW-361B-F973"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                />
              </div>

              {generatedResultKey && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl space-y-2">
                  <div className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                    <Check size={16} /> Yeni İmzalı Key Başarıyla Üretildi!
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white flex items-center justify-between">
                    <span>{generatedResultKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(generatedResultKey, "gen-modal-res")}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold"
                    >
                      {copiedKey === "gen-modal-res" ? "Kopyalandı!" : "Kopyala"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setKeyGenModalClient(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/20"
                >
                  Yeni Key Üret & Kaydet
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
