import React, { useState, useEffect } from "react";
import { Save, CheckCircle, Hash, AlertTriangle, PhoneForwarded } from "lucide-react";
import { useTheme } from "../../utils/theme";

const DEFAULT_FORWARDING_PREFIXES = {
  always: "*21*",
  busy: "*67*",
  no_answer: "*61*",
  cancel: "#21#"
};

export default function NumberingPlanPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, ring, lightBg, border, borderLight } = useTheme();

  const [plan, setPlan] = useState({
    extension_range: { start: 1000, end: 1999 },
    queue_range: { start: 2000, end: 2999 },
    conference_range: { start: 3000, end: 3999 },
    speed_dial_range: { start: 4000, end: 4999 },
    call_flow_range: { start: 5000, end: 5999 },
    call_pickup: { group: "*8", directed: "**" },
    call_forwarding: { ...DEFAULT_FORWARDING_PREFIXES }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/numbering-plan`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setPlan((prev) => ({
            ...prev,
            ...data,
            call_pickup: {
              group: data.call_pickup?.group || "*8",
              directed: data.call_pickup?.directed || "**"
            },
            call_forwarding: {
              always: data.call_forwarding?.always || DEFAULT_FORWARDING_PREFIXES.always,
              busy: data.call_forwarding?.busy || DEFAULT_FORWARDING_PREFIXES.busy,
              no_answer: data.call_forwarding?.no_answer || DEFAULT_FORWARDING_PREFIXES.no_answer,
              cancel: data.call_forwarding?.cancel || DEFAULT_FORWARDING_PREFIXES.cancel
            }
          }));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Numbering plan fetch error:", err);
        setLoading(false);
      });
  }, [backendHost]);

  const handleRangeChange = (key, field, value) => {
    const val = parseInt(value) || 0;
    setPlan((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val
      }
    }));
  };

  const handlePrefixChange = (field, value) => {
    setPlan((prev) => ({
      ...prev,
      call_pickup: {
        ...(prev.call_pickup || { group: "*8", directed: "**" }),
        [field]: value
      }
    }));
  };

  const handleForwardingPrefixChange = (field, value) => {
    setPlan((prev) => ({
      ...prev,
      call_forwarding: {
        ...(prev.call_forwarding || DEFAULT_FORWARDING_PREFIXES),
        [field]: value
      }
    }));
  };

  const validateOverlaps = () => {
    const ranges = Object.entries(plan)
      .filter(([key]) => key.endsWith("_range"))
      .map(([key, r]) => ({
        key,
        start: r.start,
        end: r.end
      }));

    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].start > ranges[i].end) {
        return "Başlangıç değeri bitiş değerinden büyük olamaz!";
      }
      for (let j = i + 1; j < ranges.length; j++) {
        if (ranges[i].start <= ranges[j].end && ranges[j].start <= ranges[i].end) {
          return "Numara aralıkları birbiriyle çakışamaz! Lütfen aralıkları benzersiz yapın.";
        }
      }
    }

    const cf = plan.call_forwarding || {};
    if (!cf.always?.trim() || !cf.busy?.trim() || !cf.no_answer?.trim() || !cf.cancel?.trim()) {
      return "Çağrı yönlendirme ve iptal prefix kodları boş bırakılamaz!";
    }
    return null;
  };

  const handleSave = async () => {
    setError(null);
    const overlapError = validateOverlaps();
    if (overlapError) {
      setError(overlapError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/numbering-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Ayarlar kaydedilirken bir sorun oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const rangeConfig = [
    { key: "extension_range", label: "Dahili Numara Aralığı", desc: "Sistemdeki kullanıcılar/temsilciler için ayrılan numara bloğu." },
    { key: "queue_range", label: "Kuyruk Numara Aralığı", desc: "ACD destek ve çağrı dağıtım kuyrukları için blok." },
    { key: "conference_range", label: "Konferans Odası Aralığı", desc: "Sanal toplantı ve konferans odaları için ayrılan blok." },
    { key: "speed_dial_range", label: "Hızlı Arama Aralığı", desc: "Sistem geneli kısa kodlar ve hızlı aramalar için blok." },
    { key: "call_flow_range", label: "Arama Akışı (IVR) Aralığı", desc: "Sesli yanıt sistemleri ve özel senaryo numaraları." }
  ];

  const forwardingConfig = [
    {
      field: "always",
      label: "Her Zaman Yönlendirme",
      placeholder: "*21*",
      desc: "Masa telefonundan bu prefix + hedef numara tuşlandığında (örn: *21*1001 veya *21*0532...) gelen tüm çağrılar koşulsuz yönlendirilir.",
      example: `${plan.call_forwarding?.always || "*21*"}1001`
    },
    {
      field: "busy",
      label: "Meşgulde Yönlendirme",
      placeholder: "*67*",
      desc: "Abone görüşmedeyken veya meşgulken gelen çağrıların yönlendirileceği hedefi masa telefonundan tanımlama prefix'i.",
      example: `${plan.call_forwarding?.busy || "*67*"}1002`
    },
    {
      field: "no_answer",
      label: "Zaman Aşımında Yönlendirme",
      placeholder: "*61*",
      desc: "Çağrı belirlenen sürede yanıtlanmadığında (cevapsız) yönlendirilecek hedefi masa telefonundan tanımlama prefix'i.",
      example: `${plan.call_forwarding?.no_answer || "*61*"}1003`
    },
    {
      field: "cancel",
      label: "Yönlendirme İptal Kodu",
      placeholder: "#21#",
      desc: "Masa telefonundan bu kod tuşlandığında abonenin aktif tüm çağrı yönlendirmeleri iptal edilir ve arayüzde otomatik kapanır.",
      example: `${plan.call_forwarding?.cancel || "#21#"}`
    }
  ];

  if (loading) {
    return <div className="text-center py-10 text-xs text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Hash size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">NUMARA PLANI</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              Sisteminizdeki farklı modüller için tahsis edilecek numara (ID) aralıklarını ve telefon tuşlama (prefix) kodlarını belirleyin.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50`}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          Kaydet
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
          <CheckCircle size={14} /> Numara planı ve yönlendirme kodları başarıyla kaydedildi!
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            Aralık Konfigürasyonları
          </h4>
        </div>
        <div className="p-5 space-y-6">
          {rangeConfig.map((conf) => (
            <div key={conf.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
              <div className="flex-1">
                <h5 className="text-xs font-bold text-slate-800 dark:text-white">{conf.label}</h5>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{conf.desc}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Başlangıç</label>
                  <input
                    type="number"
                    value={plan[conf.key]?.start || 0}
                    onChange={(e) => handleRangeChange(conf.key, "start", e.target.value)}
                    className={`w-28 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
                <div className="text-slate-400 font-bold mt-4">-</div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Bitiş</label>
                  <input
                    type="number"
                    value={plan[conf.key]?.end || 0}
                    onChange={(e) => handleRangeChange(conf.key, "end", e.target.value)}
                    className={`w-28 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Çağrı Yönlendirme (Call Forwarding) Prefix'leri */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PhoneForwarded size={15} className={text} />
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Çağrı Yönlendirme (Call Forwarding) Prefix&apos;leri
            </h4>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
            Masa Telefonu & Web Arayüzü Tam Senkronize
          </span>
        </div>
        <div className="p-5 space-y-6">
          {forwardingConfig.map((item) => (
            <div
              key={item.field}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-white">{item.label}</h5>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                    Örn: {item.example}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Prefix / Kod</label>
                  <input
                    type="text"
                    value={plan.call_forwarding?.[item.field] ?? ""}
                    onChange={(e) => handleForwardingPrefixChange(item.field, e.target.value)}
                    placeholder={item.placeholder}
                    className={`w-32 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Çağrı Toplama (Call Pickup) Prefix'leri */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            Çağrı Toplama (Call Pickup) Prefix&apos;leri
          </h4>
        </div>
        <div className="p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
            <div className="flex-1">
              <h5 className="text-xs font-bold text-slate-800 dark:text-white">Grup İçinden / Dışından Çekme</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Aynı gruptaki çalan telefonları veya belirtilen dahiliye gelen çağrıları uzaktan çekmek için kullanılacak prefix&apos;leri ayarlayın.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Grup İçinden</label>
                <input
                  type="text"
                  value={plan.call_pickup?.group || "*8"}
                  onChange={(e) => handlePrefixChange("group", e.target.value)}
                  placeholder="*8"
                  className={`w-28 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Grup Dışından</label>
                <input
                  type="text"
                  value={plan.call_pickup?.directed || "**"}
                  onChange={(e) => handlePrefixChange("directed", e.target.value)}
                  placeholder="**"
                  className={`w-28 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
