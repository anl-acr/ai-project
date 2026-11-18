import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  Smartphone,
  Monitor,
  PhoneCall,
  Radio,
  Server,
  Key,
  Lock,
  Unlock,
  Search,
  ToggleLeft,
  ToggleRight,
  Activity,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

export default function RemoteAccessSettingsPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"],
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hardwareId, setHardwareId] = useState("");
  const [hostname, setHostname] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [config, setConfig] = useState({
    enabled: false,
    hub_url: "",
    subdomain: "merkez",
    subdomain_locked: false,
    locked_subdomain: "",
    secret_token: "",
    remote_ssh_enabled: true,
    turn_enabled: true,
    turn_server: "",
    turn_username: "nornia",
    turn_password: "nornia_turn_secret_2026",
  });

  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainCheckResult, setSubdomainCheckResult] = useState(null);

  const [runtime, setRuntime] = useState({
    status: "disabled",
    connected: false,
    latency_ms: null,
    last_connected_at: null,
    last_error: "",
    public_ras_url: "",
    mobile_ras_url: "",
    wss_sip_url: "",
    active_streams: 0,
    bytes_tx: 0,
    bytes_rx: 0,
  });

  const canWrite =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("ras_settings:write") ||
    userPermissions.includes("server_network:write");

  const showToast = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback((prev) => (prev?.msg === msg ? null : prev));
    }, 5000);
  };

  const fetchRasStatus = useCallback(
    async (showSpinner = false, updateForm = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await tenantFetch(`${API_BASE}/api/settings/ras/status`);
        if (res.ok) {
          const data = await res.json();
          if (updateForm && data.config) {
            setConfig((prev) => ({ ...prev, ...data.config }));
          } else if (data.config) {
            setConfig((prev) => ({
              ...prev,
              subdomain_locked: Boolean(data.config.subdomain_locked),
              locked_subdomain: data.config.locked_subdomain || "",
              ...(data.config.subdomain_locked ? { subdomain: data.config.subdomain } : {}),
            }));
          }
          if (data.runtime) {
            setRuntime((prev) => ({ ...prev, ...data.runtime }));
          }
          if (data.hardware_id) setHardwareId(data.hardware_id);
          if (data.hostname) setHostname(data.hostname);
        }
      } catch (e) {
        console.error("[Nornia RAS] Status fetch error:", e);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchRasStatus(true, true);
    const interval = setInterval(() => fetchRasStatus(false, false), 4000);
    return () => clearInterval(interval);
  }, [fetchRasStatus]);

  const handleSaveConfig = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", data.message || "Nornia Connect ayarları başarıyla kaydedildi.");
        if (data.config) setConfig((p) => ({ ...p, ...data.config }));
        if (data.runtime) setRuntime((p) => ({ ...p, ...data.runtime }));
        setSubdomainCheckResult(null);
        setTimeout(() => fetchRasStatus(false, true), 1500);
      } else {
        showToast("error", data.detail || "Nornia Connect ayarları kaydedilirken hata oluştu.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckSubdomain = async (syncLock = false) => {
    if (!config.hub_url || !config.subdomain) {
      showToast("error", "Lütfen önce Merkez Sunucu Adresi ve Alt Alan Adı (Subdomain) alanlarını doldurunuz.");
      return;
    }
    setCheckingSubdomain(true);
    setSubdomainCheckResult(null);
    try {
      const qs = new URLSearchParams({
        subdomain: config.subdomain,
        hub_url: config.hub_url,
        sync_lock: syncLock ? "true" : "false",
      }).toString();
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/check-subdomain?${qs}`);
      const data = await res.json().catch(() => ({}));
      setSubdomainCheckResult(data);
      if (syncLock) {
        await fetchRasStatus(false, true);
        if (data.reachable && !data.locked_to_this_hw) {
          showToast("success", "Merkez sunucuda kilit kaldırılmış! Alt alan adını artık değiştirebilirsiniz.");
        } else if (data.locked_to_this_hw) {
          showToast("error", `Alt alan adı ('${config.subdomain}') Merkez Lisans Sunucusunda hala bu santrale kilitli durumda.`);
        }
      }
    } catch (e) {
      showToast("error", "Alt alan adı sorgulanırken hata oluştu.");
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleReconnectNow = async () => {
    setReconnecting(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/reconnect`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("success", "Nornia Connect bulut köprüsü yeniden tetiklendi.");
        setTimeout(() => fetchRasStatus(false, false), 1200);
      }
    } catch (e) {
      showToast("error", "Bulut köprüsü yeniden başlatılamadı.");
    } finally {
      setReconnecting(false);
    }
  };

  const copyToClipboard = (val, key) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const formatBytes = (bytes) => {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl ${lightBg} ${text} border ${borderLight} shrink-0`}>
            <Globe size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nornia Connect (Sıfır-Port Bulut Köprüsü)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                  runtime.connected
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : config.enabled
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    runtime.connected
                      ? "bg-emerald-500 animate-pulse"
                      : config.enabled
                      ? "bg-amber-500 animate-ping"
                      : "bg-slate-400"
                  }`}
                />
                {runtime.connected
                  ? `NORNIA CONNECT AKTİF (${runtime.latency_ms || 1} ms)`
                  : config.enabled
                  ? "MERKEZ SUNUCUYA BAĞLANIYOR..."
                  : "DEVRE DIŞI"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Güvenlik duvarında (Firewall / NAT) dışarıdan içeriye <strong>hiçbir port açmadan</strong>; sadece santralin internete çıkışıyla Web Arayüzü, WebPhone, Mobil/Masaüstü Uygulama ve Uzak SSH erişimini sağlar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReconnectNow}
            disabled={reconnecting}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw size={14} className={reconnecting ? "animate-spin" : ""} />
            <span>Bağlantıyı Yenile</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Live Endpoints & Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Web & Masaüstü Connect Adresi</span>
            <Monitor size={15} className={text} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {runtime.public_ras_url || "Henüz Tanımlanmadı"}
            </span>
            {runtime.public_ras_url && (
              <button
                type="button"
                onClick={() => copyToClipboard(runtime.public_ras_url, "pub_url")}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0"
                title="Adresi Kopyala"
              >
                {copiedKey === "pub_url" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Port açmadan tarayıcı ve masaüstü uygulama girişi
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Mobil Uygulama & SIP WSS</span>
            <Smartphone size={15} className={text} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {runtime.wss_sip_url || "Henüz Tanımlanmadı"}
            </span>
            {runtime.wss_sip_url && (
              <button
                type="button"
                onClick={() => copyToClipboard(runtime.wss_sip_url, "wss_url")}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0"
                title="WSS Adresini Kopyala"
              >
                {copiedKey === "wss_url" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Tünel üzerinden şifreli WebRTC SIP sinyalizasyonu
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Santral Donanım Kimliği</span>
            <Server size={15} className={text} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
              {hardwareId || "HW-..."}
            </span>
            {hardwareId && (
              <button
                type="button"
                onClick={() => copyToClipboard(hardwareId, "hw_id")}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0"
                title="Donanım Kimliğini Kopyala"
              >
                {copiedKey === "hw_id" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Sunucu: <span className="font-mono">{hostname || "nornia-pbx"}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Tünel Trafik & Oturum</span>
            <Activity size={15} className={text} />
          </div>
          <div className="mt-2 font-mono text-xs font-extrabold text-slate-900 dark:text-white">
            ↑ {formatBytes(runtime.bytes_tx)} / ↓ {formatBytes(runtime.bytes_rx)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Aktif Akış: <strong>{runtime.active_streams || 0}</strong> • Son Bağlantı: {runtime.last_connected_at || "-"}
          </div>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Nornia Connect Merkez Bulut Köprüsü Ayarları
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Santraliniz bu adrese içeriden dışarıya (Outbound) kalıcı tünel açar. Merkez sunucu henüz kurulmadıysa bile ayarları kaydedebilirsiniz; merkez sunucu açıldığında otomatik bağlanır.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
              Nornia Connect: {config.enabled ? "AKTİF" : "KAPALI"}
            </span>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className={`transition-colors cursor-pointer ${
                config.enabled ? "text-emerald-500" : "text-slate-400"
              }`}
            >
              {config.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
            </button>
          </div>
        </div>

        {runtime.last_error && config.enabled && !runtime.connected && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                <strong>Bağlantı Bekleniyor:</strong> Nornia Connect Merkez sunucusuna bağlanmaya çalışılıyor ({runtime.last_error}). Merkez sunucu hazır olduğunda otomatik bağlanacaktır.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              1. Nornia Connect & Lisans Merkez Sunucusu Adresi (Hub URL / IP) *
            </label>
            <input
              type="text"
              disabled={!canWrite}
              value={config.hub_url}
              onChange={(e) => setConfig((p) => ({ ...p, hub_url: e.target.value }))}
              placeholder="Örn: https://connect.saphira.com.tr veya http://192.168.1.50:8050"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Dış dünyaya açık olan Nornia Connect & Lisans Merkez sunucunuzun IP adresi veya alan adı.
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Santral Alt Alan Adı / Kimliği (Subdomain) *
              </label>
              {config.subdomain_locked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Lock size={11} />
                  <span>Merkeze Tescilli (Kilitli)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Unlock size={11} />
                  <span>Tanımlanabilir</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled={!canWrite || Boolean(config.subdomain_locked)}
                readOnly={Boolean(config.subdomain_locked)}
                value={config.subdomain}
                onChange={(e) => {
                  setSubdomainCheckResult(null);
                  setConfig((p) => ({
                    ...p,
                    subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
                  }));
                }}
                placeholder="Örn: merkez veya nolto"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold ${
                  config.subdomain_locked
                    ? "border-amber-300/70 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                }`}
              />

              {config.subdomain_locked ? (
                <button
                  type="button"
                  onClick={() => handleCheckSubdomain(true)}
                  disabled={checkingSubdomain}
                  title="Merkez Lisans Panelinden kaydı sildiyseniz kilidi açmak için tıklayın"
                  className="px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={checkingSubdomain ? "animate-spin" : ""} />
                  <span>Kilidi Sorgula</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckSubdomain(false)}
                  disabled={checkingSubdomain || !config.hub_url || !config.subdomain}
                  title="Bu alt alan adının Merkez Sunucuda boşta olup olmadığını kontrol et"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-extrabold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Search size={13} className={checkingSubdomain ? "animate-spin" : ""} />
                  <span>Sorgula</span>
                </button>
              )}
            </div>

            {subdomainCheckResult && !config.subdomain_locked && (
              <div
                className={`mt-2 p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                  subdomainCheckResult.available
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                }`}
              >
                {subdomainCheckResult.available ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                <span>{subdomainCheckResult.message}</span>
              </div>
            )}

            <span className="text-[10px] text-slate-400 mt-1 block leading-relaxed">
              {config.subdomain_locked ? (
                <>
                  🔒 <strong>{config.subdomain}.nornia.com.tr</strong> adı bu santrale tescillenmiştir. Değiştirmek veya silmek için önce <strong>Merkezi Lisans Panelinden (panel.nornia.com.tr)</strong> kaydı silip <em>&quot;Kilidi Sorgula&quot;</em> butonuna basınız.
                </>
              ) : (
                <>
                  Çoklu santral yapısında bu santrali tanımlayan benzersiz kısa ad (<code className="font-mono">{config.subdomain || "merkez"}.nornia.com.tr</code>). İlk bağlantıda bu santrale kilitlenir.
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              3. Nornia Connect Kimlik Doğrulama / Lisans Anahtarı
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={!canWrite}
                value={config.secret_token}
                onChange={(e) => setConfig((p) => ({ ...p, secret_token: e.target.value }))}
                placeholder="Boş bırakılırsa aktif Nornia Lisans Anahtarı kullanılır"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Merkez sunucu sadece geçerli donanım kimliği ve lisans anahtarına sahip santrallerin Nornia Connect tüneli açmasına izin verir.
            </span>
          </div>

          {/* Remote Support SSH Toggle Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${lightBg} ${text} shrink-0`}>
                <Terminal size={16} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                  Uzak Teknik Destek (Web SSH / Konsol Tüneli)
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Açık olduğunda Nornia Connect Merkez panelinden bu santralin SSH konsoluna port açmadan güvenli erişim sağlanabilir.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setConfig((p) => ({ ...p, remote_ssh_enabled: !p.remote_ssh_enabled }))}
              className={`transition-colors shrink-0 cursor-pointer ${
                config.remote_ssh_enabled ? "text-emerald-500" : "text-slate-400"
              }`}
            >
              {config.remote_ssh_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
        </div>

        {/* WebRTC TURN Media Relay Section */}
        <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PhoneCall size={16} className={text} />
              <div>
                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  WebRTC & Mobil Ses Rölesi (Entegre TURN / RTP Relay)
                </h5>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Santralin önünde tüm UDP RTP ses portları (10000-20000) kapalı olduğunda, WebPhone, Mobil ve Masaüstü çağrı seslerini Merkez TURN sunucusu üzerinden çift yönlü taşır.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setConfig((p) => ({ ...p, turn_enabled: !p.turn_enabled }))}
              className={`transition-colors shrink-0 cursor-pointer ${
                config.turn_enabled ? "text-emerald-500" : "text-slate-400"
              }`}
            >
              {config.turn_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          {config.turn_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  TURN Sunucu Adresi (Opsiyonel)
                </label>
                <input
                  type="text"
                  disabled={!canWrite}
                  value={config.turn_server}
                  onChange={(e) => setConfig((p) => ({ ...p, turn_server: e.target.value }))}
                  placeholder="Boşsa Merkez Hub IP:3478 kullanılır"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  TURN Kullanıcı Adı
                </label>
                <input
                  type="text"
                  disabled={!canWrite}
                  value={config.turn_username}
                  onChange={(e) => setConfig((p) => ({ ...p, turn_username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  TURN Parolası
                </label>
                <input
                  type="password"
                  disabled={!canWrite}
                  value={config.turn_password}
                  onChange={(e) => setConfig((p) => ({ ...p, turn_password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* SSH / Console Fallback Hint */}
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Terminal size={14} />
              <span>Sunucu Konsolundan / SSH Üzerinden Nornia Connect Adresi Değiştirme Komutu:</span>
            </div>
            <div className="font-mono text-[11px] text-slate-300 mt-1">
              sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --set-connect {config.hub_url || "http://MERKEZ_IP:8050"} {config.subdomain || "merkez"}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                `sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --set-connect ${config.hub_url || "http://MERKEZ_IP:8050"} ${config.subdomain || "merkez"}`,
                "cli_ras"
              )
            }
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copiedKey === "cli_ras" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>Komutu Kopyala</span>
          </button>
        </div>

        {canWrite && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 cursor-pointer`}
            >
              <ShieldCheck size={16} />
              <span>{saving ? "Kaydediliyor..." : "Nornia Connect Ayarlarını Kaydet ve Başlat"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
