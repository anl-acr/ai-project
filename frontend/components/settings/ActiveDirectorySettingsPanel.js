import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
  Server,
  Users,
  KeyRound,
  Lock,
  Play,
  Save,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  Sliders,
  UserCheck,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const PROVIDER_OPTIONS = [
  { id: "microsoft_ad", label: "Microsoft Active Directory", subtitle: "Windows Server Domain Controller", badge: "Kurumsal Standart" },
  { id: "azure_entra", label: "Microsoft Entra ID", subtitle: "Azure AD Domain Services", badge: "Bulut / Hibrit" },
  { id: "openldap", label: "OpenLDAP Directory", subtitle: "Linux Kurumsal Dizin Sunucusu", badge: "Açık Kaynak" },
  { id: "freeipa", label: "RedHat IdM / FreeIPA", subtitle: "Merkezi Kimlik & Kerberos", badge: "Kurumsal Linux" },
];

function DirectoryProviderLogo({ id, size = 40 }) {
  const boxCls = "rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-950 overflow-hidden";
  const style = { width: size, height: size };

  switch (id) {
    case "microsoft_ad":
      return (
        <div className={boxCls} style={style} title="Microsoft Active Directory">
          <svg viewBox="0 0 64 64" className="w-7 h-7">
            <rect x="10" y="10" width="20" height="20" rx="2" fill="#F25022" />
            <rect x="34" y="10" width="20" height="20" rx="2" fill="#7FBA00" />
            <rect x="10" y="34" width="20" height="20" rx="2" fill="#00A4EF" />
            <rect x="34" y="34" width="20" height="20" rx="2" fill="#FFB900" />
          </svg>
        </div>
      );
    case "azure_entra":
      return (
        <div className={boxCls} style={style} title="Microsoft Entra ID (Azure AD)">
          <svg viewBox="0 0 64 64" className="w-7 h-7">
            <polygon points="32,8 54,48 10,48" fill="#0078D4" />
            <polygon points="32,20 46,48 18,48" fill="#50E6FF" />
            <circle cx="32" cy="37" r="5" fill="#003B73" />
          </svg>
        </div>
      );
    case "openldap":
      return (
        <div className={boxCls} style={style} title="OpenLDAP">
          <svg viewBox="0 0 64 64" className="w-7 h-7">
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#1E293B" />
            <circle cx="32" cy="20" r="6" fill="#38BDF8" />
            <circle cx="19" cy="43" r="6" fill="#38BDF8" />
            <circle cx="45" cy="43" r="6" fill="#38BDF8" />
            <line x1="32" y1="26" x2="21" y2="38" stroke="#94A3B8" strokeWidth="3" />
            <line x1="32" y1="26" x2="43" y2="38" stroke="#94A3B8" strokeWidth="3" />
          </svg>
        </div>
      );
    case "freeipa":
      return (
        <div className={boxCls} style={style} title="RedHat IdM / FreeIPA">
          <svg viewBox="0 0 64 64" className="w-7 h-7">
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#EE0000" />
            <path d="M16 38c0-4 7-7 16-7s16 3 16 7H16z" fill="#fff" />
            <path d="M23 31l3-10c1-2 11-2 12 0l3 10H23z" fill="#fff" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={boxCls} style={style}>
          <Building2 size={18} />
        </div>
      );
  }
}

export default function ActiveDirectorySettingsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [config, setConfig] = useState({
    enabled: false,
    provider_type: "microsoft_ad",
    domain_name: "kurum.local",
    server_host: "dc01.kurum.local",
    server_port: 389,
    use_ssl: false,
    use_starttls: false,
    base_dn: "DC=kurum,DC=local",
    bind_dn: "CN=aida_ldap_svc,OU=ServisHesaplari,DC=kurum,DC=local",
    bind_password: "",
    user_search_base: "OU=CagriMerkezi,DC=kurum,DC=local",
    user_search_filter: "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
    attr_username: "sAMAccountName",
    attr_full_name: "displayName",
    attr_email: "mail",
    attr_phone: "telephoneNumber",
    attr_department: "department",
    auto_sync_enabled: false,
    sync_interval_minutes: 60,
    auto_create_users: true,
    auto_assign_extension: true,
    extension_start_range: 1050,
    default_role: "agent",
    disable_removed_users: true,
    allow_local_fallback: true,
    simulation_mode: true,
    last_sync_at: null,
    last_sync_count: 0,
  });

  const [previewUsers, setPreviewUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showBindPassword, setShowBindPassword] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const safeFetch = async (path, options = {}) => {
    const apiBase = getApiBaseUrl(backendHost);
    return await tenantFetch(`${apiBase}${path}`, options);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await safeFetch("/api/settings/active-directory");
      if (res.ok) {
        const data = await res.json();
        if (data?.config) setConfig((prev) => ({ ...prev, ...data.config }));
        if (Array.isArray(data?.preview_users)) setPreviewUsers(data.preview_users);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [backendHost]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/active-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: data?.message || "Active Directory ayarları kaydedildi." });
      } else {
        setFeedback({ type: "error", message: data?.detail || "Ayarlar kaydedilemedi." });
      }
    } catch (e) {
      setFeedback({ type: "error", message: "Sunucu bağlantı hatası." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/active-directory/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResult(data);
      if (Array.isArray(data?.preview_users)) {
        setPreviewUsers(data.preview_users);
      }
    } catch (e) {
      setTestResult({ status: "error", message: "Bağlantı testi sırasında hata oluştu." });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncUsers = async (dryRun = false) => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/active-directory/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, dry_run: dryRun }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: data?.message || "Senkronizasyon tamamlandı." });
        if (Array.isArray(data?.users)) setPreviewUsers(data.users);
        if (data?.last_sync_at) {
          setConfig((prev) => ({
            ...prev,
            last_sync_at: data.last_sync_at,
            last_sync_count: data.synced_count || prev.last_sync_count,
          }));
        }
      } else {
        setFeedback({ type: "error", message: data?.detail || "Senkronizasyon başarısız oldu." });
      }
    } catch (e) {
      setFeedback({ type: "error", message: "Senkronizasyon sırasında hata oluştu." });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>Active Directory / LDAP yapılandırması yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Active Directory (LDAP / Microsoft Entra ID) Entegrasyonu
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                config.enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}>
                {config.enabled ? "Aktif (Domain Bağlı)" : "Pasif"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kurumsal kullanıcıların şirket Windows/Domain şifresiyle (Tek Şifre / SSO) giriş yapmasını, yeni personellerin otomatik dahili almasını ve işten ayrılanların anında kapatılmasını sağlar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-2 ${
              config.enabled
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${config.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span>{config.enabled ? "AD Entegrasyonu Açık" : "AD Entegrasyonunu Etkinleştir"}</span>
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {testing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} className={text} />}
            <span>Bağlantıyı Test Et</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50`}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Ayarları Kaydet</span>
          </button>
        </div>
      </div>

      {/* Feedback & Test Result Banners */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
          feedback.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          testResult.status === "success"
            ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
            : "bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200"
        }`}>
          <div className="flex items-start gap-2.5">
            {testResult.status === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-extrabold">{testResult.message}</div>
              {testResult.status === "success" && (
                <div className="text-[11px] opacity-85 mt-1 flex flex-wrap items-center gap-3 font-mono">
                  <span>Sunucu: {testResult.server}</span>
                  <span>•</span>
                  <span>Protokol: {testResult.protocol}</span>
                  <span>•</span>
                  <span>Gecikme: {testResult.latency_ms} ms</span>
                  <span>•</span>
                  <span>Bulunan Kullanıcı: {testResult.discovered_users_count}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider Cards Row with Brand Logos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {PROVIDER_OPTIONS.map((prov) => {
          const isSelected = config.provider_type === prov.id;
          return (
            <button
              key={prov.id}
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, provider_type: prov.id }))}
              className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 cursor-pointer ${
                isSelected
                  ? `bg-white dark:bg-slate-900 ${border} ring-2 ${ring} shadow-sm`
                  : "bg-white/80 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <DirectoryProviderLogo id={prov.id} size={42} />
              <div className="min-w-0 flex-1">
                <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-extrabold ${lightBg} ${text} border ${borderLight} mb-1`}>
                  {prov.badge}
                </span>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {prov.label}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {prov.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: LDAP / Domain Controller Connection */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Server size={16} className={text} />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                1. Dizin Sunucusu (Domain Controller) & Bağlantı
              </h4>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(config.simulation_mode)}
                onChange={(e) => setConfig((prev) => ({ ...prev, simulation_mode: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <span>Demo / Simülasyon Modu</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Dizin Servisi Sağlayıcısı
              </label>
              <select
                value={config.provider_type}
                onChange={(e) => setConfig((prev) => ({ ...prev, provider_type: e.target.value }))}
                className={`w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.badge})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Domain Adı (FQDN)
              </label>
              <input
                type="text"
                value={config.domain_name}
                onChange={(e) => setConfig((prev) => ({ ...prev, domain_name: e.target.value }))}
                placeholder="Örn: kurum.local"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                DC Sunucu Adresi (Host / IP)
              </label>
              <input
                type="text"
                value={config.server_host}
                onChange={(e) => setConfig((prev) => ({ ...prev, server_host: e.target.value }))}
                placeholder="Örn: dc01.kurum.local veya 10.0.0.10"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                LDAP Portu (389 / 636 LDAPS)
              </label>
              <input
                type="number"
                value={config.server_port}
                onChange={(e) => setConfig((prev) => ({ ...prev, server_port: Number(e.target.value) || 389 }))}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(config.use_ssl)}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      use_ssl: e.target.checked,
                      server_port: e.target.checked ? 636 : 389,
                    }))
                  }
                  className="rounded border-slate-300"
                />
                <span>LDAPS (SSL/TLS 636)</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Base DN (Kök Dizin)
              </label>
              <input
                type="text"
                value={config.base_dn}
                onChange={(e) => setConfig((prev) => ({ ...prev, base_dn: e.target.value }))}
                placeholder="DC=kurum,DC=local"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Yetkili Servis Hesabı (Bind DN / UPN)
              </label>
              <input
                type="text"
                value={config.bind_dn}
                onChange={(e) => setConfig((prev) => ({ ...prev, bind_dn: e.target.value }))}
                placeholder="CN=aida_ldap_svc,OU=ServisHesaplari,DC=kurum,DC=local"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Bind Servis Hesabı Parolası
              </label>
              <div className="flex gap-2">
                <input
                  type={showBindPassword ? "text" : "password"}
                  value={config.bind_password}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bind_password: e.target.value }))}
                  placeholder="••••••••••••"
                  className="flex-1 text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowBindPassword((v) => !v)}
                  className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {showBindPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Auto-Provisioning & Security Policy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sliders size={16} className={text} />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
              2. Otomatik Kullanıcı Açma, Dahili Atama & Güvenlik Politikası
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Kullanıcı Arama OU Dizini (Search Base)
              </label>
              <input
                type="text"
                value={config.user_search_base}
                onChange={(e) => setConfig((prev) => ({ ...prev, user_search_base: e.target.value }))}
                placeholder="OU=CagriMerkezi,DC=kurum,DC=local"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Otomatik Dahili Başlangıç No
              </label>
              <input
                type="number"
                value={config.extension_start_range}
                onChange={(e) => setConfig((prev) => ({ ...prev, extension_start_range: Number(e.target.value) || 1050 }))}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Varsayılan Atanacak Rol
              </label>
              <select
                value={config.default_role}
                onChange={(e) => setConfig((prev) => ({ ...prev, default_role: e.target.value }))}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              >
                <option value="agent">Müşteri Temsilcisi (Agent)</option>
                <option value="supervisor">Takım Lideri (Supervisor)</option>
                <option value="admin">Sistem Yöneticisi (Admin)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {[
              {
                key: "auto_create_users",
                title: "Yeni AD personellerini AIDA'da otomatik oluştur",
                desc: "Active Directory'de açılan yeni personel ilk senkronizasyonda veya ilk girişinde otomatik oluşturulur.",
              },
              {
                key: "auto_assign_extension",
                title: "Boştaki sıradaki dahili numarasını ve Web Telefonunu otomatik tanımla",
                desc: "Yeni personele belirlenen aralıktan (örn. 1050+) boş dahili ve güvenli SIP şifresi atanır.",
              },
              {
                key: "disable_removed_users",
                title: "AD'de pasife alınan (Disable) personelin santral erişimini anında kes",
                desc: "İşten ayrılan personel AD'de kapatıldığında Web Telefonu ve kuyruk oturumu otomatik düşürülür.",
              },
              {
                key: "allow_local_fallback",
                title: "Hibrit Çalışma: Yerel (Local) AIDA kullanıcılarının girişine de izin ver",
                desc: "AD dışındaki yerel yönetici veya dış kaynak temsilci hesapları kendi şifreleriyle girmeye devam eder.",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(config[item.key])}
                  onChange={(e) => setConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Users Preview & One-Click Sync Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={16} className={text} />
              Active Directory Dizininde Bulunan Kullanıcılar ve Eşleştirme Önizlemesi
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Dizin sorgusundan dönen personellerin AIDA üzerindeki karşılıkları ve otomatik atanacak dahili numaraları.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSyncUsers(false)}
            disabled={syncing}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0`}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Senkronize Ediliyor..." : "Kullanıcıları Şimdi Senkronize Et"}</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">AD Kullanıcı Adı</th>
                <th className="py-2.5 px-4">Ad Soyad</th>
                <th className="py-2.5 px-4">E-Posta (UPN)</th>
                <th className="py-2.5 px-4">Departman / Unvan</th>
                <th className="py-2.5 px-4">AIDA Dahili</th>
                <th className="py-2.5 px-4">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {previewUsers.map((u, idx) => (
                <tr key={u.username || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                    {u.username}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                    {u.full_name}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {u.email}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                    {u.department} • <span className="text-slate-400">{u.title}</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-extrabold text-slate-800 dark:text-slate-100">
                    {u.suggested_extension}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                      u.sync_state === "existing"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                    }`}>
                      {u.sync_state === "existing" ? "Senkronize (Mevcut)" : "Yeni Açılacak"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
