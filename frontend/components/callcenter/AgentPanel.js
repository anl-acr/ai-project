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

const ALL_TABS = [
  { id: "dashboard", perm: "call_panel:tab_dashboard", name: "Pano", icon: LayoutDashboard },
  { id: "webphone", perm: "call_panel:tab_webphone", name: "Webphone", icon: PhoneCall },
  { id: "agents", perm: "call_panel:tab_agents", name: "Temsilciler", icon: Headphones },
  { id: "speeddial", perm: "call_panel:tab_speeddial", name: "Hızlı Arama", icon: List },
  { id: "missed", perm: "call_panel:tab_missed", name: "Kayıp Çağrı", icon: PhoneMissed },
  { id: "directory", perm: "call_panel:tab_directory", name: "Rehber", icon: Users },
  { id: "history", perm: "call_panel:tab_history", name: "Çağrı Geçmişi", icon: History },
  { id: "voicemail", perm: "call_panel:tab_voicemail", name: "Sesli Posta", icon: Voicemail },
  { id: "chat", perm: "call_panel:tab_chat", name: "Sohbet", icon: MessageSquare },
];

export default function AgentPanel({ backendHost, currentUser, activeCallId, isVisible = true }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingDial, setPendingDial] = useState(null);
  const [rolePermissions, setRolePermissions] = useState(null);

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");

  useEffect(() => {
    let mounted = true;
    const fetchRolePerms = async () => {
      try {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        const res = await fetch(`${protocol}//${host}/api/settings/roles`);
        if (!res.ok) return;
        const data = await res.json();
        const rolesList = Array.isArray(data) ? data : (data?.roles || []);
        const userRoleCode = currentUser?.role || "agent";
        const matchedRole = rolesList.find(r => r.role_code === userRoleCode);
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

    return {
      rawPermissions: perms || [],
      canListenRecords: checkWebphoneFeature("call_panel:listen_records"),
      canSaveContact: checkWebphoneFeature("call_panel:webphone_save_contact"),
      canTransfer: checkWebphoneFeature("call_panel:webphone_transfer"),
      canConference: checkWebphoneFeature("call_panel:webphone_conference"),
      canRejectCall: checkWebphoneFeature("call_panel:webphone_reject"),
      maskPhoneNumbers: Boolean(perms && perms.includes("call_panel:webphone_mask_number")),
      agentsCanSeeStatus: checkAgentsFeature("call_panel:agents_status"),
      agentsCanSeeDuration: checkAgentsFeature("call_panel:agents_duration"),
      agentsCanSeeCallCounts: checkAgentsFeature("call_panel:agents_call_counts"),
      agentsCanSeeLoginLogout: checkAgentsFeature("call_panel:agents_login_logout"),
      checkTab
    };
  }, [rolePermissions, currentUser?.role]);

  const tabs = useMemo(() => {
    const allowed = ALL_TABS.filter(t => callPanelPerms.checkTab(t.perm));
    return allowed.length > 0 ? allowed : [ALL_TABS[0]];
  }, [callPanelPerms]);

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
      <div className={`w-52 shrink-0 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-3 h-full overflow-y-auto hidden md:block`}>
        <div className="flex flex-col space-y-1.5">
          {tabs.map(tab => (
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
        {activeTab === "dashboard" && <AgentDashboardTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "agents" && <AgentQueuePeersTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "speeddial" && <AgentSpeedDialTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "missed" && <AgentMissedCallsTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "directory" && <AgentDirectoryTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "history" && <AgentHistoryTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "voicemail" && <AgentVoicemailTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
        {activeTab === "chat" && <AgentChatTab backendHost={backendHost} currentUser={currentUser} callPanelPerms={callPanelPerms} />}
      </div>
    </div>
  );
}
