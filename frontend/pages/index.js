import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import { 
  Bot, 
  Database, 
  MessageSquare, 
  Phone, 
  Clock,
  Key,
  Lock,
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
  Mic,
  MicOff,
  Crown,
  ToggleRight,
  ToggleLeft,
  Terminal,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  GripVertical,
  RotateCcw,
  Mail,
  Copy,
  RefreshCw,
  Hash,
  Coffee,
  Tag,
  Target,
  Repeat,
  Building2,
  Wifi,
  PhoneOutgoing,
  X
} from "lucide-react";
import { getSafeThemeColor } from "../utils/theme";
import { playRingtoneSound, stopRingtoneSound, resolveAudioDeviceId } from "../utils/audioHelper";
import {
  getSavedNoiseSuppressionMode,
  saveNoiseSuppressionMode,
  createMicLoopbackTester
} from "../utils/noiseSuppressionEngine";
import { useTheme, setThemeColor } from "../utils/theme";
import { getBackendHost } from "../utils/apiHost";
import { getTurkishSlugForTab, getTabFromTurkishSlug } from "../utils/slugHelper";
import useClickOutside from "../utils/useClickOutside";



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
import AgentPanel, { ALL_TABS as CALL_PANEL_ALL_TABS, loadCallPanelPrefs, saveCallPanelPrefs, DEFAULT_CALL_PANEL_PREFS } from "../components/callcenter/AgentPanel";
import { CallPanelAgentsAppearanceSettings } from "../components/callcenter/tabs/AgentQueuePeersTab";
import WallboardPanel, { WallboardStudioSettings } from "../components/dashboard/WallboardPanel";
import DialerSettings from "../components/settings/DialerSettings";
import CallFlowEditor from "../components/settings/CallFlowEditor";
import AIAgentsSettings from "../components/settings/AIAgentsSettings";
import ChangelogPanel from "../components/settings/ChangelogPanel";
import OmnichannelPanel from "../components/dashboard/OmnichannelPanel";
import ContactsPanel from "../components/dashboard/ContactsPanel";
import BlacklistSettings from "../components/settings/BlacklistSettings";
import UserSettings, { DEFAULT_USER_PROFILES, RING_DEVICES_METADATA, normalizeUserProfiles } from "../components/settings/UserSettings";
import PBXSettings from "../components/settings/PBXSettings";
import AnnouncementsPanel from "../components/settings/AnnouncementsPanel";
import AcdQueuesPanel from "../components/settings/AcdQueuesPanel";
import AutoprovisionPanel from "../components/settings/AutoprovisionPanel";
import OutboundRulesPanel from "../components/settings/OutboundRulesPanel";
import InboundRulesPanel from "../components/settings/InboundRulesPanel";
import CallPickupGroupsPanel from "../components/settings/CallPickupGroupsPanel";
import SubscriberGroupsPanel from "../components/settings/SubscriberGroupsPanel";
import SpeedDialsPanel from "../components/settings/SpeedDialsPanel";
import ConferencesPanel from "../components/settings/ConferencesPanel";
import EventLogsPanel from "../components/settings/EventLogsPanel";
import SecurityPanel from "../components/security/SecurityPanel";
import SipDebuggerPanel from "../components/dashboard/SipDebuggerPanel";
import Login from "../components/auth/Login";
import TenantSwitcher from "../components/TenantSwitcher";
import LicenseModal from "../components/modals/LicenseModal";
import GlobalSearchBar from "../components/common/GlobalSearchBar";
import APIBudgetSettings from "../components/settings/APIBudgetSettings";
import QueueSurveyReportPanel from "../components/reports/QueueSurveyReportPanel";
import EnterpriseReportsPanel from "../components/reports/EnterpriseReportsPanel";
import CustomReportBuilderPanel from "../components/reports/CustomReportBuilderPanel";
import ScheduledReportsPanel from "../components/settings/ScheduledReportsPanel";
import AIConfigAssistantPanel from "../components/settings/AIConfigAssistantPanel";

const SUPER_ADMIN = {
  id: 9999,
  username: "admin",
  full_name: "Sistem Yöneticisi",
  email: "admin@localhost",
  extension: "0000",
  role: "admin",
  password: "admin"
};

export default function Home() {
  const router = useRouter();
  const { theme, colorCode, bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, call-center, pbx-settings, channel-settings, rag-kb, rule-editor
  const [isAgentFullScreenMode, setIsAgentFullScreenMode] = useState(false);
  const [isAgentOnlyUser, setIsAgentOnlyUser] = useState(false);
  const [isWallboardOnlyUser, setIsWallboardOnlyUser] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState("");

  // Read URL query tab parameter on initial page mount or popstate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get("tab");
      if (tabFromUrl) {
        const resolvedTab = getTabFromTurkishSlug(tabFromUrl);
        setActiveTab(resolvedTab);
      }
    }
  }, [router.isReady]);

  // Sync activeTab state changes to browser URL query string with Turkish Slugs (?tab=...)
  useEffect(() => {
    if (typeof window !== "undefined" && isLoggedIn && activeTab) {
      const turkishSlug = getTurkishSlugForTab(activeTab);
      const currentUrlParams = new URLSearchParams(window.location.search);
      const currentTabInUrl = currentUrlParams.get("tab");
      const currentPath = window.location.pathname;
      const basePath = (currentPath === "/login" || currentPath === "/Login") ? "/" : currentPath;
      if (currentTabInUrl !== turkishSlug || currentPath === "/login" || currentPath === "/Login") {
        currentUrlParams.set("tab", turkishSlug);
        const newUrl = `${basePath}?${currentUrlParams.toString()}`;
        window.history.replaceState({ tab: turkishSlug }, "", newUrl);
      }
    }
  }, [activeTab, isLoggedIn]);

  // Ensure /login URL when user is on login screen
  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthChecking && !isLoggedIn) {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      if ((currentPath !== "/login" && currentPath !== "/Login") || currentSearch) {
        window.history.replaceState(null, "", "/login");
      }
    }
  }, [isAuthChecking, isLoggedIn]);

  // Support browser Back/Forward popstate navigation
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const tabFromUrl = urlParams.get("tab");
        if (tabFromUrl) {
          setActiveTab(getTabFromTurkishSlug(tabFromUrl));
        } else {
          setActiveTab("dashboard");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  const [isEditingCallFlow, setIsEditingCallFlow] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState("idle"); // idle, success, error
  const [applyError, setApplyError] = useState("");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

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
  const [hasAutoprovisionPermission, setHasAutoprovisionPermission] = useState(false);
  const [hasOutboundRulesPermission, setHasOutboundRulesPermission] = useState(false);
  const [hasInboundRulesPermission, setHasInboundRulesPermission] = useState(false);
  const [hasCallPickupPermission, setHasCallPickupPermission] = useState(false);
  const [hasSubscriberGroupsPermission, setHasSubscriberGroupsPermission] = useState(false);
  const [hasTrunksPermission, setHasTrunksPermission] = useState(false);
  const [hasConferencesPermission, setHasConferencesPermission] = useState(false);
  const [hasSpeedDialPermission, setHasSpeedDialPermission] = useState(false);
  const [hasScheduledReportsPermission, setHasScheduledReportsPermission] = useState(false);
  const [gsmNumber, setGsmNumber] = useState("");
  const [mobileTransferEnabled, setMobileTransferEnabled] = useState(false);
  const [tempThemeColor, setTempThemeColor] = useState("99, 102, 241");
  const [activeModalTab, setActiveModalTab] = useState("profile");
  const [agentActiveProfile, setAgentActiveProfile] = useState("available");
  const [agentProfiles, setAgentProfiles] = useState(() => normalizeUserProfiles(null));
  const [selectedAgentProfileTab, setSelectedAgentProfileTab] = useState("available");
  const [agentQueuesList, setAgentQueuesList] = useState([]);
  const [agentAiAgentsList, setAgentAiAgentsList] = useState([]);
  const [callPanelPrefs, setCallPanelPrefs] = useState(() => loadCallPanelPrefs(null));
  const [currentRolePermissions, setCurrentRolePermissions] = useState(null);
  const [draggedPanelTabIdx, setDraggedPanelTabIdx] = useState(null);
  const [openCategories, setOpenCategories] = useState({
    operations: true,
    ai: true,
    pbxGroup: true,
    routing: true,
    reportsGroup: true,
    system: true
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState(null);

  const toggleSidebarCollapse = () => {
    setSidebarTooltip(null);
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", next ? "true" : "false");
      }
      return next;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('hasPendingChanges');
    if (saved === 'true') {
      setHasPendingChanges(true);
    }
    if (localStorage.getItem("sidebar_collapsed") === "true") {
      setIsSidebarCollapsed(true);
    }

    const originalFetch = window.fetch;
    window.fetch = async function() {
      const url = arguments[0];
      let options = arguments[1] || {};
      
      if (typeof url === "string" && url.includes("/api/")) {
        const activeTenantId = localStorage.getItem("active_tenant_id") || "tenant-default";
        const currentUserId = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id") || "";
        
        const headers = new Headers(options.headers || {});
        if (!headers.has("X-Tenant-ID")) headers.set("X-Tenant-ID", activeTenantId);
        if (!headers.has("X-User-ID") && currentUserId) headers.set("X-User-ID", currentUserId);
        options.headers = headers;
        arguments[1] = options;
      }
      
      const response = await originalFetch.apply(this, arguments);
      
      if (typeof url === 'string' && url.includes('/api/settings/') && !url.includes('/api/settings/apply')) {
        if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
          if (response.ok) {
            setHasPendingChanges((prev) => {
              if (!prev) {
                localStorage.setItem('hasPendingChanges', 'true');
                return true;
              }
              return prev;
            });
          }
        }
      }
      return response;
    };

    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleApplyChanges = async () => {
    setIsApplying(true);
    setApplyStatus("idle");
    setApplyError("");
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/apply`, {
        method: "POST"
      });
      if (res.ok) {
        setApplyStatus("success");
        setTimeout(() => {
          setHasPendingChanges(false);
          setApplyStatus("idle");
          localStorage.removeItem('hasPendingChanges');
        }, 3000); // 3 saniye sonra butonu kaybet
      } else {
        const err = await res.json();
        setApplyStatus("error");
        setApplyError(err.detail || "Bilinmeyen bir hata oluştu.");
      }
    } catch (e) {
      setApplyStatus("error");
      setApplyError(e.message || "Bağlantı hatası.");
    } finally {
      setIsApplying(false);
    }
  };

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

  // Active Tenant state
  const [activeTenantId, setActiveTenantId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("active_tenant_id") || "tenant-default";
    }
    return "tenant-default";
  });

  useEffect(() => {
    const handleTenantChange = (e) => {
      const newTenantId = e.detail?.id || (typeof window !== "undefined" ? localStorage.getItem("active_tenant_id") : null) || "tenant-default";
      setActiveTenantId(newTenantId);
    };
    const handleOpenFullWebphone = () => {
      setActiveTab("call-center");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", { detail: { subTab: "webphone" } }));
      }, 30);
    };
    window.addEventListener("tenantChanged", handleTenantChange);
    window.addEventListener("OPEN_FULL_WEBPHONE", handleOpenFullWebphone);
    return () => {
      window.removeEventListener("tenantChanged", handleTenantChange);
      window.removeEventListener("OPEN_FULL_WEBPHONE", handleOpenFullWebphone);
    };
  }, []);

  // Global License Enforcement State
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  const fetchGlobalLicenseStatus = async () => {
    try {
      const backendHostUrl = getBackendHost();
      const API_BASE = `${window.location.protocol}//${backendHostUrl}`;
      const res = await fetch(`${API_BASE}/api/settings/license/status`);
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
        if (!data.valid || data.status === "passive") {
          setIsLicenseModalOpen(true);
        }
      }
    } catch (e) {
      console.error("Failed to check global license status:", e);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchGlobalLicenseStatus();
    }
  }, [isLoggedIn, activeTenantId]);

  // Global Internal Chat Delivery Receipt & Login/Live Notification Poller
  const [internalChatToast, setInternalChatToast] = useState(null);
  useEffect(() => {
    if (!isLoggedIn || !currentUser || typeof window === "undefined") {
      setInternalChatToast(null);
      return;
    }
    const uid = String(currentUser?.id || "").trim();
    const ext = String(currentUser?.extension || "").trim();
    const userKey = uid || ext;
    if (!userKey) return;

    const storageKey = `notified_int_chat_ids_${userKey}`;
    const loadNotifiedSet = () => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return new Set(parsed.map(String));
        }
      } catch (e) {}
      return new Set();
    };
    const saveNotifiedSet = (setObj) => {
      try {
        const arr = Array.from(setObj).slice(-300);
        sessionStorage.setItem(storageKey, JSON.stringify(arr));
      } catch (e) {}
    };

    let mounted = true;
    const pollInternalDeliveryAndNotify = async () => {
      try {
        const backendHostUrl = getBackendHost();
        const protocol = window.location.protocol;
        const res = await fetch(
          `${protocol}//${backendHostUrl}/api/agent/chat?extension=${encodeURIComponent(ext)}&user_id=${encodeURIComponent(uid)}&deliver=1&t=${Date.now()}`,
          { headers: { "X-User-ID": userKey } }
        );
        if (!mounted || !res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const myKeys = new Set([uid, ext].filter(Boolean));
        const unreadIncoming = data.filter((m) => {
          const s = String(m.sender_id || "").trim();
          const r = String(m.receiver_id || "").trim();
          return !myKeys.has(s) && myKeys.has(r) && !m.read_at;
        });

        if (unreadIncoming.length === 0) {
          setInternalChatToast(null);
          return;
        }

        const notifiedSet = loadNotifiedSet();
        const activeOpenPeers = new Set(
          (Array.isArray(window.__ACTIVE_VISIBLE_INTERNAL_PEERS__) && document.visibilityState === "visible"
            ? window.__ACTIVE_VISIBLE_INTERNAL_PEERS__
            : []
          ).map(String)
        );
        const freshUnnotified = unreadIncoming.filter((m) => {
          const mid = String(m.id);
          if (notifiedSet.has(mid)) return false;
          if (activeOpenPeers.has(String(m.sender_id || ""))) {
            notifiedSet.add(mid);
            return false;
          }
          return true;
        });
        saveNotifiedSet(notifiedSet);
        if (freshUnnotified.length > 0) {
          freshUnnotified.forEach((m) => notifiedSet.add(String(m.id)));
          saveNotifiedSet(notifiedSet);

          const latestMsg = freshUnnotified[freshUnnotified.length - 1];
          const senderLabel = latestMsg.sender_name || `Dahili ${latestMsg.sender_id}`;
          setInternalChatToast({
            id: latestMsg.id,
            senderId: String(latestMsg.sender_id || ""),
            senderName: senderLabel,
            text: latestMsg.text || "",
            totalUnread: unreadIncoming.length
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(`${senderLabel} - Yeni İç Mesaj`, {
                body: latestMsg.text || "Yeni bir mesajınız var."
              });
            } catch (e) {}
          }
        }
      } catch (e) {}
    };

    const handleReadSync = (e) => {
      const peerKeys = Array.isArray(e?.detail?.peerKeys) ? e.detail.peerKeys.map(String) : [];
      setInternalChatToast((prev) => {
        if (!prev) return null;
        if (peerKeys.includes(String(prev.senderId))) return null;
        return prev;
      });
    };

    window.addEventListener("INTERNAL_CHAT_READ_SYNC", handleReadSync);
    pollInternalDeliveryAndNotify();
    const timer = setInterval(pollInternalDeliveryAndNotify, 3500);
    return () => {
      mounted = false;
      window.removeEventListener("INTERNAL_CHAT_READ_SYNC", handleReadSync);
      clearInterval(timer);
    };
  }, [isLoggedIn, currentUser?.id, currentUser?.extension]);

  // Profile and ringtone preferences states
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useClickOutside(() => setProfileDropdownOpen(false));
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
  const [isPreviewingRingtone, setIsPreviewingRingtone] = useState(false);

  // AI Noise Suppression & Live Mic Loopback Tester states
  const [noiseSuppressionMode, setNoiseSuppressionMode] = useState("ai");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestLevels, setMicTestLevels] = useState({ inputLevel: 0, outputLevel: 0 });
  const [micTestError, setMicTestError] = useState("");
  const micTesterRef = React.useRef(null);

  const stopMicLoopbackTest = () => {
    if (micTesterRef.current) {
      try {
        micTesterRef.current.stop();
      } catch (e) {}
      micTesterRef.current = null;
    }
    setIsTestingMic(false);
    setMicTestLevels({ inputLevel: 0, outputLevel: 0 });
  };

  const startMicLoopbackTest = async (overrideMode = null, overrideMic = null, overrideSpk = null) => {
    stopMicLoopbackTest();
    setMicTestError("");
    try {
      const tester = await createMicLoopbackTester({
        micDeviceId: overrideMic !== null ? overrideMic : selectedMic,
        speakerDeviceId: overrideSpk !== null ? overrideSpk : selectedSpeaker,
        mode: overrideMode !== null ? overrideMode : noiseSuppressionMode,
        onLevels: (levels) => setMicTestLevels(levels)
      });
      micTesterRef.current = tester;
      setIsTestingMic(true);
    } catch (err) {
      setMicTestError(err?.message || "Mikrofon testi başlatılamadı.");
      setIsTestingMic(false);
    }
  };

  const handleSelectNoiseMode = (nextMode) => {
    const saved = saveNoiseSuppressionMode(nextMode);
    setNoiseSuppressionMode(saved);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("NOISE_MODE_UPDATED", { detail: { mode: saved, silent: true } }));
    }
    if (isTestingMic) {
      startMicLoopbackTest(saved, selectedMic, selectedSpeaker);
    }
  };

  // Security settings states
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
  const [autoLogoutDuration, setAutoLogoutDuration] = useState(1); // 1, 2, 3 (Hours)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState("google_auth");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorEnrolled, setTwoFactorEnrolled] = useState(false);
  const [twoFactorQrSvg, setTwoFactorQrSvg] = useState("");
  const [twoFactorSetupLoading, setTwoFactorSetupLoading] = useState(false);
  const [twoFactorTestCode, setTwoFactorTestCode] = useState("");
  const [twoFactorVerifyLoading, setTwoFactorVerifyLoading] = useState(false);
  const [twoFactorEmailSending, setTwoFactorEmailSending] = useState(false);
  const [twoFactorStatusMsg, setTwoFactorStatusMsg] = useState(null);
  const [twoFactorSecretCopied, setTwoFactorSecretCopied] = useState(false);
  const [passwordExpiryEnabled, setPasswordExpiryEnabled] = useState(false);
  const [passwordExpiryMonths, setPasswordExpiryMonths] = useState(3); // 1, 3, 6, 12 (Months)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatusMsg, setPasswordStatusMsg] = useState(null);
  
  // Mandatory password renewal modal states
  const [mandatoryCurrentPassword, setMandatoryCurrentPassword] = useState("");
  const [mandatoryNewPassword, setMandatoryNewPassword] = useState("");
  const [mandatoryConfirmPassword, setMandatoryConfirmPassword] = useState("");
  const [mandatoryErrorMsg, setMandatoryErrorMsg] = useState("");
  
  // Apply error modal state
  const [showApplyErrorModal, setShowApplyErrorModal] = useState(false);

  // Application Custom Notification Modal state
  const [notificationModal, setNotificationModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "success" // 'success' | 'error' | 'warning' | 'info'
  });

  const showNotification = (message, type = "success", title = "") => {
    setNotificationModal({
      isOpen: true,
      title: title || (type === "success" ? "İşlem Başarılı" : type === "error" ? "Sistem Uyarısı" : "Sistem Bildirimi"),
      message,
      type
    });
  };

  const lastActivityRef = React.useRef(typeof Date !== "undefined" ? Date.now() : 0);

  // Check if current user password has expired
  const isPasswordExpired = React.useMemo(() => {
    if (!currentUser || !currentUser.password_expiry_enabled) return false;
    if (!currentUser.password_last_updated) return true; // Enabled but never set -> expired
    const lastUpdated = new Date(currentUser.password_last_updated);
    const months = currentUser.password_expiry_months || 3;
    const now = new Date();
    
    const diffTime = Math.abs(now.getTime() - lastUpdated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const allowedDays = months * 30; // 30 days per month
    
    return diffDays >= allowedDays;
  }, [currentUser]);

  const fetchProfile2faSetup = async (resetSecret = false, overrideMethod = null) => {
    if (!currentUser) return;
    const targetMethod = overrideMethod || twoFactorMethod || "google_auth";
    if (targetMethod === "email") return;
    setTwoFactorSetupLoading(true);
    if (resetSecret) setTwoFactorStatusMsg(null);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const uid = currentUser.id || currentUser.extension || "admin";
      const qs = new URLSearchParams({
        reset: resetSecret ? "true" : "false",
        method: targetMethod,
        email: currentUser.email || "kullanici@aida.local"
      });
      const res = await fetch(`${protocol}//${backendHost}/api/auth/setup_2fa/${encodeURIComponent(String(uid))}?${qs.toString()}`);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorSecret(data.secret || "");
        setTwoFactorQrSvg(data.qr_svg || "");
        if (resetSecret) {
          setTwoFactorEnrolled(false);
          setTwoFactorStatusMsg({ type: "success", text: "Yeni QR kod ve anahtar üretildi. Uygulamadan tekrar okutunuz." });
        } else if (data.enrolled !== undefined) {
          setTwoFactorEnrolled(Boolean(data.enrolled));
        }
      }
    } catch (e) {
      console.error("2FA profile setup error:", e);
    } finally {
      setTwoFactorSetupLoading(false);
    }
  };

  useEffect(() => {
    if (
      settingsModalOpen &&
      twoFactorEnabled &&
      (twoFactorMethod === "google_auth" || twoFactorMethod === "microsoft_auth") &&
      !twoFactorQrSvg &&
      !twoFactorSetupLoading
    ) {
      fetchProfile2faSetup(false, twoFactorMethod);
    }
  }, [settingsModalOpen, twoFactorEnabled, twoFactorMethod]);

  const handleProfileSendTestEmailOtp = async () => {
    if (!currentUser) return;
    const targetEmail = (currentUser.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setTwoFactorStatusMsg({ type: "error", text: "Hesabınıza tanımlı geçerli bir E-Posta adresi bulunamadı." });
      return;
    }
    setTwoFactorEmailSending(true);
    setTwoFactorStatusMsg(null);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/auth/2fa/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(currentUser.id || currentUser.extension || "admin"),
          email: targetEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorStatusMsg({ type: "success", text: data.message });
      } else {
        setTwoFactorStatusMsg({ type: "error", text: data.detail || "E-Posta gönderilemedi." });
      }
    } catch (e) {
      setTwoFactorStatusMsg({ type: "error", text: "E-Posta gönderim hatası: " + e.message });
    } finally {
      setTwoFactorEmailSending(false);
    }
  };

  const handleProfileSendTestWhatsAppOtp = async () => {
    if (!currentUser) return;
    const targetPhone = (gsmNumber || currentUser.gsm_number || currentUser.follow_me?.mobile_number || "").trim();
    if (targetPhone.replace(/\D/g, "").length < 10) {
      setTwoFactorStatusMsg({ type: "error", text: "Lütfen geçerli bir Cep Telefonu (GSM) numarası giriniz." });
      return;
    }
    setTwoFactorEmailSending(true);
    setTwoFactorStatusMsg(null);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/auth/2fa/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(currentUser.id || currentUser.extension || "admin"),
          phone: targetPhone
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorStatusMsg({ type: "success", text: data.message });
      } else {
        setTwoFactorStatusMsg({ type: "error", text: data.detail || "WhatsApp kodu gönderilemedi." });
      }
    } catch (e) {
      setTwoFactorStatusMsg({ type: "error", text: "WhatsApp gönderim hatası: " + e.message });
    } finally {
      setTwoFactorEmailSending(false);
    }
  };

  const handleProfileVerify2faCode = async () => {
    if (!currentUser) return;
    const cleanCode = (twoFactorTestCode || "").replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setTwoFactorStatusMsg({ type: "error", text: "Lütfen 6 haneli doğrulama kodunu giriniz." });
      return;
    }
    setTwoFactorVerifyLoading(true);
    setTwoFactorStatusMsg(null);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/auth/verify_2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(currentUser.id || currentUser.extension || "admin"),
          code: cleanCode,
          method: twoFactorMethod,
          secret: twoFactorSecret || undefined,
          phone: (gsmNumber || currentUser.gsm_number || currentUser.follow_me?.mobile_number || "").trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorEnrolled(true);
        setTwoFactorTestCode("");
        setTwoFactorStatusMsg({ type: "success", text: data.message || "2FA doğrulaması başarılı ve eşleştirildi!" });
      } else {
        setTwoFactorStatusMsg({ type: "error", text: data.detail || "Doğrulama kodu geçersiz." });
      }
    } catch (e) {
      setTwoFactorStatusMsg({ type: "error", text: "Doğrulama hatası: " + e.message });
    } finally {
      setTwoFactorVerifyLoading(false);
    }
  };

  useEffect(() => {
    if (settingsModalOpen && currentUser) {
      setGsmNumber(currentUser.gsm_number || currentUser.follow_me?.mobile_number || "");
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

      const resolvedProf = currentUser.active_profile || "available";
      setAgentActiveProfile(resolvedProf);
      setSelectedAgentProfileTab(resolvedProf);
      setAgentProfiles(normalizeUserProfiles(currentUser.profiles));
      setCallPanelPrefs(loadCallPanelPrefs(currentUser));

      if (settingsModalOpen) {
        const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
        fetch(`${protocol}//${backendHost}/api/settings/queues`)
          .then(r => r.ok ? r.json() : [])
          .then(d => setAgentQueuesList(Array.isArray(d) ? d : (d?.queues || [])))
          .catch(() => {});
        fetch(`${protocol}//${backendHost}/api/settings/ai-agents`)
          .then(r => r.ok ? r.json() : [])
          .then(d => setAgentAiAgentsList(Array.isArray(d) ? d : (d?.ai_agents || [])))
          .catch(() => {});
      }

      setAutoLogoutEnabled(currentUser.auto_logout_enabled ?? (localStorage.getItem("auto_logout_enabled") === "true"));
      setAutoLogoutDuration(currentUser.auto_logout_duration ?? parseInt(localStorage.getItem("auto_logout_duration") || "1"));
      setTwoFactorEnabled(currentUser.two_factor_enabled ?? (localStorage.getItem("two_factor_enabled") === "true"));
      const norm2faMethod = (!currentUser.two_factor_method || currentUser.two_factor_method === "app") ? "google_auth" : currentUser.two_factor_method;
      setTwoFactorMethod(norm2faMethod);
      setTwoFactorSecret(currentUser.two_factor_secret || "");
      setTwoFactorEnrolled(Boolean(currentUser.two_factor_enrolled));
      setTwoFactorQrSvg("");
      setTwoFactorTestCode("");
      setTwoFactorStatusMsg(null);
      setPasswordExpiryEnabled(currentUser.password_expiry_enabled ?? (localStorage.getItem("password_expiry_enabled") === "true"));
      setPasswordExpiryMonths(currentUser.password_expiry_months ?? parseInt(localStorage.getItem("password_expiry_months") || "3"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatusMsg(null);
    }
  }, [settingsModalOpen, currentUser]);

  const handleQuickProfileSwitch = async (profileId) => {
    setAgentActiveProfile(profileId);
    setSelectedAgentProfileTab(profileId);
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_active_profile", profileId);
    }
    const profObj = agentProfiles.find(p => p.id === profileId) || DEFAULT_USER_PROFILES.find(p => p.id === profileId);
    const profName = profObj ? profObj.name : profileId;
    setCurrentUser(prev => prev ? { ...prev, active_profile: profileId, profiles: agentProfiles } : prev);

    if (currentUser) {
      try {
        const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
        const uid = currentUser.id || currentUser.extension || "admin";
        const res = await fetch(`${protocol}//${backendHost}/api/users/${uid}/active-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            active_profile: profileId,
            profiles: agentProfiles
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user);
          }
          showNotification(`Aktif çağrı profiliniz "${profName}" olarak güncellendi.`, "success", "Profil Değiştirildi");
        }
      } catch (e) {
        console.error("Quick profile switch error:", e);
      }
    }
  };

  // Activity monitoring for auto logout
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    window.addEventListener("click", resetActivity);
    window.addEventListener("scroll", resetActivity);
    window.addEventListener("touchstart", resetActivity);

    return () => {
      window.removeEventListener("mousemove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("click", resetActivity);
      window.removeEventListener("scroll", resetActivity);
      window.removeEventListener("touchstart", resetActivity);
    };
  }, []);

  // Auto logout timer check
  useEffect(() => {
    if (!isLoggedIn || !autoLogoutEnabled) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsedMinutes = (now - lastActivityRef.current) / (1000 * 60);
      const allowedMinutes = autoLogoutDuration * 60; // 1, 2, 3 hours -> 60, 120, 180 mins

      if (elapsedMinutes >= allowedMinutes) {
        console.warn(`[SECURITY] Oturum zaman aşımına uğradı (${allowedMinutes} dakika hareketsizlik). Oturum kapatılıyor.`);
        showNotification(`Güvenliğiniz amacıyla ${autoLogoutDuration} saat boyunca işlem yapılmadığı için oturumunuz otomatik kapatıldı. Lütfen tekrar giriş yapın.`, "warning", "Oturum Zaman Aşımı");
        handleLogout();
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [isLoggedIn, autoLogoutEnabled, autoLogoutDuration]);

  // Restrict admin-only tabs for non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      const adminOnlyTabs = [
        "settings", "system-status", "event-logs", "sip-debugger", "security", "tenant-management"
      ];
      if (adminOnlyTabs.includes(activeTab)) {
        console.warn(`[SECURITY] User role '${currentUser.role}' is not authorized to access '${activeTab}'. Redirecting to call-center.`);
        setActiveTab("call-center");
      }
    }
  }, [currentUser, activeTab]);

  // Load audio device settings from localStorage on mount and sync labels if permission is already granted
  useEffect(() => {
    if (typeof window !== "undefined") {
      setNoiseSuppressionMode(getSavedNoiseSuppressionMode());
      const savedRingtone = localStorage.getItem("ringtone");
      if (savedRingtone) setAgentRingtone(savedRingtone);
      const savedMic = localStorage.getItem("selected_mic") || "";
      if (savedMic) setSelectedMic(savedMic);
      const savedSpeaker = localStorage.getItem("selected_speaker") || "";
      if (savedSpeaker) setSelectedSpeaker(savedSpeaker);
      const savedRingtoneSpeaker = localStorage.getItem("selected_ringtone_speaker") || "";
      if (savedRingtoneSpeaker) setSelectedRingtoneSpeaker(savedRingtoneSpeaker);

      const handleNoiseSyncUi = (e) => {
        const nextM = e?.detail?.mode || getSavedNoiseSuppressionMode();
        setNoiseSuppressionMode(nextM);
      };
      window.addEventListener("NOISE_MODE_SYNC_UI", handleNoiseSyncUi);

      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
        navigator.mediaDevices
          .enumerateDevices()
          .then(async (devices) => {
            if (!devices.some((d) => d.label)) return;
            const inputs = devices.filter((d) => d.kind === "audioinput");
            const outputs = devices.filter((d) => d.kind === "audiooutput");

            const micLabel = localStorage.getItem("selected_mic_label") || "";
            const spkLabel = localStorage.getItem("selected_speaker_label") || "";
            const ringSpkLabel = localStorage.getItem("selected_ringtone_speaker_label") || "";

            const resMic = await resolveAudioDeviceId("audioinput", savedMic, micLabel);
            const resSpk = await resolveAudioDeviceId("audiooutput", savedSpeaker, spkLabel);
            const resRingSpk = await resolveAudioDeviceId("audiooutput", savedRingtoneSpeaker, ringSpkLabel);

            const foundMic = inputs.find((d) => d.deviceId === resMic);
            if (foundMic) {
              setSelectedMic(foundMic.deviceId);
              localStorage.setItem("selected_mic", foundMic.deviceId);
              if (foundMic.label) localStorage.setItem("selected_mic_label", foundMic.label);
            }
            const foundSpk = outputs.find((d) => d.deviceId === resSpk);
            if (foundSpk) {
              setSelectedSpeaker(foundSpk.deviceId);
              localStorage.setItem("selected_speaker", foundSpk.deviceId);
              if (foundSpk.label) localStorage.setItem("selected_speaker_label", foundSpk.label);
            }
            const foundRingSpk = outputs.find((d) => d.deviceId === resRingSpk);
            if (foundRingSpk) {
              setSelectedRingtoneSpeaker(foundRingSpk.deviceId);
              localStorage.setItem("selected_ringtone_speaker", foundRingSpk.deviceId);
              if (foundRingSpk.label) localStorage.setItem("selected_ringtone_speaker_label", foundRingSpk.label);
            }
          })
          .catch(() => {});
      }

      return () => {
        window.removeEventListener("NOISE_MODE_SYNC_UI", handleNoiseSyncUi);
        stopMicLoopbackTest();
      };
    }
  }, []);

  useEffect(() => {
    if (!settingsModalOpen || activeModalTab !== "hardware") {
      stopMicLoopbackTest();
      setMicTestError("");
    }
  }, [settingsModalOpen, activeModalTab]);

  // Sync available media devices on modal load (stopping any temporary permission stream immediately!)
  useEffect(() => {
    if (!settingsModalOpen) {
      stopRingtoneSound();
      setIsPreviewingRingtone(false);
      stopMicLoopbackTest();
      return;
    }
    setNoiseSuppressionMode(getSavedNoiseSuppressionMode());
    const loadDevices = async () => {
      if (typeof window === "undefined" || !navigator.mediaDevices) return;
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        // Only request temporary getUserMedia if labels are hidden (permission not yet granted),
        // and IMMEDIATELY stop all tracks so Bluetooth headsets are never locked in HFP/SCO mic mode!
        if (!devices.some((d) => d.label) && typeof navigator.mediaDevices.getUserMedia === "function") {
          let tempStream = null;
          try {
            tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } finally {
            if (tempStream) {
              tempStream.getTracks().forEach((t) => {
                try {
                  t.stop();
                } catch (e) {}
              });
            }
          }
          devices = await navigator.mediaDevices.enumerateDevices();
        }

        const inputs = devices.filter((d) => d.kind === "audioinput");
        const outputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioDevices({ inputs, outputs });

        const savedMic = localStorage.getItem("selected_mic") || selectedMic || "";
        const savedMicLabel = localStorage.getItem("selected_mic_label") || "";
        const savedSpeaker = localStorage.getItem("selected_speaker") || selectedSpeaker || "";
        const savedSpeakerLabel = localStorage.getItem("selected_speaker_label") || "";
        const savedRingtoneSpeaker = localStorage.getItem("selected_ringtone_speaker") || selectedRingtoneSpeaker || "";
        const savedRingtoneSpeakerLabel = localStorage.getItem("selected_ringtone_speaker_label") || "";

        const resolvedMic = await resolveAudioDeviceId("audioinput", savedMic, savedMicLabel);
        const resolvedSpeaker = await resolveAudioDeviceId("audiooutput", savedSpeaker, savedSpeakerLabel);
        const resolvedRingtoneSpeaker = await resolveAudioDeviceId(
          "audiooutput",
          savedRingtoneSpeaker,
          savedRingtoneSpeakerLabel
        );

        const targetMicObj = inputs.find((d) => d.deviceId === resolvedMic) || inputs[0];
        if (targetMicObj) {
          setSelectedMic(targetMicObj.deviceId);
          localStorage.setItem("selected_mic", targetMicObj.deviceId);
          if (targetMicObj.label) localStorage.setItem("selected_mic_label", targetMicObj.label);
        }

        const targetSpeakerObj = outputs.find((d) => d.deviceId === resolvedSpeaker) || outputs[0];
        if (targetSpeakerObj) {
          setSelectedSpeaker(targetSpeakerObj.deviceId);
          localStorage.setItem("selected_speaker", targetSpeakerObj.deviceId);
          if (targetSpeakerObj.label) localStorage.setItem("selected_speaker_label", targetSpeakerObj.label);
        }

        const targetRingtoneObj = outputs.find((d) => d.deviceId === resolvedRingtoneSpeaker) || outputs[0];
        if (targetRingtoneObj) {
          setSelectedRingtoneSpeaker(targetRingtoneObj.deviceId);
          localStorage.setItem("selected_ringtone_speaker", targetRingtoneObj.deviceId);
          if (targetRingtoneObj.label) localStorage.setItem("selected_ringtone_speaker_label", targetRingtoneObj.label);
        }
      } catch (err) {
        console.error("Media devices listing error:", err);
      }
    };
    loadDevices();
  }, [settingsModalOpen]);

  const backendHost = getBackendHost();


  const persistUserVisualPatch = React.useCallback((patchPayload, userOverride = null) => {
    try {
      if (typeof window === "undefined" || !patchPayload || typeof patchPayload !== "object") return;
      const targetUser = userOverride || currentUser;
      const uid =
        targetUser?.id ||
        targetUser?.extension ||
        sessionStorage.getItem("current_user_id") ||
        localStorage.getItem("current_user_id");
      if (!uid) return;
      setCurrentUser((prev) => (prev ? { ...prev, ...patchPayload } : prev));
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      fetch(`${protocol}//${backendHost}/api/agent/profile/${encodeURIComponent(String(uid))}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(uid)
        },
        body: JSON.stringify(patchPayload)
      }).catch(() => {});
    } catch (e) {}
  }, [backendHost, currentUser]);

  React.useEffect(() => {
    const handleWbStateSync = (e) => {
      if (e?.detail && typeof e.detail === "object") {
        setCurrentUser((prev) => (prev ? { ...prev, wallboard_layout: e.detail } : prev));
      }
    };
    window.addEventListener("wallboard-layout-updated", handleWbStateSync);
    return () => window.removeEventListener("wallboard-layout-updated", handleWbStateSync);
  }, []);

  const checkRolePermissions = async (providedUser = null) => {
    let currentUserData = providedUser || null;
    try {
      // 1. Synchronous storage check FIRST
      const savedAuth = sessionStorage.getItem('is_logged_in') === 'true' || localStorage.getItem('is_logged_in') === 'true';
      const savedUserId = sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id');

      if (!savedAuth && !savedUserId && !providedUser) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setIsAuthChecking(false);
        return;
      }

      // 2. Fetch users and role permissions in parallel so everything resolves in one single step
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      let usersData = [];
      let rolesData = [];
      try {
        const [resUsers, resRoles] = await Promise.all([
          fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`).catch(() => null),
          fetch(`${protocol}//${backendHost}/api/settings/roles`).catch(() => null)
        ]);
        if (resUsers && resUsers.ok) {
          usersData = await resUsers.json();
          if (Array.isArray(usersData)) setSystemUsers(usersData);
        }
        if (resRoles && resRoles.ok) {
          const parsedRoles = await resRoles.json();
          rolesData = Array.isArray(parsedRoles) ? parsedRoles : (parsedRoles?.roles || []);
        }
      } catch (err) {
        console.warn("Users/roles data fetch warning:", err);
      }

      // 3. Resolve exact current user profile and role
      if (providedUser) {
        const freshMatch = Array.isArray(usersData)
          ? usersData.find(u =>
              (providedUser.id && String(u.id) === String(providedUser.id)) ||
              (providedUser.extension && String(u.extension) === String(providedUser.extension))
            )
          : null;
        currentUserData = freshMatch ? { ...providedUser, ...freshMatch } : providedUser;
      } else if (savedAuth && savedUserId) {
        if (savedUserId === 'admin') {
          const adminUserFromDb = Array.isArray(usersData) ? usersData.find(u => u.role === 'admin' || u.username === 'admin' || u.id === 1) : null;
          currentUserData = adminUserFromDb ? { ...SUPER_ADMIN, ...adminUserFromDb } : SUPER_ADMIN;
        } else if (Array.isArray(usersData) && usersData.length > 0) {
          const found = usersData.find(u => String(u.id) === String(savedUserId) || String(u.extension) === String(savedUserId) || u.email === savedUserId || u.username === savedUserId);
          if (found) {
            currentUserData = found;
          } else {
            // Invalid / Ghost user ID in storage — clean stale state
            localStorage.removeItem('is_logged_in');
            localStorage.removeItem('current_user_id');
            sessionStorage.removeItem('is_logged_in');
            sessionStorage.removeItem('current_user_id');
            setIsLoggedIn(false);
            setCurrentUser(null);
            setIsAuthChecking(false);
            return;
          }
        }
      }

      if (!currentUserData) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setIsAuthChecking(false);
        return;
      }

      // 4. Hydrate saved visual preferences (Avatar, Theme Color, Dark/Light Mode, Call Panel Prefs, Wallboard Layout) BEFORE revealing UI
      if (currentUserData.avatar) {
        setAgentAvatar(currentUserData.avatar);
      }

      if (currentUserData.theme_color) {
        const safeColor = getSafeThemeColor(currentUserData.theme_color);
        document.documentElement.style.setProperty("--color-primary", safeColor);
        localStorage.setItem("theme_primary_color", safeColor);
        setTempThemeColor(safeColor);
      }

      if (currentUserData.theme_mode === "dark" || currentUserData.theme_mode === "light") {
        const wantDark = currentUserData.theme_mode === "dark";
        setIsDarkMode(wantDark);
        localStorage.setItem("theme", currentUserData.theme_mode);
        if (wantDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      if (currentUserData.wallboard_layout && typeof currentUserData.wallboard_layout === "object" && Object.keys(currentUserData.wallboard_layout).length > 0) {
        try {
          const wbUid = String(currentUserData.id || savedUserId || "admin");
          localStorage.setItem(`wallboard_layout_${wbUid}`, JSON.stringify(currentUserData.wallboard_layout));
          if (savedUserId === "admin") {
            localStorage.setItem("wallboard_layout_admin", JSON.stringify(currentUserData.wallboard_layout));
          }
        } catch (e) {}
      }

      const resolvedPanelPrefs = loadCallPanelPrefs(currentUserData);
      setCallPanelPrefs(resolvedPanelPrefs);

      // 5. Resolve Role Permissions & Initial Screen BEFORE setting isLoggedIn(true)
      const userRoleLower = String(currentUserData.role || "").toLowerCase().trim();
      const currentRole = Array.isArray(rolesData)
        ? rolesData.find(r =>
            String(r.role_code || "").toLowerCase().trim() === userRoleLower ||
            String(r.name || "").toLowerCase().trim() === userRoleLower ||
            String(r.id || "").toLowerCase().trim() === userRoleLower
          )
        : null;

      const permsList = currentRole && Array.isArray(currentRole.permissions) ? currentRole.permissions : [];
      setCurrentRolePermissions(permsList);

      const hasPerm = (prefix) => {
        return permsList.some(p => p === prefix || p.startsWith(prefix + ':'));
      };

      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const explicitUrlTabSlug = urlParams ? urlParams.get("tab") : null;
      const explicitUrlTab = explicitUrlTabSlug ? getTabFromTurkishSlug(explicitUrlTabSlug) : null;

      if (userRoleLower === 'admin' || (currentRole && currentRole.role_code === 'admin')) {
        setHasOmnichannelPermission(true);
        setHasContactsPermission(true);
        setHasBlacklistPermission(true);
        setHasMobileTransferPermission(true);
        setHasReportsPermission(true);
        setHasUsersPermission(true);
        setHasAnnouncementsPermission(true);
        setHasQueuesPermission(true);
        setHasAutoprovisionPermission(true);
        setHasOutboundRulesPermission(true);
        setHasInboundRulesPermission(true);
        setHasCallPickupPermission(true);
        setHasSubscriberGroupsPermission(true);
        setHasTrunksPermission(true);
        setHasConferencesPermission(true);
        setHasSpeedDialPermission(true);
        setHasScheduledReportsPermission(true);
        setIsAgentOnlyUser(false);
        setIsWallboardOnlyUser(false);
        setIsAgentFullScreenMode(false);
        if (explicitUrlTab) {
          setActiveTab(explicitUrlTab);
        }
      } else if (!currentRole) {
        setHasOmnichannelPermission(false);
        setHasContactsPermission(false);
        setHasBlacklistPermission(false);
        setHasMobileTransferPermission(false);
        setHasReportsPermission(false);
        setHasUsersPermission(false);
        setHasAnnouncementsPermission(false);
        setHasQueuesPermission(false);
        setHasAutoprovisionPermission(false);
        setHasOutboundRulesPermission(false);
        setHasInboundRulesPermission(false);
        setHasCallPickupPermission(false);
        setHasSubscriberGroupsPermission(false);
        setHasTrunksPermission(false);
        setHasConferencesPermission(false);
        setHasSpeedDialPermission(false);
        setHasScheduledReportsPermission(false);
        setIsWallboardOnlyUser(false);
        setIsAgentOnlyUser(true);
        setIsAgentFullScreenMode(true);
        setActiveTab('call-center');
      } else {
        const canOmni = hasPerm('omnichannel');
        const canContacts = hasPerm('contacts');
        const canBlacklist = hasPerm('blacklist');
        const canMobTransfer = hasPerm('mobile_transfer');
        const canReports = hasPerm('reports') || permsList.some(p => p.startsWith('reports_'));
        const canUsers = hasPerm('users');
        const canAnnouncements = hasPerm('announcements');
        const canQueues = hasPerm('acd_queues');
        const canAutoprov = hasPerm('autoprovision');
        const canOutRules = hasPerm('outbound_rules');
        const canInRules = hasPerm('inbound_rules');
        const canPickup = hasPerm('call_pickup_groups');
        const canSubGroups = hasPerm('subscriber_groups');
        const canTrunks = hasPerm('trunks');
        const canConfs = hasPerm('conferences');
        const canSpeedDial = hasPerm('speed_dials');
        const canScheduledReports = hasPerm('scheduled_reports');

        setHasOmnichannelPermission(canOmni);
        setHasContactsPermission(canContacts);
        setHasBlacklistPermission(canBlacklist);
        setHasMobileTransferPermission(canMobTransfer);
        setHasReportsPermission(canReports);
        setHasUsersPermission(canUsers);
        setHasAnnouncementsPermission(canAnnouncements);
        setHasQueuesPermission(canQueues);
        setHasAutoprovisionPermission(canAutoprov);
        setHasOutboundRulesPermission(canOutRules);
        setHasInboundRulesPermission(canInRules);
        setHasCallPickupPermission(canPickup);
        setHasSubscriberGroupsPermission(canSubGroups);
        setHasTrunksPermission(canTrunks);
        setHasConferencesPermission(canConfs);
        setHasSpeedDialPermission(canSpeedDial);
        setHasScheduledReportsPermission(canScheduledReports);

        const canDashboard = hasPerm('dashboard');
        const canWallboard = hasPerm('wallboard');
        const canCallPanel = hasPerm('call_panel');
        const canAiModules = hasPerm('ai_agents') || hasPerm('rag') || hasPerm('knowledge_base') || hasPerm('rules');
        const canPbxOrSysModules =
          canUsers ||
          hasPerm('pbx') ||
          canAnnouncements ||
          canQueues ||
          canAutoprov ||
          canOutRules ||
          canInRules ||
          canPickup ||
          canSubGroups ||
          canTrunks ||
          canConfs ||
          canSpeedDial ||
          canScheduledReports ||
          hasPerm('call_flow') ||
          hasPerm('dialer') ||
          canContacts ||
          canBlacklist ||
          hasPerm('calendar') ||
          hasPerm('roles') ||
          hasPerm('breaks') ||
          hasPerm('channels') ||
          hasPerm('logs') ||
          hasPerm('storage') ||
          hasPerm('sip_debugger') ||
          hasPerm('security');

        // Dedicated Wallboard / Call Monitoring Only Role (no sidebar clutter)
        if (canWallboard && !canDashboard && !canCallPanel && !canOmni && !canReports && !canAiModules && !canPbxOrSysModules) {
          setIsWallboardOnlyUser(true);
          setIsAgentOnlyUser(false);
          setIsAgentFullScreenMode(false);
          setActiveTab('wallboard');
        } else if (userRoleLower === 'agent' || (!canDashboard && !canWallboard && !canReports && !canAiModules && !canPbxOrSysModules)) {
          // Dedicated Call Panel / Agent Monitoring Role (full-screen Call Panel)
          setIsWallboardOnlyUser(false);
          setIsAgentOnlyUser(true);
          setIsAgentFullScreenMode(true);
          setActiveTab('call-center');
        } else {
          setIsWallboardOnlyUser(false);
          setIsAgentOnlyUser(false);
          // Ensure multi-module roles without dashboard:access never start on "dashboard"
          const isExplicitTabAllowed =
            explicitUrlTab &&
            ((explicitUrlTab === 'dashboard' && canDashboard) ||
              (explicitUrlTab === 'wallboard' && canWallboard) ||
              (explicitUrlTab === 'call-center' && canCallPanel) ||
              (explicitUrlTab === 'omnichannel' && canOmni) ||
              (explicitUrlTab.startsWith('reports-') && canReports) ||
              explicitUrlTab !== 'dashboard');

          if (isExplicitTabAllowed) {
            setActiveTab(explicitUrlTab);
          } else if (!canDashboard) {
            if (canWallboard) setActiveTab('wallboard');
            else if (canCallPanel) setActiveTab('call-center');
            else if (canOmni) setActiveTab('omnichannel');
            else if (canReports) setActiveTab('reports-pano');
            else if (canUsers) setActiveTab('users');
            else if (canContacts) setActiveTab('contacts');
          }
        }
      }

      // 6. Commit user & logged-in state in the exact same synchronous batch so Admin Panel never flashes
      setCurrentUser(currentUserData);
      setIsLoggedIn(true);
      setIsAuthChecking(false);
    } catch (e) {
      console.error("Role permission check failed:", e);
      if (currentUserData) {
        if (currentUserData.role === 'admin') {
          setHasOmnichannelPermission(true);
          setHasContactsPermission(true);
          setHasBlacklistPermission(true);
          setHasMobileTransferPermission(true);
          setHasReportsPermission(true);
          setHasUsersPermission(true);
          setHasAnnouncementsPermission(true);
          setHasQueuesPermission(true);
          setHasAutoprovisionPermission(true);
          setHasOutboundRulesPermission(true);
          setHasInboundRulesPermission(true);
          setHasCallPickupPermission(true);
          setHasSubscriberGroupsPermission(true);
          setHasTrunksPermission(true);
          setHasConferencesPermission(true);
          setHasSpeedDialPermission(true);
          setHasScheduledReportsPermission(true);
        }
        setCurrentUser(currentUserData);
        setIsLoggedIn(true);
      }
      setIsAuthChecking(false);
    }
  };

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
        const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        if (resStatus.ok) {
          const status = await resStatus.json();
          if (status && status.is_logged_in && status.user_id) {
            const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`);
            if (resUsers.ok) {
              const users = await resUsers.json();
              if (Array.isArray(users)) {
                const curr = users.find(u => String(u.id) === String(status.user_id));
                if (curr && curr.avatar) {
                  setAgentAvatar(curr.avatar);
                  localStorage.setItem("agent_avatar", curr.avatar);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Agent presence sync error:", e);
      }
    };

    // Safety fallback: unblock loading spinner only if network completely stalls (5s)
    const fallbackTimer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 5000);

    checkRolePermissions();
    syncAgentPresence();

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleLogin = async (username, password, rememberMe = true) => {
    setLoginError("");
    const cleanUsername = (username || "").trim();
    let usersToSearch = systemUsers;
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`);
      if (resUsers.ok) {
        const freshUsers = await resUsers.json();
        if (Array.isArray(freshUsers) && freshUsers.length > 0) {
          usersToSearch = freshUsers;
          setSystemUsers(freshUsers);
        }
      }
    } catch (err) {
      console.error("Login user fetch error:", err);
    }

    const adminUserFromDb = (usersToSearch || []).find(u => u.role === 'admin' || u.username === 'admin' || u.id === 1);
    const validAdminPassword = adminUserFromDb?.password || SUPER_ADMIN.password || "admin";

    if (cleanUsername === "admin" && (password === validAdminPassword || password === "admin")) { // Admin login
      const activeAdminUser = adminUserFromDb ? { ...SUPER_ADMIN, ...adminUserFromDb } : SUPER_ADMIN;
      if (activeAdminUser.two_factor_enabled) {
        const normAdminMethod = (!activeAdminUser.two_factor_method || activeAdminUser.two_factor_method === "app") ? "google_auth" : activeAdminUser.two_factor_method;
        return {
          success: true,
          requires2fa: true,
          user_id: (activeAdminUser.id || "admin").toString(),
          method: normAdminMethod,
          enrolled: Boolean(activeAdminUser.two_factor_enrolled),
          email: activeAdminUser.email || "",
          phone: activeAdminUser.gsm_number || activeAdminUser.follow_me?.mobile_number || "",
          full_name: activeAdminUser.full_name || "Sistem Yöneticisi"
        };
      }
      sessionStorage.setItem("is_logged_in", "true");
      sessionStorage.setItem("current_user_id", "admin");
      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", "admin");
      }
      setIsAuthChecking(true);
      await checkRolePermissions(activeAdminUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi", `${activeAdminUser.full_name || "Sistem Yöneticisi"} web yönetim paneline giriş yaptı.`, activeAdminUser);
      return { success: true };
    }

    const cleanLower = cleanUsername.toLowerCase();
    const foundUser = (usersToSearch || []).find(u => 
      (
        u.username === cleanUsername ||
        u.email === cleanUsername ||
        (u.email && String(u.email).toLowerCase() === cleanLower) ||
        String(u.extension || "") === cleanUsername ||
        u.full_name === cleanUsername ||
        (u.sip_username && u.sip_username === cleanUsername)
      ) && 
      (u.password === password || u.sip_password === password)
    );
    if (foundUser) {
      if (foundUser.two_factor_enabled) {
        const normMethod = (!foundUser.two_factor_method || foundUser.two_factor_method === "app") ? "google_auth" : foundUser.two_factor_method;
        return {
          success: true,
          requires2fa: true,
          user_id: foundUser.id.toString(),
          method: normMethod,
          enrolled: Boolean(foundUser.two_factor_enrolled),
          email: foundUser.email || "",
          phone: foundUser.gsm_number || foundUser.follow_me?.mobile_number || "",
          full_name: foundUser.full_name || ""
        };
      }

      sessionStorage.setItem("is_logged_in", "true");
      sessionStorage.setItem("current_user_id", foundUser.id.toString());
      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", foundUser.id.toString());
      }
      setIsAuthChecking(true);
      await checkRolePermissions(foundUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi", `${foundUser.full_name || foundUser.username || "Kullanıcı"} (Dahili: ${foundUser.extension || "-"}) sisteme giriş yaptı.`, foundUser);
      return { success: true };
    } else {
      setLoginError("Geçersiz kullanıcı adı veya şifre.");
      return { success: false, error: "Geçersiz kullanıcı adı veya şifre." };
    }
  };

  const complete2FALogin = async (userId, rememberMe) => {
    let foundUser = systemUsers.find(u => String(u.id) === String(userId) || String(u.extension) === String(userId));
    if (!foundUser && (String(userId) === "admin" || String(userId) === "1")) {
      const adminDb = systemUsers.find(u => u.role === "admin" || u.username === "admin");
      foundUser = adminDb ? { ...SUPER_ADMIN, ...adminDb } : SUPER_ADMIN;
    }
    if (foundUser) {
      const updatedUser = { ...foundUser, two_factor_enrolled: true };
      const storeId = foundUser.role === "admin" && String(userId) === "admin" ? "admin" : foundUser.id.toString();
      sessionStorage.setItem("is_logged_in", "true");
      sessionStorage.setItem("current_user_id", storeId);
      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", storeId);
      }
      setIsAuthChecking(true);
      await checkRolePermissions(updatedUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi (2FA)", `${updatedUser.full_name || updatedUser.username || "Kullanıcı"} 2 aşamalı doğrulama ile sisteme giriş yaptı.`, updatedUser);
    }
  };


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
    const modeStr = newMode ? "dark" : "light";
    setIsDarkMode(newMode);
    localStorage.setItem("theme", modeStr);
    persistUserVisualPatch({ theme_mode: modeStr });
  };

  const sendUserAuditActivity = React.useCallback((action, module, screenName, summary, userOverride = null) => {
    try {
      if (typeof window === "undefined") return;
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const u = userOverride || currentUser;
      const uid = u?.id || u?.extension || sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id");
      if (!uid) return;
      fetch(`${protocol}//${backendHost}/api/audit/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(uid)
        },
        body: JSON.stringify({
          user_id: String(uid),
          user_name: u?.full_name ? (u?.extension ? `${u.full_name} (Dahili: ${u.extension})` : u.full_name) : undefined,
          extension: u?.extension || undefined,
          action,
          module,
          screen_name: screenName,
          summary
        })
      }).catch(() => {});
    } catch (e) {}
  }, [backendHost, currentUser]);

  const prevLoggedTabRef = React.useRef(null);
  React.useEffect(() => {
    if (!isLoggedIn || !currentUser || !activeTab) return;
    if (prevLoggedTabRef.current === null) {
      prevLoggedTabRef.current = activeTab;
      return;
    }
    if (prevLoggedTabRef.current === activeTab) return;
    prevLoggedTabRef.current = activeTab;

    const TAB_LABELS = {
      "dashboard": "Gerçek Zamanlı AI Pano",
      "wallboard": "Canlı Duvar (Wallboard)",
      "call-center": "Temsilci Çağrı Paneli",
      "omnichannel": "Çok Kanallı Sohbet (Omnichannel)",
      "reports": "Çağrı ve Performans Raporları",
      "satisfaction-analytics": "Müşteri Memnuniyet Analitiği",
      "contacts": "Telefon Rehberi",
      "appointments": "Randevu Yönetimi",
      "knowledge": "Bilgi Bankası (RAG)",
      "evaluation": "Kalite Değerlendirme",
      "blacklist": "Kara Liste & Engellenenler",
      "tenants": "Müşteri (Tenant) Yönetimi",
      "system-logs": "Olay Günlükleri (Denetim Kayıtları)",
      "sip-debugger": "SIP / WebRTC Paket Analizi",
      "pbx-settings": "Santral (PBX) Ayarları",
      "settings": "Sistem Ayarları"
    };
    const screenLabel = TAB_LABELS[activeTab] || activeTab;
    sendUserAuditActivity(
      "PAGE_VIEW",
      "Navigation",
      screenLabel,
      `Kullanıcı '${screenLabel}' ekranına giriş yaptı.`
    );
  }, [activeTab, isLoggedIn, currentUser, sendUserAuditActivity]);

  React.useEffect(() => {
    if (settingsModalOpen && isLoggedIn && currentUser) {
      sendUserAuditActivity(
        "PAGE_VIEW",
        "Profile",
        "Profil Ayarları",
        "Kullanıcı 'Profil Ayarları' penceresine giriş yaptı."
      );
    }
  }, [settingsModalOpen, isLoggedIn, currentUser, sendUserAuditActivity]);

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const targetUserId = currentUser?.id || currentUser?.extension || localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id');

      if (targetUserId) {
        await fetch(`${protocol}//${backendHost}/api/audit/activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(targetUserId)
          },
          body: JSON.stringify({
            user_id: String(targetUserId),
            user_name: currentUser?.full_name ? (currentUser?.extension ? `${currentUser.full_name} (Dahili: ${currentUser.extension})` : currentUser.full_name) : undefined,
            extension: currentUser?.extension || undefined,
            action: "LOGOUT",
            module: "Auth",
            screen_name: "Web Paneli Çıkışı",
            summary: `${currentUser?.full_name || "Kullanıcı"} web panelinden çıkış yaptı.`
          })
        }).catch(() => {});

        await fetch(`${protocol}//${backendHost}/api/webrtc/unregister_notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_id: targetUserId,
            extension: currentUser?.extension || targetUserId
          })
        }).catch(() => {});

        await fetch(`${protocol}//${backendHost}/api/agent/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            is_logged_in: false,
            status: "offline",
            current_break: null,
            user_id: targetUserId
          })
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      localStorage.removeItem("is_logged_in");
      localStorage.removeItem("current_user_id");
      localStorage.removeItem("agent_avatar");
      sessionStorage.removeItem("is_logged_in");
      sessionStorage.removeItem("current_user_id");
      try {
        const uidKey = String(currentUser?.id || "").trim();
        const extKey = String(currentUser?.extension || "").trim();
        if (uidKey) sessionStorage.removeItem(`notified_int_chat_ids_${uidKey}`);
        if (extKey) sessionStorage.removeItem(`notified_int_chat_ids_${extKey}`);
      } catch (e) {}
      setInternalChatToast(null);
      setCurrentUser(null);
      setIsLoggedIn(false);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  React.useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const rawFetch = window.fetch;

    // Automatically attach X-User-ID header to all backend API calls for accurate User Audit Trail
    window.fetch = function (input, init = {}) {
      try {
        const urlStr = typeof input === "string" ? input : (input?.url || "");
        if (urlStr.includes("/api/") || urlStr.includes("/settings/")) {
          const activeUid = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id");
          if (activeUid) {
            const headers = new Headers(init.headers || {});
            if (!headers.has("X-User-ID")) {
              headers.set("X-User-ID", String(activeUid));
            }
            init = { ...init, headers };
          }
        }
      } catch (e) {}
      return rawFetch.call(this, input, init);
    };

    const sendLog = (level, args) => {
      if (level !== "error") return;
      const message = args.map(arg => {
        if (typeof arg === "object") {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(" ");

      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      rawFetch(`${protocol}//${backendHost}/api/client-logs`, {
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
      window.fetch = rawFetch;
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

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} onComplete2FA={complete2FALogin} error={loginError} backendHost={backendHost} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex font-sans transition-colors duration-300">
      <Head>
        <title>Omnichannel AI Call Center Admin Panel</title>
        <meta name="description" content="AI PBX and Social Messaging dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Sidebar Navigation */}
      {!isEditingCallFlow && !isWallboardOnlyUser && !(activeTab === "call-center" && (isAgentOnlyUser || isAgentFullScreenMode)) && (
        <aside
          onMouseOver={(e) => {
            if (!isSidebarCollapsed) {
              if (sidebarTooltip) setSidebarTooltip(null);
              return;
            }
            const target = e.target.closest("button, [title]");
            if (target && e.currentTarget.contains(target)) {
              const label = target.getAttribute("title") || target.textContent?.trim();
              if (label) {
                const rect = target.getBoundingClientRect();
                setSidebarTooltip({
                  label,
                  top: rect.top + rect.height / 2,
                  left: rect.right + 10,
                });
                return;
              }
            }
            setSidebarTooltip(null);
          }}
          onMouseLeave={() => setSidebarTooltip(null)}
          onScroll={() => sidebarTooltip && setSidebarTooltip(null)}
          className={`${
            isSidebarCollapsed ? "w-20 px-2.5" : "w-64 px-4"
          } py-4 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out`}
        >
        <div
          className={`flex ${
            isSidebarCollapsed ? "flex-col items-center gap-2.5 px-0" : "items-center justify-between px-2"
          } py-3 mb-5 border-b border-slate-100 dark:border-slate-800/60 transition-all duration-300`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              onClick={() => isSidebarCollapsed && toggleSidebarCollapse()}
              title={isSidebarCollapsed ? "Menüyü Genişlet" : "AIDA Çok Kanallı Santral"}
              className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ${
                isSidebarCollapsed ? "cursor-pointer hover:scale-105 transition-transform" : ""
              }`}
            >
              <Bot size={20} className="animate-pulse shrink-0" />
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${
                isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"
              }`}
            >
              <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                <span className="text-rose-600 dark:text-rose-500">AI</span>DA
              </h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">ÇOK KANALLI SANTRAL</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSidebarCollapse}
            title={isSidebarCollapsed ? "Menüyü Aç" : "Menüyü Gizle (Sadece İkonlar)"}
            className="p-2 rounded-xl text-slate-400 hover:text-primary dark:text-slate-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/80 transition-all duration-200 shrink-0 cursor-pointer"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className={`flex-1 ${isSidebarCollapsed ? "space-y-2" : "space-y-4"} select-none transition-all duration-300`}>
          {/* Group 1: Operasyon & İzleme */}
          <div className="flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => toggleCategory("operations")}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Operasyon & İzleme</span>
                <ChevronDown
                  size={12}
                  className={`transform transition-transform duration-200 shrink-0 ${
                    openCategories.operations ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                isSidebarCollapsed || openCategories.operations ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "dashboard" || p.startsWith("dashboard:")))) && (
                <button
                  onClick={() => setActiveTab("dashboard")}
                  title="Gerçek Zamanlı AI Pano"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "dashboard"
                      ? "bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100/80 dark:border-violet-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Activity size={16} className={`shrink-0 ${activeTab === "dashboard" ? "text-violet-500" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Gerçek Zamanlı AI Pano</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "wallboard" || p.startsWith("wallboard:")))) && (
                <button
                  onClick={() => setActiveTab("wallboard")}
                  title="Canlı İzleme Paneli"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "wallboard"
                      ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Monitor size={16} className={`shrink-0 ${activeTab === "wallboard" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Canlı İzleme Paneli</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "call_panel" || p.startsWith("call_panel:")))) && (
                <button
                  onClick={() => setActiveTab("call-center")}
                  title="Temsilci Çağrı Paneli"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "call-center"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Phone size={16} className={`shrink-0 ${activeTab === "call-center" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Çağrı Paneli</span>
                </button>
              )}

              {hasOmnichannelPermission && (
                <button
                  onClick={() => setActiveTab("omnichannel")}
                  title="Ortak Gelen Kutusu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "omnichannel"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <MessageSquare size={16} className={`shrink-0 ${activeTab === "omnichannel" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Ortak Gelen Kutusu</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "api_budgets" || p.startsWith("api_budgets:") || p.startsWith("budget:")))) && (
                <button
                  onClick={() => setActiveTab("api-budgets")}
                  title="API Bütçe ve Tüketim"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "api-budgets"
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Database size={16} className={`shrink-0 ${activeTab === "api-budgets" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>API Bütçe ve Tüketim</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 2: Yapay Zeka & Bilgi */}
          {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_agents:") || p.startsWith("ai_config_assistant:") || p.startsWith("rag:") || p.startsWith("knowledge_base:") || p.startsWith("rules:")))) && (
          <div className="flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => toggleCategory("ai")}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Yapay Zeka & Bilgi</span>
                <ChevronDown
                  size={12}
                  className={`transform transition-transform duration-200 shrink-0 ${
                    openCategories.ai ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                isSidebarCollapsed || openCategories.ai ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_config_assistant:")))) && (
                <button
                  onClick={() => setActiveTab("ai-config-assistant")}
                  title="AI Konfigürasyon Asistanı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "ai-config-assistant"
                      ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Sparkles size={16} className={`shrink-0 ${activeTab === "ai-config-assistant" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI Konfigürasyon Asistanı</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_agents:")))) && (
                <button
                  onClick={() => setActiveTab("ai-agents")}
                  title="AI Temsilcileri"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "ai-agents"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-purple-655 dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Bot size={16} className={`shrink-0 ${activeTab === "ai-agents" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI Temsilcileri</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("rag:") || p.startsWith("knowledge_base:")))) && (
                <button
                  onClick={() => setActiveTab("rag-kb")}
                  title="Bilgi Bankası (RAG)"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "rag-kb"
                      ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Database size={16} className={`shrink-0 ${activeTab === "rag-kb" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Bilgi Bankası (RAG)</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("rules:")))) && (
                <button
                  onClick={() => setActiveTab("rule-editor")}
                  title="Kural & Senaryo Editörü"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "rule-editor"
                      ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Sliders size={16} className={`shrink-0 ${activeTab === "rule-editor" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kural & Senaryo Editörü</span>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Group 2.5: Santral */}
          <div className="flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => toggleCategory("pbxGroup")}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Santral</span>
                <ChevronDown
                  size={12}
                  className={`transform transition-transform duration-200 shrink-0 ${
                    openCategories.pbxGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                isSidebarCollapsed || openCategories.pbxGroup ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {hasUsersPermission && (
                <button
                  onClick={() => setActiveTab("users")}
                  title="Kullanıcılar"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "users"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <User size={16} className={`shrink-0 ${activeTab === "users" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kullanıcılar</span>
                </button>
              )}

              {hasAnnouncementsPermission && (
                <button
                  onClick={() => setActiveTab("announcements")}
                  title="Anons Yönetimi"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "announcements"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Volume2 size={16} className={`shrink-0 ${activeTab === "announcements" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Anons Yönetimi</span>
                </button>
              )}

              {hasQueuesPermission && (
                <button
                  onClick={() => setActiveTab("acd-queues")}
                  title="ACD Kuyruk"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "acd-queues"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "acd-queues" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>ACD Kuyruk</span>
                </button>
              )}

              {hasAutoprovisionPermission && (
                <button
                  onClick={() => setActiveTab("auto-provision")}
                  title="Oto Provizyon"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "auto-provision"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Cpu size={16} className={`shrink-0 ${activeTab === "auto-provision" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Oto Provizyon</span>
                </button>
              )}

              {hasOutboundRulesPermission && (
                <button
                  onClick={() => setActiveTab("outbound-rules")}
                  title="Giden Arama Kuralı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "outbound-rules"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <PhoneCall size={16} className={`shrink-0 ${activeTab === "outbound-rules" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Giden Arama Kuralı</span>
                </button>
              )}

              {hasInboundRulesPermission && (
                <button
                  onClick={() => setActiveTab("inbound-rules")}
                  title="Gelen Arama Kuralı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "inbound-rules"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Phone size={16} className={`shrink-0 ${activeTab === "inbound-rules" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Gelen Arama Kuralı</span>
                </button>
              )}

              {hasCallPickupPermission && (
                <button
                  onClick={() => setActiveTab("call-pickup-groups")}
                  title="Çağrı Toplama Grubu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "call-pickup-groups"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "call-pickup-groups" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Çağrı Toplama Grubu</span>
                </button>
              )}

              {hasSubscriberGroupsPermission && (
                <button
                  onClick={() => setActiveTab("subscriber-groups")}
                  title="Abone Grubu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "subscriber-groups"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "subscriber-groups" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Abone Grubu</span>
                </button>
              )}

              {hasContactsPermission && (
                <button
                  onClick={() => setActiveTab("contacts")}
                  title="Rehber"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "contacts"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <BookOpen size={16} className={`shrink-0 ${activeTab === "contacts" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Rehber</span>
                </button>
              )}

              {hasTrunksPermission && (
                <button
                  onClick={() => setActiveTab("trunks")}
                  title="Dış Hat Tanımı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "trunks"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Cable size={16} className={`shrink-0 ${activeTab === "trunks" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Dış Hat Tanımı</span>
                </button>
              )}

              {hasConferencesPermission && (
                <button
                  onClick={() => setActiveTab("conferences")}
                  title="Konferans"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "conferences"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "conferences" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Konferans</span>
                </button>
              )}

              {hasSpeedDialPermission && (
                <button
                  onClick={() => setActiveTab("speed-dial")}
                  title="Hızlı Arama"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "speed-dial"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <PhoneCall size={16} className={`shrink-0 ${activeTab === "speed-dial" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hızlı Arama</span>
                </button>
              )}

              {hasBlacklistPermission && (
                <button
                  onClick={() => setActiveTab("blacklist")}
                  title="Numara Engelleme"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "blacklist"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <ShieldAlert size={16} className={`shrink-0 ${activeTab === "blacklist" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Numara Engelleme</span>
                </button>
              )}

              {hasScheduledReportsPermission && (
                <button
                  onClick={() => setActiveTab("scheduled-reports")}
                  title="Zamanlanmış Raporlar"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "scheduled-reports"
                      ? `${lightBg} text-primary ${borderLight} shadow-sm`
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Calendar size={16} className={`shrink-0 ${activeTab === "scheduled-reports" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Zamanlanmış Raporlar</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 3: Çağrı & Yönlendirme */}
          <div className="flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => toggleCategory("routing")}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Çağrı & Yönlendirme</span>
                <ChevronDown
                  size={12}
                  className={`transform transition-transform duration-200 shrink-0 ${
                    openCategories.routing ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                isSidebarCollapsed || openCategories.routing ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("call-flow")}
                title="Arama Akış Yönetimi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-flow"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <GitBranch size={16} className={`shrink-0 ${activeTab === "call-flow" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Arama Akış Yönetimi</span>
              </button>

              <button
                onClick={() => setActiveTab("dialer")}
                title="Dış Arama (Dialer)"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "dialer"
                    ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-100/80 dark:border-blue-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneCall size={16} className={`shrink-0 ${activeTab === "dialer" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Dış Arama (Dialer)</span>
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                title="Randevu Takvimi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "calendar"
                    ? "bg-amber-50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/80 dark:border-amber-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Calendar size={16} className={`shrink-0 ${activeTab === "calendar" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Randevu Takvimi</span>
              </button>
            </div>
          </div>

          {/* Group 4: Çağrı Raporları & Analiz */}
          {hasReportsPermission && (
            <div className="flex flex-col gap-1">
              {!isSidebarCollapsed ? (
                <button
                  onClick={() => toggleCategory("reportsGroup")}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
                >
                  <span>Çağrı Raporları & Analiz</span>
                  <ChevronDown
                    size={12}
                    className={`transform transition-transform duration-200 shrink-0 ${
                      openCategories.reportsGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                    }`}
                  />
                </button>
              ) : (
                <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
              )}
            
            <div
              className={`space-y-1 overflow-y-auto transition-all duration-300 scrollbar-thin ${isSidebarCollapsed ? "pr-0" : "pr-1.5"} ${
                isSidebarCollapsed || openCategories.reportsGroup ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.some(p => p.startsWith("reports_custom_builder:") || p === "reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-custom-builder")}
                  title="Raporlar: Özel Rapor Tasarımcısı & AI Rapor Üretici"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-custom-builder"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-custom-builder" ? "text-primary" : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Özel Rapor Tasarımcısı</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("reports-pano")}
                title="Raporlar: Pano"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-pano"
                    ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/80 dark:border-purple-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Monitor size={16} className={`shrink-0 ${activeTab === "reports-pano" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Pano</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-cdr")}
                title="Raporlar: CDR"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-cdr"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <FileText size={16} className={`shrink-0 ${activeTab === "reports-cdr" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>CDR</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-audio")}
                title="Raporlar: Ses Kayıtları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-audio"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Volume2 size={16} className={`shrink-0 ${activeTab === "reports-audio" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Ses Kayıtları</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-transcripts")}
                title="Raporlar: Çağrı Transkripti"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transcripts"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare size={16} className={`shrink-0 ${activeTab === "reports-transcripts" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Çağrı Transkripti</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-sentiment")}
                title="Raporlar: Duygu Analizi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-sentiment" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Duygu Analizi</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-intent")}
                title="Raporlar: Niyet Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-intent"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Layers size={16} className={`shrink-0 ${activeTab === "reports-intent" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Niyet Raporu</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-qa")}
                title="Raporlar: Kalite Değerlendirmeleri"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-qa"
                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Award size={16} className={`shrink-0 ${activeTab === "reports-qa" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kalite Değerlendirmeleri</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-notes")}
                title="Raporlar: Temsilci Notları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-notes"
                    ? "bg-emerald-50 dark:bg-emerald-955/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ClipboardList size={16} className={`shrink-0 ${activeTab === "reports-notes" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Notları</span>
              </button>

              {/* Temsilci Performans ve KPI Raporu */}
              <button
                onClick={() => setActiveTab("reports-perf")}
                title="Raporlar: Temsilci Performans & KPI"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-perf"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Award size={16} className={`shrink-0 ${activeTab === "reports-perf" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Performans & KPI</span>
              </button>

              {/* Kuyruk / Bekleme Analitiği */}
              <button
                onClick={() => setActiveTab("reports-queue")}
                title="Raporlar: Kuyruk / Bekleme Analitiği"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-queue"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Users size={16} className={`shrink-0 ${activeTab === "reports-queue" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kuyruk / Bekleme Analitiği</span>
              </button>

              {/* ACD Kuyruk Memnuniyet Anketi Raporları */}
              <button
                onClick={() => setActiveTab("reports-survey")}
                title="Raporlar: Anket Raporları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-survey"
                    ? "bg-amber-50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/80 dark:border-amber-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-survey" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Anket Raporları</span>
              </button>

              {/* Duygu Durumu Isı Haritası */}
              <button
                onClick={() => setActiveTab("reports-sentiment-heat")}
                title="Raporlar: Duygu Durumu Isı Haritası"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment-heat"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Activity size={16} className={`shrink-0 ${activeTab === "reports-sentiment-heat" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Duygu Durumu Isı Haritası</span>
              </button>

              {/* Kelime Bulutu ve Konu Trendleri */}
              <button
                onClick={() => setActiveTab("reports-wordcloud")}
                title="Raporlar: Kelime Bulutu & Trendler"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-wordcloud"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare size={16} className={`shrink-0 ${activeTab === "reports-wordcloud" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kelime Bulutu & Trendler</span>
              </button>

              {/* FCR */}
              <button
                onClick={() => setActiveTab("reports-fcr")}
                title="Raporlar: İlk Aramada Çözüm (FCR)"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-fcr"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <CheckCircle size={16} className={`shrink-0 ${activeTab === "reports-fcr" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>İlk Aramada Çözüm (FCR)</span>
              </button>

              {/* AI vs. İnsan Karşılaştırmalı ROI Paneli */}
              <button
                onClick={() => setActiveTab("reports-roi")}
                title="Raporlar: AI vs. İnsan ROI Paneli"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-roi"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <TrendingUp size={16} className={`shrink-0 ${activeTab === "reports-roi" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI vs. İnsan ROI Paneli</span>
              </button>

              {/* Kaçan Çağrı Analizi */}
              <button
                onClick={() => setActiveTab("reports-missed")}
                title="Raporlar: Kaçan Çağrı Analizi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-missed"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneOff size={16} className={`shrink-0 ${activeTab === "reports-missed" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kaçan Çağrı Analizi</span>
              </button>

              {/* Agent Status Timeline */}
              <button
                onClick={() => setActiveTab("reports-agent-status-timeline")}
                title="Raporlar: Temsilci Kronolojisi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-agent-status-timeline"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Clock size={16} className={`shrink-0 ${activeTab === "reports-agent-status-timeline" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Kronolojisi</span>
              </button>

              {/* Hourly/Daily Traffic Load */}
              <button
                onClick={() => setActiveTab("reports-traffic-load")}
                title="Raporlar: Yoğunluk Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-traffic-load"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Calendar size={16} className={`shrink-0 ${activeTab === "reports-traffic-load" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Yoğunluk Raporu</span>
              </button>

              {/* Trunk Utilization */}
              <button
                onClick={() => setActiveTab("reports-trunk")}
                title="Raporlar: Hat Kapasite Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-trunk"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Cpu size={16} className={`shrink-0 ${activeTab === "reports-trunk" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hat Kapasite Raporu</span>
              </button>

              {/* DID Report */}
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_did:access") || currentRolePermissions.includes("reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-did")}
                  title="Raporlar: DID Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-did"
                      ? `${lightBg} ${text} ${borderLight} shadow-sm`
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Hash size={16} className={`shrink-0 ${activeTab === "reports-did" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>DID Raporu</span>
                </button>
              )}

              {/* Trunk Minutes & Monthly Package Report */}
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_trunk_minutes:access") || currentRolePermissions.includes("reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-trunk-minutes")}
                  title="Raporlar: Operatör Dakika & Paket Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-trunk-minutes"
                      ? `${lightBg} ${text} ${borderLight} shadow-sm`
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Clock size={16} className={`shrink-0 ${activeTab === "reports-trunk-minutes" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Operatör Dakika & Paket</span>
                </button>
              )}

              {/* Invalid & Unmatched Calls Report */}
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_invalid_calls:access") || currentRolePermissions.includes("reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-invalid-calls")}
                  title="Raporlar: Hatalı & Eşleşmeyen Çağrı Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-invalid-calls"
                      ? `${lightBg} ${text} ${borderLight} shadow-sm`
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <AlertTriangle size={16} className={`shrink-0 ${activeTab === "reports-invalid-calls" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hatalı & Eşleşmeyen Çağrı</span>
                </button>
              )}

              {/* IVR Drop-Off */}
              <button
                onClick={() => setActiveTab("reports-ivr-drop")}
                title="Raporlar: IVR Terk Oranı"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ivr-drop"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Shuffle size={16} className={`shrink-0 ${activeTab === "reports-ivr-drop" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>IVR Terk Oranı</span>
              </button>

              {/* Transfer & Hold Analytics */}
              <button
                onClick={() => setActiveTab("reports-transfer-hold")}
                title="Raporlar: Aktarma & Bekletme"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transfer-hold"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <PhoneForwarded size={16} className={`shrink-0 ${activeTab === "reports-transfer-hold" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Aktarma & Bekletme</span>
              </button>

              {/* AI vs. Human A/B Testing */}
              <button
                onClick={() => setActiveTab("reports-ab-testing")}
                title="Raporlar: Verimlilik Karşılaştırması"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ab-testing"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Layers size={16} className={`shrink-0 ${activeTab === "reports-ab-testing" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Verimlilik Karşılaştırması</span>
              </button>

              {/* Customer Frustration / Friction Points */}
              <button
                onClick={() => setActiveTab("reports-friction")}
                title="Raporlar: Müşteri Çile Noktaları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-friction"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Frown size={16} className={`shrink-0 ${activeTab === "reports-friction" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Müşteri Çile Noktaları</span>
              </button>

              {/* Agent Compliance & Script Adherence */}
              <button
                onClick={() => setActiveTab("reports-compliance")}
                title="Raporlar: Senaryo Sadakati Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-compliance"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ShieldCheck size={16} className={`shrink-0 ${activeTab === "reports-compliance" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Senaryo Sadakati Raporu</span>
              </button>

              {/* Silence & Interruption Analytics */}
              <button
                onClick={() => setActiveTab("reports-silence")}
                title="Raporlar: Sessizlik & Söz Kesme"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-silence"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MicOff size={16} className={`shrink-0 ${activeTab === "reports-silence" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sessizlik & Söz Kesme</span>
              </button>

              {/* Executive Summary Generator */}
              <button
                onClick={() => setActiveTab("reports-ceo-summary")}
                title="Raporlar: CEO Özet Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ceo-summary"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100/80 dark:border-emerald-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Crown size={16} className={`shrink-0 ${activeTab === "reports-ceo-summary" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>CEO Özet Raporu</span>
              </button>

              {[
                { tab: "reports-breaks-attendance", perm: "reports_breaks_attendance:access", label: "Mola & Puantaj Raporu", Icon: Coffee },
                { tab: "reports-omnichannel", perm: "reports_omnichannel:access", label: "Omnichannel Kanal & SLA", Icon: MessageSquare },
                { tab: "reports-disposition", perm: "reports_disposition:access", label: "Çağrı Sonuç Kodları", Icon: Tag },
                { tab: "reports-dialer-callback", perm: "reports_dialer_callback:access", label: "Kampanya & Geri Arama", Icon: PhoneOutgoing },
                { tab: "reports-queue-sla", perm: "reports_queue_sla:access", label: "Kuyruk SLA & Hız Dilimleri", Icon: Target },
                { tab: "reports-repeat-callers", perm: "reports_repeat_callers:access", label: "Tekrar Eden Arayanlar", Icon: Repeat },
                { tab: "reports-dept-pickup", perm: "reports_dept_pickup:access", label: "Departman & Çağrı Toplama", Icon: Building2 },
                { tab: "reports-voip-quality", perm: "reports_voip_quality:access", label: "VoIP & Ses Kalitesi (MOS)", Icon: Wifi },
                { tab: "reports-forwarding-gsm", perm: "reports_forwarding_gsm:access", label: "Yönlendirme (Follow-Me / GSM)", Icon: PhoneForwarded },
                { tab: "reports-supervisor-audit", perm: "reports_supervisor_audit:access", label: "Süpervizör Dinleme & Müdahale", Icon: Eye },
                { tab: "reports-blacklist-security", perm: "reports_blacklist_security:access", label: "Engellenen Çağrı & İhlal", Icon: ShieldAlert },
                { tab: "reports-ai-appointments-rag", perm: "reports_ai_appointments_rag:access", label: "AI Randevu & Bilgi Bankası", Icon: Bot },
                { tab: "reports-voicemail", perm: "reports_voicemail:access", label: "Sesli Posta (Voicemail)", Icon: Mail },
                { tab: "reports-conferences", perm: "reports_conferences:access", label: "Konferans Odası Kullanımı", Icon: Users }
              ].map(({ tab, perm, label, Icon }) => {
                const allowed =
                  currentUser?.role === "admin" ||
                  !Array.isArray(currentRolePermissions) ||
                  currentRolePermissions.includes(perm) ||
                  currentRolePermissions.includes("reports:access");
                if (!allowed) return null;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    title={`Raporlar: ${label}`}
                    className={`w-full flex items-center ${
                      isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                    } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                      activeTab === tab
                        ? `${lightBg} text-primary ${borderLight} shadow-sm`
                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 ${activeTab === tab ? "text-primary" : ""}`} />
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Group 5: Yönetim & Ayarlar (Sadece Superadmin / Sistem Yöneticisi) */}
          {currentUser?.role === 'admin' && (
          <div className="flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => toggleCategory("system")}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 transition tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Yönetim & Ayarlar</span>
                <ChevronDown
                  size={12}
                  className={`transform transition-transform duration-200 shrink-0 ${
                    openCategories.system ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              className={`space-y-1 overflow-hidden transition-all duration-300 ${
                isSidebarCollapsed || openCategories.system ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("settings")}
                title="Sistem Ayarları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "settings"
                    ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Settings size={16} className={`shrink-0 ${activeTab === "settings" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sistem Ayarları</span>
              </button>

              <button
                onClick={() => setActiveTab("system-status")}
                title="Sistem Panosu & Sağlık"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "system-status"
                    ? "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-100/80 dark:border-cyan-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Server size={16} className={`shrink-0 ${activeTab === "system-status" ? "text-cyan-500" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sistem Panosu & Sağlık</span>
              </button>

              <button
                onClick={() => setActiveTab("event-logs")}
                title="Olay Günlükleri"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "event-logs"
                    ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <FileText size={16} className={`shrink-0 ${activeTab === "event-logs" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Olay Günlükleri</span>
              </button>

              <button
                onClick={() => setActiveTab("sip-debugger")}
                title="SIP Trafik (sngrep)"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "sip-debugger"
                    ? "bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Terminal size={16} className={`shrink-0 ${activeTab === "sip-debugger" ? "text-indigo-500" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>SIP Trafik (sngrep)</span>
              </button>

              <button
                onClick={() => setActiveTab("security")}
                title="Güvenlik Kalkanı"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "security"
                    ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ShieldAlert size={16} className={`shrink-0 ${activeTab === "security" ? "text-primary" : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Güvenlik Kalkanı</span>
              </button>
            </div>
          </div>
          )}
        </nav>

        {/* Footer info */} 
        <div
          className={`border-t border-slate-100 dark:border-slate-800 pt-4 text-[10px] text-slate-500 dark:text-slate-400 space-y-2 transition-all duration-300 ${
            isSidebarCollapsed ? "flex flex-col items-center text-center" : ""
          }`}
        >
          <p
            title="Sistem Çevrimiçi"
            className="flex items-center gap-1.5 text-primary dark:text-emerald-400 font-bold"
          >
            <span className="h-2 w-2 rounded-full bg-primary dark:bg-emerald-400 animate-pulse shrink-0"></span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}>Sistem Çevrimiçi</span>
          </p>
          <button
            onClick={() => setActiveTab("changelog")}
            title="Sistem Versiyonu ve Değişiklik Günlüğü (v2.6.9 On-Premise)"
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 hover:underline transition cursor-pointer bg-transparent border-0 p-0 outline-none"
          >
            <span>{isSidebarCollapsed ? "v2.6.9" : "v2.6.9 (On-Premise)"}</span>
          </button>
        </div>
      </aside>
      )}

      {/* Collapsed Sidebar Instant Floating Tooltip */}
      {!isEditingCallFlow && isSidebarCollapsed && sidebarTooltip && (
        <div
          style={{
            top: `${sidebarTooltip.top}px`,
            left: `${sidebarTooltip.left}px`,
          }}
          className="fixed z-[9999] -translate-y-1/2 pointer-events-none flex items-center animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="w-2.5 h-2.5 rotate-45 bg-slate-900 dark:bg-slate-800 border-l border-b border-slate-700/70 -mr-1.5 z-10" />
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold tracking-wide whitespace-nowrap shadow-xl border border-slate-700/70">
            {sidebarTooltip.label}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950/40 transition-colors duration-300">
        
        {/* Top Header Navbar */}
        {!isEditingCallFlow && (
        <header className="relative z-40 h-16 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-5 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md transition-colors duration-300 gap-3">
          <div className="flex items-center gap-3 shrink-0">
            {activeTab === "call-center" && (isAgentOnlyUser || isAgentFullScreenMode) && (
              <div className="flex items-center gap-2.5 pr-2">
                <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                    <span className="text-rose-600 dark:text-rose-500">AI</span>DA
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    TEMSİLCİ ÇAĞRI PANELİ
                  </div>
                </div>
              </div>
            )}

            {activeTab === "wallboard" && isWallboardOnlyUser && (
              <div className="flex items-center gap-2.5 pr-2">
                <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
                  <Monitor size={18} />
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                    <span className="text-rose-600 dark:text-rose-500">AI</span>DA
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    CANLI İZLEME PANELİ
                  </div>
                </div>
              </div>
            )}

            {activeTab === "call-center" && !isAgentOnlyUser && (
              <button
                type="button"
                onClick={() => setIsAgentFullScreenMode((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={
                  isAgentFullScreenMode
                    ? "Sol Menüyü Göster"
                    : "Sol Menüyü Gizle (Tam Ekran Çağrı Paneli)"
                }
              >
                {isAgentFullScreenMode ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                <span className="hidden xl:inline">
                  {isAgentFullScreenMode ? "Menüyü Göster" : "Tam Ekran Panel"}
                </span>
              </button>
            )}

            {((currentUser?.username === "admin" || currentUser?.id === "admin") || (typeof window !== "undefined" && (localStorage.getItem("current_user_id") === "admin" || sessionStorage.getItem("current_user_id") === "admin"))) && (
              <TenantSwitcher backendHost={backendHost} currentUser={currentUser} />
            )}
          </div>

          {/* Agent Top Navigation Portal Slot (Üst Bar Modu Aktifken Sekmeler ve Kuyruk Oturumu Doğrudan Üst Bara Gelir) */}
          {activeTab === "call-center" && (isAgentOnlyUser || currentUser?.role === "agent" || isAgentFullScreenMode || callPanelPrefs?.navPosition === "top") && (
            <div id="agent-top-nav-slot" className="flex-1 flex items-center justify-between px-2 min-w-0 overflow-hidden" />
          )}

          {/* Global Search & Action Center Bar */}
          {!isAgentOnlyUser && !isWallboardOnlyUser && currentUser?.role !== "agent" && !(activeTab === "call-center" && (isAgentFullScreenMode || callPanelPrefs?.navPosition === "top")) && (
            <GlobalSearchBar
              backendHost={backendHost}
              currentUser={currentUser}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onOpenProfileModal={(modalTab) => {
                setActiveModalTab(modalTab || "profile");
                setSettingsModalOpen(true);
              }}
              onQuickProfileSwitch={handleQuickProfileSwitch}
              onToggleTheme={toggleTheme}
              isDarkMode={isDarkMode}
              onApplyChanges={handleApplyChanges}
              hasPendingChanges={hasPendingChanges}
              onLogout={handleLogout}
              onUpdateCallPanelPrefs={(patch) => {
                const current = loadCallPanelPrefs(currentUser);
                const next = saveCallPanelPrefs(currentUser, { ...current, ...patch });
                setCallPanelPrefs(next);
                persistUserVisualPatch({ call_panel_prefs: next });
              }}
            />
          )}

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
            {!isAgentOnlyUser && !isWallboardOnlyUser && (currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_config_assistant:")))) && (
              <button
                type="button"
                onClick={() => setActiveTab("ai-config-assistant")}
                title="AI Konfigürasyon Asistanı (Doğal Dil & Sesli Dikte)"
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === "ai-config-assistant"
                    ? `${bg} text-white border-transparent shadow-sm`
                    : `${lightBg} ${text} ${borderLight} hover:opacity-90`
                }`}
              >
                <Sparkles size={14} />
                <span>AI Konfigürasyon Asistanı</span>
              </button>
            )}
            {currentUser?.role === 'admin' && hasPendingChanges && (
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={handleApplyChanges}
                  disabled={isApplying || applyStatus === 'success'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold transition-all shadow-sm ${
                    applyStatus === 'success' ? 'bg-emerald-500 cursor-default' :
                    applyStatus === 'error' ? 'bg-rose-600 hover:bg-rose-500' :
                    isApplying ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20 animate-pulse'
                  }`}
                >
                  {applyStatus === 'success' ? <CheckCircle size={16} /> :
                   applyStatus === 'error' ? <AlertTriangle size={16} /> :
                   isApplying ? <Activity size={16} className="animate-spin" /> : <Layers size={16} />}
                  
                  {applyStatus === 'success' ? 'Uygulandı' :
                   applyStatus === 'error' ? 'Uygulanamadı' : 'Uygula'}
                </button>
                {applyStatus === 'error' && (
                  <button
                    type="button"
                    onClick={() => setShowApplyErrorModal(true)}
                    className="p-1 rounded-xl bg-rose-100/80 dark:bg-rose-955/40 text-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-all cursor-pointer flex items-center justify-center border border-rose-200 dark:border-rose-900/50 shadow-sm"
                    title="Hata detayını görüntülemek için tıklayın"
                  >
                    <AlertTriangle size={18} className="animate-pulse text-rose-600 dark:text-rose-400" />
                  </button>
                )}
              </div>
            )}

            {licenseStatus && (!licenseStatus.valid || licenseStatus.status === "passive") && (
              <button
                onClick={() => setIsLicenseModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse cursor-pointer"
                title="Sistem Lisans Yönetimi"
              >
                <ShieldAlert size={15} className="text-rose-500" />
                <span className="text-rose-600 dark:text-rose-400 font-extrabold">⚠️ LİSANS DOLDU</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title={isDarkMode ? "Aydınlık Mod" : "Karanlık Mod"}
            >
              {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-primary" />}
            </button>

            {/* Profile Dropdown */}
            <div ref={profileDropdownRef} className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm focus:outline-none group cursor-pointer"
                title="Kullanıcı Profili ve Menüsü"
              >
                <div className="relative shrink-0">
                  <img
                    src={agentAvatar}
                    alt="Profil"
                    className="w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
                  />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-slate-900 rounded-full ${
                    agentActiveProfile === "away" ? "bg-amber-500" :
                    agentActiveProfile === "meeting" ? "bg-rose-500" :
                    agentActiveProfile === "other" ? "bg-indigo-500" : "bg-emerald-500"
                  }`} />
                </div>
                <div className="hidden sm:flex flex-col text-left pr-0.5 max-w-[140px]">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {currentUser?.full_name || currentUser?.name || currentUser?.username || 'Kullanıcı'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate leading-tight flex items-center gap-1">
                    <span>{currentUser?.role === 'admin' ? 'Yönetici' : currentUser?.role === 'supervisor' ? 'Süpervizör' : 'Temsilci'}</span>
                    <span>•</span>
                    <span className={
                      agentActiveProfile === "away" ? "text-amber-500 font-bold" :
                      agentActiveProfile === "meeting" ? "text-rose-500 font-bold" :
                      agentActiveProfile === "other" ? "text-indigo-500 font-bold" : "text-emerald-500 font-bold"
                    }>
                      {(agentProfiles.find(p => p.id === agentActiveProfile) || DEFAULT_USER_PROFILES[0])?.name}
                    </span>
                  </span>
                </div>
                <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Active User Card Header */}
                  <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={agentAvatar}
                          alt="Profil"
                          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shadow-sm"
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white dark:border-slate-900 rounded-full ${
                          agentActiveProfile === "away" ? "bg-amber-500" :
                          agentActiveProfile === "meeting" ? "bg-rose-500" :
                          agentActiveProfile === "other" ? "bg-indigo-500" : "bg-emerald-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate leading-snug">
                          {currentUser?.full_name || currentUser?.name || currentUser?.username || 'Aktif Kullanıcı'}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {currentUser?.email || (currentUser?.username ? `@${currentUser.username}` : 'Aktif Oturum')}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border " + lightBg + " " + text + " " + borderLight}>
                            <User size={10} className="mr-1 shrink-0" />
                            {currentUser?.role === 'admin' ? 'Sistem Yöneticisi' : currentUser?.role === 'supervisor' ? 'Süpervizör' : 'Çağrı Temsilcisi'}
                          </span>
                          {currentUser?.extension && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                              Dahili: {currentUser.extension}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Profile Switcher (Müsait, Dışarıda, Toplantı, Diğer) */}
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Aktif Profil Seçimi
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setActiveModalTab("profiles");
                          setSettingsModalOpen(true);
                        }}
                        className={`text-[10px] font-bold ${text} hover:underline cursor-pointer`}
                      >
                        Profilleri Özelleştir
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {agentProfiles.map((prof) => {
                        const isAct = agentActiveProfile === prof.id;
                        const dotCls =
                          prof.id === "available" ? "bg-emerald-500" :
                          prof.id === "away" ? "bg-amber-500" :
                          prof.id === "meeting" ? "bg-rose-500" : "bg-indigo-500";
                        return (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() => handleQuickProfileSwitch(prof.id)}
                            className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                              isAct
                                ? `${border} ${lightBg} shadow-sm`
                                : "border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                              <span className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{prof.name}</span>
                            </div>
                            {isAct && <Check size={12} className={`${text} shrink-0`} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Menu Actions */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSettingsModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer group"
                    >
                      <Settings size={15} className={`text-slate-500 dark:text-slate-300 group-hover:${text} transition-colors`} />
                      <span>Profil Ayarları</span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut size={15} className="text-rose-500" />
                      <span>Çıkış Yap</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {/* Dynamic View Panel */}
        <div key={activeTenantId} className={`flex-1 overflow-y-auto flex ${isEditingCallFlow ? "p-0 justify-center w-full h-full bg-white dark:bg-slate-950" : activeTab === "call-center" ? "p-3 justify-start items-start w-full h-full" : ["wallboard", "settings", "rag-kb", "rule-editor", "calendar", "system-status", "dialer", "call-flow", "ai-agents", "ai-config-assistant", "changelog", "reports-custom-builder", "reports-pano", "reports-cdr", "reports-audio", "reports-transcripts", "reports-sentiment", "reports-intent", "reports-qa", "reports-notes", "reports-perf", "reports-queue", "reports-survey", "reports-sentiment-heat", "reports-wordcloud", "reports-fcr", "reports-roi", "reports-missed", "reports-agent-status-timeline", "reports-traffic-load", "reports-trunk", "reports-did", "reports-trunk-minutes", "reports-invalid-calls", "reports-ivr-drop", "reports-transfer-hold", "reports-ab-testing", "reports-friction", "reports-compliance", "reports-silence", "reports-ceo-summary", "reports-breaks-attendance", "reports-omnichannel", "reports-disposition", "reports-dialer-callback", "reports-queue-sla", "reports-repeat-callers", "reports-dept-pickup", "reports-voip-quality", "reports-forwarding-gsm", "reports-supervisor-audit", "reports-blacklist-security", "reports-ai-appointments-rag", "reports-voicemail", "reports-conferences", "users", "trunks", "blacklist", "scheduled-reports", "announcements", "acd-queues", "auto-provision", "outbound-rules", "inbound-rules", "call-pickup-groups", "subscriber-groups", "conferences", "speed-dial", "event-logs", "sip-debugger"].includes(activeTab) ? "p-8 justify-start items-start w-full" : "p-8 justify-center"}`}>
          <div className={activeTab === "call-center" ? "w-full h-full flex" : "hidden"}>
            <AgentPanel 
              backendHost={backendHost} 
              currentUser={currentUser} 
              activeCallId={activeCallId} 
              isVisible={activeTab === "call-center"}
              initialPermissions={currentRolePermissions}
            />
          </div>

          {activeTab === "settings" && (
            <SettingsPanel backendHost={backendHost} />
          )}

          {activeTab === "security" && (
            <SecurityPanel backendHost={backendHost} />
          )}

          {activeTab === "sip-debugger" && (
            <SipDebuggerPanel backendHost={backendHost} />
          )}

          {activeTab === "users" && (
            <UserSettings backendHost={backendHost} currentUser={currentUser} />
          )}

          {activeTab === "trunks" && (
            <PBXSettings viewMode="trunks" backendHost={backendHost} />
          )}

          {activeTab === "blacklist" && (
            <BlacklistSettings backendHost={backendHost} />
          )}

          {activeTab === "scheduled-reports" && hasScheduledReportsPermission && (
            <ScheduledReportsPanel
              backendHost={backendHost}
              canWrite={
                currentUser?.role === "admin" ||
                !Array.isArray(currentRolePermissions) ||
                currentRolePermissions.includes("scheduled_reports:write")
              }
              canDelete={
                currentUser?.role === "admin" ||
                !Array.isArray(currentRolePermissions) ||
                currentRolePermissions.includes("scheduled_reports:delete")
              }
            />
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

          {activeTab === "subscriber-groups" && (
            <SubscriberGroupsPanel backendHost={backendHost} />
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

          {activeTab === "reports-intent" && (
            <ReportsPanel backendHost={backendHost} viewMode="intent" />
          )}

          {activeTab === "reports-qa" && (
            <ReportsPanel backendHost={backendHost} viewMode="qa" />
          )}

          {activeTab === "reports-notes" && (
            <ReportsPanel backendHost={backendHost} viewMode="notes" />
          )}

          {activeTab === "reports-perf" && (
            <ReportsPanel backendHost={backendHost} viewMode="perf" />
          )}

          {activeTab === "reports-queue" && (
            <ReportsPanel backendHost={backendHost} viewMode="queue" />
          )}

          {activeTab === "reports-survey" && (
            <div className="w-full">
              <QueueSurveyReportPanel backendHost={backendHost} />
            </div>
          )}

          {activeTab === "reports-sentiment-heat" && (
            <ReportsPanel backendHost={backendHost} viewMode="sentiment-heat" />
          )}

          {activeTab === "reports-wordcloud" && (
            <ReportsPanel backendHost={backendHost} viewMode="wordcloud" />
          )}

          {activeTab === "reports-fcr" && (
            <ReportsPanel backendHost={backendHost} viewMode="fcr" />
          )}

          {activeTab === "reports-roi" && (
            <ReportsPanel backendHost={backendHost} viewMode="roi" />
          )}

          {activeTab === "reports-missed" && (
            <ReportsPanel backendHost={backendHost} viewMode="missed" />
          )}

          {activeTab === "reports-agent-status-timeline" && (
            <ReportsPanel backendHost={backendHost} viewMode="timeline" />
          )}

          {activeTab === "reports-traffic-load" && (
            <ReportsPanel backendHost={backendHost} viewMode="traffic" />
          )}

          {activeTab === "reports-trunk" && (
            <ReportsPanel backendHost={backendHost} viewMode="trunk" />
          )}

          {activeTab === "reports-did" && (currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_did:access") || currentRolePermissions.includes("reports:access")) && (
            <ReportsPanel backendHost={backendHost} viewMode="did" />
          )}

          {activeTab === "reports-trunk-minutes" && (currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_trunk_minutes:access") || currentRolePermissions.includes("reports:access")) && (
            <ReportsPanel backendHost={backendHost} viewMode="trunk-minutes" />
          )}

          {activeTab === "reports-invalid-calls" && (currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_invalid_calls:access") || currentRolePermissions.includes("reports:access")) && (
            <ReportsPanel backendHost={backendHost} viewMode="invalid-calls" />
          )}

          {activeTab === "reports-ivr-drop" && (
            <ReportsPanel backendHost={backendHost} viewMode="ivr-drop" />
          )}

          {activeTab === "reports-transfer-hold" && (
            <ReportsPanel backendHost={backendHost} viewMode="transfer-hold" />
          )}

          {activeTab === "reports-ab-testing" && (
            <ReportsPanel backendHost={backendHost} viewMode="efficiency" />
          )}

          {activeTab === "reports-friction" && (
            <ReportsPanel backendHost={backendHost} viewMode="friction" />
          )}

          {activeTab === "reports-compliance" && (
            <ReportsPanel backendHost={backendHost} viewMode="compliance" />
          )}


          {activeTab === "reports-silence" && (
            <ReportsPanel backendHost={backendHost} viewMode="silence" />
          )}

          {activeTab === "reports-ceo-summary" && (
            <ReportsPanel backendHost={backendHost} viewMode="ceo-summary" />
          )}

          {[
            { tab: "reports-breaks-attendance", perm: "reports_breaks_attendance:access", type: "breaks-attendance" },
            { tab: "reports-omnichannel", perm: "reports_omnichannel:access", type: "omnichannel" },
            { tab: "reports-disposition", perm: "reports_disposition:access", type: "disposition" },
            { tab: "reports-dialer-callback", perm: "reports_dialer_callback:access", type: "dialer-callback" },
            { tab: "reports-queue-sla", perm: "reports_queue_sla:access", type: "queue-sla" },
            { tab: "reports-repeat-callers", perm: "reports_repeat_callers:access", type: "repeat-callers" },
            { tab: "reports-dept-pickup", perm: "reports_dept_pickup:access", type: "dept-pickup" },
            { tab: "reports-voip-quality", perm: "reports_voip_quality:access", type: "voip-quality" },
            { tab: "reports-forwarding-gsm", perm: "reports_forwarding_gsm:access", type: "forwarding-gsm" },
            { tab: "reports-supervisor-audit", perm: "reports_supervisor_audit:access", type: "supervisor-audit" },
            { tab: "reports-blacklist-security", perm: "reports_blacklist_security:access", type: "blacklist-security" },
            { tab: "reports-ai-appointments-rag", perm: "reports_ai_appointments_rag:access", type: "ai-appointments-rag" },
            { tab: "reports-voicemail", perm: "reports_voicemail:access", type: "voicemail" },
            { tab: "reports-conferences", perm: "reports_conferences:access", type: "conferences" }
          ].map(({ tab, perm, type }) => {
            if (activeTab !== tab) return null;
            const allowed =
              currentUser?.role === "admin" ||
              !Array.isArray(currentRolePermissions) ||
              currentRolePermissions.includes(perm) ||
              currentRolePermissions.includes("reports:access");
            if (!allowed) return null;
            return <EnterpriseReportsPanel key={tab} backendHost={backendHost} reportType={type} />;
          })}

          {activeTab === "dialer" && (
            <DialerSettings backendHost={backendHost} />
          )}

          {activeTab === "call-flow" && (
            <CallFlowEditor backendHost={backendHost} onEditStateChange={setIsEditingCallFlow} />
          )}

          {activeTab === "reports-custom-builder" && (
            <div className="w-full">
              <CustomReportBuilderPanel
                userPermissions={currentUser?.role === "admin" ? ["*"] : currentRolePermissions}
              />
            </div>
          )}

          {activeTab === "ai-config-assistant" && (
            <div className="w-full">
              <AIConfigAssistantPanel
                userPermissions={currentUser?.role === "admin" ? ["*"] : currentRolePermissions}
                onNavigateTab={(mainTab, subTab) => {
                  setActiveTab(mainTab);
                  if (subTab && typeof window !== "undefined") {
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("SWITCH_SETTINGS_SUBTAB", { detail: { subTab } }));
                    }, 50);
                  }
                }}
              />
            </div>
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
            <WallboardPanel backendHost={backendHost} currentUser={currentUser} />
          )}

          {activeTab === "api-budgets" && (
            <APIBudgetSettings backendHost={backendHost} />
          )}

          {activeTab === "system-status" && (
            <SystemStatusPanel backendHost={backendHost} />
          )}

          {activeTab === "changelog" && (
            <ChangelogPanel backendHost={backendHost} onBack={() => setActiveTab("dashboard")} />
          )}
        </div>

        {/* Profile & Ringtone Settings Modal */}
        {settingsModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 transition-all duration-300">
            <div className="w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-50 dark:bg-violet-950/20 text-violet-500 rounded-xl">
                    <Settings size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">Temsilci Profil Ayarları</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Kişisel arayüz tercihlerinizi, çağrı zil sesini ve canlı izleme panelinizi özelleştirin.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopRingtoneSound();
                    localStorage.setItem("temp_playing", "false");
                    setSettingsModalOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Tabs (UserSettings style) */}
                <div className="w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto">
                  <nav className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("profile")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "profile" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <User size={16} />
                      Profil & Tema
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("profiles")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "profiles" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Users size={16} />
                      Profiller
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("hardware")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "hardware" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Volume2 size={16} />
                      Donanım & Santral
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("forwarding")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "forwarding" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <PhoneForwarded size={16} />
                      Yönlendirme
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("security")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "security" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <ShieldCheck size={16} />
                      Güvenlik
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("call_panel")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "call_panel" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <LayoutGrid size={16} />
                      Çağrı Paneli
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("wallboard")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "wallboard" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Monitor size={16} />
                      Canlı İzleme Paneli
                    </button>
                  </nav>
                </div>

                {/* Right Tab Content Area */}
                <div className="flex-1 overflow-y-auto p-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">

                    {/* Canlı İzleme Paneli (Wallboard) Özelleştirme Sekmesi */}
                    {activeModalTab === "wallboard" && (
                      <WallboardStudioSettings
                        backendHost={backendHost}
                        currentUserId={currentUser?.id || currentUser?.extension || "admin"}
                        currentUser={currentUser}
                      />
                    )}

                    {/* Çağrı Paneli Görünüm ve Sıralama Özelleştirme Sekmesi */}
                    {activeModalTab === "call_panel" && (() => {
                  const hasConfiguredRoleTabs = Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("call_panel:tab_"));
                  const isTabAllowedByRole = (tabObj) => {
                    if (!tabObj) return false;
                    if (!hasConfiguredRoleTabs) return true;
                    return currentRolePermissions.includes(tabObj.perm);
                  };

                  const currentOrder = Array.isArray(callPanelPrefs?.tabOrder) && callPanelPrefs.tabOrder.length > 0
                    ? callPanelPrefs.tabOrder
                    : DEFAULT_CALL_PANEL_PREFS.tabOrder;

                  const orderedTabItems = currentOrder
                    .map(id => CALL_PANEL_ALL_TABS.find(t => t.id === id))
                    .filter(t => isTabAllowedByRole(t));

                  // Ensure any missing allowed tabs from CALL_PANEL_ALL_TABS are appended
                  CALL_PANEL_ALL_TABS.forEach(t => {
                    if (isTabAllowedByRole(t) && !orderedTabItems.some(item => item.id === t.id)) {
                      orderedTabItems.push(t);
                    }
                  });

                  const updatePrefsLive = (patch) => {
                    const next = {
                      ...callPanelPrefs,
                      ...patch
                    };
                    setCallPanelPrefs(next);
                    saveCallPanelPrefs(currentUser, next);
                    persistUserVisualPatch({ call_panel_prefs: next });
                  };

                  const moveTabItem = (index, direction) => {
                    const targetIndex = index + direction;
                    if (targetIndex < 0 || targetIndex >= orderedTabItems.length) return;
                    const nextIds = orderedTabItems.map(t => t.id);
                    const [moved] = nextIds.splice(index, 1);
                    nextIds.splice(targetIndex, 0, moved);
                    updatePrefsLive({ tabOrder: nextIds });
                  };

                  const handleDragStart = (idx) => {
                    setDraggedPanelTabIdx(idx);
                  };

                  const handleDragOver = (e, idx) => {
                    e.preventDefault();
                    if (draggedPanelTabIdx === null || draggedPanelTabIdx === idx) return;
                    const nextIds = orderedTabItems.map(t => t.id);
                    const [moved] = nextIds.splice(draggedPanelTabIdx, 1);
                    nextIds.splice(idx, 0, moved);
                    setDraggedPanelTabIdx(idx);
                    updatePrefsLive({ tabOrder: nextIds });
                  };

                  const handleDragEnd = () => {
                    setDraggedPanelTabIdx(null);
                  };

                  const resetTabOrder = () => {
                    updatePrefsLive({
                      navPosition: DEFAULT_CALL_PANEL_PREFS.navPosition,
                      viewMode: DEFAULT_CALL_PANEL_PREFS.viewMode,
                      boxSize: DEFAULT_CALL_PANEL_PREFS.boxSize,
                      tabOrder: [...DEFAULT_CALL_PANEL_PREFS.tabOrder]
                    });
                  };

                  return (
                    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                      {/* 0. Menü Konumu & Yerleşim Düzeni (Sol Menü / Üst Bar) */}
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                              Menü Konumu & Ekran Yerleşimi
                            </h5>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Çağrı paneli sekmelerini ve kuyruk oturum kontrolünü sol dikey menüde veya üst barda konumlandırın.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${lightBg} ${text} border ${borderLight}`}>
                            {callPanelPrefs.navPosition === "top" ? "Üst Bar (Tam Genişlik)" : "Sol Menü (Klasik)"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Sol Menü (Dikey Yerleşim) */}
                          <button
                            type="button"
                            onClick={() => updatePrefsLive({ navPosition: "left" })}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-3 cursor-pointer ${
                              callPanelPrefs.navPosition !== "top"
                                ? `${lightBg} ${border} ring-2 ${ring}`
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            {/* Görsel Şema Önizlemesi - Sol Menü */}
                            <div className="w-full h-20 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-2 flex flex-col gap-1.5 overflow-hidden">
                              {/* Üst Bar Çizgisi */}
                              <div className="h-3 w-full rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between px-1.5">
                                <div className="w-6 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <div className="w-8 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                              </div>
                              {/* Gövde: Sol Menü + İçerik */}
                              <div className="flex-1 flex gap-1.5 min-h-0">
                                <div className={`w-12 rounded-md p-1 flex flex-col justify-between border ${
                                  callPanelPrefs.navPosition !== "top"
                                    ? `${lightBg} ${border}`
                                    : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800"
                                }`}>
                                  <div className="space-y-1">
                                    <div className={`h-1.5 w-full rounded-sm ${callPanelPrefs.navPosition !== "top" ? bg : "bg-slate-400 dark:bg-slate-600"}`} />
                                    <div className="h-1 w-4/5 rounded-sm bg-slate-300 dark:bg-slate-700" />
                                    <div className="h-1 w-3/4 rounded-sm bg-slate-300 dark:bg-slate-700" />
                                  </div>
                                  <div className="h-2.5 w-full rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
                                </div>
                                <div className="flex-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-1.5 flex flex-col gap-1">
                                  <div className="h-2 w-1/3 rounded-sm bg-slate-200 dark:bg-slate-800" />
                                  <div className="flex-1 grid grid-cols-2 gap-1">
                                    <div className="rounded-sm bg-slate-100 dark:bg-slate-800/70" />
                                    <div className="rounded-sm bg-slate-100 dark:bg-slate-800/70" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                                  <span>Sol Menü (Dikey Yerleşim)</span>
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                  Sekmeler ve kuyruk oturum kartı sol sütunda yer alır. Klasik dikey kontrol düzeni.
                                </p>
                              </div>
                              {callPanelPrefs.navPosition !== "top" && (
                                <CheckCircle size={15} className={`${text} shrink-0 mt-0.5`} />
                              )}
                            </div>
                          </button>

                          {/* Üst Bar (Yatay Tam Genişlik Yerleşim) */}
                          <button
                            type="button"
                            onClick={() => updatePrefsLive({ navPosition: "top" })}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-3 cursor-pointer ${
                              callPanelPrefs.navPosition === "top"
                                ? `${lightBg} ${border} ring-2 ${ring}`
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            {/* Görsel Şema Önizlemesi - Üst Bar */}
                            <div className="w-full h-20 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-2 flex flex-col gap-1.5 overflow-hidden">
                              {/* Üst Bar (Sekmeler + Oturum Kartı Aktif) */}
                              <div className={`h-5 w-full rounded-md px-1.5 flex items-center justify-between border ${
                                callPanelPrefs.navPosition === "top"
                                  ? `${lightBg} ${border}`
                                  : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800"
                              }`}>
                                <div className="flex items-center gap-1">
                                  <div className={`w-6 h-2 rounded-sm ${callPanelPrefs.navPosition === "top" ? bg : "bg-slate-400 dark:bg-slate-600"}`} />
                                  <div className="w-5 h-2 rounded-sm bg-slate-300 dark:bg-slate-700" />
                                  <div className="w-5 h-2 rounded-sm bg-slate-300 dark:bg-slate-700" />
                                  <div className="w-5 h-2 rounded-sm bg-slate-300 dark:bg-slate-700" />
                                </div>
                                <div className="w-10 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
                              </div>
                              {/* Gövde: Tam Genişlik Çalışma Alanı */}
                              <div className="flex-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-1.5 flex flex-col gap-1">
                                <div className="h-2 w-1/4 rounded-sm bg-slate-200 dark:bg-slate-800" />
                                <div className="flex-1 grid grid-cols-3 gap-1">
                                  <div className="rounded-sm bg-slate-100 dark:bg-slate-800/70" />
                                  <div className="rounded-sm bg-slate-100 dark:bg-slate-800/70" />
                                  <div className="rounded-sm bg-slate-100 dark:bg-slate-800/70" />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                                  <span>Üst Bar (Yatay Tam Genişlik)</span>
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                    Yeni
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                  Sekmeler ve mola/oturum kontrolü üst bara taşınır; alt çalışma alanı tam ekran genişliğinde açılır.
                                </p>
                              </div>
                              {callPanelPrefs.navPosition === "top" && (
                                <CheckCircle size={15} className={`${text} shrink-0 mt-0.5`} />
                              )}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* 1. Temsilci Ekranı Görünüm Şekli (Liste / Kutucuk) */}
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                              Temsilci Ekranı Görünüm Düzeni
                            </h5>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Temsilci ekranının ve çağrı paneli seçeneklerinin liste veya kutucuk şeklinde görünmesini seçin.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${lightBg} ${text} border ${borderLight}`}>
                            {callPanelPrefs.viewMode === "box"
                              ? `Kutucuk (${callPanelPrefs.boxSize === "small" ? "Küçük" : "Büyük"})`
                              : "Liste Görünümü"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Liste Görünümü Seçeneği */}
                          <button
                            type="button"
                            onClick={() => updatePrefsLive({ viewMode: "list" })}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                              callPanelPrefs.viewMode === "list"
                                ? `${lightBg} ${border} ring-2 ${ring}`
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              callPanelPrefs.viewMode === "list"
                                ? `${bg} text-white shadow-sm`
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            }`}>
                              <List size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                  Liste Görünümü
                                </span>
                                {callPanelPrefs.viewMode === "list" && (
                                  <CheckCircle size={14} className={text} />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                Temsilci ekranı tablo/satır listesi olarak, çağrı paneli sekmeleri ise yatay şerit halinde gösterilir.
                              </p>
                            </div>
                          </button>

                          {/* Kutucuk Görünümü Seçeneği */}
                          <button
                            type="button"
                            onClick={() => updatePrefsLive({ viewMode: "box" })}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                              callPanelPrefs.viewMode === "box"
                                ? `${lightBg} ${border} ring-2 ${ring}`
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              callPanelPrefs.viewMode === "box"
                                ? `${bg} text-white shadow-sm`
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            }`}>
                              <LayoutGrid size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                  Kutucuk Görünümü
                                </span>
                                {callPanelPrefs.viewMode === "box" && (
                                  <CheckCircle size={14} className={text} />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                Temsilci ekranı ve menü seçenekleri büyük veya küçük kart kutucukları halinde gösterilir.
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Kutucuk Boyutu Seçimi (Büyük / Küçük) */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 block">
                              Kutucuk Boyutu Seçeneği
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Kutucuk görünümünde kartların büyük veya küçük boyutlu olmasını belirleyin.
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => updatePrefsLive({ viewMode: "box", boxSize: "large" })}
                              className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 border ${
                                callPanelPrefs.viewMode === "box" && callPanelPrefs.boxSize === "large"
                                  ? `${bg} text-white border-transparent shadow-sm`
                                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              }`}
                            >
                              <LayoutGrid size={14} />
                              <span>Büyük Kutucuk</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePrefsLive({ viewMode: "box", boxSize: "small" })}
                              className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 border ${
                                callPanelPrefs.viewMode === "box" && callPanelPrefs.boxSize === "small"
                                  ? `${bg} text-white border-transparent shadow-sm`
                                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              }`}
                            >
                              <LayoutGrid size={12} />
                              <span>Küçük Kutucuk</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 2. Temsilciler Sekmesi Kutucuk Boyutu, Sıralama & Durum/Mola Renkleri */}
                      <CallPanelAgentsAppearanceSettings
                        backendHost={backendHost}
                        currentUserId={currentUser?.id || currentUser?.extension || "admin"}
                        currentUser={currentUser}
                      />

                      {/* 3. Temsilci Çağrı Paneli Seçeneklerinin Sıralaması */}
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                              Temsilci Çağrı Paneli Seçenek Sıralaması
                            </h5>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Seçenekleri sürükleyip bırakarak veya sağdaki yukarı/aşağı ok butonlarını kullanarak istediğiniz sıraya dizin (Sol Menü ve Üst Bar için geçerlidir).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={resetTabOrder}
                            className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Varsayılan görünüm ve sıralamaya dön"
                          >
                            <RotateCcw size={12} />
                            <span>Varsayılana Sıfırla</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5">
                          {orderedTabItems.map((tabItem, idx) => {
                            const IconComp = tabItem.icon;
                            const isDragging = draggedPanelTabIdx === idx;
                            return (
                              <div
                                key={tabItem.id}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-move select-none ${
                                  isDragging
                                    ? `${lightBg} ${border} opacity-80 scale-[0.99]`
                                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <GripVertical size={14} className="text-slate-400 shrink-0" />
                                  <span className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                                    {idx + 1}
                                  </span>
                                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                    <IconComp size={13} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                                      {tabItem.name || tabItem.label}
                                    </span>
                                    {tabItem.desc && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                                        {tabItem.desc}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => moveTabItem(idx, -1)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    title="Yukarı Taşı"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === orderedTabItems.length - 1}
                                    onClick={() => moveTabItem(idx, 1)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    title="Aşağı Taşı"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Personal Profiles Tab (Müsait, Dışarıda, Toplantı, Diğer) */}
                {activeModalTab === "profiles" && (() => {
                  const curProf = agentProfiles.find(p => p.id === selectedAgentProfileTab) || agentProfiles[0] || DEFAULT_USER_PROFILES[0];
                  const updateCurProf = (patch) => {
                    setAgentProfiles(prev => prev.map(p => p.id === curProf.id ? { ...p, ...patch } : p));
                  };
                  const toggleProfDevice = (devId) => {
                    const curDevs = Array.isArray(curProf.devices) ? curProf.devices : [];
                    const nextDevs = curDevs.includes(devId)
                      ? curDevs.filter(d => d !== devId)
                      : [...curDevs, devId];
                    updateCurProf({ devices: nextDevs });
                  };

                  return (
                    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider block">
                            Çağrı Profillerim
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Her profil için çalacak cihazları ve zaman aşımı davranışını belirleyin.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Aktif:</span>
                          <select
                            value={agentActiveProfile}
                            onChange={(e) => {
                              setAgentActiveProfile(e.target.value);
                              setSelectedAgentProfileTab(e.target.value);
                            }}
                            className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border ${border} ${lightBg} ${text} focus:outline-none`}
                          >
                            {agentProfiles.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 4 Profile Selector Cards (Without device/timeout sub-info) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {agentProfiles.map((prof) => {
                          const isSel = selectedAgentProfileTab === prof.id;
                          const isAct = agentActiveProfile === prof.id;
                          const dotColor =
                            prof.id === "available" ? "bg-emerald-500" :
                            prof.id === "away" ? "bg-amber-500" :
                            prof.id === "meeting" ? "bg-rose-500" : "bg-indigo-500";
                          return (
                            <div
                              key={prof.id}
                              onClick={() => {
                                setSelectedAgentProfileTab(prof.id);
                                setAgentActiveProfile(prof.id);
                              }}
                              className={`cursor-pointer px-4 py-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 ${
                                isSel
                                  ? `${border} ${lightBg} shadow-sm`
                                  : "border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                                <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">{prof.name}</span>
                              </div>
                              {isAct && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500 text-white shrink-0">
                                  AKTİF
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected Profile Detail */}
                      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-5">
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase">
                              {curProf.name} Profili Ayarları
                            </span>
                            {agentActiveProfile !== curProf.id && (
                              <button
                                type="button"
                                onClick={() => setAgentActiveProfile(curProf.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${bg} ${hover} text-white`}
                              >
                                Aktif Profil Yap
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => updateCurProf({ devices: ["desk_phone", "mobile_app", "web_phone", "pc_app"] })}
                              className="font-bold text-slate-600 dark:text-slate-300 hover:underline"
                            >
                              Tümü
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => updateCurProf({ devices: [] })}
                              className="font-bold text-slate-400 hover:underline"
                            >
                              Hiçbiri
                            </button>
                          </div>
                        </div>

                        {/* Ring Devices */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                            Çalacak Cihazlar (Device)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {RING_DEVICES_METADATA.map((dev) => {
                              const checked = Array.isArray(curProf.devices) && curProf.devices.includes(dev.id);
                              return (
                                <label
                                  key={dev.id}
                                  onClick={() => toggleProfDevice(dev.id)}
                                  className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 select-none ${
                                    checked
                                      ? `bg-white dark:bg-slate-900 ${border} shadow-sm`
                                      : "bg-white/50 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-800/70 opacity-75"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${checked ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                                      {dev.id === "mobile_app" ? <Smartphone size={16} /> : dev.id === "desk_phone" ? <Phone size={16} /> : <Monitor size={16} />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{dev.label}</div>
                                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{dev.desc}</div>
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? `${bg} border-transparent text-white` : "border-slate-300 dark:border-slate-700"}`}>
                                    {checked && <Check size={12} />}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Timeout & Post-Timeout Action */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                              Zaman Aşımı (sn)
                            </label>
                            <input
                              type="number"
                              min="5"
                              max="120"
                              value={curProf.timeout ?? 30}
                              onChange={(e) => updateCurProf({ timeout: Math.max(5, parseInt(e.target.value) || 30) })}
                              className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                              Zaman Aşımı Sonrası İşlem
                            </label>
                            <select
                              value={curProf.timeout_action || "none"}
                              onChange={(e) => updateCurProf({ timeout_action: e.target.value, timeout_target: "" })}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                            >
                              <option value="none">Çağrıyı Sonlandır</option>
                              <option value="voicemail">Sesli Mesaja Aktar</option>
                              <option value="internal">Başka Dahiliye Yönlendir</option>
                              <option value="external">Dış Numaraya Yönlendir</option>
                              <option value="queue">Kuyruğa Aktar</option>
                              <option value="ai_agent">AI Temsilciye Aktar</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                              Hedef Seçimi / Numara
                            </label>
                            {curProf.timeout_action === "internal" ? (
                              <select
                                value={curProf.timeout_target || ""}
                                onChange={(e) => updateCurProf({ timeout_target: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              >
                                <option value="">Dahili Seçiniz...</option>
                                {agentDirectory.filter(d => d.type === "user" && String(d.number) !== String(currentUser?.extension)).map(u => (
                                  <option key={u.id || u.number} value={u.number}>
                                    {u.name} ({u.number})
                                  </option>
                                ))}
                              </select>
                            ) : curProf.timeout_action === "external" ? (
                              <input
                                type="text"
                                placeholder="05321234567"
                                value={curProf.timeout_target || ""}
                                onChange={(e) => updateCurProf({ timeout_target: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              />
                            ) : curProf.timeout_action === "queue" ? (
                              <select
                                value={curProf.timeout_target || ""}
                                onChange={(e) => updateCurProf({ timeout_target: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              >
                                <option value="">Kuyruk Seçiniz...</option>
                                {agentQueuesList.map(q => (
                                  <option key={q.id || q.extension} value={q.extension || q.name}>
                                    {q.name} ({q.extension})
                                  </option>
                                ))}
                              </select>
                            ) : curProf.timeout_action === "ai_agent" ? (
                              <select
                                value={curProf.timeout_target || ""}
                                onChange={(e) => updateCurProf({ timeout_target: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              >
                                <option value="">AI Temsilci Seçiniz...</option>
                                {agentAiAgentsList.map(ag => (
                                  <option key={ag.id || ag.extension} value={ag.extension || ag.id}>
                                    {ag.name} {ag.extension ? `(${ag.extension})` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/50 text-[11px] text-slate-400">
                                {curProf.timeout_action === "voicemail" ? "Sesli mesaja aktarılır" : "Ek hedef gerekmiyor"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Avatar Selection */}
                <div className={`space-y-3 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <img
                        src={agentAvatar}
                        alt="Seçili Avatar"
                        className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 shrink-0"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider block">
                          Profil Avatarı Seçin veya Yükleyin
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          24 hazır avatardan seçin veya kendi görselinizi yükleyin
                        </span>
                      </div>
                    </div>

                    <label className={`cursor-pointer px-3 py-2 rounded-xl text-[10px] font-extrabold text-white uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 shrink-0 ${bg} ${hover}`}>
                      <Upload size={13} />
                      <span>Avatar Yükle</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            showNotification("Avatar dosyası en fazla 5 MB olabilir.", "error", "Dosya Boyutu");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result;
                            if (typeof dataUrl === "string") {
                              if (file.type === "image/svg+xml" || file.type === "image/gif") {
                                setAgentAvatar(dataUrl);
                              } else {
                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement("canvas");
                                  const maxDim = 256;
                                  let w = img.width;
                                  let h = img.height;
                                  if (w > h) {
                                    if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
                                  } else {
                                    if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
                                  }
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext("2d");
                                  ctx.drawImage(img, 0, 0, w, h);
                                  setAgentAvatar(canvas.toDataURL("image/webp", 0.9));
                                };
                                img.src = dataUrl;
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-6 gap-2 max-h-44 overflow-y-auto p-1">
                    {[
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Anil",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Can",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Adrian",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Elif",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Zeynep",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Murat",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Selin",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Burak",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Deniz",
                      "https://api.dicebear.com/7.x/adventurer/svg?seed=Emre",
                      "https://api.dicebear.com/7.x/adventurer/svg?seed=Ayse",
                      "https://api.dicebear.com/7.x/adventurer/svg?seed=Kaan",
                      "https://api.dicebear.com/7.x/adventurer/svg?seed=Defne",
                      "https://api.dicebear.com/7.x/lorelei/svg?seed=Merve",
                      "https://api.dicebear.com/7.x/lorelei/svg?seed=Kerem",
                      "https://api.dicebear.com/7.x/micah/svg?seed=Cem",
                      "https://api.dicebear.com/7.x/micah/svg?seed=Ece",
                      "https://api.dicebear.com/7.x/notionists/svg?seed=Bora",
                      "https://api.dicebear.com/7.x/notionists/svg?seed=Pelin",
                      "https://api.dicebear.com/7.x/bottts/svg?seed=AgentAlpha",
                      "https://api.dicebear.com/7.x/bottts/svg?seed=AgentNova"
                    ].map((av, idx) => {
                      const isSelected = av === agentAvatar;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAgentAvatar(av)}
                          className={`p-0.5 rounded-xl border-2 transition-all hover:scale-105 focus:outline-none bg-slate-50 dark:bg-slate-950 ${
                            isSelected 
                              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20" 
                              : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                          }`}
                        >
                          <img src={av} alt="Avatar option" className="w-full h-full rounded-lg object-contain aspect-square" />
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
                          localStorage.setItem("theme_primary_color", safeColor);
                          persistUserVisualPatch({ theme_color: safeColor });
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
                  <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Çağrı Zil Sesi</label>
                  <div className="flex gap-2">
                    <select
                      value={agentRingtone}
                      onChange={(e) => {
                        const nextRing = e.target.value;
                        setAgentRingtone(nextRing);
                        localStorage.setItem("ringtone", nextRing);
                        stopRingtoneSound();
                        setIsPreviewingRingtone(false);
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
                      type="button"
                      onClick={() => {
                        if (isPreviewingRingtone) {
                          stopRingtoneSound();
                          setIsPreviewingRingtone(false);
                          localStorage.setItem("temp_playing", "false");
                        } else {
                          const ringDevObj = audioDevices.outputs.find((d) => d.deviceId === selectedRingtoneSpeaker);
                          const ringLabel = ringDevObj?.label || localStorage.getItem("selected_ringtone_speaker_label") || "";
                          setIsPreviewingRingtone(true);
                          localStorage.setItem("temp_playing", "true");
                          playRingtoneSound(agentRingtone, selectedRingtoneSpeaker, ringLabel);
                        }
                      }}
                      className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer"
                    >
                      {isPreviewingRingtone ? (
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
                  <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Ses Giriş Aygıtı (Mikrofon)</label>
                  <select
                    value={selectedMic}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedMic(nextId);
                      const devObj = audioDevices.inputs.find((d) => d.deviceId === nextId);
                      localStorage.setItem("selected_mic", nextId);
                      if (devObj?.label) {
                        localStorage.setItem("selected_mic_label", devObj.label);
                      }
                      window.dispatchEvent(new CustomEvent("AUDIO_DEVICES_UPDATED"));
                      if (isTestingMic) {
                        startMicLoopbackTest(noiseSuppressionMode, nextId, selectedSpeaker);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
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

                {/* AI Noise Suppression & Live Microphone Loopback Tester */}
                <div className={`p-4 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className={text} />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide block">
                          Yapay Zeka (AI) Gürültü Engelleme
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Klavye, ofis uğultusu ve yan masa konuşmalarını filtreler
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-wider ${
                      noiseSuppressionMode === "ai"
                        ? `${lightBg} ${text} ${borderLight}`
                        : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    }`}>
                      {noiseSuppressionMode === "ai"
                        ? "AI Kristal Ses"
                        : noiseSuppressionMode === "standard"
                        ? "Standart"
                        : "Kapalı"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "ai",
                        title: "Yapay Zeka (AI)",
                        desc: "RNNoise + Yan Ses Kesici (Önerilen)"
                      },
                      {
                        id: "standard",
                        title: "Standart",
                        desc: "Tarayıcı Gürültü Filtresi"
                      },
                      {
                        id: "off",
                        title: "Kapalı",
                        desc: "Ham Mikrofon Sesi"
                      }
                    ].map((opt) => {
                      const active = noiseSuppressionMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectNoiseMode(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                            active
                              ? `${lightBg} ${border} ring-1 ring-primary/30`
                              : "bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[10px] font-extrabold ${active ? text : "text-slate-700 dark:text-slate-200"}`}>
                              {opt.title}
                            </span>
                            {active && <Check size={12} className={text} />}
                          </div>
                          <span className="text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive Loopback Microphone Test */}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        Canlı Mikrofon Testi (Kendini Dinle)
                      </span>
                      <button
                        type="button"
                        onClick={() => (isTestingMic ? stopMicLoopbackTest() : startMicLoopbackTest())}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all ${
                          isTestingMic
                            ? `${bg} ${hover} text-white shadow-sm`
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {isTestingMic ? (
                          <>
                            <Square size={11} className="fill-current animate-pulse" />
                            <span>Testi Durdur</span>
                          </>
                        ) : (
                          <>
                            <Mic size={12} className={text} />
                            <span>Mikrofonu Test Et</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isTestingMic && (
                      <div className="space-y-2 p-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                            <span>Ham Mikrofon Girişi (Ortam + Ses)</span>
                            <span>%{micTestLevels.inputLevel}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-slate-400 dark:bg-slate-500 transition-all duration-75 rounded-full"
                              style={{ width: `${micTestLevels.inputLevel}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-extrabold">
                            <span className={text}>Karşıya Giden Temiz Ses ({noiseSuppressionMode === "ai" ? "AI Filtreli" : noiseSuppressionMode === "standard" ? "Standart" : "Ham"})</span>
                            <span className={text}>%{micTestLevels.outputLevel}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${bg} transition-all duration-75 rounded-full`}
                              style={{ width: `${micTestLevels.outputLevel}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Klavyeye tıklayın veya konuşun; sesiniz yankıyı önlemek için 0.3 sn gecikmeli olarak kulaklığınıza iletilir. Modlar arasında geçiş yaparak farkı canlı duyabilirsiniz.
                        </p>
                      </div>
                    )}

                    {micTestError && (
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        {micTestError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Speaker Selection (Call output) */}
                <div className={`space-y-2 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Konuşma Çıkış Aygıtı (Kulaklık)</label>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedSpeaker(nextId);
                      const devObj = audioDevices.outputs.find((d) => d.deviceId === nextId);
                      localStorage.setItem("selected_speaker", nextId);
                      if (devObj?.label) {
                        localStorage.setItem("selected_speaker_label", devObj.label);
                      }
                      window.dispatchEvent(new CustomEvent("AUDIO_DEVICES_UPDATED"));
                      if (isTestingMic) {
                        startMicLoopbackTest(noiseSuppressionMode, selectedMic, nextId);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
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
                  <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Zil Sesi Çıkış Aygıtı (Hoparlör)</label>
                  <select
                    value={selectedRingtoneSpeaker}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedRingtoneSpeaker(nextId);
                      const devObj = audioDevices.outputs.find((d) => d.deviceId === nextId);
                      localStorage.setItem("selected_ringtone_speaker", nextId);
                      if (devObj?.label) {
                        localStorage.setItem("selected_ringtone_speaker_label", devObj.label);
                      }
                      if (isPreviewingRingtone) {
                        playRingtoneSound(agentRingtone, nextId, devObj?.label || "");
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
                <div className={`p-4 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone size={15} className="text-violet-500" />
                      <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Akıllı Mobil Aktarım (AI GSM)</span>
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
                      <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 px-2.5 py-0.5 rounded-lg">Yetkisiz</span>
                    )}
                  </div>
                  
                  {hasMobileTransferPermission ? (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">GSM Numarası</label>
                      <input
                        type="tel"
                        placeholder="Örn: +905553332211"
                        value={gsmNumber}
                        onChange={(e) => setGsmNumber(e.target.value)}
                        disabled={!mobileTransferEnabled}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                      />
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                        Web Telefon kapalıyken mesai saatlerinde gelen çağrılar bu numaraya aktarılır ve yapay zeka size çağrı özetini fısıldar.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium italic">
                      Mobil yönlendirme özelliğini yönetmek için &quot;mobile_transfer:write&quot; yetkisine sahip olmalısınız.
                    </p>
                  )}
                </div>

              </div>

              {/* Forwarding Selection */}
              <div className={`space-y-4 max-h-[60vh] overflow-y-auto ${activeModalTab === "forwarding" ? "block" : "hidden"}`}>
                {(fwdAlwaysActive || fwdBusyActive || fwdNoAnswerActive) && (
                  <div className="flex justify-end pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFwdAlwaysActive(false);
                        setFwdBusyActive(false);
                        setFwdNoAnswerActive(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      Tüm Yönlendirmeleri İptal Et
                    </button>
                  </div>
                )}
                <div className="space-y-3 pr-2">
                    {renderForwardingRow("Her Zaman (Koşulsuz)", fwdAlwaysActive, setFwdAlwaysActive, fwdAlwaysType, setFwdAlwaysType, fwdAlwaysTarget, setFwdAlwaysTarget, null, null)}
                    {renderForwardingRow("Meşgul Durumda", fwdBusyActive, setFwdBusyActive, fwdBusyType, setFwdBusyType, fwdBusyTarget, setFwdBusyTarget, null, null)}
                    {renderForwardingRow("Zaman Aşımında (Cevapsız)", fwdNoAnswerActive, setFwdNoAnswerActive, fwdNoAnswerType, setFwdNoAnswerType, fwdNoAnswerTarget, setFwdNoAnswerTarget, fwdNoAnswerTimeout, setFwdNoAnswerTimeout)}
                </div>
              </div>

              {/* Security Selection */}
              <div className={`space-y-4 max-h-[60vh] overflow-y-auto ${activeModalTab === "security" ? "block" : "hidden"}`}>
                <div className="space-y-4 pr-1">

                  {/* Section 1: Oturum Süresi & Ekran Kapanma */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-violet-100/70 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl">
                          <Clock size={16} />
                        </div>
                        <div>
                          <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                            Arayüz Oturum Süresi & Ekran Kapatma
                          </h5>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Belirtilen süre boyunca işlem yapılmadığında oturum otomatik olarak sonlandırılır.
                          </p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setAutoLogoutEnabled(!autoLogoutEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                          autoLogoutEnabled ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                        }`}
                        title={autoLogoutEnabled ? "Otomatik kapanma aktif" : "Otomatik kapanma kapalı"}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Duration Options (1-2-3 Saat) when enabled */}
                    {autoLogoutEnabled && (
                      <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/80 animate-in fade-in duration-200">
                        <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">
                          Hareketsiz Kalma Süresi Seçin
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {[
                            { label: "1 Saat", value: 1, desc: "60 dakika sonra" },
                            { label: "2 Saat", value: 2, desc: "120 dakika sonra" },
                            { label: "3 Saat", value: 3, desc: "180 dakika sonra" }
                          ].map((opt) => {
                            const isSelected = autoLogoutDuration === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setAutoLogoutDuration(opt.value)}
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? `border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 ${text} ring-2 ring-violet-500/20`
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center justify-between w-full mb-1">
                                  <span className="text-xs font-black">{opt.label}</span>
                                  {isSelected && <CheckCircle size={14} className="text-violet-500 shrink-0" />}
                                </div>
                                <span className="text-[8.5px] opacity-75 font-medium">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Şifre Geçerlilik Süresi (Zorunlu Değişim) */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100/70 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                          <Lock size={16} />
                        </div>
                        <div>
                          <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                            Şifre Geçerlilik Süresi
                          </h5>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Şifrenin belirli periyotlarla otomatik olarak yenilenmesini zorunlu kılar.
                          </p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setPasswordExpiryEnabled(!passwordExpiryEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                          passwordExpiryEnabled ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                        }`}
                        title={passwordExpiryEnabled ? "Şifre geçerlilik süresi aktif" : "Şifre geçerlilik süresi pasif (Süresiz)"}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {/* Duration Options (1 - 3 - 6 - 12 Ay) when enabled */}
                    {passwordExpiryEnabled && (
                      <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/80 animate-in fade-in duration-200">
                        <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">
                          Yenileme Periyodu Seçin
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "1 Ay", value: 1, desc: "30 günde bir" },
                            { label: "3 Ay", value: 3, desc: "90 günde bir" },
                            { label: "6 Ay", value: 6, desc: "180 günde bir" },
                            { label: "12 Ay", value: 12, desc: "365 günde bir" }
                          ].map((opt) => {
                            const isSelected = passwordExpiryMonths === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPasswordExpiryMonths(opt.value)}
                                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? `border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 ${text} ring-2 ring-violet-500/20`
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center justify-between w-full mb-0.5">
                                  <span className="text-xs font-black">{opt.label}</span>
                                  {isSelected && <CheckCircle size={13} className="text-violet-500 shrink-0" />}
                                </div>
                                <span className="text-[8px] opacity-75 font-medium">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Şifre Değiştirme */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="p-2 bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <Key size={16} />
                      </div>
                      <div>
                        <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                          Şifre Değiştirme
                        </h5>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                          Kullanıcı hesabınızın giriş şifresini güncelleyin.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Mevcut Şifre</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Yeni Şifre</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Yeni Şifre (Tekrar)</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    {passwordStatusMsg && (
                      <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        passwordStatusMsg.type === "success" 
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50" 
                          : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50"
                      }`}>
                        {passwordStatusMsg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <span>{passwordStatusMsg.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Giriş Güvenliği & 2FA */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${twoFactorEnabled ? `${lightBg} ${text}` : "bg-blue-100/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"}`}>
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                              İki Faktörlü Doğrulama (2FA)
                            </h5>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${twoFactorEnabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                              {twoFactorEnabled ? "Aktif" : "Pasif"}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Girişlerde E-Posta, Google Authenticator veya Microsoft Authenticator kodu isteyerek hesabınızı koruyun.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !twoFactorEnabled;
                          setTwoFactorEnabled(nextVal);
                          setTwoFactorStatusMsg(null);
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                          twoFactorEnabled ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                        }`}
                        title={twoFactorEnabled ? "2FA aktif" : "2FA pasif"}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    {twoFactorEnabled && (
                      <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            2FA Doğrulama Yöntemi Seçiniz
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { id: "email", title: "E-Posta (E-Mail)", desc: "E-posta adresinize 6 haneli kod gönderilir", icon: Mail },
                              { id: "whatsapp", title: "WhatsApp (Giriş Kodu)", desc: "WhatsApp'a 'Giriş Kodu' yazıldığında 5 dk geçerli kod gelir", icon: Phone },
                              { id: "google_auth", title: "Google Authenticator", desc: "Google Authenticator ile 30 sn'lik kod", icon: Smartphone },
                              { id: "microsoft_auth", title: "Microsoft Authenticator", desc: "Microsoft Authenticator ile 30 sn'lik kod", icon: Key }
                            ].map((m) => {
                              const IconComp = m.icon;
                              const isSelected = twoFactorMethod === m.id || (m.id === "google_auth" && twoFactorMethod === "app");
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setTwoFactorMethod(m.id);
                                    setTwoFactorStatusMsg(null);
                                    setTwoFactorTestCode("");
                                    if (m.id === "google_auth" || m.id === "microsoft_auth") {
                                      fetchProfile2faSetup(false, m.id);
                                    }
                                  }}
                                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 ${
                                    isSelected
                                      ? `${lightBg} ${border} ring-2 ${ring}`
                                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                                  }`}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                      <IconComp size={13} />
                                    </div>
                                    {isSelected && <CheckCircle size={13} className={text} />}
                                  </div>
                                  <div>
                                    <div className={`text-[11px] font-extrabold ${isSelected ? text : "text-slate-800 dark:text-slate-100"}`}>
                                      {m.title}
                                    </div>
                                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                      {m.desc}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {twoFactorMethod === "email" && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                E-Posta: <span className="font-mono">{currentUser?.email || "Tanımlı değil"}</span>
                              </div>
                              <button
                                type="button"
                                onClick={handleProfileSendTestEmailOtp}
                                disabled={twoFactorEmailSending}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 disabled:opacity-50 ${bg} ${hover}`}
                              >
                                <RefreshCw size={11} className={twoFactorEmailSending ? "animate-spin" : ""} />
                                {twoFactorEmailSending ? "Gönderiliyor..." : "Test Kodu Gönder"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={twoFactorTestCode}
                                onChange={(e) => setTwoFactorTestCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="6 haneli e-posta kodunu girin"
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleProfileVerify2faCode}
                                disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold disabled:opacity-50"
                              >
                                {twoFactorVerifyLoading ? "Doğrulanıyor..." : "Doğrula"}
                              </button>
                            </div>
                          </div>
                        )}

                        {twoFactorMethod === "whatsapp" && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex-1">
                                <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">WhatsApp / GSM Numaranız</label>
                                <input
                                  type="text"
                                  value={gsmNumber}
                                  onChange={(e) => setGsmNumber(e.target.value)}
                                  placeholder="Örn: 0532 123 45 67"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 sm:mt-4">
                                <a
                                  href="https://wa.me/908503607390?text=Giri%C5%9F%20Kodu"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                                >
                                  WhatsApp Aç
                                </a>
                                <button
                                  type="button"
                                  onClick={handleProfileSendTestWhatsAppOtp}
                                  disabled={twoFactorEmailSending}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 disabled:opacity-50 ${bg} ${hover}`}
                                >
                                  <RefreshCw size={11} className={twoFactorEmailSending ? "animate-spin" : ""} />
                                  {twoFactorEmailSending ? "..." : "Test Kodu"}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              WhatsApp üzerinden <strong>0850 360 7390</strong> hattımıza <strong>"Giriş Kodu"</strong> yazdığınızda 5 dakika geçerli 6 haneli kodunuz ücretsiz olarak yanıtlanır.
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={twoFactorTestCode}
                                onChange={(e) => setTwoFactorTestCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="WhatsApp'a gelen 6 haneli kodu girin"
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleProfileVerify2faCode}
                                disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold disabled:opacity-50"
                              >
                                {twoFactorVerifyLoading ? "..." : "Doğrula"}
                              </button>
                            </div>
                          </div>
                        )}

                        {(twoFactorMethod === "google_auth" || twoFactorMethod === "microsoft_auth" || twoFactorMethod === "app") && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                                {twoFactorMethod === "microsoft_auth" ? "Microsoft Authenticator QR" : "Google Authenticator QR"}
                              </span>
                              <button
                                type="button"
                                onClick={() => fetchProfile2faSetup(true, twoFactorMethod)}
                                disabled={twoFactorSetupLoading}
                                className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800"
                              >
                                <RefreshCw size={10} className={twoFactorSetupLoading ? "animate-spin" : ""} />
                                Yeni QR Üret
                              </button>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              <div className="w-28 h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white p-1.5 flex items-center justify-center shrink-0">
                                {twoFactorSetupLoading ? (
                                  <RefreshCw size={20} className="animate-spin text-slate-400" />
                                ) : twoFactorQrSvg ? (
                                  <img src={twoFactorQrSvg} alt="2FA QR" className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-[9px] text-slate-400 text-center">QR Yükleniyor</span>
                                )}
                              </div>
                              <div className="flex-1 space-y-2 w-full">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    readOnly
                                    value={twoFactorSecret || "Üretiliyor..."}
                                    className="flex-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!twoFactorSecret) return;
                                      navigator.clipboard.writeText(twoFactorSecret);
                                      setTwoFactorSecretCopied(true);
                                      setTimeout(() => setTwoFactorSecretCopied(false), 2000);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                                  >
                                    {twoFactorSecretCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    {twoFactorSecretCopied ? "Kopyalandı" : "Kopyala"}
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    maxLength={6}
                                    value={twoFactorTestCode}
                                    onChange={(e) => setTwoFactorTestCode(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Uygulamadaki 6 haneli kod"
                                    className="flex-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleProfileVerify2faCode}
                                    disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                    className={`px-2.5 py-1 rounded-lg text-white text-[10px] font-bold disabled:opacity-50 ${bg} ${hover}`}
                                  >
                                    {twoFactorVerifyLoading ? "..." : "Eşleştir"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {twoFactorStatusMsg && (
                          <div className={`p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                            twoFactorStatusMsg.type === "success"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          }`}>
                            {twoFactorStatusMsg.type === "success" ? <CheckCircle size={13} className="shrink-0" /> : <AlertTriangle size={13} className="shrink-0" />}
                            <span>{twoFactorStatusMsg.text}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        stopRingtoneSound();
                        setIsPreviewingRingtone(false);
                        localStorage.setItem("temp_playing", "false");
                        setSettingsModalOpen(false);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        stopRingtoneSound();
                        setIsPreviewingRingtone(false);
                        localStorage.setItem("temp_playing", "false");
                        localStorage.setItem("agent_avatar", agentAvatar);
                        localStorage.setItem("ringtone", agentRingtone);
                        localStorage.setItem("selected_mic", selectedMic);
                        localStorage.setItem("selected_speaker", selectedSpeaker);
                        localStorage.setItem("selected_ringtone_speaker", selectedRingtoneSpeaker);

                        const micObj = audioDevices.inputs.find((d) => d.deviceId === selectedMic);
                        if (micObj?.label) localStorage.setItem("selected_mic_label", micObj.label);
                        const spkObj = audioDevices.outputs.find((d) => d.deviceId === selectedSpeaker);
                        if (spkObj?.label) localStorage.setItem("selected_speaker_label", spkObj.label);
                        const ringSpkObj = audioDevices.outputs.find((d) => d.deviceId === selectedRingtoneSpeaker);
                        if (ringSpkObj?.label) localStorage.setItem("selected_ringtone_speaker_label", ringSpkObj.label);

                        window.dispatchEvent(new CustomEvent("AUDIO_DEVICES_UPDATED"));
                        
                        localStorage.setItem("auto_logout_enabled", autoLogoutEnabled ? "true" : "false");
                        localStorage.setItem("auto_logout_duration", autoLogoutDuration.toString());
                        localStorage.setItem("two_factor_enabled", twoFactorEnabled ? "true" : "false");
                        localStorage.setItem("password_expiry_enabled", passwordExpiryEnabled ? "true" : "false");
                        localStorage.setItem("password_expiry_months", passwordExpiryMonths.toString());
                        saveCallPanelPrefs(currentUser, callPanelPrefs);

                        let passwordPayload = {};
                        if (newPassword || confirmPassword) {
                          if (newPassword !== confirmPassword) {
                            setPasswordStatusMsg({ type: "error", text: "Yeni şifreler eşleşmiyor!" });
                            setActiveModalTab("security");
                            return;
                          }
                          if (newPassword.length < 4) {
                            setPasswordStatusMsg({ type: "error", text: "Yeni şifre en az 4 karakter olmalıdır." });
                            setActiveModalTab("security");
                            return;
                          }
                          passwordPayload = {
                            current_password: currentPassword,
                            new_password: newPassword
                          };
                        }

                        if (currentUser) {
                          try {
                            const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                            const mobileTransferPayload = hasMobileTransferPermission
                              ? {
                                  gsm_number: gsmNumber,
                                  mobile_transfer_enabled: mobileTransferEnabled
                                }
                              : {};
                            const res = await fetch(`${protocol}//${backendHost}/api/agent/profile/${currentUser.id}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                avatar: agentAvatar,
                                ...mobileTransferPayload,
                                theme_color: tempThemeColor,
                                theme_mode: isDarkMode ? "dark" : "light",
                                forwarding_always: { active: Boolean(fwdAlwaysActive && fwdAlwaysTarget), type: fwdAlwaysType || "internal", target: fwdAlwaysTarget || "" },
                                forwarding_busy: { active: Boolean(fwdBusyActive && fwdBusyTarget), type: fwdBusyType || "internal", target: fwdBusyTarget || "" },
                                forwarding_no_answer: { active: Boolean(fwdNoAnswerActive && fwdNoAnswerTarget), type: fwdNoAnswerType || "internal", target: fwdNoAnswerTarget || "", timeout: fwdNoAnswerTimeout || 20 },
                                active_profile: agentActiveProfile,
                                profiles: agentProfiles,
                                call_panel_prefs: callPanelPrefs,
                                auto_logout_enabled: autoLogoutEnabled,
                                auto_logout_duration: autoLogoutDuration,
                                two_factor_enabled: twoFactorEnabled,
                                two_factor_method: twoFactorMethod || "google_auth",
                                two_factor_secret: twoFactorSecret || undefined,
                                two_factor_enrolled: twoFactorEnrolled,
                                password_expiry_enabled: passwordExpiryEnabled,
                                password_expiry_months: passwordExpiryMonths,
                                ...passwordPayload
                              })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setCurrentUser(data.user);
                              if (newPassword) {
                                SUPER_ADMIN.password = newPassword;
                                showNotification("Şifreniz başarılı olarak güncellenmiştir.", "success", "Şifre Güncellendi");
                                setCurrentPassword("");
                                setNewPassword("");
                                setConfirmPassword("");
                                setPasswordStatusMsg({ type: "success", text: "Şifreniz başarılı olarak güncellenmiştir." });
                              }
                              // Force update the UI theme color if they changed it
                              if (data.user.theme_color) {
                                const safeColor = getSafeThemeColor(data.user.theme_color);
                                document.documentElement.style.setProperty("--color-primary", safeColor);
                                localStorage.setItem("theme_primary_color", safeColor);
                              }
                            } else {
                              const errData = await res.json();
                              if (errData.detail) {
                                const isPassAttempt = Boolean(newPassword || confirmPassword);
                                showNotification(
                                  errData.detail,
                                  "error",
                                  isPassAttempt ? "Şifre Güncellenemedi" : "Ayarlar Kaydedilemedi"
                                );
                                if (isPassAttempt) {
                                  setPasswordStatusMsg({ type: "error", text: errData.detail });
                                  setActiveModalTab("security");
                                }
                                return;
                              }
                            }
                          } catch (err) {
                            console.error("Failed to save profile on backend:", err);
                            showNotification("Ayarlar kaydedilirken sunucu hatası oluştu.", "error", "Bağlantı Hatası");
                          }
                        }
                        
                        setSettingsModalOpen(false);
                      }}
                      className={"px-6 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-md flex items-center justify-center gap-1.5 " + bg + " " + hover}
                    >
                      <Check size={14} />
                      <span>Ayarları Kaydet</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Mandatory Password Expiry Renewal Modal */}
        {isLoggedIn && isPasswordExpired && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-amber-500/40 dark:border-amber-500/40 rounded-3xl shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl shrink-0">
                  <ShieldAlert size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-wider">
                    Şifre Kullanım Süreniz Doldu
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                    Güvenlik politikamız gereği şifreniz <b>{currentUser?.password_expiry_months || 3} ayda bir</b> yenilenmelidir.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Sisteme ve arayüz paneline erişmeye devam edebilmek için lütfen mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin.
              </p>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Mevcut Şifre</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={mandatoryCurrentPassword}
                    onChange={(e) => setMandatoryCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Yeni Şifre</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={mandatoryNewPassword}
                    onChange={(e) => setMandatoryNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={mandatoryConfirmPassword}
                    onChange={(e) => setMandatoryConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {mandatoryErrorMsg && (
                <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{mandatoryErrorMsg}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={async () => {
                  setMandatoryErrorMsg("");
                  if (!mandatoryNewPassword || !mandatoryConfirmPassword) {
                    setMandatoryErrorMsg("Lütfen tüm alanları doldurun.");
                    return;
                  }
                  if (mandatoryNewPassword !== mandatoryConfirmPassword) {
                    setMandatoryErrorMsg("Yeni şifreler birbiriyle eşleşmiyor.");
                    return;
                  }
                  if (mandatoryNewPassword.length < 4) {
                    setMandatoryErrorMsg("Yeni şifre en az 4 karakter olmalıdır.");
                    return;
                  }

                  try {
                    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                    const res = await fetch(`${protocol}//${backendHost}/api/agent/profile/${currentUser.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        avatar: currentUser.avatar || agentAvatar,
                        current_password: mandatoryCurrentPassword,
                        new_password: mandatoryNewPassword
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setCurrentUser(data.user);
                      setMandatoryCurrentPassword("");
                      setMandatoryNewPassword("");
                      setMandatoryConfirmPassword("");
                    } else {
                      const errData = await res.json();
                      setMandatoryErrorMsg(errData.detail || "Şifre güncellenemedi. Lütfen mevcut şifrenizi kontrol edin.");
                    }
                  } catch (err) {
                    setMandatoryErrorMsg("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
                  }
                }}
                className={`w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${bg} ${hover} shadow-lg shadow-amber-500/10`}
              >
                <Check size={14} />
                <span>Şifremi Güncelle ve Devam Et</span>
              </button>

            </div>
          </div>
        )}

        {/* Apply Error Detail Modal */}
        {showApplyErrorModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-955/40 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-wider">
                    Sistem Ayarları Uygulanamadı
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Asterisk ve PJSIP yapılandırma senkronizasyonunda hata oluştu.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-1">
                <label className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Hata Detayı</label>
                <div className="text-xs font-mono text-rose-600 dark:text-rose-400 break-words whitespace-pre-wrap">
                  {applyError || "Bilinmeyen bir sunucu hatası oluştu."}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyErrorModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-extrabold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApplyErrorModal(false);
                    handleApplyChanges();
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white uppercase tracking-wider flex items-center justify-center gap-2 ${bg} ${hover} transition-all shadow-md`}
                >
                  <Layers size={14} />
                  <span>Tekrar Dene</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Application System Notification Modal */}
        {notificationModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-center flex flex-col items-center">
              
              {/* Type Badge Icon */}
              <div className={`p-4 rounded-2xl shrink-0 ${
                notificationModal.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' :
                notificationModal.type === 'error' ? 'bg-rose-50 dark:bg-rose-955/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50' :
                'bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50'
              }`}>
                {notificationModal.type === 'success' && <CheckCircle size={32} className="animate-pulse" />}
                {notificationModal.type === 'error' && <AlertTriangle size={32} className="animate-pulse" />}
                {notificationModal.type === 'warning' && <ShieldAlert size={32} className="animate-pulse" />}
              </div>

              {/* Title & Message */}
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-base text-slate-850 dark:text-white tracking-tight">
                  {notificationModal.title || (notificationModal.type === 'success' ? 'İşlem Başarılı' : 'Sistem Uyarısı')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  {notificationModal.message}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setNotificationModal({ ...notificationModal, isOpen: false })}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold text-white uppercase tracking-wider transition-all shadow-md cursor-pointer ${
                  notificationModal.type === 'error' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : `${bg} ${hover}`
                }`}
              >
                Tamam
              </button>
            </div>
          </div>
        )}

        {/* Global Internal Chat Login / Live Message Notification Toast */}
        {isLoggedIn && internalChatToast && (
          <div className="fixed top-20 right-6 z-[9500] w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${lightBg} ${text} flex items-center justify-center shrink-0 border ${borderLight}`}>
                <MessageSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                      {internalChatToast.senderName}
                    </p>
                    {internalChatToast.totalUnread > 1 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-white shrink-0 ${bg}`}>
                        {internalChatToast.totalUnread} okunmamış
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInternalChatToast(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                    title="Bildirimi Kapat"
                  >
                    <X size={15} />
                  </button>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 break-words">
                  {internalChatToast.text}
                </p>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setInternalChatToast(null)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetPeer = internalChatToast.senderId;
                      setInternalChatToast(null);
                      setActiveTab("call-center");
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", {
                            detail: { subTab: "chat", peerSenderId: targetPeer }
                          })
                        );
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold text-white shadow-sm transition-all cursor-pointer ${bg} ${hover}`}
                  >
                    Mesajı Aç
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Unified Call & Chat Console WebPhone Widget */}
        {isLoggedIn && (
          <CallChatWidget 
            onActiveCall={(callId) => setActiveCallId(callId)}
            backendHost={backendHost}
            currentUser={currentUser}
          />
        )}
        {/* Global License Verification & Renewal Modal */}
        <LicenseModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          backendHost={backendHost}
          onLicenseUpdated={() => fetchGlobalLicenseStatus()}
        />
      </main>
    </div>
  );
}
