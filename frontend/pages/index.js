import React, { useState, useEffect } from "react";
import Head from "next/head";
import { 
  Bot, 
  Database, 
  MessageSquare, 
  Phone, 
  Clock,
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
  CheckCircle,
  PhoneCall,
  GitBranch,
  BookOpen,
  ShieldAlert,
  ChevronDown,
  User,
  Cable,
  Award,
  ClipboardList,
  Users,
  PhoneOff,
  Cpu,
  Shuffle,
  PhoneForwarded,
  Frown,
  ShieldCheck,
  AlertTriangle,
  Eye,
  MicOff,
  Crown,
  ToggleRight,
  ToggleLeft
} from "lucide-react";
import { getSafeThemeColor } from "../utils/theme";
import { playRingtoneSound, stopRingtoneSound } from "../utils/audioHelper";
import { useTheme, setThemeColor } from "../utils/theme";

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
import AgentPanel from "../components/callcenter/AgentPanel";
import WallboardPanel from "../components/dashboard/WallboardPanel";
import DialerSettings from "../components/settings/DialerSettings";
import CallFlowEditor from "../components/settings/CallFlowEditor";
import AIAgentsSettings from "../components/settings/AIAgentsSettings";
import ChangelogPanel from "../components/settings/ChangelogPanel";
import OmnichannelPanel from "../components/dashboard/OmnichannelPanel";
import ContactsPanel from "../components/dashboard/ContactsPanel";
import BlacklistSettings from "../components/settings/BlacklistSettings";
import UserSettings from "../components/settings/UserSettings";
import PBXSettings from "../components/settings/PBXSettings";
import AnnouncementsPanel from "../components/settings/AnnouncementsPanel";
import AcdQueuesPanel from "../components/settings/AcdQueuesPanel";
import AutoprovisionPanel from "../components/settings/AutoprovisionPanel";
import OutboundRulesPanel from "../components/settings/OutboundRulesPanel";
import InboundRulesPanel from "../components/settings/InboundRulesPanel";
import CallPickupGroupsPanel from "../components/settings/CallPickupGroupsPanel";
import SpeedDialsPanel from "../components/settings/SpeedDialsPanel";
import ConferencesPanel from "../components/settings/ConferencesPanel";
import EventLogsPanel from "../components/settings/EventLogsPanel";

export default function Home() {
  const { theme, colorCode, bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, call-center, pbx-settings, channel-settings, rag-kb, rule-editor
  const [isEditingCallFlow, setIsEditingCallFlow] = useState(false);
  const [activeCallId, setActiveCallId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasOmnichannelPermission, setHasOmnichannelPermission] = useState(false);
  const [hasContactsPermission, setHasContactsPermission] = useState(false);
  const [hasBlacklistPermission, setHasBlacklistPermission] = useState(false);
  const [hasMobileTransferPermission, setHasMobileTransferPermission] = useState(false);
  const [hasReportsPermission, setHasReportsPermission] = useState(false);
  const [hasUsersPermission, setHasUsersPermission] = useState(false);
  const [hasAnnouncementsPermission, setHasAnnouncementsPermission] = useState(false);
  const [hasQueuesPermission, setHasQueuesPermission] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [gsmNumber, setGsmNumber] = useState("");
  const [mobileTransferEnabled, setMobileTransferEnabled] = useState(false);
  const [tempThemeColor, setTempThemeColor] = useState("99, 102, 241");
  const [activeModalTab, setActiveModalTab] = useState("profile");
  const [openCategories, setOpenCategories] = useState({
    operations: true,
    ai: true,
    pbxGroup: true,
    routing: true,
    reportsGroup: true,
    system: true
  });

  const renderPlaceholderReport = (title, description, IconComponent) => {
    return (
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center gap-6 min-h-[450px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
        <div className="h-16 w-16 bg-purple-50 dark:bg-purple-950/30 text-primary dark:text-purple-400 rounded-3xl flex items-center justify-center shadow-inner hover:scale-110 transition duration-300">
          <IconComponent size={32} />
        </div>
        <div className="flex flex-col gap-2 max-w-lg">
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>
          <p className="text-[10px] text-primary font-extrabold uppercase tracking-widest">Çok Yakında</p>
          <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed font-semibold mt-2">{description}</p>
        </div>
        <div className="w-24 h-1 bg-gradient-to-r from-purple-500/20 via-purple-500 to-purple-500/20 rounded-full" />
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
          Bu rapor modülü için altyapı ve yapay zeka analiz şablonları hazırlanmaktadır.
        </p>
      </div>
    );
  };

  const renderPlaceholderSantral = (title, description, IconComponent) => {
    return (
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center gap-6 min-h-[450px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
        <div className="h-16 w-16 bg-rose-50 dark:bg-rose-955/30 text-primary dark:text-rose-400 rounded-3xl flex items-center justify-center shadow-inner hover:scale-110 transition duration-300">
          <IconComponent size={32} />
        </div>
        <div className="flex flex-col gap-2 max-w-lg">
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>
          <p className="text-[10px] text-primary font-extrabold uppercase tracking-widest">Çok Yakında</p>
          <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed font-semibold mt-2">{description}</p>
        </div>
        <div className="w-24 h-1 bg-gradient-to-r from-rose-500/20 via-rose-500 to-rose-500/20 rounded-full" />
        <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
          Bu santral modülü için yönetim şablonları hazırlanmaktadır.
        </p>
      </div>
    );
  };

  useEffect(() => {
    const savedCategories = localStorage.getItem("sidebarCategories");
    if (savedCategories) {
      try {
        setOpenCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error("Failed to parse sidebarCategories from localStorage", e);
      }
    }
  }, []);

  const toggleCategory = (cat) => {
    setOpenCategories((prev) => {
      const nextState = {
        ...prev,
        [cat]: !prev[cat]
      };
      localStorage.setItem("sidebarCategories", JSON.stringify(nextState));
      return nextState;
    });
  };

  // Profile and ringtone preferences states
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);
  const [agentAvatar, setAgentAvatar] = useState("https://api.dicebear.com/7.x/avataaars/svg?seed=Felix");
  
  const [fwdAlwaysActive, setFwdAlwaysActive] = useState(false);
  const [fwdAlwaysType, setFwdAlwaysType] = useState("internal");
  const [fwdAlwaysTarget, setFwdAlwaysTarget] = useState("");

  const [fwdBusyActive, setFwdBusyActive] = useState(false);
  const [fwdBusyType, setFwdBusyType] = useState("internal");
  const [fwdBusyTarget, setFwdBusyTarget] = useState("");

  const [fwdNoAnswerActive, setFwdNoAnswerActive] = useState(false);
  const [fwdNoAnswerType, setFwdNoAnswerType] = useState("internal");
  const [fwdNoAnswerTarget, setFwdNoAnswerTarget] = useState("");
  const [fwdNoAnswerTimeout, setFwdNoAnswerTimeout] = useState(30);
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
      setTempThemeColor(getSafeThemeColor(currentUser.theme_color));
      
      setFwdAlwaysActive(currentUser.forwarding_always?.active || false);
      setFwdAlwaysType(currentUser.forwarding_always?.type || "internal");
      setFwdAlwaysTarget(currentUser.forwarding_always?.target || "");

      setFwdBusyActive(currentUser.forwarding_busy?.active || false);
      setFwdBusyType(currentUser.forwarding_busy?.type || "internal");
      setFwdBusyTarget(currentUser.forwarding_busy?.target || "");

      setFwdNoAnswerActive(currentUser.forwarding_no_answer?.active || false);
      setFwdNoAnswerType(currentUser.forwarding_no_answer?.type || "internal");
      setFwdNoAnswerTarget(currentUser.forwarding_no_answer?.target || "");
      setFwdNoAnswerTimeout(currentUser.forwarding_no_answer?.timeout || 30);
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
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        const usersData = await resUsers.json();
        if (usersData) setSystemUsers(usersData);

        let currentUserData = null;
        if (statusData.is_logged_in && statusData.user_id) {
          currentUserData = usersData.find(u => u.id === statusData.user_id);
        }

        if (!currentUserData) {
          const savedUserId = localStorage.getItem('current_user_id');
          if (savedUserId) {
            currentUserData = usersData.find(u => u.id === parseInt(savedUserId) || u.extension === savedUserId);
          }
        }

        if (!currentUserData && usersData && usersData.length > 0) {
          currentUserData = usersData[0]; // Default to first user if none found
        }

        if (!statusData.is_logged_in || !currentUserData) {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          setHasReportsPermission(true);
          setHasUsersPermission(true);
          setHasAnnouncementsPermission(true);
          setHasQueuesPermission(true);
        }

        if (currentUserData) {
          setCurrentUser(currentUserData);
          localStorage.setItem('current_user_id', currentUserData.extension || currentUserData.id);
          if (currentUserData.avatar) {
            setAgentAvatar(currentUserData.avatar);
          }
        }

        if (currentUserData.theme_color) {
          const safeColor = getSafeThemeColor(currentUserData.theme_color);
          document.documentElement.style.setProperty("--color-primary", safeColor);
          localStorage.setItem("theme_primary_color", safeColor);
        }
        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUserData.role);
        if (!currentRole) {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          setHasReportsPermission(true);
          setHasUsersPermission(true);
          setHasAnnouncementsPermission(true);
          setHasQueuesPermission(true);
          return;
        }
        setHasOmnichannelPermission(currentRole.permissions.includes("omnichannel:access"));
        setHasContactsPermission(currentRole.permissions.includes("contacts:read"));
        setHasBlacklistPermission(currentRole.permissions.includes("blacklist:read"));
        setHasMobileTransferPermission(currentRole.permissions.includes("mobile_transfer:write"));
        setHasReportsPermission(currentRole.permissions.includes("reports:access"));
        setHasUsersPermission(currentRole.permissions.includes("users:read"));
        setHasAnnouncementsPermission(currentRole.permissions.includes("announcements:read"));
        setHasQueuesPermission(currentRole.permissions.includes("acd_queues:read"));
      } catch (err) {
        console.error("Permission check error:", err);
        setHasOmnichannelPermission(true);
        setHasContactsPermission(true);
        setHasBlacklistPermission(true);
        setHasMobileTransferPermission(true);
        setHasReportsPermission(true);
        setHasUsersPermission(true);
        setHasAnnouncementsPermission(true);
        setHasQueuesPermission(true);
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

  const renderForwardingRow = (label, active, setActive, type, setType, target, setTarget, timeout, setTimeoutVal) => (
    <div className={`grid grid-cols-12 gap-3 items-end p-3 rounded-xl border transition-all ${active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 opacity-70'}`}>
        <div className="col-span-12 flex items-center justify-between mb-1 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <label className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{label}</label>
            <button type="button" onClick={() => setActive(!active)} className="text-slate-400 hover:text-slate-700 transition-colors focus:outline-none">
                {active ? <ToggleRight size={24} className="text-violet-500" /> : <ToggleLeft size={24} />}
            </button>
        </div>
        <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Tip</label>
            <select
                disabled={!active}
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
            >
                <option value="internal">Dahili Hat</option>
                <option value="external">Dış Numara</option>
            </select>
        </div>
        <div className="col-span-12 sm:col-span-6">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Hedef</label>
            {type === "internal" ? (
                <select
                    disabled={!active}
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                >
                    <option value="">Seçiniz...</option>
                    {systemUsers.map(u => <option key={u.id} value={u.extension}>{u.full_name} ({u.extension})</option>)}
                </select>
            ) : (
                <input
                    disabled={!active}
                    type="text"
                    placeholder="Numara giriniz"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                />
            )}
        </div>
        {setTimeoutVal && (
            <div className="col-span-12 sm:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Süre (sn)</label>
                <input
                    disabled={!active}
                    type="number"
                    min="1"
                    value={timeout}
                    onChange={e => setTimeoutVal(parseInt(e.target.value) || 30)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                />
            </div>
        )}
    </div>
  );

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
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Monitor size={16} className={activeTab === "wallboard" ? "text-primary" : ""} />
                <span>Canlı İzleme Paneli</span>
              </button>

              <button
                onClick={() => setActiveTab("call-center")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-center"
                    ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Phone size={16} className={activeTab === "call-center" ? "text-primary" : ""} />
                <span>Temsilci Çağrı Paneli</span>
              </button>

              {hasOmnichannelPermission && (
                <button
                  onClick={() => setActiveTab("omnichannel")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "omnichannel"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <MessageSquare size={16} className={activeTab === "omnichannel" ? "text-primary" : ""} />
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
                <Bot size={16} className={activeTab === "ai-agents" ? "text-primary" : ""} />
                <span>AI Temsilcileri</span>
              </button>

              <button
                onClick={() => setActiveTab("rag-kb")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "rag-kb"
                    ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Database size={16} className={activeTab === "rag-kb" ? "text-primary" : ""} />
                <span>Bilgi Bankası (RAG)</span>
              </button>

              <button
                onClick={() => setActiveTab("rule-editor")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "rule-editor"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sliders size={16} className={activeTab === "rule-editor" ? "text-primary" : ""} />
                <span>Kural & Senaryo Editörü</span>
              </button>
            </div>
          </div>

          {/* Group 2.5: Santral */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => toggleCategory("pbxGroup")}
              className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer"
            >
              <span>Santral</span>
              <ChevronDown
                size={12}
                className={`transform transition-transform duration-200 ${
                  openCategories.pbxGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                openCategories.pbxGroup ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {hasUsersPermission && (
                <button
                  onClick={() => setActiveTab("users")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "users"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <User size={16} className={activeTab === "users" ? "text-primary" : ""} />
                  <span>Kullanıcılar</span>
                </button>
              )}

              {hasAnnouncementsPermission && (
                <button
                  onClick={() => setActiveTab("announcements")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "announcements"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Volume2 size={16} className={activeTab === "announcements" ? "text-primary" : ""} />
                  <span>Anons Yönetimi</span>
                </button>
              )}

              {hasQueuesPermission && (
                <button
                  onClick={() => setActiveTab("acd-queues")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "acd-queues"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={activeTab === "acd-queues" ? "text-primary" : ""} />
                  <span>ACD Kuyruk</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("auto-provision")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "auto-provision"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Cpu size={16} className={activeTab === "auto-provision" ? "text-primary" : ""} />
                <span>Oto Provizyon</span>
              </button>

              <button
                onClick={() => setActiveTab("outbound-rules")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "outbound-rules"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneCall size={16} className={activeTab === "outbound-rules" ? "text-primary" : ""} />
                <span>Giden Arama Kuralı</span>
              </button>

              <button
                onClick={() => setActiveTab("inbound-rules")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "inbound-rules"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Phone size={16} className={activeTab === "inbound-rules" ? "text-primary" : ""} />
                <span>Gelen Arama Kuralı</span>
              </button>

              <button
                onClick={() => setActiveTab("call-pickup-groups")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-pickup-groups"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Users size={16} className={activeTab === "call-pickup-groups" ? "text-primary" : ""} />
                <span>Çağrı Toplama Grubu</span>
              </button>

              {hasContactsPermission && (
                <button
                  onClick={() => setActiveTab("contacts")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "contacts"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <BookOpen size={16} className={activeTab === "contacts" ? "text-primary" : ""} />
                  <span>Rehber</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("trunks")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "trunks"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Cable size={16} className={activeTab === "trunks" ? "text-primary" : ""} />
                <span>Dış Hat Tanımı</span>
              </button>

              <button
                onClick={() => setActiveTab("conferences")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "conferences"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Users size={16} className={activeTab === "conferences" ? "text-primary" : ""} />
                <span>Konferans</span>
              </button>

              <button
                onClick={() => setActiveTab("speed-dial")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "speed-dial"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneCall size={16} className={activeTab === "speed-dial" ? "text-primary" : ""} />
                <span>Hızlı Arama</span>
              </button>

              {hasBlacklistPermission && (
                <button
                  onClick={() => setActiveTab("blacklist")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "blacklist"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <ShieldAlert size={16} className={activeTab === "blacklist" ? "text-primary" : ""} />
                  <span>Numara Engelleme</span>
                </button>
              )}
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
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <GitBranch size={16} className={activeTab === "call-flow" ? "text-primary" : ""} />
                <span>Arama Akış Yönetimi</span>
              </button>

              <button
                onClick={() => setActiveTab("dialer")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "dialer"
                    ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneCall size={16} className={activeTab === "dialer" ? "text-primary" : ""} />
                <span>Dış Arama (Dialer)</span>
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "calendar"
                    ? "bg-amber-50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/80 dark:border-amber-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Calendar size={16} className={activeTab === "calendar" ? "text-primary" : ""} />
                <span>Randevu Takvimi</span>
              </button>
            </div>
          </div>

          {/* Group 4: Çağrı Raporları & Analiz */}
          {hasReportsPermission && (
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
              className={`space-y-1 overflow-y-auto transition-all duration-300 scrollbar-thin pr-1.5 ${
                openCategories.reportsGroup ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("reports-pano")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-pano"
                    ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Monitor size={16} className={activeTab === "reports-pano" ? "text-primary" : ""} />
                <span>Pano</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-cdr")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-cdr"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <FileText size={16} className={activeTab === "reports-cdr" ? "text-primary" : ""} />
                <span>CDR</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-audio")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-audio"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Volume2 size={16} className={activeTab === "reports-audio" ? "text-primary" : ""} />
                <span>Ses Kayıtları</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-transcripts")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transcripts"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare size={16} className={activeTab === "reports-transcripts" ? "text-primary" : ""} />
                <span>Çağrı Transkripti</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-sentiment")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sparkles size={16} className={activeTab === "reports-sentiment" ? "text-primary" : ""} />
                <span>Duygu Analizi</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-qa")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-qa"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Award size={16} className={activeTab === "reports-qa" ? "text-primary" : ""} />
                <span>Kalite Değerlendirmeleri</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-notes")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-notes"
                    ? "bg-emerald-50 dark:bg-emerald-955/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ClipboardList size={16} className={activeTab === "reports-notes" ? "text-primary" : ""} />
                <span>Temsilci Notları</span>
              </button>

              {/* Temsilci Performans ve KPI Raporu */}
              <button
                onClick={() => setActiveTab("reports-perf")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-perf"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Award size={16} className={activeTab === "reports-perf" ? "text-primary" : ""} />
                <span>Temsilci Performans & KPI</span>
              </button>

              {/* Kuyruk / Bekleme Analitiği */}
              <button
                onClick={() => setActiveTab("reports-queue")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-queue"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Users size={16} className={activeTab === "reports-queue" ? "text-primary" : ""} />
                <span>Kuyruk / Bekleme Analitiği</span>
              </button>

              {/* Duygu Durumu Isı Haritası */}
              <button
                onClick={() => setActiveTab("reports-sentiment-heat")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment-heat"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Activity size={16} className={activeTab === "reports-sentiment-heat" ? "text-primary" : ""} />
                <span>Duygu Durumu Isı Haritası</span>
              </button>

              {/* Kelime Bulutu ve Konu Trendleri */}
              <button
                onClick={() => setActiveTab("reports-wordcloud")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-wordcloud"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare size={16} className={activeTab === "reports-wordcloud" ? "text-primary" : ""} />
                <span>Kelime Bulutu & Trendler</span>
              </button>

              {/* FCR */}
              <button
                onClick={() => setActiveTab("reports-fcr")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-fcr"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <CheckCircle size={16} className={activeTab === "reports-fcr" ? "text-primary" : ""} />
                <span>İlk Aramada Çözüm (FCR)</span>
              </button>

              {/* AI vs. İnsan Karşılaştırmalı ROI Paneli */}
              <button
                onClick={() => setActiveTab("reports-roi")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-roi"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <TrendingUp size={16} className={activeTab === "reports-roi" ? "text-primary" : ""} />
                <span>AI vs. İnsan ROI Paneli</span>
              </button>

              {/* Kaçan Çağrı Analizi */}
              <button
                onClick={() => setActiveTab("reports-missed")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-missed"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneOff size={16} className={activeTab === "reports-missed" ? "text-primary" : ""} />
                <span>Kaçan Çağrı Analizi</span>
              </button>

              {/* Agent Status Timeline */}
              <button
                onClick={() => setActiveTab("reports-agent-status-timeline")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-agent-status-timeline"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Clock size={16} className={activeTab === "reports-agent-status-timeline" ? "text-primary" : ""} />
                <span>Temsilci Kronolojisi</span>
              </button>

              {/* Hourly/Daily Traffic Load */}
              <button
                onClick={() => setActiveTab("reports-traffic-load")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-traffic-load"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Calendar size={16} className={activeTab === "reports-traffic-load" ? "text-primary" : ""} />
                <span>Yoğunluk Raporu</span>
              </button>

              {/* Trunk Utilization */}
              <button
                onClick={() => setActiveTab("reports-trunk")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-trunk"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Cpu size={16} className={activeTab === "reports-trunk" ? "text-primary" : ""} />
                <span>Trunk Utilization</span>
              </button>

              {/* IVR Drop-Off */}
              <button
                onClick={() => setActiveTab("reports-ivr-drop")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ivr-drop"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Shuffle size={16} className={activeTab === "reports-ivr-drop" ? "text-primary" : ""} />
                <span>IVR Terk Oranı</span>
              </button>

              {/* Transfer & Hold Analytics */}
              <button
                onClick={() => setActiveTab("reports-transfer-hold")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transfer-hold"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneForwarded size={16} className={activeTab === "reports-transfer-hold" ? "text-primary" : ""} />
                <span>Aktarma & Bekletme Raporu</span>
              </button>

              {/* AI vs. Human A/B Testing */}
              <button
                onClick={() => setActiveTab("reports-ab-testing")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ab-testing"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Layers size={16} className={activeTab === "reports-ab-testing" ? "text-primary" : ""} />
                <span>Verimlilik Karşılaştırması</span>
              </button>

              {/* Customer Frustration / Friction Points */}
              <button
                onClick={() => setActiveTab("reports-friction")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-friction"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Frown size={16} className={activeTab === "reports-friction" ? "text-primary" : ""} />
                <span>Müşteri Çile Noktaları</span>
              </button>

              {/* Agent Compliance & Script Adherence */}
              <button
                onClick={() => setActiveTab("reports-compliance")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-compliance"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ShieldCheck size={16} className={activeTab === "reports-compliance" ? "text-primary" : ""} />
                <span>Senaryo Sadakati Raporu</span>
              </button>

              {/* Predictive Churn & Dissatisfaction Alert */}
              <button
                onClick={() => setActiveTab("reports-churn")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-churn"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <AlertTriangle size={16} className={activeTab === "reports-churn" ? "text-primary" : ""} />
                <span>Abonelik İptal Riski</span>
              </button>

              {/* Competitor Mention Tracker */}
              <button
                onClick={() => setActiveTab("reports-competitor")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-competitor"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Eye size={16} className={activeTab === "reports-competitor" ? "text-primary" : ""} />
                <span>Rakip Analiz Raporu</span>
              </button>

              {/* Silence & Interruption Analytics */}
              <button
                onClick={() => setActiveTab("reports-silence")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-silence"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MicOff size={16} className={activeTab === "reports-silence" ? "text-primary" : ""} />
                <span>Sessizlik & Söz Kesme</span>
              </button>

              {/* Executive Summary Generator */}
              <button
                onClick={() => setActiveTab("reports-ceo-summary")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ceo-summary"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Crown size={16} className={activeTab === "reports-ceo-summary" ? "text-primary" : ""} />
                <span>CEO Özet Raporu</span>
              </button>
            </div>
          </div>
          )}

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
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Settings size={16} className={activeTab === "settings" ? "text-primary" : ""} />
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

              <button
                onClick={() => setActiveTab("event-logs")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "event-logs"
                    ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <FileText size={16} className={activeTab === "event-logs" ? "text-primary" : ""} />
                <span>Olay Günlükleri</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Footer info */} 
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-[10px] text-slate-500 dark:text-slate-400 space-y-2 transition-colors duration-300">
          <p className="flex items-center gap-1.5 text-primary dark:text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-emerald-400 animate-pulse"></span>
            Sistem Çevrimiçi
          </p>
          <button
            onClick={() => setActiveTab("changelog")}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 hover:underline transition cursor-pointer bg-transparent border-0 p-0 outline-none"
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
        <header className="relative z-40 h-16 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-8 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md transition-colors duration-300">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs tracking-wider">AKTİF İŞLEMLER</span>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            {activeCallId ? (
              <span className="flex items-center gap-1.5 text-xs text-primary dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-amber-400 animate-ping"></span>
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
              {isDarkMode ? <Sun size={14} className="text-amber-450" /> : <Moon size={14} className="text-primary" />}
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
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2"
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
        <div className={`flex-1 overflow-y-auto flex ${isEditingCallFlow ? "p-0 justify-center w-full h-full bg-white dark:bg-slate-950" : ["wallboard", "settings", "rag-kb", "rule-editor", "calendar", "system-status", "dialer", "call-flow", "ai-agents", "changelog", "reports-pano", "reports-cdr", "reports-audio", "reports-transcripts", "reports-sentiment", "reports-qa", "reports-notes", "reports-perf", "reports-queue", "reports-sentiment-heat", "reports-wordcloud", "reports-fcr", "reports-roi", "reports-missed", "reports-agent-status-timeline", "reports-traffic-load", "reports-trunk", "reports-ivr-drop", "reports-transfer-hold", "reports-ab-testing", "reports-friction", "reports-compliance", "reports-churn", "reports-competitor", "reports-silence", "reports-ceo-summary", "users", "trunks", "blacklist", "announcements", "acd-queues", "auto-provision", "outbound-rules", "inbound-rules", "call-pickup-groups", "conferences", "speed-dial", "event-logs", "call-center"].includes(activeTab) ? "p-8 justify-start items-start w-full" : "p-8 justify-center"}`}>
          {activeTab === "call-center" && (
            <AgentPanel 
              backendHost={backendHost} 
              currentUser={currentUser} 
              activeCallId={activeCallId} 
            />
          )}

          {activeTab === "settings" && (
            <SettingsPanel backendHost={backendHost} />
          )}

          {activeTab === "users" && (
            <UserSettings backendHost={backendHost} />
          )}

          {activeTab === "trunks" && (
            <PBXSettings viewMode="trunks" backendHost={backendHost} />
          )}

          {activeTab === "blacklist" && (
            <BlacklistSettings backendHost={backendHost} />
          )}

          {activeTab === "announcements" && (
            <AnnouncementsPanel backendHost={backendHost} />
          )}

          {activeTab === "acd-queues" && (
            <AcdQueuesPanel backendHost={backendHost} />
          )}

          {activeTab === "auto-provision" && (
            <AutoprovisionPanel backendHost={backendHost} />
          )}

          {activeTab === "outbound-rules" && (
            <OutboundRulesPanel backendHost={backendHost} />
          )}

          {activeTab === "inbound-rules" && (
            <InboundRulesPanel backendHost={backendHost} />
          )}

          {activeTab === "call-pickup-groups" && (
            <CallPickupGroupsPanel backendHost={backendHost} />
          )}

          {activeTab === "conferences" && (
            <ConferencesPanel backendHost={backendHost} />
          )}

          {activeTab === "speed-dial" && (
            <SpeedDialsPanel backendHost={backendHost} />
          )}

          {activeTab === "event-logs" && (
            <EventLogsPanel backendHost={backendHost} />
          )}

          {activeTab === "rag-kb" && (
            <KnowledgeBase backendHost={backendHost} />
          )}

          {activeTab === "rule-editor" && (
            <RuleEditor backendHost={backendHost} />
          )}

          {activeTab === "reports-pano" && (
            <ReportsPanel backendHost={backendHost} viewMode="pano" />
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

          {activeTab === "reports-notes" && (
            <ReportsPanel backendHost={backendHost} viewMode="notes" />
          )}

          {activeTab === "reports-perf" && (
            renderPlaceholderReport("Temsilci Performans ve KPI Raporu", "Temsilcilerin günlük/haftalık performans metrikleri, ortalama çağrı süreleri ve KPI hedeflerine ulaşma yüzdelerini içeren detaylı analiz paneli.", Award)
          )}

          {activeTab === "reports-queue" && (
            renderPlaceholderReport("Kuyruk / Bekleme Analitiği Raporu", "Kuyrukta bekleme süreleri, kuyruk doluluk oranları ve bekleme esnasındaki müşteri davranış analizleri.", Users)
          )}

          {activeTab === "reports-sentiment-heat" && (
            renderPlaceholderReport("Duygu Durumu Isı Haritası", "Çağrı bazlı müşteri duygu değişimlerinin gün içi saatlere ve günlere göre dağılımını gösteren ısı haritası grafikleri.", Activity)
          )}

          {activeTab === "reports-wordcloud" && (
            renderPlaceholderReport("Kelime Bulutu ve Konu Trendleri", "Görüşmelerde en sık geçen anahtar kelimeler ve konu başlıklarının dönemsel trend analizleri.", MessageSquare)
          )}

          {activeTab === "reports-fcr" && (
            renderPlaceholderReport("İlk Aramada Çözüm (FCR) Raporu", "Müşteri sorunlarının ilk temasta çözülme oranları ve FCR performansını etkileyen faktörlerin analizi.", Check)
          )}

          {activeTab === "reports-roi" && (
            renderPlaceholderReport("AI vs. İnsan Karşılaştırmalı ROI Paneli", "Yapay zeka asistanları ile insan müşteri temsilcilerinin maliyet ve verimlilik karşılaştırmasını gösteren ROI analizleri.", TrendingUp)
          )}

          {activeTab === "reports-missed" && (
            renderPlaceholderReport("Kaçan Çağrı Analizi", "Cevapsız kalan veya kuyrukta terk edilen çağrıların zaman dağılımları ve geri dönüş performans raporları.", PhoneOff)
          )}

          {activeTab === "reports-agent-status-timeline" && (
            renderPlaceholderReport("Agent Status Timeline (Temsilci Kronolojisi)", "Müşteri temsilcilerinin gün içindeki durum (aktif, mola, meşgul) değişimlerinin zaman çizelgesi formatında takibi.", Clock)
          )}

          {activeTab === "reports-traffic-load" && (
            renderPlaceholderReport("Hourly/Daily Traffic Load (Yoğunluk Raporu)", "Çağrı trafiğinin saatlik, günlük ve haftalık periyotlardaki yoğunluk dağılımları ve kapasite planlama önerileri.", Calendar)
          )}

          {activeTab === "reports-trunk" && (
            renderPlaceholderReport("Trunk Utilization Raporu", "SIP Trunk hatlarının doluluk ve eşzamanlı çağrı kapasitesi kullanım oranlarının analizi.", Cpu)
          )}

          {activeTab === "reports-ivr-drop" && (
            renderPlaceholderReport("IVR Drop-Off (IVR Terk Oranı) Raporu", "Müşterilerin IVR menüsünde hangi adımlarda çağrıyı sonlandırdığını gösteren terk analiz paneli.", Shuffle)
          )}

          {activeTab === "reports-transfer-hold" && (
            renderPlaceholderReport("Transfer & Hold Analytics (Aktarma ve Bekletme Raporu)", "Çağrı aktarma sıklığı, bekletme süreleri ve bu sürelerin müşteri memnuniyetine etkileri.", PhoneForwarded)
          )}

          {activeTab === "reports-ab-testing" && (
            renderPlaceholderReport("AI vs. Human A/B Testing (Verimlilik Karşılaştırması)", "Farklı arama senaryolarında yapay zeka ile insan performansının kontrollü A/B test karşılaştırma metrikleri.", Layers)
          )}

          {activeTab === "reports-friction" && (
            renderPlaceholderReport("Customer Frustration / Friction Points (Müşteri Çile Noktaları)", "Müşterilerin görüşmelerde yaşadığı zorluk, tıkanıklık ve çile hissettiği aşamaların yapay zeka tespiti.", Frown)
          )}

          {activeTab === "reports-compliance" && (
            renderPlaceholderReport("Agent Compliance & Script Adherence (Sözleşme ve Senaryo Sadakati)", "Müşteri temsilcilerinin KVKK, zorunlu yasal metinler ve kurum senaryolarına bağlılık oranlarının takibi.", ShieldCheck)
          )}

          {activeTab === "reports-churn" && (
            renderPlaceholderReport("Predictive Churn & Dissatisfaction Alert (Abonelik İptal Riski)", "Hizmet iptali veya abonelikten ayrılma riski taşıyan müşterilerin çağrı analizleri üzerinden yapay zeka ile önceden tespiti.", AlertTriangle)
          )}

          {activeTab === "reports-competitor" && (
            renderPlaceholderReport("Competitor Mention Tracker (Rakip Analiz Raporu)", "Görüşmeler esnasında rakiplerin isimlerinin geçme sıklığı ve rakip marka algısı analiz paneli.", Eye)
          )}

          {activeTab === "reports-silence" && (
            renderPlaceholderReport("Silence & Interruption Analytics (Sessizlik ve Söz Kesme Raporu)", "Görüşmelerdeki karşılıklı sessizlik süreleri ile temsilci/müşteri söz kesme oranlarının analizi.", MicOff)
          )}

          {activeTab === "reports-ceo-summary" && (
            renderPlaceholderReport("Executive Summary Generator (CEO Özet Raporu)", "Tüm sistem operasyonlarının ve yapay zeka analizlerinin CEO/Yönetici seviyesi için otomatik hazırlanan yönetici özeti.", Crown)
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
            <div className="w-full max-w-xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
              
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

              {/* Modal Tabs */}
              <div className="flex gap-2 bg-slate-50 dark:bg-slate-950/40 p-1 rounded-xl mb-4">
                <button 
                  onClick={() => setActiveModalTab("profile")}
                  className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${activeModalTab === "profile" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                >
                  Profil & Tema
                </button>
                <button 
                  onClick={() => setActiveModalTab("hardware")}
                  className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${activeModalTab === "hardware" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                >
                  Donanım & Santral
                </button>
                <button 
                  onClick={() => setActiveModalTab("forwarding")}
                  className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${activeModalTab === "forwarding" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                >
                  Yönlendirme
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                
                {/* Avatar Selection */}
                <div className={`space-y-2 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
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

                {/* System Theme Color Selection */}
                <div className={`space-y-2 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
                  <label className="text-[9px] font-extrabold text-slate-455 dark:text-slate-550 uppercase tracking-widest block">Sistem Tema Rengi</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {[
                      { name: "İndigo", value: "99, 102, 241", hex: "#6366f1" },
                      { name: "Okyanus", value: "59, 130, 246", hex: "#3b82f6" },
                      { name: "Zümrüt", value: "16, 185, 129", hex: "#10b981" },
                      { name: "Gül", value: "225, 29, 72", hex: "#e11d48" },
                      { name: "Ametist", value: "168, 85, 247", hex: "#a855f7" },
                      { name: "Gece", value: "15, 23, 42", hex: "#0f172a" },
                      { name: "Güneş", value: "245, 158, 11", hex: "#f59e0b" },
                      { name: "Kızılcık", value: "220, 38, 38", hex: "#dc2626" },
                      { name: "Turkuaz", value: "6, 182, 212", hex: "#06b6d4" },
                      { name: "Deniz", value: "14, 165, 233", hex: "#0ea5e9" },
                      { name: "Lavanta", value: "139, 92, 246", hex: "#8b5cf6" },
                      { name: "Vişne", value: "190, 18, 60", hex: "#be123c" },
                      { name: "Turuncu", value: "234, 88, 12", hex: "#ea580c" },
                      { name: "Orman", value: "21, 128, 61", hex: "#15803d" },
                      { name: "Çikolata", value: "120, 53, 15", hex: "#78350f" },
                      { name: "Siyah", value: "63, 63, 70", hex: "#3f3f46" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          const safeColor = getSafeThemeColor(t.value);
                          setTempThemeColor(safeColor);
                          document.documentElement.style.setProperty("--color-primary", safeColor);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          tempThemeColor === t.value
                            ? "border-slate-800 dark:border-white ring-2 ring-slate-800/10 dark:ring-white/10"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                        title={t.name}
                      >
                        <span 
                          className="w-5 h-5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: t.hex }}
                        />
                        <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ringtone Selection */}
                <div className={`space-y-2 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
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
                          <Square size={12} className="text-primary fill-rose-500 animate-pulse" />
                          <span>Durdur</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} className="text-primary fill-emerald-500" />
                          <span>Dinle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Microphone Selection */}
                <div className={`space-y-2 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
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
                <div className={`space-y-2 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
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
                <div className={`space-y-2 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
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
                
                {/* Mobile Transfer */}
                <div className={`p-4 bg-violet-50/40 dark:bg-violet-955/10 border border-violet-105 dark:border-violet-900/30 rounded-2xl space-y-3 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
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
                      <span className="text-[8px] font-bold text-primary bg-rose-50 dark:bg-rose-955/20 px-2 py-0.5 rounded-lg">Yetkisiz</span>
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
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
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

              {/* Forwarding Selection */}
              <div className={`space-y-4 max-h-[60vh] overflow-y-auto ${activeModalTab === "forwarding" ? "block" : "hidden"}`}>
                <div className="space-y-3 pr-2">
                    {renderForwardingRow("Her Zaman (Koşulsuz)", fwdAlwaysActive, setFwdAlwaysActive, fwdAlwaysType, setFwdAlwaysType, fwdAlwaysTarget, setFwdAlwaysTarget, null, null)}
                    {renderForwardingRow("Meşgul Durumda", fwdBusyActive, setFwdBusyActive, fwdBusyType, setFwdBusyType, fwdBusyTarget, setFwdBusyTarget, null, null)}
                    {renderForwardingRow("Zaman Aşımında (Cevapsız)", fwdNoAnswerActive, setFwdNoAnswerActive, fwdNoAnswerType, setFwdNoAnswerType, fwdNoAnswerTarget, setFwdNoAnswerTarget, fwdNoAnswerTimeout, setFwdNoAnswerTimeout)}
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
                  className="flex-1 py-2 rounded-xl border dark: hover: dark:hover: font-bold dark: transition-all uppercase tracking-wider bg-slate-500 hover:bg-slate-600 text-white border-transparent"
                >Vazgeç</button>
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
                            mobile_transfer_enabled: mobileTransferEnabled,
                            theme_color: tempThemeColor,
                            forwarding_always: fwdAlwaysTarget ? { active: fwdAlwaysActive, type: fwdAlwaysType, target: fwdAlwaysTarget } : null,
                            forwarding_busy: fwdBusyTarget ? { active: fwdBusyActive, type: fwdBusyType, target: fwdBusyTarget } : null,
                            forwarding_no_answer: fwdNoAnswerTarget ? { active: fwdNoAnswerActive, type: fwdNoAnswerType, target: fwdNoAnswerTarget, timeout: fwdNoAnswerTimeout } : null
                          })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCurrentUser(data.user);
                          // Force update the UI theme color if they changed it
                          if (data.user.theme_color) {
                            const safeColor = getSafeThemeColor(data.user.theme_color);
                            document.documentElement.style.setProperty("--color-primary", safeColor);
                            localStorage.setItem("theme_primary_color", safeColor);
                          }
                        }
                      } catch (err) {
                        console.error("Failed to save profile on backend:", err);
                      }
                    }
                    
                    setSettingsModalOpen(false);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold text-white transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${bg} ${hover}`}
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
