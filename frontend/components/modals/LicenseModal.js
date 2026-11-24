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
  const [sysSnCopied, setSysSnCopied] = useState(false);
  const [tenantSnCopied, setTenantSnCopied] = useState(false);

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

  const handleCopySysSn = () => {
    if (licenseStatus?.system_serial_number) {
      navigator.clipboard.writeText(licenseStatus.system_serial_number);
      setSysSnCopied(true);
      setTimeout(() => setSysSnCopied(false), 2000);
    }
  };

  const handleCopyTenantSn = () => {
    const tSn = licenseStatus?.tenant_serial_number || licenseStatus?.serial_number;
    if (tSn) {
      navigator.clipboard.writeText(tSn);
      setTenantSnCopied(true);
      setTimeout(() => setTenantSnCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const isExpired = Boolean(licenseStatus && (licenseStatus.hard_expired || (!licenseStatus.valid && !licenseStatus.in_grace_period)));
  const isInGrace = Boolean(licenseStatus && !isExpired && licenseStatus.in_grace_period);
  const emNumbersText = Array.isArray(licenseStatus?.emergency_numbers) && licenseStatus.emergency_numbers.length > 0
    ? licenseStatus.emergency_numbers.join(", ")
    : "112, 110, 155";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all scale-100 text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className={`px-5 py-3.5 shrink-0 border-b ${isExpired ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800"} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`relative flex items-center justify-center w-10 h-10 shrink-0 rounded-2xl ${isExpired ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"}`}>
              {isExpired ? (
                <>
                  <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
                  <ShieldAlert size={22} className="relative z-10" />
                </>
              ) : (
                <ShieldCheck size={22} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                Sistem Lisans Yönetimi
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {licenseStatus?.tenant_name || "RUNA Santral & AI Paneli"}
              </p>
            </div>
          </div>

          {!isExpired && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
          
          {/* Status Box */}
          <div className={`p-3.5 rounded-2xl border ${
            isExpired
              ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
              : isInGrace
                ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
                : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
          }`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-75 mb-0.5 flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Lisans Durumu</span>
                </div>
                <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                  {isExpired ? (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="shrink-0" /> Lisans Süresi Doldu veya İmzası Geçersiz
                    </span>
                  ) : isInGrace ? (
                    <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="shrink-0" /> Ek Süre (Grace Period) Devrede
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check size={15} className="shrink-0" /> Lisansınız Aktif ve Geçerli
                    </span>
                  )}
                </div>
              </div>

              {licenseStatus && (
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold opacity-75">{isInGrace ? "Ek Süre Bitiş" : "Bitiş Tarihi"}</div>
                  <div className="text-xs font-mono font-extrabold">
                    {isInGrace
                      ? (licenseStatus.license_grace_until || "-")
                      : licenseStatus.is_unlimited
                        ? "♾️ Limitsiz Süresiz"
                        : (licenseStatus.license_expires_at || "Belirtilmedi")}
                  </div>
                  {isInGrace ? (
                    <div className="text-[10.5px] font-bold mt-0.5 opacity-90">
                      ({Number(licenseStatus.grace_days_left || 0) <= 0 ? "Bugün doluyor" : `${licenseStatus.grace_days_left} gün ek süre`})
                    </div>
                  ) : licenseStatus.days_left !== null && licenseStatus.days_left !== undefined && !licenseStatus.is_unlimited && (
                    <div className="text-[10.5px] font-bold mt-0.5 opacity-90">
                      ({licenseStatus.days_left <= 0 ? "Bugün doluyor" : `${licenseStatus.days_left} gün kaldı`})
                    </div>
                  )}
                </div>
              )}
            </div>

            {isInGrace && (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300 border-t border-amber-200/60 dark:border-amber-900/40 pt-2 font-medium">
                ⏳ Ana lisans süreniz ({licenseStatus.license_expires_at}) dolmuştur; tanımlı ek süre ({licenseStatus.license_grace_until}) boyunca santraliniz kesintisiz çalışmaya devam edecektir. Kesinti yaşamamak için ek süre dolmadan lisansınızı yenileyiniz.
              </p>
            )}

            {isExpired && (
              <div className="mt-2.5 text-[11.5px] leading-relaxed text-rose-700 dark:text-rose-300 border-t border-rose-200/60 dark:border-rose-900/40 pt-2 font-medium space-y-1.5">
                {licenseStatus?.reason && (
                  <p className="font-bold text-rose-800 dark:text-rose-200">
                    Sebep: {licenseStatus.reason}
                  </p>
                )}
                <p>
                  ⚠️ Lisans doğrulaması aktif olmadığı için Web Paneli, dışarıdan gelen çağrılar, Omnichannel (WhatsApp/Sosyal Medya/E-Posta), Yapay Zeka sesli asistan, Auto-Dialer ve normal aramalar durdurulmuştur. Masa telefonları aktif olup yalnızca sistemde tanımlı acil durum numaralarını ({emNumbersText}) arayabilir. Devam etmek için geçerli Lisans Anahtarı giriniz.
                </p>
              </div>
            )}
          </div>

          {/* Sistem Seri No, Tenant Seri No & Donanım Kimliği */}
          {licenseStatus && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider">Sistem Seri No</div>
                    <div className="text-[11px] font-mono font-extrabold text-slate-800 dark:text-slate-200 truncate">
                      {licenseStatus.system_serial_number || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySysSn}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      sysSnCopied
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {sysSnCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider">
                      Tenant Seri No ({licenseStatus.tenant_code || "default"})
                    </div>
                    <div className={`text-[11px] font-mono font-extrabold ${text} truncate`}>
                      {licenseStatus.tenant_serial_number || licenseStatus.serial_number || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTenantSn}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      tenantSnCopied
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tenantSnCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>

              {licenseStatus.server_hardware_id && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider">Sunucu Donanım Kimliği (Machine Fingerprint)</div>
                    <div className="text-xs font-mono font-extrabold text-slate-800 dark:text-slate-200">
                      {licenseStatus.server_hardware_id}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyHwId}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
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

                {/* Eş Zamanlı Çağrı Kanalı Kotası */}
                {(() => {
                  const used = licenseStatus.usage.used_concurrent_calls ?? licenseStatus.usage.used_channels ?? 0;
                  const max = licenseStatus.max_concurrent_calls ?? licenseStatus.limits.max_concurrent_calls ?? licenseStatus.limits.channels ?? 4;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1" title="AI + Otomatik Arama + Kullanıcı Çağrı Kanalı"><PhoneCall size={13} className="text-blue-500" /> Eş Zamanlı Kanal</span>
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

              {/* Read-only Lisanslı AI Sağlayıcıları (STT / TTS / LLM) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Lisanslı AI Motorları (STT / TTS / LLM)</span>
                  <span className="text-[9px] text-slate-400">Salt Okunur</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">STT</div>
                    <div className="flex flex-wrap gap-1">
                      {(licenseStatus.allowed_stt_providers || licenseStatus.limits?.allowed_stt_providers || ["google", "deepgram", "openai", "elevenlabs"]).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">TTS</div>
                    <div className="flex flex-wrap gap-1">
                      {(licenseStatus.allowed_tts_providers || licenseStatus.limits?.allowed_tts_providers || ["google", "elevenlabs", "openai"]).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">LLM</div>
                    <div className="flex flex-wrap gap-1">
                      {(licenseStatus.allowed_llm_providers || licenseStatus.limits?.allowed_llm_providers || ["google", "elevenlabs", "openai", "anthropic", "groq"]).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form id="license-renew-form" onSubmit={handleRenew} className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Key size={14} className="text-slate-400 shrink-0" />
                  <span>Kriptografik Lisans Anahtarı (Key)</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipText = await navigator.clipboard.readText();
                        if (clipText) setInputKey(clipText.trim());
                      } catch(e){}
                    }}
                    className={"text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 " + lightBg + " " + text + " " + borderLight}
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
                className={"w-full text-[11px] font-mono font-extrabold px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans resize-none break-all " + ring}
              />
              <p className="mt-1 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                Lisans anahtarı HMAC-SHA256 imzası ve Donanım ID doğrulaması ile korunmaktadır.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Check size={15} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-end gap-3">
          {!isExpired && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Kapat
            </button>
          )}

          <button
            type="submit"
            form="license-renew-form"
            disabled={loading}
            className={"px-5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 " + bg + " " + hover}
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
      </div>
    </div>
  );
}
