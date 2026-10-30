import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Check
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const DEFAULT_REPORT_MODULES = {
  cdr_summary: "Genel Çağrı & CDR Özeti",
  breaks_attendance: "Temsilci Mola & Puantaj Özeti",
  queue_sla: "Kuyruk SLA & Bekleme Analizi",
  omnichannel: "Omnichannel (WhatsApp/Dijital) Özeti",
  disposition: "Çağrı Sonuç Kodları (Disposition)",
  missed_recovery: "Kaçan Çağrı & Geri Kazanım",
  repeat_callers: "Tekrar Eden Arayanlar"
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Pazartesi" },
  { value: 1, label: "Salı" },
  { value: 2, label: "Çarşamba" },
  { value: 3, label: "Perşembe" },
  { value: 4, label: "Cuma" },
  { value: 5, label: "Cumartesi" },
  { value: 6, label: "Pazar" }
];

const PERIOD_LABELS = {
  yesterday: "Dün (Tam Gün)",
  today: "Bugün (Gönderim Anına Kadar)",
  last_7_days: "Son 7 Gün",
  last_30_days: "Son 30 Gün"
};

const EMPTY_FORM = {
  id: "",
  name: "",
  enabled: true,
  frequency: "daily",
  send_time: "09:00",
  day_of_week: 0,
  day_of_month: 1,
  period_range: "yesterday",
  report_types: ["cdr_summary", "breaks_attendance", "queue_sla"],
  send_email: true,
  email_recipients: "",
  send_whatsapp: false,
  whatsapp_recipients: ""
};

export default function ScheduledReportsPanel({
  backendHost,
  canWrite = true,
  canDelete = true
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [reportTypesMap, setReportTypesMap] = useState(DEFAULT_REPORT_MODULES);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/scheduled-reports`);
      if (res.ok) {
        const json = await res.json();
        setSchedules(Array.isArray(json.schedules) ? json.schedules : []);
        setHistory(Array.isArray(json.history) ? json.history : []);
        if (json.report_types && typeof json.report_types === "object") {
          setReportTypesMap(json.report_types);
        }
      }
    } catch (err) {
      console.error("[ScheduledReportsPanel] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const openCreateModal = () => {
    if (!canWrite) return;
    setFormData({ ...EMPTY_FORM });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    if (!canWrite) return;
    setFormData({
      id: item.id || "",
      name: item.name || "",
      enabled: item.enabled !== false,
      frequency: item.frequency || "daily",
      send_time: item.send_time || "09:00",
      day_of_week: Number(item.day_of_week ?? 0),
      day_of_month: Number(item.day_of_month ?? 1),
      period_range: item.period_range || "yesterday",
      report_types: Array.isArray(item.report_types) && item.report_types.length > 0 ? item.report_types : ["cdr_summary"],
      send_email: item.send_email !== false,
      email_recipients: item.email_recipients || "",
      send_whatsapp: Boolean(item.send_whatsapp),
      whatsapp_recipients: item.whatsapp_recipients || ""
    });
    setIsModalOpen(true);
  };

  const toggleReportModule = (code) => {
    setFormData((prev) => {
      const exists = prev.report_types.includes(code);
      if (exists && prev.report_types.length === 1) return prev;
      return {
        ...prev,
        report_types: exists ? prev.report_types.filter((c) => c !== code) : [...prev.report_types, code]
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!formData.name.trim()) {
      showToast("Lütfen zamanlanmış rapor için bir başlık girin.", "error");
      return;
    }
    if (!formData.send_email && !formData.send_whatsapp) {
      showToast("En az bir gönderim kanalı (E-Posta veya WhatsApp) seçmelisiniz.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/scheduled-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        showToast("Zamanlanmış rapor görevi kaydedildi.");
        await fetchSchedules();
      } else {
        showToast("Kayıt sırasında bir hata oluştu.", "error");
      }
    } catch (err) {
      showToast("Sunucuya bağlanılamadı.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (item) => {
    if (!canWrite) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/scheduled-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, enabled: !item.enabled })
      });
      if (res.ok) {
        await fetchSchedules();
      }
    } catch (e) {}
  };

  const handleRunNow = async (item) => {
    if (!canWrite) return;
    setRunningId(item.id);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/scheduled-reports/${encodeURIComponent(item.id)}/run-now`, {
        method: "POST"
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.status === "success") {
        showToast(`Gönderim başarılı: ${json.message || ""}`);
      } else {
        showToast(json.message || json.detail || "Gönderim tamamlanamadı (SMTP / WhatsApp ayarlarını kontrol edin).", "error");
      }
      await fetchSchedules();
    } catch (err) {
      showToast("Anlık gönderim sırasında hata oluştu.", "error");
    } finally {
      setRunningId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/scheduled-reports/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Zamanlanmış rapor silindi.");
        setDeleteTarget(null);
        await fetchSchedules();
      }
    } catch (err) {
      showToast("Silme işlemi başarısız oldu.", "error");
    }
  };

  const formatFrequencyLabel = (s) => {
    if (s.frequency === "weekly") {
      const dayName = DAYS_OF_WEEK.find((d) => d.value === Number(s.day_of_week || 0))?.label || "Pazartesi";
      return `Haftalık • Her ${dayName} ${s.send_time || "09:00"}`;
    }
    if (s.frequency === "monthly") {
      return `Aylık • Ayın ${s.day_of_month || 1}. Günü ${s.send_time || "09:00"}`;
    }
    return `Günlük • Her Gün ${s.send_time || "09:00"}`;
  };

  return (
    <div className="w-full space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-sm ${
            toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : `${lightBg} ${borderLight} ${lightText}`
          }`}
        >
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl ${lightBg} ${lightText} border ${borderLight} shrink-0`}>
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">
              Zamanlanmış Otomatik Raporlar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Belirlediğiniz gün ve saatlerde santral performans özetlerini CSV/Excel ekiyle E-Posta veya WhatsApp üzerinden yöneticilere otomatik iletin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchSchedules}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={openCreateModal}
              title="Yeni Zamanlanmış Rapor Ekle"
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition shadow-sm cursor-pointer"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Schedules Table */}
      <div
        role="region"
        aria-label="Zamanlanmış Rapor Görevleri"
        tabIndex={0}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto"
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Durum</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Görev Başlığı</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Periyot & Saat</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Veri Dönemi</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">İçerik Modülleri</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alıcı Kanalları</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Son Çalışma</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Henüz tanımlanmış bir zamanlanmış rapor görevi bulunmuyor. Sağ üstteki <b>+</b> butonu ile ilk otomatik raporunuzu oluşturabilirsiniz.
                </td>
              </tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => handleToggleEnabled(s)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                        s.enabled !== false
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {s.enabled !== false ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-white">{s.name}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap font-medium">{formatFrequencyLabel(s)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                    {PERIOD_LABELS[s.period_range] || s.period_range}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(s.report_types || []).map((rt) => (
                        <span
                          key={rt}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${lightBg} ${lightText}`}
                        >
                          {reportTypesMap[rt] || rt}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 space-y-1">
                    {s.send_email && s.email_recipients && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <Mail size={12} className={text} />
                        <span className="truncate max-w-[180px]" title={s.email_recipients}>
                          {s.email_recipients}
                        </span>
                      </div>
                    )}
                    {s.send_whatsapp && s.whatsapp_recipients && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <MessageSquare size={12} />
                        <span className="truncate max-w-[180px]" title={s.whatsapp_recipients}>
                          {s.whatsapp_recipients}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {s.last_run_at ? (
                      <div>
                        <div className="text-[11px] font-semibold">{s.last_run_at}</div>
                        <div
                          className={`text-[10px] truncate max-w-[180px] ${
                            s.last_status === "success" ? "text-emerald-600" : "text-rose-500"
                          }`}
                          title={s.last_message || ""}
                        >
                          {s.last_message || s.last_status}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Henüz çalışmadı</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleRunNow(s)}
                          disabled={runningId === s.id}
                          title="Şimdi Gönder (Test Et)"
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
                        >
                          {runningId === s.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          <span>Şimdi Gönder</span>
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          title="Düzenle"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          title="Sil"
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delivery History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
            Son Gönderim Günlüğü
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  {h.status === "success" ? (
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                  )}
                  <span className="font-bold text-slate-800 dark:text-white">{h.schedule_name}</span>
                  <span className="text-slate-500 dark:text-slate-400">— {h.details}</span>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{h.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9990] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {formData.id ? "Zamanlanmış Raporu Düzenle" : "Yeni Zamanlanmış Rapor Ekle"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Rapor Görevi Başlığı
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Örn: Günlük Yönetici Çağrı & SLA Özeti"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Gönderim Sıklığı
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  >
                    <option value="daily">Günlük (Her Gün)</option>
                    <option value="weekly">Haftalık (Seçili Gün)</option>
                    <option value="monthly">Aylık (Ayın Seçili Günü)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Gönderim Saati (TR)
                  </label>
                  <input
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>

                {formData.frequency === "weekly" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Haftanın Günü
                    </label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.frequency === "monthly" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Ayın Günü (1–28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={formData.day_of_month}
                      onChange={(e) => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Raporlanacak Veri Dönemi
                  </label>
                  <select
                    value={formData.period_range}
                    onChange={(e) => setFormData({ ...formData, period_range: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  >
                    {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Report Modules Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                  Rapora Dahil Edilecek Modüller
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(reportTypesMap).map(([code, label]) => {
                    const checked = formData.report_types.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleReportModule(code)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          checked
                            ? `${lightBg} ${borderLight} ${lightText} font-bold`
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            checked ? `${bg} text-white` : "border border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {checked && <Check size={11} />}
                        </span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Channels */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_email}
                      onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                      className="rounded"
                    />
                    <Mail size={14} className={text} />
                    <span>E-Posta ile Gönder (HTML Özet Tablo + CSV/Excel Eki)</span>
                  </label>
                  {formData.send_email && (
                    <input
                      type="text"
                      value={formData.email_recipients}
                      onChange={(e) => setFormData({ ...formData, email_recipients: e.target.value })}
                      placeholder="yonetici@firma.com, operasyon@firma.com (virgülle ayırın)"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                    />
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_whatsapp}
                      onChange={(e) => setFormData({ ...formData, send_whatsapp: e.target.checked })}
                      className="rounded"
                    />
                    <MessageSquare size={14} className="text-emerald-500" />
                    <span>WhatsApp Business ile Yönetici Özeti Gönder</span>
                  </label>
                  {formData.send_whatsapp && (
                    <input
                      type="text"
                      value={formData.whatsapp_recipients}
                      onChange={(e) => setFormData({ ...formData, whatsapp_recipients: e.target.value })}
                      placeholder="905321234567, 905071234567 (virgülle ayırın)"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                    />
                  )}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Native Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Zamanlanmış Raporu Sil"
        message={`"${deleteTarget?.name || ""}" başlıklı zamanlanmış rapor görevini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
      />
    </div>
  );
}
