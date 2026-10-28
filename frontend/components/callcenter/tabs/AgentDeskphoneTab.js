import React, { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Smartphone,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  Zap,
  BellOff,
  PhoneForwarded,
  PauseCircle,
  Voicemail,
  Sliders,
  Download,
  RotateCcw,
  Wifi,
  Sparkles,
  Check,
  X,
  History,
  BookOpen,
  Monitor,
} from "lucide-react";
import { useTheme } from "../../../utils/theme";

const DSS_KEY_TYPES = [
  {
    id: "blf",
    name: "BLF (Meşguliyet Lambası & Çağrı Çekme)",
    short: "BLF",
    led: "bg-emerald-500 shadow-emerald-500/60",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    desc: "Seçilen dahili abonenin meşgul/müsait durumunu ışıklı gösterir, basıldığında arar veya çalan çağrısını çeker.",
  },
  {
    id: "speed_dial",
    name: "Speed Dial (Hızlı Arama)",
    short: "Hızlı Ara",
    led: "bg-sky-500 shadow-sky-500/60",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    desc: "Sık aradığınız bir dahili veya dış telefon numarasını tek tuşla hızlı arar.",
  },
  {
    id: "line",
    name: "Hat Tuşu (Line)",
    short: "Hat",
    led: "bg-emerald-400 shadow-emerald-400/60",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    desc: "Dahili hattınız üzerinden yeni çağrı başlatır veya gelen çağrıyı yanıtlar.",
  },
  {
    id: "dnd",
    name: "Rahatsız Etmeyin (DND)",
    short: "DND",
    led: "bg-rose-500 shadow-rose-500/60",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    desc: "Masa telefonunu Rahatsız Etmeyin (DND) moduna alır veya çıkarır.",
  },
  {
    id: "transfer",
    name: "Çağrı Aktar (Transfer)",
    short: "Aktar",
    led: "bg-amber-500 shadow-amber-500/60",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    desc: "Aktif görüşmeyi belirtilen dahiliye veya numaraya aktarır.",
  },
  {
    id: "hold",
    name: "Çağrı Beklet (Hold)",
    short: "Beklet",
    led: "bg-amber-400 shadow-amber-400/60",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    desc: "Aktif görüşmeyi beklemeye alır veya beklemeden çıkarır.",
  },
  {
    id: "voicemail",
    name: "Sesli Posta (Voicemail)",
    short: "Sesli Posta",
    led: "bg-purple-500 shadow-purple-500/60",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    desc: "Sesli posta kutunuzu (*97) tek tuşla dinlemenizi sağlar.",
  },
  {
    id: "conference",
    name: "Konferans (Conference)",
    short: "Konferans",
    led: "bg-indigo-500 shadow-indigo-500/60",
    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    desc: "Çoklu konferans görüşmesi başlatır veya konferans odasına bağlanır.",
  },
  {
    id: "none",
    name: "Boş / Atanmamış",
    short: "Boş",
    led: "bg-slate-600",
    badge: "bg-slate-800 text-slate-400 border-slate-700",
    desc: "Bu tuşta herhangi bir işlem tanımlı değil.",
  },
];

const SOFTKEY_TYPES = [
  { id: "history", name: "Çağrı Geçmişi (History)", defaultLabel: "Geçmiş" },
  { id: "directory", name: "Kurumsal Rehber (Directory)", defaultLabel: "Rehber" },
  { id: "dnd", name: "Rahatsız Etmeyin (DND)", defaultLabel: "DND" },
  { id: "transfer", name: "Çağrı Aktar (Transfer)", defaultLabel: "Aktar" },
  { id: "speed_dial", name: "Özel Hızlı Arama (Speed Dial)", defaultLabel: "Hızlı Ara" },
  { id: "redial", name: "Son Numarayı Tekrar Ara (Redial)", defaultLabel: "Tekrar Ara" },
  { id: "voicemail", name: "Sesli Posta (*97)", defaultLabel: "Mesajlar" },
];

const PHONE_MODELS = [
  { brand: "Yealink", model: "SIP-T46U / T43U (12 Tuşlu)", value: "Yealink:T46U" },
  { brand: "Yealink", model: "SIP-T33G / T31P", value: "Yealink:T33G" },
  { brand: "Fanvil", model: "X4U / X5U / V64", value: "Fanvil:X4U" },
  { brand: "Grandstream", model: "GRP2614 / GXP2140", value: "Grandstream:GXP2140" },
  { brand: "Snom", model: "D785 / D735", value: "Snom:D785" },
  { brand: "Cisco", model: "IP Phone 8841 / 7841", value: "Cisco:8841" },
];

function createDefaultDssKeys(ext) {
  return Array.from({ length: 12 }, (_, idx) => {
    const keyIndex = idx + 1;
    if (keyIndex === 1) {
      return {
        key_index: 1,
        type: "line",
        label: `Hat ${ext}`,
        value: String(ext),
        pickup_code: "*8",
      };
    }
    if (keyIndex === 2) {
      return {
        key_index: 2,
        type: "line",
        label: `Hat ${ext} (2)`,
        value: String(ext),
        pickup_code: "*8",
      };
    }
    if (keyIndex === 3) {
      return {
        key_index: 3,
        type: "dnd",
        label: "Rahatsız Etme",
        value: "",
        pickup_code: "*8",
      };
    }
    if (keyIndex === 4) {
      return {
        key_index: 4,
        type: "voicemail",
        label: "Sesli Posta",
        value: "*97",
        pickup_code: "*8",
      };
    }
    return {
      key_index: keyIndex,
      type: "none",
      label: "",
      value: "",
      pickup_code: "*8",
    };
  });
}

function createDefaultSoftKeys() {
  return [
    { key_index: 1, type: "history", label: "Geçmiş", value: "" },
    { key_index: 2, type: "directory", label: "Rehber", value: "" },
    { key_index: 3, type: "dnd", label: "DND", value: "" },
    { key_index: 4, type: "transfer", label: "Aktar", value: "" },
  ];
}

export default function AgentDeskphoneTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const ext = String(currentUser?.extension || "1000").trim();
  const fullName = currentUser?.full_name || currentUser?.username || `Dahili ${ext}`;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const [brand, setBrand] = useState("Yealink");
  const [model, setModel] = useState("T46U");
  const [macAddress, setMacAddress] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [dssKeys, setDssKeys] = useState(() => createDefaultDssKeys(ext));
  const [softKeys, setSoftKeys] = useState(() => createDefaultSoftKeys());

  // Selected Key for Editing: { category: "dss" | "soft", index: 1..12 or 1..4 }
  const [selectedKey, setSelectedKey] = useState({ category: "dss", index: 3 });

  // Directory & Speed Dial options for 1-click BLF / Speed Dial assignment
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [speedDials, setSpeedDials] = useState([]);
  const [clockStr, setClockStr] = useState("09:00");

  const getApiBase = useCallback(() => {
    const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    return `${protocol}//${host}`;
  }, [backendHost]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchDeskphoneConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}`);
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config || {};
        if (cfg.brand) setBrand(cfg.brand);
        if (cfg.model) setModel(cfg.model);
        if (cfg.mac !== undefined) setMacAddress(cfg.mac || "");
        if (cfg.ip !== undefined) setIpAddress(cfg.ip || "");

        if (Array.isArray(cfg.dss_keys) && cfg.dss_keys.length > 0) {
          const mergedDss = createDefaultDssKeys(ext).map((defKey) => {
            const found = cfg.dss_keys.find((k) => Number(k.key_index) === defKey.key_index);
            return found ? { ...defKey, ...found } : defKey;
          });
          setDssKeys(mergedDss);
        } else {
          setDssKeys(createDefaultDssKeys(ext));
        }

        if (Array.isArray(cfg.soft_keys) && cfg.soft_keys.length > 0) {
          const mergedSoft = createDefaultSoftKeys().map((defSk) => {
            const found = cfg.soft_keys.find((k) => Number(k.key_index) === defSk.key_index);
            return found ? { ...defSk, ...found } : defSk;
          });
          setSoftKeys(mergedSoft);
        } else {
          setSoftKeys(createDefaultSoftKeys());
        }

        if (Array.isArray(data.directory_users)) {
          setDirectoryUsers(data.directory_users);
        }
        if (Array.isArray(data.speed_dials)) {
          setSpeedDials(data.speed_dials);
        }
      }
    } catch (err) {
      console.error("Masa telefonu ayarları yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [ext, getApiBase]);

  useEffect(() => {
    fetchDeskphoneConfig();
  }, [fetchDeskphoneConfig]);

  const currentEditingItem =
    selectedKey.category === "dss"
      ? dssKeys.find((k) => k.key_index === selectedKey.index) || dssKeys[0]
      : softKeys.find((k) => k.key_index === selectedKey.index) || softKeys[0];

  const updateCurrentKeyField = (field, val) => {
    if (selectedKey.category === "dss") {
      setDssKeys((prev) =>
        prev.map((k) => {
          if (k.key_index !== selectedKey.index) return k;
          const updated = { ...k, [field]: val };
          if (field === "type") {
            if (val === "line") {
              updated.label = `Hat ${ext}`;
              updated.value = String(ext);
            } else if (val === "dnd") {
              updated.label = "Rahatsız Etme";
              updated.value = "";
            } else if (val === "voicemail") {
              updated.label = "Sesli Posta";
              updated.value = "*97";
            } else if (val === "hold") {
              updated.label = "Beklet";
              updated.value = "";
            } else if (val === "transfer" && !updated.label) {
              updated.label = "Aktar";
            } else if (val === "none") {
              updated.label = "";
              updated.value = "";
            }
          }
          return updated;
        })
      );
    } else {
      setSoftKeys((prev) =>
        prev.map((k) => {
          if (k.key_index !== selectedKey.index) return k;
          const updated = { ...k, [field]: val };
          if (field === "type") {
            const meta = SOFTKEY_TYPES.find((s) => s.id === val);
            if (meta) updated.label = meta.defaultLabel;
          }
          return updated;
        })
      );
    }
  };

  const handleSaveAndApply = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(currentUser?.username || ext),
        },
        body: JSON.stringify({
          extension: ext,
          user_id: currentUser?.id,
          brand,
          model,
          mac: macAddress.trim(),
          ip: ipAddress.trim(),
          dss_keys: dssKeys,
          soft_keys: softKeys,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Masa telefonu ayarları kaydedilemedi.");

      setBanner({
        ok: true,
        message:
          data.message ||
          "Masa telefonu BLF, Hızlı Arama ve Softkey tuşlarınız kaydedildi ve cihazınıza senkronize edildi!",
      });
    } catch (err) {
      setBanner({
        ok: false,
        message: err.message || "Masa telefonu ayarları kaydedilirken hata oluştu.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadConfig = () => {
    window.open(
      `${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}/config-file`,
      "_blank"
    );
  };

  const handleResetDefaults = () => {
    setDssKeys(createDefaultDssKeys(ext));
    setSoftKeys(createDefaultSoftKeys());
    setBanner({
      ok: true,
      message: "Tuş dizilimi varsayılan fabrika ayarlarına döndürüldü. Kaydet butonuna basarak uygulayabilirsiniz.",
    });
  };

  const leftKeys = dssKeys.slice(0, 6);
  const rightKeys = dssKeys.slice(6, 12);

  return (
    <div className="h-full w-full overflow-y-auto p-5 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${lightBg} ${text}`}>
            <Phone size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span>Masa Telefonum — Kişisel Tuş, BLF ve Hızlı Arama Tasarımcısı</span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                Dahili {ext}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Masanızdaki fiziksel IP telefonun ekran yanındaki BLF (Meşguliyet Lambası), Hızlı Arama (Speed Dial) ve ekran altı Softkey tuşlarını görsel olarak kendiniz tanımlayın.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            title="Varsayılan Tuş Dizilimine Dön"
          >
            <RotateCcw size={13} />
            <span>Varsayılana Sıfırla</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadConfig}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            title="Masa Telefonu Otoprovizyon Dosyasını (.cfg) İndir"
          >
            <Download size={13} />
            <span>.CFG İndir</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAndApply}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-md transition cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
          >
            <Save size={14} />
            <span>
              {saving ? "Masa Telefonuna Gönderiliyor..." : "Masa Telefonuma Kaydet & Uygula"}
            </span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Grid: Left = Visual IP Desk Phone Simulator, Right = Selected Key Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* LEFT 7 COLS: INTERACTIVE IP DESK PHONE HARDWARE SIMULATOR         */}
        {/* ================================================================= */}
        <div className="xl:col-span-7 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl text-white flex flex-col gap-4">
          {/* Phone Top Chassis Header */}
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black tracking-wider uppercase text-slate-300">
                {brand} {model} — Canlı Ekran Önizlemesi
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              Düzenlemek istediğiniz tuşa tıklayın
            </span>
          </div>

          {/* Phone Body: Left DSS Keys + Center Color LCD Screen + Right DSS Keys */}
          <div className="grid grid-cols-12 gap-2.5 items-stretch">
            {/* Left Physical Line/DSS Keys (1 - 6) */}
            <div className="col-span-3 flex flex-col justify-between gap-2 py-2">
              {leftKeys.map((k) => {
                const isSel =
                  selectedKey.category === "dss" && selectedKey.index === k.key_index;
                const typeMeta =
                  DSS_KEY_TYPES.find((t) => t.id === k.type) || DSS_KEY_TYPES[DSS_KEY_TYPES.length - 1];
                return (
                  <button
                    key={k.key_index}
                    type="button"
                    onClick={() => setSelectedKey({ category: "dss", index: k.key_index })}
                    className={`group flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSel
                        ? "bg-slate-800 border-amber-400 ring-2 ring-amber-400/30 shadow-md"
                        : "bg-slate-800/70 hover:bg-slate-800 border-slate-700/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Tuş {k.key_index} • {typeMeta.short}
                      </div>
                      <div className="text-[11px] font-bold text-slate-100 truncate mt-0.5">
                        {k.label || "Boş Tuş"}
                      </div>
                    </div>
                    <span className={`w-2.5 h-4 rounded-sm shrink-0 shadow-sm ${typeMeta.led}`} />
                  </button>
                );
              })}
            </div>

            {/* Center Color LCD Display */}
            <div className="col-span-6 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-2 border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between shadow-inner min-h-[360px]">
              {/* LCD Top Status Bar */}
              <div className="bg-slate-950/90 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-400">
                  <Phone size={12} />
                  <span>{ext}</span>
                  <span className="text-slate-400 font-semibold truncate max-w-[110px]">
                    ({fullName})
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-300">{clockStr}</div>
              </div>

              {/* LCD Split Key Labels Inside Screen */}
              <div className="flex-1 grid grid-cols-2 gap-x-2 p-2.5 content-between">
                {/* Left Screen Labels (1-6) */}
                <div className="flex flex-col justify-between space-y-1.5">
                  {leftKeys.map((k) => {
                    const isSel =
                      selectedKey.category === "dss" && selectedKey.index === k.key_index;
                    return (
                      <div
                        key={k.key_index}
                        onClick={() => setSelectedKey({ category: "dss", index: k.key_index })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate cursor-pointer border transition ${
                          isSel
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                            : "bg-slate-900/70 border-slate-800/80 text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        {k.label || `---`}
                        {k.value ? (
                          <span className="text-[9px] text-slate-400 ml-1">({k.value})</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Right Screen Labels (7-12) */}
                <div className="flex flex-col justify-between space-y-1.5">
                  {rightKeys.map((k) => {
                    const isSel =
                      selectedKey.category === "dss" && selectedKey.index === k.key_index;
                    return (
                      <div
                        key={k.key_index}
                        onClick={() => setSelectedKey({ category: "dss", index: k.key_index })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate text-right cursor-pointer border transition ${
                          isSel
                            ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                            : "bg-slate-900/70 border-slate-800/80 text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        {k.value ? (
                          <span className="text-[9px] text-slate-400 mr-1">({k.value})</span>
                        ) : null}
                        {k.label || `---`}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LCD Bottom Softkey Bar (Softkeys 1 - 4) */}
              <div className="bg-slate-950/95 border-t border-slate-800 grid grid-cols-4 divide-x divide-slate-800">
                {softKeys.map((sk) => {
                  const isSel =
                    selectedKey.category === "soft" && selectedKey.index === sk.key_index;
                  return (
                    <button
                      key={sk.key_index}
                      type="button"
                      onClick={() => setSelectedKey({ category: "soft", index: sk.key_index })}
                      className={`py-2 px-1 text-center text-[10px] font-extrabold truncate transition cursor-pointer ${
                        isSel
                          ? "bg-amber-500 text-slate-950"
                          : "text-sky-300 hover:bg-slate-900"
                      }`}
                    >
                      {sk.label || `Alt Tuş ${sk.key_index}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Physical Line/DSS Keys (7 - 12) */}
            <div className="col-span-3 flex flex-col justify-between gap-2 py-2">
              {rightKeys.map((k) => {
                const isSel =
                  selectedKey.category === "dss" && selectedKey.index === k.key_index;
                const typeMeta =
                  DSS_KEY_TYPES.find((t) => t.id === k.type) || DSS_KEY_TYPES[DSS_KEY_TYPES.length - 1];
                return (
                  <button
                    key={k.key_index}
                    type="button"
                    onClick={() => setSelectedKey({ category: "dss", index: k.key_index })}
                    className={`group flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSel
                        ? "bg-slate-800 border-amber-400 ring-2 ring-amber-400/30 shadow-md"
                        : "bg-slate-800/70 hover:bg-slate-800 border-slate-700/80"
                    }`}
                  >
                    <span className={`w-2.5 h-4 rounded-sm shrink-0 shadow-sm ${typeMeta.led}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Tuş {k.key_index} • {typeMeta.short}
                      </div>
                      <div className="text-[11px] font-bold text-slate-100 truncate mt-0.5">
                        {k.label || "Boş Tuş"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Physical Softkey Buttons Row Beneath LCD */}
          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-3" />
            <div className="col-span-6 grid grid-cols-4 gap-2 px-1">
              {softKeys.map((sk) => {
                const isSel =
                  selectedKey.category === "soft" && selectedKey.index === sk.key_index;
                return (
                  <button
                    key={sk.key_index}
                    type="button"
                    onClick={() => setSelectedKey({ category: "soft", index: sk.key_index })}
                    className={`h-6 rounded-lg border text-[10px] font-black transition cursor-pointer ${
                      isSel
                        ? "bg-amber-400 text-slate-950 border-amber-300"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                    title={`Ekran Altı Softkey ${sk.key_index}`}
                  >
                    F{sk.key_index}
                  </button>
                );
              })}
            </div>
            <div className="col-span-3" />
          </div>

          {/* LED Legend */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Hat / BLF (Meşguliyet Lambası)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Speed Dial (Hızlı Arama)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              DND (Rahatsız Etmeyin)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Aktar / Beklet
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT 5 COLS: SELECTED KEY CONFIGURATION & DEVICE SETTINGS        */}
        {/* ================================================================= */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Selected Key Editor Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                  <Sliders size={17} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide">
                    {selectedKey.category === "dss"
                      ? `Yan Programlanabilir Tuş #${selectedKey.index} Ayarı`
                      : `Ekran Altı Fonksiyon Tuşu (Softkey F${selectedKey.index})`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Seçili tuşun görevini, takip edeceği dahiliyi veya hızlı arama numarasını belirleyin.
                  </p>
                </div>
              </div>
            </div>

            {selectedKey.category === "dss" ? (
              <div className="space-y-4">
                {/* 1. Key Function Type */}
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1.5">
                    1. Tuş Özelliği / Görevi (Key Type)
                  </label>
                  <select
                    value={currentEditingItem.type || "none"}
                    onChange={(e) => updateCurrentKeyField("type", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                  >
                    {DSS_KEY_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {DSS_KEY_TYPES.find((t) => t.id === currentEditingItem.type)?.desc}
                  </p>
                </div>

                {/* Quick Directory Picker when BLF is chosen */}
                {currentEditingItem.type === "blf" && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-2.5">
                    <label className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Users size={14} />
                      <span>Rehberden Dahili Personel Seç (Otomatik Doldur)</span>
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const chosenExt = e.target.value;
                        if (!chosenExt) return;
                        const foundUser = directoryUsers.find(
                          (u) => String(u.extension) === String(chosenExt)
                        );
                        updateCurrentKeyField("value", String(chosenExt));
                        if (foundUser) {
                          updateCurrentKeyField("label", foundUser.name || `Dahili ${chosenExt}`);
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="">— İzlenecek iş arkadaşınızı seçin —</option>
                      {directoryUsers
                        .filter((u) => String(u.extension) !== ext)
                        .map((u) => (
                          <option key={u.extension} value={u.extension}>
                            Dahili {u.extension} — {u.name} {u.department ? `(${u.department})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Quick Speed Dial Picker when speed_dial is chosen */}
                {currentEditingItem.type === "speed_dial" && speedDials.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 space-y-2">
                    <label className="text-[11px] font-extrabold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                      <Zap size={14} />
                      <span>Kurumsal Hızlı Aramalardan Seç (Opsiyonel)</span>
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const chosenNum = e.target.value;
                        if (!chosenNum) return;
                        const foundSd = speedDials.find(
                          (s) => String(s.number || s.destination) === String(chosenNum)
                        );
                        updateCurrentKeyField("value", String(chosenNum));
                        if (foundSd) {
                          updateCurrentKeyField("label", foundSd.name || foundSd.label || chosenNum);
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="">— Kayıtlı hızlı aramalardan seçin veya aşağıya yazın —</option>
                      {speedDials.map((sd, i) => {
                        const num = sd.number || sd.destination || "";
                        return (
                          <option key={i} value={num}>
                            {sd.name || sd.label || "Kısayol"} ({num})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* 2. Key Label on LCD Screen */}
                {currentEditingItem.type !== "none" && (
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                      2. Telefon Ekranında Görünecek İsim (Etiket / Label)
                    </label>
                    <input
                      type="text"
                      value={currentEditingItem.label || ""}
                      onChange={(e) => updateCurrentKeyField("label", e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz, Muhasebe, Cep..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}

                {/* 3. Target Extension / Phone Number */}
                {["blf", "speed_dial", "transfer", "conference", "voicemail", "line"].includes(
                  currentEditingItem.type
                ) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className={currentEditingItem.type === "blf" ? "md:col-span-2" : "md:col-span-3"}>
                      <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                        3. Hedef Dahili veya Telefon Numarası
                      </label>
                      <input
                        type="text"
                        value={currentEditingItem.value || ""}
                        onChange={(e) => updateCurrentKeyField("value", e.target.value)}
                        placeholder={
                          currentEditingItem.type === "blf"
                            ? "Örn: 1002"
                            : "Örn: 1005 veya 05321234567"
                        }
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {currentEditingItem.type === "blf" && (
                      <div>
                        <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                          Çağrı Çekme Kodu
                        </label>
                        <input
                          type="text"
                          value={currentEditingItem.pickup_code || "*8"}
                          onChange={(e) => updateCurrentKeyField("pickup_code", e.target.value)}
                          placeholder="*8"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Softkey Editor (F1 - F4) */
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1.5">
                    1. Ekran Altı Tuş İşlevi (Softkey Type)
                  </label>
                  <select
                    value={currentEditingItem.type || "history"}
                    onChange={(e) => updateCurrentKeyField("type", e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {SOFTKEY_TYPES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                    2. Ekranda Görünecek Tuş Başlığı
                  </label>
                  <input
                    type="text"
                    value={currentEditingItem.label || ""}
                    onChange={(e) => updateCurrentKeyField("label", e.target.value)}
                    placeholder="Örn: Geçmiş, Rehber, DND..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>

                {["speed_dial", "transfer"].includes(currentEditingItem.type) && (
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 block mb-1">
                      3. Hedef Numara / Dahili
                    </label>
                    <input
                      type="text"
                      value={currentEditingItem.value || ""}
                      onChange={(e) => updateCurrentKeyField("value", e.target.value)}
                      placeholder="Örn: 1000 veya 0532..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desk Phone Model & Provisioning Info Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <Monitor size={15} className={text} />
              <span>Masa Telefonu Cihaz Bilgileri</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Telefon Marka / Modeli
                </label>
                <select
                  value={`${brand}:${model}`}
                  onChange={(e) => {
                    const [b, m] = e.target.value.split(":");
                    setBrand(b || "Yealink");
                    setModel(m || "T46U");
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  {PHONE_MODELS.map((pm) => (
                    <option key={pm.value} value={pm.value}>
                      {pm.brand} — {pm.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Cihaz MAC Adresi (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value)}
                  placeholder="00:15:65:aa:bb:cc"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Telefon IP Adresi (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.105"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
