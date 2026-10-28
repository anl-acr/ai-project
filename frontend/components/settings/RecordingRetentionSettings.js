import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Save,
  CheckCircle,
  ShieldAlert,
  Mic,
  Sparkles,
  Plus,
  X,
  Users,
  Headphones,
  UserCheck,
  ShieldCheck,
  FileText,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const KEEP_PRESETS = [
  "ses kaydını aktif et",
  "ses kaydını başlat",
  "kayıt altına alınsın",
  "görüşmeyi kaydet",
  "ses kaydını onaylıyorum",
];

const DELETE_PRESETS = [
  "ses kaydını sil",
  "kayıt istemiyorum",
  "ses kaydını kapat",
  "kaydı durdur",
  "kayıt alınmasın",
];

export default function RecordingRetentionSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [writePermission, setWritePermission] = useState(false);

  // Standard Retention States
  const [deleteByDisk, setDeleteByDisk] = useState(true);
  const [diskThresholdPct, setDiskThresholdPct] = useState(80);
  const [deleteByDays, setDeleteByDays] = useState(false);
  const [keepDays, setKeepDays] = useState(90);

  // Dynamic Voice Recording States
  const [dynamicRecordingEnabled, setDynamicRecordingEnabled] = useState(false);
  const [dynamicMode, setDynamicMode] = useState("keep_on_match"); // "keep_on_match" | "delete_on_match"
  const [dynamicSpeaker, setDynamicSpeaker] = useState("both"); // "both" | "agent" | "caller"
  const [dynamicKeywords, setDynamicKeywords] = useState([
    "ses kaydını aktif et",
    "ses kaydını başlat",
    "kayıt altına alınsın",
    "görüşmeyi kaydet",
  ]);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [keepIfNoTranscript, setKeepIfNoTranscript] = useState(true);
  const [keepTranscriptOnDelete, setKeepTranscriptOnDelete] = useState(true);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    const fetchSettingsAndPermissions = async () => {
      setLoading(true);
      try {
        const resStatus = await fetch(`${API_BASE}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          setWritePermission(true);
        } else {
          const resUsers = await fetch(`${API_BASE}/api/settings/users`);
          const usersData = await resUsers.json();
          const currentUser = usersData.find((u) => u.id === statusData.user_id);
          if (currentUser) {
            const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
            const rolesData = await resRoles.json();
            const currentRole = rolesData.find((r) => r.role_code === currentUser.role);
            if (currentRole) {
              setWritePermission(currentRole.permissions.includes("recording_retention:write"));
            } else {
              setWritePermission(true);
            }
          } else {
            setWritePermission(true);
          }
        }

        const resSettings = await fetch(`${API_BASE}/api/settings/recording-retention`);
        if (resSettings.ok) {
          const data = await resSettings.json();
          setDeleteByDisk(data.delete_by_disk ?? true);
          setDiskThresholdPct(data.disk_threshold_pct ?? 80);
          setDeleteByDays(data.delete_by_days ?? false);
          setKeepDays(data.keep_days ?? 90);
          setDynamicRecordingEnabled(Boolean(data.dynamic_recording_enabled));
          setDynamicMode(data.dynamic_mode || "keep_on_match");
          setDynamicSpeaker(data.dynamic_speaker || "both");
          if (Array.isArray(data.dynamic_keywords)) {
            setDynamicKeywords(data.dynamic_keywords);
          }
          setKeepIfNoTranscript(data.keep_if_no_transcript ?? true);
          setKeepTranscriptOnDelete(data.keep_transcript_on_delete ?? true);
        }
      } catch (err) {
        console.error("Ses kayıt ayarları yüklenirken hata:", err);
        setWritePermission(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSettingsAndPermissions();
  }, [backendHost]);

  const handleAddKeyword = (phrase) => {
    if (!writePermission) return;
    const cleaned = String(phrase ?? newKeywordInput)
      .trim()
      .replace(/\s+/g, " ");
    if (!cleaned) return;
    const exists = dynamicKeywords.some((k) => k.toLowerCase() === cleaned.toLowerCase());
    if (!exists) {
      setDynamicKeywords((prev) => [...prev, cleaned]);
    }
    if (phrase === undefined) {
      setNewKeywordInput("");
    }
  };

  const handleRemoveKeyword = (targetKw) => {
    if (!writePermission) return;
    setDynamicKeywords((prev) => prev.filter((k) => k !== targetKw));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!writePermission) return;
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delete_by_disk: deleteByDisk,
          disk_threshold_pct: parseInt(diskThresholdPct) || 80,
          delete_by_days: deleteByDays,
          keep_days: parseInt(keepDays) || 90,
          dynamic_recording_enabled: dynamicRecordingEnabled,
          dynamic_mode: dynamicMode,
          dynamic_speaker: dynamicSpeaker,
          dynamic_keywords: dynamicKeywords,
          keep_if_no_transcript: keepIfNoTranscript,
          keep_transcript_on_delete: keepTranscriptOnDelete,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Ses kayıt ayarları kaydedilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const activePresets = dynamicMode === "delete_on_match" ? DELETE_PRESETS : KEEP_PRESETS;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 ${lightBg} ${text} rounded-xl flex items-center justify-center shrink-0`}>
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-100">
              Ses Kayıt Saklama ve Dinamik Kayıt Politikası
            </h3>
            <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              Voice Recording Lifecycle & Dynamic Keyword Retention
            </p>
          </div>
        </div>

        {/* Live Mode Status Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
            dynamicRecordingEnabled
              ? `${lightBg} ${text} ${borderLight}`
              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dynamicRecordingEnabled ? `${bg} animate-pulse` : "bg-emerald-500"
            }`}
          />
          <span>
            {dynamicRecordingEnabled
              ? "Dinamik Ses Kaydı Aktif (Kelime Tetiklemeli)"
              : "Standart Kayıt Aktif (Her Çağrıyı Kaydet)"}
          </span>
        </div>
      </div>

      {!writePermission && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert size={16} className={text} />
          <span>Düzenleme yetkiniz bulunmamaktadır. Ayarları sadece görüntüleyebilirsiniz.</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle size={16} />
          <span>Ses kayıt saklama ve dinamik kayıt politikası ayarları başarıyla kaydedildi.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* =================================================================== */}
        {/* SECTION 1: DYNAMIC VOICE RECORDING (ANAHTAR KELİME TETİKLEMELİ)      */}
        {/* =================================================================== */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
            dynamicRecordingEnabled
              ? `bg-slate-50/80 dark:bg-slate-900/90 ${border}`
              : "bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  dynamicRecordingEnabled
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                    Dinamik Ses Kaydı (Anahtar Kelime Tetiklemeli)
                  </h4>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                      dynamicRecordingEnabled
                        ? `${lightBg} ${text} border ${borderLight}`
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {dynamicRecordingEnabled ? "AÇIK" : "KAPALI"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {dynamicRecordingEnabled
                    ? "Dinamik ses kaydı AÇIK: Çağrılar 00:00 saniyeden itibaren kaydedilir. Görüşme bittiğinde konuşma metni (STT) taranır; belirlediğiniz tetikleyici kelime kuralına göre ses kaydı saklanır veya otomatik silinir."
                    : "Dinamik ses kaydı KAPALI: Sistem standart modda çalışır. Kullanıcı ayarlarında (Kullanıcılar > Özellikler > Ses Kayıt) ses kaydı açık olan kullanıcıların ve AI asistanların tüm çağrıları eksiksiz kaydedilir."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!writePermission}
              onClick={() => setDynamicRecordingEnabled((prev) => !prev)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title={dynamicRecordingEnabled ? "Dinamik Ses Kaydını Kapat" : "Dinamik Ses Kaydını Aç"}
            >
              {dynamicRecordingEnabled ? (
                <ToggleRight size={36} className={text} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {/* Standard Mode Reassurance Banner when Dynamic Recording is OFF */}
          {!dynamicRecordingEnabled && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs">
              <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-extrabold">Standart Kayıt Güvencesi: </span>
                <span>
                  Dinamik ses kaydı kapalı olduğu sürece hiçbir çağrı kelime filtresine takılmaz.{" "}
                  <strong>Kullanıcılar</strong> ekranında <strong>Ses Kayıt</strong> özelliği açık olan tüm dahililerin
                  ve AI temsilcilerin ses kayıtları %100 oranında saklanır.
                </span>
              </div>
            </div>
          )}

          {/* Full Dynamic Recording Configuration Panel when ON */}
          {dynamicRecordingEnabled && (
            <div className="space-y-5 pt-2 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in duration-200">
              {/* 1. Operating Mode Selector (Opt-In vs Opt-Out) */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  1. Dinamik Kayıt Çalışma Modu
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setDynamicMode("keep_on_match")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      dynamicMode === "keep_on_match"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        dynamicMode === "keep_on_match"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 1: Sadece Tetikleyici Geçerse Sakla (Opt-In)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Çağrı içinde aşağıdaki anahtar kelimelerden biri{" "}
                        <strong>geçerse ses kaydı saklanır</strong>; geçmezse çağrı sonunda ses dosyası{" "}
                        <strong>otomatik silinir</strong>.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setDynamicMode("delete_on_match")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      dynamicMode === "delete_on_match"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        dynamicMode === "delete_on_match"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <Trash2 size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 2: Tetikleyici Geçerse Sil (Opt-Out / KVKK)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Varsayılan olarak tüm çağrılar saklanır; ancak çağrı içinde silme tetikleyicisi (örn.{" "}
                        <em>&ldquo;ses kaydını sil&rdquo;</em>) <strong>geçerse ses kaydı silinir</strong>.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Speaker Filter Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  2. Konuşmacı Yetkisi (Kelimeyi Kim Söylediğinde Geçerli Olsun?)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "both",
                      title: "Herhangi Biri (Temsilci veya Müşteri)",
                      desc: "Temsilci, AI Asistan veya Müşteri söylediğinde kural tetiklenir.",
                      icon: Users,
                    },
                    {
                      id: "agent",
                      title: "Sadece Temsilci / AI Söylediğinde",
                      desc: "Sadece müşteri temsilcisi veya AI asistan söylediğinde geçerli olur.",
                      icon: Headphones,
                    },
                    {
                      id: "caller",
                      title: "Sadece Müşteri Söylediğinde",
                      desc: "Sadece arayan müşteri/karşı taraf söylediğinde geçerli olur.",
                      icon: UserCheck,
                    },
                  ].map((spkOpt) => {
                    const IconComp = spkOpt.icon;
                    const isSelected = dynamicSpeaker === spkOpt.id;
                    return (
                      <button
                        key={spkOpt.id}
                        type="button"
                        disabled={!writePermission}
                        onClick={() => setDynamicSpeaker(spkOpt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                            : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          <IconComp size={15} />
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                            {spkOpt.title}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {spkOpt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Trigger Keywords & Phrases */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Mic size={14} className={text} />
                      <span>
                        3. Tetikleyici Anahtar Kelime ve Cümleler ({dynamicKeywords.length} Adet)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Çağrı transkriptinde bu ifadelerden <strong>herhangi biri</strong> geçtiğinde kural tetiklenir (büyük/küçük harf ve Türkçe karakter duyarsız).
                    </p>
                  </div>
                </div>

                {/* Add new keyword input + Unified Red Plus Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newKeywordInput}
                    disabled={!writePermission}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder={
                      dynamicMode === "keep_on_match"
                        ? "Örn: ses kaydını aktif et, kaydı başlat, görüşmeyi kaydet..."
                        : "Örn: ses kaydını sil, kayıt istemiyorum..."
                    }
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={!writePermission || !newKeywordInput.trim()}
                    onClick={() => handleAddKeyword()}
                    title="Tetikleyici Kelime / Cümle Ekle"
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition cursor-pointer disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Active Keyword Chips */}
                {dynamicKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {dynamicKeywords.map((kw) => (
                      <span
                        key={kw}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${lightBg} ${text} ${borderLight}`}
                      >
                        <span>&ldquo;{kw}&rdquo;</span>
                        {writePermission && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(kw)}
                            className="hover:opacity-75 transition cursor-pointer"
                            title="Kelimeyi Kaldır"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                    ⚠️ Henüz hiçbir tetikleyici kelime eklenmedi. Güvenlik amacıyla kelime listesi boşken hiçbir ses kaydı silinmez.
                  </div>
                )}

                {/* Preset Quick-Add Suggestions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Hazır Kalıplar:
                  </span>
                  {activePresets.map((preset) => {
                    const alreadyAdded = dynamicKeywords.some(
                      (k) => k.toLowerCase() === preset.toLowerCase()
                    );
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={!writePermission || alreadyAdded}
                        onClick={() => handleAddKeyword(preset)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          alreadyAdded
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-default"
                            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        + {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Safety Locks & Transcript Preservation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Transkript Hatasında Kaydı Koru (Güvenli Mod)
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Görüşmede konuşma olduğu halde teknik bir STT hatası nedeniyle metin çıkarılamazsa ses kaydını silme, koru.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={keepIfNoTranscript}
                    disabled={!writePermission}
                    onChange={(e) => setKeepIfNoTranscript(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer mt-1 shrink-0 disabled:opacity-50"
                  />
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <FileText size={16} className={`${text} shrink-0 mt-0.5`} />
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Ses Silindiğinde Yazılı Transkripti Sakla
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Ses dosyası (.wav) dinamik kural gereği silinse bile çağrının yazılı transkriptini ve AI özetini koru.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={keepTranscriptOnDelete}
                    disabled={!writePermission}
                    onChange={(e) => setKeepTranscriptOnDelete(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer mt-1 shrink-0 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 2: DISK THRESHOLD RETENTION                                 */}
        {/* =================================================================== */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">
                Disk Doluluk Oranına Göre Silme
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Sistem diski belirlenen limitin üzerine çıktığında en eski ses kayıtlarını otomatik olarak temizler.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deleteByDisk}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDisk(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDisk && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Silme Eşiği (Disk Doluluğu)
                  </span>
                  <span className={`text-xs font-black ${text}`}>%{diskThresholdPct}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={diskThresholdPct}
                  disabled={!writePermission}
                  onChange={(e) => setDiskThresholdPct(e.target.value)}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600 disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 3: DAYS BASED RETENTION                                     */}
        {/* =================================================================== */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">
                Zaman Aşımına Göre Silme (Periyodik)
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Belirtilen gün sayısından daha eski olan tüm ses kayıtlarını düzenli olarak sistemden temizler.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deleteByDays}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDays(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDays && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                  Kayıt Tutma Süresi (Gün)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={keepDays}
                    disabled={!writePermission}
                    onChange={(e) => setKeepDays(e.target.value)}
                    className="w-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500 font-bold"
                  />
                  <span className="text-xs font-semibold text-slate-550 dark:text-slate-455">
                    gün sonra silinir.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Never delete safeguard */}
        {!deleteByDisk && !deleteByDays && !dynamicRecordingEnabled && (
          <div className="p-4 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100/65 dark:border-rose-900/30 rounded-2xl flex flex-col gap-1">
            <h4 className={`font-black text-xs ${text}`}>
              ⚠️ Koruma Modu Aktif (Ömür Boyu Saklama)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
              Tüm silme filtreleri kapalı olduğu için ses kayıtları{" "}
              <strong>asla otomatik olarak silinmeyecektir</strong>. Disk dolup sistem kilitlenene kadar tüm
              geçmiş kayıtlar muhafaza edilir.
            </p>
          </div>
        )}

        {/* Save action button */}
        {writePermission && (
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 ${bg} ${hover} text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50`}
            >
              <Save size={14} />
              <span>{loading ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
