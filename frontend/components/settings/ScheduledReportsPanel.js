import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  ArrowUp,
  Users,
  FileText,
  X
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const DEFAULT_REPORT_MODULES = {
  reports_pano: "Pano (Genel Özet)",
  reports_cdr: "CDR (Detaylı Çağrı Kayıtları)",
  reports_audio: "Ses Kayıtları",
  reports_transcripts: "Çağrı Transkripti",
  reports_sentiment: "Duygu Analizi",
  reports_intent: "Niyet Raporu",
  reports_qa: "Kalite Değerlendirmeleri",
  reports_notes: "Temsilci Notları",
  reports_perf: "Temsilci Performans & KPI",
  reports_queue: "Kuyruk / Bekleme Analitiği",
  reports_survey: "Anket Raporları",
  reports_sentiment_heat: "Duygu Durumu Isı Haritası",
  reports_wordcloud: "Kelime Bulutu & Trendler",
  reports_fcr: "İlk Aramada Çözüm (FCR)",
  reports_roi: "AI vs. İnsan ROI Paneli",
  reports_missed: "Kaçan Çağrı Analizi",
  agent_timeline: "Temsilci Kronolojisi",
  reports_traffic_load: "Yoğunluk Raporu",
  reports_trunk: "Hat Kapasite Raporu",
  reports_did: "DID Raporu",
  reports_trunk_minutes: "Operatör Dakika & Paket Raporu",
  reports_invalid_calls: "Hatalı & Eşleşmeyen Çağrı Raporu",
  reports_ivr_drop: "IVR Terk Oranı",
  reports_transfer_hold: "Aktarma & Bekletme",
  reports_ab_testing: "Verimlilik Karşılaştırması",
  reports_friction: "Müşteri Çile Noktaları",
  reports_compliance: "Senaryo Sadakati Raporu",
  reports_silence: "Sessizlik & Söz Kesme",
  reports_ceo_summary: "CEO Özet Raporu",
  reports_breaks_attendance: "Mola & Puantaj Raporu",
  reports_omnichannel: "Omnichannel Kanal & SLA",
  reports_disposition: "Çağrı Sonuç Kodları",
  reports_dialer_callback: "Kampanya & Geri Arama",
  reports_queue_sla: "Kuyruk SLA & Hız Dilimleri",
  reports_repeat_callers: "Tekrar Eden Arayanlar",
  reports_dept_pickup: "Departman & Çağrı Toplama",
  reports_voip_quality: "VoIP & Ses Kalitesi (MOS)",
  reports_forwarding_gsm: "Çağrı Yönlendirme (Follow-Me / GSM)",
  reports_supervisor_audit: "Süpervizör Dinleme & Müdahale",
  reports_blacklist_security: "Engellenen Çağrı & İhlal Raporu",
  reports_ai_appointments_rag: "AI Randevu & Bilgi Bankası (RAG)",
  reports_voicemail: "Sesli Posta (Voicemail) Raporu",
  reports_conferences: "Konferans Odası Kullanım Raporu"
};

const LEGACY_REPORT_KEY_MAP = {
  cdr_summary: "reports_cdr",
  breaks_attendance: "reports_breaks_attendance",
  queue_sla: "reports_queue_sla",
  omnichannel: "reports_omnichannel",
  disposition: "reports_disposition",
  missed_recovery: "reports_missed",
  repeat_callers: "reports_repeat_callers"
};

function normalizeReportTypes(rawList, validMap = DEFAULT_REPORT_MODULES) {
  const out = [];
  (Array.isArray(rawList) ? rawList : []).forEach((k) => {
    const raw = String(k || "").trim();
    if (!raw) return;
    const mapped = LEGACY_REPORT_KEY_MAP[raw] || raw;
    if ((validMap[mapped] || mapped.startsWith("custom:")) && !out.includes(mapped)) {
      out.push(mapped);
    }
  });
  return out.length > 0 ? out : ["reports_cdr"];
}

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
  report_types: ["reports_pano", "reports_cdr", "reports_breaks_attendance", "reports_queue_sla"],
  send_email: true,
  email_user_ids: [],
  extra_emails: "",
  send_whatsapp: false,
  whatsapp_recipients: ""
};

function DualListBox({
  title,
  icon: TitleIcon,
  availableItems,
  selectedIds,
  onChangeSelectedIds,
  availableCountSuffix = "Öğe",
  selectedCountSuffix = "Seçili",
  availableSearchPlaceholder = "Arama...",
  selectedSearchPlaceholder = "Seçililerde ara...",
  emptyAvailableText = "Eklenebilecek öğe kalmadı veya aramayla eşleşmedi.",
  emptySelectedText = "Sol listeden seçim yapıp ok butonuyla (veya çift tıklayarak) buraya ekleyin.",
  columns = [],
  matchesItemQuery,
  renderRowCells,
  allowOrdering = false,
  lightBg,
  lightText,
  ring,
  borderLight
}) {
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [checkedAvailable, setCheckedAvailable] = useState([]);
  const [checkedSelected, setCheckedSelected] = useState([]);

  const normalizedSelectedIds = useMemo(
    () => (Array.isArray(selectedIds) ? selectedIds.map((x) => String(x)) : []),
    [selectedIds]
  );

  const unselectedItems = useMemo(
    () => availableItems.filter((i) => !normalizedSelectedIds.includes(String(i.id))),
    [availableItems, normalizedSelectedIds]
  );

  const selectedItems = useMemo(
    () =>
      normalizedSelectedIds
        .map((id) => availableItems.find((i) => String(i.id) === String(id)))
        .filter(Boolean),
    [availableItems, normalizedSelectedIds]
  );

  const defaultMatcher = (item, q) => {
    if (!q.trim()) return true;
    const low = q.trim().toLowerCase();
    return Object.values(item).some((v) => String(v || "").toLowerCase().includes(low));
  };

  const matchFn = matchesItemQuery || defaultMatcher;
  const filteredAvailable = unselectedItems.filter((i) => matchFn(i, availableSearch));
  const filteredSelected = selectedItems.filter((i) => matchFn(i, selectedSearch));

  const toggleAvailable = (id) => {
    const sid = String(id);
    setCheckedAvailable((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const toggleSelected = (id) => {
    const sid = String(id);
    setCheckedSelected((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const moveRight = (e) => {
    e.preventDefault();
    if (checkedAvailable.length === 0) return;
    const merged = Array.from(new Set([...normalizedSelectedIds, ...checkedAvailable]));
    onChangeSelectedIds(merged);
    setCheckedAvailable([]);
  };

  const moveLeft = (e) => {
    e.preventDefault();
    if (checkedSelected.length === 0) return;
    onChangeSelectedIds(normalizedSelectedIds.filter((id) => !checkedSelected.includes(id)));
    setCheckedSelected([]);
  };

  const quickAddOne = (id) => {
    const sid = String(id);
    if (!normalizedSelectedIds.includes(sid)) {
      onChangeSelectedIds([...normalizedSelectedIds, sid]);
      setCheckedAvailable((prev) => prev.filter((x) => x !== sid));
    }
  };

  const quickRemoveOne = (id) => {
    const sid = String(id);
    onChangeSelectedIds(normalizedSelectedIds.filter((x) => x !== sid));
    setCheckedSelected((prev) => prev.filter((x) => x !== sid));
  };

  const moveUp = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = normalizedSelectedIds.indexOf(id);
    if (index > 0) {
      const next = [...normalizedSelectedIds];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChangeSelectedIds(next);
    }
  };

  const moveDown = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = normalizedSelectedIds.indexOf(id);
    if (index > -1 && index < normalizedSelectedIds.length - 1) {
      const next = [...normalizedSelectedIds];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      onChangeSelectedIds(next);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {title && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            {TitleIcon && <TitleIcon size={13} className={lightText} />}
            <span>{title}</span>
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch gap-2.5 w-full">
        {/* Müsait Liste */}
        <div className={`flex-1 rounded-xl flex flex-col overflow-hidden h-[235px] border bg-white dark:bg-slate-900 ${borderLight}`}>
          <div className={`flex items-center justify-between px-3 py-2 border-b bg-slate-50 dark:bg-slate-900/70 ${borderLight}`}>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checkedAvailable.length === filteredAvailable.length && filteredAvailable.length > 0}
                onChange={(e) =>
                  setCheckedAvailable(e.target.checked ? filteredAvailable.map((i) => String(i.id)) : [])
                }
                className={`w-3.5 h-3.5 rounded border-slate-300 focus:${ring}`}
              />
              <span>
                {filteredAvailable.length} {availableCountSuffix}
              </span>
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Müsait</span>
          </div>

          <div className={`p-2 border-b ${borderLight}`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder={availableSearchPlaceholder}
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                className={`w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border focus:outline-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${borderLight}`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
            {filteredAvailable.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 p-3 text-center">
                {emptyAvailableText}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                {columns.length > 0 && (
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-2 w-7"></th>
                      {columns.map((col, idx) => (
                        <th key={idx} className="p-2 text-[10px] font-bold text-slate-400 uppercase">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
                  {filteredAvailable.map((item) => {
                    const isChecked = checkedAvailable.includes(String(item.id));
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleAvailable(item.id)}
                        onDoubleClick={() => quickAddOne(item.id)}
                        title="Seçmek için tıklayın, doğrudan eklemek için çift tıklayın"
                        className={`cursor-pointer transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60 ${
                          isChecked ? lightBg : ""
                        }`}
                      >
                        <td className="p-2 w-7">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAvailable(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                        </td>
                        {renderRowCells(item)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Aktarım Okları */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 px-1">
          <button
            type="button"
            onClick={moveRight}
            disabled={checkedAvailable.length === 0}
            title="Seçilileri ekle"
            className={`p-2 rounded-lg border transition-colors bg-white dark:bg-slate-800 ${borderLight} ${
              checkedAvailable.length > 0
                ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            }`}
          >
            <ChevronRight size={16} className="hidden md:block" />
            <ArrowDown size={16} className="block md:hidden" />
          </button>
          <button
            type="button"
            onClick={moveLeft}
            disabled={checkedSelected.length === 0}
            title="Seçilileri çıkar"
            className={`p-2 rounded-lg border transition-colors bg-white dark:bg-slate-800 ${borderLight} ${
              checkedSelected.length > 0
                ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            }`}
          >
            <ChevronLeft size={16} className="hidden md:block" />
            <ArrowUp size={16} className="block md:hidden" />
          </button>
        </div>

        {/* Seçili Liste */}
        <div className={`flex-1 rounded-xl flex flex-col overflow-hidden h-[235px] border ${borderLight} ${lightBg}`}>
          <div className={`flex items-center justify-between px-3 py-2 border-b bg-slate-50 dark:bg-slate-900/70 ${borderLight}`}>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checkedSelected.length === filteredSelected.length && filteredSelected.length > 0}
                onChange={(e) =>
                  setCheckedSelected(e.target.checked ? filteredSelected.map((i) => String(i.id)) : [])
                }
                className={`w-3.5 h-3.5 rounded border-slate-300 focus:${ring}`}
              />
              <span>
                {filteredSelected.length} {selectedCountSuffix}
              </span>
            </label>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${lightText}`}>Seçili</span>
          </div>

          <div className={`p-2 border-b bg-white/60 dark:bg-slate-900/40 ${borderLight}`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder={selectedSearchPlaceholder}
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
                className={`w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border focus:outline-none bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${borderLight}`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5 bg-white/40 dark:bg-slate-950/30">
            {filteredSelected.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 p-3 text-center">
                {emptySelectedText}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                {columns.length > 0 && (
                  <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200/70 dark:border-slate-800">
                    <tr>
                      <th className="p-2 w-7"></th>
                      {columns.map((col, idx) => (
                        <th key={idx} className="p-2 text-[10px] font-bold text-slate-400 uppercase">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
                  {filteredSelected.map((item) => {
                    const isChecked = checkedSelected.includes(String(item.id));
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleSelected(item.id)}
                        onDoubleClick={() => quickRemoveOne(item.id)}
                        title="Seçmek için tıklayın, çıkarmak için çift tıklayın"
                        className={`cursor-pointer transition-colors hover:bg-white/80 dark:hover:bg-slate-800/60 ${
                          isChecked ? lightBg : ""
                        }`}
                      >
                        <td className="p-2 w-7">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelected(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                        </td>
                        {renderRowCells(item)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sıralama Okları (İsteğe Bağlı) */}
        {allowOrdering && (
          <div className="hidden md:flex flex-col items-center justify-center gap-2 px-0.5">
            <button
              type="button"
              onClick={moveUp}
              disabled={checkedSelected.length !== 1}
              title="Yukarı Taşı"
              className={`p-1.5 rounded-lg border transition-colors bg-white dark:bg-slate-800 ${borderLight} ${
                checkedSelected.length === 1
                  ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              onClick={moveDown}
              disabled={checkedSelected.length !== 1}
              title="Aşağı Taşı"
              className={`p-1.5 rounded-lg border transition-colors bg-white dark:bg-slate-800 ${borderLight} ${
                checkedSelected.length === 1
                  ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              <ArrowDown size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [systemUsers, setSystemUsers] = useState([]);

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
      const [schedRes, usersRes] = await Promise.all([
        tenantFetch(`${API_BASE}/api/settings/scheduled-reports`),
        tenantFetch(`${API_BASE}/api/settings/users`).catch(() => null)
      ]);

      let mergedUsers = [];
      const seenUserIds = new Set();

      const pushUser = (u) => {
        if (!u || typeof u !== "object") return;
        const ext = String(u.extension || "").trim();
        const uid = String(u.id !== undefined && u.id !== null ? u.id : ext).trim();
        if (!uid || seenUserIds.has(uid)) return;
        seenUserIds.add(uid);
        mergedUsers.push({
          id: uid,
          extension: ext,
          full_name: String(u.full_name || u.name || `Dahili ${ext}`).trim(),
          email: String(u.email || "").trim(),
          role: String(u.role || "agent").trim()
        });
      };

      if (schedRes && schedRes.ok) {
        const json = await schedRes.json();
        setSchedules(Array.isArray(json.schedules) ? json.schedules : []);
        setHistory(Array.isArray(json.history) ? json.history : []);
        if (json.report_types && typeof json.report_types === "object" && Object.keys(json.report_types).length > 0) {
          setReportTypesMap({ ...DEFAULT_REPORT_MODULES, ...json.report_types });
        }
        if (Array.isArray(json.users)) {
          json.users.forEach(pushUser);
        }
      }

      if (usersRes && usersRes.ok) {
        const uJson = await usersRes.json().catch(() => []);
        const uArr = Array.isArray(uJson) ? uJson : Array.isArray(uJson?.users) ? uJson.users : [];
        uArr.forEach(pushUser);
      }

      setSystemUsers(mergedUsers);
    } catch (err) {
      console.error("[ScheduledReportsPanel] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (!isModalOpen || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isModalOpen]);

  const reportModuleItems = useMemo(
    () =>
      Object.entries(reportTypesMap).map(([code, label], idx) => ({
        id: code,
        orderNo: idx + 1,
        name: label
      })),
    [reportTypesMap]
  );

  const selectedUsersPreview = useMemo(() => {
    const ids = Array.isArray(formData.email_user_ids) ? formData.email_user_ids.map(String) : [];
    return ids
      .map((id) => systemUsers.find((u) => String(u.id) === id))
      .filter(Boolean);
  }, [formData.email_user_ids, systemUsers]);

  const resolvedUserEmails = useMemo(() => {
    const set = new Set();
    selectedUsersPreview.forEach((u) => {
      const m = String(u.email || "").trim();
      if (m.includes("@")) set.add(m);
    });
    return Array.from(set);
  }, [selectedUsersPreview]);

  const openCreateModal = () => {
    if (!canWrite) return;
    setFormData({ ...EMPTY_FORM });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    if (!canWrite) return;

    let initialUserIds = Array.isArray(item.email_user_ids)
      ? item.email_user_ids.map((x) => String(x))
      : [];
    let initialExtraEmails =
      item.extra_emails !== undefined && item.extra_emails !== null
        ? String(item.extra_emails)
        : "";

    // Migrate legacy manual email_recipients into matching user selections + remaining extra emails
    if (initialUserIds.length === 0 && !initialExtraEmails && item.email_recipients) {
      const rawParts = String(item.email_recipients)
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const unmatched = [];
      rawParts.forEach((addr) => {
        const matchedU = systemUsers.find(
          (u) => String(u.email || "").trim().toLowerCase() === addr.toLowerCase()
        );
        if (matchedU) {
          if (!initialUserIds.includes(String(matchedU.id))) {
            initialUserIds.push(String(matchedU.id));
          }
        } else {
          unmatched.push(addr);
        }
      });
      initialExtraEmails = unmatched.join(", ");
    }

    setFormData({
      id: item.id || "",
      name: item.name || "",
      enabled: item.enabled !== false,
      frequency: item.frequency || "daily",
      send_time: item.send_time || "09:00",
      day_of_week: Number(item.day_of_week ?? 0),
      day_of_month: Number(item.day_of_month ?? 1),
      period_range: item.period_range || "yesterday",
      report_types: normalizeReportTypes(item.report_types, reportTypesMap),
      send_email: item.send_email !== false,
      email_user_ids: initialUserIds,
      extra_emails: initialExtraEmails,
      send_whatsapp: Boolean(item.send_whatsapp),
      whatsapp_recipients: item.whatsapp_recipients || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!formData.name.trim()) {
      showToast("Lütfen zamanlanmış rapor için bir başlık girin.", "error");
      return;
    }
    if (!Array.isArray(formData.report_types) || formData.report_types.length === 0) {
      showToast("Lütfen rapora dahil edilecek en az bir rapor modülü seçin.", "error");
      return;
    }
    if (!formData.send_email && !formData.send_whatsapp) {
      showToast("En az bir gönderim kanalı (E-Posta veya WhatsApp) seçmelisiniz.", "error");
      return;
    }
    if (formData.send_email) {
      const hasExtraEmail = String(formData.extra_emails || "").includes("@");
      if (resolvedUserEmails.length === 0 && !hasExtraEmail) {
        showToast(
          "Lütfen E-Posta gönderimi için listeden e-posta adresi tanımlı en az bir kullanıcı seçin veya harici e-posta girin.",
          "error"
        );
        return;
      }
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

  const resolveScheduleUserNames = (s) => {
    if (Array.isArray(s.email_user_names) && s.email_user_names.length > 0) {
      return s.email_user_names;
    }
    if (Array.isArray(s.email_user_ids) && s.email_user_ids.length > 0) {
      return s.email_user_ids
        .map((id) => {
          const u = systemUsers.find((usr) => String(usr.id) === String(id));
          return u ? u.full_name : null;
        })
        .filter(Boolean);
    }
    return [];
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
              Belirlediğiniz gün ve saatlerde seçili rapor modüllerini CSV/Excel ekiyle sistem kullanıcılarına otomatik iletin.
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
              schedules.map((s) => {
                const normMods = normalizeReportTypes(s.report_types, reportTypesMap);
                const visibleMods = normMods.slice(0, 3);
                const hiddenModCount = Math.max(0, normMods.length - visibleMods.length);
                const fullModTooltip = normMods.map((rt) => reportTypesMap[rt] || rt).join(", ");
                const userNames = resolveScheduleUserNames(s);

                return (
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
                    <td className="px-4 py-3.5" title={fullModTooltip}>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {visibleMods.map((rt) => (
                          <span
                            key={rt}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${lightBg} ${lightText}`}
                          >
                            {reportTypesMap[rt] || rt}
                          </span>
                        ))}
                        {hiddenModCount > 0 && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            +{hiddenModCount} rapor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      {s.send_email && (userNames.length > 0 || s.email_recipients) && (
                        <div className="space-y-0.5">
                          {userNames.length > 0 && (
                            <div
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                              title={userNames.join(", ")}
                            >
                              <Users size={12} className={text} />
                              <span className="truncate max-w-[200px]">
                                {userNames.length} Kullanıcı ({userNames.join(", ")})
                              </span>
                            </div>
                          )}
                          {s.email_recipients && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <Mail size={11} className={text} />
                              <span className="truncate max-w-[200px]" title={s.email_recipients}>
                                {s.email_recipients}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {s.send_whatsapp && s.whatsapp_recipients && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <MessageSquare size={12} />
                          <span className="truncate max-w-[200px]" title={s.whatsapp_recipients}>
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
                );
              })
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
      {isModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 overscroll-contain">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-auto"
              style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col transform-gpu"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  {formData.id ? "Zamanlanmış Raporu Düzenle" : "Yeni Zamanlanmış Rapor Ekle"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto overscroll-contain text-xs">
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

              {/* All 37 Report Modules Selection (DualListBox) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70">
                <DualListBox
                  title="Rapora Dahil Edilecek Modüller (Çift tıklayarak veya oklarla istediğiniz kadar rapor ekleyin)"
                  icon={FileText}
                  availableItems={reportModuleItems}
                  selectedIds={formData.report_types}
                  onChangeSelectedIds={(newIds) =>
                    setFormData((prev) => ({ ...prev, report_types: newIds }))
                  }
                  availableCountSuffix="Rapor"
                  selectedCountSuffix="Seçili Rapor"
                  availableSearchPlaceholder="Rapor modülü ara (Örn: CDR, Kuyruk, Mola, Anket, MOS...)"
                  selectedSearchPlaceholder="Seçili raporlarda ara..."
                  emptyAvailableText="Tüm rapor modülleri seçildi veya aramayla eşleşen rapor yok."
                  emptySelectedText="Sol listeden rapor seçip ok butonuyla (veya çift tıklayarak) buraya ekleyin."
                  columns={["#", "Rapor Modülü"]}
                  allowOrdering={true}
                  matchesItemQuery={(item, q) => {
                    if (!q.trim()) return true;
                    const low = q.trim().toLowerCase();
                    return (
                      String(item.name || "").toLowerCase().includes(low) ||
                      String(item.id || "").toLowerCase().includes(low)
                    );
                  }}
                  renderRowCells={(item) => (
                    <>
                      <td className="p-2 w-8 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {item.orderNo}
                      </td>
                      <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                        {item.name}
                      </td>
                    </>
                  )}
                  lightBg={lightBg}
                  lightText={lightText}
                  ring={ring}
                  borderLight={borderLight}
                />
              </div>

              {/* Delivery Channels */}
              <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-3">
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
                    <div className="space-y-3 pt-1">
                      <DualListBox
                        title="Kullanıcılar (Çift tıklayarak veya oklarla istediğiniz kadar kullanıcı ekleyin)"
                        icon={Users}
                        availableItems={systemUsers}
                        selectedIds={formData.email_user_ids}
                        onChangeSelectedIds={(newIds) =>
                          setFormData((prev) => ({ ...prev, email_user_ids: newIds }))
                        }
                        availableCountSuffix="Kullanıcı"
                        selectedCountSuffix="Seçili Alıcı"
                        availableSearchPlaceholder="İsim, dahili veya e-posta ara..."
                        selectedSearchPlaceholder="Seçililerde ara..."
                        emptyAvailableText="Eklenebilecek kullanıcı kalmadı veya aramayla eşleşmedi."
                        emptySelectedText="Sol listeden kullanıcı seçip ok butonuyla (veya çift tıklayarak) buraya ekleyin."
                        columns={["Dahili", "Kullanıcı & E-Posta"]}
                        matchesItemQuery={(item, q) => {
                          if (!q.trim()) return true;
                          const low = q.trim().toLowerCase();
                          return (
                            String(item.full_name || "").toLowerCase().includes(low) ||
                            String(item.extension || "").toLowerCase().includes(low) ||
                            String(item.email || "").toLowerCase().includes(low)
                          );
                        }}
                        renderRowCells={(item) => {
                          const hasValidEmail = String(item.email || "").includes("@");
                          return (
                            <>
                              <td className="p-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {item.extension || "-"}
                              </td>
                              <td className="p-2">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                  {item.full_name}
                                </div>
                                {hasValidEmail ? (
                                  <div
                                    className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[165px]"
                                    title={item.email}
                                  >
                                    {item.email}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                    E-posta tanımlı değil
                                  </div>
                                )}
                              </td>
                            </>
                          );
                        }}
                        lightBg={lightBg}
                        lightText={lightText}
                        ring={ring}
                        borderLight={borderLight}
                      />

                      {selectedUsersPreview.length > 0 && (
                        <div className={`px-3 py-2 rounded-xl border text-[11px] ${lightBg} ${borderLight}`}>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            Seçili kullanıcılardan algılanan e-postalar ({resolvedUserEmails.length}):{" "}
                          </span>
                          {resolvedUserEmails.length > 0 ? (
                            <span className={lightText}>{resolvedUserEmails.join(", ")}</span>
                          ) : (
                            <span className="text-rose-500 font-semibold">
                              Seçili kullanıcıların profilinde geçerli bir e-posta adresi bulunmuyor!
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Ek Harici E-Posta Adresleri (İsteğe Bağlı)
                        </label>
                        <input
                          type="text"
                          value={formData.extra_emails}
                          onChange={(e) => setFormData({ ...formData, extra_emails: e.target.value })}
                          placeholder="Sistem dışı alıcı eklemek isterseniz yazın: yonetim@firma.com, muhasebe@firma.com"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
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
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
          </div>,
          document.body
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
