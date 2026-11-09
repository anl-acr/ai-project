import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  AlertCircle,
  AlarmClock,
  Plus,
  Trash2,
  Hand,
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone, maskPhoneLast4 } from "../../../utils/contactUtils";
import { webphoneManager } from "../../../utils/webphoneManager";
import ConfirmDeleteModal from "../../dashboard/ConfirmDeleteModal";

function normalizePhone10(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

export default function AgentMissedCallsTab({ backendHost, currentUser, callPanelPerms = {} }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const maskPhoneNumbers = Boolean(callPanelPerms?.maskPhoneNumbers);

  const [subView, setSubView] = useState("missed"); // "missed" | "callbacks"
  const [missedCalls, setMissedCalls] = useState([]);
  const [claimsMap, setClaimsMap] = useState({});
  const [callbacksList, setCallbacksList] = useState([]);
  const [cbStatusFilter, setCbStatusFilter] = useState("pending");
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("all");
  const prevCallStatusRef = useRef("Idle");

  // Callback Create Modal State
  const [showCbModal, setShowCbModal] = useState(false);
  const [cbPhone, setCbPhone] = useState("");
  const [cbName, setCbName] = useState("");
  const [cbDateTime, setCbDateTime] = useState("");
  const [cbPriority, setCbPriority] = useState("normal");
  const [cbNote, setCbNote] = useState("");
  const [savingCb, setSavingCb] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTargetCbId, setDeleteTargetCbId] = useState(null);

  const ext = String(currentUser?.extension || "1000").trim();
  const uid = String(currentUser?.id || "").trim();
  const agentDisplayName =
    currentUser?.full_name || currentUser?.name || currentUser?.username || `Dahili ${ext}`;
  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");

  const buildHeaders = useCallback(() => {
    const tenantId =
      (typeof window !== "undefined" && localStorage.getItem("selected_tenant_id")) || "tenant-default";
    return {
      "Content-Type": "application/json",
      "X-User-ID": uid || "admin",
      "X-User-Extension": ext,
      "X-User-Role": String(currentUser?.role || "agent"),
      "X-Tenant-ID": String(tenantId),
    };
  }, [uid, ext, currentUser]);

  const fetchMetaLists = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${host}/api/contacts`),
        fetch(`${protocol}//${host}/api/agent/directory`),
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

  const fetchClaimsAndCallbacks = useCallback(async () => {
    try {
      const protocol = window.location.protocol;
      const cbsRes = await fetch(`${protocol}//${host}/api/workspace/callbacks?status=all`, { headers: buildHeaders() });
      if (cbsRes.ok) {
        const cbd = await cbsRes.json();
        setCallbacksList(Array.isArray(cbd.callbacks) ? cbd.callbacks : []);
      }
    } catch (e) {}
  }, [host, buildHeaders]);

  const fetchMissedQueueCalls = useCallback(
    async (silent = false) => {
      if (silent && typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!silent) setLoading(true);
      try {
        const protocol = window.location.protocol;
        const params = new URLSearchParams({
          extension: ext,
          user_id: uid,
          t: String(Date.now()),
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
        await fetchClaimsAndCallbacks();
      } catch (err) {
        console.error("[AgentMissedCallsTab] Fetch error:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [host, ext, uid, fetchClaimsAndCallbacks]
  );

  useEffect(() => {
    fetchMetaLists();
    fetchMissedQueueCalls(false);
    const interval = setInterval(() => {
      fetchMissedQueueCalls(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchMissedQueueCalls]);

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
  }, [fetchMissedQueueCalls]);

  const handleSetClaim = async (callerNumber, nextStatus, noteText = undefined) => {
    if (!callerNumber) return;
    try {
      const protocol = window.location.protocol;
      await fetch(`${protocol}//${host}/api/workspace/missed-claims`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          caller_number: callerNumber,
          status: nextStatus,
          agent_id: uid || "agent",
          agent_name: agentDisplayName,
          agent_ext: ext,
          note: noteText,
        }),
      });
      fetchClaimsAndCallbacks();
    } catch (e) {}
  };

  const openScheduleModal = (phoneVal = "", nameVal = "") => {
    setCbPhone(phoneVal);
    setCbName(nameVal);
    const plus30m = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    setCbDateTime(
      `${plus30m.getFullYear()}-${pad(plus30m.getMonth() + 1)}-${pad(plus30m.getDate())}T${pad(
        plus30m.getHours()
      )}:${pad(plus30m.getMinutes())}`
    );
    setCbPriority("normal");
    setCbNote("");
    setShowCbModal(true);
  };

  const handleSaveCallback = async (e) => {
    e.preventDefault();
    if (!cbPhone.trim() || !cbDateTime) return;
    setSavingCb(true);
    try {
      const protocol = window.location.protocol;
      const res = await fetch(`${protocol}//${host}/api/workspace/callbacks`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          customer_phone: cbPhone.trim(),
          customer_name: cbName.trim(),
          scheduled_at: new Date(cbDateTime).toISOString(),
          assigned_user_id: uid || "admin",
          assigned_user_name: agentDisplayName,
          assigned_extension: ext,
          priority: cbPriority,
          note: cbNote.trim(),
        }),
      });
      if (res.ok) {
        setShowCbModal(false);
        fetchClaimsAndCallbacks();
        window.dispatchEvent(new CustomEvent("REFRESH_NOTIFICATIONS"));
      }
    } catch (err) {
    } finally {
      setSavingCb(false);
    }
  };

  const handleUpdateCallbackTask = async (taskId, patch) => {
    try {
      const protocol = window.location.protocol;
      await fetch(`${protocol}//${host}/api/workspace/callbacks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify(patch),
      });
      fetchClaimsAndCallbacks();
      window.dispatchEvent(new CustomEvent("REFRESH_NOTIFICATIONS"));
    } catch (e) {}
  };

  const handleConfirmDeleteCallback = async () => {
    if (!deleteTargetCbId) return;
    try {
      const protocol = window.location.protocol;
      await fetch(
        `${protocol}//${host}/api/workspace/callbacks/${encodeURIComponent(deleteTargetCbId)}`,
        {
          method: "DELETE",
          headers: buildHeaders(),
        }
      );
      setDeleteTargetCbId(null);
      fetchClaimsAndCallbacks();
    } catch (e) {
      setDeleteTargetCbId(null);
    }
  };

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
      const norm = normalizePhone10(item.caller_number) || item.caller_number;
      const claim = claimsMap[norm] || null;
      return {
        ...item,
        displayName,
        claim,
      };
    });
  }, [missedCalls, contacts, directory, claimsMap]);

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

  const filteredCallbacks = useMemo(() => {
    const q = searchInput.trim().toLocaleLowerCase("tr-TR");
    return callbacksList.filter((cb) => {
      if (cbStatusFilter !== "all" && cb.status !== cbStatusFilter) return false;
      if (!q) return true;
      return (
        String(cb.customer_phone || "").toLowerCase().includes(q) ||
        String(cb.customer_name || "").toLocaleLowerCase("tr-TR").includes(q) ||
        String(cb.note || "").toLocaleLowerCase("tr-TR").includes(q)
      );
    });
  }, [callbacksList, cbStatusFilter, searchInput]);

  const pendingCallbacksCount = useMemo(
    () => callbacksList.filter((c) => c.status === "pending").length,
    [callbacksList]
  );

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
    });
  };

  const renderClaimBadge = (claim) => {
    if (!claim) return null;
    const st = claim.status;
    if (st === "claiming") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          <Hand size={10} />
          {claim.agent_name} Arıyor
        </span>
      );
    }
    if (st === "unreachable") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
          Meşgul / Ulaşılamadı ({claim.agent_name})
        </span>
      );
    }
    if (st === "scheduled") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
          <AlarmClock size={10} />
          Planlandı ({claim.agent_name})
        </span>
      );
    }
    if (st === "reached") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 size={10} />
          Ulaşıldı ({claim.agent_name})
        </span>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>Kayıp Çağrılar & Geri Arama Planlayıcı</span>
            </h2>

            {/* View Switcher Pills */}
            <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <button
                type="button"
                onClick={() => setSubView("missed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  subView === "missed"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <PhoneMissed size={13} />
                <span>Kayıp Çağrılar ({filteredList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSubView("callbacks")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  subView === "callbacks"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <AlarmClock size={13} />
                <span>Planlı Geri Aramalar ({pendingCallbacksCount})</span>
              </button>
            </div>
          </div>

          {/* Search, Filter, Unified Red + Button & Refresh */}
          <div className="flex items-center gap-2">
            {subView === "missed" && queueOptions.length > 1 && (
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

            {subView === "callbacks" && (
              <select
                value={cbStatusFilter}
                onChange={(e) => setCbStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none shadow-sm"
              >
                <option value="pending">Bekleyen Görevler</option>
                <option value="completed">Tamamlananlar</option>
                <option value="all">Tümü</option>
              </select>
            )}

            <div
              className={`flex items-center bg-white dark:bg-slate-900 border ${
                searchInput ? `${border} ring-2 ${ring}` : "border-slate-200/80 dark:border-slate-800"
              } rounded-xl shadow-sm px-3 h-9 w-48 sm:w-60 transition-all`}
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

            {/* Unified Red + Button Rule */}
            <button
              type="button"
              onClick={() => openScheduleModal("", "")}
              title="Yeni Geri Arama Hatırlatıcısı Ekle"
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition cursor-pointer"
            >
              <Plus size={16} />
            </button>

            <button
              type="button"
              onClick={() => fetchMissedQueueCalls(false)}
              disabled={loading}
              title="Listeyi Yenile"
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* SUB-VIEW 1: MISSED CALLS */}
        {subView === "missed" && (
          <>
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
                  Kuyruğunuza gelip hiçbir temsilci tarafından açılamayan çağrılar burada listelenir. Görüşme sağlandığında listeden otomatik düşer.
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
                        <th className="p-4 font-bold">Son Kayıp Saati</th>
                        <th className="p-4 font-bold">Deneme</th>
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
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative h-9 w-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center shrink-0">
                                  <PhoneMissed size={16} />
                                  <span
                                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"
                                    title="Geri Dönüş Bekleyen Kayıp Çağrı"
                                  />
                                </div>
                                <div className="min-w-0 space-y-0.5">
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

                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${lightBg} ${text} ${borderLight}`}
                              >
                                <Users size={12} />
                                <span>{item.queue_name || "Temsilci Kuyruğu"}</span>
                              </span>
                            </td>

                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  <Clock size={12} className="text-rose-500 shrink-0" />
                                  {formatDateTime(item.last_missed_time || item.timestamp)}
                                </span>
                                {missedCount > 1 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 w-max">
                                    <AlertCircle size={11} />
                                    {missedCount} kez cevapsız
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                                  cbCount > 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                    : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                }`}
                              >
                                <RotateCcw size={11} />
                                <span>{cbCount} Deneme</span>
                              </span>
                            </td>

                            <td className="p-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {!maskPhoneNumbers && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      window.dispatchEvent(
                                        new CustomEvent("OPEN_CUSTOMER_360", {
                                          detail: { phone: item.caller_number, name: item.displayName },
                                        })
                                      )
                                    }
                                    title="Müşteri 360° Kartını Aç"
                                    className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border ${lightBg} ${text} ${borderLight} hover:opacity-90 transition cursor-pointer`}
                                  >
                                    360°
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openScheduleModal(item.caller_number, item.displayName)}
                                  title="İleri Tarihli Geri Arama Planla"
                                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                                >
                                  <AlarmClock size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCallBack(item.caller_number)}
                                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 cursor-pointer ${bg} ${hover}`}
                                  title="Müşteriyi Geri Ara"
                                >
                                  <Phone size={13} className="fill-current" />
                                  <span>Geri Ara</span>
                                </button>
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
          </>
        )}

        {/* SUB-VIEW 2: SCHEDULED CALLBACKS */}
        {subView === "callbacks" && (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}>
            {filteredCallbacks.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className={`w-12 h-12 rounded-2xl ${lightBg} ${text} flex items-center justify-center mx-auto mb-2`}>
                  <AlarmClock size={24} />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Planlanmış geri arama görevi bulunmuyor.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Sağ üstteki kırmızı (+) butonuna veya kayıp çağrı satırındaki saat ikonuna tıklayarak ileri tarihli geri arama alarmı kurabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="p-4 font-bold">Müşteri</th>
                      <th className="p-4 font-bold">Planlanan Zaman</th>
                      <th className="p-4 font-bold">Temsilci & Öncelik</th>
                      <th className="p-4 font-bold">Not</th>
                      <th className="p-4 font-bold text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredCallbacks.map((cb) => (
                      <tr key={cb.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-800 dark:text-white">
                            {cb.customer_name || "Kayıtsız Numara"}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {maskPhoneLast4(cb.customer_phone, maskPhoneNumbers)}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <AlarmClock size={13} className={text} />
                            {formatDateTime(cb.scheduled_at)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {cb.assigned_user_name || "Temsilci"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                cb.priority === "urgent"
                                  ? "bg-rose-500/15 text-rose-600"
                                  : cb.priority === "high"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                              }`}
                            >
                              {cb.priority === "urgent" ? "Acil" : cb.priority === "high" ? "Yüksek" : "Normal"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {cb.note || "—"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!maskPhoneNumbers && (
                              <button
                                type="button"
                                onClick={() =>
                                  window.dispatchEvent(
                                    new CustomEvent("OPEN_CUSTOMER_360", {
                                      detail: { phone: cb.customer_phone, name: cb.customer_name },
                                    })
                                  )
                                }
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold border ${lightBg} ${text} ${borderLight} cursor-pointer`}
                              >
                                360°
                              </button>
                            )}
                            {cb.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCallbackTask(cb.id, { snooze_minutes: 15 })}
                                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  +15 Dk
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCallbackTask(cb.id, { status: "completed" })}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold cursor-pointer"
                                >
                                  Tamamla
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateCallbackTask(cb.id, { status: "completed" });
                                handleCallBack(cb.customer_phone);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1 cursor-pointer ${bg} ${hover}`}
                            >
                              <Phone size={12} className="fill-current" />
                              <span>Ara</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetCbId(cb.id)}
                              title="Görevi Sil"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Callback Modal */}
      {showCbModal && (
        <div
          onClick={() => setShowCbModal(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[160] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlarmClock size={15} className={text} />
                Geri Arama Hatırlatıcısı Planla
              </h3>
              <button
                type="button"
                onClick={() => setShowCbModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCallback} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Telefon Numarası *
                  </label>
                  <input
                    type="text"
                    required
                    value={cbPhone}
                    onChange={(e) => setCbPhone(e.target.value)}
                    placeholder="+90555..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Müşteri Adı
                  </label>
                  <input
                    type="text"
                    value={cbName}
                    onChange={(e) => setCbName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Aranacak Tarih & Saat *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={cbDateTime}
                    onChange={(e) => setCbDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Öncelik
                  </label>
                  <select
                    value={cbPriority}
                    onChange={(e) => setCbPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek Öncelik</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Hatırlatma Notu
                </label>
                <input
                  type="text"
                  value={cbNote}
                  onChange={(e) => setCbNote(e.target.value)}
                  placeholder="Örn: Fiyat teklifi hakkında dönüş yapılacak"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCbModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingCb}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold shadow-sm cursor-pointer ${bg} ${hover}`}
                >
                  {savingCb ? "Kaydediliyor..." : "Planla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Application-Native Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTargetCbId !== null}
        onClose={() => setDeleteTargetCbId(null)}
        onConfirm={handleConfirmDeleteCallback}
        title="Geri Arama Görevini Sil"
        message="Bu planlı geri arama hatırlatıcısını silmek istediğinize emin misiniz?"
      />
    </div>
  );
}
