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
  PhoneCall,
  Radio,
  Lock,
  Unlock,
  Search,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

export default function RemoteAccessSettingsPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"],
}) {
  const { bg, hover, text, border, lightBg } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hardwareId, setHardwareId] = useState("");
  const [hostname, setHostname] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showAdvancedTurn, setShowAdvancedTurn] = useState(false);

  const [config, setConfig] = useState({
    enabled: false,
    hub_url: "",
    subdomain: "merkez",
    subdomain_locked: false,
    locked_subdomain: "",
    secret_token: "",
    remote_ssh_enabled: true,
    emergency_ssh_override: false,
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

  const canUseWebSsh =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("server_ssh:access") ||
    userPermissions.includes("server_ssh");

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
              locked_subdomain: data.config.locked_subdomain || prev.locked_subdomain,
              remote_ssh_enabled: data.config.remote_ssh_enabled !== false,
              emergency_ssh_override: Boolean(data.config.emergency_ssh_override),
            }));
          }
          if (data.runtime) setRuntime((prev) => ({ ...prev, ...data.runtime }));
          if (data.hardware_id) setHardwareId(data.hardware_id);
          if (data.hostname) setHostname(data.hostname);
        }
      } catch (e) {
        // silent poll fallback
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchRasStatus(true, true);
    const timer = setInterval(() => fetchRasStatus(false, false), 5000);
    return () => clearInterval(timer);
  }, [fetchRasStatus]);

  const handleCheckSubdomain = async (isUnlockCheck = false) => {
    if (!config.hub_url || !config.subdomain) {
      showToast("error", "Önce Merkez Sunucu Adresi ve Alt Alan Adı girilmelidir.");
      return;
    }
    setCheckingSubdomain(true);
    setSubdomainCheckResult(null);
    try {
      const qs = new URLSearchParams({
        hub_url: config.hub_url,
        subdomain: config.subdomain,
      });
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/check-subdomain?${qs.toString()}`);
      const data = await res.json();
      setSubdomainCheckResult(data);
      if (isUnlockCheck) {
        if (data.reachable && !data.locked_to_this_hw) {
          setConfig((prev) => ({ ...prev, subdomain_locked: false, locked_subdomain: "" }));
          showToast("success", "Merkez Lisans Sunucusundaki kayıt silinmiş! Alt alan adı kilidi açıldı.");
        } else if (data.reachable && data.locked_to_this_hw) {
          showToast(
            "error",
            `Bu santral hâlâ Merkez Lisans Sunucusunda '${data.locked_subdomain || config.subdomain}.nornia.com.tr' adına kayıtlı görünüyor.`
          );
        } else {
          showToast("error", data.message || "Merkez Lisans Sunucusuna ulaşılamadı.");
        }
      }
    } catch (err) {
      showToast("error", `Sorgulama hatası: ${err.message}`);
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Nornia Connect ayarları kaydedilemedi.");
      }
      if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
      if (data.runtime) setRuntime((prev) => ({ ...prev, ...data.runtime }));
      showToast("success", data.message || "Nornia Connect Bulut Köprüsü kaydedildi.");
      setTimeout(() => fetchRasStatus(false, true), 1200);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/reconnect`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.runtime) setRuntime((prev) => ({ ...prev, ...data.runtime }));
      showToast("success", "Nornia Connect tüneli yeniden başlatıldı.");
      setTimeout(() => fetchRasStatus(false), 1200);
    } catch (err) {
      showToast("error", "Yeniden bağlanma isteği başarısız oldu.");
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

  const switchToSshTab = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("SWITCH_SETTINGS_SUBTAB", { detail: { subTab: "server-ssh" } })
      );
    }
  };

  const isConnected = runtime.connected && config.enabled;
  const publicWebUrl =
    runtime.public_ras_url ||
    (config.subdomain ? `https://${config.subdomain}.nornia.com.tr` : "");
  const publicWssUrl =
    runtime.wss_sip_url ||
    (config.subdomain ? `wss://${config.subdomain}.nornia.com.tr/ras-sip-ws` : "");

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs font-bold shadow-sm ${
            feedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* 1. CLEAN TOP STATUS & QUICK CONTROL HEADER */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
            <Radio size={22} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nornia Connect — Sıfır-Port Bulut Köprüsü
              </h3>

              {/* Live Status Pill */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 border ${
                  isConnected
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : config.enabled
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? "bg-emerald-500 animate-ping"
                      : config.enabled
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />
                <span>
                  {isConnected
                    ? `TÜNEL AKTİF${runtime.latency_ms ? ` (${runtime.latency_ms} ms)` : ""}`
                    : config.enabled
                    ? "BAĞLANIYOR..."
                    : "DEVRE DIŞI"}
                </span>
              </span>

              {/* Hardware ID Badge */}
              {hardwareId && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {hardwareId}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Firewall veya modemde hiçbir port açmadan santrale Web, Mobil, WebRTC Ses ve SSH erişimi sağlar.
            </p>
          </div>
        </div>

        {/* Right Controls: Master Enable Switch, Reconnect, and Jump to Web SSH Tab */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {canUseWebSsh && (
            <button
              type="button"
              onClick={switchToSshTab}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-xs"
              title="Geniş Ekran Sunucu Web SSH Terminali Sekmesini Aç"
            >
              <Terminal size={14} className="text-emerald-400" />
              <span>Sunucu Web SSH Terminali</span>
            </button>
          )}

          {config.enabled && (
            <button
              type="button"
              onClick={handleReconnect}
              disabled={reconnecting}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={reconnecting ? "animate-spin" : ""} />
              <span>Yenile</span>
            </button>
          )}

          <button
            type="button"
            disabled={!canWrite}
            onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border ${
              config.enabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {config.enabled ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
            <span>{config.enabled ? "Köprü Açık" : "Köprü Kapalı"}</span>
          </button>
        </div>
      </div>

      {/* Error Alert if Disconnected with Error */}
      {config.enabled && !isConnected && runtime.last_error && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span>
            <strong>Tünel Bağlantı Uyarısı:</strong> {runtime.last_error}
          </span>
        </div>
      )}

      {/* 2. TWO-COLUMN FLAT CONFIGURATION LAYOUT */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (7 cols): Tunnel Connection Settings */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Tünel Bağlantı Yapılandırması
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Santralin dışarıya doğru bağlanacağı Merkez Sunucu adresini ve santral alt alan adını tanımlayın.
              </p>
            </div>

            {/* 1. Hub URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Merkez Sunucu Adresi (Hub URL veya IP)
              </label>
              <input
                type="text"
                disabled={!canWrite}
                value={config.hub_url}
                onChange={(e) => setConfig((p) => ({ ...p, hub_url: e.target.value }))}
                placeholder="Örn: https://connect.nornia.com.tr veya 213.74.216.246"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* 2. Subdomain + Lock Status */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Santral Alt Alan Adı (Subdomain)
                </label>
                {config.subdomain_locked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] font-extrabold">
                    <Lock size={10} />
                    <span>Merkez Sunucuya Tescilli</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-extrabold">
                    <Unlock size={10} />
                    <span>Düzenlenebilir</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
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
                    placeholder="app"
                    className={`w-full pl-3.5 pr-32 py-2.5 rounded-xl border text-xs font-mono font-bold ${
                      config.subdomain_locked
                        ? "border-amber-300/60 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                    }`}
                  />
                  <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
                    .nornia.com.tr
                  </span>
                </div>

                {config.subdomain_locked ? (
                  <button
                    type="button"
                    onClick={() => handleCheckSubdomain(true)}
                    disabled={checkingSubdomain}
                    className="px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 text-xs font-extrabold shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={checkingSubdomain ? "animate-spin" : ""} />
                    <span>Kilidi Sorgula</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckSubdomain(false)}
                    disabled={checkingSubdomain || !config.hub_url || !config.subdomain}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Search size={13} className={checkingSubdomain ? "animate-spin" : ""} />
                    <span>Müsaitlik Sorgula</span>
                  </button>
                )}
              </div>

              {subdomainCheckResult && !config.subdomain_locked && (
                <div
                  className={`mt-2 p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    subdomainCheckResult.available
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {subdomainCheckResult.available ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{subdomainCheckResult.message}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 mt-1">
                {config.subdomain_locked
                  ? "Alt alan adını değiştirmek için önce Merkez Lisans Panelinden (panel.nornia.com.tr) 'Kilidi Çöz' butonuna basıp ardından burada 'Kilidi Sorgula'ya tıklayınız."
                  : "İlk başarılı bağlantıda bu isim santralinizin donanım kimliğine otomatik kilitlenir."}
              </p>
            </div>

            {/* 3. Optional Token */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Kimlik Doğrulama / Lisans Anahtarı (Opsiyonel)
              </label>
              <input
                type="text"
                disabled={!canWrite}
                value={config.secret_token}
                onChange={(e) => setConfig((p) => ({ ...p, secret_token: e.target.value }))}
                placeholder="Boş bırakılırsa aktif Nornia Lisans Anahtarı otomatik kullanılır"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {canWrite && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 cursor-pointer`}
              >
                <ShieldCheck size={16} />
                <span>{saving ? "Kaydediliyor..." : "Ayarları Kaydet ve Başlat"}</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5 cols): Public Access Links, Voice TURN Relay & Central SSH Info */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card A: Public Access Links */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Dış Erişim Bağlantı Adresleri
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tünel aktifken santralinize internet üzerinden erişebileceğiniz adresler.
              </p>
            </div>

            {/* Web & Mobile URL */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Globe size={13} className={text} />
                  <span>Web, Mobil & Masaüstü Erişim Adresi</span>
                </span>
                {publicWebUrl && (
                  <a
                    href={publicWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 ${text} hover:underline`}
                  >
                    <span>Yeni Sekmede Aç</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-extrabold text-slate-900 dark:text-white truncate">
                  {publicWebUrl || "-"}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicWebUrl, "web_url")}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
                  title="Adresi Kopyala"
                >
                  {copiedKey === "web_url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* WebRTC SIP WSS URL */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <PhoneCall size={13} className={text} />
                <span>WebRTC SIP WSS Sinyal Tüneli</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                  {publicWssUrl || "-"}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicWssUrl, "wss_url")}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
                  title="WSS Adresini Kopyala"
                >
                  {copiedKey === "wss_url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Card B: TURN Media Relay & Central SSH Status */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            {/* TURN Toggle Row */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PhoneCall size={14} className={text} />
                  <span>WebRTC Ses Rölesi (TURN / RTP Relay)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  UDP ses portları kapalı ağlarda çağrı sesini Merkez TURN sunucusu üzerinden taşır.
                </p>
              </div>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => setConfig((p) => ({ ...p, turn_enabled: !p.turn_enabled }))}
                className={`transition-colors shrink-0 cursor-pointer ${
                  config.turn_enabled ? "text-emerald-500" : "text-slate-400"
                }`}
              >
                {config.turn_enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
              </button>
            </div>

            {config.turn_enabled && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedTurn((p) => !p)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {showAdvancedTurn ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>{showAdvancedTurn ? "Gelişmiş TURN Ayarlarını Gizle" : "Gelişmiş TURN Ayarlarını Göster"}</span>
                </button>

                {showAdvancedTurn && (
                  <div className="grid grid-cols-1 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={config.turn_server}
                      onChange={(e) => setConfig((p) => ({ ...p, turn_server: e.target.value }))}
                      placeholder="Özel TURN Sunucusu (Boşsa Merkez IP:3478)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={config.turn_username}
                        onChange={(e) => setConfig((p) => ({ ...p, turn_username: e.target.value }))}
                        placeholder="TURN Kullanıcı"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                      />
                      <input
                        type="password"
                        disabled={!canWrite}
                        value={config.turn_password}
                        onChange={(e) => setConfig((p) => ({ ...p, turn_password: e.target.value }))}
                        placeholder="TURN Parola"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Central SSH Status Row */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Terminal size={14} className={text} />
                  <span>Merkez Sunucu SSH Kontrolü</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  SSH erişimi <code className="font-mono">panel.nornia.com.tr</code> üzerinden yönetilir.
                </p>
              </div>
              {config.remote_ssh_enabled || config.emergency_ssh_override ? (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
                  <Unlock size={12} />
                  <span>SSH AÇIK</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
                  <Lock size={12} />
                  <span>KAPALI</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
