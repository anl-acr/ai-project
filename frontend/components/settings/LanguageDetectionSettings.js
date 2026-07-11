import React, { useState, useEffect } from "react";
import { Languages, Save, CheckCircle, HelpCircle } from "lucide-react";

export default function LanguageDetectionSettings({ backendHost = "localhost:8000" }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    // Load existing PBX settings to preserve other keys
    fetch(`${API_BASE}/api/settings/pbx`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => console.error("[LangDetect] Load error:", err));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/pbx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[LangDetect] Save error:", err);
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

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 max-w-2xl w-full animate-in fade-in duration-200">
      
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="p-3 bg-rose-50 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 rounded-2xl">
          <Languages size={22} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Otomatik Dil Algılama (Language Detection)</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Arayan müşterinin konuşma dilini yakalayarak yapay zekayı anında o dile adapte edin.
          </p>
        </div>
      </div>

      {/* Main Switch Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Dil Algılama Servisi Durumu</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Bu özellik açık olduğunda, arayan müşterinin ilk cümlesi Türkçe veya İngilizce olarak otomatik tespit edilir ve yapay zeka temsilcisi konuşmayı o dilde sürdürür.
            </p>
          </div>

          {/* Premium Switch Control */}
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, auto_language_detection: !prev.auto_language_detection }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-250 focus:outline-none shrink-0 ${
              settings.auto_language_detection ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250 ${
                settings.auto_language_detection ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Feature Explanation Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-2xl text-[10px] text-slate-505 dark:text-slate-400 leading-relaxed flex gap-2.5 font-semibold">
          <HelpCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-slate-800 dark:text-slate-350">Nasıl Çalışır?</p>
            <p>
              Müşteri çağrıya cevap verdiğinde sistem kelime dağılımlarını ve ses tonlamalarını takip eder. İngilizce bir ifade (Örn: "Hello, good morning", "representative please") algılandığında Gemini Live ses motoruna anlık direktif enjekte edilir. Asistan hiçbir kesinti veya gecikme yaşanmadan konuşmasını İngilizce ses tonuyla devam ettirir.
            </p>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            {success && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold flex items-center gap-1.5">
                <CheckCircle size={13} /> Değişiklikler Kaydedildi!
              </span>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition uppercase tracking-wider"
          >
            <Save size={14} /> {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </div>

    </div>
  );
}
