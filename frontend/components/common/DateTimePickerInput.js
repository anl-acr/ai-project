import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useTheme } from "../../utils/theme";

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function parseYmd(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-").map((v) => parseInt(v, 10));
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function normalizeTimeStr(timeStr, fallback = "00:00") {
  if (!timeStr || typeof timeStr !== "string") return fallback;
  const parts = timeStr.trim().split(":");
  if (parts.length >= 2) {
    const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    return `${pad2(h)}:${pad2(m)}`;
  }
  return fallback;
}

export default function DateTimePickerInput({
  label,
  dateValue,
  timeValue = "00:00",
  defaultTime = "00:00",
  onDateChange,
  onTimeChange,
  presets = [],
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  const normalizedTime = normalizeTimeStr(timeValue, defaultTime);
  const [selectedHour, selectedMinute] = normalizedTime.split(":").map((v) => parseInt(v, 10));

  const parsedDate = useMemo(() => parseYmd(dateValue), [dateValue]);
  const [viewYear, setViewYear] = useState(parsedDate.year);
  const [viewMonth, setViewMonth] = useState(parsedDate.month);
  const [manualTimeInput, setManualTimeInput] = useState(normalizedTime);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 396 });

  useEffect(() => {
    setManualTimeInput(normalizedTime);
  }, [normalizedTime]);

  useEffect(() => {
    if (isOpen) {
      const p = parseYmd(dateValue);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [isOpen, dateValue]);

  const updatePopoverPosition = () => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popW = Math.min(404, window.innerWidth - 16);
    const estHeight = presets && presets.length > 0 ? 415 : 370;

    let left = rect.left;
    if (left + popW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popW - 8);
    }
    let top = rect.bottom + 6;
    if (top + estHeight > window.innerHeight - 8 && rect.top > estHeight) {
      top = Math.max(8, rect.top - estHeight - 6);
    }

    setPopoverPos({ top, left, width: popW });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();

    // Auto-scroll hour & minute columns to active values
    const scrollTimer = setTimeout(() => {
      if (hourListRef.current) {
        const activeHourEl = hourListRef.current.querySelector(`[data-hour="${selectedHour}"]`);
        if (activeHourEl) {
          activeHourEl.scrollIntoView({ block: "center" });
        }
      }
      if (minuteListRef.current) {
        const activeMinEl = minuteListRef.current.querySelector(`[data-minute="${selectedMinute}"]`);
        if (activeMinEl) {
          activeMinEl.scrollIntoView({ block: "center" });
        }
      }
    }, 20);

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (e) => {
      if (popoverRef.current && e?.target && popoverRef.current.contains(e.target)) {
        return;
      }
      updatePopoverPosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      clearTimeout(scrollTimer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Build 42-day Monday-first calendar matrix
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    // Trailing days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push({
        ymd: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        day: dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      cells.push({
        ymd: `${viewYear}-${pad2(viewMonth + 1)}-${pad2(dayNum)}`,
        day: dayNum,
        isCurrentMonth: true,
      });
    }

    // Leading days from next month to fill 42 cells
    let nextDay = 1;
    while (cells.length < 42) {
      const d = new Date(viewYear, viewMonth + 1, nextDay++);
      cells.push({
        ymd: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        day: d.getDate(),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const todayYmd = getTodayYmd();
  const activeYmd = (dateValue || todayYmd).slice(0, 10);

  const formattedDisplayDate = useMemo(() => {
    const { year, month, day } = parseYmd(activeYmd);
    return `${pad2(day)}.${pad2(month + 1)}.${year}`;
  }, [activeYmd]);

  const formattedLongPreview = useMemo(() => {
    const { year, month, day } = parseYmd(activeYmd);
    return `${pad2(day)} ${TR_MONTHS[month]} ${year} • ${normalizedTime}`;
  }, [activeYmd, normalizedTime]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (cell) => {
    if (onDateChange) onDateChange(cell.ymd);
    const p = parseYmd(cell.ymd);
    setViewYear(p.year);
    setViewMonth(p.month);
  };

  const handleSelectHour = (h) => {
    const next = `${pad2(h)}:${pad2(selectedMinute)}`;
    if (onTimeChange) onTimeChange(next);
  };

  const handleSelectMinute = (m) => {
    const next = `${pad2(selectedHour)}:${pad2(m)}`;
    if (onTimeChange) onTimeChange(next);
  };

  const handleManualTimeChange = (e) => {
    let raw = e.target.value.replace(/[^\d:]/g, "");
    if (raw.length === 4 && !raw.includes(":")) {
      raw = `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
    }
    setManualTimeInput(raw);
    if (/^\d{2}:\d{2}$/.test(raw)) {
      const [hh, mm] = raw.split(":").map((v) => parseInt(v, 10));
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        if (onTimeChange) onTimeChange(`${pad2(hh)}:${pad2(mm)}`);
      }
    }
  };

  const handleManualTimeBlur = () => {
    const cleaned = manualTimeInput.trim();
    if (!cleaned) {
      setManualTimeInput(normalizedTime);
      return;
    }
    let hh = selectedHour;
    let mm = selectedMinute;
    if (cleaned.includes(":")) {
      const [p1, p2] = cleaned.split(":");
      hh = Math.min(23, Math.max(0, parseInt(p1, 10) || 0));
      mm = Math.min(59, Math.max(0, parseInt(p2, 10) || 0));
    } else if (/^\d{1,4}$/.test(cleaned)) {
      if (cleaned.length <= 2) {
        hh = Math.min(23, Math.max(0, parseInt(cleaned, 10) || 0));
        mm = 0;
      } else {
        hh = Math.min(23, Math.max(0, parseInt(cleaned.slice(0, cleaned.length - 2), 10) || 0));
        mm = Math.min(59, Math.max(0, parseInt(cleaned.slice(-2), 10) || 0));
      }
    }
    const next = `${pad2(hh)}:${pad2(mm)}`;
    setManualTimeInput(next);
    if (onTimeChange) onTimeChange(next);
  };

  const handleSetNow = () => {
    const now = new Date();
    const ymd = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    if (onDateChange) onDateChange(ymd);
    if (onTimeChange) onTimeChange(hm);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* Unified Date + Time Trigger Field */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-white dark:bg-slate-950 border text-left rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? `${border} ring-2 ${ring} shadow-sm`
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className={`${text} shrink-0`} />
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
            {formattedDisplayDate}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold tabular-nums border shrink-0 ${lightBg} ${text} ${borderLight}`}
        >
          <Clock size={11} />
          <span>{normalizedTime}</span>
        </span>
      </button>

      {/* Portal Popover */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              zIndex: 9999,
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-3.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {/* Optional Quick Range Presets */}
            {presets && presets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      preset.onSelect();
                      setIsOpen(false);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      preset.isActive
                        ? `${bg} text-white ${border} shadow-sm`
                        : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Main 2-Column Body: Calendar (Left) + Time Selector (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Calendar Column */}
              <div className="sm:col-span-7 flex flex-col gap-2">
                {/* Month / Year Navigation */}
                <div className="flex items-center justify-between px-0.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Önceki Ay"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      {TR_MONTHS[viewMonth]} {viewYear}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Sonraki Ay"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {TR_WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-0.5"
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarCells.map((cell) => {
                    const isSelected = cell.ymd === activeYmd;
                    const isToday = cell.ymd === todayYmd;
                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => handleSelectDay(cell)}
                        className={`h-7 rounded-lg text-[11px] tabular-nums transition flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? `${bg} text-white font-extrabold shadow-sm`
                            : isToday
                            ? `border ${border} ${text} font-extrabold bg-slate-50/70 dark:bg-slate-800/60`
                            : cell.isCurrentMonth
                            ? "text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                            : "text-slate-300 dark:text-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Column (Saat & Dakika) */}
              <div className="sm:col-span-5 flex flex-col gap-2 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-3">
                {/* Direct Keyboard Time Input + "Şimdi" */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="relative flex-1">
                    <Clock
                      size={12}
                      className={`absolute left-2 top-1/2 -translate-y-1/2 ${text}`}
                    />
                    <input
                      type="text"
                      value={manualTimeInput}
                      maxLength={5}
                      onChange={handleManualTimeChange}
                      onBlur={handleManualTimeBlur}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleManualTimeBlur();
                          setIsOpen(false);
                        }
                      }}
                      placeholder="SS:DD"
                      className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-2 py-1 text-xs font-extrabold text-center tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none ${border}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSetNow}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${lightBg} ${text} ${borderLight} hover:opacity-85`}
                    title="Şu Anki Tarih ve Saati Seç"
                  >
                    Şimdi
                  </button>
                </div>

                {/* Quick Time Chips */}
                <div className="grid grid-cols-4 gap-1">
                  {["00:00", "09:00", "18:00", "23:59"].map((qt) => {
                    const activeQt = normalizedTime === qt;
                    return (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => onTimeChange && onTimeChange(qt)}
                        className={`py-0.5 rounded-md text-[10px] font-bold tabular-nums border transition cursor-pointer ${
                          activeQt
                            ? `${bg} text-white ${border}`
                            : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {qt}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable Hour & Minute Columns */}
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center mb-1">
                      Saat
                    </span>
                    <div
                      ref={hourListRef}
                      className="h-32 overflow-y-auto scrollbar-thin rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-1 flex flex-col gap-0.5"
                    >
                      {Array.from({ length: 24 }).map((_, h) => {
                        const isSel = h === selectedHour;
                        return (
                          <button
                            key={h}
                            type="button"
                            data-hour={h}
                            onClick={() => handleSelectHour(h)}
                            className={`py-1 rounded-md text-[11px] tabular-nums transition cursor-pointer ${
                              isSel
                                ? `${bg} text-white font-extrabold shadow-sm`
                                : "text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-800"
                            }`}
                          >
                            {pad2(h)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center mb-1">
                      Dakika
                    </span>
                    <div
                      ref={minuteListRef}
                      className="h-32 overflow-y-auto scrollbar-thin rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-1 flex flex-col gap-0.5"
                    >
                      {Array.from({ length: 60 }).map((_, m) => {
                        const isSel = m === selectedMinute;
                        return (
                          <button
                            key={m}
                            type="button"
                            data-minute={m}
                            onClick={() => handleSelectMinute(m)}
                            className={`py-1 rounded-md text-[11px] tabular-nums transition cursor-pointer ${
                              isSel
                                ? `${bg} text-white font-extrabold shadow-sm`
                                : "text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-800"
                            }`}
                          >
                            {pad2(m)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Popover Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {formattedLongPreview}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-white text-[11px] font-bold shadow-sm transition cursor-pointer ${bg} ${hover}`}
              >
                <Check size={12} />
                <span>Tamam</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
