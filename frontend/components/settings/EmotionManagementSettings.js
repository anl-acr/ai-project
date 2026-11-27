import React, { useState, useEffect, useId } from "react";
import { Heart, Save, CheckCircle, HelpCircle, Volume2, BellRing, Sliders } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function EmotionManagementSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const aiEmotionSwitchId = useId();
  const acousticSwitchId = useId();
  const soundSwitchId = useId();
  const deltaSliderId = useId();
  const peakSliderId = useId();
  const durSliderId = useId();

  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") : null;
    const tenantId = typeof window !== "undefined" ? localStorage.getItem("selected_tenant_id") || "tenant-default" : "tenant-default";
    const headers = { "X-Tenant-ID": tenantId };
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`${API_BASE}/api/settings/pbx`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setSettings({
            ...data,
            acoustic_shout_enabled: data.acoustic_shout_enabled !== undefined ? Boolean(data.acoustic_shout_enabled) : true,
            acoustic_delta_db: Number(data.acoustic_delta_db ?? 12),
            acoustic_min_peak_dbfs: Number(data.acoustic_min_peak_dbfs ?? -14),
            acoustic_min_duration_sec: Number(data.acoustic_min_duration_sec ?? 2),
            acoustic_alert_sound: data.acoustic_alert_sound !== undefined ? Boolean(data.acoustic_alert_sound) : true,
          });
        }
      })
      .catch((err) => console.error("[EmotionSettings] Load error:", err));
  }, [API_BASE]);

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    setSuccess(false);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") : null;
      const tenantId = typeof window !== "undefined" ? localStorage.getItem("selected_tenant_id") || "tenant-default" : "tenant-default";
      const headers = { "Content-Type": "application/json", "X-Tenant-ID": tenantId };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/settings/pbx`, {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[EmotionSettings] Save error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 font-bold animate-pulse">
        Ayarlar yükleniyor...
      </div>
    );
  }

  const deltaDb = Number(settings.acoustic_delta_db ?? 12);
  const minPeakDbfs = Number(settings.acoustic_min_peak_dbfs ?? -14);
  const minDurSec = Number(settings.acoustic_min_duration_sec ?? 2);

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className={`p-3 ${lightBg} ${text} border ${borderLight} rounded-2xl`}>
          <Heart size={22} className="fill-current" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
            Dinamik Duygu Yönetimi &amp; Akustik Bağırma Tespiti
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            AI asistan ton yönetimini ve insan temsilci çağrılarında canlı müşteri ses şiddeti / bağırma alarmlarını yapılandırın.
          </p>
        </div>
      </div>

      {/* 1. Live Customer Acoustic Shout Detection Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-2xl ${lightBg} ${text} border ${borderLight} shrink-0 mt-0.5`}>
              <Volume2 size={18} />
            </div>
            <div className="space-y-1">
              <label htmlFor={acousticSwitchId} className="text-xs font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer block">
                Canlı Müşteri Bağırma &amp; Ses Şiddeti Tespiti (Sadece Müşteri Kanalı)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Aktif çağrılarda müşterinin ses kanalı anlık analiz edilir. Müşteri temsilciye bağırdığında, temsilcinin bağlı olduğu kuyruğun yöneticilerine anında canlı popup + bildirim gönderilir ve çağrı Duygu Analizi raporuna işlenir.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              id={acousticSwitchId}
              type="checkbox"
              role="switch"
              {...{ switch: "" }}
              checked={Boolean(settings.acoustic_shout_enabled)}
              onChange={(e) => setSettings((prev) => ({ ...prev, acoustic_shout_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <span
              className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                settings.acoustic_shout_enabled ? bg : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  settings.acoustic_shout_enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </label>
        </div>

        {settings.acoustic_shout_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Delta dB Slider */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={deltaSliderId} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders size={12} className={text} />
                  <span>Ses Yükseliş Eşiği</span>
                </label>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${lightBg} ${text}`}>
                  +{deltaDb} dB
                </span>
              </div>
              <input
                id={deltaSliderId}
                type="range"
                min={6}
                max={22}
                step={1}
                value={deltaDb}
                aria-valuetext={`Normal konuşma tabanının ${deltaDb} desibel üstü`}
                onChange={(e) => setSettings((prev) => ({ ...prev, acoustic_delta_db: Number(e.target.value) }))}
                className="w-full h-2 rounded-lg cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Müşterinin kendi normal konuşma tabanına göre kaç dB artış bağırma sayılsın. (Önerilen: +12 dB)
              </p>
            </div>

            {/* Absolute Floor dBFS Slider */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={peakSliderId} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Volume2 size={12} className={text} />
                  <span>Min. Ses Şiddeti</span>
                </label>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${lightBg} ${text}`}>
                  {minPeakDbfs} dBFS
                </span>
              </div>
              <input
                id={peakSliderId}
                type="range"
                min={-24}
                max={-6}
                step={1}
                value={minPeakDbfs}
                aria-valuetext={`Minimum ${minPeakDbfs} dBFS ses seviyesi`}
                onChange={(e) => setSettings((prev) => ({ ...prev, acoustic_min_peak_dbfs: Number(e.target.value) }))}
                className="w-full h-2 rounded-lg cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Sessiz ortamlarda fısıltıdan normal sese geçişin yanlış alarm üretmesini engeller. (Önerilen: -14 dBFS)
              </p>
            </div>

            {/* Minimum Duration Slider */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={durSliderId} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BellRing size={12} className={text} />
                  <span>Min. Bağırma Süresi</span>
                </label>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${lightBg} ${text}`}>
                  {minDurSec} sn
                </span>
              </div>
              <input
                id={durSliderId}
                type="range"
                min={1}
                max={6}
                step={1}
                value={minDurSec}
                aria-valuetext={`En az ${minDurSec} saniye ardışık bağırma`}
                onChange={(e) => setSettings((prev) => ({ ...prev, acoustic_min_duration_sec: Number(e.target.value) }))}
                className="w-full h-2 rounded-lg cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                Öksürük veya anlık darbe gürültülerini elemek için gereken ardışık süre. (Önerilen: 2 sn)
              </p>
            </div>
          </div>
        )}

        {settings.acoustic_shout_enabled && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800">
            <div>
              <label htmlFor={soundSwitchId} className="text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer block">
                Süpervizör Ekranında Uyarı Sesi Çal
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Canlı bağırma popup&apos;ı açıldığında kuyruk yöneticisine kısa bir sesli uyarı verir.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id={soundSwitchId}
                type="checkbox"
                role="switch"
                {...{ switch: "" }}
                checked={Boolean(settings.acoustic_alert_sound)}
                onChange={(e) => setSettings((prev) => ({ ...prev, acoustic_alert_sound: e.target.checked }))}
                className="sr-only peer"
              />
              <span
                className={`w-10 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                  settings.acoustic_alert_sound ? bg : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    settings.acoustic_alert_sound ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </label>
          </div>
        )}

        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-2xl text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed flex gap-2.5 font-semibold">
          <HelpCircle size={16} className={`${text} shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-200">Kuyruk Yöneticisi Bildirim Kuralı</p>
            <p>
              Bildirimler yalnızca ilgili temsilcinin üye olduğu kuyruğun <span className={`font-bold ${text}`}>Kuyruk Yöneticileri</span> listesinde seçili süpervizörlere (ve sistem yöneticisine) anlık canlı popup ve bildirim zili üzerinden iletilir. Çağrı tamamlandığında bağırma sayısı, süresi ve saniye damgaları Duygu Analizi raporuna otomatik kaydedilir.
            </p>
          </div>
        </div>
      </div>

      {/* 2. AI Assistant Dynamic Emotion Switch Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <label htmlFor={aiEmotionSwitchId} className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer block">
              AI Sesli Asistan Dinamik Duygu Yönetimi
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Açık olduğunda, yapay zeka sesli asistan arayan müşterinin gergin/sinirli olduğunu saptarsa otomatik olarak sakinleştirici tona geçer ve sakinleşmeyen çağrıları yetkiliye aktarır.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              id={aiEmotionSwitchId}
              type="checkbox"
              role="switch"
              {...{ switch: "" }}
              checked={Boolean(settings.auto_emotion_management)}
              onChange={(e) => setSettings((prev) => ({ ...prev, auto_emotion_management: e.target.checked }))}
              className="sr-only peer"
            />
            <span
              className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                settings.auto_emotion_management ? bg : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  settings.auto_emotion_management ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </label>
        </div>

        {/* Action Button Row */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            {success && (
              <span className={`text-[11px] ${text} font-bold flex items-center gap-1.5`}>
                <CheckCircle size={14} /> Değişiklikler Kaydedildi!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition uppercase tracking-wider cursor-pointer disabled:opacity-60`}
          >
            <Save size={14} /> {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
