import React, { useState, useEffect, useMemo } from "react";
import { LayoutDashboard, PhoneCall, List, PhoneMissed, Users, History, Voicemail, MessageSquare, Headphones } from "lucide-react";
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
import { useTheme } from "../../utils/theme";

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
];

export const DEFAULT_CALL_PANEL_PREFS = {
  viewMode: "list", // "list" | "box"
  boxSize: "large", // "large" | "small"
  tabOrder: ALL_TABS.map((t) => t.id),
};

export function normalizeCallPanelPrefs(raw) {
  const defaultOrder = ALL_TABS.map((t) => t.id);
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CALL_PANEL_PREFS, tabOrder: [...defaultOrder] };
  }
  const viewMode = raw.viewMode === "box" ? "box" : "list";
  const boxSize = raw.boxSize === "small" ? "small" : "large";
  let tabOrder = Array.isArray(raw.tabOrder) ? raw.tabOrder.filter((id) => defaultOrder.includes(id)) : [];
  for (const id of defaultOrder) {
    if (!tabOrder.includes(id)) {
      tabOrder.push(id);
    }
  }
  return { viewMode, boxSize, tabOrder };
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
        setActiveSubTab(e.detail.subTab);
      }
    };
    window.addEventListener("SWITCH_AGENT_PANEL_SUBTAB", handleSwitchSubTab);
    return () => window.removeEventListener("SWITCH_AGENT_PANEL_SUBTAB", handleSwitchSubTab);
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
  }, [host, currentUser?.role]);

  const callPanelPerms = useMemo(() => {
    const perms = Array.isArray(rolePermissions) ? rolePermissions : null;
    const hasConfiguredTabs = perms ? perms.some(p => p.startsWith("call_panel:tab_")) : false;
    const hasConfiguredWebphone = perms
      ? perms.some(p =>
          [
            "call_panel:listen_records",
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
        return true;
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
    window.addEventListener('TRIGGER_CALL', handleTriggerCall);
    window.addEventListener('INCOMING_WEBPHONE_CALL', handleIncomingCall);
    return () => {
      window.removeEventListener('TRIGGER_CALL', handleTriggerCall);
      window.removeEventListener('INCOMING_WEBPHONE_CALL', handleIncomingCall);
    };
  }, [isVisible, tabs]);

  const isWebphoneScreenActive = Boolean(isVisible && activeTab === "webphone");

  return (
    <div className="flex h-full w-full max-w-[1600px] gap-5 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
      {/* Sidebar & Tabs */}
      <div
        className={`w-52 shrink-0 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-3 h-full overflow-y-auto hidden md:block transition-all duration-200`}
      >
        <div className="flex flex-col space-y-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-left w-full ${
                activeTab === tab.id
                  ? `${bg} text-white shadow-md`
                  : `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`
              }`}
            >
              <tab.icon size={18} />
              <span className="text-sm">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Tabs (Horizontal) - Just in case on small screens */}
      <div className={`md:hidden shrink-0 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-3 w-full overflow-x-auto`}>
        <div className="flex space-x-2 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? `${bg} text-white shadow-md`
                  : `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`
              }`}
            >
              <tab.icon size={16} />
              <span className="text-xs">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

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
      </div>
    </div>
  );
}
