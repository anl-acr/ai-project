import React, { useState, useEffect } from "react";
import { Save, CheckCircle, HelpCircle, Shuffle, Clock, Repeat, BarChart2 } from "lucide-react";

const InfoTooltip = ({ text }) => {
  return (
    <div className="group relative inline-block ml-1 cursor-help text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
      <HelpCircle size={12} className="inline-block align-middle" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950/95 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-xl shadow-2xl text-[10px] text-slate-200 dark:text-slate-300 font-semibold normal-case leading-relaxed text-center z-50 transition-all duration-200">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-950/95 dark:border-t-slate-900"></div>
      </div>
    </div>
  );
};

export default function SmartCallbackSettings({ backendHost = "localhost:8000" }) {
  const [config, setConfig] = useState({
    enabled: true,
    max_wait_seconds: 60,
    max_retries: 3,
    priority_level: "high",
    outbound_trunk_id: 1,
    queue_threshold: 3
  });

  const [trunks, setTrunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    // Fetch smart callback config
    fetch(`${API_BASE}/api/settings/smart-callback`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch((err) => console.error("[SmartCallback] Hata:", err));

    // Fetch trunks list for dropdown selection
    fetch(`${API_BASE}/api/settings/trunks`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTrunks(data);
      })
      .catch((err) => console.error("[SmartCallback] Trunks listelenemedi:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) || 0 : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/smart-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[SmartCallback] Kaydetme hatasi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 text-slate-800 dark:text-slate-100 max-w-4xl w-full">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-500 dark:text-indigo-455 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
          <Shuffle size={24} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Çift Taraflı Akıllı Geri Arama (Smart Callback)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Temsilciler meşgul olduğunda, yapay zekanın müşteriye geri arama teklif etmesini ve temsilci boşa çıktığında aramayı otomatik başlatmasını yönetin.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Controls Card */}
          <div className="lg:col-span-2 flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl p-6 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Shuffle size={16} className="text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Geri Arama Kuralları</h3>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Geri Arama Modülü Durumu</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Temsilciler meşgul olduğunda devreye girer.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={config.enabled}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} className="text-indigo-500" />
                  Eşik Bekleme Süresi (Saniye)
                  <InfoTooltip text="Müşterinin kuyrukta tahmini bekleme süresi bu değeri aşarsa geri arama teklif edilir." />
                </label>
                <input
                  type="number"
                  name="max_wait_seconds"
                  value={config.max_wait_seconds}
                  onChange={handleChange}
                  disabled={!config.enabled}
                  required
                  min="5"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <BarChart2 size={12} className="text-indigo-500" />
                  Eşik Kuyruk Boyutu (Kişi)
                  <InfoTooltip text="Kuyrukta bekleyen aktif müşteri sayısı bu sınıra ulaştığında geri arama teklif edilir." />
                </label>
                <input
                  type="number"
                  name="queue_threshold"
                  value={config.queue_threshold}
                  onChange={handleChange}
                  disabled={!config.enabled}
                  required
                  min="1"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Repeat size={12} className="text-indigo-500" />
                  Maksimum Deneme Sayısı
                  <InfoTooltip text="Geri arama sırasında müşteri çağrıya cevap vermezse sistemin en fazla kaç defa tekrar arayacağını belirtir." />
                </label>
                <input
                  type="number"
                  name="max_retries"
                  value={config.max_retries}
                  onChange={handleChange}
                  disabled={!config.enabled}
                  required
                  min="1"
                  max="10"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  Kuyruk Öncelik Derecesi
                  <InfoTooltip text="Geri aranan müşteri cevap verip temsilciye aktarılırken kuyrukta hangi öncelikle sıralanacağını belirler." />
                </label>
                <select
                  name="priority_level"
                  value={config.priority_level}
                  onChange={handleChange}
                  disabled={!config.enabled}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="high">Yüksek (Temsilciye ilk olarak iletilir)</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                Geri Arama İçin Kullanılacak Dış Hat
                <InfoTooltip text="Geri arama çağrısının sistemden başlatılacağı operatör trunk hattını seçin." />
              </label>
              <select
                name="outbound_trunk_id"
                value={config.outbound_trunk_id}
                onChange={handleChange}
                disabled={!config.enabled}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {trunks.length === 0 ? (
                  <option value="1">Varsayılan Hat</option>
                ) : (
                  trunks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trunk_name} ({t.did_number})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/10 transition duration-200"
            >
              <Save size={14} /> {loading ? "Kaydediliyor..." : "Geri Arama Ayarlarını Kaydet"}
            </button>

            {saveSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-350 text-[10px] flex items-center gap-1.5 font-semibold">
                <CheckCircle size={12} />
                <span>Geri Arama (Smart Callback) ayarları güncellendi.</span>
              </div>
            )}
          </div>

          {/* Info Card / Explainer (1/3 wide) */}
          <div className="flex flex-col gap-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HelpCircle size={14} className="text-indigo-500" />
              Nasıl Çalışır?
            </h4>
            <div className="space-y-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <div className="flex gap-2">
                <span className="font-extrabold text-indigo-500">1.</span>
                <p>
                  Müşteri aradığında, tahmini bekleme süresi veya sıradaki kişi sayısı belirlediğiniz eşik değerlerini aşarsa, AI sesli asistanı geri arama teklif eder.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="font-extrabold text-indigo-500">2.</span>
                <p>
                  Müşteri onay verip telefonu kapattığında, arama kuyruğu sistemde pasif şekilde sırasını korumaya devam eder.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="font-extrabold text-indigo-500">3.</span>
                <p>
                  Sıra müşteriye geldiğinde ve uygun bir temsilci boşta (Available) kaldığında, sistem önce otomatik olarak temsilcinin dahili hattını arar.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="font-extrabold text-indigo-500">4.</span>
                <p>
                  Temsilci aramayı yanıtladığı anda, sistem müşteriyi dış hattan geri arayarak iki hattı köprüler (Bridge).
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
