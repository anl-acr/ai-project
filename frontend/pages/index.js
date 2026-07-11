import React, { useState, useEffect } from "react";
import Head from "next/head";
import { 
  Bot, 
  Database, 
  MessageSquare, 
  Phone, 
  Sliders, 
  Smartphone, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  Layers,
  FileText,
  Calendar,
  Sun,
  Moon,
  Server,
  Settings,
  Monitor,
  LogOut,
  Volume2,
  Play,
  Square,
  Check,
  PhoneCall,
  GitBranch,
  BookOpen,
  ShieldAlert,
  ChevronDown,
  Award
} from "lucide-react";
import { playRingtoneSound, stopRingtoneSound } from "../utils/audioHelper";

import dynamic from "next/dynamic";

// Import custom components (with SSR disabled for WebRTC phone client)
const CallChatWidget = dynamic(
  () => import("../components/dashboard/CallChatWidget"),
  { ssr: false }
);
import TranscriptPanel from "../components/dashboard/TranscriptPanel";
import SettingsPanel from "../components/settings/SettingsPanel";
import KnowledgeBase from "../components/settings/KnowledgeBase";
import RuleEditor from "../components/settings/RuleEditor";
import ReportsPanel from "../components/dashboard/ReportsPanel";
import CalendarPanel from "../components/dashboard/CalendarPanel";
import LiveDashboardPanel from "../components/dashboard/LiveDashboardPanel";
import SystemStatusPanel from "../components/dashboard/SystemStatusPanel";
import AgentSessionCard from "../components/phone/AgentSessionCard";
import WallboardPanel from "../components/dashboard/WallboardPanel";
import DialerSettings from "../components/settings/DialerSettings";
import CallFlowEditor from "../components/settings/CallFlowEditor";
import AIAgentsSettings from "../components/settings/AIAgentsSettings";
import ChangelogPanel from "../components/settings/ChangelogPanel";
import OmnichannelPanel from "../components/dashboard/OmnichannelPanel";
import ContactsPanel from "../components/dashboard/ContactsPanel";
import BlacklistSettings from "../components/settings/BlacklistSettings";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, call-center, pbx-settings, channel-settings, rag-kb, rule-editor
  const [isEditingCallFlow, setIsEditingCallFlow] = useState(false);
  const [activeCallId, setActiveCallId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasOmnichannelPermission, setHasOmnichannelPermission] = useState(false);
  const [hasContactsPermission, setHasContactsPermission] = useState(false);
  const [hasBlacklistPermission, setHasBlacklistPermission] = useState(false);
  const [hasMobileTransferPermission, setHasMobileTransferPermission] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [gsmNumber, setGsmNumber] = useState("");
  const [mobileTransferEnabled, setMobileTransferEnabled] = useState(false);
  const [openCategories, setOpenCategories] = useState({
    operations: true,
    ai: true,
    routing: true,
    reportsGroup: true,
    system: true
  });

  const toggleCategory = (cat) => {
    setOpenCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Profile and ringtone preferences states
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [agentAvatar, setAgentAvatar] = useState("https://api.dicebear.com/7.x/avataaars/svg?seed=Felix");
  const [agentRingtone, setAgentRingtone] = useState("classic");

  // Audio devices selection states
  const [audioDevices, setAudioDevices] = useState({ inputs: [], outputs: [] });
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [selectedRingtoneSpeaker, setSelectedRingtoneSpeaker] = useState("");

  useEffect(() => {
    if (settingsModalOpen && currentUser) {
      setGsmNumber(currentUser.gsm_number || "");
      setMobileTransferEnabled(currentUser.mobile_transfer_enabled || false);
    }
  }, [settingsModalOpen, currentUser]);

  // Load audio device settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMic = localStorage.getItem("selected_mic");
      if (savedMic) setSelectedMic(savedMic);
      const savedSpeaker = localStorage.getItem("selected_speaker");
      if (savedSpeaker) setSelectedSpeaker(savedSpeaker);
      const savedRingtoneSpeaker = localStorage.getItem("selected_ringtone_speaker");
      if (savedRingtoneSpeaker) setSelectedRingtoneSpeaker(savedRingtoneSpeaker);
    }
  }, []);

  // Sync available media devices on modal load
  useEffect(() => {
    if (settingsModalOpen) {
      const loadDevices = async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter(d => d.kind === "audioinput");
          const outputs = devices.filter(d => d.kind === "audiooutput");
          setAudioDevices({ inputs, outputs });

          if (!selectedMic && inputs.length > 0) setSelectedMic(inputs[0].deviceId);
          if (!selectedSpeaker && outputs.length > 0) setSelectedSpeaker(outputs[0].deviceId);
          if (!selectedRingtoneSpeaker && outputs.length > 0) setSelectedRingtoneSpeaker(outputs[0].deviceId);
        } catch (err) {
          console.error("Media devices listing error:", err);
        }
      };
      loadDevices();
    }
  }, [settingsModalOpen]);

  const backendHost = "localhost:8000";

  // Load avatar and ringtone from localStorage on mount and sync with presence
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAvatar = localStorage.getItem("agent_avatar");
      if (savedAvatar) setAgentAvatar(savedAvatar);
      const savedRingtone = localStorage.getItem("ringtone");
      if (savedRingtone) setAgentRingtone(savedRingtone);
    }

    const syncAgentPresence = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const status = await resStatus.json();
        if (status.is_logged_in && status.user_id) {
          const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
          const users = await resUsers.json();
          const curr = users.find(u => u.id === status.user_id);
          if (curr && curr.avatar) {
            setAgentAvatar(curr.avatar);
            localStorage.setItem("agent_avatar", curr.avatar);
          }
        }
      } catch (e) {
        console.error("Agent presence sync error:", e);
      }
    };
    const checkRolePermissions = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          return;
        }
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUserData = usersData.find(u => u.id === statusData.user_id);
        if (!currentUserData) {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          return;
        }
        setCurrentUser(currentUserData);
        if (currentUserData.avatar) {
          setAgentAvatar(currentUserData.avatar);
        }
        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUserData.role);
        if (!currentRole) {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          return;
        }
        setHasOmnichannelPermission(currentRole.permissions.includes("omnichannel:access"));
        setHasContactsPermission(currentRole.permissions.includes("contacts:read"));
        setHasBlacklistPermission(currentRole.permissions.includes("blacklist:read"));
        setHasMobileTransferPermission(currentRole.permissions.includes("mobile_transfer:write"));
      } catch (err) {
        console.error("Permission check error:", err);
        setHasOmnichannelPermission(true);
        setHasContactsPermission(true);
        setHasBlacklistPermission(true);
        setHasMobileTransferPermission(true);
      }
    };
    syncAgentPresence();
    checkRolePermissions();
  }, []);

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
    } else if (savedTheme === "light") {
      setIsDarkMode(false);
    } else {
      setIsDarkMode(false); // default light
    }
  }, []);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
  };

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/agent/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          is_logged_in: false,
          status: "offline",
          current_break: null,
          user_id: null
        })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Logout error:", e);
      window.location.reload();
    }
  };

  React.useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const sendLog = (level, args) => {
      const message = args.map(arg => {
        if (typeof arg === "object") {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(" ");

      fetch(`http://${backendHost}/api/client-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, message })
      }).catch(() => {});
    };

    console.log = (...args) => {
      originalLog(...args);
      sendLog("log", args);
    };
    console.warn = (...args) => {
      originalWarn(...args);
      sendLog("warn", args);
    };
    console.error = (...args) => {
      originalError(...args);
      sendLog("error", args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex font-sans transition-colors duration-300">
      <Head>
        <title>Omnichannel AI Call Center Admin Panel</title>
        <meta name="description" content="AI PBX and Social Messaging dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Sidebar Navigation */}
      {!isEditingCallFlow && (
        <aside className="w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col p-4 shrink-0 overflow-y-auto transition-colors duration-300">
        <div className="flex items-center gap-2 px-2 py-4 mb-6 border-b border-slate-100 dark:border-slate-800/60">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Voice AI
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">ÇOK KANALLI SANTRAL</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 select-none">
          {/* Group 1: Operasyon & İzleme */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("operations")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Operasyon & İzleme</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.operations ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.operations ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "dashboard"
                    ? "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100/80 dark:border-violet-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Activity size={16} className={activeTab === "dashboard" ? "text-violet-500" : ""} />
                <span>Gerçek Zamanlı AI Pano</span>
              </button>

              <button
                onClick={() => setActiveTab("wallboard")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "wallboard"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Monitor size={16} className={activeTab === "wallboard" ? "text-indigo-500" : ""} />
                <span>Canlı İzleme Paneli</span>
              </button>

              <button
                onClick={() => setActiveTab("call-center")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-center"
                    ? "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Phone size={16} className={activeTab === "call-center" ? "text-purple-500" : ""} />
                <span>Temsilci Çağrı Paneli</span>
              </button>

              {hasOmnichannelPermission && (
                <button
                  onClick={() => setActiveTab("omnichannel")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "omnichannel"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <MessageSquare size={16} className={activeTab === "omnichannel" ? "text-purple-500" : ""} />
                  <span>Ortak Gelen Kutusu</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 2: Yapay Zeka & Bilgi */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("ai")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Yapay Zeka & Bilgi</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.ai ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.ai ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("ai-agents")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "ai-agents"
                    ? "bg-purple-50 dark:bg-purple-950/20 text-purple-655 dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Bot size={16} className={activeTab === "ai-agents" ? "text-purple-500" : ""} />
                <span>AI Temsilcileri</span>
              </button>

              <button
                onClick={() => setActiveTab("rag-kb")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "rag-kb"
                    ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Database size={16} className={activeTab === "rag-kb" ? "text-blue-500" : ""} />
                <span>Bilgi Bankası (RAG)</span>
              </button>

              <button
                onClick={() => setActiveTab("rule-editor")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "rule-editor"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sliders size={16} className={activeTab === "rule-editor" ? "text-indigo-500" : ""} />
                <span>Kural & Senaryo Editörü</span>
              </button>
            </div>
          </div>

          {/* Group 3: Çağrı & Yönlendirme */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("routing")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Çağrı & Yönlendirme</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.routing ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.routing ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("call-flow")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-flow"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <GitBranch size={16} className={activeTab === "call-flow" ? "text-indigo-500" : ""} />
                <span>Arama Akış Yönetimi</span>
              </button>

              <button
                onClick={() => setActiveTab("dialer")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "dialer"
                    ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneCall size={16} className={activeTab === "dialer" ? "text-blue-500" : ""} />
                <span>Dış Arama (Dialer)</span>
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "calendar"
                    ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100/80 dark:border-amber-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Calendar size={16} className={activeTab === "calendar" ? "text-amber-500" : ""} />
                <span>Randevu Takvimi</span>
              </button>

              {hasContactsPermission && (
                <button
                  onClick={() => setActiveTab("contacts")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "contacts"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <BookOpen size={16} className={activeTab === "contacts" ? "text-purple-500" : ""} />
                  <span>Rehber</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 4: Çağrı Raporları & Analiz */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("reportsGroup")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Çağrı Raporları & Analiz</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.reportsGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.reportsGroup ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("reports-cdr")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-cdr"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <FileText size={16} className={activeTab === "reports-cdr" ? "text-emerald-500" : ""} />
                <span>CDR</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-audio")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-audio"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Volume2 size={16} className={activeTab === "reports-audio" ? "text-emerald-500" : ""} />
                <span>Ses Kayıtları</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-transcripts")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transcripts"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare size={16} className={activeTab === "reports-transcripts" ? "text-emerald-500" : ""} />
                <span>Çağrı Transkripti</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-sentiment")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sparkles size={16} className={activeTab === "reports-sentiment" ? "text-emerald-500" : ""} />
                <span>Duygu Analizi</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-qa")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-qa"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Award size={16} className={activeTab === "reports-qa" ? "text-indigo-500" : ""} />
                <span>Kalite Değerlendirmeleri</span>
              </button>
            </div>
          </div>

          {/* Group 5: Yönetim & Ayarlar */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("system")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Yönetim & Ayarlar</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.system ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.system ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "settings"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Settings size={16} className={activeTab === "settings" ? "text-rose-500" : ""} />
                <span>Sistem Ayarları</span>
              </button>

              <button
                onClick={() => setActiveTab("system-status")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "system-status"
                    ? "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-100/80 dark:border-cyan-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Server size={16} className={activeTab === "system-status" ? "text-cyan-500" : ""} />
                <span>Sistem Panosu & Sağlık</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Footer info */} 
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-[10px] text-slate-500 dark:text-slate-400 space-y-2 transition-colors duration-300">
          <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            Sistem Çevrimiçi
          </p>
          <button
            onClick={() => setActiveTab("changelog")}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition cursor-pointer bg-transparent border-0 p-0 outline-none"
          >
            <span>v1.1.0 (On-Premise)</span>
          </button>
        </div>
      </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950/40 transition-colors duration-300">
        
        {/* Top Header Navbar */}
        {!isEditingCallFlow && (
        <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-8 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md transition-colors duration-300">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs tracking-wider">AKTİF İŞLEMLER</span>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            {activeCallId ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping"></span>
                Görüşme Aktif (ID: {activeCallId})
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-800/40">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                Arama Bekleniyor
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              title={isDarkMode ? "Aydınlık Mod" : "Karanlık Mod"}
            >
              {isDarkMode ? <Sun size={14} className="text-amber-450" /> : <Moon size={14} className="text-indigo-500" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm focus:outline-none"
              >
                <img
                  src={agentAvatar}
                  alt="Profil"
                  className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-850/80 shrink-0"
                />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in duration-100">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setSettingsModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Settings size={14} />
                    <span>Profil Ayarları</span>
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {/* Dynamic View Panel */}
        <div className={`flex-1 overflow-y-auto flex ${isEditingCallFlow ? "p-0 justify-center w-full h-full bg-white dark:bg-slate-950" : ["wallboard", "settings", "rag-kb", "rule-editor", "calendar", "system-status", "dialer", "call-flow", "ai-agents", "changelog", "reports-cdr", "reports-audio", "reports-transcripts", "reports-sentiment", "reports-qa"].includes(activeTab) ? "p-8 justify-start items-start w-full" : "p-8 justify-center"}`}>
          {activeTab === "call-center" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl">
              <div className="lg:col-span-1 flex flex-col gap-6">
                {/* Agent Break and Session Management Card */}
                <AgentSessionCard backendHost={backendHost} />

                {/* Stats Info Widget */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    <TrendingUp size={14} className="text-purple-500 dark:text-purple-400" />
                    Bugünkü Çağrı İstatistikleri
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">Yapay Zeka</p>
                      <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">24</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">Temsilciye</p>
                      <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">5</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript view Panel (2/3 width) */}
              <div className="lg:col-span-2">
                <TranscriptPanel callId={activeCallId} backendHost={backendHost} />
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <SettingsPanel backendHost={backendHost} />
          )}

          {activeTab === "rag-kb" && (
            <KnowledgeBase backendHost={backendHost} />
          )}

          {activeTab === "rule-editor" && (
            <RuleEditor backendHost={backendHost} />
          )}

          {activeTab === "reports-cdr" && (
            <ReportsPanel backendHost={backendHost} viewMode="cdr" />
          )}

          {activeTab === "reports-audio" && (
            <ReportsPanel backendHost={backendHost} viewMode="audio" />
          )}

          {activeTab === "reports-transcripts" && (
            <ReportsPanel backendHost={backendHost} viewMode="transcripts" />
          )}

          {activeTab === "reports-sentiment" && (
            <ReportsPanel backendHost={backendHost} viewMode="sentiment" />
          )}

          {activeTab === "reports-qa" && (
            <ReportsPanel backendHost={backendHost} viewMode="qa" />
          )}

          {activeTab === "dialer" && (
            <DialerSettings backendHost={backendHost} />
          )}

          {activeTab === "call-flow" && (
            <CallFlowEditor backendHost={backendHost} onEditStateChange={setIsEditingCallFlow} />
          )}

          {activeTab === "ai-agents" && (
            <AIAgentsSettings backendHost={backendHost} onEditStateChange={setIsEditingCallFlow} />
          )}

          {activeTab === "omnichannel" && (
            <OmnichannelPanel backendHost={backendHost} />
          )}

          {activeTab === "contacts" && (
            <ContactsPanel backendHost={backendHost} />
          )}

          {activeTab === "calendar" && (
            <CalendarPanel backendHost={backendHost} />
          )}

          {activeTab === "dashboard" && (
            <LiveDashboardPanel backendHost={backendHost} />
          )}

          {activeTab === "wallboard" && (
            <WallboardPanel backendHost={backendHost} />
          )}

          {activeTab === "system-status" && (
            <SystemStatusPanel backendHost={backendHost} />
          )}

          {activeTab === "changelog" && (
            <ChangelogPanel onBack={() => setActiveTab("dashboard")} />
          )}
        </div>

        {/* Profile & Ringtone Settings Modal */}
        {settingsModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2 bg-violet-50 dark:bg-violet-950/20 text-violet-500 rounded-xl">
                  <Settings size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-850 dark:text-white uppercase tracking-wider">Temsilci Profil Ayarları</h4>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Kişisel arayüz tercihlerinizi ve çağrı zil sesini özelleştirin.</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                
                {/* Avatar Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">Profil Avatarı Seçin</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Toby"
                    ].map((av, idx) => {
                      const isSelected = av === agentAvatar;
                      return (
                        <button
                          key={idx}
                          onClick={() => setAgentAvatar(av)}
                          className={`p-0.5 rounded-xl border-2 transition-all hover:scale-105 focus:outline-none ${
                            isSelected 
                              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20" 
                              : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                          }`}
                        >
                          <img src={av} alt="Avatar option" className="w-full h-full rounded-lg" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ringtone Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">Çağrı Zil Sesi</label>
                  <div className="flex gap-2">
                    <select
                      value={agentRingtone}
                      onChange={(e) => {
                        setAgentRingtone(e.target.value);
                        stopRingtoneSound();
                        localStorage.setItem("temp_playing", "false");
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="classic">Klasik Telefon Melodisi</option>
                      <option value="digital">Dijital Zil Sesi</option>
                      <option value="melody">Yumuşak Melodi</option>
                      <option value="futuristic">Gelecekçi Uyarı Sesi</option>
                      <option value="marimba">Klasik Akıllı Telefon (Marimba)</option>
                      <option value="vintage">Eski Tip Mekanik Zil</option>
                      <option value="echo">Yankılı Bildirim Sesi</option>
                      <option value="organ">Sıcak Akortlu Melodi</option>
                    </select>

                    <button
                      onClick={() => {
                        const isPlaying = localStorage.getItem("temp_playing") === "true";
                        if (isPlaying) {
                          stopRingtoneSound();
                          localStorage.setItem("temp_playing", "false");
                        } else {
                          playRingtoneSound(agentRingtone, selectedRingtoneSpeaker);
                          localStorage.setItem("temp_playing", "true");
                        }
                        // Force update
                        setSettingsModalOpen(false);
                        setSettingsModalOpen(true);
                      }}
                      className="px-4 bg-slate-105 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all"
                    >
                      {localStorage.getItem("temp_playing") === "true" ? (
                        <>
                          <Square size={12} className="text-rose-500 fill-rose-500 animate-pulse" />
                          <span>Durdur</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} className="text-emerald-500 fill-emerald-500" />
                          <span>Dinle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Microphone Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">Ses Giriş Aygıtı (Mikrofon)</label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  >
                    {audioDevices.inputs.length === 0 ? (
                      <option value="">Aygıt bulunamadı veya izin verilmedi</option>
                    ) : (
                      audioDevices.inputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Mikrofon (${d.deviceId.slice(0, 5)})`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Speaker Selection (Call output) */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">Konuşma Çıkış Aygıtı (Kulaklık)</label>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  >
                    {audioDevices.outputs.length === 0 ? (
                      <option value="">Aygıt bulunamadı / Desteklenmiyor</option>
                    ) : (
                      audioDevices.outputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Kulaklık/Hoparlör (${d.deviceId.slice(0, 5)})`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Ringtone Speaker Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">Zil Sesi Çıkış Aygıtı (Hoparlör)</label>
                  <select
                    value={selectedRingtoneSpeaker}
                    onChange={(e) => {
                      setSelectedRingtoneSpeaker(e.target.value);
                      if (localStorage.getItem("temp_playing") === "true") {
                        stopRingtoneSound();
                        localStorage.setItem("temp_playing", "false");
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  >
                    {audioDevices.outputs.length === 0 ? (
                      <option value="">Aygıt bulunamadı / Desteklenmiyor</option>
                    ) : (
                      audioDevices.outputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Hoparlör (${d.deviceId.slice(0, 5)})`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="p-4 bg-violet-50/40 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone size={15} className="text-violet-500" />
                      <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Akıllı Mobil Aktarım (AI GSM)</span>
                    </div>
                    {hasMobileTransferPermission ? (
                      <button
                        type="button"
                        onClick={() => setMobileTransferEnabled(!mobileTransferEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                          mobileTransferEnabled ? "bg-violet-500 justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    ) : (
                      <span className="text-[8px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-lg">Yetkisiz</span>
                    )}
                  </div>
                  
                  {hasMobileTransferPermission ? (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-550 uppercase tracking-widest block">GSM Numarası</label>
                      <input
                        type="tel"
                        placeholder="Örn: +905553332211"
                        value={gsmNumber}
                        onChange={(e) => setGsmNumber(e.target.value)}
                        disabled={!mobileTransferEnabled}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
                        WebPhone kapalıyken mesai saatlerinde gelen çağrılar bu numaraya aktarılır ve yapay zeka size çağrı özetini fısıldar.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[8.5px] text-slate-400 dark:text-slate-500 font-medium italic">
                      Mobil yönlendirme özelliğini yönetmek için "mobile_transfer:write" yetkisine sahip olmalısınız.
                    </p>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    stopRingtoneSound();
                    localStorage.setItem("temp_playing", "false");
                    setSettingsModalOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-455 transition-all uppercase tracking-wider"
                >
                  Vazgeç
                </button>
                <button
                  onClick={async () => {
                    stopRingtoneSound();
                    localStorage.setItem("temp_playing", "false");
                    localStorage.setItem("agent_avatar", agentAvatar);
                    localStorage.setItem("ringtone", agentRingtone);
                    localStorage.setItem("selected_mic", selectedMic);
                    localStorage.setItem("selected_speaker", selectedSpeaker);
                    localStorage.setItem("selected_ringtone_speaker", selectedRingtoneSpeaker);
                    
                    if (currentUser) {
                      try {
                        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                        const res = await fetch(`${protocol}//${backendHost}/api/agent/profile/${currentUser.id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            avatar: agentAvatar,
                            gsm_number: gsmNumber,
                            mobile_transfer_enabled: mobileTransferEnabled
                          })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCurrentUser(data.user);
                        }
                      } catch (err) {
                        console.error("Failed to save profile on backend:", err);
                      }
                    }
                    
                    setSettingsModalOpen(false);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 text-xs font-extrabold text-white transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Check size={12} />
                  <span>Ayarları Kaydet</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Floating Unified Representative Call & Chat Console Widget */}
        <CallChatWidget 
          agentExtension="200" 
          password="temsilci_sifre_321" 
          asteriskWssUrl="wss://localhost:8089/ws"
          onActiveCall={(callId) => setActiveCallId(callId)}
          backendHost={backendHost}
        />
      </main>
    </div>
  );
}
