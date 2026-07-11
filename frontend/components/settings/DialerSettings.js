import React, { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Upload, 
  Settings, 
  Users, 
  Activity, 
  Save, 
  CheckCircle, 
  HelpCircle, 
  Clock, 
  Sliders, 
  PhoneCall, 
  ListFilter,
  FileText,
  AlertCircle,
  Plus
} from "lucide-react";

const InfoTooltip = ({ text }) => {
  return (
    <div className="group relative inline-block ml-1 cursor-help text-slate-400 dark:text-slate-550 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
      <HelpCircle size={12} className="inline-block align-middle" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950/95 dark:bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-[10px] text-slate-200 dark:text-slate-350 font-semibold normal-case leading-relaxed text-center z-50 transition-all duration-200">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-950/95 dark:border-t-slate-900"></div>
      </div>
    </div>
  );
};

export default function DialerSettings({ backendHost = "localhost:8000" }) {
  const [activeSubTab, setActiveSubTab] = useState("rules"); // rules, upload, monitor
  
  // Campaign & Rule Settings
  const [config, setConfig] = useState({
    enabled: false,
    dial_mode: "progressive",
    concurrent_calls: 5,
    retry_count: 3,
    retry_interval_minutes: 15,
    route_destination_type: "ai",
    route_destination: "Sales_AI",
    outbound_trunk_id: 1,
    allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allowed_hours_start: "09:00",
    allowed_hours_end: "18:00"
  });

  const [trunks, setTrunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Monitor & Upload States
  const [records, setRecords] = useState([]);
  const [dialerState, setDialerState] = useState({ status: "paused", current_calls: 0 });
  const [manualInput, setManualInput] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    // Fetch settings
    fetch(`${API_BASE}/api/settings/dialer`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch((err) => console.error("[Dialer] Konfigurasyon hatasi:", err));

    // Fetch trunks
    fetch(`${API_BASE}/api/settings/trunks`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTrunks(data);
      })
      .catch((err) => console.error("[Dialer] Trunks hatasi:", err));

    // Fetch records initially
    fetchRecords();
  }, []);

  // Poll records if dialer is running
  useEffect(() => {
    let timer;
    if (dialerState.status === "running") {
      timer = setInterval(() => {
        fetchRecords();
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [dialerState.status]);

  const fetchRecords = () => {
    fetch(`${API_BASE}/api/dialer/records`)
      .then((res) => res.json())
      .then((data) => {
        if (data.records) setRecords(data.records);
        if (data.state) setDialerState(data.state);
      })
      .catch((err) => console.error("[Dialer] Kayitlar yuklenemedi:", err));
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) || 0 : value
    }));
  };

  const handleDayToggle = (day) => {
    setConfig((prev) => {
      const days = [...prev.allowed_days];
      if (days.includes(day)) {
        return { ...prev, allowed_days: days.filter((d) => d !== day) };
      } else {
        return { ...prev, allowed_days: [...days, day] };
      }
    });
  };

  const handleConfigSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[Dialer] Hata:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualUpload = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/dialer/upload-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: manualInput })
      });
      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(true);
        setUploadMessage(data.message);
        setManualInput("");
        fetchRecords();
        setTimeout(() => setUploadSuccess(false), 4000);
      }
    } catch (err) {
      console.error("[Dialer] Liste eklenemedi:", err);
    }
  };

  const handleDialerAction = async (action) => {
    try {
      const res = await fetch(`${API_BASE}/api/dialer/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        setDialerState(data.state);
        fetchRecords();
      }
    } catch (err) {
      console.error("[Dialer] Kontrol hatasi:", err);
    }
  };

  // Stats calculation
  const totalRecords = records.length;
  const answeredRecords = records.filter((r) => r.status === "Answered").length;
  const pendingRecords = records.filter((r) => r.status === "Pending").length;
  const failedRecords = records.filter((r) => r.status === "Failed").length;
  const successRate = totalRecords > 0 ? Math.round((answeredRecords / totalRecords) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 max-w-5xl w-full">
      
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-450 border border-blue-105 dark:border-blue-900/40 rounded-2xl">
          <PhoneCall size={24} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Dış Arama Modülü (Outbound Dialer)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Otomatik dış arama kampanyaları düzenleyin, arama kurallarını kısıtlayın ve çağrı yanıtlandığında yapay zeka veya kuyruğa yönlendirin.
          </p>
        </div>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 pb-px">
        <button
          onClick={() => setActiveSubTab("rules")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all duration-200 border-b-2 ${
            activeSubTab === "rules"
              ? "border-blue-550 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sliders size={14} /> Arama Kuralları & Kampanya
        </button>
        <button
          onClick={() => setActiveSubTab("upload")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all duration-200 border-b-2 ${
            activeSubTab === "upload"
              ? "border-blue-550 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Upload size={14} /> Liste Yükleme
        </button>
        <button
          onClick={() => setActiveSubTab("monitor")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all duration-200 border-b-2 ${
            activeSubTab === "monitor"
              ? "border-blue-550 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Activity size={14} /> Canlı Kampanya İzleme
        </button>
      </div>

      {/* TAB CONTENT: RULES & CONFIG */}
      {activeSubTab === "rules" && (
        <form onSubmit={handleConfigSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-blue-550" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Kampanya Ayarları</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={config.enabled}
                  onChange={handleConfigChange}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Constraints and Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  Arama Modu
                  <InfoTooltip text="Predictive: Temsilci meşguliyet tahminine göre arama yapar. Progressive: Boştaki temsilci sayısına göre arar. Power: Eş zamanlı sabit sayıda arama tetikler." />
                </label>
                <select
                  name="dial_mode"
                  value={config.dial_mode}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="progressive">Progressive (Boşta temsilci varsa)</option>
                  <option value="predictive">Predictive (AI Tahmine Dayalı)</option>
                  <option value="power">Power Dialer (Sabit Hızlı Arama)</option>
                  <option value="preview">Preview (Temsilci onaylı arama)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  Arama Çıkış Hattı
                  <InfoTooltip text="Otomatik arama çağrılarının gönderileceği dış SIP hat (Trunk) tanımı." />
                </label>
                <select
                  name="outbound_trunk_id"
                  value={config.outbound_trunk_id}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {trunks.map((t) => (
                    <option key={t.id} value={t.id}>{t.trunk_name} ({t.did_number})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Speed & Retries */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  Eş Zamanlı Arama
                  <InfoTooltip text="Aynı anda aktif olabilecek maksimum çağrı sayısı." />
                </label>
                <input
                  type="number"
                  name="concurrent_calls"
                  value={config.concurrent_calls}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  required
                  min="1"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  Tekrar Arama Sınırı
                  <InfoTooltip text="Yanıt alınamayan bir kaydın maksimum kaç defa tekrar aranacağı." />
                </label>
                <input
                  type="number"
                  name="retry_count"
                  value={config.retry_count}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  required
                  min="0"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                  Tekrar Arama Süresi (Dk)
                  <InfoTooltip text="Meşgul veya cevapsız aramanın tekrar denenmesi için geçmesi gereken bekleme süresi." />
                </label>
                <input
                  type="number"
                  name="retry_interval_minutes"
                  value={config.retry_interval_minutes}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  required
                  min="1"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>
            </div>

            {/* Answer Routing */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-850 pt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-550 flex items-center">
                  Müşteri Yanıtladığında Yönlendirme
                  <InfoTooltip text="Müşteri telefonu açtığında çağrının kime/nereye aktarılacağı. AI Agent: Yapay zekaya bağlar. Çağrı Kuyruğu: Belirtilen destek kuyruğuna bağlar. Dahili Abone: Doğrudan dahili numaraya aktarır. IVR Menüsü: Önceden tanımlanmış sesli anons ve menü yönlendirmesine aktarır." />
                </label>
                <select
                  name="route_destination_type"
                  value={config.route_destination_type}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="ai">Yapay Zeka (AI Agent Greeting)</option>
                  <option value="queue">Çağrı Kuyruğu (Queue)</option>
                  <option value="extension">Dahili Abone (Extension)</option>
                  <option value="ivr">IVR Menüsü (Anons & Tuşlama)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-550 flex items-center">
                  Hedef Yapay Zeka / Kuyruk / Dahili / IVR
                  <InfoTooltip text="Yapay Zeka adı (örn: Sales_AI), Kuyruk adı (örn: satis_kuyrugu), Dahili no (örn: 200) veya IVR şablonu (örn: ana_menu) yazın." />
                </label>
                <input
                  type="text"
                  name="route_destination"
                  value={config.route_destination}
                  onChange={handleConfigChange}
                  disabled={!config.enabled}
                  required
                  placeholder="Örn: Sales_AI, satis_kuyrugu, 200, ana_menu"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-855 dark:text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>
            </div>

            {/* Time Restrictions */}
            <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-855 pt-4">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                Arama Saat Kısıtlamaları
                <InfoTooltip text="Kampanyanın otomatik olarak çalışmasına izin verilen haftalık saat aralığı." />
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">İzin Başlangıç Saati</label>
                  <input
                    type="time"
                    name="allowed_hours_start"
                    value={config.allowed_hours_start}
                    onChange={handleConfigChange}
                    disabled={!config.enabled}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">İzin Bitiş Saati</label>
                  <input
                    type="time"
                    name="allowed_hours_end"
                    value={config.allowed_hours_end}
                    onChange={handleConfigChange}
                    disabled={!config.enabled}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Allowed Days */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Arama Günleri</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: "monday", label: "Pzt" },
                    { code: "tuesday", label: "Sal" },
                    { code: "wednesday", label: "Çar" },
                    { code: "thursday", label: "Per" },
                    { code: "friday", label: "Cum" },
                    { code: "saturday", label: "Cmt" },
                    { code: "sunday", label: "Paz" }
                  ].map((d) => {
                    const active = config.allowed_days.includes(d.code);
                    return (
                      <button
                        key={d.code}
                        type="button"
                        disabled={!config.enabled}
                        onClick={() => handleDayToggle(d.code)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition ${
                          active
                            ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
                            : "bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-850 hover:bg-slate-100"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 transition duration-200"
            >
              <Save size={14} /> {loading ? "Kaydediliyor..." : "Kampanya Ayarlarını Kaydet"}
            </button>

            {saveSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-350 text-[10px] flex items-center gap-1.5 font-semibold">
                <CheckCircle size={12} />
                <span>Kampanya ve arama kuralları başarıyla kaydedildi.</span>
              </div>
            )}
          </div>

          {/* Tips card */}
          <div className="flex flex-col gap-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HelpCircle size={14} className="text-blue-500" />
              Dialer Kuralları
            </h4>
            <div className="space-y-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Progressive Arama</p>
                <p className="mt-0.5">Sadece temsilci kuyruklarında boşta (Available) olan bir temsilci var ise arama tetiklenir. Eş zamanlı arama limiti taşmayı önler.</p>
              </div>
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Predictive Arama</p>
                <p className="mt-0.5">Yapay zeka, çağrı kuyruğundaki ortalama konuşma sürelerini ve temsilcilerin boşalacağı anı tahmin ederek telefona cevap verme sürelerine göre aramaları önceden tetikler.</p>
              </div>
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Arama Kısıtlamaları</p>
                <p className="mt-0.5">Yasal sınırlar çerçevesinde sadece seçilen gün ve saat aralıkları içerisinde arama yapılır. Bu saatler dışında dialer otomatik durur.</p>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: UPLOAD LIST */}
      {activeSubTab === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Input list form */}
            <form onSubmit={handleManualUpload} className="flex flex-col p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <FileText size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Arama Listesi Numaraları Ekle</h3>
              </div>

              {/* Mock Drag & Drop File Upload Area */}
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl p-8 bg-slate-50 dark:bg-slate-950/40 text-center cursor-pointer transition">
                <Upload size={28} className="text-slate-400 dark:text-slate-600 mb-2 hover:scale-110 transition duration-200" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">CSV veya Excel Dosyası Sürükleyin</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Sadece .csv, .xlsx formatları. İlk kolon numara, ikinci kolon isim olmalıdır.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Manuel Numara Girişi (Satır Başına Tek Kayıt)
                </label>
                <textarea
                  rows="4"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Örn: 05051234567,Ahmet Yılmaz&#10;05327654321,Ayşe Can&#10;05448889900"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-blue-500 font-mono resize-none"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 transition duration-200"
              >
                <Plus size={14} /> Numaraları Listeye Ekle
              </button>

              {uploadSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-350 text-[10px] flex items-center gap-1.5 font-semibold">
                  <CheckCircle size={12} />
                  <span>{uploadMessage}</span>
                </div>
              )}
            </form>

            {/* List Preview */}
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
                <ListFilter size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Arama Sırasındaki Numaralar ({records.length})</h3>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2">No</th>
                      <th className="py-2">İsim Soyisim</th>
                      <th className="py-2">Telefon</th>
                      <th className="py-2">Durum</th>
                      <th className="py-2">Tekrar Arama</th>
                      <th className="py-2">Son Çağrı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-850 text-slate-700 dark:text-slate-300 font-medium">
                        <td className="py-2.5">{i + 1}</td>
                        <td className="py-2.5 font-bold text-slate-800 dark:text-white">{r.name}</td>
                        <td className="py-2.5 font-mono">{r.phone}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            r.status === "Answered" 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" 
                              : r.status === "Failed" 
                              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}>
                            {r.status === "Answered" ? "Cevaplandı" : r.status === "Failed" ? "Başarısız" : "Bekliyor"}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono">{r.retries}</td>
                        <td className="py-2.5 font-mono text-[10px] text-slate-400">{r.last_call}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-blue-500" />
              Yükleme İpuçları
            </h4>
            <div className="space-y-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <p>Dosyaları sürükleyip bırakarak yüklerken, rehber kolonlarının sırasına dikkat edin. Yanlış biçimlendirilmiş numaralar otomatik olarak yoksayılır.</p>
              <p>Manuel ekleme yaparken telefon numarasını yazıp virgülden sonra isim belirtebilirsiniz. Her satıra tek bir numara girmelisiniz.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LIVE CAMPAIGN MONITOR */}
      {activeSubTab === "monitor" && (
        <div className="flex flex-col gap-6">
          
          {/* Dialer control bar */}
          <div className="flex flex-wrap items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3.5 w-3.5">
                {dialerState.status === "running" ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Kampanya Durumu: {dialerState.status === "running" ? "YÜRÜTÜLÜYOR" : "DURDURULDU"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Eş zamanlı aktif arama: <span className="font-bold text-slate-700 dark:text-slate-305 font-mono">{dialerState.current_calls}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {dialerState.status === "paused" ? (
                <button
                  onClick={() => handleDialerAction("start")}
                  disabled={!config.enabled}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 transition rounded-xl font-bold text-xs text-white shadow-sm"
                >
                  <Play size={14} /> Kampanyayı Başlat
                </button>
              ) : (
                <button
                  onClick={() => handleDialerAction("pause")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 transition rounded-xl font-bold text-xs text-white shadow-sm"
                >
                  <Pause size={14} /> Kampanyayı Duraklat
                </button>
              )}
              <button
                onClick={() => handleDialerAction("reset")}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 transition rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw size={14} /> Yeniden Başlat (Sıfırla)
              </button>
            </div>
          </div>

          {/* Real-time stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center shadow-sm">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Toplam Liste</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">{totalRecords}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center shadow-sm">
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-blue-500">Cevaplandı</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">{answeredRecords}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center shadow-sm">
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-amber-500">Bekleyen</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">{pendingRecords}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center shadow-sm">
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-rose-500">Başarısız</p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-450 mt-1 font-mono">{failedRecords}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center shadow-sm col-span-2 md:col-span-1">
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-emerald-500">Başarı Oranı</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-450 mt-1 font-mono">%{successRate}</p>
            </div>
          </div>

          {/* Active Calls Activity Monitor */}
          {dialerState.status === "running" && (
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Aktif Arama Kanalları</span>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-lg font-bold font-mono">Eş zamanlı arama limiti: {config.concurrent_calls}</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: dialerState.current_calls }).map((_, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2">
                      <PhoneCall size={14} className="text-blue-500" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-250">Aktif Çağrı #{idx + 1}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Aranıyor (Trunk #{config.outbound_trunk_id})...</p>
                      </div>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded font-bold uppercase font-mono">Çevriliyor</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Call list in Monitor */}
          <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Arama Kuyruğu Kayıt Listesi</h3>
              <span className="text-[10px] text-slate-400">Canlı olarak güncellenir</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5">Müşteri</th>
                    <th className="py-2.5">Telefon</th>
                    <th className="py-2.5">Durum</th>
                    <th className="py-2.5">Deneme</th>
                    <th className="py-2.5">Son Deneme Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/40 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-350 transition-colors">
                      <td className="py-3 font-bold text-slate-850 dark:text-white">{r.name}</td>
                      <td className="py-3 font-mono">{r.phone}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          r.status === "Answered" 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/40" 
                            : r.status === "Failed" 
                            ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-455 border border-rose-100/40"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200/40"
                        }`}>
                          {r.status === "Answered" ? "Cevaplandı" : r.status === "Failed" ? "Başarısız" : "Bekliyor"}
                        </span>
                      </td>
                      <td className="py-3 font-mono">{r.retries}</td>
                      <td className="py-3 font-mono text-[10px] text-slate-400">{r.last_call}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
