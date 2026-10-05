import React, { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert, Key, Clock, Check, AlertTriangle, RefreshCw, Copy, Activity, User, PhoneCall, Cpu, Building2, HardDrive } from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function LicenseSettingsPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [inputKey, setInputKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [hwCopied, setHwCopied] = useState(false);

  const API_BASE = getApiBaseUrl(backendHost);

  useEffect(() => {
    fetchLicenseStatus();
  }, [backendHost]);

  const fetchLicenseStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/license/status`);
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
        if (data.license_key) {
          setInputKey(data.license_key);
        }
      }
    } catch (e) {
      console.error("Failed to load license status:", e);
    }
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg("Lütfen bir lisans anahtarı giriniz.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const activeTenantId = licenseStatus?.tenant_id || "tenant-default";
      const res = await fetch(`${API_BASE}/api/tenant/license/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: activeTenantId,
          license_key: inputKey.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Lisans doğrulama başarısız oldu.");
      }

      setSuccessMsg(data.message || "Lisansınız başarıyla yenilendi ve kotalar güncellendi!");
      fetchLicenseStatus();
    } catch (err) {
      setErrorMsg(err.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (licenseStatus?.license_key) {
      navigator.clipboard.writeText(licenseStatus.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyHwId = () => {
    if (licenseStatus?.server_hardware_id) {
      navigator.clipboard.writeText(licenseStatus.server_hardware_id);
      setHwCopied(true);
      setTimeout(() => setHwCopied(false), 2000);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setInputKey(clipText.trim());
    } catch (e) {
      console.error("Clipboard paste error:", e);
    }
  };

  const isExpired = licenseStatus && (!licenseStatus.valid || licenseStatus.status === "passive");

  return (
    <div className="w-full space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${isExpired ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"}`}>
              {isExpired ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Sistem Lisans & Donanım Yönetimi
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Lisans anahtarı doğrulama, süre uzatma ve donanım kimliği kontrol alanı
              </p>
            </div>
          </div>

          {licenseStatus && (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${isExpired ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-200" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200"}`}>
                {isExpired ? "⚠️ Lisans Pasif / Süresi Doldu" : "✅ Lisans Aktif & Geçerli"}
              </span>
            </div>
          )}
        </div>

        {/* Server Hardware ID Card */}
        {licenseStatus?.server_hardware_id && (
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                Sunucu Donanım Kimliği (Machine Fingerprint)
              </div>
              <div className="text-sm font-mono font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                {licenseStatus.server_hardware_id}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyHwId}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                hwCopied 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                  : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {hwCopied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span>Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Donanım ID Kopyala</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main License Key Input Box (Always Visible) */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-rose-500" />
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Lisans Anahtarı Yükle / Güncelle (Offline & Online Key)
            </h4>
          </div>

          <button
            type="button"
            onClick={handlePasteClipboard}
            className="text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>📋 Panodan Yapıştır</span>
          </button>
        </div>

        <form onSubmit={handleRenew} className="space-y-4">
          <div>
            <textarea
              rows={4}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Lisans sunucusundan kopyaladığınız AIDA-... ile başlayan imzalı lisans anahtarını buraya yapıştırınız..."
              className="w-full text-xs font-mono font-extrabold p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans resize-none"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              🔑 Üretilen anahtar HMAC-SHA256 imzası ve makine donanım kilit sistemi ile korunur. Key uygulandığında kotalar anında güncellenir.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {licenseStatus?.license_key ? (
              <button
                type="button"
                onClick={handleCopyKey}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Copy size={14} />
                <span>{copied ? "Kopyalandı!" : "Mevcut Key'i Kopyala"}</span>
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={loading}
              className={"px-6 py-3 rounded-2xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 " + bg + " " + hover}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Lisansı Doğrula & Kotaları Güncelle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Usage Metrics */}
      {licenseStatus?.limits && licenseStatus?.usage && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
              <Activity size={16} className="text-rose-500" />
              <span>Canlı Kullanım & Lisans Kotaları</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {licenseStatus.plan_label || "Professional Paket"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Temsilci Kotası */}
            {(() => {
              const used = licenseStatus.usage.used_users || 0;
              const max = licenseStatus.limits.max_users || 1;
              const pct = Math.min(100, Math.round((used / max) * 100));
              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><User size={14} className="text-rose-500" /> Temsilci Kotası</span>
                    <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 text-right">%{pct} Kullanıldı</div>
                </div>
              );
            })()}

            {/* SIP Kanal Kotası */}
            {(() => {
              const used = licenseStatus.usage.used_channels || 0;
              const max = licenseStatus.limits.max_channels || 1;
              const pct = Math.min(100, Math.round((used / max) * 100));
              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><PhoneCall size={14} className="text-blue-500" /> SIP Çağrı Kanalı</span>
                    <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 text-right">%{pct} Kullanıldı</div>
                </div>
              );
            })()}

            {/* AI Asistan Slotu */}
            {(() => {
              const used = licenseStatus.usage.used_ai_agents || 0;
              const max = licenseStatus.limits.max_ai_agents || 1;
              const pct = Math.min(100, Math.round((used / max) * 100));
              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><Cpu size={14} className="text-purple-500" /> AI Asistan Slotu</span>
                    <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-purple-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 text-right">%{pct} Kullanıldı</div>
                </div>
              );
            })()}

            {/* Tenant Kotası */}
            {(() => {
              const used = licenseStatus.usage.used_tenants || 0;
              const max = licenseStatus.limits.max_tenants || 1;
              const pct = Math.min(100, Math.round((used / max) * 100));
              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><Building2 size={14} className="text-amber-500" /> Tenant Kotası</span>
                    <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 text-right">%{pct} Kullanıldı</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
