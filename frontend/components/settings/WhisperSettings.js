import React, { useState, useEffect } from "react";
import { Bot, Save, CheckCircle, HelpCircle } from "lucide-react";

export default function WhisperSettings({ backendHost = "localhost:8000" }) {
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
      .catch((err) => console.error("[WhisperSettings] Load error:", err));
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
      console.error("[WhisperSettings] Save error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-550 font-bold animate-pulse">
        Ayarlar yükleniyor...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full animate-in fade-in duration-200">
      
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="p-3 bg-amber-50 dark:bg-primary/20 text-primary dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
          <Bot size={22} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">AI Fısıldama Yönetimi (Whispering)</h3>
          <p className="text-[11px] text-slate-505 dark:text-slate-400 font-medium mt-0.5">
            Süpervizörlerin canlı çağrı sırasında yapay zeka asistanına anlık direktif iletebilmesini yönetin.
          </p>
        </div>
      </div>

      {/* Main Switch Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5 transition-colors duration-300">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1 text-left">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">AI Fısıldama Servisi Durumu</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Bu özellik açık olduğunda, yetkili süpervizörler ve şefler canlı izleme panelinden yapay zeka asistanının prompt bağlamına anlık müdahalede bulunabilir.
            </p>
          </div>

          {/* Premium Switch Control */}
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, auto_whisper_enabled: !prev.auto_whisper_enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-250 focus:outline-none shrink-0 ${
              settings.auto_whisper_enabled ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250 ${
                settings.auto_whisper_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Feature Explanation Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-2xl text-[10px] text-slate-505 dark:text-slate-400 leading-relaxed flex gap-2.5 font-semibold text-left">
          <HelpCircle size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-slate-800 dark:text-slate-350">Nasıl Çalışır?</p>
            <p>
              Süpervizör canlı izleme panelinden görüşmeyi dinlerken AI asistanına anlık direktifler yazıp fısıldayabilir (Örn: "Müşteriye %10 indirim teklif et", "Fiyatı doğrula"). Bu direktifler Gemini Live oturumuna arka planda anında enjekte edilerek yapay zekanın davranışı gerçek zamanlı değiştirilir. Fısıltılar veritabanında saklanır ve çağrı dökümünde altın renkli fısıltı kartları olarak gösterilir.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-850">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-550 hover:bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/10 transition disabled:opacity-50"
          >
            <Save size={13} />
            <span>{loading ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
          </button>

          {success && (
            <div className="flex items-center gap-1.5 text-primary dark:text-emerald-450 text-[10px] font-bold">
              <CheckCircle size={12} />
              <span>AI fısıldama ayarları kaydedildi.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
