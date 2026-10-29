import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, PhoneCall, List, PhoneMissed, Users, History, Voicemail, MessageSquare, Headphones, Smartphone } from "lucide-react";
import AgentDashboardTab from "./tabs/AgentDashboardTab";
import dynamic from "next/dynamic";
const AgentWebphoneTab = dynamic(() => import("./tabs/AgentWebphoneTab"), { ssr: false });
import AgentSpeedDialTab from "./tabs/AgentSpeedDialTab";
import AgentMissedCallsTab from "./tabs/AgentMissedCallsTab";
import AgentDirectoryTab from "./tabs/AgentDirectoryTab";
import AgentHistoryTab from "./tabs/AgentHistoryTab";
import AgentVoicemailTab from "./tabs/AgentVoicemailTab";
import AgentChatTab from "./tabs/AgentChatTab";
import AgentQueuePeersTab from "./tabs/AgentQueuePeersTab";
import AgentDeskphoneTab from "./tabs/AgentDeskphoneTab";
import AgentSessionCard from "../phone/AgentSessionCard";
import { useTheme } from "../../utils/theme";
import { webphoneManager } from "../../utils/webphoneManager";

export const ALL_TABS = [
  { id: "dashboard", perm: "call_panel:tab_dashboard", name: "Pano", desc: "Günlük çağrı ve mola özet panosu", icon: LayoutDashboard },
  { id: "webphone", perm: "call_panel:tab_webphone", name: "Webphone", desc: "WebRTC yazılım telefonu ve hat kontrolü", icon: PhoneCall },
  { id: "agents", perm: "call_panel:tab_agents", name: "Temsilciler", desc: "Kuyruktaki diğer temsilcilerin canlı durumu", icon: Headphones },
  { id: "speeddial", perm: "call_panel:tab_speeddial", name: "Hızlı Arama", desc: "Tek tıkla hızlı arama kısayolları", icon: List },
  { id: "missed", perm: "call_panel:tab_missed", name: "Kayıp Çağrı", desc: "Cevapsız kalan çağrıların listesi", icon: PhoneMissed },
  { id: "directory", perm: "call_panel:tab_directory", name: "Rehber", desc: "Dahili aboneler ve müşteri rehberi", icon: Users },
  { id: "history", perm: "call_panel:tab_history", name: "Çağrı Geçmişi", desc: "Geçmiş aramalar ve ses kayıtları", icon: History },
  { id: "voicemail", perm: "call_panel:tab_voicemail", name: "Sesli Posta", desc: "Bırakılan sesli mesaj kayıtları", icon: Voicemail },
  { id: "chat", perm: "call_panel:tab_chat", name: "Sohbet", desc: "Temsilciler arası iç yazışma alanı", icon: MessageSquare },
  { id: "deskphone", perm: "call_panel:tab_deskphone", name: "Masa Telefonum", desc: "Masa telefonu BLF, hızlı arama ve softkey tuş yönetimi", icon: Smartphone },
];

export const DEFAULT_CALL_PANEL_PREFS = {
  viewMode: "list", // "list" | "box"
  boxSize: "large", // "large" | "small"
  navPosition: "left", // "left" | "top"
  tabOrder: ALL_TABS.map((t) => t.id),
};

export function normalizeCallPanelPrefs(raw) {
  const defaultOrder = ALL_TABS.map((t) => t.id);
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CALL_PANEL_PREFS, tabOrder: [...defaultOrder] };
  }
  const viewMode = raw.viewMode === "box" ? "box" : "list";
  const boxSize = raw.boxSize === "small" ? "small" : "large";
  const navPosition = raw.navPosition === "top" ? "top" : "left";
  let tabOrder = Array.isArray(raw.tabOrder) ? raw.tabOrder.filter((id) => defaultOrder.includes(id)) : [];
  for (const id of defaultOrder) {
    if (!tabOrder.includes(id)) {
      tabOrder.push(id);
    }
  }
  return { viewMode, boxSize, navPosition, tabOrder };
}

export function loadCallPanelPrefs(currentUser) {
  if (typeof window === "undefined") return { ...DEFAULT_CALL_PANEL_PREFS };
  try {
    const uid = currentUser?.id || currentUser?.extension || localStorage.getItem("current_user_id") || "default";
    const userScoped = localStorage.getItem(`agent_call_panel_prefs_${uid}`);
    if (userScoped) {
      return normalizeCallPanelPrefs(JSON.parse(userScoped));
    }
    if (currentUser?.call_panel_prefs && typeof currentUser.call_panel_prefs === "object") {
      return normalizeCallPanelPrefs(currentUser.call_panel_prefs);
    }
    const globalSaved = localStorage.getItem("agent_call_panel_prefs");
    if (globalSaved) {
      return normalizeCallPanelPrefs(JSON.parse(globalSaved));
    }
  } catch (e) {}
  return normalizeCallPanelPrefs(null);
}

export function saveCallPanelPrefs(currentUser, nextPrefs) {
  const normalized = normalizeCallPanelPrefs(nextPrefs);
  if (typeof window !== "undefined") {
    try {
      const uid = currentUser?.id || currentUser?.extension || localStorage.getItem("current_user_id") || "default";
      localStorage.setItem(`agent_call_panel_prefs_${uid}`, JSON.stringify(normalized));
      localStorage.setItem("agent_call_panel_prefs", JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent("AGENT_PANEL_PREFS_UPDATED", { detail: normalized }));
    } catch (e) {}
  }
  return normalized;
}

export default function AgentPanel({ backendHost, currentUser, activeCallId, isVisible = true }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingDial, setPendingDial] = useState(null);
  const [rolePermissions, setRolePermissions] = useState(null);
  const [panelPrefs, setPanelPrefs] = useState(() => loadCallPanelPrefs(currentUser));

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");

  useEffect(() => {
    setPanelPrefs(loadCallPanelPrefs(currentUser));
  }, [currentUser?.id, currentUser?.extension, currentUser?.call_panel_prefs]);

  useEffect(() => {
    const handlePrefsUpdate = (e) => {
      if (e?.detail) {
        setPanelPrefs(normalizeCallPanelPrefs(e.detail));
      } else {
        setPanelPrefs(loadCallPanelPrefs(currentUser));
      }
    };
    window.addEventListener("AGENT_PANEL_PREFS_UPDATED", handlePrefsUpdate);
    return () => window.removeEventListener("AGENT_PANEL_PREFS_UPDATED", handlePrefsUpdate);
  }, [currentUser]);

  useEffect(() => {
    const handleSwitchSubTab = (e) => {
      if (e?.detail?.subTab) {
        setActiveTab(e.detail.subTab);
      }
    };
    const handleOpenFullWebphone = () => {
      setActiveTab("webphone");
    };
    window.addEventListener("SWITCH_AGENT_PANEL_SUBTAB", handleSwitchSubTab);
    window.addEventListener("OPEN_FULL_WEBPHONE", handleOpenFullWebphone);
    return () => {
      window.removeEventListener("SWITCH_AGENT_PANEL_SUBTAB", handleSwitchSubTab);
      window.removeEventListener("OPEN_FULL_WEBPHONE", handleOpenFullWebphone);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchRolePerms = async () => {
      try {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        const uid = (typeof window !== "undefined" && localStorage.getItem("current_user_id")) || currentUser?.id || "admin";
        const res = await fetch(`${protocol}//${host}/api/settings/roles`, {
          headers: { "X-User-ID": String(uid) }
        });
        if (!res.ok) return;
        const data = await res.json();
        const rolesList = Array.isArray(data) ? data : (data?.roles || []);
        const userRoleCode = String(currentUser?.role || "agent").toLowerCase().trim();
        const matchedRole = rolesList.find(
          r =>
            String(r.role_code || "").toLowerCase().trim() === userRoleCode ||
            String(r.name || "").toLowerCase().trim() === userRoleCode ||
            String(r.id || "").toLowerCase().trim() === userRoleCode
        );
        if (mounted && matchedRole) {
          setRolePermissions(Array.isArray(matchedRole.permissions) ? matchedRole.permissions : []);
        }
      } catch (e) {
        console.error("[AgentPanel] Role permissions fetch error:", e);
      }
    };
    fetchRolePerms();
    return () => {
      mounted = false;
    };
  }, [host, currentUser?.role, isVisible]);

  const callPanelPerms = useMemo(() => {
    const perms = Array.isArray(rolePermissions) ? rolePermissions : null;
    const hasConfiguredTabs = perms ? perms.some(p => p.startsWith("call_panel:tab_")) : false;
    const hasConfiguredWebphone = perms
      ? perms.some(p =>
          [
            "call_panel:listen_records",
            "call_panel:view_transcripts",
            "call_panel:webphone_save_contact",
            "call_panel:webphone_transfer",
            "call_panel:webphone_conference",
            "call_panel:webphone_reject",
            "call_panel:webphone_mask_number"
          ].includes(p)
        )
      : false;
    const hasConfiguredAgents = perms ? perms.some(p => p.startsWith("call_panel:agents_")) : false;

    const checkTab = (permCode) => {
      if (!perms || !hasConfiguredTabs) return true;
      return perms.includes(permCode);
    };

    const checkWebphoneFeature = (permCode) => {
      if (!perms) return true;
      if (!hasConfiguredWebphone) {
        if (permCode === "call_panel:listen_records") {
          return currentUser?.role === "admin" || perms.includes("call_panel:listen_records");
        }
        if (permCode === "call_panel:view_transcripts") {
          return (
            currentUser?.role === "admin" ||
            perms.includes("call_panel:view_transcripts") ||
            perms.includes("transcripts:access") ||
            perms.includes("reports_transcripts:access")
          );
        }
        return true;
      }
      if (permCode === "call_panel:view_transcripts" && !perms.includes("call_panel:view_transcripts")) {
        return currentUser?.role === "admin" || perms.includes("transcripts:access");
      }
      return perms.includes(permCode);
    };

    const checkAgentsFeature = (permCode) => {
      if (!perms || !hasConfiguredAgents) return true;
      return perms.includes(permCode);
    };

    const isRoleAdmin = String(currentUser?.role || "").toLowerCase() === "admin";
    const canLiveTranslate =
      isRoleAdmin ||
      Boolean(
        perms &&
          (perms.includes("call_panel:live_translation") ||
            perms.includes("live_translator:access") ||
            perms.includes("live_translator"))
      );
    const canVoiceInterpret =
      isRoleAdmin ||
      Boolean(
        perms &&
          (perms.includes("call_panel:voice_interpreter") ||
            perms.includes("live_translator:access") ||
            perms.includes("live_translator"))
      );

    return {
      rawPermissions: perms || [],
      canListenRecords: checkWebphoneFeature("call_panel:listen_records"),
      canViewTranscripts: checkWebphoneFeature("call_panel:view_transcripts"),
      canSaveContact: checkWebphoneFeature("call_panel:webphone_save_contact"),
      canTransfer: checkWebphoneFeature("call_panel:webphone_transfer"),
      canConference: checkWebphoneFeature("call_panel:webphone_conference"),
      canRejectCall: checkWebphoneFeature("call_panel:webphone_reject"),
      canLiveTranslate,
      canVoiceInterpret,
      maskPhoneNumbers: Boolean(perms && perms.includes("call_panel:webphone_mask_number")),
      agentsCanSeeStatus: checkAgentsFeature("call_panel:agents_status"),
      agentsCanSeeDuration: checkAgentsFeature("call_panel:agents_duration"),
      agentsCanSeeCallCounts: checkAgentsFeature("call_panel:agents_call_counts"),
      agentsCanSeeLoginLogout: checkAgentsFeature("call_panel:agents_login_logout"),
      checkTab
    };
  }, [rolePermissions, currentUser?.role]);

  const tabs = useMemo(() => {
    const orderMap = new Map();
    (panelPrefs?.tabOrder || []).forEach((id, idx) => orderMap.set(id, idx));
    const orderedAll = [...ALL_TABS].sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
      return idxA - idxB;
    });
    const allowed = orderedAll.filter(t => callPanelPerms.checkTab(t.perm));
    return allowed.length > 0 ? allowed : [orderedAll[0] || ALL_TABS[0]];
  }, [callPanelPerms, panelPrefs?.tabOrder]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    const handleTriggerCall = (e) => {
      if (e.detail) {
        setPendingDial(String(e.detail));
        if (tabs.some(t => t.id === "webphone")) {
          setActiveTab("webphone");
        }
      }
    };
    const handleIncomingCall = () => {
      if (isVisible && tabs.some(t => t.id === "webphone")) {
        setActiveTab("webphone");
      }
    };
    const handleTabReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const st = webphoneManager.getState();
      if (isVisible && st.callStatus === "Ringing" && tabs.some(t => t.id === "webphone")) {
        setActiveTab("webphone");
      }
    };
    window.addEventListener('TRIGGER_CALL', handleTriggerCall);
    window.addEventListener('INCOMING_WEBPHONE_CALL', handleIncomingCall);
    window.addEventListener('focus', handleTabReturn);
    document.addEventListener('visibilitychange', handleTabReturn);
    return () => {
      window.removeEventListener('TRIGGER_CALL', handleTriggerCall);
      window.removeEventListener('INCOMING_WEBPHONE_CALL', handleIncomingCall);
      window.removeEventListener('focus', handleTabReturn);
      document.removeEventListener('visibilitychange', handleTabReturn);
    };
  }, [isVisible, tabs]);

  const isWebphoneScreenActive = Boolean(isVisible && activeTab === "webphone");
  const [missedQueueCount, setMissedQueueCount] = useState(0);
  const [unseenDirectMissedCount, setUnseenDirectMissedCount] = useState(0);
  const [unseenChatCount, setUnseenChatCount] = useState(0);
  const myExt = String(currentUser?.extension || "1000").trim();
  const myUid = String(currentUser?.id || "").trim();

  useEffect(() => {
    webphoneManager.setWebphoneScreenActive(isWebphoneScreenActive);
  }, [isWebphoneScreenActive]);

  useEffect(() => {
    if (activeTab === "history" && typeof window !== "undefined") {
      localStorage.setItem(`seen_direct_missed_ts_${myExt}`, String(Date.now()));
      setUnseenDirectMissedCount(0);
    }
    if (activeTab === "chat" && typeof window !== "undefined") {
      localStorage.setItem(`seen_chat_ts_${myExt}`, String(Date.now()));
      setUnseenChatCount(0);
    }
  }, [activeTab, myExt]);

  useEffect(() => {
    let mounted = true;
    const pollBadges = async () => {
      try {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        const [mqRes, callsRes, intChatRes, omniChatRes] = await Promise.all([
          fetch(`${protocol}//${host}/api/agent/missed_queue_calls?extension=${encodeURIComponent(myExt)}&user_id=${encodeURIComponent(myUid)}&t=${Date.now()}`),
          fetch(`${protocol}//${host}/api/calls?extension=${encodeURIComponent(myExt)}&t=${Date.now()}`),
          fetch(`${protocol}//${host}/api/agent/chat?extension=${encodeURIComponent(myExt)}&user_id=${encodeURIComponent(myUid)}&t=${Date.now()}`),
          fetch(`${protocol}//${host}/api/omnichannel/chats?t=${Date.now()}`)
        ]);
        if (mounted && mqRes.ok) {
          const mqData = await mqRes.json();
          setMissedQueueCount(Array.isArray(mqData) ? mqData.length : 0);
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (mounted && callsRes.ok) {
          const cData = await callsRes.json();
          if (Array.isArray(cData)) {
            const seenTs = Number(
              (typeof window !== "undefined" && localStorage.getItem(`seen_direct_missed_ts_${myExt}`)) || 0
            );
            const minTs = Math.max(seenTs, todayStart.getTime());

            const directMissed = cData.filter((c) => {
              const hs = String(c.hangup_source || "");
              const isQueue = Boolean(c.is_queue_call || hs.startsWith("queue:"));
              if (isQueue) return false;
              const isOutbound = c.caller_number === myExt;
              if (isOutbound) return false;
              const st = String(c.status || "").toLowerCase();
              const isUnanswered =
                st === "no_answer" || st === "missed" || st === "busy" || st === "cancelled" || st === "failed";
              if (!isUnanswered) return false;
              if (!c.start_time) return false;
              const dt = new Date(c.start_time + (String(c.start_time).endsWith("Z") ? "" : "Z")).getTime();
              return !isNaN(dt) && dt > minTs;
            });
            setUnseenDirectMissedCount(activeTab === "history" ? 0 : directMissed.length);
          }
        }

        if (mounted) {
          if (activeTab === "chat") {
            if (typeof window !== "undefined") {
              localStorage.setItem(`seen_chat_ts_${myExt}`, String(Date.now()));
            }
            setUnseenChatCount(0);
          } else {
            const seenChatTs = Number(
              (typeof window !== "undefined" && localStorage.getItem(`seen_chat_ts_${myExt}`)) || 0
            );
            const minChatTs = Math.max(seenChatTs, todayStart.getTime());
            const myKeys = new Set([myExt, myUid].filter(Boolean));
            let totalUnseenChats = 0;

            if (intChatRes.ok) {
              const intData = await intChatRes.json();
              if (Array.isArray(intData)) {
                const unseenInternal = intData.filter((m) => {
                  const s = String(m.sender_id || "");
                  const r = String(m.receiver_id || "");
                  if (myKeys.has(s) || !myKeys.has(r)) return false;
                  if (!m.timestamp) return false;
                  let iso = String(m.timestamp);
                  if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) iso += "Z";
                  const dt = new Date(iso).getTime();
                  return !isNaN(dt) && dt > minChatTs;
                });
                totalUnseenChats += unseenInternal.length;
              }
            }

            if (omniChatRes.ok) {
              const omniData = await omniChatRes.json();
              if (Array.isArray(omniData)) {
                const currentUserFullName = String(currentUser?.full_name || "").toLowerCase().trim();
                const currentUsername = String(currentUser?.username || "").toLowerCase().trim();
                const isAdmin = currentUser?.role === "admin" || currentUsername === "admin";
                const unseenCustomer = omniData.filter((s) => {
                  if (s.assigned_agent !== "human") return false;
                  const assignedUser = String(s.assigned_user || "").toLowerCase().trim();
                  const isAssignedToMe =
                    !assignedUser ||
                    assignedUser === currentUserFullName ||
                    assignedUser === currentUsername ||
                    isAdmin;
                  if (!isAssignedToMe) return false;
                  if (!s.last_message_time) return false;
                  let iso = String(s.last_message_time);
                  if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) iso += "Z";
                  const dt = new Date(iso).getTime();
                  return !isNaN(dt) && dt > minChatTs;
                });
                totalUnseenChats += unseenCustomer.length;
              }
            }

            setUnseenChatCount(totalUnseenChats);
          }
        }
      } catch (e) {}
    };

    const handleMqUpdate = (e) => {
      if (typeof e?.detail === "number") {
        setMissedQueueCount(e.detail);
      }
    };
    window.addEventListener("MISSED_QUEUE_CALLS_UPDATED", handleMqUpdate);
    pollBadges();
    const timer = setInterval(pollBadges, 5000);
    return () => {
      mounted = false;
      window.removeEventListener("MISSED_QUEUE_CALLS_UPDATED", handleMqUpdate);
      clearInterval(timer);
    };
  }, [host, myExt, myUid, activeTab, currentUser?.full_name, currentUser?.username, currentUser?.role]);

  const isTopNav = panelPrefs?.navPosition === "top";
  const [topNavSlot, setTopNavSlot] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined" || !isTopNav || !isVisible) {
      setTopNavSlot(null);
      return;
    }
    const findSlot = () => {
      const el = document.getElementById("agent-top-nav-slot");
      if (el) {
        setTopNavSlot((prev) => (prev === el ? prev : el));
        return true;
      }
      return false;
    };
    if (!findSlot()) {
      const timer = setInterval(() => {
        if (findSlot()) clearInterval(timer);
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isTopNav, isVisible, activeTab, currentUser]);

  const activeTopSlot =
    isTopNav && isVisible && typeof document !== "undefined"
      ? document.getElementById("agent-top-nav-slot") || topNavSlot
      : null;

  const renderHorizontalNavContent = () => (
    <div className="flex items-center justify-between gap-2 w-full min-w-0">
      <div className="flex items-center gap-0.5 overflow-x-auto py-1 no-scrollbar min-w-0">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          const showMissedBadge = tab.id === "missed" && missedQueueCount > 0;
          const showHistoryDot = tab.id === "history" && unseenDirectMissedCount > 0;
          const showChatBadge = tab.id === "chat" && unseenChatCount > 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? `${bg} text-white shadow-sm`
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <tab.icon size={14} className="shrink-0" />
              <span>{tab.name}</span>
              {showMissedBadge && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${
                    isSelected ? "bg-white text-rose-600" : "bg-rose-500 text-white animate-pulse"
                  }`}
                >
                  {missedQueueCount}
                </span>
              )}
              {showHistoryDot && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white shrink-0 animate-pulse">
                  {unseenDirectMissedCount}
                </span>
              )}
              {showChatBadge && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white shrink-0 animate-pulse">
                  {unseenChatCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="shrink-0 pl-2 border-l border-slate-200/80 dark:border-slate-800">
        <AgentSessionCard
          backendHost={backendHost}
          currentUser={currentUser}
          activeCallId={activeCallId}
          headerBar={true}
        />
      </div>
    </div>
  );

  return (
    <div className={`flex ${isTopNav ? "flex-col" : ""} h-full w-full gap-4 animate-in fade-in zoom-in-95 duration-300 overflow-hidden`}>
      {/* Top Navigation Portal directly into the main Header Bar (when navPosition === "top") */}
      {isTopNav && isVisible && activeTopSlot && createPortal(renderHorizontalNavContent(), activeTopSlot)}

      {/* Left Vertical Sidebar & Tabs + Agent Session Card (when navPosition === "left") */}
      {!isTopNav && (
        <div
          className={`w-64 shrink-0 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-3 h-full overflow-y-auto hidden md:flex md:flex-col transition-all duration-200`}
        >
          <div className="flex flex-col space-y-1.5">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              const showMissedBadge = tab.id === "missed" && missedQueueCount > 0;
              const showHistoryDot = tab.id === "history" && unseenDirectMissedCount > 0;
              const showChatBadge = tab.id === "chat" && unseenChatCount > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-medium transition-all text-left w-full ${
                    isSelected
                      ? `${bg} text-white shadow-md`
                      : `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <tab.icon size={18} className="shrink-0" />
                    <span className="text-sm truncate">{tab.name}</span>
                  </span>
                  {showMissedBadge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                        isSelected
                          ? "bg-white text-rose-600"
                          : "bg-rose-500 text-white animate-pulse"
                      }`}
                      title={`${missedQueueCount} adet geri dönülmemiş kuyruk kayıp çağrısı`}
                    >
                      {missedQueueCount}
                    </span>
                  )}
                  {showHistoryDot && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shrink-0 animate-pulse"
                      title={`${unseenDirectMissedCount} yeni doğrudan cevapsız çağrı`}
                    >
                      {unseenDirectMissedCount}
                    </span>
                  )}
                  {showChatBadge && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shrink-0 animate-pulse"
                      title={`${unseenChatCount} yeni sohbet mesajı`}
                    >
                      {unseenChatCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Agent Session & Break Status Card placed below Sohbet */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <AgentSessionCard
              backendHost={backendHost}
              currentUser={currentUser}
              activeCallId={activeCallId}
              compact={true}
            />
          </div>
        </div>
      )}

      {/* Mobile Tabs (Horizontal) - Just in case on small screens */}
      {!isTopNav && (
        <div className={`md:hidden shrink-0 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-3 w-full overflow-x-auto`}>
          <div className="flex space-x-2 min-w-max">
            {tabs.map(tab => {
              const isSelected = activeTab === tab.id;
              const showMissedBadge = tab.id === "missed" && missedQueueCount > 0;
              const showHistoryDot = tab.id === "history" && unseenDirectMissedCount > 0;
              const showChatBadge = tab.id === "chat" && unseenChatCount > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all ${
                    isSelected
                      ? `${bg} text-white shadow-md`
                      : `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`
                  }`}
                >
                  <tab.icon size={16} />
                  <span className="text-xs">{tab.name}</span>
                  {showMissedBadge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white">
                      {missedQueueCount}
                    </span>
                  )}
                  {showHistoryDot && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                  {showChatBadge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white animate-pulse">
                      {unseenChatCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content Area */}
      <div className={`flex-1 h-full overflow-hidden relative rounded-3xl bg-white dark:bg-slate-900 shadow-sm border ${borderLight}`}>
        <div className={activeTab === "webphone" ? "w-full h-full" : "hidden"}>
          <AgentWebphoneTab
            backendHost={backendHost}
            currentUser={currentUser}
            activeCallId={activeCallId}
            pendingDial={pendingDial}
            setPendingDial={setPendingDial}
            isWebphoneScreenActive={isWebphoneScreenActive}
            callPanelPerms={callPanelPerms}
          />
        </div>
        {activeTab === "dashboard" && <AgentDashboardTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "agents" && <AgentQueuePeersTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "speeddial" && <AgentSpeedDialTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "missed" && <AgentMissedCallsTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "directory" && <AgentDirectoryTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "history" && <AgentHistoryTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "voicemail" && <AgentVoicemailTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "chat" && <AgentChatTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} panelPrefs={panelPrefs} />}
        {activeTab === "deskphone" && <AgentDeskphoneTab backendHost={backendHost} currentUser={currentUser} />}
      </div>
    </div>
  );
}
