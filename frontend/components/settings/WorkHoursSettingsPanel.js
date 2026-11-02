import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  ToggleLeft,
  ToggleRight,
  Copy,
  Sparkles,
  Coffee,
  Globe,
  RefreshCw,
  Shield
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import InfoTooltip from "../common/InfoTooltip";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const IANA_TIMEZONES = [
  { id: "Europe/Istanbul", label: "Türkiye — İstanbul (Europe/Istanbul)" },
  { id: "Asia/Nicosia", label: "KKTC — Lefkoşa (Asia/Nicosia)" },
  { id: "Asia/Baku", label: "Azerbaycan — Bakü (Asia/Baku)" },
  { id: "Europe/Berlin", label: "Almanya — Berlin (Europe/Berlin)" },
  { id: "Europe/London", label: "Birleşik Krallık — Londra (Europe/London)" },
  { id: "Europe/Amsterdam", label: "Hollanda — Amsterdam (Europe/Amsterdam)" },
  { id: "Asia/Dubai", label: "BAE — Dubai (Asia/Dubai)" },
  { id: "America/New_York", label: "ABD Doğu — New York (America/New_York)" }
];

const WEEK_DAYS = [
  { key: "monday", label: "Pazartesi", short: "Pzt", isWeekend: false },
  { key: "tuesday", label: "Salı", short: "Sal", isWeekend: false },
  { key: "wednesday", label: "Çarşamba", short: "Çar", isWeekend: false },
  { key: "thursday", label: "Perşembe", short: "Per", isWeekend: false },
  { key: "friday", label: "Cuma", short: "Cum", isWeekend: false },
  { key: "saturday", label: "Cumartesi", short: "Cmt", isWeekend: true },
  { key: "sunday", label: "Pazar", short: "Paz", isWeekend: true }
];

const MONTHS_TR = [
  { num: "01", name: "Ocak", maxDays: 31 },
  { num: "02", name: "Şubat", maxDays: 29 },
  { num: "03", name: "Mart", maxDays: 31 },
  { num: "04", name: "Nisan", maxDays: 30 },
  { num: "05", name: "Mayıs", maxDays: 31 },
  { num: "06", name: "Haziran", maxDays: 30 },
  { num: "07", name: "Temmuz", maxDays: 31 },
  { num: "08", name: "Ağustos", maxDays: 31 },
  { num: "09", name: "Eylül", maxDays: 30 },
  { num: "10", name: "Ekim", maxDays: 31 },
  { num: "11", name: "Kasım", maxDays: 30 },
  { num: "12", name: "Aralık", maxDays: 31 }
];

const TURKEY_HOLIDAY_PRESETS = [
  { id: "tr-01-01", name: "Yılbaşı", recurring: true, month_day: "01-01", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-04-23", name: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı", recurring: true, month_day: "04-23", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-05-01", name: "1 Mayıs Emek ve Dayanışma Günü", recurring: true, month_day: "05-01", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-05-19", name: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı", recurring: true, month_day: "05-19", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-07-15", name: "15 Temmuz Demokrasi ve Milli Birlik Günü", recurring: true, month_day: "07-15", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-08-30", name: "30 Ağustos Zafer Bayramı", recurring: true, month_day: "08-30", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-10-28", name: "28 Ekim Cumhuriyet Bayramı Arifesi", recurring: true, month_day: "10-28", start_date: "", end_date: "", mode: "custom_hours", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-10-29", name: "29 Ekim Cumhuriyet Bayramı", recurring: true, month_day: "10-29", start_date: "", end_date: "", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  // 2026 Dini Bayramlar
  { id: "tr-2026-ramazan-arife", name: "Ramazan Bayramı Arifesi (2026)", recurring: false, month_day: "", start_date: "2026-03-19", end_date: "2026-03-19", mode: "custom_hours", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2026-ramazan", name: "Ramazan Bayramı (2026)", recurring: false, month_day: "", start_date: "2026-03-20", end_date: "2026-03-22", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2026-kurban-arife", name: "Kurban Bayramı Arifesi (2026)", recurring: false, month_day: "", start_date: "2026-05-26", end_date: "2026-05-26", mode: "custom_hours", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2026-kurban", name: "Kurban Bayramı (2026)", recurring: false, month_day: "", start_date: "2026-05-27", end_date: "2026-05-30", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  // 2027 Dini Bayramlar
  { id: "tr-2027-ramazan-arife", name: "Ramazan Bayramı Arifesi (2027)", recurring: false, month_day: "", start_date: "2027-03-08", end_date: "2027-03-08", mode: "custom_hours", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2027-ramazan", name: "Ramazan Bayramı (2027)", recurring: false, month_day: "", start_date: "2027-03-09", end_date: "2027-03-11", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2027-kurban-arife", name: "Kurban Bayramı Arifesi (2027)", recurring: false, month_day: "", start_date: "2027-05-15", end_date: "2027-05-15", mode: "custom_hours", custom_start: "09:00", custom_end: "13:00", active: true },
  { id: "tr-2027-kurban", name: "Kurban Bayramı (2027)", recurring: false, month_day: "", start_date: "2027-05-16", end_date: "2027-05-19", mode: "closed", custom_start: "09:00", custom_end: "13:00", active: true }
];

const DEFAULT_WEEKLY_SCHEDULE = {
  monday: { enabled: true, start: "09:00", end: "18:00" },
  tuesday: { enabled: true, start: "09:00", end: "18:00" },
  wednesday: { enabled: true, start: "09:00", end: "18:00" },
  thursday: { enabled: true, start: "09:00", end: "18:00" },
  friday: { enabled: true, start: "09:00", end: "18:00" },
  saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "18:00" }
};

// Location-agnostic wall-clock & calendar helpers (Temporal Plain* first, pure calendar fallback without legacy Date ISO drift)
function parseWallClockMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return 0;
  try {
    if (typeof globalThis.Temporal !== "undefined" && globalThis.Temporal.PlainTime) {
      const pt = globalThis.Temporal.PlainTime.from(hhmm);
      return pt.hour * 60 + pt.minute;
    }
  } catch (e) {}
  const [hStr, mStr] = hhmm.split(":");
  const h = Math.max(0, Math.min(23, parseInt(hStr, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
  return h * 60 + m;
}

function formatDurationLabel(startStr, endStr, lunchEnabled = false, lunchStart = "12:30", lunchEnd = "13:30") {
  const s = parseWallClockMinutes(startStr);
  const e = parseWallClockMinutes(endStr);
  let totalMin = e >= s ? e - s : 24 * 60 - s + e;
  if (lunchEnabled) {
    const ls = parseWallClockMinutes(lunchStart);
    const le = parseWallClockMinutes(lunchEnd);
    if (le > ls && ls >= s && le <= e) {
      totalMin = Math.max(0, totalMin - (le - ls));
    }
  }
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0 && mins > 0) return `${hrs} sa ${mins} dk`;
  if (hrs > 0) return `${hrs} sa`;
  return `${mins} dk`;
}

function formatPlainDateTr(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return "-";
  try {
    if (typeof globalThis.Temporal !== "undefined" && globalThis.Temporal.PlainDate) {
      const pd = globalThis.Temporal.PlainDate.from(isoDateStr);
      const mObj = MONTHS_TR[pd.month - 1];
      return `${pd.day} ${mObj ? mObj.name : pd.month} ${pd.year}`;
    }
  } catch (e) {}
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = (parseInt(parts[1], 10) || 1) - 1;
  const day = parseInt(parts[2], 10) || 1;
  const mObj = MONTHS_TR[monthIdx];
  return `${day} ${mObj ? mObj.name : parts[1]} ${year}`;
}

function formatPlainMonthDayTr(mmDdStr) {
  if (!mmDdStr || typeof mmDdStr !== "string") return "-";
  const parts = mmDdStr.split("-");
  if (parts.length !== 2) return mmDdStr;
  const mNum = parseInt(parts[0], 10) || 1;
  const dNum = parseInt(parts[1], 10) || 1;
  try {
    if (typeof globalThis.Temporal !== "undefined" && globalThis.Temporal.PlainMonthDay) {
      const pmd = globalThis.Temporal.PlainMonthDay.from({
        month: mNum,
        day: dNum,
        calendar: "iso8601"
      });
      const mObj = MONTHS_TR[pmd.monthCode ? parseInt(pmd.monthCode.replace("M", ""), 10) - 1 : mNum - 1];
      return `${pmd.day} ${mObj ? mObj.name : mNum}`;
    }
  } catch (e) {}
  const mObj = MONTHS_TR[mNum - 1];
  return `${dNum} ${mObj ? mObj.name : parts[0]}`;
}

function compareIsoPlainDates(aStr, bStr) {
  try {
    if (typeof globalThis.Temporal !== "undefined" && globalThis.Temporal.PlainDate) {
      return globalThis.Temporal.PlainDate.compare(
        globalThis.Temporal.PlainDate.from(aStr),
        globalThis.Temporal.PlainDate.from(bStr)
      );
    }
  } catch (e) {}
  return String(aStr).localeCompare(String(bStr));
}

export default function WorkHoursSettingsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const apiBase = getApiBaseUrl(backendHost);

  // Granular permissions
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(true);
  const [canDelete, setCanDelete] = useState(true);

  // Tab navigation ('weekly' | 'holidays')
  const [activeSectionTab, setActiveSectionTab] = useState("weekly");
  const sectionTabRefs = useRef({});

  // Work Hours & Holidays Config State
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [lunchBreakEnabled, setLunchBreakEnabled] = useState(false);
  const [lunchStart, setLunchStart] = useState("12:30");
  const [lunchEnd, setLunchEnd] = useState("13:30");
  const [weeklySchedule, setWeeklySchedule] = useState(DEFAULT_WEEKLY_SCHEDULE);
  const [holidays, setHolidays] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);

  // UI Feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Holiday filtering & search
  const [holidaySearch, setHolidaySearch] = useState("");
  const [holidayFilter, setHolidayFilter] = useState("all"); // 'all' | 'recurring' | 'dated' | 'custom_hours'

  // Add / Edit Holiday Modal
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holName, setHolName] = useState("");
  const [holRecurring, setHolRecurring] = useState(true);
  const [holMonth, setHolMonth] = useState("10");
  const [holDay, setHolDay] = useState("29");
  const [holStartDate, setHolStartDate] = useState("2026-01-01");
  const [holEndDate, setHolEndDate] = useState("2026-01-01");
  const [holMode, setHolMode] = useState("closed"); // 'closed' | 'custom_hours'
  const [holCustomStart, setHolCustomStart] = useState("09:00");
  const [holCustomEnd, setHolCustomEnd] = useState("13:00");
  const [holFormError, setHolFormError] = useState("");

  // Delete Confirmation Modal
  const [deleteTargetHoliday, setDeleteTargetHoliday] = useState(null);

  useEffect(() => {
    checkUserPermissions();
    fetchWorkHoursData();
    const handleTenantSwitch = () => fetchWorkHoursData();
    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantSwitch);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tenantChanged", handleTenantSwitch);
      }
    };
  }, [backendHost]);

  const checkUserPermissions = async () => {
    try {
      const savedUserId =
        typeof window !== "undefined"
          ? localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id")
          : null;
      if (!savedUserId || savedUserId === "admin") {
        setCanRead(true);
        setCanWrite(true);
        setCanDelete(true);
        return;
      }
      const [uRes, rRes] = await Promise.all([
        tenantFetch(`${apiBase}/api/settings/users`),
        tenantFetch(`${apiBase}/api/settings/roles`)
      ]);
      if (!uRes.ok || !rRes.ok) return;
      const usersData = await uRes.json();
      const rolesData = await rRes.json();
      const uList = Array.isArray(usersData) ? usersData : usersData?.users || [];
      const rList = Array.isArray(rolesData) ? rolesData : rolesData?.roles || [];
      const me = uList.find(
        (u) => String(u.id) === String(savedUserId) || String(u.extension) === String(savedUserId)
      );
      if (!me || me.role === "admin" || me.role === "superadmin") {
        setCanRead(true);
        setCanWrite(true);
        setCanDelete(true);
        return;
      }
      const roleObj = rList.find((r) => r.role_code === me.role);
      const perms = Array.isArray(roleObj?.permissions) ? roleObj.permissions : [];
      setCanRead(perms.includes("work_hours:read") || perms.includes("pbx:read"));
      setCanWrite(perms.includes("work_hours:write") || perms.includes("pbx:write"));
      setCanDelete(perms.includes("work_hours:delete") || perms.includes("pbx:delete"));
    } catch (e) {
      // keep safe defaults on transient network error
    }
  };

  const fetchWorkHoursData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await tenantFetch(`${apiBase}/api/settings/work-hours`);
      if (res.ok) {
        const data = await res.json();
        const cfg = data?.work_hours || {};
        setEnabled(cfg.enabled !== false);
        setTimezone(cfg.timezone || "Europe/Istanbul");
        setLunchBreakEnabled(Boolean(cfg.lunch_break_enabled));
        setLunchStart(cfg.lunch_start || "12:30");
        setLunchEnd(cfg.lunch_end || "13:30");
        setWeeklySchedule({
          ...DEFAULT_WEEKLY_SCHEDULE,
          ...(cfg.weekly_schedule || {})
        });
        setHolidays(Array.isArray(cfg.holidays) ? cfg.holidays : []);
        if (data?.live_status) {
          setLiveStatus(data.live_status);
        }
      }
    } catch (err) {
      setErrorMsg("Mesai saatleri ve resmi tatil yapılandırması yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const persistConfig = async (overridePartial = {}) => {
    if (!canWrite) return false;
    setSaving(true);
    setErrorMsg("");
    const payload = {
      enabled,
      timezone,
      lunch_break_enabled: lunchBreakEnabled,
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      weekly_schedule: weeklySchedule,
      holidays,
      ...overridePartial
    };
    try {
      const res = await tenantFetch(`${apiBase}/api/settings/work-hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.work_hours?.holidays) {
          setHolidays(data.work_hours.holidays);
        }
        if (data?.live_status) {
          setLiveStatus(data.live_status);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        return true;
      } else {
        setErrorMsg("Ayarlar kaydedilirken bir hata oluştu.");
        return false;
      }
    } catch (err) {
      setErrorMsg("Sunucu bağlantı hatası oluştu.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateDaySchedule = (dayKey, field, val) => {
    if (!canWrite) return;
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { enabled: false, start: "09:00", end: "18:00" }),
        [field]: val
      }
    }));
  };

  const applyPresetSchedule = (presetType) => {
    if (!canWrite) return;
    if (presetType === "weekdays_9_18") {
      setWeeklySchedule({
        monday: { enabled: true, start: "09:00", end: "18:00" },
        tuesday: { enabled: true, start: "09:00", end: "18:00" },
        wednesday: { enabled: true, start: "09:00", end: "18:00" },
        thursday: { enabled: true, start: "09:00", end: "18:00" },
        friday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: false, start: "09:00", end: "13:00" },
        sunday: { enabled: false, start: "09:00", end: "18:00" }
      });
    } else if (presetType === "weekdays_plus_sat") {
      setWeeklySchedule({
        monday: { enabled: true, start: "09:00", end: "18:00" },
        tuesday: { enabled: true, start: "09:00", end: "18:00" },
        wednesday: { enabled: true, start: "09:00", end: "18:00" },
        thursday: { enabled: true, start: "09:00", end: "18:00" },
        friday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: true, start: "09:00", end: "13:00" },
        sunday: { enabled: false, start: "09:00", end: "18:00" }
      });
    } else if (presetType === "24_7") {
      const allOpen = {};
      WEEK_DAYS.forEach((d) => {
        allOpen[d.key] = { enabled: true, start: "00:00", end: "23:59" };
      });
      setWeeklySchedule(allOpen);
      setLunchBreakEnabled(false);
    } else if (presetType === "copy_monday_to_weekdays") {
      const mon = weeklySchedule.monday || { enabled: true, start: "09:00", end: "18:00" };
      setWeeklySchedule((prev) => ({
        ...prev,
        monday: { ...mon },
        tuesday: { ...mon },
        wednesday: { ...mon },
        thursday: { ...mon },
        friday: { ...mon }
      }));
    }
  };

  const openAddHolidayModal = () => {
    if (!canWrite) return;
    setEditingHoliday(null);
    setHolName("");
    setHolRecurring(true);
    setHolMonth("10");
    setHolDay("29");
    setHolStartDate("2026-01-01");
    setHolEndDate("2026-01-01");
    setHolMode("closed");
    setHolCustomStart("09:00");
    setHolCustomEnd("13:00");
    setHolFormError("");
    setShowHolidayModal(true);
  };

  const openEditHolidayModal = (h) => {
    if (!canWrite) return;
    setEditingHoliday(h);
    setHolName(h.name || "");
    setHolRecurring(Boolean(h.recurring));
    if (h.recurring && h.month_day) {
      const [m, d] = String(h.month_day).split("-");
      setHolMonth(m || "01");
      setHolDay(d || "01");
    } else {
      setHolMonth("01");
      setHolDay("01");
    }
    setHolStartDate(h.start_date || "2026-01-01");
    setHolEndDate(h.end_date || h.start_date || "2026-01-01");
    setHolMode(h.mode || "closed");
    setHolCustomStart(h.custom_start || "09:00");
    setHolCustomEnd(h.custom_end || "13:00");
    setHolFormError("");
    setShowHolidayModal(true);
  };

  const handleSaveHolidayModal = async (e) => {
    e.preventDefault();
    setHolFormError("");
    if (!holName.trim()) {
      setHolFormError("Lütfen resmi tatil veya özel gün adını giriniz.");
      return;
    }

    let nextItem = {
      id: editingHoliday?.id || `hol-${Date.now()}`,
      name: holName.trim(),
      recurring: holRecurring,
      month_day: holRecurring ? `${holMonth}-${holDay.padStart(2, "0")}` : "",
      start_date: holRecurring ? "" : holStartDate,
      end_date: holRecurring ? "" : (holEndDate || holStartDate),
      mode: holMode,
      custom_start: holCustomStart || "09:00",
      custom_end: holCustomEnd || "13:00",
      active: editingHoliday ? editingHoliday.active !== false : true
    };

    if (!holRecurring) {
      if (!holStartDate) {
        setHolFormError("Lütfen başlangıç tarihini seçiniz.");
        return;
      }
      if (holEndDate && compareIsoPlainDates(holEndDate, holStartDate) < 0) {
        setHolFormError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        return;
      }
    }

    const updatedHolidays = editingHoliday
      ? holidays.map((item) => (item.id === editingHoliday.id ? nextItem : item))
      : [...holidays, nextItem];

    setHolidays(updatedHolidays);
    setShowHolidayModal(false);
    await persistConfig({ holidays: updatedHolidays });
  };

  const handleToggleHolidayActive = async (holId) => {
    if (!canWrite) return;
    const updatedHolidays = holidays.map((h) =>
      h.id === holId ? { ...h, active: h.active === false ? true : false } : h
    );
    setHolidays(updatedHolidays);
    await persistConfig({ holidays: updatedHolidays });
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!deleteTargetHoliday || !canDelete) return;
    const updatedHolidays = holidays.filter((h) => h.id !== deleteTargetHoliday.id);
    setHolidays(updatedHolidays);
    setDeleteTargetHoliday(null);
    await persistConfig({ holidays: updatedHolidays });
  };

  const handleLoadTurkeyPresets = async () => {
    if (!canWrite) return;
    const existingKeys = new Set(
      holidays.map((h) =>
        h.recurring ? `R:${h.month_day}` : `D:${h.start_date}:${h.end_date || h.start_date}`
      )
    );
    const merged = [...holidays];
    TURKEY_HOLIDAY_PRESETS.forEach((preset) => {
      const key = preset.recurring
        ? `R:${preset.month_day}`
        : `D:${preset.start_date}:${preset.end_date || preset.start_date}`;
      if (!existingKeys.has(key)) {
        merged.push({ ...preset });
        existingKeys.add(key);
      }
    });
    setHolidays(merged);
    await persistConfig({ holidays: merged });
  };

  const handleSectionTabKeyDown = (e, idx) => {
    const tabIds = ["weekly", "holidays"];
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabIds.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabIds.length) % tabIds.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabIds.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = tabIds[nextIdx];
      setActiveSectionTab(targetTab);
      sectionTabRefs.current[targetTab]?.focus();
    }
  };

  if (!canRead) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <Shield size={28} className="mx-auto text-rose-500" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Erişim Yetkiniz Bulunmuyor</h3>
        <p className="text-xs text-slate-500">
          Mesai Saatleri ve Resmi Tatiller ekranını görüntülemek için rolünüzde <code>work_hours:read</code> yetkisi olmalıdır.
        </p>
      </div>
    );
  }

  const selectedMonthMeta = MONTHS_TR.find((m) => m.num === holMonth) || MONTHS_TR[0];
  const dayOptions = Array.from({ length: selectedMonthMeta.maxDays }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );

  const filteredHolidays = holidays.filter((h) => {
    if (holidayFilter === "recurring" && !h.recurring) return false;
    if (holidayFilter === "dated" && h.recurring) return false;
    if (holidayFilter === "custom_hours" && h.mode !== "custom_hours") return false;
    if (holidaySearch.trim()) {
      const q = holidaySearch.trim().toLowerCase();
      return (
        String(h.name || "").toLowerCase().includes(q) ||
        String(h.month_day || "").toLowerCase().includes(q) ||
        String(h.start_date || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeHolidayCount = holidays.filter((h) => h.active !== false).length;
  const openDaysCount = WEEK_DAYS.filter((d) => weeklySchedule[d.key]?.enabled).length;

  return (
    <div className="w-full space-y-5">
      {/* Üst Başlık ve Canlı Mesai Durumu Kartı */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock size={20} className={text} aria-hidden="true" />
              <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                Mesai Saatleri & Resmi Tatiller
              </h2>
              <InfoTooltip
                title="Merkezi Mesai & Resmi Tatil Yönetimi"
                text="Çağrı akışlarındaki Zaman Kontrolü düğümleri ve WhatsApp / Omnichannel mesai dışı karşılama motoru buradaki haftalık çalışma saatlerini ve resmi tatil takvimini referans alır."
              />
              {liveStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                    liveStatus.is_open
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                      : liveStatus.is_holiday
                      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                      : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      liveStatus.is_open
                        ? "bg-emerald-500 animate-pulse"
                        : liveStatus.is_holiday
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                  <span>
                    {liveStatus.is_open
                      ? "Şu An Mesai İçi (Açık)"
                      : liveStatus.is_holiday
                      ? "Şu An Resmi Tatil"
                      : "Şu An Mesai Dışı (Kapalı)"}
                  </span>
                  {liveStatus.local_time && (
                    <span className="opacity-75 font-mono">• {liveStatus.local_time}</span>
                  )}
                </span>
              )}
            </div>
            {liveStatus?.reason && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Canlı Durum: <span className="font-semibold text-slate-700 dark:text-slate-200">{liveStatus.reason}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={!canWrite}
              aria-pressed={enabled}
              onClick={() => setEnabled((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                enabled
                  ? `${lightBg} ${text} ${borderLight}`
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500"
              } disabled:opacity-50`}
            >
              {enabled ? <ToggleRight size={18} className={text} /> : <ToggleLeft size={18} />}
              <span>{enabled ? "Mesai Kontrolü Aktif" : "Mesai Kontrolü Kapalı (7/24)"}</span>
            </button>

            <button
              type="button"
              onClick={fetchWorkHoursData}
              title="Canlı durumu yenile"
              aria-label="Canlı durumu yenile"
              className={`p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            {canWrite && (
              <button
                type="button"
                disabled={saving}
                onClick={() => persistConfig()}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${bg} ${hover} disabled:opacity-60`}
              >
                <Save size={15} />
                <span>{saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Zaman Dilimi (IANA) ve Özet Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <label
              htmlFor="work-hours-iana-tz"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Globe size={14} className={text} />
              <span>Zaman Dilimi:</span>
            </label>
            <select
              id="work-hours-iana-tz"
              disabled={!canWrite}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} disabled:opacity-60`}
            >
              {IANA_TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              Açık Gün: <strong className="text-slate-800 dark:text-white">{openDaysCount}/7</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              Aktif Resmi Tatil: <strong className="text-slate-800 dark:text-white">{activeHolidayCount}</strong>
            </span>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle size={15} />
            <span>Mesai saatleri ve resmi tatil ayarları başarıyla kaydedildi.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Sekme Başlıkları: Haftalık Mesai Saatleri | Resmi Tatiller & Özel Günler */}
      <div
        role="tablist"
        aria-label="Mesai ve resmi tatil yapılandırma sekmeleri"
        className={`p-1.5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm flex items-center gap-1.5 ${borderLight}`}
      >
        <button
          ref={(el) => {
            sectionTabRefs.current.weekly = el;
          }}
          type="button"
          role="tab"
          id="wh-tab-weekly"
          aria-selected={activeSectionTab === "weekly"}
          aria-controls="wh-panel-weekly"
          tabIndex={activeSectionTab === "weekly" ? 0 : -1}
          onClick={() => setActiveSectionTab("weekly")}
          onKeyDown={(e) => handleSectionTabKeyDown(e, 0)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
            activeSectionTab === "weekly"
              ? `${bg} text-white shadow-sm`
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
          }`}
        >
          <Clock size={15} aria-hidden="true" />
          <span>Haftalık Mesai Saatleri</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
              activeSectionTab === "weekly"
                ? "bg-white/20 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            }`}
          >
            {openDaysCount} Gün
          </span>
        </button>

        <button
          ref={(el) => {
            sectionTabRefs.current.holidays = el;
          }}
          type="button"
          role="tab"
          id="wh-tab-holidays"
          aria-selected={activeSectionTab === "holidays"}
          aria-controls="wh-panel-holidays"
          tabIndex={activeSectionTab === "holidays" ? 0 : -1}
          onClick={() => setActiveSectionTab("holidays")}
          onKeyDown={(e) => handleSectionTabKeyDown(e, 1)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
            activeSectionTab === "holidays"
              ? `${bg} text-white shadow-sm`
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
          }`}
        >
          <Calendar size={15} aria-hidden="true" />
          <span>Resmi Tatiller & Özel Günler</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
              activeSectionTab === "holidays"
                ? "bg-white/20 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            }`}
          >
            {holidays.length}
          </span>
        </button>
      </div>

      {/* SEKME 1: HAFTALIK MESAİ SAATLERİ */}
      {activeSectionTab === "weekly" && (
        <div
          role="tabpanel"
          id="wh-panel-weekly"
          aria-labelledby="wh-tab-weekly"
          className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 animate-in fade-in duration-200"
        >
          {/* Hızlı Şablonlar & Öğle Arası */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                Hızlı Şablonlar:
              </span>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => applyPresetSchedule("weekdays_9_18")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
              >
                Hafta İçi (09:00 – 18:00)
              </button>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => applyPresetSchedule("weekdays_plus_sat")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
              >
                Hafta İçi + Cmt Yarım Gün
              </button>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => applyPresetSchedule("24_7")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
              >
                7/24 Kesintisiz Açık
              </button>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => applyPresetSchedule("copy_monday_to_weekdays")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${lightBg} ${text} ${borderLight} transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
              >
                <Copy size={12} />
                <span>Pazartesi Saatini Hafta İçine Kopyala</span>
              </button>
            </div>

            {/* Öğle Arası Ayarı */}
            <div className="flex flex-wrap items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              <button
                type="button"
                disabled={!canWrite}
                aria-pressed={lunchBreakEnabled}
                onClick={() => setLunchBreakEnabled((prev) => !prev)}
                className={`flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 ${ring} rounded-lg px-1.5 py-0.5 ${
                  lunchBreakEnabled ? text : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Coffee size={14} />
                <span>Öğle Arası Molası</span>
                {lunchBreakEnabled ? <ToggleRight size={18} className={text} /> : <ToggleLeft size={18} />}
              </button>
              {lunchBreakEnabled && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    aria-label="Öğle arası başlangıç saati"
                    disabled={!canWrite}
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                    className={`px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 ${ring}`}
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="time"
                    aria-label="Öğle arası bitiş saati"
                    disabled={!canWrite}
                    value={lunchEnd}
                    onChange={(e) => setLunchEnd(e.target.value)}
                    className={`px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 ${ring}`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 7 Günlük Mesai Tablosu */}
          <div className="space-y-2.5">
            {WEEK_DAYS.map((day) => {
              const dCfg = weeklySchedule[day.key] || {
                enabled: !day.isWeekend,
                start: "09:00",
                end: "18:00"
              };
              const isDayOpen = Boolean(dCfg.enabled);

              return (
                <div
                  key={day.key}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                    isDayOpen
                      ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
                      : "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <button
                      type="button"
                      disabled={!canWrite}
                      aria-pressed={isDayOpen}
                      aria-label={`${day.label} mesai durumu`}
                      onClick={() => updateDaySchedule(day.key, "enabled", !isDayOpen)}
                      className={`w-10 h-10 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 border transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                        isDayOpen
                          ? `${lightBg} ${text} ${borderLight}`
                          : "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {day.short}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                          {day.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDayOpen
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {isDayOpen ? "Mesai Açık" : "Haftalık Tatil"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isDayOpen
                          ? `Net çalışma süresi: ${formatDurationLabel(
                              dCfg.start,
                              dCfg.end,
                              lunchBreakEnabled,
                              lunchStart,
                              lunchEnd
                            )}`
                          : "Bu gün gelen çağrılar mesai dışı akışına yönlendirilir"}
                      </p>
                    </div>
                  </div>

                  {isDayOpen ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`start-${day.key}`}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                        >
                          Başlangıç
                        </label>
                        <input
                          id={`start-${day.key}`}
                          type="time"
                          disabled={!canWrite}
                          value={dCfg.start || "09:00"}
                          onChange={(e) => updateDaySchedule(day.key, "start", e.target.value)}
                          className={`px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} disabled:opacity-50`}
                        />
                      </div>
                      <span className="text-slate-400 font-bold">—</span>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`end-${day.key}`}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                        >
                          Bitiş
                        </label>
                        <input
                          id={`end-${day.key}`}
                          type="time"
                          disabled={!canWrite}
                          value={dCfg.end || "18:00"}
                          onChange={(e) => updateDaySchedule(day.key, "end", e.target.value)}
                          className={`px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} disabled:opacity-50`}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => updateDaySchedule(day.key, "enabled", false)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
                      >
                        Kapat
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => updateDaySchedule(day.key, "enabled", true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${lightBg} ${text} ${borderLight} transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} disabled:opacity-50`}
                      >
                        Mesaiye Aç
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEKME 2: RESMİ TATİLLER & ÖZEL GÜNLER */}
      {activeSectionTab === "holidays" && (
        <div
          role="tabpanel"
          id="wh-panel-holidays"
          aria-labelledby="wh-tab-holidays"
          className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 animate-in fade-in duration-200"
        >
          {/* Üst Araç Çubuğu + Birleşik Kırmızı (+) Ekleme Butonu */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  Resmi Tatiller & Özel Gün Takvimi
                </h3>
                <InfoTooltip
                  title="Resmi Tatil Yönlendirme Mantığı"
                  text="Tam gün kapalı tatillerde gelen çağrılar Arama Akış Yönetimi'ndeki 'Resmi Tatil' (veya Mesai Dışı) çıkışına yönlendirilir. Arife gibi yarım gün tatillerde ise belirlediğiniz özel saat aralığında mesai açık kalır."
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Her yıl tekrarlanan ulusal bayramları, dini bayram tarih aralıklarını ve yarım gün arife mesailerini yönetin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canWrite && (
                <button
                  type="button"
                  onClick={handleLoadTurkeyPresets}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${lightBg} ${text} ${borderLight} transition-all focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                >
                  <Sparkles size={13} />
                  <span>Türkiye Resmi & Dini Tatil Şablonunu Yükle (2026–2027)</span>
                </button>
              )}

              {canWrite && (
                <button
                  type="button"
                  onClick={openAddHolidayModal}
                  title="Yeni Resmi Tatil / Özel Gün Ekle"
                  aria-label="Yeni Resmi Tatil / Özel Gün Ekle"
                  className={`bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filtre Hapları & Arama Kutusu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Resmi tatil filtresi">
              {[
                { id: "all", label: "Tümü" },
                { id: "recurring", label: "Her Yıl Tekrarlanan" },
                { id: "dated", label: "Dini / Tarih Aralıklı" },
                { id: "custom_hours", label: "Yarım Gün / Özel Saat" }
              ].map((f) => {
                const isActive = holidayFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setHolidayFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                      isActive
                        ? `${bg} text-white border-transparent shadow-sm`
                        : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Tatil adı veya tarih ile ara"
                placeholder="Tatil adı veya tarih ara..."
                value={holidaySearch}
                onChange={(e) => setHolidaySearch(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
              />
            </div>
          </div>

          {/* Tatil Listesi */}
          {filteredHolidays.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Calendar size={26} className="mx-auto text-slate-400" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Kriterlere uygun resmi tatil veya özel gün bulunamadı.
              </p>
              <p className="text-[11px] text-slate-400">
                Sağ üstteki <strong>+</strong> butonunu veya hazır Türkiye şablonu butonunu kullanarak tatil günlerini ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredHolidays.map((h) => {
                const isHolActive = h.active !== false;
                const dateLabel = h.recurring
                  ? `${formatPlainMonthDayTr(h.month_day)} (Her Yıl)`
                  : h.end_date && h.end_date !== h.start_date
                  ? `${formatPlainDateTr(h.start_date)} – ${formatPlainDateTr(h.end_date)}`
                  : formatPlainDateTr(h.start_date);

                return (
                  <div
                    key={h.id}
                    className={`p-4 rounded-2xl border flex items-start justify-between gap-3 transition-all ${
                      isHolActive
                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
                        : "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          h.mode === "custom_hours"
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                            : `${lightBg} ${text} ${borderLight}`
                        }`}
                      >
                        <Calendar size={18} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                            {h.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.mode === "custom_hours"
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {h.mode === "custom_hours"
                              ? `Yarım Gün / Özel (${h.custom_start || "09:00"} – ${h.custom_end || "13:00"})`
                              : "Tam Gün Kapalı"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {dateLabel}
                          </span>
                          <span>•</span>
                          <span>{h.recurring ? "Sabit Ulusal / Yıllık" : "Tarih Aralıklı"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!canWrite}
                        aria-pressed={isHolActive}
                        aria-label={`${h.name} tatil kuralını ${isHolActive ? "devre dışı bırak" : "etkinleştir"}`}
                        title={isHolActive ? "Aktif (Kapatmak için tıklayın)" : "Pasif (Açmak için tıklayın)"}
                        onClick={() => handleToggleHolidayActive(h.id)}
                        className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                          isHolActive ? text : "text-slate-400"
                        } hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50`}
                      >
                        {isHolActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>

                      {canWrite && (
                        <button
                          type="button"
                          aria-label={`${h.name} tatilini düzenle`}
                          title="Düzenle"
                          onClick={() => openEditHolidayModal(h)}
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`${h.name} tatilini sil`}
                          title="Sil"
                          onClick={() => setDeleteTargetHoliday(h)}
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resmi Tatil / Özel Gün Ekleme & Düzenleme Modalı */}
      {showHolidayModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="holiday-modal-title"
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className={text} />
                  <h3 id="holiday-modal-title" className="text-sm font-extrabold text-slate-800 dark:text-white">
                    {editingHoliday ? "Resmi Tatil / Özel Günü Düzenle" : "Yeni Resmi Tatil / Özel Gün Ekle"}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Pencereyi kapat"
                  onClick={() => setShowHolidayModal(false)}
                  className={`p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveHolidayModal} className="p-5 space-y-4">
                <div>
                  <label
                    htmlFor="hol-name-input"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Tatil / Özel Gün Adı
                  </label>
                  <input
                    id="hol-name-input"
                    type="text"
                    required
                    placeholder="Örn: 29 Ekim Cumhuriyet Bayramı veya Kurban Bayramı"
                    value={holName}
                    onChange={(e) => setHolName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>

                {/* Tarih Tipi Seçimi */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tekrarlama Türü
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={holRecurring}
                      onClick={() => setHolRecurring(true)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                        holRecurring
                          ? `${lightBg} ${text} ${border}`
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-extrabold">Her Yıl Sabit Tarih</div>
                      <div className="text-[10px] opacity-80 font-normal mt-0.5">
                        Ulusal bayramlar (Örn: 29 Ekim)
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-pressed={!holRecurring}
                      onClick={() => setHolRecurring(false)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                        !holRecurring
                          ? `${lightBg} ${text} ${border}`
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-extrabold">Belirli Tarih / Aralık</div>
                      <div className="text-[10px] opacity-80 font-normal mt-0.5">
                        Dini bayramlar & özel tatiller
                      </div>
                    </button>
                  </div>
                </div>

                {holRecurring ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="hol-month-select"
                        className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                      >
                        Ay
                      </label>
                      <select
                        id="hol-month-select"
                        value={holMonth}
                        onChange={(e) => {
                          const nextMonth = e.target.value;
                          setHolMonth(nextMonth);
                          const mMeta = MONTHS_TR.find((m) => m.num === nextMonth);
                          if (mMeta && parseInt(holDay, 10) > mMeta.maxDays) {
                            setHolDay(String(mMeta.maxDays).padStart(2, "0"));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      >
                        {MONTHS_TR.map((m) => (
                          <option key={m.num} value={m.num}>
                            {m.num} - {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="hol-day-select"
                        className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                      >
                        Gün
                      </label>
                      <select
                        id="hol-day-select"
                        value={holDay}
                        onChange={(e) => setHolDay(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      >
                        {dayOptions.map((d) => (
                          <option key={d} value={d}>
                            {parseInt(d, 10)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="hol-start-date"
                        className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                      >
                        Başlangıç Tarihi
                      </label>
                      <input
                        id="hol-start-date"
                        type="date"
                        value={holStartDate}
                        onChange={(e) => {
                          setHolStartDate(e.target.value);
                          if (!holEndDate || compareIsoPlainDates(holEndDate, e.target.value) < 0) {
                            setHolEndDate(e.target.value);
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hol-end-date"
                        className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                      >
                        Bitiş Tarihi
                      </label>
                      <input
                        id="hol-end-date"
                        type="date"
                        value={holEndDate}
                        onChange={(e) => setHolEndDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      />
                    </div>
                  </div>
                )}

                {/* Çalışma Durumu: Tam Gün Kapalı vs Yarım Gün / Özel Mesai */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Bu Gündeki Mesai Durumu
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={holMode === "closed"}
                      onClick={() => setHolMode("closed")}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                        holMode === "closed"
                          ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-extrabold">Tam Gün Kapalı</div>
                      <div className="text-[10px] opacity-80 font-normal mt-0.5">
                        Tüm gün resmi tatil anonsu/akışı çalışır
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-pressed={holMode === "custom_hours"}
                      onClick={() => setHolMode("custom_hours")}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                        holMode === "custom_hours"
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-extrabold">Yarım Gün / Özel Saat</div>
                      <div className="text-[10px] opacity-80 font-normal mt-0.5">
                        Arife günleri için kısaltılmış mesai
                      </div>
                    </button>
                  </div>
                </div>

                {holMode === "custom_hours" && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50">
                    <div>
                      <label
                        htmlFor="hol-custom-start"
                        className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1"
                      >
                        Açılış Saati
                      </label>
                      <input
                        id="hol-custom-start"
                        type="time"
                        value={holCustomStart}
                        onChange={(e) => setHolCustomStart(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hol-custom-end"
                        className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1"
                      >
                        Kapanış Saati
                      </label>
                      <input
                        id="hol-custom-end"
                        type="time"
                        value={holCustomEnd}
                        onChange={(e) => setHolCustomEnd(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      />
                    </div>
                  </div>
                )}

                {holFormError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300">
                    {holFormError}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHolidayModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 ${ring} ${bg} ${hover}`}
                  >
                    {editingHoliday ? "Güncelle" : "Ekle ve Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Özel Silme Onay Modalı (Custom Delete Confirmation Modal Rule) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetHoliday)}
        onClose={() => setDeleteTargetHoliday(null)}
        onConfirm={handleConfirmDeleteHoliday}
        title="Resmi Tatil Kaydını Sil"
        message={
          deleteTargetHoliday
            ? `'${deleteTargetHoliday.name}' tatil kaydını listeden kalıcı olarak silmek istediğinize emin misiniz?`
            : ""
        }
      />
    </div>
  );
}
