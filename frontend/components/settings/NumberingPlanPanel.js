import React, { useState, useEffect } from "react";
import {
  Save,
  CheckCircle,
  Hash,
  AlertTriangle,
  PhoneForwarded,
  Headphones,
  Plus,
  X,
  Siren,
  Sliders
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const DEFAULT_FORWARDING_PREFIXES = {
  always: "*21*",
  busy: "*67*",
  no_answer: "*61*",
  cancel: "#21#"
};

const DEFAULT_MONITORING_PREFIXES = {
  listen: "*551*",
  whisper: "*552*",
  barge: "*553*"
};

const DEFAULT_EMERGENCY_NUMBERS = ["112", "110", "155", "156", "177", "185", "186", "187"];

const DEFAULT_FEATURE_CODES = {
  voicemail_listen: "*97",
  recording_pause: "*9",
  profile_switch: "*70",
  boss_secretary_toggle: "*74",
  hotdesk_login: "*75",
  hotdesk_logout: "*76"
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
    call_forwarding: { ...DEFAULT_FORWARDING_PREFIXES },
    call_monitoring: { ...DEFAULT_MONITORING_PREFIXES },
    emergency_numbers: {
      numbers: [...DEFAULT_EMERGENCY_NUMBERS],
      preferred_trunk: ""
    },
    pbx_features: { ...DEFAULT_FEATURE_CODES }
  });

  const [trunks, setTrunks] = useState([]);
  const [newEmergencyNum, setNewEmergencyNum] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/settings/numbering-plan`).then((res) => (res.ok ? res.json() : {})),
      fetch(`${API_BASE}/api/settings/trunks`)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
    ])
      .then(([data, trunkData]) => {
        const trunkList = Array.isArray(trunkData)
          ? trunkData
          : Array.isArray(trunkData?.trunks)
          ? trunkData.trunks
          : [];
        setTrunks(trunkList);

        if (data && Object.keys(data).length > 0) {
          const rawEmgNums = Array.isArray(data.emergency_numbers?.numbers)
            ? data.emergency_numbers.numbers
            : Array.isArray(data.emergency_numbers)
            ? data.emergency_numbers
            : DEFAULT_EMERGENCY_NUMBERS;

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
            },
            call_monitoring: {
              listen: data.call_monitoring?.listen || DEFAULT_MONITORING_PREFIXES.listen,
              whisper: data.call_monitoring?.whisper || DEFAULT_MONITORING_PREFIXES.whisper,
              barge: data.call_monitoring?.barge || DEFAULT_MONITORING_PREFIXES.barge
            },
            emergency_numbers: {
              numbers: rawEmgNums.map((n) => String(n).trim()).filter(Boolean),
              preferred_trunk: String(data.emergency_numbers?.preferred_trunk || "")
            },
            pbx_features: {
              voicemail_listen:
                data.pbx_features?.voicemail_listen ||
                data.feature_codes?.voicemail_listen ||
                DEFAULT_FEATURE_CODES.voicemail_listen,
              recording_pause:
                data.pbx_features?.recording_pause ||
                data.feature_codes?.recording_pause ||
                DEFAULT_FEATURE_CODES.recording_pause,
              profile_switch:
                data.pbx_features?.profile_switch ||
                data.feature_codes?.profile_switch ||
                DEFAULT_FEATURE_CODES.profile_switch,
              boss_secretary_toggle:
                data.pbx_features?.boss_secretary_toggle ||
                data.feature_codes?.boss_secretary_toggle ||
                DEFAULT_FEATURE_CODES.boss_secretary_toggle,
              hotdesk_login:
                data.pbx_features?.hotdesk_login ||
                data.feature_codes?.hotdesk_login ||
                DEFAULT_FEATURE_CODES.hotdesk_login,
              hotdesk_logout:
                data.pbx_features?.hotdesk_logout ||
                data.feature_codes?.hotdesk_logout ||
                DEFAULT_FEATURE_CODES.hotdesk_logout
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

  const handleMonitoringPrefixChange = (field, value) => {
    setPlan((prev) => ({
      ...prev,
      call_monitoring: {
        ...(prev.call_monitoring || DEFAULT_MONITORING_PREFIXES),
        [field]: value
      }
    }));
  };

  const handleFeatureCodeChange = (field, value) => {
    setPlan((prev) => ({
      ...prev,
      pbx_features: {
        ...(prev.pbx_features || DEFAULT_FEATURE_CODES),
        [field]: value
      }
    }));
  };

  const handleAddEmergencyNumber = () => {
    const clean = String(newEmergencyNum || "").replace(/\D/g, "");
    if (!clean) return;
    setPlan((prev) => {
      const current = prev.emergency_numbers?.numbers || [];
      if (current.includes(clean)) return prev;
      return {
        ...prev,
        emergency_numbers: {
          ...(prev.emergency_numbers || { preferred_trunk: "" }),
          numbers: [...current, clean]
        }
      };
    });
    setNewEmergencyNum("");
  };

  const handleRemoveEmergencyNumber = (numToRemove) => {
    setPlan((prev) => ({
      ...prev,
      emergency_numbers: {
        ...(prev.emergency_numbers || { preferred_trunk: "" }),
        numbers: (prev.emergency_numbers?.numbers || []).filter((n) => n !== numToRemove)
      }
    }));
  };

  const handleEmergencyTrunkChange = (trunkVal) => {
    setPlan((prev) => ({
      ...prev,
      emergency_numbers: {
        ...(prev.emergency_numbers || { numbers: [...DEFAULT_EMERGENCY_NUMBERS] }),
        preferred_trunk: trunkVal
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
    const cm = plan.call_monitoring || {};
    if (!cm.listen?.trim() || !cm.whisper?.trim() || !cm.barge?.trim()) {
      return "Çağrı dinleme, sufle ve araya girme prefix kodları boş bırakılamaz!";
    }
    const fc = plan.pbx_features || {};
    if (
      !fc.voicemail_listen?.trim() ||
      !fc.recording_pause?.trim() ||
      !fc.profile_switch?.trim() ||
      !fc.boss_secretary_toggle?.trim() ||
      !fc.hotdesk_login?.trim() ||
      !fc.hotdesk_logout?.trim()
    ) {
      return "Kurumsal santral özellik (tuşlama) kodları boş bırakılamaz!";
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

  const monitoringConfig = [
    {
      field: "listen",
      label: "Fısıldama / Sessiz Dinleme (Spy)",
      placeholder: "*551*",
      desc: "Masa telefonundan bu prefix + hedef dahili tuşlandığında (örn: *551*1000 veya aktif AI çağrısı için *551*200) görüşmeyi karşı taraf duymadan sessizce dinlersiniz.",
      example: `${plan.call_monitoring?.listen || "*551*"}1000`
    },
    {
      field: "whisper",
      label: "Sufle Verme / Koçluk (Whisper)",
      placeholder: "*552*",
      desc: "Masa telefonundan bu prefix + hedef dahili tuşlandığında (örn: *552*1000) sadece temsilci sizin sesinizi duyar, müşteri duymaz.",
      example: `${plan.call_monitoring?.whisper || "*552*"}1000`
    },
    {
      field: "barge",
      label: "Araya Girme / Çağrıya Dahil Olma (Barge-In)",
      placeholder: "*553*",
      desc: "Masa telefonundan bu prefix + hedef dahili tuşlandığında (örn: *553*1000 veya AI çağrısı için *553*200) hem temsilci/AI hem de müşteri sesinizi duyar.",
      example: `${plan.call_monitoring?.barge || "*553*"}1000`
    }
  ];

  const featureCodesConfig = [
    {
      field: "voicemail_listen",
      label: "Sesli Posta Kutusu Dinleme",
      placeholder: "*97",
      desc: "Masa veya Web telefonundan bu kod tuşlandığında sesli posta IVR menüsü (PIN doğrulamalı dinleme ve silme) açılır.",
      example: plan.pbx_features?.voicemail_listen || "*97"
    },
    {
      field: "recording_pause",
      label: "Ses Kaydı Duraklatma / Maskeleme (KVKK)",
      placeholder: "*9",
      desc: "Aktif görüşme esnasında yetkili temsilci bu kodu tuşladığında kredi kartı / kişisel veri paylaşımı süresince ses kaydı maskelenir.",
      example: plan.pbx_features?.recording_pause || "*9"
    },
    {
      field: "profile_switch",
      label: "Kullanıcı Profili Değiştirme (Digit ile)",
      placeholder: "*70",
      desc: "Masa telefonundan profil kodu tuşlanarak (örn: *70*1 Müsait, *70*2 Uzakta, *70*3 Toplantıda) aktif profil anında değiştirilir.",
      example: `${plan.pbx_features?.profile_switch || "*70"}*1`
    },
    {
      field: "boss_secretary_toggle",
      label: "Yönetici - Sekreter Filtresi Aç / Kapat",
      placeholder: "*74",
      desc: "Yönetici kendi telefonundan (veya sekreteri *74*YöneticiDahili şeklinde) tuşlayarak sekreter süzgecini anında açıp kapatabilir.",
      example: plan.pbx_features?.boss_secretary_toggle || "*74"
    },
    {
      field: "hotdesk_login",
      label: "Hot-Desking Oturum Açma (Masa Paylaşımı)",
      placeholder: "*75",
      desc: "Herhangi bir masa telefonundan *75 (veya doğrudan *75*Dahili*PIN) tuşlanarak abonenin kendi dahili numarası o cihaza bağlanır.",
      example: `${plan.pbx_features?.hotdesk_login || "*75"}*1001*1234`
    },
    {
      field: "hotdesk_logout",
      label: "Hot-Desking Oturum Kapatma",
      placeholder: "*76",
      desc: "Oturum açılmış masa telefonundan bu kod tuşlandığında Hot-Desk eşleşmesi sonlandırılır ve telefon varsayılan haline döner.",
      example: plan.pbx_features?.hotdesk_logout || "*76"
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
              Sisteminizdeki farklı modüller için tahsis edilecek numara (ID) aralıklarını, acil durum numaralarını ve tuşlama (prefix) kodlarını belirleyin.
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
          <CheckCircle size={14} /> Numara planı, acil numaralar ve özellik kodları başarıyla kaydedildi!
        </div>
      )}

      {/* Acil Durum Numaraları (112, 110, 155...) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-rose-500" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Acil Durum Numaraları (Kısıtlamasız Öncelikli Çıkış)
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50">
            PIN, Dış Arama Yetkisi ve Kanal Limiti Bypass Edilir
          </span>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <label
                htmlFor="emergency-num-input"
                className="block text-xs font-bold text-slate-800 dark:text-white"
              >
                Tanımlı Acil Durum Kısa Numaraları
              </label>
              <p
                id="emergency-num-hint"
                className="text-[10px] text-slate-500 dark:text-slate-400"
              >
                Sadece rakam giriniz (örn: 112, 110, 155, 177). Bu numaralar 0 çevirmeden doğrudan aranır ve karantina/yetki engeline takılmaz.
              </p>
              <div className="flex items-center gap-2">
                <input
                  id="emergency-num-input"
                  type="text"
                  inputMode="numeric"
                  aria-describedby="emergency-num-hint"
                  value={newEmergencyNum}
                  onChange={(e) => setNewEmergencyNum(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmergencyNumber();
                    }
                  }}
                  placeholder="Örn: 112"
                  className={`w-40 text-xs font-mono font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
                <button
                  type="button"
                  onClick={handleAddEmergencyNumber}
                  title="Acil Numara Ekle"
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {(plan.emergency_numbers?.numbers || []).map((num) => (
                  <span
                    key={num}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60"
                  >
                    {num}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmergencyNumber(num)}
                      title={`${num} numarasını kaldır`}
                      className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <label
                htmlFor="emergency-preferred-trunk"
                className="block text-xs font-bold text-slate-800 dark:text-white"
              >
                Öncelikli Acil Çıkış Trunk Hattı
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Seçilen hat acil çağrılarda ilk sırada denenir; hat meşgul veya erişilemez ise sistem diğer aktif trunk hatlarına otomatik yedekli (failover) geçiş yapar.
              </p>
              <select
                id="emergency-preferred-trunk"
                value={plan.emergency_numbers?.preferred_trunk || ""}
                onChange={(e) => handleEmergencyTrunkChange(e.target.value)}
                className={`w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
              >
                <option value="">Otomatik Sıralı Yedekli Çıkış (Tüm Aktif Trunklar)</option>
                {trunks.map((tr) => {
                  const trVal = tr.id || tr.trunk_name || tr.name;
                  const trLabel = tr.trunk_name || tr.name || trVal;
                  const trHost = tr.host || tr.sip_server || "";
                  return (
                    <option key={trVal} value={trVal}>
                      {trLabel} {trHost ? `(${trHost})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Aralık Konfigürasyonları */}
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

      {/* Kurumsal Santral Özellik Kodları */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sliders size={15} className={text} />
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Gelişmiş Kurumsal Santral Özellik Kodları (Sesli Posta, Profil, Hot-Desk, KVKK)
            </h4>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
            Tüm IP Telefonlar & Web Telefonu Uyumlu
          </span>
        </div>
        <div className="p-5 space-y-6">
          {featureCodesConfig.map((item) => (
            <div
              key={item.field}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-white">{item.label}</h5>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                    Örn: {item.example}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Özellik Kodu</label>
                  <input
                    type="text"
                    value={plan.pbx_features?.[item.field] ?? ""}
                    onChange={(e) => handleFeatureCodeChange(item.field, e.target.value)}
                    placeholder={item.placeholder}
                    className={`w-32 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
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

      {/* Çağrı Dinleme, Sufle ve Araya Girme (ChanSpy) Prefix'leri */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Headphones size={15} className={text} />
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Çağrı Dinleme, Sufle ve Araya Girme (ChanSpy) Prefix&apos;leri
            </h4>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
            Masa Telefonu & Rol Yetki Kontrollü
          </span>
        </div>
        <div className="p-5 space-y-6">
          {monitoringConfig.map((item) => (
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
                    value={plan.call_monitoring?.[item.field] ?? ""}
                    onChange={(e) => handleMonitoringPrefixChange(item.field, e.target.value)}
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
