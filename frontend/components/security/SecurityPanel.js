import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, Globe, Trash2, CheckCircle, Search, Save, AlertTriangle, Check } from "lucide-react";
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
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [hasWritePermission, setHasWritePermission] = useState(false);

  // Fail2Ban States
  const [blockedIps, setBlockedIps] = useState([]);
  const [searchIp, setSearchIp] = useState("");
  const [deleteTargetIp, setDeleteTargetIp] = useState(null);

  // GeoIP States
  const [allowedCountries, setAllowedCountries] = useState(["TR"]);

  // Advanced Security (Rate Limiting) States
  const [rateLimiting, setRateLimiting] = useState({
    login_rate_limit: 5,
    api_rate_limit: 100,
    sip_rate_limit: 50,
    block_duration_minutes: 15
  });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    checkPermissionsAndFetchData();
  }, [backendHost]);

  const checkPermissionsAndFetchData = async () => {
    setLoading(true);
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`);
      const statusData = await resStatus.json();
      
      let canWrite = false;
      if (statusData.is_logged_in) {
        const resUsers = await fetch(`${API_BASE}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (currentUser) {
          const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
          const rolesData = await resRoles.json();
          const currentRole = rolesData.find(r => r.role_code === currentUser.role);
          if (currentRole && currentRole.permissions.includes("security:write")) {
            canWrite = true;
          }
        }
      } else {
        canWrite = true; // For testing when not logged in
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

  const fetchBlockedIps = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban`);
      if (res.ok) {
        const data = await res.json();
        setBlockedIps(data.blocked_ips || []);
      }
    } catch (err) {
      console.error("Fail2ban IP hatası:", err);
    }
  };

  const fetchGeoRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/security/geo`);
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
      const res = await fetch(`${API_BASE}/api/security/advanced`);
      if (res.ok) {
        const data = await res.json();
        setRateLimiting(data);
      }
    } catch (err) {
      console.error("Advanced Security hatası:", err);
    }
  };

  const unbanIp = async () => {
    if (!hasWritePermission || !deleteTargetIp) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/security/fail2ban/${deleteTargetIp}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || "IP engeli başarıyla kaldırıldı.");
        setTimeout(() => setSuccess(""), 3000);
        await fetchBlockedIps();
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rateLimiting)
      });
      if (res.ok) {
        setSuccess("Gelişmiş güvenlik ayarları başarıyla kaydedildi.");
        setTimeout(() => setSuccess(""), 3000);
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

  const filteredIps = blockedIps.filter(ipObj => ipObj.ip.includes(searchIp));

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/85 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Shield size={22} className="text-rose-500" />
            Güvenlik Kalkanı
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dış ağlardan gelen tehditleri izleyin (Fail2Ban) ve bölgesel (GeoIP) erişim kuralları tanımlayın.
          </p>
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
      <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("fail2ban")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "fail2ban"
              ? `text-rose-600 dark:text-rose-400`
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Engellenen IP'ler</span>
          {activeTab === "fail2ban" && (
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-t-full`} />
          )}
        </button>
        <button
          onClick={() => setActiveTab("geoip")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "geoip"
              ? `text-rose-600 dark:text-rose-400`
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Globe size={16} />
          Bölgesel Erişim (GeoIP)
          {activeTab === "geoip" && (
            <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-rose-500 rounded-t-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("ratelimit")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all relative ${
            activeTab === "ratelimit"
              ? `text-rose-600 dark:text-rose-400`
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ShieldAlert size={16} />
          Anti-DDoS / Hız Sınırlandırması
          {activeTab === "ratelimit" && (
            <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-rose-500 rounded-t-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm min-h-[400px]">
        {activeTab === "fail2ban" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Fail2Ban Engellenenler Listesi</h3>
                <p className="text-[10px] text-slate-500 mt-1">Hatalı şifre denemesi veya şüpheli davranış nedeniyle firewall tarafından engellenen IP adresleri.</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="IP Adresi Ara..."
                  value={searchIp}
                  onChange={(e) => setSearchIp(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all w-48"
                />
              </div>
            </div>

            {loading && blockedIps.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
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
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Servis Kuralı (Jail)</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Engellenme Tarihi</th>
                      {hasWritePermission && <th className="py-3 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredIps.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400">{b.ip}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            {b.jail}
                          </span>
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
                  className={`flex items-center gap-2 px-4 py-2 ${bg} hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50`}
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
                        ? `border-${borderLight} bg-slate-50 dark:bg-slate-800/40`
                        : "border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    } ${!hasWritePermission && 'cursor-default'}`}
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
                        <span className={`text-xs font-bold ${isSelected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
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
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Hız Sınırlandırma (Rate Limiting)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Sisteme ve API'ye yönelik istek limitlerini belirleyerek kaba kuvvet (Brute Force) ve DDoS saldırılarını önleyin.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">API İstek Limiti (Dakikada)</label>
                  <input 
                    type="number" 
                    value={rateLimiting.api_rate_limit} 
                    onChange={e => setRateLimiting({...rateLimiting, api_rate_limit: parseInt(e.target.value) || 0})}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Giriş Deneme Limiti (Dakikada)</label>
                  <input 
                    type="number" 
                    value={rateLimiting.login_rate_limit} 
                    onChange={e => setRateLimiting({...rateLimiting, login_rate_limit: parseInt(e.target.value) || 0})}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">SIP Paket Limiti (Saniyede)</label>
                  <input 
                    type="number" 
                    value={rateLimiting.sip_rate_limit} 
                    onChange={e => setRateLimiting({...rateLimiting, sip_rate_limit: parseInt(e.target.value) || 0})}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Engelleme Süresi (Dakika)</label>
                  <input 
                    type="number" 
                    value={rateLimiting.block_duration_minutes} 
                    onChange={e => setRateLimiting({...rateLimiting, block_duration_minutes: parseInt(e.target.value) || 0})}
                    disabled={!hasWritePermission}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>
              
              {hasWritePermission && (
                <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={saveAdvancedSecurity}
                    disabled={loading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-md transition-all ${loading ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg hover:-translate-y-0.5"}`}
                  >
                    <Save size={16} />
                    {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTargetIp}
        title="Engeli Kaldır"
        message={`${deleteTargetIp} IP adresi için Firewall engelini kaldırmak istediğinize emin misiniz?`}
        onConfirm={unbanIp}
        onCancel={() => setDeleteTargetIp(null)}
        isLoading={loading}
      />
    </div>
  );
}
