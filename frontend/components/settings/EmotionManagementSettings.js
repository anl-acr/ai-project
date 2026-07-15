import React, { useState, useEffect } from "react";
import { Heart, Save, CheckCircle, HelpCircle } from "lucide-react";

export default function EmotionManagementSettings({ backendHost = "localhost:8000" }) {
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
      .catch((err) => console.error("[EmotionSettings] Load error:", err));
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

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full animate-in fade-in duration-200">
      
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="p-3 bg-rose-50 dark:bg-primary/20 text-primary dark:text-rose-455 border border-rose-100 dark:border-rose-900/40 rounded-2xl">
          <Heart size={22} className="fill-rose-500 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Dinamik Duygu Yönetimi</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Müşterinin öfke/gerginlik durumunu tespit ederek asistanın konuşma tonunu yumuşatın ve gerektiğinde otomatik aktarın.
          </p>
        </div>
      </div>

      {/* Main Switch Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Dinamik Duygu Yönetimi Durumu</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Bu özellik açık olduğunda, arayan müşterinin gergin/sinirli olduğu saptanırsa asistan otomatik olarak sakinleştirici ses profili/tonuna geçer ve sakinleşmeyen çağrıları yetkiliye aktarır.
            </p>
          </div>

          {/* Premium Switch Control */}
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, auto_emotion_management: !prev.auto_emotion_management }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-250 focus:outline-none shrink-0 ${
              settings.auto_emotion_management ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250 ${
                settings.auto_emotion_management ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Feature Explanation Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-2xl text-[10px] text-slate-505 dark:text-slate-400 leading-relaxed flex gap-2.5 font-semibold">
          <HelpCircle size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-slate-800 dark:text-slate-350">Nasıl Çalışır?</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Müşterinin şikayetçi, agresif veya sinirli konuşma tonları/kelimeleri asenkron analiz edilir.</li>
              <li>Asistan ses hızı ve tınısını (pitch) düşürerek sakin ve özür dileyen profesyonel bir tarza bürünür.</li>
              <li>Müşteri sakinleştirilemez ve sinirli tavrını sürdürürse asistan <span className="font-bold text-primary dark:text-indigo-400">"Sizi üst birime aktarıyorum"</span> diyerek çağrıyı ilgili AI Agent'ın ayarlarında belirlenen aktarım hedefine yönlendirir.</li>
            </ul>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            {success && (
              <span className="text-[10px] text-primary dark:text-emerald-450 font-bold flex items-center gap-1.5">
                <CheckCircle size={13} /> Değişiklikler Kaydedildi!
              </span>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition uppercase tracking-wider"
          >
            <Save size={14} /> {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </div>

    </div>
  );
}
