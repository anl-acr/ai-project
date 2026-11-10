import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  Star,
  Tag,
  Building2,
  StickyNote,
  Save,
  CheckCircle2,
  MessageSquare,
  Calendar,
  AlarmClock,
  Volume2,
  Award,
  Clock,
  Plus,
  Sparkles,
  PhoneMissed,
  PhoneIncoming,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";
import { webphoneManager } from "../../utils/webphoneManager";
import WaveformAudioPlayer from "./WaveformAudioPlayer";

const PRESET_TAGS = ["VIP", "Kurumsal", "Potansiyel Satış", "Teknik Destek", "Öncelikli", "Hassas Müşteri"];

export default function Customer360Drawer({
  backendHost = "localhost:8000",
  currentUser,
  currentRolePermissions = null,
  onNavigateTab,
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState("all");

  // Editable CRM fields
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [vip, setVip] = useState(false);
  const [tags, setTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [stickyNote, setStickyNote] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quick Callback Scheduler inside 360 Drawer
  const [showCbForm, setShowCbForm] = useState(false);
  const [cbDateTime, setCbDateTime] = useState("");
  const [cbNote, setCbNote] = useState("");
  const [cbPriority, setCbPriority] = useState("normal");
  const [savingCb, setSavingCb] = useState(false);

  const API_BASE = getApiBaseUrl(backendHost);

  const isAdmin =
    String(currentUser?.role || "").toLowerCase() === "admin" ||
    String(currentUser?.id || "").toLowerCase() === "admin";

  const canRead360 =
    isAdmin ||
    !Array.isArray(currentRolePermissions) ||
    currentRolePermissions.includes("customer_360:read") ||
    currentRolePermissions.includes("contacts:read") ||
    currentRolePermissions.includes("*");

  const canWrite360 =
    isAdmin ||
    !Array.isArray(currentRolePermissions) ||
    currentRolePermissions.includes("customer_360:write") ||
    currentRolePermissions.includes("contacts:write") ||
    currentRolePermissions.includes("*");

  const buildHeaders = useCallback(() => {
    const uid =
      currentUser?.id ||
      (typeof window !== "undefined" &&
        (sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id"))) ||
      "admin";
    const tenantId =
      (typeof window !== "undefined" && localStorage.getItem("selected_tenant_id")) || "tenant-default";
    return {
      "Content-Type": "application/json",
      "X-User-ID": String(uid),
      "X-User-Extension": String(currentUser?.extension || ""),
      "X-User-Role": String(currentUser?.role || "admin"),
      "X-Tenant-ID": String(tenantId),
    };
  }, [currentUser]);

  const fetchCustomer360 = useCallback(
    async (phoneStr) => {
      if (!phoneStr || !canRead360) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/workspace/customer-360?phone=${encodeURIComponent(phoneStr)}`,
          { headers: buildHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
          setFirstName(data.contact?.first_name || "");
          setLastName(data.contact?.last_name || "");
          setEmail(data.contact?.email || "");
          setCompany(data.meta?.company || "");
          setVip(Boolean(data.meta?.vip));
          setTags(Array.isArray(data.meta?.tags) ? data.meta.tags : []);
          setStickyNote(data.meta?.sticky_note || "");
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    },
    [API_BASE, buildHeaders, canRead360]
  );

  useEffect(() => {
    const handleOpenEvent = (e) => {
      const ph = String(e?.detail?.phone || "").trim();
      if (!ph || !canRead360) return;
      setTargetPhone(ph);
      setIsOpen(true);
      setShowCbForm(false);
      setTimelineFilter("all");
      // Default callback time: +1 hour local
      const plus1h = new Date(Date.now() + 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, "0");
      setCbDateTime(
        `${plus1h.getFullYear()}-${pad(plus1h.getMonth() + 1)}-${pad(plus1h.getDate())}T${pad(
          plus1h.getHours()
        )}:${pad(plus1h.getMinutes())}`
      );
      fetchCustomer360(ph);
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("OPEN_CUSTOMER_360", handleOpenEvent);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("OPEN_CUSTOMER_360", handleOpenEvent);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [canRead360, fetchCustomer360]);

  const handleSaveMeta = async (overridePatch = null) => {
    if (!targetPhone || !canWrite360) return;
    setSavingMeta(true);
    try {
      const payload = {
        phone: profileData?.phone || targetPhone,
        first_name: firstName,
        last_name: lastName,
        email,
        company,
        vip: overridePatch?.vip !== undefined ? overridePatch.vip : vip,
        tags: overridePatch?.tags !== undefined ? overridePatch.tags : tags,
        sticky_note: stickyNote,
      };
      const res = await fetch(`${API_BASE}/api/workspace/customer-360/meta`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2200);
        fetchCustomer360(targetPhone);
      }
    } catch (e) {
    } finally {
      setSavingMeta(false);
    }
  };

  const toggleTag = (tagLabel) => {
    if (!canWrite360) return;
    const exists = tags.includes(tagLabel);
    const next = exists ? tags.filter((t) => t !== tagLabel) : [...tags, tagLabel];
    setTags(next);
    handleSaveMeta({ tags: next });
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      const next = [...tags, clean];
      setTags(next);
      handleSaveMeta({ tags: next });
    }
    setCustomTagInput("");
  };

  const handleToggleVip = () => {
    if (!canWrite360) return;
    const nextVip = !vip;
    setVip(nextVip);
    handleSaveMeta({ vip: nextVip });
  };

  const handleCreateCallback = async (e) => {
    e.preventDefault();
    if (!cbDateTime || !targetPhone) return;
    setSavingCb(true);
    try {
      const isoUtc = new Date(cbDateTime).toISOString();
      const dispName =
        `${firstName} ${lastName}`.trim() || profileData?.display_name || "";
      const res = await fetch(`${API_BASE}/api/workspace/callbacks`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          customer_phone: profileData?.phone || targetPhone,
          customer_name: dispName,
          scheduled_at: isoUtc,
          assigned_user_id: String(currentUser?.id || "admin"),
          assigned_user_name:
            currentUser?.full_name || currentUser?.name || currentUser?.username || "Temsilci",
          assigned_extension: String(currentUser?.extension || ""),
          priority: cbPriority,
          note: cbNote,
        }),
      });
      if (res.ok) {
        setShowCbForm(false);
        setCbNote("");
        fetchCustomer360(targetPhone);
        window.dispatchEvent(new CustomEvent("REFRESH_NOTIFICATIONS"));
      }
    } catch (err) {
    } finally {
      setSavingCb(false);
    }
  };

  const handleCallCustomer = () => {
    const num = profileData?.phone || targetPhone;
    if (!num) return;
    webphoneManager.setDialNumber(num);
    webphoneManager.makeCall(num);
    setIsOpen(false);
    onNavigateTab?.("call-center", "webphone");
  };

  if (!isOpen) return null;

  const formatDuration = (sec) => {
    const s = Number(sec || 0);
    if (s <= 0) return "0 sn";
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m} dk ${rem} sn` : `${rem} sn`;
  };

  const formatTs = (iso) => {
    if (!iso) return "";
    try {
      const normalized = String(iso).endsWith("Z") || String(iso).includes("+") ? iso : `${iso}Z`;
      return new Date(normalized).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return String(iso);
    }
  };

  const timelineItems = (profileData?.timeline || []).filter((it) => {
    if (timelineFilter === "all") return true;
    return it.type === timelineFilter;
  });

  const resolvedTitle =
    `${firstName} ${lastName}`.trim() ||
    profileData?.display_name ||
    profileData?.phone ||
    targetPhone;

  return (
    <div
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[170] flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Müşteri 360 Derece Kartı"
        className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Top Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                vip
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                  : `${lightBg} ${borderLight} ${text}`
              }`}
            >
              <User size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {resolvedTitle}
                </h3>
                <button
                  type="button"
                  onClick={handleToggleVip}
                  title={vip ? "VIP Statüsünü Kaldır" : "VIP Müşteri Olarak İşaretle"}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer ${
                    vip
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-amber-500"
                  }`}
                >
                  <Star size={11} className={vip ? "fill-amber-400 text-amber-500" : ""} />
                  <span>{vip ? "VIP MÜŞTERİ" : "VIP Yap"}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-bold">
                  <Phone size={11} />
                  {profileData?.phone || targetPhone}
                </span>
                {company && (
                  <span className="flex items-center gap-1 font-sans font-semibold text-[11px]">
                    <Building2 size={11} />
                    {company}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchCustomer360(targetPhone)}
              title="Yenile"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Kapat (Esc)"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleCallCustomer}
            className={`px-3.5 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${bg} ${hover}`}
          >
            <Phone size={13} className="fill-current" />
            <span>Hemen Ara</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCbForm((p) => !p)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <AlarmClock size={13} className={text} />
            <span>Geri Arama Planla</span>
          </button>

          {canWrite360 && (
            <button
              type="button"
              onClick={() => setEditOpen((p) => !p)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <StickyNote size={13} className={text} />
              <span>{editOpen ? "Kart Düzenlemeyi Gizle" : "Kişi & Not Düzenle"}</span>
            </button>
          )}

          {saveSuccess && (
            <span className="ml-auto text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Kaydedildi
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick Callback Form */}
          {showCbForm && (
            <form
              onSubmit={handleCreateCallback}
              className={`p-4 rounded-2xl border ${border} ${lightBg} space-y-3`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <AlarmClock size={14} className={text} />
                  Geri Arama Hatırlatıcısı Oluştur
                </span>
                <button
                  type="button"
                  onClick={() => setShowCbForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Tarih ve Saat
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={cbDateTime}
                    onChange={(e) => setCbDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Öncelik
                  </label>
                  <select
                    value={cbPriority}
                    onChange={(e) => setCbPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek Öncelik</option>
                    <option value="urgent">Acil (Kritik)</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                placeholder="Geri arama notu (Örn: Teklif onayı sorulacak)..."
                value={cbNote}
                onChange={(e) => setCbNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingCb}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold shadow-sm cursor-pointer ${bg} ${hover}`}
                >
                  {savingCb ? "Kaydediliyor..." : "Hatırlatıcıyı Kaydet"}
                </button>
              </div>
            </form>
          )}

          {/* Editable Contact & Sticky Note Section */}
          {editOpen && canWrite360 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ad</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Müşteri Adı"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Soyad</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Soyadı"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Firma / Kurum</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Firma Adı"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">E-Posta</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Sabit Müşteri Notu (Tüm Temsilciler Görür)
                </label>
                <textarea
                  rows={2}
                  value={stickyNote}
                  onChange={(e) => setStickyNote(e.target.value)}
                  placeholder="Müşteriyle ilgili kalıcı uyarı veya özel tercih notu..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingMeta}
                  onClick={() => handleSaveMeta()}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer ${bg} ${hover}`}
                >
                  <Save size={13} />
                  <span>{savingMeta ? "Kaydediliyor..." : "Bilgileri Kaydet"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Pinned Sticky Note Banner (when closed edit mode) */}
          {!editOpen && stickyNote && (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2.5">
              <StickyNote size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                {stickyNote}
              </div>
            </div>
          )}

          {/* Customer Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag size={11} /> Müşteri Etiketleri
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from(new Set([...PRESET_TAGS, ...tags])).map((t) => {
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                      active
                        ? `${bg} text-white border-transparent shadow-sm`
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
              {canWrite360 && (
                <form onSubmit={handleAddCustomTag} className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="+ Özel etiket"
                    className="w-24 px-2.5 py-1 rounded-full text-[10px] bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                </form>
              )}
            </div>
          </div>

          {/* 360 KPI Summary Cards */}
          {profileData?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Toplam Çağrı</span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {profileData.stats.total_calls}
                </p>
                <span className="text-[9px] text-slate-500">
                  {profileData.stats.answered_calls} yanıt • {profileData.stats.missed_calls} kayıp
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Görüşme Süresi</span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {formatDuration(profileData.stats.total_talk_seconds)}
                </p>
                <span className="text-[9px] text-slate-500">
                  QA Ort: {profileData.stats.avg_qa_score ?? "—"}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Duygu Eğilimi</span>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-1">
                  {profileData.stats.dominant_sentiment}
                </p>
                <span className="text-[9px] text-slate-500">AI Analiz Özeti</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Mesaj & Randevu</span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {profileData.stats.chat_sessions_count} / {profileData.stats.appointments_count}
                </p>
                <span className="text-[9px] text-slate-500">
                  {profileData.stats.pending_callbacks_count} bekleyen görev
                </span>
              </div>
            </div>
          )}

          {/* Unified Timeline Filter Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                Birleşik Kanal Zaman Tüneli
              </h4>
              <div className="flex items-center gap-1">
                {[
                  { id: "all", label: "Tümü" },
                  { id: "call", label: "Çağrılar" },
                  { id: "chat", label: "Mesajlar" },
                  { id: "appointment", label: "Randevu" },
                  { id: "callback", label: "Görev" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      timelineFilter === f.id
                        ? `${bg} text-white`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
                Müşteri 360° geçmişi yükleniyor...
              </div>
            ) : timelineItems.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Bu filtrede geçmiş etkileşim kaydı bulunamadı.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {timelineItems.map((item) => {
                  if (item.type === "call") {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {item.is_missed ? (
                              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                                <PhoneMissed size={13} />
                              </span>
                            ) : (
                              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                <PhoneIncoming size={13} />
                              </span>
                            )}
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-white">
                                {item.is_missed ? "Cevapsız / Ulaşılamayan Çağrı" : "Sesli Görüşme"}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {formatTs(item.timestamp)} • Süre: {formatDuration(item.talk_duration)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.qa_score !== null && item.qa_score !== undefined && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold flex items-center gap-1">
                                <Award size={10} /> QA {item.qa_score}
                              </span>
                            )}
                            {item.sentiment && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                {item.sentiment}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.summary && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            <span className={`font-extrabold ${text} inline-flex items-center gap-1 mr-1`}>
                              <Sparkles size={11} /> AI Özet:
                            </span>
                            {item.summary}
                          </div>
                        )}

                        {(item.agent_topic || item.agent_notes) && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            {item.agent_topic && (
                              <span className="font-bold text-slate-800 dark:text-slate-200 mr-1.5">
                                [{item.agent_topic}]
                              </span>
                            )}
                            {item.agent_notes}
                          </div>
                        )}

                        {item.has_recording && (
                          <div className="pt-1">
                            <WaveformAudioPlayer
                              src={`${API_BASE}/api/calls/${encodeURIComponent(item.call_id)}/recording`}
                              initialDuration={item.duration}
                              size="sm"
                              barCount={28}
                              title="Çağrı Ses Kaydı"
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.type === "chat") {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                              <MessageSquare size={13} />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">
                                {item.channel} Sohbeti
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {formatTs(item.timestamp)}
                                {item.recipient_info ? ` • Hat: ${item.recipient_info}` : ""}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onNavigateTab?.("omnichannel");
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${lightBg} ${text} cursor-pointer`}
                          >
                            Sohbete Git
                          </button>
                        </div>

                        {Array.isArray(item.messages) && item.messages.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {item.messages.map((m, i) => (
                              <div
                                key={i}
                                className={`px-3 py-1.5 rounded-xl text-[11px] ${
                                  m.direction === "inbound"
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                    : `${lightBg} text-slate-800 dark:text-slate-200`
                                }`}
                              >
                                <span className="font-bold mr-1">
                                  {m.direction === "inbound" ? "Müşteri:" : "Yanıt:"}
                                </span>
                                {m.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.type === "appointment") {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <Calendar size={14} />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-white block">
                              Randevu — {formatTs(item.timestamp)}
                            </span>
                            {item.notes && (
                              <span className="text-[11px] text-slate-500">{item.notes}</span>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                          {item.status === "confirmed" ? "Onaylı" : item.status}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                          <AlarmClock size={14} />
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-white block">
                            Planlı Geri Arama — {formatTs(item.scheduled_at)}
                          </span>
                          {item.note && (
                            <span className="text-[11px] text-slate-500">{item.note}</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {item.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
