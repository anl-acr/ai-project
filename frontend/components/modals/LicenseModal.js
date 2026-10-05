import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Key, Calendar, Clock, Check, AlertTriangle, RefreshCw, X, Copy, Activity, User, PhoneCall, Cpu, Building2 } from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function LicenseModal({ isOpen, onClose, backendHost, onLicenseUpdated }) {
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
    if (isOpen) {
      fetchLicenseStatus();
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen, backendHost]);

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
      const apiUrl = API_BASE ? `${API_BASE}/api/tenant/license/renew` : "/api/tenant/license/renew";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: activeTenantId,
          license_key: inputKey.trim()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Lisans doğrulama başarısız oldu.");
      }

      setSuccessMsg(data.message || "Lisansınız başarıyla yenilendi ve aktifleştirildi!");
      fetchLicenseStatus();
      if (onLicenseUpdated) {
        onLicenseUpdated(data);
      }
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

  if (!isOpen) return null;

  const isExpired = licenseStatus && (!licenseStatus.valid || licenseStatus.status === "passive");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className={`p-6 border-b ${isExpired ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800"} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl ${isExpired ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"}`}>
              {isExpired ? (
                <>
                  <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
                  <ShieldAlert size={26} className="relative z-10" />
                </>
              ) : (
                <ShieldCheck size={26} />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Sistem Lisans Yönetimi
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {licenseStatus?.tenant_name || "AIDA Santral & AI Paneli"}
              </p>
            </div>
          </div>

          {!isExpired && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          
          {/* Status Box */}
          <div className={`p-4 rounded-2xl border ${isExpired ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200" : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-75 mb-1 flex items-center gap-1.5">
                  <Clock size={14} />
                  <span>Lisans Durumu</span>
                </div>
                <div className="text-sm font-extrabold flex items-center gap-2">
                  {isExpired ? (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle size={16} /> Lisans Süresi Doldu veya İmzası Geçersiz
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check size={16} /> Lisansınız Aktif ve Geçerli
                    </span>
                  )}
                </div>
              </div>

              {licenseStatus && (
                <div className="text-right">
                  <div className="text-xs font-bold opacity-75">Bitiş Tarihi</div>
                  <div className="text-xs font-mono font-extrabold">
                    {licenseStatus.is_unlimited ? "♾️ Limitsiz Süresiz" : (licenseStatus.license_expires_at || "Belirtilmedi")}
                  </div>
                  {licenseStatus.days_left !== null && licenseStatus.days_left !== undefined && (
                    <div className="text-[11px] font-bold mt-0.5 opacity-90">
                      ({licenseStatus.days_left} gün kaldı)
                    </div>
                  )}
                </div>
              )}
            </div>

            {isExpired && (
              <p className="mt-3 text-xs leading-relaxed text-rose-700 dark:text-rose-300 border-t border-rose-200/60 dark:border-rose-900/40 pt-2 font-medium">
                ⚠️ Sunucunuzdaki lisans süresi dolduğu için sesli yapay zeka ve santral arama servisleri durdurulmuştur. İşlemlere devam etmek için lütfen yeni Lisans Anahtarı giriniz.
              </p>
            )}
          </div>

          {/* Server Hardware ID Badge */}
          {licenseStatus?.server_hardware_id && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Sunucu Donanım Kimliği (Machine Fingerprint)</div>
                <div className="text-xs font-mono font-extrabold text-slate-800 dark:text-slate-200">
                  {licenseStatus.server_hardware_id}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyHwId}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  hwCopied 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {hwCopied ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span>Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Kopyala</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Lisans Kapasitesi & Canlı Kullanım Metrikleri */}
          {licenseStatus?.limits && licenseStatus?.usage && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-rose-500" />
                  <span>Lisans Kapasitesi & Canlı Kullanım</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {licenseStatus.plan_label || "Professional Paket"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Temsilci Kotası */}
                {(() => {
                  const used = licenseStatus.usage.used_users || 0;
                  const max = licenseStatus.limits.max_users || 1;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1"><User size={13} className="text-rose-500" /> Temsilci Kotası</span>
                        <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* SIP Kanal Kotası */}
                {(() => {
                  const used = licenseStatus.usage.used_channels || 0;
                  const max = licenseStatus.limits.max_channels || 1;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1"><PhoneCall size={13} className="text-blue-500" /> SIP Çağrı Kanalı</span>
                        <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* AI Asistan Slotu */}
                {(() => {
                  const used = licenseStatus.usage.used_ai_agents || 0;
                  const max = licenseStatus.limits.max_ai_agents || 1;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1"><Cpu size={13} className="text-purple-500" /> AI Asistan Slotu</span>
                        <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-purple-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Tenant / Şirket Kotası */}
                {(() => {
                  const used = licenseStatus.usage.used_tenants || 0;
                  const max = licenseStatus.limits.max_tenants || 1;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1"><Building2 size={13} className="text-amber-500" /> Tenant Kotası</span>
                        <span className="font-mono text-slate-900 dark:text-white font-extrabold">{used} / {max >= 999 ? "♾️" : max}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRenew} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key size={14} className="text-slate-400" />
                  <span>Kriptografik Lisans Anahtarı (Key)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setInputKey(text.trim());
                      } catch(e){}
                    }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>📋 Panodan Yapıştır</span>
                  </button>
                  {licenseStatus?.license_key && (
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>{copied ? "Kopyalandı!" : "Mevcut Key'i Kopyala"}</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={3}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Lisans sunucusundan kopyaladığınız AIDA-... ile başlayan imzalı lisans anahtarını buraya yapıştırınız..."
                className="w-full text-xs font-mono font-extrabold px-3.5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans resize-none"
              />
              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Lisans anahtarı HMAC-SHA256 imzası ve Donanım ID doğrulaması ile korunmaktadır.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Check size={15} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {!isExpired && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className={"px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 " + bg + " " + hover}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Doğrulanıyor...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Lisansı Doğrula & Aktifleştir</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
