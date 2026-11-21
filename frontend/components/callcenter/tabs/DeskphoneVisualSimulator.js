import React from "react";
import {
  Phone,
  Headphones,
  BellOff,
  PhoneCall,
  Sparkles,
  Plus,
  Trash2,
  Layers,
  Volume2,
  MicOff,
  Voicemail,
  ChevronLeft,
  ChevronRight,
  Users,
  Wand2,
  Lock,
} from "lucide-react";

export const DSS_KEY_TYPES = [
  {
    id: "blf",
    name: "BLF (Meşguliyet Lambası & Çağrı Çekme)",
    short: "BLF",
    led: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    needsTarget: true,
    supportsAutoName: true,
    desc: "Seçilen dahili abonenin meşgul/müsait durumunu ışıklı gösterir, basıldığında arar veya çalan çağrısını çeker.",
  },
  {
    id: "speed_dial",
    name: "Hızlı Arama (Speed Dial)",
    short: "Hızlı Ara",
    led: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    needsTarget: true,
    supportsAutoName: true,
    desc: "Sık aranan bir dahili veya dış telefon numarasını tek tuşla arar.",
  },
  {
    id: "line",
    name: "Hat Tuşu (Line)",
    short: "Hat",
    led: "bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.75)]",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Kendi dahili hattınız üzerinden çağrı başlatır veya gelen çağrıyı yanıtlar.",
  },
  {
    id: "transfer",
    name: "Çağrı Aktar (Transfer)",
    short: "Aktar",
    led: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    needsTarget: true,
    supportsAutoName: true,
    desc: "Aktif görüşmeyi belirtilen dahiliye veya numaraya tek tuşla aktarır.",
  },
  {
    id: "intercom",
    name: "Dahili Anons / Intercom",
    short: "Intercom",
    led: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    needsTarget: true,
    supportsAutoName: true,
    desc: "Karşı dahiliyi otomatik hoparlörden açarak anlık dahili anons yapar.",
  },
  {
    id: "park",
    name: "Çağrı Park Etme (Call Park)",
    short: "Park",
    led: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]",
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    needsTarget: true,
    supportsAutoName: false,
    desc: "Çağrıyı park yuvasına (örn. 700 / 701) alır; başka telefondan devralınabilir.",
  },
  {
    id: "pickup",
    name: "Grup Çağrı Çekme (Pickup)",
    short: "Çek",
    led: "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]",
    badge: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Grubunuzda çalan başka bir telefonu (*8) tek tuşla kendi telefonunuza çeker.",
  },
  {
    id: "forward",
    name: "Çağrı Yönlendir (Forward)",
    short: "Yönlendir",
    led: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    needsTarget: true,
    supportsAutoName: true,
    desc: "Gelen çağrıları belirlenen dahili veya cep numarasına tek tuşla yönlendirir.",
  },
  {
    id: "dnd",
    name: "Rahatsız Etmeyin (DND)",
    short: "DND",
    led: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.85)]",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Masa telefonunu Rahatsız Etmeyin (DND) moduna alır veya çıkarır.",
  },
  {
    id: "hold",
    name: "Çağrı Beklet (Hold)",
    short: "Beklet",
    led: "bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.7)]",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Aktif görüşmeyi beklemeye alır veya beklemeden çıkarır.",
  },
  {
    id: "voicemail",
    name: "Sesli Posta (*97)",
    short: "Mesaj",
    led: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Sesli posta kutunuzu (*97) tek tuşla dinlemenizi sağlar.",
  },
  {
    id: "conference",
    name: "Konferans (Conference)",
    short: "Konferans",
    led: "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Çoklu konferans görüşmesi başlatır.",
  },
  {
    id: "dtmf",
    name: "DTMF / Kısayol Kodu",
    short: "DTMF",
    led: "bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.7)]",
    badge: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    needsTarget: true,
    supportsAutoName: false,
    desc: "Görüşme sırasında sabit DTMF tuş dizisi gönderir (örn. kapı açma kodu).",
  },
  {
    id: "none",
    name: "Boş / Atanmamış",
    short: "Boş",
    led: "bg-slate-600/70",
    badge: "bg-slate-800 text-slate-400 border-slate-700",
    needsTarget: false,
    supportsAutoName: false,
    desc: "Bu tuşta herhangi bir işlem tanımlı değil.",
  },
];

export const SOFTKEY_TYPES = [
  { id: "history", name: "Çağrı Geçmişi (History)", defaultLabel: "Geçmiş" },
  { id: "directory", name: "Kurumsal Rehber (Directory)", defaultLabel: "Rehber" },
  { id: "dnd", name: "Rahatsız Etmeyin (DND)", defaultLabel: "DND" },
  { id: "transfer", name: "Çağrı Aktar (Transfer)", defaultLabel: "Aktar" },
  { id: "forward", name: "Yönlendir (Forward)", defaultLabel: "Yönlendir" },
  { id: "speed_dial", name: "Özel Hızlı Arama (Speed Dial)", defaultLabel: "Hızlı Ara" },
  { id: "redial", name: "Son Numarayı Ara (Redial)", defaultLabel: "Tekrar Ara" },
  { id: "pickup", name: "Çağrı Çek (*8)", defaultLabel: "Çek" },
  { id: "voicemail", name: "Sesli Posta (*97)", defaultLabel: "Mesajlar" },
  { id: "menu", name: "Telefon Menüsü (Menu)", defaultLabel: "Menü" },
];

const BRAND_ACCENTS = {
  Yealink: { chassis: "from-slate-800 via-slate-900 to-slate-950", badge: "text-sky-300", screenBg: "from-slate-900 via-[#0d1b2a] to-slate-950" },
  Grandstream: { chassis: "from-zinc-800 via-zinc-900 to-black", badge: "text-blue-300", screenBg: "from-slate-900 via-[#0c1930] to-slate-950" },
  Fanvil: { chassis: "from-slate-800 via-neutral-900 to-slate-950", badge: "text-emerald-300", screenBg: "from-slate-900 via-[#0b1f24] to-slate-950" },
  Cisco: { chassis: "from-neutral-800 via-neutral-900 to-black", badge: "text-cyan-300", screenBg: "from-slate-900 via-[#0a1c2e] to-slate-950" },
};

function getTypeMeta(typeId) {
  return DSS_KEY_TYPES.find((t) => t.id === typeId) || DSS_KEY_TYPES[DSS_KEY_TYPES.length - 1];
}

function formatPreviewTime(timeFormat) {
  const now = new Date();
  if (timeFormat === "12") {
    return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatPreviewDate(dateFormat) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  if (dateFormat === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (dateFormat === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  if (dateFormat === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
  return `${dd}.${mm}.${yyyy}`;
}

export default function DeskphoneVisualSimulator({
  brand = "Yealink",
  model = "T46U",
  modelSpec,
  ext = "1000",
  fullName = "Kullanıcı",
  dssKeys = [],
  softKeys = [],
  expansionModules = [],
  expansionCatalog = {},
  phonePrefs = {},
  extNameMap = {},
  selectedKey,
  onSelectKey,
  activeDssPage = 1,
  onChangeDssPage,
  activeExpModuleIndex = 1,
  onChangeExpModuleIndex,
  activeExpPage = 1,
  onChangeExpPage,
  onAddExpansionModule,
  onRequestDeleteExpansionModule,
  onOpenAutoFillModal,
  liveOnline = false,
}) {
  const spec = modelSpec || {
    brand,
    model,
    screen: "color",
    layout: "split",
    dss_per_page: 10,
    dss_pages: 3,
    max_dss: 27,
    soft_keys: 4,
    expansion_model: "EXP43",
    max_expansions: 3,
  };

  const brandStyle = BRAND_ACCENTS[brand] || BRAND_ACCENTS.Yealink;
  const isMono = spec.screen === "mono";
  const isTouch = spec.screen === "touch" || spec.layout === "touch_grid";
  const isDualScreen = spec.screen === "dual_screen" || spec.layout === "side_mpk";
  const isLeftOnly = spec.layout === "left_only" || spec.layout === "compact";

  const dssPerPage = Math.max(2, Number(spec.dss_per_page || 10));
  const totalPages = Math.max(1, Number(spec.dss_pages || 1));
  const safePage = Math.min(totalPages, Math.max(1, activeDssPage));
  const startIdx = (safePage - 1) * dssPerPage;
  const pageKeys = dssKeys.slice(startIdx, startIdx + dssPerPage);

  const halfCount = Math.ceil(pageKeys.length / 2);
  const leftKeys = isLeftOnly ? pageKeys : pageKeys.slice(0, halfCount);
  const rightKeys = isLeftOnly ? [] : pageKeys.slice(halfCount);

  const brightnessPct = Math.max(45, Math.min(100, 40 + Number(phonePrefs.backlight_active || 8) * 6));
  const headerDisplayLabel = phonePrefs.screen_label?.trim() || `${ext} • ${fullName}`;
  const timeStr = formatPreviewTime(phonePrefs.time_format || "24");
  const dateStr = formatPreviewDate(phonePrefs.date_format || "DD.MM.YYYY");

  const resolveKeyDisplay = (k) => {
    if (!k) return { label: "Boş", isAuto: false };
    const isAuto = k.label_mode === "auto" && k.value && extNameMap[String(k.value).trim()];
    const resolvedLabel = isAuto ? extNameMap[String(k.value).trim()] : k.label;
    return {
      label: resolvedLabel || (k.type === "none" ? "Boş" : getTypeMeta(k.type).short),
      isAuto: Boolean(isAuto),
    };
  };

  const activeExpMod =
    expansionModules.find((m) => Number(m.module_index) === Number(activeExpModuleIndex)) ||
    expansionModules[0] ||
    null;
  const activeExpSpec = activeExpMod
    ? expansionCatalog[activeExpMod.model] || { keys_per_page: 20, pages: 3, total_keys: 60, screen: "color", name: activeExpMod.model }
    : null;
  const expPerPage = activeExpSpec ? Number(activeExpSpec.keys_per_page || 20) : 20;
  const expPages = activeExpSpec ? Number(activeExpSpec.pages || 3) : 3;
  const safeExpPage = Math.min(expPages, Math.max(1, activeExpPage));
  const expPageKeys = activeExpMod
    ? (activeExpMod.keys || []).slice((safeExpPage - 1) * expPerPage, safeExpPage * expPerPage)
    : [];
  const expLeftKeys = expPageKeys.slice(0, Math.ceil(expPageKeys.length / 2));
  const expRightKeys = expPageKeys.slice(Math.ceil(expPageKeys.length / 2));

  const maxExpAllowed = Number(spec.max_expansions || 0);
  const canAddExpansion = maxExpAllowed > 0 && expansionModules.length < maxExpAllowed;

  const renderPhysicalDssBtn = (k, side = "left") => {
    const isSel = selectedKey?.category === "dss" && Number(selectedKey?.index) === Number(k.key_index);
    const meta = getTypeMeta(k.type);
    const disp = resolveKeyDisplay(k);
    return (
      <button
        key={k.key_index}
        type="button"
        onClick={() => onSelectKey({ category: "dss", index: k.key_index })}
        className={`group w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
          side === "right" ? "flex-row-reverse text-right" : ""
        } ${
          isSel
            ? "bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/35 shadow-md"
            : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/80"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
            <span>T{k.key_index}</span>
            <span>•</span>
            <span className="truncate">{meta.short}</span>
            {Number(k.key_index) === 1 && (
              <Lock size={8} className="text-amber-400 shrink-0" title="Kilitli Ana Hat (Line 1)" />
            )}
            {disp.isAuto && <Sparkles size={8} className="text-emerald-400 shrink-0" title="İsim santralden otomatik çekiliyor" />}
          </div>
          <div className="text-[10px] font-bold text-slate-100 truncate mt-0.5">{disp.label}</div>
        </div>
        <span className={`w-2 h-3.5 rounded-sm shrink-0 ${meta.led}`} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Main Interactive Chassis + Optional Daisy-Chained Sidecars */}
      <div className={`grid gap-4 items-stretch ${expansionModules.length > 0 ? "grid-cols-1 2xl:grid-cols-12" : "grid-cols-1"}`}>
        {/* ============================================================ */}
        {/* MAIN IP DESK PHONE HARDWARE CHASSIS                          */}
        {/* ============================================================ */}
        <div
          className={`${
            expansionModules.length > 0 ? "2xl:col-span-7" : ""
          } bg-gradient-to-b ${brandStyle.chassis} border border-slate-700/80 rounded-[28px] p-4 shadow-2xl text-white flex flex-col gap-3 relative overflow-hidden`}
        >
          {/* Top Hardware Bezel Header */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  liveOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                    : "bg-amber-400/80"
                }`}
                title={liveOnline ? "Cihaz Asterisk'e kayıtlı (Online)" : "Cihaz çevrimdışı / kayıt bekleniyor"}
              />
              <span className={`text-xs font-black tracking-wider uppercase truncate ${brandStyle.badge}`}>
                {brand} {model}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[9px] font-bold text-slate-300 uppercase shrink-0">
                {isMono ? "Monokrom LCD" : isTouch ? "Dokunmatik" : isDualScreen ? "Çift Ekran" : "Renkli LCD"}
              </span>
            </div>

            {/* Power / MWI / Missed Call Physical Hardware LED */}
            <div className="flex items-center gap-2 shrink-0">
              {phonePrefs.mwi_led && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[9px] font-bold text-rose-300" title="Sesli Posta / Cevapsız Çağrı LED'i Aktif">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  LED
                </span>
              )}
              {totalPages > 1 && (
                <div className="inline-flex items-center gap-1 bg-slate-950/80 border border-slate-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeDssPage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span className="text-[10px] font-extrabold text-amber-300 px-1.5">
                    Sayfa {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeDssPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Phone Body: Sculpted Handset (Left) + LCD & Keys Console (Right) */}
          <div className="grid grid-cols-12 gap-3 items-stretch">
            {/* Sculpted Realistic Handset Silhouette */}
            <div className="hidden sm:flex sm:col-span-2 flex-col items-center justify-between py-3 px-1.5 rounded-3xl bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-800/90 border border-slate-700/70 shadow-inner">
              {/* Earpiece grille */}
              <div className="w-9 h-12 rounded-2xl bg-slate-950/90 border border-slate-700/70 flex flex-col items-center justify-center gap-1 p-1.5">
                <span className="w-5 h-0.5 rounded-full bg-slate-700" />
                <span className="w-6 h-0.5 rounded-full bg-slate-700" />
                <span className="w-5 h-0.5 rounded-full bg-slate-700" />
              </div>
              <div className="w-2 flex-1 my-2 rounded-full bg-gradient-to-b from-slate-800 via-slate-700/50 to-slate-800" />
              {/* Mouthpiece grille */}
              <div className="w-9 h-10 rounded-2xl bg-slate-950/90 border border-slate-700/70 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-slate-700" />
                  ))}
                </div>
              </div>
            </div>

            {/* Console Area: DSS Keys + Live LCD + Softkeys + Dialpad */}
            <div className="col-span-12 sm:col-span-10 flex flex-col gap-2.5">
              {/* Upper Display Module */}
              {isTouch ? (
                /* TOUCHSCREEN LAYOUT (Yealink T48U / T57W / T58W / Fanvil X7) */
                <div
                  style={{ filter: `brightness(${brightnessPct}%)` }}
                  className={`bg-gradient-to-b ${brandStyle.screenBg} border-2 border-slate-600/90 rounded-2xl overflow-hidden flex flex-col shadow-inner`}
                >
                  {/* Touch Status Bar */}
                  <div className="bg-black/60 px-3 py-1.5 border-b border-slate-700/80 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 font-extrabold text-emerald-400 truncate">
                      <Phone size={11} />
                      <span className="truncate">{headerDisplayLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-slate-300 font-mono font-bold">
                      {phonePrefs.dnd_default && <BellOff size={11} className="text-rose-400" />}
                      {phonePrefs.auto_answer && <PhoneCall size={11} className="text-amber-400" />}
                      {phonePrefs.headset_mode !== "rj9" && <Headphones size={11} className="text-sky-400" />}
                      <span>{dateStr}</span>
                      <span>{timeStr}</span>
                    </div>
                  </div>
                  {/* Touch DSS Grid */}
                  <div className="p-2.5 grid grid-cols-2 gap-1.5 min-h-[220px] content-start">
                    {pageKeys.map((k) => renderPhysicalDssBtn(k, "left"))}
                  </div>
                  {/* Touch Bottom Softkeys */}
                  <div className="bg-black/70 border-t border-slate-700/80 grid grid-cols-4 divide-x divide-slate-800">
                    {softKeys.slice(0, spec.soft_keys || 4).map((sk) => {
                      const isSel = selectedKey?.category === "soft" && Number(selectedKey?.index) === Number(sk.key_index);
                      return (
                        <button
                          key={sk.key_index}
                          type="button"
                          onClick={() => onSelectKey({ category: "soft", index: sk.key_index })}
                          className={`py-2 px-1 text-[10px] font-extrabold truncate cursor-pointer transition ${
                            isSel ? "bg-amber-400 text-slate-950" : "text-sky-300 hover:bg-white/5"
                          }`}
                        >
                          {sk.label || `F${sk.key_index}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* PHYSICAL SIDE-KEY + CENTER LCD LAYOUT (T31P / T33G / T43U / T46U / T54W / GRP26xx / Fanvil X4U-X210 / Cisco) */
                <div className="grid grid-cols-12 gap-2 items-stretch">
                  {/* Left Physical Keys */}
                  <div className={`${isLeftOnly ? "col-span-4" : "col-span-3"} flex flex-col justify-between gap-1.5 py-1`}>
                    {leftKeys.map((k) => renderPhysicalDssBtn(k, "left"))}
                  </div>

                  {/* Center LCD Screen */}
                  <div
                    style={{ filter: `brightness(${brightnessPct}%)` }}
                    className={`${isLeftOnly ? "col-span-8" : "col-span-6"} rounded-2xl overflow-hidden flex flex-col justify-between border-2 shadow-inner min-h-[250px] ${
                      isMono
                        ? "bg-gradient-to-b from-[#9fb39f] via-[#8ea58e] to-[#7d957d] border-slate-600 text-slate-950"
                        : `bg-gradient-to-b ${brandStyle.screenBg} border-slate-600/90 text-white`
                    }`}
                  >
                    {/* LCD Top Bar */}
                    <div
                      className={`px-2.5 py-1.5 border-b flex items-center justify-between text-[10px] ${
                        isMono
                          ? "bg-black/15 border-black/20 text-slate-950 font-black"
                          : "bg-black/55 border-slate-700/70 text-emerald-400 font-extrabold"
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <Phone size={10} className="shrink-0" />
                        <span className="truncate">{headerDisplayLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        {phonePrefs.dnd_default && <BellOff size={10} className={isMono ? "text-slate-950" : "text-rose-400"} />}
                        {phonePrefs.auto_answer && <PhoneCall size={10} className={isMono ? "text-slate-950" : "text-amber-300"} />}
                        <span>{timeStr}</span>
                      </div>
                    </div>

                    {/* LCD Middle: Key Labels + Clock/Date Watermark */}
                    <div className="flex-1 p-2 flex flex-col justify-between gap-1.5">
                      <div className={`text-center text-[9px] font-mono ${isMono ? "text-slate-900/80" : "text-slate-400"}`}>
                        {dateStr} • Zil: {String(phonePrefs.ringtone || "Ring1.wav").replace(".wav", "")}
                      </div>

                      <div className={`grid gap-1.5 flex-1 content-center ${isLeftOnly ? "grid-cols-1" : "grid-cols-2"}`}>
                        {/* Left Screen Labels */}
                        <div className="flex flex-col justify-between gap-1">
                          {leftKeys.map((k) => {
                            const isSel = selectedKey?.category === "dss" && Number(selectedKey?.index) === Number(k.key_index);
                            const disp = resolveKeyDisplay(k);
                            return (
                              <div
                                key={k.key_index}
                                onClick={() => onSelectKey({ category: "dss", index: k.key_index })}
                                className={`px-1.5 py-1 rounded text-[9px] font-bold truncate cursor-pointer border transition ${
                                  isSel
                                    ? isMono
                                      ? "bg-slate-950 text-[#9fb39f] border-slate-950"
                                      : "bg-amber-500/25 border-amber-400 text-amber-200"
                                    : isMono
                                    ? "bg-black/10 border-black/15 text-slate-950 hover:bg-black/20"
                                    : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
                                }`}
                              >
                                {disp.label}
                                {k.value ? <span className="opacity-65 ml-1">({k.value})</span> : null}
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Screen Labels */}
                        {!isLeftOnly && (
                          <div className="flex flex-col justify-between gap-1">
                            {rightKeys.map((k) => {
                              const isSel = selectedKey?.category === "dss" && Number(selectedKey?.index) === Number(k.key_index);
                              const disp = resolveKeyDisplay(k);
                              return (
                                <div
                                  key={k.key_index}
                                  onClick={() => onSelectKey({ category: "dss", index: k.key_index })}
                                  className={`px-1.5 py-1 rounded text-[9px] font-bold truncate text-right cursor-pointer border transition ${
                                    isSel
                                      ? isMono
                                        ? "bg-slate-950 text-[#9fb39f] border-slate-950"
                                        : "bg-amber-500/25 border-amber-400 text-amber-200"
                                      : isMono
                                      ? "bg-black/10 border-black/15 text-slate-950 hover:bg-black/20"
                                      : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
                                  }`}
                                >
                                  {k.value ? <span className="opacity-65 mr-1">({k.value})</span> : null}
                                  {disp.label}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LCD Bottom Softkeys Bar */}
                    <div
                      className={`border-t grid divide-x ${
                        (spec.soft_keys || 4) === 3 ? "grid-cols-3" : "grid-cols-4"
                      } ${isMono ? "bg-black/20 border-black/25 divide-black/20" : "bg-black/65 border-slate-700/80 divide-slate-800"}`}
                    >
                      {softKeys.slice(0, spec.soft_keys || 4).map((sk) => {
                        const isSel = selectedKey?.category === "soft" && Number(selectedKey?.index) === Number(sk.key_index);
                        return (
                          <button
                            key={sk.key_index}
                            type="button"
                            onClick={() => onSelectKey({ category: "soft", index: sk.key_index })}
                            className={`py-1.5 px-1 text-center text-[9px] font-extrabold truncate transition cursor-pointer ${
                              isSel
                                ? "bg-amber-400 text-slate-950"
                                : isMono
                                ? "text-slate-950 hover:bg-black/10"
                                : "text-sky-300 hover:bg-white/5"
                            }`}
                          >
                            {sk.label || `F${sk.key_index}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Physical Keys */}
                  {!isLeftOnly && (
                    <div className="col-span-3 flex flex-col justify-between gap-1.5 py-1">
                      {rightKeys.map((k) => renderPhysicalDssBtn(k, "right"))}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Realistic Lower Deck: Softkey Buttons + D-Pad + Numeric Keypad */}
              <div className="pt-2 border-t border-slate-800/90 grid grid-cols-12 gap-3 items-center px-1">
                {/* Navigation D-Pad */}
                <div className="col-span-4 flex flex-col items-center justify-center gap-1.5">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700/80 flex items-center justify-center relative shadow-inner">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 text-[8px] font-black text-slate-300 flex items-center justify-center">
                      OK
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Headphones size={12} className={phonePrefs.headset_mode !== "rj9" ? "text-sky-400" : ""} />
                    <MicOff size={12} />
                    <Voicemail size={12} className={phonePrefs.mwi_led ? "text-purple-400" : ""} />
                    <Volume2 size={12} />
                  </div>
                </div>

                {/* Numeric 3x4 Keypad */}
                <div className="col-span-8 grid grid-cols-3 gap-1">
                  {["1", "2 ABC", "3 DEF", "4 GHI", "5 JKL", "6 MNO", "7 PQRS", "8 TUV", "9 WXYZ", "*", "0", "#"].map((lbl) => (
                    <div
                      key={lbl}
                      className="h-6 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-[9px] font-bold text-slate-300 select-none"
                    >
                      {lbl}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Expansion Module Attachment Bar */}
          <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <Layers size={14} className="text-amber-400" />
              <span className="font-bold">Meşguliyet Modülleri (Sidecar):</span>
              {maxExpAllowed > 0 ? (
                <span className="text-slate-400">
                  {expansionModules.length} / {maxExpAllowed} takılı ({spec.expansion_model})
                </span>
              ) : (
                <span className="text-slate-500">Bu model harici modül desteklemiyor</span>
              )}
            </div>

            {maxExpAllowed > 0 && (
              <button
                type="button"
                disabled={!canAddExpansion}
                onClick={onAddExpansionModule}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-bold transition cursor-pointer"
                title={`${spec.expansion_model} Meşguliyet Modülü Ekle (En fazla ${maxExpAllowed} adet)`}
              >
                <Plus size={13} />
                <span>Modül Ekle ({spec.expansion_model})</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* DAISY-CHAINED EXPANSION MODULE SIDECAR (MODULES 1..4)        */}
        {/* ============================================================ */}
        {expansionModules.length > 0 && activeExpMod && (
          <div className="2xl:col-span-5 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-slate-700/80 rounded-[28px] p-4 shadow-2xl text-white flex flex-col gap-3">
            {/* Module Tabs (Modül 1 .. Modül 4) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {expansionModules.map((mod) => {
                  const isAct = Number(mod.module_index) === Number(activeExpMod.module_index);
                  return (
                    <button
                      key={mod.module_index}
                      type="button"
                      onClick={() => onChangeExpModuleIndex(mod.module_index)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                        isAct
                          ? "bg-amber-400 text-slate-950 shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      Modül #{mod.module_index}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenAutoFillModal(activeExpMod.module_index)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition cursor-pointer"
                  title="Departman veya tüm dahilileri bu modüle otomatik BLF olarak doldur"
                >
                  <Wand2 size={11} />
                  <span>Otomatik Doldur</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDeleteExpansionModule(activeExpMod.module_index)}
                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition cursor-pointer"
                  title={`Modül #${activeExpMod.module_index} Kaldır`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Module Header & Page Switcher */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-[11px] font-black text-amber-300 truncate">
                {activeExpMod.model} • Modül #{activeExpMod.module_index}
              </div>
              <div className="inline-flex items-center gap-1 bg-slate-950/80 border border-slate-700 rounded-lg p-0.5">
                {Array.from({ length: expPages }, (_, idx) => idx + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => onChangeExpPage(pg)}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                      safeExpPage === pg ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    S{pg}
                  </button>
                ))}
              </div>
            </div>

            {/* Sidecar Dual-Column Physical LED Keys + Center LCD */}
            <div
              className={`flex-1 rounded-2xl border-2 p-2 grid grid-cols-2 gap-1.5 shadow-inner ${
                activeExpSpec?.screen === "mono"
                  ? "bg-gradient-to-b from-[#9fb39f] to-[#7d957d] border-slate-600 text-slate-950"
                  : "bg-gradient-to-b from-slate-900 via-[#0d1b2a] to-slate-950 border-slate-700 text-white"
              }`}
            >
              {/* Left 10 keys */}
              <div className="flex flex-col gap-1">
                {expLeftKeys.map((ek) => {
                  const isSel =
                    selectedKey?.category === "exp" &&
                    Number(selectedKey?.moduleIndex) === Number(activeExpMod.module_index) &&
                    Number(selectedKey?.index) === Number(ek.key_index);
                  const meta = getTypeMeta(ek.type);
                  const disp = resolveKeyDisplay(ek);
                  return (
                    <button
                      key={ek.key_index}
                      type="button"
                      onClick={() =>
                        onSelectKey({
                          category: "exp",
                          moduleIndex: activeExpMod.module_index,
                          index: ek.key_index,
                        })
                      }
                      className={`w-full flex items-center justify-between gap-1 px-1.5 py-1 rounded-md border text-left transition cursor-pointer ${
                        isSel
                          ? "bg-amber-400/25 border-amber-400 ring-1 ring-amber-400"
                          : activeExpSpec?.screen === "mono"
                          ? "bg-black/10 border-black/20 hover:bg-black/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span className={`w-1.5 h-3 rounded-sm shrink-0 ${meta.led}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold truncate flex items-center gap-0.5">
                          <span className="opacity-60 mr-0.5">{ek.key_index}.</span>
                          <span className="truncate">{disp.label}</span>
                          {disp.isAuto && <Sparkles size={8} className="text-emerald-400 shrink-0" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right 10 keys */}
              <div className="flex flex-col gap-1">
                {expRightKeys.map((ek) => {
                  const isSel =
                    selectedKey?.category === "exp" &&
                    Number(selectedKey?.moduleIndex) === Number(activeExpMod.module_index) &&
                    Number(selectedKey?.index) === Number(ek.key_index);
                  const meta = getTypeMeta(ek.type);
                  const disp = resolveKeyDisplay(ek);
                  return (
                    <button
                      key={ek.key_index}
                      type="button"
                      onClick={() =>
                        onSelectKey({
                          category: "exp",
                          moduleIndex: activeExpMod.module_index,
                          index: ek.key_index,
                        })
                      }
                      className={`w-full flex items-center justify-between gap-1 px-1.5 py-1 rounded-md border text-right transition cursor-pointer ${
                        isSel
                          ? "bg-amber-400/25 border-amber-400 ring-1 ring-amber-400"
                          : activeExpSpec?.screen === "mono"
                          ? "bg-black/10 border-black/20 hover:bg-black/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold truncate flex items-center justify-end gap-0.5">
                          {disp.isAuto && <Sparkles size={8} className="text-emerald-400 shrink-0" />}
                          <span className="truncate">{disp.label}</span>
                          <span className="opacity-60 ml-0.5">.{ek.key_index}</span>
                        </div>
                      </div>
                      <span className={`w-1.5 h-3 rounded-sm shrink-0 ${meta.led}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-1">
                <Users size={11} className="text-emerald-400" />
                {(activeExpMod.keys || []).filter((k) => k.type !== "none").length} / {activeExpSpec?.total_keys || 60} tuş dolu
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <Sparkles size={10} /> Otomatik isimler santralle senkron
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
