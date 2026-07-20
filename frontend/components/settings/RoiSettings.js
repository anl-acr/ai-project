import React, { useState, useEffect } from "react";
import { Save, Loader2, TrendingUp, Users } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function RoiSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [humanCost, setHumanCost] = useState(30000);
  const [humanCount, setHumanCount] = useState(5);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/roi_settings`);
      const data = await res.json();
      setHumanCost(data.human_cost || 30000);
      setHumanCount(data.human_count || 5);
    } catch (err) {
      console.error("Failed to fetch ROI settings:", err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const payload = {
        human_cost: Number(humanCost),
        human_count: Number(humanCount)
      };
      
      const res = await fetch(`${protocol}//${backendHost}/api/settings/roi_settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save ROI settings:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
            <TrendingUp size={20} className="text-amber-500" />
            ROI Rapor Ayarları
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Yapay zeka (AI) vs İnsan Karşılaştırmalı ROI Paneli için temel maliyet ve personel parametrelerini buradan ayarlayabilirsiniz.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2.5 ${bg} ${hover} text-white rounded-xl font-bold transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{loading ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ROI Ayarları başarıyla güncellendi!
        </div>
      )}

      <div className={`p-6 rounded-2xl border ${borderLight} ${lightBg} flex flex-col gap-6`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col h-full gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${text}`}>
              Birim İnsan Maliyeti (Aylık ₺)
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Bir canlı destek uzmanının / müşteri temsilcisinin şirkete olan yaklaşık aylık toplam maliyeti.
            </p>
            <div className="relative mt-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
              <input
                type="number"
                value={humanCost}
                onChange={(e) => setHumanCost(e.target.value)}
                className={`w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border ${borderLight} rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                placeholder="Örn: 30000"
              />
            </div>
          </div>

          <div className="flex flex-col h-full gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${text}`}>
              İnsan (Temsilci) Sayısı
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Çağrı merkezindeki / operasyondaki toplam aktif canlı destek personeli sayısı.
            </p>
            <div className="relative mt-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Users size={16} />
              </span>
              <input
                type="number"
                value={humanCount}
                onChange={(e) => setHumanCount(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border ${borderLight} rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                placeholder="Örn: 5"
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
            💡 <strong>Not:</strong> Bu veriler "Çağrı Kalite Kontrol" ve "Gelişmiş Çağrı Raporları" sekmelerindeki ROI analiz ekranında, Yapay Zeka botlarının şirkete sağladığı insan kaynağı tasarrufunu (TL bazında) hesaplamak için kullanılır. Ayarları güncellediğinizde anlık raporlara anında yansır.
          </p>
        </div>
      </div>
    </div>
  );
}
