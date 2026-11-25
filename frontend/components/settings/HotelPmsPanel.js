import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  LogIn,
  LogOut,
  Bell,
  Clock,
  Receipt,
  Settings,
  Trash2,
  PhoneCall,
  Sparkles,
  Lock,
  Unlock,
  Copy,
  Check,
  Save,
  KeyRound,
  Activity,
  X
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const HK_META = {
  clean: { label: "Temiz", code: "*71", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  dirty: { label: "Kirli", code: "*72", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  maintenance: { label: "Arıza / Bakım", code: "*73", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  inspected: { label: "Onaylı", code: "*74", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" }
};

const LANG_OPTIONS = [
  { id: "tr", label: "Türkçe (TR)" },
  { id: "en", label: "İngilizce (EN)" },
  { id: "de", label: "Almanca (DE)" },
  { id: "ru", label: "Rusça (RU)" },
  { id: "ar", label: "Arapça (AR)" },
  { id: "fr", label: "Fransızca (FR)" }
];

export default function HotelPmsPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"]
}) {
  const { bg, hover, text, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const canWrite = userPermissions.includes("*") || userPermissions.includes("hotel_pms:write");
  const canDelete = userPermissions.includes("*") || userPermissions.includes("hotel_pms:delete");

  const [activeTab, setActiveTab] = useState("rooms"); // rooms | wakeups | billing | pms
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [copiedKey, setCopiedKey] = useState(false);

  const [config, setConfig] = useState({
    enabled: false,
    hotel_name: "Nornia Grand Hotel",
    reception_extension: "1000",
    block_room_to_room: true,
    auto_lock_outbound_on_checkout: true,
    auto_clear_voicemail_on_checkout: true,
    wakeup_retry_minutes: 5,
    wakeup_max_retries: 2,
    wakeup_use_ai_tts: true,
    tariffs: { currency: "TRY", local_per_min: 2.5, gsm_per_min: 5.0, international_per_min: 18.0 },
    pms_provider: "standalone",
    elektra: { enabled: false, api_url: "https://api.elektraweb.com", hotel_id: "", api_key: "", webhook_secret: "" },
    fias: { enabled: false, mode: "server", host: "0.0.0.0", port: 5008, remote_host: "", remote_port: 5008 },
    open_api_key: "",
    fias_runtime: { running: false, connected: false, frames_rx: 0, frames_tx: 0, last_frame: "", last_error: "" }
  });

  const [rooms, setRooms] = useState([]);
  const [wakeups, setWakeups] = useState([]);
  const [events, setEvents] = useState([]);
  const [filterOccupancy, setFilterOccupancy] = useState("all"); // all | occupied | vacant

  // Modals
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({
    id: null,
    room_number: "",
    extension: "",
    floor: "1",
    building: "Ana Bina",
    room_type: "standard",
    family_group: ""
  });
  const [deleteRoomTarget, setDeleteRoomTarget] = useState(null);

  const [checkinTarget, setCheckinTarget] = useState(null);
  const [checkinForm, setCheckinForm] = useState({
    guest_name: "",
    guest_language: "tr",
    guest_vip: false,
    reservation_code: "",
    family_group: "",
    outbound_allowed: true
  });

  const [folioModal, setFolioModal] = useState(null);
  const [manualCharge, setManualCharge] = useState({ room_number: "", description: "Minibar - Su", category: "minibar", amount: 45 });

  const [showWakeupModal, setShowWakeupModal] = useState(false);
  const [wakeupForm, setWakeupForm] = useState({
    room_number: "",
    scheduled_time: "07:30",
    scheduled_date: "daily",
    language: "tr",
    custom_message: ""
  });

  const showToast = (type, message) => {
    setNotice({ type, message });
    setTimeout(() => setNotice({ type: "", message: "" }), 4500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgR, rmR, wkR, evR] = await Promise.all([
        tenantFetch(`${API_BASE}/api/hotel/config`),
        tenantFetch(`${API_BASE}/api/hotel/rooms`),
        tenantFetch(`${API_BASE}/api/hotel/wakeups`),
        tenantFetch(`${API_BASE}/api/hotel/events?limit=40`)
      ]);
      if (cfgR.ok) {
        const c = await cfgR.json();
        setConfig((prev) => ({ ...prev, ...c }));
      }
      if (rmR.ok) setRooms(await rmR.json());
      if (wkR.ok) setWakeups(await wkR.json());
      if (evR.ok) setEvents(await evR.json());
    } catch (err) {
      console.error("[Hotel PMS] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/hotel/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.config) setConfig((p) => ({ ...p, ...data.config, fias_runtime: data.fias_runtime || p.fias_runtime }));
        showToast("success", data.message || "Otel & PMS ayarları kaydedildi.");
      } else {
        showToast("error", data.detail || "Ayarlar kaydedilemedi.");
      }
    } catch {
      showToast("error", "Sunucuya bağlanılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!canWrite || !roomForm.room_number.trim()) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/hotel/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...roomForm,
          extension: roomForm.extension.trim() || roomForm.room_number.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowRoomModal(false);
        showToast("success", `Oda ${roomForm.room_number} kaydedildi.`);
        loadAll();
      } else {
        showToast("error", data.detail || "Oda kaydedilemedi.");
      }
    } catch {
      showToast("error", "Ağ hatası.");
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomTarget || !canDelete) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/hotel/rooms/${deleteRoomTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", `Oda ${deleteRoomTarget.room_number} silindi.`);
        loadAll();
      }
    } finally {
      setDeleteRoomTarget(null);
    }
  };

  const handleCheckinSubmit = async (e) => {
    e.preventDefault();
    if (!checkinTarget || !canWrite) return;
    const res = await tenantFetch(`${API_BASE}/api/hotel/rooms/${encodeURIComponent(checkinTarget.room_number)}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkinForm)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCheckinTarget(null);
      showToast("success", data.message || "Check-In tamamlandı.");
      loadAll();
    } else {
      showToast("error", data.detail || "Check-In başarısız.");
    }
  };

  const handleCheckout = async (room) => {
    if (!canWrite) return;
    const res = await tenantFetch(`${API_BASE}/api/hotel/rooms/${encodeURIComponent(room.room_number)}/checkout`, {
      method: "POST"
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(
        "success",
        `Oda ${room.room_number} Check-Out tamamlandı. Folio: ${data.folio_total || 0} ${config.tariffs?.currency || "TRY"}`
      );
      loadAll();
    } else {
      showToast("error", data.detail || "Check-Out başarısız.");
    }
  };

  const handleChangeHk = async (room, hkStatus) => {
    if (!canWrite) return;
    const res = await tenantFetch(`${API_BASE}/api/hotel/rooms/${encodeURIComponent(room.room_number)}/housekeeping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: hkStatus })
    });
    if (res.ok) loadAll();
  };

  const handleOpenFolio = async (room) => {
    const res = await tenantFetch(`${API_BASE}/api/hotel/rooms/${encodeURIComponent(room.room_number)}/folio`);
    if (res.ok) {
      setFolioModal(await res.json());
    }
  };

  const handleAddManualCharge = async (e) => {
    e.preventDefault();
    if (!canWrite || !manualCharge.room_number) return;
    const res = await tenantFetch(`${API_BASE}/api/hotel/charges/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manualCharge, amount: Number(manualCharge.amount) || 0 })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("success", data.message || "Ücret işlendi.");
      loadAll();
    } else {
      showToast("error", data.detail || "Ücret işlenemedi.");
    }
  };

  const handleScheduleWakeup = async (e) => {
    e.preventDefault();
    if (!canWrite || !wakeupForm.room_number) return;
    const res = await tenantFetch(`${API_BASE}/api/hotel/wakeups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wakeupForm)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setShowWakeupModal(false);
      showToast("success", `Oda ${wakeupForm.room_number} için ${wakeupForm.scheduled_time} uyandırması kuruldu.`);
      loadAll();
    } else {
      showToast("error", data.detail || "Uyandırma kurulamadı.");
    }
  };

  const handleTriggerWakeup = async (wkId) => {
    const res = await tenantFetch(`${API_BASE}/api/hotel/wakeups/${wkId}/trigger`, { method: "POST" });
    if (res.ok) {
      showToast("success", "Uyandırma araması başlatıldı.");
      loadAll();
    }
  };

  const handleCancelWakeup = async (wkId) => {
    const res = await tenantFetch(`${API_BASE}/api/hotel/wakeups/${wkId}`, { method: "DELETE" });
    if (res.ok) loadAll();
  };

  const filteredRooms = rooms.filter((r) => (filterOccupancy === "all" ? true : r.occupancy_status === filterOccupancy));
  const occupiedCount = rooms.filter((r) => r.occupancy_status === "occupied").length;
  const dirtyCount = rooms.filter((r) => r.housekeeping_status === "dirty").length;
  const alarmCount = wakeups.filter((w) => w.status === "missed_alarm").length;

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-xl shrink-0 ${lightBg} ${lightText} border ${borderLight}`}>
            <Building2 size={22} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Otel & PMS Yönetim Merkezi</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${lightText} border ${borderLight}`}>
                {config.enabled ? "Modül Aktif" : "Pasif"}
              </span>
              {alarmCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 animate-pulse">
                  {alarmCount} Yanıtsız Uyandırma Alarmı!
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Check-In/Check-Out dış arama kilidi, kat hizmetleri (<code className="font-mono">*71–*74</code>), çok dilli AI uyandırma (<code className="font-mono">*55</code>), çağrı ücretlendirme (Folio) ve ElektraWeb / FIAS (OPERA & Fidelio) PMS köprüsü.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {[
            { id: "rooms", label: "Oda Panosu", icon: Building2 },
            { id: "wakeups", label: "Uyandırma (AI)", icon: Bell },
            { id: "billing", label: "Ücretlendirme", icon: Receipt },
            { id: "pms", label: "PMS & FIAS", icon: Settings }
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  active
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice.message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            notice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300"
          }`}
        >
          {notice.type === "success" ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* TAB 1: ROOM BOARD */}
      {activeTab === "rooms" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-500">Toplam Oda</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{rooms.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-500">Dolu (Check-In)</div>
              <div className={`text-xl font-black mt-0.5 ${text}`}>{occupiedCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-500">Temizlik Bekleyen</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">{dirtyCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-500">Aktif Uyandırma</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {wakeups.filter((w) => w.status === "scheduled" || w.status === "retry_pending").length}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {[
                { id: "all", label: "Tümü" },
                { id: "occupied", label: "Dolu Odalar" },
                { id: "vacant", label: "Boş Odalar" }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterOccupancy(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    filterOccupancy === f.id
                      ? `${lightBg} ${lightText} ${borderLight}`
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAll}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span>Yenile</span>
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setRoomForm({ id: null, room_number: "", extension: "", floor: "1", building: "Ana Bina", room_type: "standard", family_group: "" });
                    setShowRoomModal(true);
                  }}
                  title="Yeni Oda Ekle"
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
              <Building2 size={28} className="mx-auto text-slate-400" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Henüz tanımlı oda yok</div>
              <p className="text-xs text-slate-500">Sağ üstteki (+) butonundan oda dahililerinizi ekleyerek Check-In/Check-Out yönetimine başlayabilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRooms.map((r) => {
                const hk = HK_META[r.housekeeping_status] || HK_META.clean;
                const isOccupied = r.occupancy_status === "occupied";
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm space-y-3 ${
                      isOccupied ? borderLight : "border-slate-200/80 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">Oda {r.room_number}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Dahili: {r.extension}
                          </span>
                          {r.guest_vip && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">VIP</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {r.building} • Kat {r.floor} • {isOccupied ? r.guest_name : "Boş Oda"}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hk.cls}`}>{hk.label}</span>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteRoomTarget(r)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
                            title="Odayı Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold ${
                          r.outbound_allowed
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {r.outbound_allowed ? <Unlock size={11} /> : <Lock size={11} />}
                        {r.outbound_allowed ? "Dış Arama Açık" : "Dış Arama Kilitli"}
                      </span>
                      {isOccupied && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-600 dark:text-slate-300">
                          Dil: {r.guest_language}
                        </span>
                      )}
                      {r.family_group && (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                          Grup: {r.family_group}
                        </span>
                      )}
                    </div>

                    {canWrite && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          {!isOccupied ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCheckinTarget(r);
                                setCheckinForm({
                                  guest_name: "",
                                  guest_language: "tr",
                                  guest_vip: false,
                                  reservation_code: "",
                                  family_group: r.family_group || "",
                                  outbound_allowed: true
                                });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 ${bg} ${hover}`}
                            >
                              <LogIn size={12} /> Check-In
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCheckout(r)}
                              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1"
                            >
                              <LogOut size={12} /> Check-Out
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenFolio(r)}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                          >
                            <Receipt size={12} /> Folio
                          </button>
                        </div>

                        <select
                          value={r.housekeeping_status}
                          onChange={(e) => handleChangeHk(r, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                        >
                          <option value="clean">*71 Temiz</option>
                          <option value="dirty">*72 Kirli</option>
                          <option value="maintenance">*73 Arıza</option>
                          <option value="inspected">*74 Onaylı</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WAKE-UP CALLS */}
      {activeTab === "wakeups" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Sparkles size={15} className={text} />
              <span>
                Misafirler oda telefonundan <code className="font-mono font-bold">*55</code> tuşlayıp 4 haneli saat (<code className="font-mono">0730</code>) girerek uyandırma kurabilir, <code className="font-mono font-bold">*56</code> ile iptal edebilir.
              </span>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => {
                  setWakeupForm({ room_number: rooms[0]?.room_number || "", scheduled_time: "07:30", scheduled_date: "daily", language: "tr", custom_message: "" });
                  setShowWakeupModal(true);
                }}
                title="Yeni Uyandırma Kur"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            {wakeups.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">Planlı uyandırma araması bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500">
                      <th className="py-2 pr-3">Oda / Dahili</th>
                      <th className="py-2 pr-3">Misafir</th>
                      <th className="py-2 pr-3">Saat & Periyot</th>
                      <th className="py-2 pr-3">AI Dil</th>
                      <th className="py-2 pr-3">Durum</th>
                      <th className="py-2 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {wakeups.map((w) => (
                      <tr key={w.id}>
                        <td className="py-2.5 pr-3 font-bold">
                          Oda {w.room_number} <span className="font-mono text-slate-400">({w.extension})</span>
                        </td>
                        <td className="py-2.5 pr-3">{w.guest_name || "—"}</td>
                        <td className="py-2.5 pr-3 font-mono font-bold">
                          {w.scheduled_time} <span className="text-[10px] text-slate-400">({w.scheduled_date === "daily" ? "Her Gün" : w.scheduled_date})</span>
                        </td>
                        <td className="py-2.5 pr-3 uppercase font-bold">{w.language}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              w.status === "missed_alarm"
                                ? "bg-rose-100 text-rose-700 animate-pulse"
                                : w.status === "answered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : w.status === "cancelled"
                                    ? "bg-slate-100 text-slate-500"
                                    : `${lightBg} ${lightText}`
                            }`}
                          >
                            {w.status === "missed_alarm"
                              ? "RESEPSİYON ALARMI (YANITSIZ)"
                              : w.status === "scheduled"
                                ? "Planlandı"
                                : w.status === "answered"
                                  ? "Arandı"
                                  : w.status === "retry_pending"
                                    ? `Tekrar Bekliyor (${w.retries}/${w.max_retries})`
                                    : "İptal"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5">
                          {canWrite && w.status !== "cancelled" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleTriggerWakeup(w.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white ${bg} ${hover}`}
                              >
                                <PhoneCall size={11} className="inline mr-1" />
                                Şimdi Ara
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelWakeup(w.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-rose-600"
                              >
                                İptal
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BILLING & TARIFFS */}
      {activeTab === "billing" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form onSubmit={handleSaveConfig} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Receipt size={14} className={text} /> Dakika Ücretlendirme Tarifeleri (Call Accounting)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Para Birimi</label>
                <select
                  disabled={!canWrite}
                  value={config.tariffs?.currency || "TRY"}
                  onChange={(e) => setConfig((p) => ({ ...p, tariffs: { ...p.tariffs, currency: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Şehir İçi / Sabit (dk)</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!canWrite}
                  value={config.tariffs?.local_per_min ?? 2.5}
                  onChange={(e) => setConfig((p) => ({ ...p, tariffs: { ...p.tariffs, local_per_min: Number(e.target.value) } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">GSM Mobil (dk)</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!canWrite}
                  value={config.tariffs?.gsm_per_min ?? 5.0}
                  onChange={(e) => setConfig((p) => ({ ...p, tariffs: { ...p.tariffs, gsm_per_min: Number(e.target.value) } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Uluslararası (dk)</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!canWrite}
                  value={config.tariffs?.international_per_min ?? 18.0}
                  onChange={(e) => setConfig((p) => ({ ...p, tariffs: { ...p.tariffs, international_per_min: Number(e.target.value) } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            </div>
            {canWrite && (
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 ${bg} ${hover}`}
              >
                <Save size={14} /> Tarifeyi Kaydet
              </button>
            )}
          </form>

          <form onSubmit={handleAddManualCharge} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Minibar / Ekstra Oda Harcaması İşle
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Oda No</label>
                <input
                  type="text"
                  required
                  value={manualCharge.room_number}
                  onChange={(e) => setManualCharge((p) => ({ ...p, room_number: e.target.value }))}
                  placeholder="Örn: 304"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Tutar ({config.tariffs?.currency || "TRY"})</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={manualCharge.amount}
                  onChange={(e) => setManualCharge((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Açıklama</label>
              <input
                type="text"
                required
                value={manualCharge.description}
                onChange={(e) => setManualCharge((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
            {canWrite && (
              <button type="submit" className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}>
                Oda Foliosuna İşle
              </button>
            )}
          </form>
        </div>
      )}

      {/* TAB 4: PMS & FIAS INTEGRATIONS */}
      {activeTab === "pms" && (
        <div className="space-y-4">
          <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-white">Otel & PMS Modülünü Etkinleştir</div>
                  <div className="text-[10px] text-slate-500">Check-out dış arama kilidi, oda kısıtlama ve çağrı ücretlendirmeyi açar.</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!config.enabled}
                  disabled={!canWrite}
                  onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-white">Odalar Arası Aramayı Kısıtla</div>
                  <div className="text-[10px] text-slate-500">Aynı Aile Grubu haricindeki odaların birbirini aramasını engeller.</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!config.block_room_to_room}
                  disabled={!canWrite}
                  onChange={(e) => setConfig((p) => ({ ...p, block_room_to_room: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Otel Adı</label>
                <input
                  type="text"
                  disabled={!canWrite}
                  value={config.hotel_name || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, hotel_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Resepsiyon Dahilisi</label>
                <input
                  type="text"
                  disabled={!canWrite}
                  value={config.reception_extension || "1000"}
                  onChange={(e) => setConfig((p) => ({ ...p, reception_extension: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">PMS Köprü Sağlayıcısı</label>
                <select
                  disabled={!canWrite}
                  value={config.pms_provider || "standalone"}
                  onChange={(e) => setConfig((p) => ({ ...p, pms_provider: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="standalone">Bağımsız Otel Santrali (PMS Gerekmez)</option>
                  <option value="elektra">ElektraWeb / Elektra PMS (REST API)</option>
                  <option value="fias">Oracle OPERA / Protel / Fidelio (FIAS TCP/IP)</option>
                  <option value="open_api">Open PMS REST API (Sedna / HMS / Mod Hotel)</option>
                </select>
              </div>
            </div>

            {/* ElektraWeb Block */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 dark:text-white">ElektraWeb REST Entegrasyonu</span>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={!!config.elektra?.enabled}
                    onChange={(e) => setConfig((p) => ({ ...p, elektra: { ...p.elektra, enabled: e.target.checked } }))}
                  />
                  <span>Aktif</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="API URL (https://api.elektraweb.com)"
                  value={config.elektra?.api_url || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, elektra: { ...p.elektra, api_url: e.target.value } }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Hotel ID"
                  value={config.elektra?.hotel_id || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, elektra: { ...p.elektra, hotel_id: e.target.value } }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="password"
                  placeholder="Elektra API Key"
                  value={config.elektra?.api_key || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, elektra: { ...p.elektra, api_key: e.target.value } }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Webhook Ucu: POST {API_BASE}/api/pms/elektra/webhook (Header: X-PMS-API-Key)
              </div>
            </div>

            {/* FIAS TCP/IP Block */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    FIAS TCP/IP Köprüsü (Oracle OPERA / Protel / Fidelio)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      config.fias_runtime?.connected
                        ? "bg-emerald-100 text-emerald-700"
                        : config.fias_runtime?.running
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {config.fias_runtime?.connected
                      ? `Bağlı (${config.fias_runtime.peer})`
                      : config.fias_runtime?.running
                        ? `Dinliyor (${config.fias_runtime.endpoint})`
                        : "Kapalı"}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={!!config.fias?.enabled}
                    onChange={(e) => setConfig((p) => ({ ...p, fias: { ...p.fias, enabled: e.target.checked } }))}
                  />
                  <span>FIAS Aktif</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={config.fias?.mode || "server"}
                  onChange={(e) => setConfig((p) => ({ ...p, fias: { ...p.fias, mode: e.target.value } }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="server">TCP Sunucu Modu (OPERA Santrale Bağlanır)</option>
                  <option value="client">TCP İstemci Modu (Santral OPERA IFC'ye Bağlanır)</option>
                </select>
                <input
                  type="text"
                  placeholder={config.fias?.mode === "client" ? "OPERA IFC IP Adresi" : "Dinleme IP (0.0.0.0)"}
                  value={config.fias?.mode === "client" ? config.fias?.remote_host || "" : config.fias?.host || "0.0.0.0"}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      fias: {
                        ...p.fias,
                        ...(p.fias?.mode === "client" ? { remote_host: e.target.value } : { host: e.target.value })
                      }
                    }))
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="number"
                  placeholder="Port (5008)"
                  value={config.fias?.mode === "client" ? config.fias?.remote_port || 5008 : config.fias?.port || 5008}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      fias: {
                        ...p.fias,
                        ...(p.fias?.mode === "client"
                          ? { remote_port: Number(e.target.value) || 5008 }
                          : { port: Number(e.target.value) || 5008 })
                      }
                    }))
                  }
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Desteklenen FIAS Çerçeveleri: LS/LA (Keepalive), GI (Check-In), GO (Check-Out), GC (Misafir Değişimi), RE (Kat Hizmetleri), WR/WA (Uyandırma), PS (Ücret Aktarımı) | RX: {config.fias_runtime?.frames_rx || 0} / TX: {config.fias_runtime?.frames_tx || 0}
              </div>
            </div>

            {/* Open PMS API Key */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <KeyRound size={14} className={text} /> Open PMS API Anahtarı (Sedna / HMS / Mod Hotel)
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Header: X-PMS-API-Key: <span className="font-bold text-slate-800 dark:text-slate-200">{config.open_api_key}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(config.open_api_key || "");
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 1800);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
              >
                {copiedKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedKey ? "Kopyalandı" : "Anahtarı Kopyala"}</span>
              </button>
            </div>

            {canWrite && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-sm ${bg} ${hover} disabled:opacity-50`}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{saving ? "Kaydediliyor..." : "Otel & PMS Ayarlarını Kaydet"}</span>
                </button>
              </div>
            )}
          </form>

          {/* Live PMS Event Log */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
              <Activity size={14} className={text} /> Son PMS & Otel Olay Günlüğü
            </h4>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Henüz olay kaydı yok.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${lightBg} ${lightText}`}>
                        {ev.event_type}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">Oda {ev.room_number || "-"}</span>
                      <span className="truncate text-slate-700 dark:text-slate-200">{ev.details}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {ev.created_at ? new Date(ev.created_at).toLocaleTimeString("tr-TR") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Room Add/Edit Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveRoom} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Yeni Otel Odası Tanımla</h4>
              <button type="button" onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1">Oda Numarası *</label>
                <input
                  type="text"
                  required
                  value={roomForm.room_number}
                  onChange={(e) => setRoomForm((p) => ({ ...p, room_number: e.target.value, extension: p.extension || e.target.value }))}
                  placeholder="304"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">SIP Dahili No *</label>
                <input
                  type="text"
                  required
                  value={roomForm.extension}
                  onChange={(e) => setRoomForm((p) => ({ ...p, extension: e.target.value }))}
                  placeholder="304"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Kat</label>
                <input
                  type="text"
                  value={roomForm.floor}
                  onChange={(e) => setRoomForm((p) => ({ ...p, floor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Blok / Bina</label>
                <input
                  type="text"
                  value={roomForm.building}
                  onChange={(e) => setRoomForm((p) => ({ ...p, building: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
                Vazgeç
              </button>
              <button type="submit" className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}>
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Check-In Modal */}
      {checkinTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCheckinSubmit} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Oda {checkinTarget.room_number} — Misafir Check-In</h4>
              <button type="button" onClick={() => setCheckinTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold mb-1">Misafir Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  value={checkinForm.guest_name}
                  onChange={(e) => setCheckinForm((p) => ({ ...p, guest_name: e.target.value }))}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Misafir Dili (AI Uyandırma)</label>
                  <select
                    value={checkinForm.guest_language}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, guest_language: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                  >
                    {LANG_OPTIONS.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Rezervasyon No</label>
                  <input
                    type="text"
                    value={checkinForm.reservation_code}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, reservation_code: e.target.value }))}
                    placeholder="RES-2026-..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Aile / Grup Kodu (Oda-Arası Arama İzni İçin)</label>
                <input
                  type="text"
                  value={checkinForm.family_group}
                  onChange={(e) => setCheckinForm((p) => ({ ...p, family_group: e.target.value }))}
                  placeholder="Opsiyonel: YILMAZ-AILE"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div className="flex items-center gap-4 pt-1 text-xs font-bold">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkinForm.outbound_allowed}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, outbound_allowed: e.target.checked }))}
                  />
                  <span>Dış Arama Açık</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkinForm.guest_vip}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, guest_vip: e.target.checked }))}
                  />
                  <span>VIP Misafir</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCheckinTarget(null)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
                Vazgeç
              </button>
              <button type="submit" className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}>
                Check-In Onayla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wake-Up Modal */}
      {showWakeupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleScheduleWakeup} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">AI Çok Dilli Uyandırma Kur</h4>
              <button type="button" onClick={() => setShowWakeupModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1">Oda / Dahili *</label>
                <input
                  type="text"
                  required
                  value={wakeupForm.room_number}
                  onChange={(e) => setWakeupForm((p) => ({ ...p, room_number: e.target.value }))}
                  placeholder="304"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Saat (SS:DD) *</label>
                <input
                  type="time"
                  required
                  value={wakeupForm.scheduled_time}
                  onChange={(e) => setWakeupForm((p) => ({ ...p, scheduled_time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">AI Ses Dili</label>
                <select
                  value={wakeupForm.language}
                  onChange={(e) => setWakeupForm((p) => ({ ...p, language: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  {LANG_OPTIONS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Periyot</label>
                <select
                  value={wakeupForm.scheduled_date}
                  onChange={(e) => setWakeupForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="daily">Her Gün</option>
                  <option value={new Date().toISOString().slice(0, 10)}>Sadece Bugün</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">Özel AI Anons Metni (Boş = Otomatik Misafir Karşılaması)</label>
              <textarea
                rows={2}
                value={wakeupForm.custom_message}
                onChange={(e) => setWakeupForm((p) => ({ ...p, custom_message: e.target.value }))}
                placeholder="Örn: Günaydın Sayın Yılmaz, kahvaltı salonumuz 10:30'a kadar açıktır."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowWakeupModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
                Vazgeç
              </button>
              <button type="submit" className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}>
                Uyandırmayı Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Folio Modal */}
      {folioModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Oda {folioModal.room_number} — Telefon & Harcama Foliosu
              </h4>
              <button type="button" onClick={() => setFolioModal(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className={`p-3.5 rounded-xl border ${lightBg} ${borderLight} flex items-center justify-between`}>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Toplam Tutar ({folioModal.charge_count} kalem)</span>
              <span className={`text-lg font-black font-mono ${text}`}>
                {folioModal.total_cost} {folioModal.currency}
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {(folioModal.charges || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Bu oda için ücretli arama/minibar kaydı yok.</p>
              ) : (
                folioModal.charges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{c.called_number}</div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {c.call_category} {c.billable_minutes > 0 ? `• ${c.billable_minutes} dk` : ""}
                      </div>
                    </div>
                    <div className="font-mono font-bold">
                      {c.total_cost} {c.currency}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setFolioModal(null)} className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${bg}`}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteRoomTarget}
        onClose={() => setDeleteRoomTarget(null)}
        onConfirm={handleConfirmDeleteRoom}
        title="Odayı Sil"
        message={
          deleteRoomTarget
            ? `Oda ${deleteRoomTarget.room_number} (Dahili ${deleteRoomTarget.extension}) kaydını silmek istediğinize emin misiniz?`
            : ""
        }
      />
    </div>
  );
}
