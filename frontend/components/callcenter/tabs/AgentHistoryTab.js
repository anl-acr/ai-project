import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  X,
  Headphones,
  User,
  Search,
  Calendar,
  Filter,
  RefreshCw
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone, maskPhoneLast4 } from "../../../utils/contactUtils";

const DATE_FILTER_OPTIONS = [
  { id: "today", label: "Bugün" },
  { id: "week", label: "Son 1 Hafta" },
  { id: "month", label: "Son 1 Ay" },
  { id: "year", label: "Son 1 Yıl" },
];

const DIRECTION_FILTER_OPTIONS = [
  { id: "all", label: "Tüm Çağrılar", icon: Phone },
  { id: "inbound", label: "Gelen", icon: PhoneIncoming },
  { id: "outbound", label: "Giden", icon: PhoneOutgoing },
];

function formatDateYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateWindow(period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "month") {
    start.setMonth(start.getMonth() - 1);
  } else if (period === "year") {
    start.setFullYear(start.getFullYear() - 1);
  }
  return {
    startDateStr: formatDateYMD(start),
    endDateStr: formatDateYMD(now),
    startTimestamp: start.getTime(),
  };
}

export default function AgentHistoryTab({ backendHost, currentUser, callPanelPerms = {} }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const canListenRecords = callPanelPerms.canListenRecords !== false;
  const maskPhoneNumbers = Boolean(callPanelPerms.maskPhoneNumbers);
  const [calls, setCalls] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAudio, setActiveAudio] = useState(null);

  // Filter & Search UI states
  const [dateFilter, setDateFilter] = useState("today");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const searchInputRef = React.useRef(null);
  const filterPopoverRef = React.useRef(null);

  const ext = currentUser?.extension || "1000";

  // Close filter popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Load contacts & directory once
  const fetchMetaLists = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/contacts`),
        fetch(`${protocol}//${backendHost}/api/agent/directory`),
      ]);
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(Array.isArray(contactsData) ? contactsData : []);
      }
      if (dirRes.ok) {
        const dirData = await dirRes.json();
        setDirectory(Array.isArray(dirData) ? dirData : []);
      }
    } catch (err) {
      console.error("Failed to load contacts/directory for history tab", err);
    }
  };

  // Load calls filtered by selected date range & agent extension
  const fetchCalls = async (period = dateFilter) => {
    setLoading(true);
    try {
      const protocol = window.location.protocol;
      const { startDateStr, endDateStr, startTimestamp } = getDateWindow(period);
      const params = new URLSearchParams({
        start_date: startDateStr,
        end_date: endDateStr,
        extension: ext,
      });

      const callsRes = await fetch(`${protocol}//${backendHost}/api/calls?${params.toString()}`);
      let loadedCalls = [];
      if (callsRes.ok) {
        const data = await callsRes.json();
        const list = Array.isArray(data) ? data : [];
        loadedCalls = list.filter((c) => {
          const matchesExt = c.caller_number === ext || c.callee_number === ext;
          if (!matchesExt) return false;
          if (!c.start_time) return true;
          const callDate = new Date(c.start_time + (c.start_time.endsWith("Z") ? "" : "Z"));
          if (isNaN(callDate.getTime())) return true;
          return callDate.getTime() >= startTimestamp;
        });
      }
      setCalls(loadedCalls);
    } catch (err) {
      console.error("Failed to load history tab calls", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetaLists();
    const handleContactsUpdated = () => fetchMetaLists();
    window.addEventListener("CONTACTS_UPDATED", handleContactsUpdated);
    return () => window.removeEventListener("CONTACTS_UPDATED", handleContactsUpdated);
  }, [backendHost]);

  useEffect(() => {
    fetchCalls(dateFilter);
  }, [backendHost, ext, dateFilter]);

  // Enrich calls with contact lookup and direction
  const enrichedCalls = useMemo(() => {
    return calls.map((call) => {
      const isOutbound = call.caller_number === ext;
      const contactNumber = isOutbound ? call.callee_number : call.caller_number;
      const matchedContact = findContactByPhone(contactNumber, contacts, directory);
      return {
        ...call,
        isOutbound,
        contactNumber: contactNumber || "",
        matchedContact,
      };
    });
  }, [calls, contacts, directory, ext]);

  // Apply live search query
  const searchFilteredCalls = useMemo(() => {
    const query = searchInput.trim().toLocaleLowerCase("tr-TR");
    if (!query) return enrichedCalls;
    const cleanQueryDigits = query.replace(/\D/g, "");

    return enrichedCalls.filter((item) => {
      const numLower = (item.contactNumber || "").toLocaleLowerCase("tr-TR");
      const numDigits = (item.contactNumber || "").replace(/\D/g, "");
      const callerLower = (item.caller_number || "").toLocaleLowerCase("tr-TR");
      const calleeLower = (item.callee_number || "").toLocaleLowerCase("tr-TR");
      const nameLower = (item.matchedContact?.displayName || "").toLocaleLowerCase("tr-TR");

      if (nameLower.includes(query)) return true;
      if (numLower.includes(query) || callerLower.includes(query) || calleeLower.includes(query)) return true;
      if (cleanQueryDigits && numDigits.includes(cleanQueryDigits)) return true;
      return false;
    });
  }, [enrichedCalls, searchInput]);

  // Direction counts
  const counts = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    searchFilteredCalls.forEach((c) => {
      if (c.isOutbound) outbound++;
      else inbound++;
    });
    return {
      all: searchFilteredCalls.length,
      inbound,
      outbound,
    };
  }, [searchFilteredCalls]);

  // Final filtered list
  const filteredCalls = useMemo(() => {
    if (directionFilter === "inbound") {
      return searchFilteredCalls.filter((c) => !c.isOutbound);
    }
    if (directionFilter === "outbound") {
      return searchFilteredCalls.filter((c) => c.isOutbound);
    }
    return searchFilteredCalls;
  }, [searchFilteredCalls, directionFilter]);

  const formatDuration = (secs, startTime, endTime) => {
    let totalSecs = secs;
    if (!totalSecs && startTime && endTime) {
      totalSecs = Math.max(0, Math.floor((new Date(endTime) - new Date(startTime)) / 1000));
    }

    if (!totalSecs || totalSecs <= 0) return "0sn";
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
  };

  const translateStatus = (status) => {
    if (!status) return "Bilinmeyen";
    const s = status.toLowerCase();
    if (s === "completed" || s === "answered") return "Tamamlandı";
    if (s === "in_progress") return "Aktif";
    if (s === "blocked") return "Engellendi";
    if (s === "busy") return "Meşgul";
    if (s === "no_answer" || s === "no answer" || s === "noanswer" || s === "unanswered") return "Yanıtlanmadı";
    if (s === "cancelled" || s === "cancel") return "İptal Edildi";
    if (s === "failed") return "Başarısız";
    return status.toUpperCase();
  };

  const triggerCall = (number) => {
    window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: number }));
  };

  const activePeriodLabel = DATE_FILTER_OPTIONS.find((o) => o.id === dateFilter)?.label || "Bugün";
  const activeDirectionLabel = DIRECTION_FILTER_OPTIONS.find((d) => d.id === directionFilter)?.label || "Tüm Çağrılar";
  const hasCustomFilter = dateFilter !== "today" || directionFilter !== "all";

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Clean Single-Row Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Active Filter Summary Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Kişisel Çağrı Geçmişim</h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${lightBg} ${text} ${borderLight}`}>
              {filteredCalls.length} Kayıt
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <Calendar size={12} className={text} />
              {activePeriodLabel}
              {directionFilter !== "all" && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className={text}>{activeDirectionLabel}</span>
                </>
              )}
            </span>
          </div>

          {/* Right Action Icons: Expandable Search + Filter Popover + Refresh */}
          <div className="flex items-center gap-2">
            {/* Expandable Magnifying Glass Search */}
            <div
              className={`flex items-center bg-white dark:bg-slate-900 border ${
                isSearchOpen || searchInput ? `${border} ring-2 ${ring}` : "border-slate-200/80 dark:border-slate-800"
              } rounded-xl shadow-sm transition-all duration-300 ease-in-out overflow-hidden ${
                isSearchOpen || searchInput ? "w-64 sm:w-72 px-3 py-1.5" : "w-9 h-9 justify-center"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isSearchOpen) {
                    setIsSearchOpen(true);
                  } else if (!searchInput) {
                    setIsSearchOpen(false);
                  }
                }}
                title="Numara veya İsim Ara"
                className={`flex items-center justify-center shrink-0 transition-colors ${
                  isSearchOpen || searchInput
                    ? `${text} mr-2`
                    : "w-full h-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Search size={16} />
              </button>

              {(isSearchOpen || searchInput) && (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchInput("");
                        setIsSearchOpen(false);
                      }
                    }}
                    placeholder="Numara veya isim yazın..."
                    className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setIsSearchOpen(false);
                    }}
                    title="Aramayı Kapat"
                    className="ml-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Filter Icon Button & Popover */}
            <div ref={filterPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                title="Filtreler"
                className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                  isFilterOpen || hasCustomFilter
                    ? `${bg} text-white border-transparent`
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Filter size={16} />
                {hasCustomFilter && !isFilterOpen && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900" />
                )}
              </button>

              {/* Filter Popover Card */}
              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Filter size={13} className={text} />
                      Çağrı Filtreleri
                    </span>
                    {hasCustomFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilter("today");
                          setDirectionFilter("all");
                        }}
                        className={`text-[11px] font-bold ${text} hover:underline`}
                      >
                        Sıfırla
                      </button>
                    )}
                  </div>

                  {/* Period Section */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Zaman Aralığı
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DATE_FILTER_OPTIONS.map((opt) => {
                        const isSelected = dateFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDateFilter(opt.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between ${
                              isSelected
                                ? `${bg} text-white shadow-sm`
                                : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direction Section */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Çağrı Yönü
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {DIRECTION_FILTER_OPTIONS.map((dir) => {
                        const Icon = dir.icon;
                        const isSelected = directionFilter === dir.id;
                        const countVal = counts[dir.id] ?? 0;
                        return (
                          <button
                            key={dir.id}
                            type="button"
                            onClick={() => setDirectionFilter(dir.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? `${bg} text-white shadow-sm`
                                : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon size={14} />
                              <span>{dir.label}</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {countVal}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchCalls(dateFilter)}
              disabled={loading}
              title="Listeyi Yenile"
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Table / Empty / Loading States */}
        {loading ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}>
            <History size={32} className="mx-auto text-slate-400 mb-4 animate-bounce" />
            <p className="text-slate-500 font-medium">Çağrı geçmişi yükleniyor ({activePeriodLabel})...</p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center animate-in fade-in space-y-3`}>
            <History size={32} className="mx-auto text-slate-400" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">
              Seçili kriterlere uygun çağrı kaydı bulunamadı.
            </p>
            <p className="text-xs text-slate-400">
              Dönem: <span className="font-bold">{activePeriodLabel}</span>
              {directionFilter !== "all" && (
                <>
                  {" • "}Yön: <span className="font-bold">{activeDirectionLabel}</span>
                </>
              )}
              {searchInput && (
                <>
                  {" • "}Arama: <span className="font-bold">"{searchInput}"</span>
                </>
              )}
            </p>
            {(dateFilter !== "year" || directionFilter !== "all" || searchInput) && (
              <div className="pt-2 flex items-center justify-center gap-2">
                {(directionFilter !== "all" || searchInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectionFilter("all");
                      setSearchInput("");
                      setIsSearchOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Filtreleri Temizle
                  </button>
                )}
                {dateFilter === "today" && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("week")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-colors ${bg} ${hover}`}
                  >
                    Son 1 Haftayı Göster
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden animate-in fade-in`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold">Tarih</th>
                    <th className="p-4 font-bold">Yön</th>
                    <th className="p-4 font-bold">Numara / İsim</th>
                    <th className="p-4 font-bold">Durum</th>
                    <th className="p-4 font-bold">Süre</th>
                    <th className="p-4 font-bold text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredCalls.map((call, idx) => {
                    const { isOutbound, contactNumber, matchedContact } = call;

                    return (
                      <tr key={call.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                          {call.start_time
                            ? new Date(call.start_time + (call.start_time.endsWith("Z") ? "" : "Z")).toLocaleString("tr-TR")
                            : "-"}
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-md w-max ${isOutbound ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                            {isOutbound ? <PhoneOutgoing size={12} /> : <PhoneIncoming size={12} />}
                            {isOutbound ? "GİDEN" : "GELEN"}
                          </div>
                        </td>
                        <td className="p-4">
                          {matchedContact ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <User size={13} className="text-slate-400 shrink-0" />
                                {matchedContact.displayName}
                              </span>
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                {maskPhoneLast4(contactNumber, maskPhoneNumbers)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                              {maskPhoneLast4(contactNumber, maskPhoneNumbers)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase ${call.status === "completed" || call.status === "answered" || call.status === "in_progress" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {call.status === "completed" || call.status === "answered" || call.status === "in_progress" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {translateStatus(call.status)}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 w-max">
                            <Clock size={14} /> {formatDuration(call.duration, call.start_time, call.end_time)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => triggerCall(contactNumber)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                              title="Tekrar Ara"
                            >
                              <Phone size={14} />
                            </button>
                            {canListenRecords && (
                              <button
                                onClick={() => setActiveAudio(call)}
                                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${activeAudio?.id === call.id ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : !call.recording_path ? "bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-600 cursor-not-allowed" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"}`}
                                title={call.recording_path ? "Ses Kaydını Dinle" : "Ses kaydı bulunamadı"}
                                disabled={!call.recording_path}
                              >
                                {activeAudio?.id === call.id ? <Headphones size={14} className="animate-pulse" /> : <Play size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Audio Player */}
      {canListenRecords && activeAudio && activeAudio.recording_path && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 shadow-2xl rounded-2xl p-4 w-[400px] z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                <Headphones size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white tracking-wide truncate">
                  Görüşme Kaydı ({maskPhoneLast4(activeAudio.caller_number === currentUser?.extension ? activeAudio.callee_number : activeAudio.caller_number, maskPhoneNumbers)})
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {activeAudio.start_time
                    ? new Date(activeAudio.start_time + (activeAudio.start_time.endsWith("Z") ? "" : "Z")).toLocaleString("tr-TR")
                    : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveAudio(null)}
              className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-colors shrink-0"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          <audio
            src={`${window.location.protocol}//${backendHost}${activeAudio.recording_path}`}
            controls
            autoPlay
            className="w-full h-8 outline-none [&::-webkit-media-controls-panel]:bg-slate-800 [&::-webkit-media-controls-panel]:text-white"
          />
        </div>
      )}
    </div>
  );
}

