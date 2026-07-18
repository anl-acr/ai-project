import React, { useState } from "react";
import { LayoutDashboard, PhoneCall, List, PhoneMissed, Users, History, Voicemail, MessageSquare } from "lucide-react";
import AgentDashboardTab from "./tabs/AgentDashboardTab";
import AgentWebphoneTab from "./tabs/AgentWebphoneTab";
import AgentSpeedDialTab from "./tabs/AgentSpeedDialTab";
import AgentMissedCallsTab from "./tabs/AgentMissedCallsTab";
import AgentDirectoryTab from "./tabs/AgentDirectoryTab";
import AgentHistoryTab from "./tabs/AgentHistoryTab";
import AgentVoicemailTab from "./tabs/AgentVoicemailTab";
import AgentChatTab from "./tabs/AgentChatTab";
import { useTheme } from "../../utils/theme";

export default function AgentPanel({ backendHost, currentUser, activeCallId }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", name: "Pano", icon: LayoutDashboard },
    { id: "webphone", name: "Webphone", icon: PhoneCall },
    { id: "speeddial", name: "Hızlı Arama", icon: List },
    { id: "missed", name: "Kayıp Çağrı", icon: PhoneMissed },
    { id: "directory", name: "Rehber", icon: Users },
    { id: "history", name: "Çağrı Geçmişi", icon: History },
    { id: "voicemail", name: "Sesli Posta", icon: Voicemail },
    { id: "chat", name: "Sohbet", icon: MessageSquare },
  ];

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
        {activeTab === "dashboard" && <AgentDashboardTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "webphone" && <AgentWebphoneTab backendHost={backendHost} currentUser={currentUser} activeCallId={activeCallId} />}
        {activeTab === "speeddial" && <AgentSpeedDialTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "missed" && <AgentMissedCallsTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "directory" && <AgentDirectoryTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "history" && <AgentHistoryTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "voicemail" && <AgentVoicemailTab backendHost={backendHost} currentUser={currentUser} />}
        {activeTab === "chat" && <AgentChatTab backendHost={backendHost} currentUser={currentUser} />}
      </div>
    </div>
  );
}
