import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  PhoneMissed,
  Phone,
  RefreshCw,
  Search,
  X,
  Clock,
  Users,
  User,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone, maskPhoneLast4 } from "../../../utils/contactUtils";
import { webphoneManager } from "../../../utils/webphoneManager";

export default function AgentMissedCallsTab({ backendHost, currentUser, callPanelPerms = {} }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const maskPhoneNumbers = Boolean(callPanelPerms?.maskPhoneNumbers);

  const [missedCalls, setMissedCalls] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("all");
  const prevCallStatusRef = useRef("Idle");

  const ext = String(currentUser?.extension || "1000").trim();
  const uid = String(currentUser?.id || "").trim();
  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");

  const fetchMetaLists = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${host}/api/contacts`),
        fetch(`${protocol}//${host}/api/agent/directory`)
      ]);
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(Array.isArray(cData) ? cData : []);
      }
      if (dirRes.ok) {
        const dData = await dirRes.json();
        setDirectory(Array.isArray(dData) ? dData : []);
      }
    } catch (e) {}
  };

  const fetchMissedQueueCalls = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const protocol = window.location.protocol;
      const params = new URLSearchParams({
        extension: ext,
        user_id: uid,
        t: String(Date.now())
      });
      const res = await fetch(`${protocol}//${host}/api/agent/missed_queue_calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setMissedCalls(list);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("MISSED_QUEUE_CALLS_UPDATED", { detail: list.length }));
        }
      }
    } catch (err) {
      console.error("[AgentMissedCallsTab] Fetch error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetaLists();
    fetchMissedQueueCalls(false);
    const interval = setInterval(() => {
      fetchMissedQueueCalls(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [host, ext, uid]);

  // Refresh immediately whenever an active WebPhone call ends (so callback counter or removal updates right away)
  useEffect(() => {
    const unsub = webphoneManager.subscribe((state) => {
      const currStatus = state.callStatus || "Idle";
      if (prevCallStatusRef.current !== "Idle" && currStatus === "Idle") {
        setTimeout(() => fetchMissedQueueCalls(true), 600);
        setTimeout(() => fetchMissedQueueCalls(true), 2000);
      }
      prevCallStatusRef.current = currStatus;
    });
    return () => unsub();
  }, [host, ext, uid]);

  const queueOptions = useMemo(() => {
    const map = new Map();
    missedCalls.forEach((item) => {
      const qKey = String(item.queue_ext || item.queue_id || "2000");
      const qName = String(item.queue_name || `Kuyruk (${qKey})`);
      if (!map.has(qKey)) {
        map.set(qKey, { id: qKey, name: qName, ext: item.queue_ext || qKey });
      }
    });
    return Array.from(map.values());
  }, [missedCalls]);

  const enrichedList = useMemo(() => {
    return missedCalls.map((item) => {
      const matched = findContactByPhone(item.caller_number, contacts, directory);
      const displayName = matched?.displayName || item.caller_name || "";
      return {
        ...item,
        displayName
      };
    });
  }, [missedCalls, contacts, directory]);

  const filteredList = useMemo(() => {
    const q = searchInput.trim().toLocaleLowerCase("tr-TR");
    const qDigits = q.replace(/\D/g, "");
    return enrichedList.filter((item) => {
      if (selectedQueue !== "all") {
        const qKey = String(item.queue_ext || item.queue_id || "");
        if (qKey !== selectedQueue) return false;
      }
      if (!q) return true;
      const numLower = String(item.caller_number || "").toLocaleLowerCase("tr-TR");
      const numDigits = String(item.caller_number || "").replace(/\D/g, "");
      const nameLower = String(item.displayName || "").toLocaleLowerCase("tr-TR");
      const queueLower = String(item.queue_name || "").toLocaleLowerCase("tr-TR");
      if (nameLower.includes(q) || numLower.includes(q) || queueLower.includes(q)) return true;
      if (qDigits && numDigits.includes(qDigits)) return true;
      return false;
    });
  }, [enrichedList, searchInput, selectedQueue]);

  const handleCallBack = (number) => {
    if (!number) return;
    window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: number }));
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return "-";
    const clean = /[Zz]|[+-]\d{2}:?\d{2}$/.test(String(isoStr)) ? String(isoStr) : `${isoStr}Z`;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>Kuyruk - Kayıp Çağrılar</span>
            </h2>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                filteredList.length > 0
                  ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                  : `${lightBg} ${text} ${borderLight}`
              }`}
            >
              {filteredList.length} Bekleyen Numara
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <Clock size={12} className={text} />
              Son 7 Gün • Görüşme sağlandığında otomatik düşer
            </span>
          </div>

          {/* Search, Queue Filter & Refresh */}
          <div className="flex items-center gap-2">
            {queueOptions.length > 1 && (
              <select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none shadow-sm"
              >
                <option value="all">Tüm Kuyruklarım</option>
                {queueOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} ({q.ext})
                  </option>
                ))}
              </select>
            )}

            <div
              className={`flex items-center bg-white dark:bg-slate-900 border ${
                searchInput ? `${border} ring-2 ${ring}` : "border-slate-200/80 dark:border-slate-800"
              } rounded-xl shadow-sm px-3 h-9 w-52 sm:w-64 transition-all`}
            >
              <Search size={14} className="text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Numara veya kişi ara..."
                className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchMissedQueueCalls(false)}
              disabled={loading}
              title="Listeyi Yenile"
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}>
            <PhoneMissed size={32} className="mx-auto text-slate-400 mb-4 animate-bounce" />
            <p className="text-slate-500 font-medium text-sm">Kuyruk kayıp çağrıları kontrol ediliyor...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center space-y-2`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={26} />
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">
              Kuyrukta geri dönülmemiş kayıp çağrı bulunmuyor.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Kuyruğunuza gelip hiçbir temsilci tarafından açılamayan çağrılar burada listelenir. Herhangi bir temsilci müşteriyi geri arayıp görüştüğünde veya müşteri tekrar arayıp bağlandığında listeden otomatik olarak düşer.
            </p>
          </div>
        ) : (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold">Arayan Numara / Kişi</th>
                    <th className="p-4 font-bold">Kuyruk</th>
                    <th className="p-4 font-bold">Son Kayıp Çağrı Saati</th>
                    <th className="p-4 font-bold text-center">Geri Arama Sayısı</th>
                    <th className="p-4 font-bold text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredList.map((item) => {
                    const shownPhone = maskPhoneLast4(item.caller_number, maskPhoneNumbers);
                    const cbCount = Number(item.callback_count || 0);
                    const missedCount = Number(item.missed_count || 1);

                    return (
                      <tr
                        key={item.id || item.caller_number}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Caller Number / Contact Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center shrink-0">
                              <PhoneMissed size={16} />
                              <span
                                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"
                                title="Geri Dönüş Bekleyen Kayıp Çağrı"
                              />
                            </div>
                            <div className="min-w-0">
                              {item.displayName ? (
                                <>
                                  <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <User size={13} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{item.displayName}</span>
                                  </div>
                                  <div className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                                    {shownPhone}
                                  </div>
                                </>
                              ) : (
                                <div className="text-sm font-mono font-bold text-slate-800 dark:text-white">
                                  {shownPhone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Queue Info */}
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${lightBg} ${text} ${borderLight}`}
                          >
                            <Users size={12} />
                            <span>{item.queue_name || "Temsilci Kuyruğu"}</span>
                            {item.queue_ext && item.queue_ext !== item.queue_name && (
                              <span className="opacity-75 font-mono">({item.queue_ext})</span>
                            )}
                          </span>
                        </td>

                        {/* Latest Missed Call Timestamp + Missed Count */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <Clock size={13} className="text-rose-500 shrink-0" />
                              {formatDateTime(item.last_missed_time || item.timestamp)}
                            </span>
                            {missedCount > 1 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 w-max">
                                <AlertCircle size={11} />
                                {missedCount} kez cevapsız aradı (Son saat güncellendi)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Callback Attempt Counter (Geri Arama Sayısı) */}
                        <td className="p-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                                cbCount > 0
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                              }`}
                            >
                              <RotateCcw size={12} />
                              <span>{cbCount} Deneme</span>
                            </span>
                            {cbCount > 0 && item.last_callback_time && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Son: {formatDateTime(item.last_callback_time)}
                                {item.last_callback_agent ? ` (${item.last_callback_agent})` : ""}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action: Geri Ara */}
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleCallBack(item.caller_number)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 ${bg} ${hover}`}
                            title="Müşteriyi Geri Ara"
                          >
                            <Phone size={13} className="fill-current" />
                            <span>Geri Ara</span>
                          </button>
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
    </div>
  );
}
