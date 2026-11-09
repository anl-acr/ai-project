import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  X,
  Phone,
  PhoneCall,
  MessageSquare,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Headphones,
  Mic,
  User,
  CheckCircle2,
  AlarmClock,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";
import { webphoneManager } from "../../utils/webphoneManager";
import { isDesktopApp, isNativeElectron, sendDesktopNotification } from "../../utils/desktopBridge";

export default function NotificationCenterBell({
  backendHost = "localhost:8000",
  currentUser,
  currentRolePermissions = null,
  onNavigateTab,
  align = "right",
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dueCallbacks, setDueCallbacks] = useState([]);
  const [dismissedPopupIds, setDismissedPopupIds] = useState(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [spyLoadingId, setSpyLoadingId] = useState("");

  const containerRef = useRef(null);
  const notifiedDesktopIdsRef = useRef(new Set());
  const dismissedNotifIdsRef = useRef(new Set());
  const seenWhileOpenRef = useRef(new Set());
  const isOpenRef = useRef(false);

  const API_BASE = getApiBaseUrl(backendHost);

  const getDismissedStorageKey = useCallback(() => {
    const uid =
      currentUser?.id ||
      (typeof window !== "undefined" &&
        (sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id"))) ||
      "admin";
    const tenantId =
      (typeof window !== "undefined" && localStorage.getItem("selected_tenant_id")) || "tenant-default";
    return `aida_dismissed_notifs_${tenantId}_${uid}`;
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(getDismissedStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      dismissedNotifIdsRef.current = new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      dismissedNotifIdsRef.current = new Set();
    }
  }, [getDismissedStorageKey]);

  const isAdmin =
    String(currentUser?.role || "").toLowerCase() === "admin" ||
    String(currentUser?.id || "").toLowerCase() === "admin";

  const hasPerm = useCallback(
    (code) => {
      if (isAdmin || !Array.isArray(currentRolePermissions)) return true;
      return currentRolePermissions.includes(code) || currentRolePermissions.includes("*");
    },
    [isAdmin, currentRolePermissions]
  );

  const canMonitorListen = hasPerm("call_monitor:listen") || hasPerm("ai_whisper:read");
  const canMonitorWhisper = hasPerm("call_monitor:whisper") || hasPerm("ai_whisper:write");
  const canMonitorBarge = hasPerm("call_monitor:barge");
  const hasCrisisAccess =
    isAdmin ||
    hasPerm("crisis_alerts:access") ||
    hasPerm("supervisor:access") ||
    canMonitorListen ||
    canMonitorWhisper ||
    canMonitorBarge;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      localStorage.removeItem("aida_desktop_notif_enabled");
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

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

  const triggerBrowserNotification = useCallback((item) => {
    if (typeof window === "undefined") return;
    if (isNativeElectron()) {
      sendDesktopNotification({
        title: item.title || "AIDA Bildirimi",
        body: item.body || "",
        tag: item.id,
        urgent: item.severity === "critical",
        popWindow: false,
        focusOnClick: true
      });
      return;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const n = new Notification(item.title || "AIDA Bildirimi", {
        body: item.body || "",
        tag: item.id,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden" && !isDesktopApp()) return;
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/workspace/notifications`, {
        headers: buildHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const rawList = Array.isArray(data.notifications) ? data.notifications : [];
      const list = rawList.filter((item) => item?.id && !dismissedNotifIdsRef.current.has(item.id));
      const computedUnread = list.reduce((acc, n) => acc + (n.unread ? 1 : 0), 0);
      setNotifications(list);
      setUnreadCount(computedUnread);
      setDueCallbacks(Array.isArray(data.due_callbacks) ? data.due_callbacks : []);

      // Fire native desktop push for newly seen critical/warning unread items (and omnichannel/missed in desktop app)
      for (const item of list) {
        const shouldPush =
          item.severity === "critical" ||
          item.severity === "warning" ||
          (isDesktopApp() && (item.category === "omnichannel" || item.category === "callback" || item.category === "call"));
        if (
          item.unread &&
          shouldPush &&
          !notifiedDesktopIdsRef.current.has(item.id)
        ) {
          notifiedDesktopIdsRef.current.add(item.id);
          triggerBrowserNotification(item);
        }
      }
    } catch (e) {}
  }, [API_BASE, buildHeaders, currentUser, triggerBrowserNotification]);

  const markIdsRead = useCallback(
    async (ids) => {
      const validIds = Array.from(new Set((ids || []).filter(Boolean)));
      if (validIds.length === 0) return;

      validIds.forEach((id) => {
        dismissedNotifIdsRef.current.add(id);
        seenWhileOpenRef.current.delete(id);
      });

      if (typeof window !== "undefined") {
        try {
          const arr = Array.from(dismissedNotifIdsRef.current).slice(-300);
          dismissedNotifIdsRef.current = new Set(arr);
          localStorage.setItem(getDismissedStorageKey(), JSON.stringify(arr));
        } catch (e) {}
      }

      setNotifications((prev) => {
        const next = prev.filter((n) => !validIds.includes(n.id));
        setUnreadCount(next.reduce((acc, n) => acc + (n.unread ? 1 : 0), 0));
        return next;
      });

      try {
        await fetch(`${API_BASE}/api/workspace/notifications/read`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ ids: validIds }),
        });
      } catch (e) {}
    },
    [API_BASE, buildHeaders, getDismissedStorageKey]
  );

  const closeDrawerAndDismissSeen = useCallback(
    (extraIds = []) => {
      const toDismiss = new Set([
        ...Array.from(seenWhileOpenRef.current),
        ...(Array.isArray(extraIds) ? extraIds : []),
      ]);
      seenWhileOpenRef.current.clear();
      isOpenRef.current = false;
      setIsOpen(false);
      if (toDismiss.size > 0) {
        markIdsRead(Array.from(toDismiss));
      }
    },
    [markIdsRead]
  );

  const toggleDrawer = useCallback(() => {
    if (isOpenRef.current) {
      closeDrawerAndDismissSeen();
    } else {
      isOpenRef.current = true;
      setIsOpen(true);
    }
  }, [closeDrawerAndDismissSeen]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 15000);
    const onVisChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };
    const onToggleShortcut = () => {
      toggleDrawer();
    };
    const onRefresh = () => fetchNotifications();

    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("TOGGLE_NOTIFICATION_DRAWER", onToggleShortcut);
    window.addEventListener("REFRESH_NOTIFICATIONS", onRefresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("TOGGLE_NOTIFICATION_DRAWER", onToggleShortcut);
      window.removeEventListener("REFRESH_NOTIFICATIONS", onRefresh);
    };
  }, [fetchNotifications, toggleDrawer]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpenRef.current && containerRef.current && !containerRef.current.contains(e.target)) {
        closeDrawerAndDismissSeen();
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpenRef.current) {
        closeDrawerAndDismissSeen();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [closeDrawerAndDismissSeen]);

  const handleMarkAllRead = async () => {
    const allIds = notifications.map((n) => n.id).filter(Boolean);
    if (allIds.length === 0) return;
    await markIdsRead(allIds);
  };

  const handleItemClick = (item) => {
    closeDrawerAndDismissSeen(item?.id ? [item.id] : []);
    if (item.target_tab && typeof onNavigateTab === "function") {
      onNavigateTab(item.target_tab, item.target_subtab || null, item);
    }
  };

  const handleCompleteCallback = async (cbId) => {
    setDismissedPopupIds((prev) => new Set([...prev, `cb-${cbId}`]));
    try {
      await fetch(`${API_BASE}/api/workspace/callbacks/${encodeURIComponent(cbId)}`, {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify({ status: "completed" }),
      });
      fetchNotifications();
    } catch (e) {}
  };

  const handleSnoozeCallback = async (cbId, minutes = 10) => {
    setDismissedPopupIds((prev) => new Set([...prev, `cb-${cbId}`]));
    try {
      await fetch(`${API_BASE}/api/workspace/callbacks/${encodeURIComponent(cbId)}`, {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify({ snooze_minutes: minutes }),
      });
      fetchNotifications();
    } catch (e) {}
  };

  const handleCallCallbackNow = async (cb) => {
    if (!cb?.customer_phone) return;
    webphoneManager.setDialNumber(cb.customer_phone);
    webphoneManager.makeCall(cb.customer_phone);
    if (typeof onNavigateTab === "function") {
      onNavigateTab("call-center", "webphone");
    }
    await handleCompleteCallback(cb.id);
  };

  const handleQuickCrisisSpy = async (crisisNotif, mode = "listen") => {
    if (!crisisNotif?.call_id) return;
    setSpyLoadingId(`${crisisNotif.call_id}-${mode}`);
    try {
      await fetch(`${API_BASE}/api/calls/${encodeURIComponent(crisisNotif.call_id)}/spy`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          mode,
          agent_ext: currentUser?.extension || undefined,
          caller_number: crisisNotif.phone || undefined,
          user_id: currentUser?.id || "admin",
        }),
      });
      if (typeof onNavigateTab === "function") {
        onNavigateTab("dashboard", null, crisisNotif);
      }
    } catch (e) {
    } finally {
      setSpyLoadingId("");
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "call") return n.category === "call" || n.category === "callback" || n.category === "crisis";
    if (categoryFilter === "message") return n.category === "message" || n.category === "appointment";
    if (categoryFilter === "system") return n.category === "system";
    return true;
  });

  useEffect(() => {
    if (!isOpen) return;
    filteredNotifications.forEach((item) => {
      if (item?.id) {
        seenWhileOpenRef.current.add(item.id);
      }
    });
  }, [isOpen, filteredNotifications]);

  // Live floating crisis alerts (only unread & not dismissed in this session)
  const activeCrisisPopups = hasCrisisAccess
    ? notifications.filter(
        (n) => n.category === "crisis" && n.unread && !dismissedPopupIds.has(n.id)
      ).slice(0, 2)
    : [];

  const activeDuePopups = dueCallbacks
    .filter((cb) => !dismissedPopupIds.has(`cb-${cb.id}`))
    .slice(0, 2);

  const renderCategoryIcon = (item) => {
    if (item.category === "crisis") return <AlertTriangle size={14} className="text-rose-500 shrink-0" />;
    if (item.category === "callback") return <AlarmClock size={14} className="text-amber-500 shrink-0" />;
    if (item.category === "call") return <Phone size={14} className="text-rose-500 shrink-0" />;
    if (item.category === "message") return <MessageSquare size={14} className="text-emerald-500 shrink-0" />;
    if (item.category === "appointment") return <Calendar size={14} className="text-indigo-500 shrink-0" />;
    return <ShieldAlert size={14} className="text-amber-500 shrink-0" />;
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={toggleDrawer}
          aria-label="Canlı Bildirim Merkezi"
          aria-expanded={isOpen}
          title="Canlı Bildirim Merkezi (Alt+N)"
          className={`relative p-2 rounded-xl border transition-colors shadow-sm cursor-pointer ${
            isOpen
              ? `${bg} text-white border-transparent`
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          {unreadCount > 0 && !isOpen ? (
            <BellRing size={14} className={isOpen ? "text-white" : text} />
          ) : (
            <Bell size={14} />
          )}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className={`absolute ${align === "left" ? "left-0" : "right-0"} mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl z-[140] overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Bell size={14} className={text} />
                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  Bildirim Merkezi
                </span>
                {unreadCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${lightBg} ${text}`}>
                    {unreadCount} Yeni
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    title="Tüm Bildirimleri Temizle"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filters */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 overflow-x-auto">
              {[
                { id: "all", label: "Tümü" },
                { id: "call", label: "Çağrı & Görev" },
                { id: "message", label: "Mesaj & Randevu" },
                ...(isAdmin ? [{ id: "system", label: "Sistem" }] : []),
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                    categoryFilter === cat.id
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredNotifications.length === 0 ? (
                <div className="py-10 px-6 text-center space-y-1.5">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-500/80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bekleyen bildirim bulunmuyor
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Cevapsız çağrılar, geri arama hatırlatıcıları, mesajlar ve kriz alarmları burada anlık listelenir.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group px-4 py-3 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      item.unread ? "bg-primary/[0.03] dark:bg-primary/[0.06]" : ""
                    }`}
                  >
                    <div className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                      {renderCategoryIcon(item)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.unread && (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${bg}`} />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markIdsRead([item.id]);
                            }}
                            title="Bildirimi Kaldır"
                            aria-label="Bildirimi Kaldır"
                            className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock size={10} />
                          {item.timestamp
                            ? new Date(
                                String(item.timestamp).endsWith("Z")
                                  ? item.timestamp
                                  : `${item.timestamp}Z`
                              ).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>

                        {item.phone && hasPerm("customer_360:read") && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeDrawerAndDismissSeen([item.id]);
                              window.dispatchEvent(
                                new CustomEvent("OPEN_CUSTOMER_360", {
                                  detail: { phone: item.phone },
                                })
                              );
                            }}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${lightBg} ${text} ${borderLight} hover:opacity-90`}
                          >
                            360° Kart
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Non-Intrusive Stackable Action Toasts (Due Callbacks & Live Supervisor Crisis Radar) */}
      {(activeDuePopups.length > 0 || activeCrisisPopups.length > 0) && (
        <div
          role="region"
          aria-label="Acil Operasyon Bildirimleri"
          className="fixed bottom-5 right-5 z-[165] flex flex-col gap-3 w-80 sm:w-96 pointer-events-none"
        >
          {/* 1. Live Supervisor Crisis / Negative Sentiment Alerts */}
          {activeCrisisPopups.map((cr) => (
            <div
              key={cr.id}
              role="alert"
              className="pointer-events-auto bg-white dark:bg-slate-900 border-2 border-rose-500/80 rounded-2xl shadow-2xl p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse">
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Canlı Kriz / Negatif Duygu Alarmı
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {cr.title.replace("Canlı Kriz Alarmı: ", "")}
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedPopupIds((prev) => new Set([...prev, cr.id]));
                    markIdsRead([cr.id]);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  title="Kapat"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded-xl px-3 py-2 italic">
                &ldquo;{cr.body}&rdquo;
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                {canMonitorListen && (
                  <button
                    type="button"
                    disabled={Boolean(spyLoadingId)}
                    onClick={() => handleQuickCrisisSpy(cr, "listen")}
                    className="flex-1 min-w-[78px] px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Headphones size={12} />
                    <span>Dinle</span>
                  </button>
                )}
                {canMonitorWhisper && (
                  <button
                    type="button"
                    disabled={Boolean(spyLoadingId)}
                    onClick={() => handleQuickCrisisSpy(cr, "whisper")}
                    className="flex-1 min-w-[78px] px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Mic size={12} />
                    <span>Sufle</span>
                  </button>
                )}
                {canMonitorBarge && (
                  <button
                    type="button"
                    disabled={Boolean(spyLoadingId)}
                    onClick={() => handleQuickCrisisSpy(cr, "barge")}
                    className="flex-1 min-w-[85px] px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <PhoneCall size={12} />
                    <span>Devral</span>
                  </button>
                )}
                {cr.phone && hasPerm("customer_360:read") && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("OPEN_CUSTOMER_360", { detail: { phone: cr.phone } })
                      )
                    }
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Müşteri 360° Kartını Aç"
                  >
                    <User size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* 2. Due Callback Reminders */}
          {activeDuePopups.map((cb) => (
            <div
              key={cb.id}
              role="status"
              className={`pointer-events-auto bg-white dark:bg-slate-900 border-2 ${border} rounded-2xl shadow-2xl p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-200`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`p-2 rounded-xl ${lightBg} ${text}`}>
                    <AlarmClock size={16} />
                  </span>
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${text} block`}>
                      Planlı Geri Arama Zamanı
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {cb.customer_name || cb.customer_phone}
                    </h4>
                    {cb.customer_name && (
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {cb.customer_phone}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedPopupIds((prev) => new Set([...prev, `cb-${cb.id}`]))
                  }
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  title="Gizle"
                >
                  <X size={14} />
                </button>
              </div>

              {cb.note && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-xl px-3 py-2">
                  {cb.note}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCallCallbackNow(cb)}
                  className={`flex-1 px-3 py-2 rounded-xl text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer ${bg} ${hover}`}
                >
                  <Phone size={12} className="fill-current" />
                  <span>Şimdi Ara</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSnoozeCallback(cb.id, 10)}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="10 Dakika Ertele"
                >
                  +10 Dk
                </button>
                <button
                  type="button"
                  onClick={() => handleCompleteCallback(cb.id)}
                  className="px-2.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition cursor-pointer"
                  title="Tamamlandı Olarak İşaretle"
                >
                  Tamam
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
