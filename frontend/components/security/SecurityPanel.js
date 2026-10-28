import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Globe, Trash2, Edit2, CheckCircle, Search, Save, AlertTriangle, Check, Plus, RefreshCw, Zap, X, Lock } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const COUNTRIES = [
  { code: "TR", name: "Türkiye" },
  { code: "US", name: "Amerika Birleşik Devletleri" },
  { code: "GB", name: "Birleşik Krallık" },
  { code: "DE", name: "Almanya" },
  { code: "FR", name: "Fransa" },
  { code: "NL", name: "Hollanda" },
  { code: "AE", name: "Birleşik Arap Emirlikleri" },
  { code: "RU", name: "Rusya" },
  { code: "CN", name: "Çin" },
];

export default function SecurityPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("fail2ban");
  const [loading, setLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [hasWritePermission, setHasWritePermission] = useState(true);

  // Fail2Ban & Firewall States
  const [serviceStatus, setServiceStatus] = useState("active");
  const [ufwActive, setUfwActive] = useState(true);
  const [blockedIps, setBlockedIps] = useState([]);
  const [whitelistedIps, setWhitelistedIps] = useState([]);
  const [detectedThreats, setDetectedThreats] = useState([]);
  const [clientIp, setClientIp] = useState("");
  const [searchIp, setSearchIp] = useState("");
  const [searchWhitelist, setSearchWhitelist] = useState("");
  const [deleteTargetIp, setDeleteTargetIp] = useState(null);
  const [deleteWhitelistIp, setDeleteWhitelistIp] = useState(null);

  // Manual IP Ban Modal States
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [manualIp, setManualIp] = useState("");
  const [manualReason, setManualReason] = useState("SIP Tarayıcı / Yetkisiz Erişim Girişimi");

  // Whitelist (IgnoreIP) Modal States
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState(false);
  const [editingWhitelistOldIp, setEditingWhitelistOldIp] = useState(null);
  const [whitelistIpInput, setWhitelistIpInput] = useState("");
  const [whitelistDescInput, setWhitelistDescInput] = useState("Ofis / Güvenli Sabit IP");

  // GeoIP States
  const [allowedCountries, setAllowedCountries] = useState(["TR"]);

  // Advanced Security (Rate Limiting) States
  const [rateLimiting, setRateLimiting] = useState({
    login_rate_limit: 3,
    api_rate_limit: 100,
    sip_rate_limit: 50,
    block_duration_minutes: 1440
  });

  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "X-User-ID": (typeof window !== "undefined" && (localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id"))) || "admin",
    "X-Tenant-ID": (typeof window !== "undefined" && localStorage.getItem("selected_tenant_id")) || "tenant-default"
  });

  useEffect(() => {
    checkPermissionsAndFetchData();
  }, [backendHost]);

  const checkPermissionsAndFetchData = async () => {
    setLoading(true);
    try {
      const currentUserId = (typeof window !== "undefined" && (localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id"))) || "admin";
      let canWrite = true;

      if (currentUserId !== "admin" && currentUserId !== "1") {
        try {
          const [resUsers, resRoles] = await Promise.all([
            fetch(`${API_BASE}/api/settings/users`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/settings/roles`, { headers: getHeaders() })
          ]);
          if (resUsers.ok && resRoles.ok) {
            const usersData = await resUsers.json();
            const rolesData = await resRoles.json();
            const currentUser = (Array.isArray(usersData) ? usersData : []).find(
              u => String(u.id) === String(currentUserId) || String(u.extension) === String(currentUserId)
            );
            if (currentUser && currentUser.role !== "admin") {
              const currentRole = (Array.isArray(rolesData) ? rolesData : []).find(r => r.role_code === currentUser.role);
              if (currentRole && Array.isArray(currentRole.permissions)) {
                canWrite = currentRole.permissions.includes("security:write") || currentRole.permissions.includes("security:delete");
              }
            }
          }
        } catch (e) {
          canWrite = true;
        }
      }
      setHasWritePermission(canWrite);

      await Promise.all([fetchBlockedIps(), fetchGeoRules(), fetchAdvancedSecurity()]);
    } catch (err) {
      console.error("Yetki/Veri yükleme hatası:", err);
      setError("Veriler yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const applySecurityPayload = (data) => {
    if (!data) return;
    if (Array.isArray(data.blocked_ips)) setBlockedIps(data.blocked_ips);
    if (Array.isArray(data.whitelisted_ips)) setWhitelistedIps(data.whitelisted_ips);
    if (Array.isArray(data.detected_threats)) setDetectedThreats(data.detected_threats);
    if (data.service_status) setServiceStatus(data.service_status);
    if (typeof data.ufw_active === "boolean") setUfwActive(data.ufw_active);
    if (data.client_ip) setClientIp(data.client_ip);
  };

  const fetchBlockedIps = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        applySecurityPayload(data);
      }
    } catch (err) {
      console.error("Fail2ban IP hatası:", err);
    }
  };

  const fetchGeoRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/geo`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.allowed_countries) {
          setAllowedCountries(data.allowed_countries);
        }
      }
    } catch (err) {
      console.error("GeoIP hatası:", err);
    }
  };

  const fetchAdvancedSecurity = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/advanced`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRateLimiting(data);
      }
    } catch (err) {
      console.error("Advanced Security hatası:", err);
    }
  };

  const handleManualBan = async (ipToBan, reasonToUse) => {
    if (!hasWritePermission) return;
    const targetIp = (ipToBan || manualIp || "").trim();
    if (!targetIp) {
      setError("Lütfen geçerli bir IP adresi veya CIDR bloğu giriniz (Örn: 31.70.90.134).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban/ban`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          ip: targetIp,
          reason: reasonToUse || manualReason || "Manuel Güvenlik Duvarı Engeli",
          jail: "asterisk-pjsip"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `${targetIp} başarıyla engellendi.`);
        setTimeout(() => setSuccess(""), 4000);
        applySecurityPayload(data);
        setIsBanModalOpen(false);
        setManualIp("");
      } else {
        setError(data.detail || "IP adresi engellenemedi.");
      }
    } catch (err) {
      setError("Sunucu bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddWhitelist = async (ipToTrust, descToUse) => {
    if (!hasWritePermission) return;
    const targetIp = (ipToTrust || whitelistIpInput || "").trim();
    if (!targetIp) {
      setError("Lütfen geçerli bir IP adresi veya IP bloğu giriniz (Örn: 78.189.210.15 veya 78.189.210.0/24).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payloadBody = {
        ip: targetIp,
        description: descToUse || whitelistDescInput || "Güvenli IP / Blok"
      };
      if (!ipToTrust && editingWhitelistOldIp) {
        payloadBody.old_ip = editingWhitelistOldIp;
      }
      const res = await fetch(`${API_BASE}/api/security/whitelist`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payloadBody)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `${targetIp} güvenli listeye (Fail2Ban ignoreip) eklendi.`);
        setTimeout(() => setSuccess(""), 4000);
        applySecurityPayload(data);
        setIsWhitelistModalOpen(false);
        setEditingWhitelistOldIp(null);
        setWhitelistIpInput("");
      } else {
        setError(data.detail || "Güvenli IP kaydedilemedi.");
      }
    } catch (err) {
      setError("Sunucu bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const removeWhitelistIp = async () => {
    if (!hasWritePermission || !deleteWhitelistIp) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/security/whitelist/${encodeURIComponent(deleteWhitelistIp)}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Güvenli IP listeden kaldırıldı.");
        setTimeout(() => setSuccess(""), 3000);
        applySecurityPayload(data);
      } else {
        setError(data.detail || "Güvenli IP kaldırılamadı.");
      }
    } catch (err) {
      setError("Bağlantı hatası.");
    } finally {
      setDeleteWhitelistIp(null);
      setLoading(false);
    }
  };

  const handleServiceAction = async (actionType) => {
    if (!hasWritePermission) return;
    setServiceLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban/service`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ action: actionType })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "İşlem başarıyla tamamlandı.");
        setTimeout(() => setSuccess(""), 4000);
        applySecurityPayload(data);
      } else {
        setError(data.detail || "Servis işlemi başarısız oldu.");
      }
    } catch (err) {
      setError("Sunucu bağlantı hatası.");
    } finally {
      setServiceLoading(false);
    }
  };

  const unbanIp = async () => {
    if (!hasWritePermission || !deleteTargetIp) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban/${encodeURIComponent(deleteTargetIp)}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || "IP engeli başarıyla kaldırıldı.");
        setTimeout(() => setSuccess(""), 3000);
        applySecurityPayload(data);
      } else {
        setError("IP engeli kaldırılamadı.");
      }
    } catch (err) {
      setError("Bağlantı hatası.");
    } finally {
      setDeleteTargetIp(null);
      setLoading(false);
    }
  };

  const saveGeoRules = async () => {
    if (!hasWritePermission) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/security/geo`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ allowed_countries: allowedCountries })
      });
      if (res.ok) {
        setSuccess("Bölgesel erişim kuralları başarıyla kaydedildi.");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kurallar kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const saveAdvancedSecurity = async () => {
    if (!hasWritePermission) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/security/advanced`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(rateLimiting)
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || "Gelişmiş güvenlik ayarları başarıyla kaydedildi ve Fail2Ban'a uygulandı.");
        setTimeout(() => setSuccess(""), 3500);
        await fetchBlockedIps();
      } else {
        setError("Ayarlar kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCountry = (code) => {
    if (!hasWritePermission) return;
    setAllowedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filteredIps = blockedIps.filter(ipObj =>
    (ipObj.ip || "").toLowerCase().includes(searchIp.toLowerCase()) ||
    (ipObj.reason || "").toLowerCase().includes(searchIp.toLowerCase()) ||
    (ipObj.jail || "").toLowerCase().includes(searchIp.toLowerCase())
  );

  const filteredWhitelist = whitelistedIps.filter(wObj =>
    (wObj.ip || "").toLowerCase().includes(searchWhitelist.toLowerCase()) ||
    (wObj.description || "").toLowerCase().includes(searchWhitelist.toLowerCase())
  );

  const isClientIpWhitelisted = Boolean(
    clientIp && whitelistedIps.some(w => w.ip === clientIp)
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/85 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Shield size={22} className={text} />
            Güvenlik Kalkanı
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asterisk PJSIP sızma girişimlerini gerçek zamanlı izleyin, Güvenli IP bloklarını (ignoreip) ve Fail2Ban & UFW duvarını yönetin.
          </p>
        </div>

        {/* Live Service Status & Control Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${serviceStatus === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="text-slate-600 dark:text-slate-300">
              Fail2Ban: {serviceStatus === "active" ? "Aktif" : serviceStatus === "inactive" ? "Pasif" : "Kurulu Değil"}
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-600 dark:text-slate-300">
              UFW: {ufwActive ? "Aktif" : "Pasif"}
            </span>
          </div>

          {hasWritePermission && (
            <>
              {serviceStatus !== "active" ? (
                <button
                  onClick={() => handleServiceAction("install_and_configure")}
                  disabled={serviceLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm disabled:opacity-50`}
                  title="Fail2Ban Servisini Kur ve Asterisk Kurallarını Aktif Et"
                >
                  <Zap size={14} />
                  <span>{serviceLoading ? "Kuruluyor..." : "Fail2Ban Kur & Aktif Et"}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleServiceAction("restart")}
                  disabled={serviceLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50"
                  title="Fail2Ban Kurallarını Yenile ve Servisi Yeniden Başlat"
                >
                  <RefreshCw size={13} className={serviceLoading ? "animate-spin" : ""} />
                  <span>Servisi Yenile</span>
                </button>
              )}

              <button
                onClick={() => handleServiceAction("scan_and_ban")}
                disabled={serviceLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all disabled:opacity-50"
                title="Asterisk Loglarını Şimdi Tara ve Saldırgan IP'leri Engelle"
              >
                <ShieldAlert size={14} />
                <span>Logları Tara & Engelle</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === "whitelist") {
                    setEditingWhitelistOldIp(null);
                    setWhitelistIpInput("");
                    setWhitelistDescInput("Ofis / Güvenli Sabit IP");
                    setIsWhitelistModalOpen(true);
                  } else {
                    setIsBanModalOpen(true);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-all"
                title={activeTab === "whitelist" ? "Güvenli IP / IP Bloğu Ekle" : "Manuel IP Engelle"}
              >
                <Plus size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {!hasWritePermission && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert size={16} className="text-amber-500" />
          <span>Düzenleme yetkiniz bulunmamaktadır. Verileri sadece görüntüleyebilirsiniz.</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400 text-xs font-semibold">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("fail2ban")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "fail2ban"
              ? text
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Engellenen IP'ler ({blockedIps.length})</span>
          {activeTab === "fail2ban" && (
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${bg} rounded-t-full`} />
          )}
        </button>

        <button
          onClick={() => setActiveTab("whitelist")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "whitelist"
              ? text
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldCheck size={15} />
          <span>Güvenli IP / Blok Listesi ({whitelistedIps.length})</span>
          {activeTab === "whitelist" && (
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${bg} rounded-t-full`} />
          )}
        </button>

        <button
          onClick={() => setActiveTab("geoip")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "geoip"
              ? text
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Globe size={16} />
          Bölgesel Erişim (GeoIP)
          {activeTab === "geoip" && (
            <span className={`absolute bottom-[-1px] left-0 w-full h-0.5 ${bg} rounded-t-full`} />
          )}
        </button>

        <button
          onClick={() => setActiveTab("ratelimit")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "ratelimit"
              ? text
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Lock size={15} />
          Anti-DDoS / Hız Sınırlandırması
          {activeTab === "ratelimit" && (
            <span className={`absolute bottom-[-1px] left-0 w-full h-0.5 ${bg} rounded-t-full`} />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm min-h-[400px]">
        {activeTab === "fail2ban" ? (
          <div className="space-y-5">
            {detectedThreats.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertTriangle size={15} className="text-amber-500" />
                    <span>Asterisk Loglarında Tespit Edilen Şüpheli SIP Denemeleri ({detectedThreats.length})</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detectedThreats.map((th, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/40 text-xs gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{th.ip}</span>
                        <span className="ml-2 text-[11px] text-slate-500 truncate">({th.attempts} deneme - {th.reason})</span>
                      </div>
                      {hasWritePermission && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAddWhitelist(th.ip, "Güvenli IP")}
                            className="px-2 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all"
                            title="Bu IP'yi Güvenli Listeye (IgnoreIP) Ekle"
                          >
                            Güvenli Ekle
                          </button>
                          <button
                            onClick={() => handleManualBan(th.ip, `${th.reason} (${th.attempts} deneme)`)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-all"
                          >
                            Engelle
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Fail2Ban & UFW Engellenenler Listesi</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hatalı SIP kimlik doğrulaması, PJSIP taraması veya manuel kural ile güvenlik duvarında engellenen IP adresleri.
                </p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="IP veya Sebep Ara..."
                  value={searchIp}
                  onChange={(e) => setSearchIp(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none transition-all w-56 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {loading && blockedIps.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-slate-400 text-xs">Yükleniyor...</div>
            ) : filteredIps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <Shield size={32} className="mb-2 opacity-50" />
                <span className="text-xs font-semibold">Engellenen IP adresi bulunmamaktadır.</span>
              </div>
            ) : (
              <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800/60">
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Adresi</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kural (Jail)</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Engellenme Sebebi</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarih</th>
                      {hasWritePermission && <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredIps.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">{b.ip}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            {b.jail || "asterisk"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {b.reason || "SIP Güvenlik Duvarı Engeli"}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400 font-medium">{b.banned_at}</td>
                        {hasWritePermission && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setDeleteTargetIp(b.ip)}
                              className="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                              title="Engeli Kaldır (Unban)"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "whitelist" ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                  Güvenli IP ve IP Bloğu Listesi (Fail2Ban <code className="font-mono text-xs">ignoreip</code> & UFW Allow)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Buraya eklenen tekil IP adresleri (Örn: <code className="font-mono">78.189.210.15</code>) veya CIDR blokları (Örn: <code className="font-mono">78.189.210.0/24</code>) Fail2Ban ve güvenlik duvarı tarafından hiçbir zaman engellenmez.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasWritePermission && clientIp && !isClientIpWhitelisted && (
                  <button
                    onClick={() => handleAddWhitelist(clientIp, "Yönetici Bağlantı IP Adresi")}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all shrink-0"
                    title="Şu anda bağlandığınız IP adresini güvenli listeye ekler"
                  >
                    <ShieldCheck size={14} />
                    <span>Mevcut IP'mi Ekle ({clientIp})</span>
                  </button>
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Güvenli IP Ara..."
                    value={searchWhitelist}
                    onChange={(e) => setSearchWhitelist(e.target.value)}
                    className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none transition-all w-48 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {filteredWhitelist.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <ShieldCheck size={32} className="mb-2 opacity-50" />
                <span className="text-xs font-semibold">Tanımlı özel güvenli IP veya IP bloğu bulunmamaktadır.</span>
                <span className="text-[11px] text-slate-400 mt-1">Sağ üstteki (+) butonuna tıklayarak sabit ofis IP adresinizi veya alt ağ bloğunuzu ekleyebilirsiniz.</span>
              </div>
            ) : (
              <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800/60">
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Güvenli IP / CIDR Bloğu</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Açıklama</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Eklenme Tarihi</th>
                      {hasWritePermission && <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredWhitelist.map((w, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {w.ip}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {w.description || "Güvenli IP / Blok"}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {w.added_at}
                        </td>
                        {hasWritePermission && (
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingWhitelistOldIp(w.ip);
                                  setWhitelistIpInput(w.ip || "");
                                  setWhitelistDescInput(w.description || "Güvenli IP / Blok");
                                  setIsWhitelistModalOpen(true);
                                }}
                                className="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg"
                                title="Güvenli IP Kaydını Düzenle"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteWhitelistIp(w.ip)}
                                className="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                                title="Güvenli Listeden Kaldır"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "geoip" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Ülke Bazlı Erişim Engelleme</h3>
                <p className="text-[10px] text-slate-500 mt-1">Sisteminize ve santralinize sadece seçili ülkelerden (IP blokları üzerinden) gelen isteklere izin verilir. Diğer tüm ülkeler reddedilir.</p>
              </div>
              {hasWritePermission && (
                <button
                  onClick={saveGeoRules}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50`}
                >
                  <Save size={14} />
                  <span>Kuralları Kaydet</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {COUNTRIES.map(c => {
                const isSelected = allowedCountries.includes(c.code);
                return (
                  <div
                    key={c.code}
                    onClick={() => toggleCountry(c.code)}
                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? `${borderLight} bg-slate-50 dark:bg-slate-800/40`
                        : "border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    } ${!hasWritePermission && "cursor-default"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isSelected
                          ? `${bg} border-transparent`
                          : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${isSelected ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                          {c.name}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 tracking-wider">
                          {c.code}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Fail2Ban & Hız Sınırlandırma (Rate Limiting)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Kaydettiğiniz değerler doğrudan sunucudaki <code className="font-mono text-[11px]">/etc/fail2ban/jail.d/asterisk-pjsip.conf</code> dosyasına yazılır ve anında uygulanır.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Hatalı SIP / Giriş Deneme Limiti (maxretry)</label>
                  <input
                    type="number"
                    value={rateLimiting.login_rate_limit}
                    onChange={e => setRateLimiting({ ...rateLimiting, login_rate_limit: parseInt(e.target.value) || 3 })}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none disabled:opacity-50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Firewall Engelleme Süresi (Dakika - bantime)</label>
                  <input
                    type="number"
                    value={rateLimiting.block_duration_minutes}
                    onChange={e => setRateLimiting({ ...rateLimiting, block_duration_minutes: parseInt(e.target.value) || 60 })}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none disabled:opacity-50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">API İstek Limiti (Dakikada)</label>
                  <input
                    type="number"
                    value={rateLimiting.api_rate_limit}
                    onChange={e => setRateLimiting({ ...rateLimiting, api_rate_limit: parseInt(e.target.value) || 0 })}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none disabled:opacity-50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">SIP Paket Limiti (Saniyede)</label>
                  <input
                    type="number"
                    value={rateLimiting.sip_rate_limit}
                    onChange={e => setRateLimiting({ ...rateLimiting, sip_rate_limit: parseInt(e.target.value) || 0 })}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none disabled:opacity-50 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {hasWritePermission && (
                <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={saveAdvancedSecurity}
                    disabled={loading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white ${bg} ${hover} shadow-md transition-all ${loading ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg"}`}
                  >
                    <Save size={16} />
                    {loading ? "Kaydediliyor..." : "Ayarları Kaydet & Fail2Ban'a Uygula"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual IP Ban Modal */}
      {isBanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Manuel IP / Alt Ağ Engelle</h3>
              </div>
              <button
                onClick={() => setIsBanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  IP Adresi veya CIDR Bloğu
                </label>
                <input
                  type="text"
                  placeholder="Örn: 31.70.90.134 veya 31.70.90.0/24"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Engelleme Sebebi / Açıklama
                </label>
                <input
                  type="text"
                  placeholder="Örn: SIP Brute Force Girişimi"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsBanModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => handleManualBan()}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50"
              >
                {loading ? "Engelleniyor..." : "Firewall'da Engelle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whitelist (IgnoreIP) Add / Edit Modal */}
      {isWhitelistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {editingWhitelistOldIp ? "Güvenli IP / IP Bloğu Kaydını Düzenle" : "Güvenli IP / IP Bloğu (IgnoreIP) Ekle"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsWhitelistModalOpen(false);
                  setEditingWhitelistOldIp(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    IP Adresi veya CIDR Alt Ağ Bloğu
                  </label>
                  {clientIp && (
                    <button
                      type="button"
                      onClick={() => setWhitelistIpInput(clientIp)}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Mevcut IP'mi Yaz ({clientIp})
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Örn: 78.189.210.15 veya 78.189.210.0/24"
                  value={whitelistIpInput}
                  onChange={(e) => setWhitelistIpInput(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama / Lokasyon Adı
                </label>
                <input
                  type="text"
                  placeholder="Örn: Merkez Ofis Sabit IP / Şube Bloğu"
                  value={whitelistDescInput}
                  onChange={(e) => setWhitelistDescInput(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsWhitelistModalOpen(false);
                  setEditingWhitelistOldIp(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => handleAddWhitelist()}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 ${bg} ${hover}`}
              >
                {loading ? "Kaydediliyor..." : editingWhitelistOldIp ? "Değişiklikleri Kaydet" : "Güvenli Listeye Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTargetIp}
        title="Engeli Kaldır"
        message={`${deleteTargetIp} IP adresi için Fail2Ban ve UFW Firewall engelini kaldırmak istediğinize emin misiniz?`}
        onConfirm={unbanIp}
        onCancel={() => setDeleteTargetIp(null)}
        isLoading={loading}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteWhitelistIp}
        title="Güvenli IP Kaydını Sil"
        message={`${deleteWhitelistIp} adresini Güvenli IP (Fail2Ban ignoreip) listesinden kaldırmak istediğinize emin misiniz?`}
        onConfirm={removeWhitelistIp}
        onCancel={() => setDeleteWhitelistIp(null)}
        isLoading={loading}
      />
    </div>
  );
}
