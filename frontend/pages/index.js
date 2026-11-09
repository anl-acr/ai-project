import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  persistAuthenticatedSession,
  saveRememberedCredentials,
  loadCachedUserProfile,
  clearAuthenticatedSession,
  updateRememberedPasswordIfSaved
} from "../utils/authStorage";

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
  Palette,
  Search,
  EyeOff,
  MoreHorizontal,
  Pin,
  Plus,
  PanelTop,
  Keyboard,
  Headphones,
  Bell,
  BellRing,
  X
} from "lucide-react";
import {
  getSafeThemeColor,
  SYSTEM_THEME_PRESETS,
  rgbStringToHex,
  SYSTEM_UI_TEMPLATES,
  normalizeUiTemplate,
  applyDocumentUiTemplate
} from "../utils/theme";
import {
  playRingtoneSound,
  stopRingtoneSound,
  resolveAudioDeviceId,
  getSavedRingtoneVolume,
  setSavedRingtoneVolume,
  playSpeakerTestSound,
  stopSpeakerTestSound
} from "../utils/audioHelper";
import {
  isDesktopApp,
  isNativeElectron,
  getDesktopPrefs,
  updateDesktopPrefs,
  sendDesktopNotification,
  syncDesktopTrayState,
  disconnectDesktopServer
} from "../utils/desktopBridge";
import {
  getSavedNoiseSuppressionMode,
  saveNoiseSuppressionMode,
  createMicLoopbackTester
} from "../utils/noiseSuppressionEngine";
import { useTheme, setThemeColor } from "../utils/theme";
import { getBackendHost } from "../utils/apiHost";
import { getTurkishSlugForTab, getTabFromTurkishSlug } from "../utils/slugHelper";
import useClickOutside from "../utils/useClickOutside";
import { AVATAR_CATEGORIES, ALL_AVATAR_ITEMS } from "../utils/avatarPresets";



import dynamic from "next/dynamic";
import {
  DEFAULT_USER_PROFILES,
  RING_DEVICES_METADATA,
  normalizeUserProfiles
} from "../utils/userProfileDefaults";
import {
  getAllowedLandingScreensForRole,
  getAllowedAgentSubTabsForRole,
  getLandingScreenLabel,
  getAgentSubTabLabel,
  saveLastVisitedTab,
  getLastVisitedTab,
  getLastVisitedAgentSubTab,
  resolveUserLandingTab
} from "../utils/landingPagePrefs";
import { webphoneManager } from "../utils/webphoneManager";
import {
  resolveEffectiveDarkMode,
  applyDocumentDarkClass
} from "../utils/themeSchedule";
import {
  resolveEffectiveShortcutsMap,
  eventToShortcutCombo,
  isEditableTarget
} from "../utils/keyboardShortcuts";
import {
  normalizeUiMotionMode,
  applyDocumentMotionMode,
  runStageViewTransition,
  useStageRevealObserver,
  PanelShimmerSkeleton
} from "../utils/uiMotion";

const NotificationCenterBell = dynamic(() => import("../components/common/NotificationCenterBell"), { ssr: false });
const KeyboardShortcutsModal = dynamic(() => import("../components/common/KeyboardShortcutsModal"), { ssr: false });
const Customer360Drawer = dynamic(() => import("../components/common/Customer360Drawer"), { ssr: false });
import AgentPanel, {
  ALL_TABS as CALL_PANEL_ALL_TABS,
  loadCallPanelPrefs,
  saveCallPanelPrefs,
  DEFAULT_CALL_PANEL_PREFS,
  DEFAULT_TOPBAR_PREFS,
  DEFAULT_TOPBAR_ZONES,
  normalizeTopbarPrefs
} from "../components/callcenter/AgentPanel";
import Login from "../components/auth/Login";
import TenantSwitcher from "../components/TenantSwitcher";
import GlobalSearchBar from "../components/common/GlobalSearchBar";

const PanelLoadingFallback = () => (
  <div className="w-full p-2">
    <PanelShimmerSkeleton variant="default" />
  </div>
);

const dynamicPanel = (loader) =>
  dynamic(loader, { ssr: false, loading: PanelLoadingFallback });

// Lazy code-split panels & heavy widgets so initial bundle and tab clicks stay fast
const CallChatWidget = dynamic(() => import("../components/dashboard/CallChatWidget"), { ssr: false });
const SettingsPanel = dynamicPanel(() => import("../components/settings/SettingsPanel"));
const KnowledgeBase = dynamicPanel(() => import("../components/settings/KnowledgeBase"));
const RuleEditor = dynamicPanel(() => import("../components/settings/RuleEditor"));
const ReportsPanel = dynamicPanel(() => import("../components/dashboard/ReportsPanel"));
const CalendarPanel = dynamicPanel(() => import("../components/dashboard/CalendarPanel"));
const LiveDashboardPanel = dynamicPanel(() => import("../components/dashboard/LiveDashboardPanel"));
const SystemStatusPanel = dynamicPanel(() => import("../components/dashboard/SystemStatusPanel"));
const CallPanelAgentsAppearanceSettings = dynamic(
  () => import("../components/callcenter/tabs/AgentQueuePeersTab").then((m) => m.CallPanelAgentsAppearanceSettings),
  { ssr: false, loading: PanelLoadingFallback }
);
const WallboardPanel = dynamicPanel(() => import("../components/dashboard/WallboardPanel"));
const WallboardStudioSettings = dynamic(
  () => import("../components/dashboard/WallboardPanel").then((m) => m.WallboardStudioSettings),
  { ssr: false, loading: PanelLoadingFallback }
);
const DialerSettings = dynamicPanel(() => import("../components/settings/DialerSettings"));
const CallFlowEditor = dynamicPanel(() => import("../components/settings/CallFlowEditor"));
const AIAgentsSettings = dynamicPanel(() => import("../components/settings/AIAgentsSettings"));
const ChangelogPanel = dynamicPanel(() => import("../components/settings/ChangelogPanel"));
const OmnichannelPanel = dynamicPanel(() => import("../components/dashboard/OmnichannelPanel"));
const ContactsPanel = dynamicPanel(() => import("../components/dashboard/ContactsPanel"));
const BlacklistSettings = dynamicPanel(() => import("../components/settings/BlacklistSettings"));
const UserSettings = dynamicPanel(() => import("../components/settings/UserSettings"));
const PBXSettings = dynamicPanel(() => import("../components/settings/PBXSettings"));
const AnnouncementsPanel = dynamicPanel(() => import("../components/settings/AnnouncementsPanel"));
const AcdQueuesPanel = dynamicPanel(() => import("../components/settings/AcdQueuesPanel"));
const AutoprovisionPanel = dynamicPanel(() => import("../components/settings/AutoprovisionPanel"));
const OutboundRulesPanel = dynamicPanel(() => import("../components/settings/OutboundRulesPanel"));
const InboundRulesPanel = dynamicPanel(() => import("../components/settings/InboundRulesPanel"));
const CallPickupGroupsPanel = dynamicPanel(() => import("../components/settings/CallPickupGroupsPanel"));
const SubscriberGroupsPanel = dynamicPanel(() => import("../components/settings/SubscriberGroupsPanel"));
const SpeedDialsPanel = dynamicPanel(() => import("../components/settings/SpeedDialsPanel"));
const ConferencesPanel = dynamicPanel(() => import("../components/settings/ConferencesPanel"));
const WorkHoursSettingsPanel = dynamicPanel(() => import("../components/settings/WorkHoursSettingsPanel"));
const EventLogsPanel = dynamicPanel(() => import("../components/settings/EventLogsPanel"));
const SecurityPanel = dynamicPanel(() => import("../components/security/SecurityPanel"));
const TroubleshootingPanel = dynamicPanel(() => import("../components/dashboard/TroubleshootingPanel"));
const LicenseModal = dynamic(() => import("../components/modals/LicenseModal"), { ssr: false });
const APIBudgetSettings = dynamicPanel(() => import("../components/settings/APIBudgetSettings"));
const QueueSurveyReportPanel = dynamicPanel(() => import("../components/reports/QueueSurveyReportPanel"));
const EnterpriseReportsPanel = dynamicPanel(() => import("../components/reports/EnterpriseReportsPanel"));
const CustomReportBuilderPanel = dynamicPanel(() => import("../components/reports/CustomReportBuilderPanel"));
const ScheduledReportsPanel = dynamicPanel(() => import("../components/settings/ScheduledReportsPanel"));
const AIConfigAssistantPanel = dynamicPanel(() => import("../components/settings/AIConfigAssistantPanel"));

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
  const sidebarActiveItemCls = `${lightBg} ${text} border-primary/25 dark:border-primary/35 shadow-sm`;
  const sidebarInactiveItemCls = "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40";
  const backendHost = getBackendHost();
  const [activeTab, setActiveTabRaw] = useState("dashboard"); // dashboard, call-center, pbx-settings, channel-settings, rag-kb, rule-editor
  const mainStageRef = React.useRef(null);
  const uiMotionModeRef = React.useRef("fluid");

  const setActiveTab = React.useCallback((nextOrUpdater) => {
    const stageEl = typeof window !== "undefined" ? mainStageRef.current : null;
    const hadStageFocus = Boolean(stageEl && typeof document !== "undefined" && stageEl.contains(document.activeElement));

    const performUpdate = () => {
      setActiveTabRaw((prev) => {
        const resolvedNext = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
        if (!resolvedNext || resolvedNext === prev) return prev;
        return resolvedNext;
      });
    };

    if (stageEl && typeof nextOrUpdater === "string") {
      runStageViewTransition(stageEl, performUpdate, uiMotionModeRef.current);
    } else {
      performUpdate();
    }

    if (stageEl && typeof window !== "undefined") {
      stageEl.scrollTop = 0;
      if (hadStageFocus) {
        window.requestAnimationFrame(() => {
          stageEl.focus({ preventScroll: true });
        });
      }
    }
  }, []);
  const [isAgentFullScreenMode, setIsAgentFullScreenMode] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [desktopPrefs, setDesktopPrefs] = useState(() => getDesktopPrefs());
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
      if (currentPath.startsWith("/reset-password")) return;
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
  const [hasWorkHoursPermission, setHasWorkHoursPermission] = useState(true);
  const [gsmNumber, setGsmNumber] = useState("");
  const [mobileTransferEnabled, setMobileTransferEnabled] = useState(false);
  const [tempThemeColor, setTempThemeColor] = useState("99, 102, 241");
  const [activeModalTab, setActiveModalTab] = useState("profile");
  const [agentActiveProfile, setAgentActiveProfile] = useState("available");
  const [agentProfiles, setAgentProfiles] = useState(() => normalizeUserProfiles(null));
  const [selectedAgentProfileTab, setSelectedAgentProfileTab] = useState("available");
  const [agentQueuesList, setAgentQueuesList] = useState([]);
  const [agentAiAgentsList, setAgentAiAgentsList] = useState([]);
  const [agentHotdeskConfig, setAgentHotdeskConfig] = useState({
    enabled: false,
    pin: "",
    auto_logout_midnight: true
  });
  const [showAgentHotdeskPin, setShowAgentHotdeskPin] = useState(false);
  const [agentHotdeskPinTouched, setAgentHotdeskPinTouched] = useState(false);
  const [agentHotdeskSessions, setAgentHotdeskSessions] = useState([]);
  const [agentHotdeskLogoutBusy, setAgentHotdeskLogoutBusy] = useState(false);
  const [callPanelPrefs, setCallPanelPrefs] = useState(() => loadCallPanelPrefs(null));
  const [isPeekingUiTemplate, setIsPeekingUiTemplate] = useState(false);
  const [currentAgentSubTab, setCurrentAgentSubTab] = useState("dashboard");
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
  const lastHoveredSidebarElRef = React.useRef(null);
  const sidebarNavRef = React.useRef(null);

  const toggleSidebarCollapse = () => {
    lastHoveredSidebarElRef.current = null;
    setSidebarTooltip(null);
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", next ? "true" : "false");
      }
      return next;
    });
  };

  // Fallback for browsers without native CSS sibling-index() support
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof CSS === "undefined" ||
      CSS.supports("animation-delay: calc(sibling-index() * 0.1s)")
    ) {
      return;
    }
    const navEl = sidebarNavRef.current;
    if (!navEl) return;
    const groups = navEl.querySelectorAll(":scope > .aida-sidebar-group");
    groups.forEach((groupEl, groupIdx) => {
      groupEl.style.setProperty("--sibling-index", String(groupIdx + 1));
      const bodyEl = groupEl.querySelector(".aida-sidebar-group-body");
      if (bodyEl) {
        Array.from(bodyEl.children).forEach((btnEl, btnIdx) => {
          btnEl.style.setProperty("--sibling-index", String(btnIdx + 1));
        });
      }
    });
  }, [isLoggedIn, openCategories, isSidebarCollapsed, currentRolePermissions]);

  useEffect(() => {
    const saved = localStorage.getItem('hasPendingChanges');
    if (saved === 'true') {
      setHasPendingChanges(true);
    }
    if (localStorage.getItem("sidebar_collapsed") === "true") {
      setIsSidebarCollapsed(true);
    }

    const handleSettingsMutated = () => {
      setHasPendingChanges((prev) => {
        if (!prev) {
          localStorage.setItem('hasPendingChanges', 'true');
          return true;
        }
        return prev;
      });
    };

    const handleAgentSubTabChanged = (ev) => {
      if (ev?.detail && typeof ev.detail === "string") {
        setCurrentAgentSubTab(ev.detail);
      }
    };
    if (typeof window !== "undefined" && window.__CURRENT_AGENT_SUBTAB__) {
      setCurrentAgentSubTab(String(window.__CURRENT_AGENT_SUBTAB__));
    }

    window.addEventListener('AIDA_SETTINGS_MUTATED', handleSettingsMutated);
    window.addEventListener('AGENT_SUBTAB_CHANGED', handleAgentSubTabChanged);
    return () => {
      window.removeEventListener('AIDA_SETTINGS_MUTATED', handleSettingsMutated);
      window.removeEventListener('AGENT_SUBTAB_CHANGED', handleAgentSubTabChanged);
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

  useEffect(() => {
    const mode = normalizeUiMotionMode(callPanelPrefs?.uiMotionMode);
    uiMotionModeRef.current = mode;
    applyDocumentMotionMode(mode);
  }, [callPanelPrefs?.uiMotionMode]);

  useEffect(() => {
    const tpl = normalizeUiTemplate(callPanelPrefs?.uiTemplate);
    applyDocumentUiTemplate(tpl);
  }, [callPanelPrefs?.uiTemplate]);

  useEffect(() => {
    if (!isPeekingUiTemplate || typeof window === "undefined") return;
    const stopPeek = () => setIsPeekingUiTemplate(false);
    window.addEventListener("pointerup", stopPeek);
    window.addEventListener("pointercancel", stopPeek);
    window.addEventListener("blur", stopPeek);
    return () => {
      window.removeEventListener("pointerup", stopPeek);
      window.removeEventListener("pointercancel", stopPeek);
      window.removeEventListener("blur", stopPeek);
    };
  }, [isPeekingUiTemplate]);

  useStageRevealObserver(mainStageRef, `${activeTab}-${activeTenantId}-${isLoggedIn}`);

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
      if (typeof document !== "undefined" && document.visibilityState === "hidden" && !isDesktopApp()) return;
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

          if (isNativeElectron()) {
            sendDesktopNotification({
              title: `💬 ${senderLabel} - Yeni İç Mesaj`,
              body: latestMsg.text || "Yeni bir mesajınız var.",
              tag: `int-chat-${latestMsg.id}`,
              urgent: false,
              focusOnClick: true
            });
          } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
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
    const timer = setInterval(pollInternalDeliveryAndNotify, 6000);
    return () => {
      mounted = false;
      window.removeEventListener("INTERNAL_CHAT_READ_SYNC", handleReadSync);
      clearInterval(timer);
    };
  }, [isLoggedIn, currentUser?.id, currentUser?.extension]);

  // Profile and ringtone preferences states
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useClickOutside(() => setProfileDropdownOpen(false));
  const [pinOverflowOpen, setPinOverflowOpen] = useState(false);
  const pinOverflowRef = useClickOutside(() => setPinOverflowOpen(false));
  const [draggedPinnedIdx, setDraggedPinnedIdx] = useState(null);
  const [draggedTopbarToken, setDraggedTopbarToken] = useState(null);
  const [topbarDropIndicator, setTopbarDropIndicator] = useState(null);
  const [pinCatalogSearch, setPinCatalogSearch] = useState("");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);
  const [agentAvatar, setAgentAvatar] = useState("https://api.dicebear.com/7.x/avataaars/svg?seed=Felix");
  const [profileAvatarCategory, setProfileAvatarCategory] = useState("all");
  
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
  const [ringtoneVolume, setRingtoneVolume] = useState(1.0);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

  // AI Noise Suppression & Live Mic Loopback Tester states
  const [noiseSuppressionMode, setNoiseSuppressionMode] = useState("ai");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestLevels, setMicTestLevels] = useState({ inputLevel: 0, outputLevel: 0 });
  const [micTestError, setMicTestError] = useState("");
  const micTesterRef = React.useRef(null);
  const [quickSpeakerLevel, setQuickSpeakerLevel] = useState(0);
  const quickSpeakerAnimRef = React.useRef(null);

  const stopQuickSpeakerMeter = () => {
    if (quickSpeakerAnimRef.current) {
      clearInterval(quickSpeakerAnimRef.current);
      quickSpeakerAnimRef.current = null;
    }
    setQuickSpeakerLevel(0);
  };

  const startQuickSpeakerMeter = () => {
    stopQuickSpeakerMeter();
    let tick = 0;
    setQuickSpeakerLevel(64);
    quickSpeakerAnimRef.current = setInterval(() => {
      tick += 1;
      const wave = 52 + Math.round(Math.sin(tick * 0.65) * 26 + Math.cos(tick * 1.1) * 14);
      setQuickSpeakerLevel(Math.max(18, Math.min(96, wave)));
    }, 90);
  };

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

  const handleToggleQuickHardwareCheck = async () => {
    if (isTestingMic || isTestingSpeaker) {
      stopMicLoopbackTest();
      stopSpeakerTestSound();
      stopQuickSpeakerMeter();
      setIsTestingSpeaker(false);
      return;
    }
    await startMicLoopbackTest(noiseSuppressionMode, selectedMic, selectedSpeaker);
    const spkObj = audioDevices.outputs.find((d) => d.deviceId === selectedSpeaker);
    setIsTestingSpeaker(true);
    startQuickSpeakerMeter();
    playSpeakerTestSound(selectedSpeaker, spkObj?.label || "", () => {
      setIsTestingSpeaker(false);
      stopQuickSpeakerMeter();
    });
  };

  const handleSelectNoiseMode = (nextMode) => {
    const validModes = ["ai", "standard", "off"];
    const resolvedMode = validModes.includes(nextMode) ? nextMode : "ai";
    if (settingsModalOpen) {
      setNoiseSuppressionMode(resolvedMode);
      if (isTestingMic) {
        startMicLoopbackTest(resolvedMode, selectedMic, selectedSpeaker);
      }
      return;
    }
    const saved = saveNoiseSuppressionMode(resolvedMode);
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
  const [twoFactorActiveMethods, setTwoFactorActiveMethods] = useState(["google_auth"]);
  const [twoFactorMultiMode, setTwoFactorMultiMode] = useState("single"); // 'single' | 'all' | 'any'
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorEnrolled, setTwoFactorEnrolled] = useState(false);
  const [twoFactorQrSvg, setTwoFactorQrSvg] = useState("");
  const [twoFactorMethodsMap, setTwoFactorMethodsMap] = useState({
    google_auth: { secret: "", qrSvg: "", enrolled: false },
    microsoft_auth: { secret: "", qrSvg: "", enrolled: false },
    whatsapp: { enrolled: false },
    email: { enrolled: false }
  });
  const [twoFactorSetupLoading, setTwoFactorSetupLoading] = useState(false);
  const [twoFactorTestCode, setTwoFactorTestCode] = useState("");
  const [twoFactorVerifyLoading, setTwoFactorVerifyLoading] = useState(false);
  const [twoFactorEmailSending, setTwoFactorEmailSending] = useState(false);
  const [twoFactorStatusMsg, setTwoFactorStatusMsg] = useState(null);
  const [twoFactorSecretCopied, setTwoFactorSecretCopied] = useState(false);
  const profileModalScrollPaneRef = React.useRef(null);
  const profileTwoFactorCardRef = React.useRef(null);
  const activeProfileTwoFactorMethodRef = React.useRef("google_auth");

  const buildProfile2faMethodsMap = (u) => {
    const base = {
      google_auth: { secret: "", qrSvg: "", enrolled: false },
      microsoft_auth: { secret: "", qrSvg: "", enrolled: false },
      whatsapp: { enrolled: false },
      email: { enrolled: false }
    };
    if (!u) return base;
    const tfMeta = u?.call_panel_prefs?.twoFactorMeta && typeof u.call_panel_prefs.twoFactorMeta === "object"
      ? u.call_panel_prefs.twoFactorMeta
      : null;
    if (tfMeta?.methods && typeof tfMeta.methods === "object") {
      ["google_auth", "microsoft_auth", "whatsapp", "email"].forEach((mk) => {
        const mv = tfMeta.methods[mk];
        if (mv && typeof mv === "object") {
          base[mk] = {
            ...base[mk],
            ...(mk === "google_auth" || mk === "microsoft_auth" ? { secret: mv.secret || "" } : {}),
            enrolled: Boolean(mv.enrolled)
          };
        }
      });
      return base;
    }
    const rawM = String(u.two_factor_method || tfMeta?.method || "").toLowerCase();
    const normM = rawM === "microsoft_auth" || rawM === "whatsapp" || rawM === "email" ? rawM : "google_auth";
    const enr = Boolean(u.two_factor_enrolled ?? tfMeta?.enrolled);
    const sec = u.two_factor_secret || tfMeta?.secret || "";
    if (normM === "google_auth" || normM === "microsoft_auth") {
      base[normM] = { secret: sec, qrSvg: "", enrolled: enr };
    } else {
      base[normM] = { enrolled: enr };
    }
    return base;
  };

  const extractProfile2faActiveConfig = (u, fallbackMethod = "google_auth") => {
    const tfMeta = u?.call_panel_prefs?.twoFactorMeta && typeof u.call_panel_prefs.twoFactorMeta === "object"
      ? u.call_panel_prefs.twoFactorMeta
      : null;
    const rawList = Array.isArray(u?.two_factor_active_methods)
      ? u.two_factor_active_methods
      : Array.isArray(tfMeta?.active_methods)
        ? tfMeta.active_methods
        : [];
    const validIds = ["email", "whatsapp", "google_auth", "microsoft_auth"];
    const cleaned = [];
    rawList.forEach((item) => {
      const s = String(item || "").trim().toLowerCase();
      const norm = s === "app" ? "google_auth" : s;
      if (validIds.includes(norm) && !cleaned.includes(norm)) {
        cleaned.push(norm);
      }
    });
    const fb = validIds.includes(fallbackMethod) ? fallbackMethod : "google_auth";
    if (cleaned.length === 0) cleaned.push(fb);
    const rawMode = String(u?.two_factor_multi_mode || tfMeta?.multi_mode || "").trim().toLowerCase();
    const multiMode = cleaned.length <= 1 ? "single" : (rawMode === "any" ? "any" : "all");
    return { activeMethods: cleaned, multiMode };
  };

  const scrollProfileTwoFactorIntoPane = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        const pane = profileModalScrollPaneRef.current;
        const card = profileTwoFactorCardRef.current;
        if (!pane || !card) return;
        const paneRect = pane.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const targetTop = pane.scrollTop + (cardRect.top - paneRect.top) - 16;
        pane.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }, 60);
    });
  };
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

  const profile2faSetupInFlightMethodRef = React.useRef(null);

  const fetchProfile2faSetup = async (resetSecret = false, overrideMethod = null) => {
    if (!currentUser) return;
    const rawTarget = overrideMethod || twoFactorMethod || "google_auth";
    const targetMethod = rawTarget === "app" ? "google_auth" : rawTarget;
    if (targetMethod === "email" || targetMethod === "whatsapp") return;
    if (!resetSecret && profile2faSetupInFlightMethodRef.current === targetMethod) return;
    profile2faSetupInFlightMethodRef.current = targetMethod;
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
        const resolvedEnrolled = resetSecret ? false : Boolean(data.enrolled);
        setTwoFactorMethodsMap((prev) => {
          const next = { ...prev };
          if (data.methods && typeof data.methods === "object") {
            ["google_auth", "microsoft_auth", "whatsapp", "email"].forEach((mk) => {
              const srvM = data.methods[mk];
              if (srvM && typeof srvM === "object") {
                next[mk] = {
                  ...(prev[mk] || {}),
                  ...(mk === "google_auth" || mk === "microsoft_auth" ? { secret: srvM.secret || prev[mk]?.secret || "" } : {}),
                  enrolled: Boolean(srvM.enrolled)
                };
              }
            });
          }
          next[targetMethod] = {
            ...(next[targetMethod] || {}),
            secret: data.secret || "",
            qrSvg: data.qr_svg || "",
            enrolled: resolvedEnrolled
          };
          return next;
        });
        if (activeProfileTwoFactorMethodRef.current === targetMethod) {
          setTwoFactorSecret(data.secret || "");
          setTwoFactorQrSvg(data.qr_svg || "");
          setTwoFactorEnrolled(resolvedEnrolled);
        }
        if (resetSecret) {
          setTwoFactorStatusMsg({ type: "success", text: "Yeni QR kod ve anahtar üretildi. Uygulamadan tekrar okutunuz." });
        }
      }
    } catch (e) {
      console.error("2FA profile setup error:", e);
    } finally {
      if (profile2faSetupInFlightMethodRef.current === targetMethod) {
        profile2faSetupInFlightMethodRef.current = null;
      }
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
        setTwoFactorEnabled(true);
        setTwoFactorMethod("whatsapp");
        const nextWaActiveProf = twoFactorMultiMode === "single"
          ? ["whatsapp"]
          : (twoFactorActiveMethods.includes("whatsapp") ? twoFactorActiveMethods : [...twoFactorActiveMethods, "whatsapp"]);
        setTwoFactorActiveMethods(nextWaActiveProf);
        if (typeof window !== "undefined") {
          localStorage.setItem("two_factor_enabled", "true");
        }
        const mergedPatch = {
          gsm_number: targetPhone,
          follow_me: {
            ...(currentUser.follow_me && typeof currentUser.follow_me === "object" ? currentUser.follow_me : {}),
            mobile_number: targetPhone
          },
          two_factor_enabled: true,
          two_factor_method: nextWaActiveProf[0] || "whatsapp",
          two_factor_active_methods: nextWaActiveProf,
          two_factor_multi_mode: nextWaActiveProf.length > 1 ? twoFactorMultiMode : "single"
        };
        setCurrentUser((prev) => (prev ? { ...prev, ...mergedPatch } : prev));
        setSystemUsers((prev) =>
          Array.isArray(prev)
            ? prev.map((u) =>
                (currentUser?.id && String(u.id) === String(currentUser.id)) ||
                (currentUser?.extension && String(u.extension) === String(currentUser.extension))
                  ? { ...u, ...mergedPatch }
                  : u
              )
            : prev
        );
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
    const resolvedPhone = (gsmNumber || currentUser.gsm_number || currentUser.follow_me?.mobile_number || "").trim();
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
          phone: resolvedPhone || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const verMethod = (twoFactorMethod === "app" ? "google_auth" : twoFactorMethod) || "google_auth";
        setTwoFactorEnrolled(true);
        setTwoFactorEnabled(true);
        setTwoFactorTestCode("");
        setTwoFactorMethodsMap((prev) => ({
          ...prev,
          ...(data.methods && typeof data.methods === "object"
            ? Object.fromEntries(
                ["google_auth", "microsoft_auth", "whatsapp", "email"]
                  .filter((mk) => data.methods[mk] && typeof data.methods[mk] === "object")
                  .map((mk) => [
                    mk,
                    {
                      ...(prev[mk] || {}),
                      ...(mk === "google_auth" || mk === "microsoft_auth" ? { secret: data.methods[mk].secret || prev[mk]?.secret || "" } : {}),
                      enrolled: Boolean(data.methods[mk].enrolled)
                    }
                  ])
              )
            : {}),
          [verMethod]: {
            ...(prev[verMethod] || {}),
            ...(verMethod === "google_auth" || verMethod === "microsoft_auth" ? { secret: twoFactorSecret || prev[verMethod]?.secret || "" } : {}),
            enrolled: true
          }
        }));
        if (typeof window !== "undefined") {
          localStorage.setItem("two_factor_enabled", "true");
        }
        const prevCppVer = currentUser.call_panel_prefs && typeof currentUser.call_panel_prefs === "object" ? currentUser.call_panel_prefs : {};
        const prevTfMetaVer = prevCppVer.twoFactorMeta && typeof prevCppVer.twoFactorMeta === "object" ? prevCppVer.twoFactorMeta : {};
        const nextVerActiveProf = twoFactorMultiMode === "single"
          ? [verMethod]
          : (twoFactorActiveMethods.includes(verMethod) ? twoFactorActiveMethods : [...twoFactorActiveMethods, verMethod]);
        const nextVerModeProf = nextVerActiveProf.length > 1 ? (twoFactorMultiMode === "any" ? "any" : "all") : "single";
        setTwoFactorActiveMethods(nextVerActiveProf);
        const verifiedPatch = {
          two_factor_enabled: true,
          two_factor_method: nextVerActiveProf[0] || verMethod,
          two_factor_active_methods: nextVerActiveProf,
          two_factor_multi_mode: nextVerModeProf,
          two_factor_enrolled: true,
          ...(twoFactorSecret ? { two_factor_secret: twoFactorSecret } : {}),
          ...(data.methods
            ? {
                call_panel_prefs: {
                  ...prevCppVer,
                  twoFactorMeta: {
                    ...prevTfMetaVer,
                    enabled: true,
                    method: nextVerActiveProf[0] || verMethod,
                    active_methods: nextVerActiveProf,
                    multi_mode: nextVerModeProf,
                    enrolled: true,
                    ...(twoFactorSecret ? { secret: twoFactorSecret } : {}),
                    methods: data.methods,
                    updatedTs: Date.now()
                  }
                }
              }
            : {}),
          ...(resolvedPhone ? {
            gsm_number: resolvedPhone,
            follow_me: {
              ...(currentUser.follow_me && typeof currentUser.follow_me === "object" ? currentUser.follow_me : {}),
              mobile_number: resolvedPhone
            }
          } : {})
        };
        setCurrentUser((prev) => (prev ? { ...prev, ...verifiedPatch } : prev));
        setSystemUsers((prev) =>
          Array.isArray(prev)
            ? prev.map((u) =>
                (currentUser?.id && String(u.id) === String(currentUser.id)) ||
                (currentUser?.extension && String(u.extension) === String(currentUser.extension))
                  ? { ...u, ...verifiedPatch }
                  : u
              )
            : prev
        );
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

  const wasSettingsModalOpenRef = React.useRef(false);
  const hydratedModalUserKeyRef = React.useRef("");
  const modalInitialSnapshotRef = React.useRef(null);
  const userTouched2faInModalRef = React.useRef(false);
  const [modalDraftWallboardLayout, setModalDraftWallboardLayout] = useState(null);

  useEffect(() => {
    if (!settingsModalOpen) {
      wasSettingsModalOpenRef.current = false;
      return;
    }
    if (!currentUser) return;

    const userKey = String(currentUser.id || currentUser.extension || currentUser.username || "default");
    if (wasSettingsModalOpenRef.current && hydratedModalUserKeyRef.current === userKey) {
      return;
    }
    wasSettingsModalOpenRef.current = true;
    hydratedModalUserKeyRef.current = userKey;

    const initialThemeColor = getSafeThemeColor(
      currentUser.theme_color ||
        (typeof window !== "undefined" ? localStorage.getItem("theme_primary_color") : null)
    );
    const initialProf = currentUser.active_profile || "available";
    const initialProfiles = normalizeUserProfiles(currentUser.profiles, currentUser);
    const initialPanelPrefs = loadCallPanelPrefs(currentUser);
    const scopedStoredAvatar =
      typeof window !== "undefined" && userKey
        ? localStorage.getItem(`agent_avatar_${userKey}`) || ""
        : "";
    const initialAvatar =
      initialPanelPrefs?.profileAvatar ||
      currentUser.avatar ||
      scopedStoredAvatar ||
      agentAvatar ||
      (typeof window !== "undefined" ? localStorage.getItem("agent_avatar") : "") ||
      "";
    const initialRingtone =
      (typeof window !== "undefined" ? localStorage.getItem("ringtone") : null) ||
      agentRingtone ||
      "classic";
    const initialRingtoneVol = getSavedRingtoneVolume();
    const initialMic =
      (typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null) ||
      selectedMic ||
      "";
    const initialSpk =
      (typeof window !== "undefined" ? localStorage.getItem("selected_speaker") : null) ||
      selectedSpeaker ||
      "";
    const initialRingSpk =
      (typeof window !== "undefined" ? localStorage.getItem("selected_ringtone_speaker") : null) ||
      selectedRingtoneSpeaker ||
      "";
    const initialNoiseMode = getSavedNoiseSuppressionMode();
    const initialDesktopPrefs = getDesktopPrefs();
    const rawInitialHd =
      currentUser.hotdesk_config && typeof currentUser.hotdesk_config === "object"
        ? currentUser.hotdesk_config
        : {};
    const initialHotdeskCfg = {
      enabled: Boolean(rawInitialHd.enabled),
      pin: String(rawInitialHd.pin || ""),
      auto_logout_midnight: rawInitialHd.auto_logout_midnight !== false
    };

    let initialWbLayout = null;
    if (currentUser.wallboard_layout && typeof currentUser.wallboard_layout === "object" && Object.keys(currentUser.wallboard_layout).length > 0) {
      initialWbLayout = JSON.parse(JSON.stringify(currentUser.wallboard_layout));
    } else if (typeof window !== "undefined") {
      try {
        const localWb = localStorage.getItem(`wallboard_layout_${userKey}`);
        if (localWb) initialWbLayout = JSON.parse(localWb);
      } catch (e) {}
    }

    modalInitialSnapshotRef.current = {
      avatar: initialAvatar,
      themeColor: initialThemeColor,
      isDarkMode: Boolean(isDarkMode),
      callPanelPrefs: JSON.parse(JSON.stringify(initialPanelPrefs)),
      wallboardLayout: initialWbLayout ? JSON.parse(JSON.stringify(initialWbLayout)) : null,
      activeProfile: initialProf,
      profiles: JSON.parse(JSON.stringify(initialProfiles)),
      ringtone: initialRingtone,
      ringtoneVolume: initialRingtoneVol,
      selectedMic: initialMic,
      selectedSpeaker: initialSpk,
      selectedRingtoneSpeaker: initialRingSpk,
      noiseSuppressionMode: initialNoiseMode,
      desktopPrefs: JSON.parse(JSON.stringify(initialDesktopPrefs || {})),
      hotdeskConfig: JSON.parse(JSON.stringify(initialHotdeskCfg))
    };

    setAgentHotdeskConfig(initialHotdeskCfg);
    setShowAgentHotdeskPin(false);
    setAgentHotdeskPinTouched(false);

    setModalDraftWallboardLayout(initialWbLayout ? JSON.parse(JSON.stringify(initialWbLayout)) : null);
    setAgentAvatar(initialAvatar || agentAvatar);
    setGsmNumber(currentUser.gsm_number || currentUser.follow_me?.mobile_number || "");
    setMobileTransferEnabled(currentUser.mobile_transfer_enabled || false);
    setTempThemeColor(initialThemeColor);
    setAgentRingtone(initialRingtone);
    setRingtoneVolume(initialRingtoneVol);
    setSelectedMic(initialMic);
    setSelectedSpeaker(initialSpk);
    setSelectedRingtoneSpeaker(initialRingSpk);
    setNoiseSuppressionMode(initialNoiseMode);
    setDesktopPrefs(initialDesktopPrefs);
    
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

    setAgentActiveProfile(initialProf);
    setSelectedAgentProfileTab(initialProf);
    setAgentProfiles(initialProfiles);
    setCallPanelPrefs(initialPanelPrefs);

    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/settings/queues`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAgentQueuesList(Array.isArray(d) ? d : (d?.queues || [])))
      .catch(() => {});
    fetch(`${protocol}//${backendHost}/api/settings/ai-agents`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAgentAiAgentsList(Array.isArray(d) ? d : (d?.ai_agents || [])))
      .catch(() => {});
    if (currentUser.extension) {
      fetch(`${protocol}//${backendHost}/api/hotdesk/sessions?extension=${encodeURIComponent(currentUser.extension)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setAgentHotdeskSessions(Array.isArray(d?.sessions) ? d.sessions : []))
        .catch(() => setAgentHotdeskSessions([]));
    } else {
      setAgentHotdeskSessions([]);
    }

    userTouched2faInModalRef.current = false;
    setAutoLogoutEnabled(currentUser.auto_logout_enabled ?? (localStorage.getItem("auto_logout_enabled") === "true"));
    setAutoLogoutDuration(currentUser.auto_logout_duration ?? parseInt(localStorage.getItem("auto_logout_duration") || "1"));
    const initTfMeta = currentUser?.call_panel_prefs?.twoFactorMeta && typeof currentUser.call_panel_prefs.twoFactorMeta === "object"
      ? currentUser.call_panel_prefs.twoFactorMeta
      : null;
    const init2faEnabled =
      typeof currentUser.two_factor_enabled === "boolean"
        ? currentUser.two_factor_enabled
        : (initTfMeta?.enabled ?? (localStorage.getItem("two_factor_enabled") === "true"));
    setTwoFactorEnabled(Boolean(init2faEnabled));
    const raw2faMethod = currentUser.two_factor_method || initTfMeta?.method;
    const norm2faMethod = (!raw2faMethod || raw2faMethod === "app") ? "google_auth" : raw2faMethod;
    const initProfMethodsMap = buildProfile2faMethodsMap(currentUser);
    const { activeMethods: initProfActive, multiMode: initProfMode } = extractProfile2faActiveConfig(currentUser, norm2faMethod);
    const primaryProfFocus = initProfActive[0] || norm2faMethod;
    setTwoFactorActiveMethods(initProfActive);
    setTwoFactorMultiMode(initProfMode);
    setTwoFactorMethod(primaryProfFocus);
    activeProfileTwoFactorMethodRef.current = primaryProfFocus;
    setTwoFactorMethodsMap(initProfMethodsMap);
    setTwoFactorSecret(initProfMethodsMap[primaryProfFocus]?.secret || "");
    setTwoFactorEnrolled(Boolean(initProfMethodsMap[primaryProfFocus]?.enrolled));
    setTwoFactorQrSvg("");
    setTwoFactorTestCode("");
    setTwoFactorStatusMsg(null);
    setPasswordExpiryEnabled(currentUser.password_expiry_enabled ?? (localStorage.getItem("password_expiry_enabled") === "true"));
    setPasswordExpiryMonths(currentUser.password_expiry_months ?? parseInt(localStorage.getItem("password_expiry_months") || "3"));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatusMsg(null);

    fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!Array.isArray(list) || userTouched2faInModalRef.current) return;
        const freshU =
          list.find(
            (u) =>
              (currentUser.id && String(u.id) === String(currentUser.id)) ||
              (currentUser.extension && String(u.extension) === String(currentUser.extension))
          ) ||
          (currentUser.role === "admin"
            ? list.find(
                (u) =>
                  String(u.id) === "9999" ||
                  u.username === "admin" ||
                  u.email === "admin@localhost" ||
                  (!u.extension && u.role === "admin")
              ) || list.find((u) => u.role === "admin")
            : null);
        if (!freshU) return;
        const fMeta = freshU?.call_panel_prefs?.twoFactorMeta && typeof freshU.call_panel_prefs.twoFactorMeta === "object"
          ? freshU.call_panel_prefs.twoFactorMeta
          : null;
        const freshEnabled =
          typeof freshU.two_factor_enabled === "boolean"
            ? freshU.two_factor_enabled
            : Boolean(fMeta?.enabled ?? false);
        const freshRawMethod = freshU.two_factor_method || fMeta?.method;
        const freshMethod = (!freshRawMethod || freshRawMethod === "app") ? "google_auth" : freshRawMethod;
        const freshMethodsMap = buildProfile2faMethodsMap(freshU);
        const { activeMethods: freshActive, multiMode: freshMode } = extractProfile2faActiveConfig(freshU, freshMethod);
        const freshFocus = freshActive[0] || freshMethod;
        setTwoFactorEnabled(freshEnabled);
        setTwoFactorActiveMethods(freshActive);
        setTwoFactorMultiMode(freshMode);
        setTwoFactorMethod(freshFocus);
        activeProfileTwoFactorMethodRef.current = freshFocus;
        setTwoFactorMethodsMap(freshMethodsMap);
        setTwoFactorSecret(freshMethodsMap[freshFocus]?.secret || "");
        setTwoFactorEnrolled(Boolean(freshMethodsMap[freshFocus]?.enrolled));
        const freshPhone = freshU.gsm_number || freshU.follow_me?.mobile_number || fMeta?.phone || "";
        if (freshPhone) setGsmNumber(freshPhone);
        if (freshU.hotdesk_config && typeof freshU.hotdesk_config === "object") {
          const fHd = {
            enabled: Boolean(freshU.hotdesk_config.enabled),
            pin: String(freshU.hotdesk_config.pin || ""),
            auto_logout_midnight: freshU.hotdesk_config.auto_logout_midnight !== false
          };
          setAgentHotdeskConfig(fHd);
          if (modalInitialSnapshotRef.current) {
            modalInitialSnapshotRef.current.hotdeskConfig = JSON.parse(JSON.stringify(fHd));
          }
        }
      })
      .catch(() => {});
  }, [settingsModalOpen, currentUser, backendHost]);

  const handleCancelSettingsModal = React.useCallback(() => {
    stopRingtoneSound();
    stopSpeakerTestSound();
    stopQuickSpeakerMeter();
    stopMicLoopbackTest();
    setIsPreviewingRingtone(false);
    setIsTestingSpeaker(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("temp_playing", "false");
    }

    const snap = modalInitialSnapshotRef.current;
    if (snap) {
      if (snap.avatar) setAgentAvatar(snap.avatar);
      setTempThemeColor(snap.themeColor);
      if (typeof document !== "undefined" && snap.themeColor) {
        document.documentElement.style.setProperty("--color-primary", snap.themeColor);
      }
      setIsDarkMode(Boolean(snap.isDarkMode));
      applyDocumentDarkClass(Boolean(snap.isDarkMode));

      const restoredPrefs = JSON.parse(JSON.stringify(snap.callPanelPrefs));
      setCallPanelPrefs(restoredPrefs);
      applyDocumentMotionMode(normalizeUiMotionMode(restoredPrefs?.uiMotionMode));
      applyDocumentUiTemplate(normalizeUiTemplate(restoredPrefs?.uiTemplate));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("AGENT_PANEL_PREFS_UPDATED", { detail: restoredPrefs }));
      }

      setModalDraftWallboardLayout(snap.wallboardLayout ? JSON.parse(JSON.stringify(snap.wallboardLayout)) : null);
      setAgentActiveProfile(snap.activeProfile);
      setSelectedAgentProfileTab(snap.activeProfile);
      setAgentProfiles(JSON.parse(JSON.stringify(snap.profiles)));
      setAgentRingtone(snap.ringtone);
      setSavedRingtoneVolume(snap.ringtoneVolume);
      setRingtoneVolume(snap.ringtoneVolume);
      setSelectedMic(snap.selectedMic);
      setSelectedSpeaker(snap.selectedSpeaker);
      setSelectedRingtoneSpeaker(snap.selectedRingtoneSpeaker);
      setNoiseSuppressionMode(snap.noiseSuppressionMode);
      setDesktopPrefs(JSON.parse(JSON.stringify(snap.desktopPrefs || {})));
      if (snap.hotdeskConfig) {
        setAgentHotdeskConfig(JSON.parse(JSON.stringify(snap.hotdeskConfig)));
      }
    }

    setSettingsModalOpen(false);
  }, []);

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
        "settings", "system-status", "event-logs", "troubleshooting", "sip-debugger", "security", "tenant-management"
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

  const refreshHardwareAudioDevices = React.useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) return;
    setIsRefreshingDevices(true);
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
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

      const savedMic = localStorage.getItem("selected_mic") || "";
      const savedMicLabel = localStorage.getItem("selected_mic_label") || "";
      const savedSpeaker = localStorage.getItem("selected_speaker") || "";
      const savedSpeakerLabel = localStorage.getItem("selected_speaker_label") || "";
      const savedRingtoneSpeaker = localStorage.getItem("selected_ringtone_speaker") || "";
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
    } finally {
      setTimeout(() => setIsRefreshingDevices(false), 250);
    }
  }, []);

  // Sync available media devices on modal load (stopping any temporary permission stream immediately!)
  useEffect(() => {
    if (!settingsModalOpen) {
      stopRingtoneSound();
      stopSpeakerTestSound();
      setIsPreviewingRingtone(false);
      setIsTestingSpeaker(false);
      stopMicLoopbackTest();
      return;
    }
    setNoiseSuppressionMode(getSavedNoiseSuppressionMode());
    setRingtoneVolume(getSavedRingtoneVolume());
    setDesktopPrefs(getDesktopPrefs());
    refreshHardwareAudioDevices();
  }, [settingsModalOpen, refreshHardwareAudioDevices]);

  // Desktop App Mode detection, live device hot-swap listener & Electron Tray synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;
    const detected = isDesktopApp();
    setIsDesktopMode(detected);
    setDesktopPrefs(getDesktopPrefs());
    setRingtoneVolume(getSavedRingtoneVolume());
    if (detected) {
      setIsAgentFullScreenMode(true);
    }

    const handleOpenHardwareModal = () => {
      setActiveModalTab("hardware");
      setSettingsModalOpen(true);
    };
    const handleDeviceChange = () => {
      refreshHardwareAudioDevices();
    };

    window.addEventListener("OPEN_HARDWARE_SETTINGS", handleOpenHardwareModal);
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }
    return () => {
      window.removeEventListener("OPEN_HARDWARE_SETTINGS", handleOpenHardwareModal);
      if (navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === "function") {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
    };
  }, [refreshHardwareAudioDevices]);

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

  React.useEffect(() => {
    const handleAvatarStateSync = (e) => {
      const detail = e?.detail;
      if (!detail || !detail.avatar) return;
      const nextAvatar = detail.avatar;
      setSystemUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              (detail.userId !== undefined && String(u.id) === String(detail.userId)) ||
              (detail.extension && String(u.extension) === String(detail.extension))
                ? {
                    ...u,
                    avatar: nextAvatar,
                    call_panel_prefs: {
                      ...(u.call_panel_prefs && typeof u.call_panel_prefs === "object" ? u.call_panel_prefs : {}),
                      profileAvatar: nextAvatar
                    }
                  }
                : u
            )
          : prev
      );
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const matchesSelf =
          (detail.userId !== undefined && String(prev.id) === String(detail.userId)) ||
          (detail.extension && String(prev.extension) === String(detail.extension));
        if (!matchesSelf) return prev;
        setAgentAvatar(nextAvatar);
        setCallPanelPrefs((prevPrefs) => ({ ...(prevPrefs || {}), profileAvatar: nextAvatar }));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("agent_avatar", nextAvatar);
            if (prev.id) localStorage.setItem(`agent_avatar_${prev.id}`, nextAvatar);
            if (prev.extension) localStorage.setItem(`agent_avatar_${prev.extension}`, nextAvatar);
          } catch (err) {}
        }
        return {
          ...prev,
          avatar: nextAvatar,
          call_panel_prefs: {
            ...(prev.call_panel_prefs && typeof prev.call_panel_prefs === "object" ? prev.call_panel_prefs : {}),
            profileAvatar: nextAvatar
          }
        };
      });
    };
    window.addEventListener("USER_AVATAR_UPDATED", handleAvatarStateSync);
    const handleProfileStateSync = (e) => {
      const detail = e?.detail;
      if (!detail || !detail.patch || typeof detail.patch !== "object") return;
      const patch = detail.patch;
      setSystemUsers((prev) =>
        Array.isArray(prev)
          ? prev.map((u) =>
              (detail.userId !== undefined && detail.userId !== null && String(u.id) === String(detail.userId)) ||
              (detail.extension && String(u.extension) === String(detail.extension))
                ? { ...u, ...patch }
                : u
            )
          : prev
      );
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const matchesSelf =
          (detail.userId !== undefined && detail.userId !== null && String(prev.id) === String(detail.userId)) ||
          (detail.extension && String(prev.extension) === String(detail.extension));
        if (!matchesSelf) return prev;
        if (typeof window !== "undefined" && patch.two_factor_enabled !== undefined) {
          try {
            localStorage.setItem("two_factor_enabled", String(Boolean(patch.two_factor_enabled)));
          } catch (err) {}
        }
        return { ...prev, ...patch };
      });
    };
    window.addEventListener("USER_PROFILE_SYNC", handleProfileStateSync);
    return () => {
      window.removeEventListener("USER_AVATAR_UPDATED", handleAvatarStateSync);
      window.removeEventListener("USER_PROFILE_SYNC", handleProfileStateSync);
    };
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
        if (savedUserId === 'admin' || savedUserId === '9999') {
          const adminUserFromDb = Array.isArray(usersData)
            ? usersData.find(u => String(u.id) === '9999' || u.username === 'admin' || u.email === 'admin@localhost' || (!u.extension && u.role === 'admin')) ||
              usersData.find(u => u.id === 1 && u.role === 'admin') ||
              usersData.find(u => u.role === 'admin')
            : null;
          currentUserData = adminUserFromDb ? { ...SUPER_ADMIN, ...adminUserFromDb } : SUPER_ADMIN;
        } else if (Array.isArray(usersData) && usersData.length > 0) {
          const found = usersData.find(u => String(u.id) === String(savedUserId) || String(u.extension) === String(savedUserId) || u.email === savedUserId || u.username === savedUserId);
          if (found) {
            currentUserData = found;
          } else {
            // Invalid / Ghost user ID in storage — clean stale state
            clearAuthenticatedSession();
            setIsLoggedIn(false);
            setCurrentUser(null);
            setIsAuthChecking(false);
            return;
          }
        } else {
          // Network blip while restoring remembered session — fall back to cached profile snapshot
          const cachedProfile = loadCachedUserProfile(savedUserId);
          if (cachedProfile) {
            currentUserData = cachedProfile;
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
      const avatarUidKey = String(currentUserData.id || currentUserData.extension || savedUserId || "default");
      const scopedLocalAvatar =
        typeof window !== "undefined"
          ? localStorage.getItem(`agent_avatar_${avatarUidKey}`) ||
            (currentUserData.extension ? localStorage.getItem(`agent_avatar_${currentUserData.extension}`) : "") ||
            (savedUserId === "admin" ? localStorage.getItem("agent_avatar_admin") : "")
          : "";
      const resolvedAvatar =
        resolvedPanelPrefs?.profileAvatar ||
        currentUserData.avatar ||
        scopedLocalAvatar ||
        (typeof window !== "undefined" ? localStorage.getItem("agent_avatar") : "") ||
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";

      setAgentAvatar(resolvedAvatar);
      const hydratedPanelPrefs = resolvedAvatar
        ? { ...resolvedPanelPrefs, profileAvatar: resolvedPanelPrefs?.profileAvatar || resolvedAvatar }
        : resolvedPanelPrefs;
      setCallPanelPrefs(hydratedPanelPrefs);
      currentUserData = {
        ...currentUserData,
        avatar: resolvedAvatar,
        call_panel_prefs: {
          ...(currentUserData.call_panel_prefs && typeof currentUserData.call_panel_prefs === "object"
            ? currentUserData.call_panel_prefs
            : {}),
          profileAvatar: resolvedPanelPrefs?.profileAvatar || resolvedAvatar
        }
      };
      if (typeof window !== "undefined" && resolvedAvatar) {
        try {
          localStorage.setItem("agent_avatar", resolvedAvatar);
          localStorage.setItem(`agent_avatar_${avatarUidKey}`, resolvedAvatar);
          if (currentUserData.extension) {
            localStorage.setItem(`agent_avatar_${currentUserData.extension}`, resolvedAvatar);
          }
          if (savedUserId === "admin") {
            localStorage.setItem("agent_avatar_admin", resolvedAvatar);
          }
        } catch (e) {}
      }

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

      let justLoggedInFromPage = false;
      try {
        if (typeof window !== "undefined" && sessionStorage.getItem("aida_just_logged_in") === "1") {
          justLoggedInFromPage = true;
          sessionStorage.removeItem("aida_just_logged_in");
        }
      } catch (e) {}
      const isFreshLogin = Boolean(providedUser) || justLoggedInFromPage;

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
        setHasWorkHoursPermission(true);
        if (isDesktopApp()) {
          setIsAgentOnlyUser(true);
          setIsWallboardOnlyUser(false);
          setIsAgentFullScreenMode(true);
          const prefLanding = String(resolvedPanelPrefs?.defaultLandingTab || "auto");
          setActiveTab(prefLanding === "omnichannel" ? "omnichannel" : "call-center");
        } else {
          setIsAgentOnlyUser(false);
          setIsWallboardOnlyUser(false);
          setIsAgentFullScreenMode(false);
          const adminTargetTab = resolveUserLandingTab({
            user: currentUserData,
            panelPrefs: resolvedPanelPrefs,
            roleCode: "admin",
            rolePermissions: ["*"],
            explicitUrlTab,
            isFreshLogin
          });
          setActiveTab(adminTargetTab);
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
        setHasWorkHoursPermission(false);
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
        const canWorkHours = hasPerm('work_hours') || hasPerm('pbx') || hasPerm('call_flow');

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
        setHasWorkHoursPermission(canWorkHours);

        const canDashboard = hasPerm('dashboard');
        const canWallboard = hasPerm('wallboard');
        const canCallPanel = hasPerm('call_panel');
        const canAiModules = hasPerm('ai_agents') || hasPerm('rag') || hasPerm('rag_kb') || hasPerm('knowledge_base') || hasPerm('rules') || hasPerm('rule_editor');
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
          canWorkHours ||
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
          hasPerm('troubleshooting') ||
          hasPerm('sip_debugger') ||
          hasPerm('security');

        // Dedicated Desktop Agent Application Mode: strictly Call Panel (+ Omnichannel if authorized)
        if (isDesktopApp()) {
          setIsWallboardOnlyUser(false);
          setIsAgentOnlyUser(true);
          setIsAgentFullScreenMode(true);
          const resolvedDesktopTab = resolveUserLandingTab({
            user: currentUserData,
            panelPrefs: resolvedPanelPrefs,
            roleCode: userRoleLower,
            rolePermissions: permsList,
            explicitUrlTab,
            isFreshLogin,
            desktopMode: true
          });
          setActiveTab(resolvedDesktopTab);
        } else if (canWallboard && !canDashboard && !canCallPanel && !canOmni && !canReports && !canAiModules && !canPbxOrSysModules) {
          setIsWallboardOnlyUser(true);
          setIsAgentOnlyUser(false);
          setIsAgentFullScreenMode(false);
          setActiveTab('wallboard');
        } else if (!canDashboard && !canWallboard && !canOmni && !canReports && !canAiModules && !canPbxOrSysModules) {
          // Dedicated Call Panel Only Role (full-screen Call Panel when no other modules are granted)
          setIsWallboardOnlyUser(false);
          setIsAgentOnlyUser(true);
          setIsAgentFullScreenMode(true);
          setActiveTab('call-center');
        } else {
          setIsWallboardOnlyUser(false);
          setIsAgentOnlyUser(false);
          const resolvedRoleTab = resolveUserLandingTab({
            user: currentUserData,
            panelPrefs: resolvedPanelPrefs,
            roleCode: userRoleLower,
            rolePermissions: permsList,
            explicitUrlTab,
            isFreshLogin
          });
          setActiveTab(resolvedRoleTab);
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
          setHasWorkHoursPermission(true);
        }
        setCurrentUser(currentUserData);
        setIsLoggedIn(true);
      }
      setIsAuthChecking(false);
    }
  };

  // Load user-scoped avatar and ringtone from localStorage on mount, then hydrate from backend user profile
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mountUid =
        sessionStorage.getItem("current_user_id") ||
        localStorage.getItem("current_user_id") ||
        "";
      const savedAvatar =
        (mountUid ? localStorage.getItem(`agent_avatar_${mountUid}`) : "") ||
        localStorage.getItem("agent_avatar");
      if (savedAvatar) setAgentAvatar(savedAvatar);
      const savedRingtone = localStorage.getItem("ringtone");
      if (savedRingtone) setAgentRingtone(savedRingtone);
    }

    // Safety fallback: unblock loading spinner only if network completely stalls (5s)
    const fallbackTimer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 5000);

    checkRolePermissions();

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleLogin = async (username, password, rememberMe = true) => {
    setLoginError("");
    const cleanUsername = (username || "").trim();
    let usersToSearch = systemUsers;
    let backendReachable = false;
    let backendStatus = null;
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`);
      backendStatus = resUsers.status;
      if (resUsers.ok) {
        backendReachable = true;
        const freshUsers = await resUsers.json();
        if (Array.isArray(freshUsers) && freshUsers.length > 0) {
          usersToSearch = freshUsers;
          setSystemUsers(freshUsers);
        }
      }
    } catch (err) {
      console.error("Login user fetch error:", err);
    }

    const adminUserFromDb =
      (usersToSearch || []).find(u => u.username === 'admin' || u.email === 'admin@localhost' || u.id === 1) ||
      (usersToSearch || []).find(u => u.role === 'admin');
    const validAdminPassword = adminUserFromDb?.password || SUPER_ADMIN.password || "admin";

    if (cleanUsername.toLowerCase() === "admin" && (password === validAdminPassword || password === "admin")) { // Admin login
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
      persistAuthenticatedSession("admin", rememberMe, activeAdminUser);
      saveRememberedCredentials(cleanUsername, password, rememberMe);
      setIsAuthChecking(true);
      await checkRolePermissions(activeAdminUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi", `${activeAdminUser.full_name || "Sistem Yöneticisi"} web yönetim paneline giriş yaptı.`, activeAdminUser);
      return { success: true };
    }

    const cleanLower = cleanUsername.toLowerCase();
    const foundUser = (usersToSearch || []).find(u => {
      const matchesIdentity = (
        u.username === cleanUsername ||
        (u.username && String(u.username).toLowerCase() === cleanLower) ||
        u.email === cleanUsername ||
        (u.email && String(u.email).toLowerCase() === cleanLower) ||
        String(u.extension || "") === cleanUsername ||
        u.full_name === cleanUsername ||
        (u.sip_username && u.sip_username === cleanUsername)
      );
      const matchesMainPassword = (u.password === password || u.sip_password === password);
      const matchesSipDevice = Array.isArray(u.sip_devices) && u.sip_devices.some(d =>
        d &&
        String(d.sip_username || "") === cleanUsername &&
        (u.password === password || String(d.sip_password || "") === password)
      );
      return (matchesIdentity && matchesMainPassword) || matchesSipDevice;
    });
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

      persistAuthenticatedSession(foundUser.id.toString(), rememberMe, foundUser);
      saveRememberedCredentials(cleanUsername, password, rememberMe);
      setIsAuthChecking(true);
      await checkRolePermissions(foundUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi", `${foundUser.full_name || foundUser.username || "Kullanıcı"} (Dahili: ${foundUser.extension || "-"}) sisteme giriş yaptı.`, foundUser);
      return { success: true };
    } else {
      if (!backendReachable && (!usersToSearch || usersToSearch.length === 0)) {
        const svcMsg = backendStatus
          ? `Sunucu kullanıcı servisi yanıt vermedi (HTTP ${backendStatus}). Lütfen aida-backend servisini kontrol edin.`
          : "Sunucu servisine (aida-backend) ulaşılamıyor. Lütfen sunucu servislerinin çalıştığını kontrol edin.";
        setLoginError(svcMsg);
        return { success: false, error: svcMsg };
      }
      setLoginError("Geçersiz kullanıcı adı veya şifre.");
      return { success: false, error: "Geçersiz kullanıcı adı veya şifre." };
    }
  };

  const complete2FALogin = async (userId, rememberMe) => {
    let foundUser = systemUsers.find(u => String(u.id) === String(userId) || String(u.extension) === String(userId));
    if (!foundUser && (String(userId) === "admin" || String(userId) === "9999" || String(userId) === "1")) {
      const adminDb =
        systemUsers.find(u => String(u.id) === "9999" || u.username === "admin" || u.email === "admin@localhost" || (!u.extension && u.role === "admin")) ||
        systemUsers.find(u => u.id === 1 && u.role === "admin") ||
        systemUsers.find(u => u.role === "admin");
      foundUser = adminDb ? { ...SUPER_ADMIN, ...adminDb } : SUPER_ADMIN;
    }
    if (foundUser) {
      const updatedUser = { ...foundUser, two_factor_enrolled: true };
      const storeId = foundUser.role === "admin" && String(userId) === "admin" ? "admin" : foundUser.id.toString();
      persistAuthenticatedSession(storeId, rememberMe, updatedUser);
      setIsAuthChecking(true);
      await checkRolePermissions(updatedUser);
      sendUserAuditActivity("LOGIN", "Auth", "Web Paneli Girişi (2FA)", `${updatedUser.full_name || updatedUser.username || "Kullanıcı"} 2 aşamalı doğrulama ile sisteme giriş yaptı.`, updatedUser);
    }
  };


  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [landingSearchQuery, setLandingSearchQuery] = useState("");
  const autoOpened360CallRef = React.useRef("");

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    const autoCfg = callPanelPrefs?.autoThemeConfig || { mode: "manual", darkStart: "19:00", darkEnd: "07:00" };

    const evaluateAndApply = () => {
      const nextDark = resolveEffectiveDarkMode(autoCfg, localStorage.getItem("theme") || savedTheme);
      setIsDarkMode(nextDark);
      applyDocumentDarkClass(nextDark);
    };

    evaluateAndApply();

    let mediaQuery = null;
    const onMediaChange = () => {
      if (autoCfg.mode === "system") evaluateAndApply();
    };
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", onMediaChange);
      }
    }

    let scheduleTimer = null;
    if (autoCfg.mode === "schedule") {
      scheduleTimer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        evaluateAndApply();
      }, 30000);
    }

    return () => {
      if (mediaQuery && typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onMediaChange);
      }
      if (scheduleTimer) clearInterval(scheduleTimer);
    };
  }, [callPanelPrefs?.autoThemeConfig?.mode, callPanelPrefs?.autoThemeConfig?.darkStart, callPanelPrefs?.autoThemeConfig?.darkEnd]);

  React.useEffect(() => {
    applyDocumentDarkClass(isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    const modeStr = newMode ? "dark" : "light";
    setIsDarkMode(newMode);
    localStorage.setItem("theme", modeStr);
    // Switch autoThemeConfig to manual when user explicitly clicks manual toggle
    if (callPanelPrefs?.autoThemeConfig?.mode && callPanelPrefs.autoThemeConfig.mode !== "manual") {
      const current = loadCallPanelPrefs(currentUser);
      const next = saveCallPanelPrefs(currentUser, {
        ...current,
        autoThemeConfig: { ...(current.autoThemeConfig || {}), mode: "manual" }
      });
      setCallPanelPrefs(next);
      persistUserVisualPatch({ theme_mode: modeStr, call_panel_prefs: next });
    } else {
      persistUserVisualPatch({ theme_mode: modeStr });
    }
  };

  // Global Customizable Agent Keyboard Shortcuts + '?' Guide
  React.useEffect(() => {
    if (!isLoggedIn) return undefined;
    const shortcutsMap = resolveEffectiveShortcutsMap(callPanelPrefs?.keyboardShortcuts || {});

    const handleGlobalShortcuts = (e) => {
      if (isShortcutsModalOpen || (settingsModalOpen && activeModalTab === "shortcuts")) return;

      // '?' opens Keyboard Shortcuts tab inside Profile Settings when not typing in an input
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "?" && !isEditableTarget(e.target)) {
        e.preventDefault();
        setActiveModalTab("shortcuts");
        setSettingsModalOpen(true);
        return;
      }

      const combo = eventToShortcutCombo(e);
      if (!combo) return;

      const matchedEntry = Object.entries(shortcutsMap).find(([, val]) => val && val === combo);
      if (!matchedEntry) return;
      const [actionId] = matchedEntry;

      e.preventDefault();
      if (actionId === "answer_call") {
        webphoneManager.answerCall();
      } else if (actionId === "hangup_call") {
        webphoneManager.hangupCall();
      } else if (actionId === "toggle_mute") {
        webphoneManager.toggleMute();
      } else if (actionId === "toggle_hold") {
        webphoneManager.toggleHold();
      } else if (actionId === "status_available") {
        handleQuickProfileSwitch("available");
      } else if (actionId === "status_away") {
        handleQuickProfileSwitch("away");
      } else if (actionId === "status_meeting") {
        handleQuickProfileSwitch("meeting");
      } else if (actionId === "open_webphone") {
        setActiveTab("call-center");
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", { detail: { subTab: "webphone" } })
          );
        }, 50);
      } else if (actionId === "open_notifications") {
        window.dispatchEvent(new CustomEvent("TOGGLE_NOTIFICATION_DRAWER"));
      } else if (actionId === "open_customer_360") {
        const st = webphoneManager.getState();
        const num = st?.remoteNumber || st?.dialNumber;
        if (num) {
          window.dispatchEvent(
            new CustomEvent("OPEN_CUSTOMER_360", {
              detail: { phone: num, name: st?.remoteDisplayName || "" }
            })
          );
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [isLoggedIn, isShortcutsModalOpen, settingsModalOpen, activeModalTab, callPanelPrefs?.keyboardShortcuts]);

  // Optional Auto-Open Customer 360° Drawer when incoming call rings
  React.useEffect(() => {
    if (!isLoggedIn || !callPanelPrefs?.autoOpenCustomer360OnCall) return undefined;
    const unsub = webphoneManager.subscribe((st) => {
      if (st.callStatus === "Ringing" && st.remoteNumber) {
        const key = `${st.activeSipCallId || ""}-${st.remoteNumber}`;
        if (autoOpened360CallRef.current !== key) {
          autoOpened360CallRef.current = key;
          window.dispatchEvent(
            new CustomEvent("OPEN_CUSTOMER_360", {
              detail: { phone: st.remoteNumber, name: st.remoteDisplayName || "" }
            })
          );
        }
      } else if (st.callStatus === "Idle") {
        autoOpened360CallRef.current = "";
      }
    });
    return () => unsub();
  }, [isLoggedIn, callPanelPrefs?.autoOpenCustomer360OnCall]);

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
    saveLastVisitedTab(currentUser, activeTab);
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
      "troubleshooting": "Sorun İnceleme (Ping, Traceroute, SIP Capture & sngrep)",
      "sip-debugger": "Sorun İnceleme (Ping, Traceroute, SIP Capture & sngrep)",
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

      if (targetUserId && currentUser) {
        const lastTabToSave = activeTab || getLastVisitedTab(currentUser) || "";
        const lastSubToSave = currentAgentSubTab || getLastVisitedAgentSubTab(currentUser) || "";
        const syncedPrefs = saveCallPanelPrefs(currentUser, {
          ...callPanelPrefs,
          lastVisitedTab: lastTabToSave,
          lastVisitedAgentSubTab: lastSubToSave
        });
        fetch(`${protocol}//${backendHost}/api/agent/profile/${encodeURIComponent(String(targetUserId))}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(targetUserId)
          },
          body: JSON.stringify({ call_panel_prefs: syncedPrefs })
        }).catch(() => {});
      }

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
      clearAuthenticatedSession();
      try {
        const uidKey = String(currentUser?.id || "").trim();
        const extKey = String(currentUser?.extension || "").trim();
        if (uidKey) sessionStorage.removeItem(`notified_int_chat_ids_${uidKey}`);
        if (extKey) sessionStorage.removeItem(`notified_int_chat_ids_${extKey}`);
      } catch (e) {}
      setInternalChatToast(null);
      setCurrentUser(null);
      setIsLoggedIn(false);
      if (isNativeElectron()) {
        await disconnectDesktopServer();
        return;
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  React.useEffect(() => {
    const originalError = console.error;
    let sendingErrorLog = false;

    const sendErrorLog = (args) => {
      if (sendingErrorLog) return;
      sendingErrorLog = true;
      try {
        const message = args
          .map((arg) => {
            if (typeof arg === "object") {
              try {
                return JSON.stringify(arg);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(" ");

        const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
        fetch(`${protocol}//${backendHost}/api/client-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: "error", message })
        }).catch(() => {});
      } finally {
        sendingErrorLog = false;
      }
    };

    console.error = (...args) => {
      originalError(...args);
      sendErrorLog(args);
    };

    return () => {
      console.error = originalError;
    };
  }, [backendHost]);

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

  useEffect(() => {
    if (!pinOverflowOpen && !profileDropdownOpen) return undefined;
    const handleEscMenus = (e) => {
      if (e.key === "Escape") {
        setPinOverflowOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscMenus);
    return () => window.removeEventListener("keydown", handleEscMenus);
  }, [pinOverflowOpen, profileDropdownOpen]);

  // Desktop Mode strict workspace guard & System Tray synchronization (MUST run before early returns!)
  useEffect(() => {
    if (!isLoggedIn || !isDesktopMode) return;
    if (activeTab !== "call-center" && !(activeTab === "omnichannel" && hasOmnichannelPermission)) {
      setActiveTab("call-center");
    }
  }, [isLoggedIn, isDesktopMode, activeTab, hasOmnichannelPermission]);

  useEffect(() => {
    if (!isLoggedIn || !isDesktopMode || typeof window === "undefined") return undefined;
    const syncTray = (wpState) => {
      const profObj =
        agentProfiles.find((p) => p.id === agentActiveProfile) ||
        DEFAULT_USER_PROFILES[0];
      syncDesktopTrayState({
        fullName: currentUser?.full_name || currentUser?.username || "Temsilci",
        extension: currentUser?.extension || "",
        profileId: agentActiveProfile,
        profileLabel: profObj?.name || "Uygun",
        registered: Boolean(wpState?.registered),
        callStatus: wpState?.callStatus || "Idle"
      });
    };
    const unsub = webphoneManager.subscribe(syncTray);

    const handleTrayProfileSwitch = (e) => {
      const nextProf = e?.detail?.profileId;
      if (nextProf) handleQuickProfileSwitch(nextProf);
    };
    const handleTrayLogout = () => {
      handleLogout();
    };
    window.addEventListener("SWITCH_AGENT_PROFILE_FROM_TRAY", handleTrayProfileSwitch);
    window.addEventListener("TRIGGER_DESKTOP_LOGOUT", handleTrayLogout);
    return () => {
      unsub();
      window.removeEventListener("SWITCH_AGENT_PROFILE_FROM_TRAY", handleTrayProfileSwitch);
      window.removeEventListener("TRIGGER_DESKTOP_LOGOUT", handleTrayLogout);
    };
  }, [isLoggedIn, isDesktopMode, currentUser, agentActiveProfile, agentProfiles]);

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} onComplete2FA={complete2FALogin} error={loginError} backendHost={backendHost} />;
  }

  const isAdminRole = currentUser?.role === "admin";
  const hasPermPrefix = (...prefixes) => {
    if (isAdminRole) return true;
    if (!Array.isArray(currentRolePermissions)) return false;
    return prefixes.some((pref) =>
      currentRolePermissions.some((p) => p === pref || p.startsWith(pref + ":"))
    );
  };

  const allTopbarFeatureCatalog = [
    { id: "dashboard", group: "Operasyon & Canlı Ekranlar", label: "Gerçek Zamanlı AI Pano", shortLabel: "AI Pano", icon: Activity, allowed: !isAgentOnlyUser && !isWallboardOnlyUser && hasPermPrefix("dashboard") },
    { id: "wallboard", group: "Operasyon & Canlı Ekranlar", label: "Canlı İzleme Paneli (Wallboard)", shortLabel: "Wallboard", icon: Monitor, allowed: hasPermPrefix("wallboard") },
    { id: "call-center", group: "Operasyon & Canlı Ekranlar", label: "Temsilci Çağrı Paneli", shortLabel: "Çağrı Paneli", icon: Phone, allowed: isAgentOnlyUser || hasPermPrefix("call_panel") },
    { id: "omnichannel", group: "Operasyon & Canlı Ekranlar", label: "Ortak Gelen Kutusu (Omnichannel)", shortLabel: "Omnichannel", icon: MessageSquare, allowed: hasOmnichannelPermission },
    { id: "contacts", group: "Operasyon & Canlı Ekranlar", label: "Rehber Yönetimi", shortLabel: "Rehber", icon: BookOpen, allowed: hasContactsPermission },
    { id: "calendar", group: "Operasyon & Canlı Ekranlar", label: "Randevu Takvimi", shortLabel: "Takvim", icon: Calendar, allowed: !isAgentOnlyUser && !isWallboardOnlyUser },
    { id: "dialer", group: "Operasyon & Canlı Ekranlar", label: "Dış Arama (Dialer)", shortLabel: "Dialer", icon: PhoneCall, allowed: !isAgentOnlyUser && !isWallboardOnlyUser },

    { id: "users", group: "Santral & Yönlendirme", label: "Kullanıcılar", shortLabel: "Kullanıcılar", icon: User, allowed: hasUsersPermission },
    { id: "acd-queues", group: "Santral & Yönlendirme", label: "ACD Kuyruk Yönetimi", shortLabel: "Kuyruklar", icon: Users, allowed: hasQueuesPermission },
    { id: "call-flow", group: "Santral & Yönlendirme", label: "Arama Akış Yönetimi", shortLabel: "Akış Yönetimi", icon: GitBranch, allowed: !isAgentOnlyUser && !isWallboardOnlyUser },
    { id: "inbound-rules", group: "Santral & Yönlendirme", label: "Gelen Arama Kuralı", shortLabel: "Gelen Kural", icon: Phone, allowed: hasInboundRulesPermission },
    { id: "outbound-rules", group: "Santral & Yönlendirme", label: "Giden Arama Kuralı", shortLabel: "Giden Kural", icon: PhoneOutgoing, allowed: hasOutboundRulesPermission },
    { id: "trunks", group: "Santral & Yönlendirme", label: "Dış Hat Tanımı (SIP Trunk)", shortLabel: "Dış Hatlar", icon: Cable, allowed: hasTrunksPermission },
    { id: "auto-provision", group: "Santral & Yönlendirme", label: "Oto Provizyon", shortLabel: "Provizyon", icon: Cpu, allowed: hasAutoprovisionPermission },
    { id: "announcements", group: "Santral & Yönlendirme", label: "Anons Yönetimi", shortLabel: "Anonslar", icon: Volume2, allowed: hasAnnouncementsPermission },
    { id: "work-hours", group: "Santral & Yönlendirme", label: "Mesai & Resmi Tatiller", shortLabel: "Mesai", icon: Clock, allowed: hasWorkHoursPermission && !isAgentOnlyUser && !isWallboardOnlyUser },
    { id: "conferences", group: "Santral & Yönlendirme", label: "Konferans Odaları", shortLabel: "Konferans", icon: Users, allowed: hasConferencesPermission },
    { id: "speed-dial", group: "Santral & Yönlendirme", label: "Hızlı Arama Kodları", shortLabel: "Hızlı Arama", icon: PhoneCall, allowed: hasSpeedDialPermission },
    { id: "blacklist", group: "Santral & Yönlendirme", label: "Numara Engelleme", shortLabel: "Kara Liste", icon: ShieldAlert, allowed: hasBlacklistPermission },

    { id: "ai-agents", group: "Yapay Zeka & Bilgi", label: "AI Temsilcileri", shortLabel: "AI Temsilci", icon: Bot, allowed: hasPermPrefix("ai_agents") },
    { id: "rag-kb", group: "Yapay Zeka & Bilgi", label: "Bilgi Bankası (RAG)", shortLabel: "Bilgi Bankası", icon: Database, allowed: hasPermPrefix("rag", "rag_kb", "knowledge_base") },
    { id: "rule-editor", group: "Yapay Zeka & Bilgi", label: "Kural & Senaryo Editörü", shortLabel: "Senaryolar", icon: Sliders, allowed: hasPermPrefix("rules", "rule_editor") },
    { id: "ai-config-assistant", group: "Yapay Zeka & Bilgi", label: "AI Konfigürasyon Asistanı", shortLabel: "AI Asistan", icon: Sparkles, allowed: !isAgentOnlyUser && !isWallboardOnlyUser && hasPermPrefix("ai_config_assistant") },

    { id: "reports-pano", group: "Raporlar, Güvenlik & Sistem", label: "Çağrı Rapor Panosu", shortLabel: "Raporlar", icon: TrendingUp, allowed: hasReportsPermission },
    { id: "reports-cdr", group: "Raporlar, Güvenlik & Sistem", label: "CDR Çağrı Kayıtları", shortLabel: "CDR", icon: ClipboardList, allowed: hasReportsPermission },
    { id: "reports-audio", group: "Raporlar, Güvenlik & Sistem", label: "Ses Kayıtları", shortLabel: "Ses Kaydı", icon: Volume2, allowed: hasReportsPermission },
    { id: "troubleshooting", group: "Raporlar, Güvenlik & Sistem", label: "Sorun İnceleme & sngrep", shortLabel: "Sorun İncele", icon: Terminal, allowed: hasPermPrefix("troubleshooting", "sip_debugger", "system_settings") },
    { id: "security", group: "Raporlar, Güvenlik & Sistem", label: "Güvenlik Kalkanı", shortLabel: "Güvenlik", icon: ShieldCheck, allowed: hasPermPrefix("security", "system_settings") },
    { id: "event-logs", group: "Raporlar, Güvenlik & Sistem", label: "Olay Günlükleri", shortLabel: "Loglar", icon: FileText, allowed: hasPermPrefix("logs", "event_logs", "system_settings") },
    { id: "system-status", group: "Raporlar, Güvenlik & Sistem", label: "Sistem Panosu & Sağlık", shortLabel: "Sistem Sağlığı", icon: Server, allowed: isAdminRole || hasPermPrefix("system_status", "system_settings") },
    { id: "settings", group: "Raporlar, Güvenlik & Sistem", label: "Sistem Ayarları", shortLabel: "Ayarlar", icon: Settings, allowed: hasPermPrefix("system_settings", "roles", "pbx", "breaks", "channels", "storage", "qa", "smart_callback") }
  ];

  const allowedTopbarFeatures = allTopbarFeatureCatalog.filter((f) => f.allowed);
  const topbarPrefs = normalizeTopbarPrefs(callPanelPrefs?.topbar);
  const pinnedTopbarFeatures = topbarPrefs.pinnedItems
    .map((id) => allowedTopbarFeatures.find((f) => f.id === id))
    .filter(Boolean);

  // Yaklaşım B: Tek satır koruyarak Yatay Çağrı Merkezi modunda üst barı otomatik kompaktlaştırma
  const isHorizontalCallCenterBar =
    activeTab === "call-center" &&
    (isAgentOnlyUser ||
      currentUser?.role === "agent" ||
      isAgentFullScreenMode ||
      callPanelPrefs?.navPosition === "top");

  const effectivePinStyle = isHorizontalCallCenterBar ? "icon" : topbarPrefs.pinStyle;
  const effectiveMaxVisiblePins = isHorizontalCallCenterBar
    ? Math.min(2, topbarPrefs.maxVisiblePins)
    : topbarPrefs.maxVisiblePins;
  const visiblePinnedFeatures = pinnedTopbarFeatures.slice(0, effectiveMaxVisiblePins);
  const overflowPinnedFeatures = pinnedTopbarFeatures.slice(effectiveMaxVisiblePins);

  const canUseGlobalSearch = !isAgentOnlyUser && !isWallboardOnlyUser && currentUser?.role !== "agent";
  const effectiveSearchMode =
    isHorizontalCallCenterBar && (topbarPrefs.searchMode === "normal" || topbarPrefs.searchMode === "wide")
      ? "icon"
      : topbarPrefs.searchMode;

  const effectiveUserExtension = String(
    currentUser?.extension || currentUser?.sip_username || ""
  ).trim();

  const resolvedUserRoleLabel = (() => {
    const rawRole = String(currentUser?.role || "").trim();
    const lower = rawRole.toLowerCase();
    if (lower === "admin" || lower === "sistem yöneticisi") return "Yönetici";
    if (lower === "supervisor" || lower === "süpervizör") return "Süpervizör";
    if (lower === "agent" || lower === "temsilci" || !rawRole) return "Temsilci";
    return rawRole;
  })();

  const resolvedActiveProfileName =
    (agentProfiles.find((p) => p.id === agentActiveProfile) || DEFAULT_USER_PROFILES[0])?.name ||
    "Müsait";

  const resolvedActiveProfileTextCls =
    agentActiveProfile === "away"
      ? "text-amber-500 font-bold"
      : agentActiveProfile === "meeting"
      ? "text-rose-500 font-bold"
      : agentActiveProfile === "other"
      ? "text-indigo-500 font-bold"
      : "text-emerald-500 font-bold";

  const resolvedActiveProfileDotCls =
    agentActiveProfile === "away"
      ? "bg-amber-500"
      : agentActiveProfile === "meeting"
      ? "bg-rose-500"
      : agentActiveProfile === "other"
      ? "bg-indigo-500"
      : "bg-emerald-500";

  const hasAnySelectedAvatarField = Boolean(
    topbarPrefs.showName ||
      (topbarPrefs.showExtension && Boolean(effectiveUserExtension)) ||
      topbarPrefs.showRole ||
      topbarPrefs.showProfile
  );

  const effectiveAvatarOnly = Boolean(topbarPrefs.avatarOnly) || !hasAnySelectedAvatarField;
  const hasAnyAvatarText = !effectiveAvatarOnly;

  const updateTopbarPrefsLive = (topbarPatch) => {
    setCallPanelPrefs((prev) => {
      const prevTopbar = normalizeTopbarPrefs(prev?.topbar);
      const patchObj = typeof topbarPatch === "function" ? topbarPatch(prevTopbar) : topbarPatch;
      const nextTopbar = normalizeTopbarPrefs({
        ...prevTopbar,
        ...(patchObj || {})
      });
      const nextPrefs = {
        ...(prev || {}),
        topbar: nextTopbar
      };
      if (settingsModalOpen) {
        return nextPrefs;
      }
      const saved = saveCallPanelPrefs(currentUser, nextPrefs);
      persistUserVisualPatch({ call_panel_prefs: saved });
      return saved;
    });
  };

  const updateLandingPrefsLive = (landingPatch) => {
    setCallPanelPrefs((prev) => {
      const nextPrefs = {
        ...(prev || {}),
        ...(landingPatch || {})
      };
      if (settingsModalOpen) {
        return nextPrefs;
      }
      const saved = saveCallPanelPrefs(currentUser, nextPrefs);
      persistUserVisualPatch({ call_panel_prefs: saved });
      return saved;
    });
  };

  const isCurrentViewPinnedAsLanding = Boolean(
    activeTab === "call-center"
      ? (isAgentOnlyUser || callPanelPrefs?.defaultLandingTab === "call-center") &&
          callPanelPrefs?.defaultAgentSubTab === currentAgentSubTab
      : callPanelPrefs?.defaultLandingTab === activeTab
  );

  return (
    <div className="aida-app-shell h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex font-sans transition-colors duration-300">
      <Head>
        <title>AIDA PBX</title>
        <meta name="description" content="AIDA PBX — Çok Kanallı Yapay Zeka Santral Platformu" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
      </Head>

      {/* Sidebar Navigation */}
      {!isDesktopMode && !isEditingCallFlow && !isWallboardOnlyUser && !(activeTab === "call-center" && (isAgentOnlyUser || isAgentFullScreenMode)) && (
        <aside
          onMouseOver={(e) => {
            if (!isSidebarCollapsed) {
              if (sidebarTooltip) {
                lastHoveredSidebarElRef.current = null;
                setSidebarTooltip(null);
              }
              return;
            }
            const target = e.target.closest("button, [title]");
            if (target && e.currentTarget.contains(target)) {
              if (lastHoveredSidebarElRef.current === target) return;
              const label = target.getAttribute("title") || target.textContent?.trim();
              if (label) {
                lastHoveredSidebarElRef.current = target;
                const rect = target.getBoundingClientRect();
                setSidebarTooltip({
                  label,
                  top: rect.top + rect.height / 2,
                  left: rect.right + 10,
                });
                return;
              }
            }
            if (lastHoveredSidebarElRef.current) {
              lastHoveredSidebarElRef.current = null;
              setSidebarTooltip(null);
            }
          }}
          onMouseLeave={() => {
            lastHoveredSidebarElRef.current = null;
            setSidebarTooltip(null);
          }}
          onScroll={() => {
            if (sidebarTooltip) {
              lastHoveredSidebarElRef.current = null;
              setSidebarTooltip(null);
            }
          }}
          data-collapsed={isSidebarCollapsed ? "true" : "false"}
          className={`aida-sidebar-contain aida-sidebar ${
            isSidebarCollapsed ? "w-20 px-2.5" : "w-64 px-4"
          } py-4 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col shrink-0 overflow-y-auto overflow-x-hidden`}
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

        <nav ref={sidebarNavRef} className={`flex-1 ${isSidebarCollapsed ? "space-y-2" : "space-y-4"} select-none transition-all duration-300`}>
          {/* Group 1: Operasyon & İzleme */}
          <div className="aida-sidebar-group flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                aria-expanded={Boolean(openCategories.operations)}
                onClick={() => toggleCategory("operations")}
                className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Operasyon & İzleme</span>
                <ChevronDown
                  size={12}
                  className={`transform shrink-0 ${
                    openCategories.operations ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.operations ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.operations ? { inert: "" } : {})}
              className="aida-sidebar-group-body space-y-1"
            >
              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "dashboard" || p.startsWith("dashboard:")))) && (
                <button
                  onClick={() => setActiveTab("dashboard")}
                  aria-current={activeTab === "dashboard" ? "page" : undefined}
                  title="Gerçek Zamanlı AI Pano"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "dashboard" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Activity size={16} className={`shrink-0 ${activeTab === "dashboard" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Gerçek Zamanlı AI Pano</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "wallboard" || p.startsWith("wallboard:")))) && (
                <button
                  onClick={() => setActiveTab("wallboard")}
                  aria-current={activeTab === "wallboard" ? "page" : undefined}
                  title="Canlı İzleme Paneli"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "wallboard" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Monitor size={16} className={`shrink-0 ${activeTab === "wallboard" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Canlı İzleme Paneli</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "call_panel" || p.startsWith("call_panel:")))) && (
                <button
                  onClick={() => setActiveTab("call-center")}
                  aria-current={activeTab === "call-center" ? "page" : undefined}
                  title="Temsilci Çağrı Paneli"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "call-center" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Phone size={16} className={`shrink-0 ${activeTab === "call-center" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Çağrı Paneli</span>
                </button>
              )}

              {hasOmnichannelPermission && (
                <button
                  onClick={() => setActiveTab("omnichannel")}
                  aria-current={activeTab === "omnichannel" ? "page" : undefined}
                  title="Ortak Gelen Kutusu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "omnichannel" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <MessageSquare size={16} className={`shrink-0 ${activeTab === "omnichannel" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Ortak Gelen Kutusu</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p === "api_budgets" || p.startsWith("api_budgets:") || p.startsWith("budget:")))) && (
                <button
                  onClick={() => setActiveTab("api-budgets")}
                  aria-current={activeTab === "api-budgets" ? "page" : undefined}
                  title="API Bütçe ve Tüketim"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "api-budgets" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Database size={16} className={`shrink-0 ${activeTab === "api-budgets" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>API Bütçe ve Tüketim</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 2: Yapay Zeka & Bilgi */}
          {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_agents:") || p.startsWith("ai_config_assistant:") || p.startsWith("rag:") || p.startsWith("rag_kb:") || p.startsWith("knowledge_base:") || p.startsWith("rules:") || p.startsWith("rule_editor:")))) && (
          <div className="aida-sidebar-group flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                aria-expanded={Boolean(openCategories.ai)}
                onClick={() => toggleCategory("ai")}
                className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Yapay Zeka & Bilgi</span>
                <ChevronDown
                  size={12}
                  className={`transform shrink-0 ${
                    openCategories.ai ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.ai ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.ai ? { inert: "" } : {})}
              className="aida-sidebar-group-body space-y-1"
            >
              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_config_assistant:")))) && (
                <button
                  onClick={() => setActiveTab("ai-config-assistant")}
                  aria-current={activeTab === "ai-config-assistant" ? "page" : undefined}
                  title="AI Konfigürasyon Asistanı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "ai-config-assistant" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Sparkles size={16} className={`shrink-0 ${activeTab === "ai-config-assistant" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI Konfigürasyon Asistanı</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("ai_agents:")))) && (
                <button
                  onClick={() => setActiveTab("ai-agents")}
                  aria-current={activeTab === "ai-agents" ? "page" : undefined}
                  title="AI Temsilcileri"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "ai-agents" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Bot size={16} className={`shrink-0 ${activeTab === "ai-agents" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI Temsilcileri</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("rag:") || p.startsWith("rag_kb:") || p.startsWith("knowledge_base:")))) && (
                <button
                  onClick={() => setActiveTab("rag-kb")}
                  aria-current={activeTab === "rag-kb" ? "page" : undefined}
                  title="Bilgi Bankası (RAG)"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "rag-kb" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Database size={16} className={`shrink-0 ${activeTab === "rag-kb" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Bilgi Bankası (RAG)</span>
                </button>
              )}

              {(currentUser?.role === "admin" || (Array.isArray(currentRolePermissions) && currentRolePermissions.some(p => p.startsWith("rules:") || p.startsWith("rule_editor:")))) && (
                <button
                  onClick={() => setActiveTab("rule-editor")}
                  aria-current={activeTab === "rule-editor" ? "page" : undefined}
                  title="Kural & Senaryo Editörü"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "rule-editor" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Sliders size={16} className={`shrink-0 ${activeTab === "rule-editor" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kural & Senaryo Editörü</span>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Group 2.5: Santral */}
          <div className="aida-sidebar-group flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                aria-expanded={Boolean(openCategories.pbxGroup)}
                onClick={() => toggleCategory("pbxGroup")}
                className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Santral</span>
                <ChevronDown
                  size={12}
                  className={`transform shrink-0 ${
                    openCategories.pbxGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.pbxGroup ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.pbxGroup ? { inert: "" } : {})}
              className="aida-sidebar-group-body space-y-1"
            >
              {hasUsersPermission && (
                <button
                  onClick={() => setActiveTab("users")}
                  aria-current={activeTab === "users" ? "page" : undefined}
                  title="Kullanıcılar"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "users" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <User size={16} className={`shrink-0 ${activeTab === "users" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kullanıcılar</span>
                </button>
              )}

              {hasAnnouncementsPermission && (
                <button
                  onClick={() => setActiveTab("announcements")}
                  aria-current={activeTab === "announcements" ? "page" : undefined}
                  title="Anons Yönetimi"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "announcements" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Volume2 size={16} className={`shrink-0 ${activeTab === "announcements" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Anons Yönetimi</span>
                </button>
              )}

              {hasQueuesPermission && (
                <button
                  onClick={() => setActiveTab("acd-queues")}
                  aria-current={activeTab === "acd-queues" ? "page" : undefined}
                  title="ACD Kuyruk"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "acd-queues" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "acd-queues" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>ACD Kuyruk</span>
                </button>
              )}

              {hasAutoprovisionPermission && (
                <button
                  onClick={() => setActiveTab("auto-provision")}
                  aria-current={activeTab === "auto-provision" ? "page" : undefined}
                  title="Oto Provizyon"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "auto-provision" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Cpu size={16} className={`shrink-0 ${activeTab === "auto-provision" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Oto Provizyon</span>
                </button>
              )}

              {hasOutboundRulesPermission && (
                <button
                  onClick={() => setActiveTab("outbound-rules")}
                  aria-current={activeTab === "outbound-rules" ? "page" : undefined}
                  title="Giden Arama Kuralı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "outbound-rules" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <PhoneCall size={16} className={`shrink-0 ${activeTab === "outbound-rules" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Giden Arama Kuralı</span>
                </button>
              )}

              {hasInboundRulesPermission && (
                <button
                  onClick={() => setActiveTab("inbound-rules")}
                  aria-current={activeTab === "inbound-rules" ? "page" : undefined}
                  title="Gelen Arama Kuralı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "inbound-rules" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Phone size={16} className={`shrink-0 ${activeTab === "inbound-rules" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Gelen Arama Kuralı</span>
                </button>
              )}

              {hasCallPickupPermission && (
                <button
                  onClick={() => setActiveTab("call-pickup-groups")}
                  aria-current={activeTab === "call-pickup-groups" ? "page" : undefined}
                  title="Çağrı Toplama Grubu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "call-pickup-groups" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "call-pickup-groups" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Çağrı Toplama Grubu</span>
                </button>
              )}

              {hasSubscriberGroupsPermission && (
                <button
                  onClick={() => setActiveTab("subscriber-groups")}
                  aria-current={activeTab === "subscriber-groups" ? "page" : undefined}
                  title="Abone Grubu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "subscriber-groups" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "subscriber-groups" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Abone Grubu</span>
                </button>
              )}

              {hasContactsPermission && (
                <button
                  onClick={() => setActiveTab("contacts")}
                  aria-current={activeTab === "contacts" ? "page" : undefined}
                  title="Rehber"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "contacts" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <BookOpen size={16} className={`shrink-0 ${activeTab === "contacts" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Rehber</span>
                </button>
              )}

              {hasTrunksPermission && (
                <button
                  onClick={() => setActiveTab("trunks")}
                  aria-current={activeTab === "trunks" ? "page" : undefined}
                  title="Dış Hat Tanımı"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "trunks" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Cable size={16} className={`shrink-0 ${activeTab === "trunks" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Dış Hat Tanımı</span>
                </button>
              )}

              {hasConferencesPermission && (
                <button
                  onClick={() => setActiveTab("conferences")}
                  aria-current={activeTab === "conferences" ? "page" : undefined}
                  title="Konferans"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "conferences" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Users size={16} className={`shrink-0 ${activeTab === "conferences" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Konferans</span>
                </button>
              )}

              {hasSpeedDialPermission && (
                <button
                  onClick={() => setActiveTab("speed-dial")}
                  aria-current={activeTab === "speed-dial" ? "page" : undefined}
                  title="Hızlı Arama"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "speed-dial" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <PhoneCall size={16} className={`shrink-0 ${activeTab === "speed-dial" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hızlı Arama</span>
                </button>
              )}

              {hasBlacklistPermission && (
                <button
                  onClick={() => setActiveTab("blacklist")}
                  aria-current={activeTab === "blacklist" ? "page" : undefined}
                  title="Numara Engelleme"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "blacklist" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <ShieldAlert size={16} className={`shrink-0 ${activeTab === "blacklist" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Numara Engelleme</span>
                </button>
              )}

              {hasScheduledReportsPermission && (
                <button
                  onClick={() => setActiveTab("scheduled-reports")}
                  aria-current={activeTab === "scheduled-reports" ? "page" : undefined}
                  title="Zamanlanmış Raporlar"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "scheduled-reports" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Calendar size={16} className={`shrink-0 ${activeTab === "scheduled-reports" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Zamanlanmış Raporlar</span>
                </button>
              )}
            </div>
          </div>

          {/* Group 3: Çağrı & Yönlendirme */}
          <div className="aida-sidebar-group flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                aria-expanded={Boolean(openCategories.routing)}
                onClick={() => toggleCategory("routing")}
                className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-550 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Çağrı & Yönlendirme</span>
                <ChevronDown
                  size={12}
                  className={`transform shrink-0 ${
                    openCategories.routing ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.routing ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.routing ? { inert: "" } : {})}
              className="aida-sidebar-group-body space-y-1"
            >
              <button
                onClick={() => setActiveTab("call-flow")}
                aria-current={activeTab === "call-flow" ? "page" : undefined}
                title="Arama Akış Yönetimi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "call-flow" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <GitBranch size={16} className={`shrink-0 ${activeTab === "call-flow" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Arama Akış Yönetimi</span>
              </button>

              {hasWorkHoursPermission && (
                <button
                  onClick={() => setActiveTab("work-hours")}
                  aria-current={activeTab === "work-hours" ? "page" : undefined}
                  title="Mesai Saatleri & Resmi Tatiller"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "work-hours" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Clock size={16} className={`shrink-0 ${activeTab === "work-hours" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Mesai & Resmi Tatiller</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("dialer")}
                aria-current={activeTab === "dialer" ? "page" : undefined}
                title="Dış Arama (Dialer)"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "dialer" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <PhoneCall size={16} className={`shrink-0 ${activeTab === "dialer" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Dış Arama (Dialer)</span>
              </button>

              <button
                onClick={() => setActiveTab("calendar")}
                aria-current={activeTab === "calendar" ? "page" : undefined}
                title="Randevu Takvimi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "calendar" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Calendar size={16} className={`shrink-0 ${activeTab === "calendar" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Randevu Takvimi</span>
              </button>
            </div>
          </div>

          {/* Group 4: Çağrı Raporları & Analiz */}
          {hasReportsPermission && (
            <div className="aida-sidebar-group flex flex-col gap-1">
              {!isSidebarCollapsed ? (
                <button
                  type="button"
                  aria-expanded={Boolean(openCategories.reportsGroup)}
                  onClick={() => toggleCategory("reportsGroup")}
                  className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
                >
                  <span>Çağrı Raporları & Analiz</span>
                  <ChevronDown
                    size={12}
                    className={`transform shrink-0 ${
                      openCategories.reportsGroup ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                    }`}
                  />
                </button>
              ) : (
                <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
              )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.reportsGroup ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.reportsGroup ? { inert: "" } : {})}
              className={`aida-sidebar-group-body aida-sidebar-group-body--scroll space-y-1 scrollbar-thin ${isSidebarCollapsed ? "pr-0" : "pr-1.5"}`}
            >
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.some(p => p.startsWith("reports_custom_builder:") || p === "reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-custom-builder")}
                  aria-current={activeTab === "reports-custom-builder" ? "page" : undefined}
                  title="Raporlar: Özel Rapor Tasarımcısı & AI Rapor Üretici"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-custom-builder" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-custom-builder" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Özel Rapor Tasarımcısı</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("reports-pano")}
                aria-current={activeTab === "reports-pano" ? "page" : undefined}
                title="Raporlar: Pano"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-pano" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Monitor size={16} className={`shrink-0 ${activeTab === "reports-pano" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Pano</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-cdr")}
                aria-current={activeTab === "reports-cdr" ? "page" : undefined}
                title="Raporlar: CDR"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-cdr" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <FileText size={16} className={`shrink-0 ${activeTab === "reports-cdr" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>CDR</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-audio")}
                aria-current={activeTab === "reports-audio" ? "page" : undefined}
                title="Raporlar: Ses Kayıtları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-audio" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Volume2 size={16} className={`shrink-0 ${activeTab === "reports-audio" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Ses Kayıtları</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-transcripts")}
                aria-current={activeTab === "reports-transcripts" ? "page" : undefined}
                title="Raporlar: Çağrı Transkripti"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transcripts" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <MessageSquare size={16} className={`shrink-0 ${activeTab === "reports-transcripts" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Çağrı Transkripti</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-sentiment")}
                aria-current={activeTab === "reports-sentiment" ? "page" : undefined}
                title="Raporlar: Duygu Analizi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-sentiment" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Duygu Analizi</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-intent")}
                aria-current={activeTab === "reports-intent" ? "page" : undefined}
                title="Raporlar: Niyet Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-intent" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Layers size={16} className={`shrink-0 ${activeTab === "reports-intent" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Niyet Raporu</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-qa")}
                aria-current={activeTab === "reports-qa" ? "page" : undefined}
                title="Raporlar: Kalite Değerlendirmeleri"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-qa" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Award size={16} className={`shrink-0 ${activeTab === "reports-qa" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kalite Değerlendirmeleri</span>
              </button>

              <button
                onClick={() => setActiveTab("reports-notes")}
                aria-current={activeTab === "reports-notes" ? "page" : undefined}
                title="Raporlar: Temsilci Notları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-notes" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <ClipboardList size={16} className={`shrink-0 ${activeTab === "reports-notes" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Notları</span>
              </button>

              {/* Temsilci Performans ve KPI Raporu */}
              <button
                onClick={() => setActiveTab("reports-perf")}
                aria-current={activeTab === "reports-perf" ? "page" : undefined}
                title="Raporlar: Temsilci Performans & KPI"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-perf" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Award size={16} className={`shrink-0 ${activeTab === "reports-perf" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Performans & KPI</span>
              </button>

              {/* Kuyruk / Bekleme Analitiği */}
              <button
                onClick={() => setActiveTab("reports-queue")}
                aria-current={activeTab === "reports-queue" ? "page" : undefined}
                title="Raporlar: Kuyruk / Bekleme Analitiği"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-queue" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Users size={16} className={`shrink-0 ${activeTab === "reports-queue" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kuyruk / Bekleme Analitiği</span>
              </button>

              {/* ACD Kuyruk Memnuniyet Anketi Raporları */}
              <button
                onClick={() => setActiveTab("reports-survey")}
                aria-current={activeTab === "reports-survey" ? "page" : undefined}
                title="Raporlar: Anket Raporları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-survey" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Sparkles size={16} className={`shrink-0 ${activeTab === "reports-survey" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Anket Raporları</span>
              </button>

              {/* Duygu Durumu Isı Haritası */}
              <button
                onClick={() => setActiveTab("reports-sentiment-heat")}
                aria-current={activeTab === "reports-sentiment-heat" ? "page" : undefined}
                title="Raporlar: Duygu Durumu Isı Haritası"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-sentiment-heat" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Activity size={16} className={`shrink-0 ${activeTab === "reports-sentiment-heat" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Duygu Durumu Isı Haritası</span>
              </button>

              {/* Kelime Bulutu ve Konu Trendleri */}
              <button
                onClick={() => setActiveTab("reports-wordcloud")}
                aria-current={activeTab === "reports-wordcloud" ? "page" : undefined}
                title="Raporlar: Kelime Bulutu & Trendler"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-wordcloud" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <MessageSquare size={16} className={`shrink-0 ${activeTab === "reports-wordcloud" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kelime Bulutu & Trendler</span>
              </button>

              {/* FCR */}
              <button
                onClick={() => setActiveTab("reports-fcr")}
                aria-current={activeTab === "reports-fcr" ? "page" : undefined}
                title="Raporlar: İlk Aramada Çözüm (FCR)"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-fcr" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <CheckCircle size={16} className={`shrink-0 ${activeTab === "reports-fcr" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>İlk Aramada Çözüm (FCR)</span>
              </button>

              {/* AI vs. İnsan Karşılaştırmalı ROI Paneli */}
              <button
                onClick={() => setActiveTab("reports-roi")}
                aria-current={activeTab === "reports-roi" ? "page" : undefined}
                title="Raporlar: AI vs. İnsan ROI Paneli"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-roi" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <TrendingUp size={16} className={`shrink-0 ${activeTab === "reports-roi" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>AI vs. İnsan ROI Paneli</span>
              </button>

              {/* Kaçan Çağrı Analizi */}
              <button
                onClick={() => setActiveTab("reports-missed")}
                aria-current={activeTab === "reports-missed" ? "page" : undefined}
                title="Raporlar: Kaçan Çağrı Analizi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-missed" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <PhoneOff size={16} className={`shrink-0 ${activeTab === "reports-missed" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Kaçan Çağrı Analizi</span>
              </button>

              {/* Agent Status Timeline */}
              <button
                onClick={() => setActiveTab("reports-agent-status-timeline")}
                aria-current={activeTab === "reports-agent-status-timeline" ? "page" : undefined}
                title="Raporlar: Temsilci Kronolojisi"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-agent-status-timeline" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Clock size={16} className={`shrink-0 ${activeTab === "reports-agent-status-timeline" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Temsilci Kronolojisi</span>
              </button>

              {/* Hourly/Daily Traffic Load */}
              <button
                onClick={() => setActiveTab("reports-traffic-load")}
                aria-current={activeTab === "reports-traffic-load" ? "page" : undefined}
                title="Raporlar: Yoğunluk Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-traffic-load" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Calendar size={16} className={`shrink-0 ${activeTab === "reports-traffic-load" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Yoğunluk Raporu</span>
              </button>

              {/* Trunk Utilization */}
              <button
                onClick={() => setActiveTab("reports-trunk")}
                aria-current={activeTab === "reports-trunk" ? "page" : undefined}
                title="Raporlar: Hat Kapasite Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-trunk" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Cpu size={16} className={`shrink-0 ${activeTab === "reports-trunk" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hat Kapasite Raporu</span>
              </button>

              {/* DID Report */}
              {(currentUser?.role === "admin" || !Array.isArray(currentRolePermissions) || currentRolePermissions.includes("reports_did:access") || currentRolePermissions.includes("reports:access")) && (
                <button
                  onClick={() => setActiveTab("reports-did")}
                  aria-current={activeTab === "reports-did" ? "page" : undefined}
                  title="Raporlar: DID Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-did" ? sidebarActiveItemCls : sidebarInactiveItemCls
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
                  aria-current={activeTab === "reports-trunk-minutes" ? "page" : undefined}
                  title="Raporlar: Operatör Dakika & Paket Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-trunk-minutes" ? sidebarActiveItemCls : sidebarInactiveItemCls
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
                  aria-current={activeTab === "reports-invalid-calls" ? "page" : undefined}
                  title="Raporlar: Hatalı & Eşleşmeyen Çağrı Raporu"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                  } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "reports-invalid-calls" ? sidebarActiveItemCls : sidebarInactiveItemCls
                  }`}
                >
                  <AlertTriangle size={16} className={`shrink-0 ${activeTab === "reports-invalid-calls" ? text : ""}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Hatalı & Eşleşmeyen Çağrı</span>
                </button>
              )}

              {/* IVR Drop-Off */}
              <button
                onClick={() => setActiveTab("reports-ivr-drop")}
                aria-current={activeTab === "reports-ivr-drop" ? "page" : undefined}
                title="Raporlar: IVR Terk Oranı"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ivr-drop" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Shuffle size={16} className={`shrink-0 ${activeTab === "reports-ivr-drop" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>IVR Terk Oranı</span>
              </button>

              {/* Transfer & Hold Analytics */}
              <button
                onClick={() => setActiveTab("reports-transfer-hold")}
                aria-current={activeTab === "reports-transfer-hold" ? "page" : undefined}
                title="Raporlar: Aktarma & Bekletme"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-transfer-hold" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <PhoneForwarded size={16} className={`shrink-0 ${activeTab === "reports-transfer-hold" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 truncate ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Aktarma & Bekletme</span>
              </button>

              {/* AI vs. Human A/B Testing */}
              <button
                onClick={() => setActiveTab("reports-ab-testing")}
                aria-current={activeTab === "reports-ab-testing" ? "page" : undefined}
                title="Raporlar: Verimlilik Karşılaştırması"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ab-testing" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Layers size={16} className={`shrink-0 ${activeTab === "reports-ab-testing" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Verimlilik Karşılaştırması</span>
              </button>

              {/* Customer Frustration / Friction Points */}
              <button
                onClick={() => setActiveTab("reports-friction")}
                aria-current={activeTab === "reports-friction" ? "page" : undefined}
                title="Raporlar: Müşteri Çile Noktaları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-friction" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Frown size={16} className={`shrink-0 ${activeTab === "reports-friction" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Müşteri Çile Noktaları</span>
              </button>

              {/* Agent Compliance & Script Adherence */}
              <button
                onClick={() => setActiveTab("reports-compliance")}
                aria-current={activeTab === "reports-compliance" ? "page" : undefined}
                title="Raporlar: Senaryo Sadakati Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-compliance" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <ShieldCheck size={16} className={`shrink-0 ${activeTab === "reports-compliance" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Senaryo Sadakati Raporu</span>
              </button>

              {/* Silence & Interruption Analytics */}
              <button
                onClick={() => setActiveTab("reports-silence")}
                aria-current={activeTab === "reports-silence" ? "page" : undefined}
                title="Raporlar: Sessizlik & Söz Kesme"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-silence" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <MicOff size={16} className={`shrink-0 ${activeTab === "reports-silence" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sessizlik & Söz Kesme</span>
              </button>

              {/* Executive Summary Generator */}
              <button
                onClick={() => setActiveTab("reports-ceo-summary")}
                aria-current={activeTab === "reports-ceo-summary" ? "page" : undefined}
                title="Raporlar: CEO Özet Raporu"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "reports-ceo-summary" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Crown size={16} className={`shrink-0 ${activeTab === "reports-ceo-summary" ? text : ""}`} />
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
                    aria-current={activeTab === tab ? "page" : undefined}
                    title={`Raporlar: ${label}`}
                    className={`w-full flex items-center ${
                      isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                    } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                      activeTab === tab ? sidebarActiveItemCls : sidebarInactiveItemCls
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 ${activeTab === tab ? text : ""}`} />
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Group 5: Yönetim & Ayarlar */}
          {(currentUser?.role === 'admin' || hasPermPrefix("system_settings", "roles", "pbx", "breaks", "channels", "storage", "qa", "smart_callback", "logs", "event_logs", "troubleshooting", "sip_debugger", "security", "system_status")) && (
          <div className="aida-sidebar-group flex flex-col gap-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                aria-expanded={Boolean(openCategories.system)}
                onClick={() => toggleCategory("system")}
                className="aida-sidebar-cat-btn w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-555 hover:text-slate-600 dark:hover:text-slate-300 tracking-wider uppercase cursor-pointer whitespace-nowrap"
              >
                <span>Yönetim & Ayarlar</span>
                <ChevronDown
                  size={12}
                  className={`transform shrink-0 ${
                    openCategories.system ? "" : "-rotate-90 text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ) : (
              <div className="w-8 mx-auto border-t border-slate-100 dark:border-slate-800/80 my-1" />
            )}
            
            <div
              data-open={isSidebarCollapsed || openCategories.system ? "true" : "false"}
              {...(!isSidebarCollapsed && !openCategories.system ? { inert: "" } : {})}
              className="aida-sidebar-group-body space-y-1"
            >
              {(currentUser?.role === "admin" || hasPermPrefix("system_settings", "roles", "pbx", "breaks", "channels", "storage", "qa", "smart_callback", "voice_biometrics", "recording_retention", "universal_api", "canned_responses")) && (
              <button
                onClick={() => setActiveTab("settings")}
                aria-current={activeTab === "settings" ? "page" : undefined}
                title="Sistem Ayarları"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "settings" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Settings size={16} className={`shrink-0 ${activeTab === "settings" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sistem Ayarları</span>
              </button>
              )}

              {(currentUser?.role === "admin" || hasPermPrefix("system_status", "system_settings")) && (
              <button
                onClick={() => setActiveTab("system-status")}
                aria-current={activeTab === "system-status" ? "page" : undefined}
                title="Sistem Panosu & Sağlık"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "system-status" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <Server size={16} className={`shrink-0 ${activeTab === "system-status" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sistem Panosu & Sağlık</span>
              </button>
              )}

              {(currentUser?.role === "admin" || hasPermPrefix("logs", "event_logs", "system_settings")) && (
              <button
                onClick={() => setActiveTab("event-logs")}
                aria-current={activeTab === "event-logs" ? "page" : undefined}
                title="Olay Günlükleri"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "event-logs" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <FileText size={16} className={`shrink-0 ${activeTab === "event-logs" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Olay Günlükleri</span>
              </button>
              )}

              {(currentUser?.role === "admin" || hasPermPrefix("troubleshooting", "sip_debugger", "system_settings")) && (
              <button
                onClick={() => setActiveTab("troubleshooting")}
                aria-current={activeTab === "troubleshooting" || activeTab === "sip-debugger" ? "page" : undefined}
                title="Sorun İnceleme"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "troubleshooting" || activeTab === "sip-debugger"
                    ? sidebarActiveItemCls
                    : sidebarInactiveItemCls
                }`}
              >
                <Activity
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 ${
                    activeTab === "troubleshooting" || activeTab === "sip-debugger"
                      ? text
                      : ""
                  }`}
                />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Sorun İnceleme</span>
              </button>
              )}

              {(currentUser?.role === "admin" || hasPermPrefix("security", "system_settings")) && (
              <button
                onClick={() => setActiveTab("security")}
                aria-current={activeTab === "security" ? "page" : undefined}
                title="Güvenlik Kalkanı"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "security" ? sidebarActiveItemCls : sidebarInactiveItemCls
                }`}
              >
                <ShieldAlert size={16} className={`shrink-0 ${activeTab === "security" ? text : ""}`} />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>Güvenlik Kalkanı</span>
              </button>
              )}
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
            className={`flex items-center gap-1.5 ${text} font-bold`}
          >
            <span className={`h-2 w-2 rounded-full ${bg} animate-pulse shrink-0`}></span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}>Sistem Çevrimiçi</span>
          </p>
          <button
            onClick={() => setActiveTab("changelog")}
            title="Sistem Versiyonu ve Değişiklik Günlüğü (v3.0.0 On-Premise)"
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:underline transition cursor-pointer bg-transparent border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
          >
            <span>{isSidebarCollapsed ? "v3.0.0" : "v3.0.0 (On-Premise)"}</span>
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
      <main className="aida-app-main flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950/40 transition-colors duration-300">
        
        {/* Top Header Navbar (Single-Row Persistent Bar with Yaklaşım B Auto-Compacting) */}
        {!isEditingCallFlow && (() => {
          const visiblePinIdSet = new Set(visiblePinnedFeatures.map((f) => f.id));
          const lastVisiblePinId =
            visiblePinnedFeatures.length > 0
              ? visiblePinnedFeatures[visiblePinnedFeatures.length - 1].id
              : null;

          const renderHeaderToken = (token, zoneName) => {
            if (!token) return null;

            if (token.startsWith("pin:")) {
              if (isDesktopMode) return null;
              const fid = token.slice(4);
              if (!visiblePinIdSet.has(fid)) return null;
              const feat = visiblePinnedFeatures.find((f) => f.id === fid);
              if (!feat) return null;
              const FeatIcon = feat.icon;
              const isAct = activeTab === feat.id;
              const slug = getTurkishSlugForTab(feat.id);
              const isLastVisible = fid === lastVisiblePinId;

              return (
                <React.Fragment key={token}>
                  <a
                    href={`/?tab=${encodeURIComponent(slug)}`}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        setActiveTab(feat.id);
                      }
                    }}
                    title={feat.label}
                    aria-label={feat.label}
                    className={`${isHorizontalCallCenterBar ? "hidden lg:flex" : "hidden md:flex"} items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm whitespace-nowrap ${
                      effectivePinStyle === "icon" ? "p-2" : "px-2.5 py-1.5"
                    } ${
                      isAct
                        ? `${bg} text-white border-transparent`
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <FeatIcon size={14} className={isAct ? "text-white shrink-0" : `${text} shrink-0`} />
                    {effectivePinStyle !== "icon" && (
                      <span className="max-w-[110px] truncate">{feat.shortLabel}</span>
                    )}
                  </a>

                  {isLastVisible && overflowPinnedFeatures.length > 0 && (
                    <div ref={pinOverflowRef} className={`relative ${isHorizontalCallCenterBar ? "hidden lg:block" : "hidden md:block"}`}>
                      <button
                        type="button"
                        onClick={() => setPinOverflowOpen((prev) => !prev)}
                        aria-expanded={pinOverflowOpen}
                        aria-label="Diğer Sabitlenmiş Kısayollar"
                        title={`Diğer Kısayollar (+${overflowPinnedFeatures.length})`}
                        className={`${isHorizontalCallCenterBar ? "p-2" : "px-2 py-1.5"} rounded-xl border text-xs font-extrabold transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                          pinOverflowOpen
                            ? `${bg} text-white border-transparent`
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <MoreHorizontal size={14} />
                        {!isHorizontalCallCenterBar && (
                          <span className="text-[10px]">+{overflowPinnedFeatures.length}</span>
                        )}
                      </button>
                      {pinOverflowOpen && (
                        <div className={`absolute ${zoneName === "right" ? "right-0" : "left-0"} mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150`}>
                          <div className="px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Diğer Kısayollar
                          </div>
                          {overflowPinnedFeatures.map((ofeat) => {
                            const OFeatIcon = ofeat.icon;
                            const isOAct = activeTab === ofeat.id;
                            const oSlug = getTurkishSlugForTab(ofeat.id);
                            return (
                              <a
                                key={ofeat.id}
                                href={`/?tab=${encodeURIComponent(oSlug)}`}
                                onClick={(e) => {
                                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                                    e.preventDefault();
                                    setActiveTab(ofeat.id);
                                    setPinOverflowOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                                  isOAct
                                    ? `${lightBg} ${text}`
                                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800"
                                }`}
                              >
                                <OFeatIcon size={14} className={isOAct ? text : "text-slate-400 dark:text-slate-500"} />
                                <span className="truncate">{ofeat.label}</span>
                              </a>
                            );
                          })}
                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setPinOverflowOpen(false);
                              setActiveModalTab("topbar");
                              setSettingsModalOpen(true);
                            }}
                            className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <PanelTop size={13} className={text} />
                            <span>Üst Barı Özelleştir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            }

            if (token === "widget:search") {
              if (!canUseGlobalSearch || effectiveSearchMode === "hidden") return null;
              return (
                <GlobalSearchBar
                  key="widget:search"
                  backendHost={backendHost}
                  currentUser={currentUser}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  displayMode={effectiveSearchMode}
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
              );
            }

            if (token === "widget:notifications") {
              return (
                <NotificationCenterBell
                  key="widget:notifications"
                  align={zoneName === "left" ? "left" : "right"}
                  backendHost={backendHost}
                  currentUser={currentUser}
                  currentRolePermissions={currentRolePermissions}
                  onNavigateTab={(targetTab, targetSubTab) => {
                    if (isDesktopMode && targetTab !== "call-center" && !(targetTab === "omnichannel" && hasOmnichannelPermission)) {
                      setActiveTab("call-center");
                    } else {
                      setActiveTab(targetTab);
                    }
                    if (targetTab === "call-center" && targetSubTab) {
                      setTimeout(() => {
                        window.dispatchEvent(
                          new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", {
                            detail: { subTab: targetSubTab }
                          })
                        );
                      }, 60);
                    }
                  }}
                />
              );
            }

            if (token === "widget:theme") {
              return (
                <button
                  key="widget:theme"
                  type="button"
                  onClick={toggleTheme}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer shrink-0"
                  title={
                    callPanelPrefs?.autoThemeConfig?.mode === "schedule"
                      ? `Otomatik Karanlık Mod Aktif (${callPanelPrefs.autoThemeConfig.darkStart} - ${callPanelPrefs.autoThemeConfig.darkEnd})`
                      : callPanelPrefs?.autoThemeConfig?.mode === "system"
                      ? "Sistem Temasını Takip Ediyor"
                      : isDarkMode
                      ? "Aydınlık Mod"
                      : "Karanlık Mod"
                  }
                >
                  {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-primary" />}
                </button>
              );
            }

            if (token === "widget:profile") {
              return (
                <div key="widget:profile" ref={profileDropdownRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    aria-expanded={profileDropdownOpen}
                    aria-label="Kullanıcı Profili ve Menüsü"
                    className={`flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm focus:outline-none group cursor-pointer ${
                      hasAnyAvatarText ? "gap-2.5 px-2.5 py-1" : "p-1"
                    }`}
                    title="Kullanıcı Profili ve Menüsü"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={agentAvatar}
                        alt="Profil"
                        className="w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
                      />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-slate-900 rounded-full ${resolvedActiveProfileDotCls}`} />
                    </div>

                    {hasAnyAvatarText && (
                      <div className="flex flex-col text-left pr-0.5 max-w-[185px]">
                        {(topbarPrefs.showName || (topbarPrefs.showExtension && effectiveUserExtension)) && (
                          <div className="flex items-center gap-1.5 leading-tight min-w-0">
                            {topbarPrefs.showName && (
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {currentUser?.full_name || currentUser?.name || currentUser?.username || "Kullanıcı"}
                              </span>
                            )}
                            {topbarPrefs.showExtension && effectiveUserExtension && (
                              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold font-mono leading-none shrink-0 border ${lightBg} ${text} ${borderLight}`}>
                                #{effectiveUserExtension}
                              </span>
                            )}
                          </div>
                        )}

                        {(topbarPrefs.showRole || topbarPrefs.showProfile) && (
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate leading-tight flex items-center gap-1 mt-0.5">
                            {topbarPrefs.showRole && (
                              <span>{resolvedUserRoleLabel}</span>
                            )}
                            {topbarPrefs.showRole && topbarPrefs.showProfile && <span>•</span>}
                            {topbarPrefs.showProfile && (
                              <span className={resolvedActiveProfileTextCls}>
                                {resolvedActiveProfileName}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {hasAnyAvatarText && (
                      <ChevronDown size={14} className="block text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                    )}
                  </button>

                  {profileDropdownOpen && (
                    <div className={`absolute ${zoneName === "left" ? "left-0" : "right-0"} mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}>
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
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            setActiveModalTab("profile");
                            setSettingsModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer group"
                        >
                          <Settings size={15} className={`text-slate-500 dark:text-slate-300 group-hover:${text} transition-colors`} />
                          <span>Profil Ayarları</span>
                        </button>
                        {isNativeElectron() && (
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer group"
                          >
                            <Server size={15} className={`text-slate-500 dark:text-slate-300 group-hover:${text} transition-colors`} />
                            <span>Sunucu Adresini Değiştir</span>
                          </button>
                        )}
                        <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                        <button
                          type="button"
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
              );
            }

            return null;
          };

          return (
        <header className="aida-app-topbar relative z-40 h-16 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-5 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md transition-colors duration-300 gap-3">
          {/* Sol Bölge */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {(isDesktopMode || (activeTab === "call-center" && (isAgentOnlyUser || isAgentFullScreenMode))) && (
              <div className="flex items-center gap-2.5 pr-2">
                <div className={`h-8 w-8 shrink-0 rounded-xl ${bg} flex items-center justify-center text-white shadow-sm`}>
                  <Bot size={18} />
                </div>
                <div>
                  <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none flex items-center gap-1.5">
                    <span><span className="text-rose-600 dark:text-rose-500">AI</span>DA{isDesktopMode ? " Agent" : ""}</span>
                    {isDesktopMode && (
                      <span
                        title={`Bağlı Santral: ${desktopPrefs?.serverHost || backendHost}`}
                        className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="max-w-[140px] truncate">{desktopPrefs?.serverHost || backendHost}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {activeTab === "omnichannel" ? "OMNICHANNEL İLETİŞİM MERKEZİ" : "TEMSİLCİ ÇAĞRI PANELİ"}
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Mode Workspace Switcher: Call Panel <-> Omnichannel (Permission-gated) */}
            {isDesktopMode && hasOmnichannelPermission && (
              <div className="flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("call-center")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    activeTab === "call-center"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/50"
                  }`}
                >
                  <Phone size={13} />
                  <span>Çağrı Paneli</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("omnichannel")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    activeTab === "omnichannel"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/50"
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Omnichannel</span>
                </button>
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

            {!isDesktopMode && ((currentUser?.username === "admin" || currentUser?.id === "admin") || (typeof window !== "undefined" && (localStorage.getItem("current_user_id") === "admin" || sessionStorage.getItem("current_user_id") === "admin"))) && (
              <TenantSwitcher backendHost={backendHost} currentUser={currentUser} />
            )}

            {(topbarPrefs.layoutZones?.left || []).map((tok) => renderHeaderToken(tok, "left"))}
          </div>

          {/* Orta Bölge */}
          {isHorizontalCallCenterBar ? (
            <>
              <div id="agent-top-nav-slot" className="flex-1 flex items-center justify-between px-2 min-w-0 overflow-hidden" />
              <div className="flex items-center gap-2 shrink-0">
                {(topbarPrefs.layoutZones?.center || []).map((tok) => renderHeaderToken(tok, "center"))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              {(topbarPrefs.layoutZones?.center || []).map((tok) => renderHeaderToken(tok, "center"))}
            </div>
          )}

          {/* Sağ Bölge */}
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
            {!isDesktopMode && currentUser?.role === 'admin' && hasPendingChanges && (
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

            {(topbarPrefs.layoutZones?.right || []).map((tok) => renderHeaderToken(tok, "right"))}
          </div>
        </header>
          );
        })()}

        {/* Dynamic View Panel */}
        <div
          key={activeTenantId}
          ref={mainStageRef}
          tabIndex={-1}
          className={`flex-1 overflow-y-auto flex focus:outline-none aida-stage-active ${isEditingCallFlow ? "p-0 justify-center w-full h-full bg-white dark:bg-slate-950" : activeTab === "call-center" ? "p-3 justify-start items-start w-full h-full" : ["wallboard", "settings", "rag-kb", "rule-editor", "calendar", "system-status", "dialer", "call-flow", "work-hours", "ai-agents", "ai-config-assistant", "changelog", "reports-custom-builder", "reports-pano", "reports-cdr", "reports-audio", "reports-transcripts", "reports-sentiment", "reports-intent", "reports-qa", "reports-notes", "reports-perf", "reports-queue", "reports-survey", "reports-sentiment-heat", "reports-wordcloud", "reports-fcr", "reports-roi", "reports-missed", "reports-agent-status-timeline", "reports-traffic-load", "reports-trunk", "reports-did", "reports-trunk-minutes", "reports-invalid-calls", "reports-ivr-drop", "reports-transfer-hold", "reports-ab-testing", "reports-friction", "reports-compliance", "reports-silence", "reports-ceo-summary", "reports-breaks-attendance", "reports-omnichannel", "reports-disposition", "reports-dialer-callback", "reports-queue-sla", "reports-repeat-callers", "reports-dept-pickup", "reports-voip-quality", "reports-forwarding-gsm", "reports-supervisor-audit", "reports-blacklist-security", "reports-ai-appointments-rag", "reports-voicemail", "reports-conferences", "users", "trunks", "blacklist", "scheduled-reports", "announcements", "acd-queues", "auto-provision", "outbound-rules", "inbound-rules", "call-pickup-groups", "subscriber-groups", "conferences", "speed-dial", "event-logs", "troubleshooting", "sip-debugger"].includes(activeTab) ? "p-8 justify-start items-start w-full" : "p-8 justify-center"}`}
        >
          <div className={activeTab === "call-center" ? "w-full h-full flex aida-panel-enter" : "hidden"}>
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

          {(activeTab === "troubleshooting" || activeTab === "sip-debugger") && (
            <TroubleshootingPanel backendHost={backendHost} />
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
            <AnnouncementsPanel
              backendHost={backendHost}
              userPermissions={currentUser?.role === "admin" ? undefined : currentRolePermissions}
            />
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
            <KnowledgeBase
              backendHost={backendHost}
              userPermissions={currentUser?.role === "admin" ? ["*"] : currentRolePermissions}
            />
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
            <CallFlowEditor
              backendHost={backendHost}
              onEditStateChange={setIsEditingCallFlow}
              onOpenWorkHours={() => {
                setIsEditingCallFlow(false);
                setActiveTab("work-hours");
              }}
            />
          )}

          {activeTab === "work-hours" && hasWorkHoursPermission && (
            <WorkHoursSettingsPanel backendHost={backendHost} />
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
          <div
            className={`fixed inset-0 z-[150] flex items-center justify-center p-4 transition-all duration-300 ${
              isPeekingUiTemplate
                ? "bg-transparent backdrop-blur-none"
                : activeModalTab === "profile"
                ? "bg-slate-950/30"
                : "bg-slate-950/60 backdrop-blur-sm"
            }`}
          >
            <div
              className={`aida-settings-modal-dialog w-full max-w-6xl h-[88vh] h-[88dvh] max-h-[880px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-clip flex flex-col animate-in fade-in zoom-in-95 duration-200 transition-all ${
                isPeekingUiTemplate ? "opacity-0 scale-[0.985] pointer-events-none" : "opacity-100 scale-100"
              }`}
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${lightBg} ${text} rounded-xl`}>
                    <Settings size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">Temsilci Profil Ayarları</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Kişisel arayüz tercihlerinizi, çağrı zil sesini ve canlı izleme panelinizi özelleştirin.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelSettingsModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-1 min-h-0 overflow-clip">
                {/* Left Sidebar Tabs (UserSettings style) */}
                <div className="aida-settings-modal-sidebar w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto overscroll-contain transition-colors duration-300">
                  <nav className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("profile")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "profile" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Palette size={16} />
                      Avatar & Tema
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("landing")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "landing" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Pin size={16} />
                      Başlangıç Ekranı
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("profiles")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "profiles" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Users size={16} />
                      Profiller & Yönlendirme
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("hardware")}
                      className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "hardware" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Volume2 size={16} />
                      Donanım
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("shortcuts")}
                      className={"w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "shortcuts" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <span className="flex items-center gap-3">
                        <Keyboard size={16} />
                        Klavye Kısayolları
                      </span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[9px] font-mono font-bold text-slate-500">?</kbd>
                    </button>
                    {currentUser?.extension && (
                      <button
                        type="button"
                        onClick={() => setActiveModalTab("hotdesk")}
                        className={"w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "hotdesk" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                      >
                        <span className="flex items-center gap-3">
                          <Phone size={16} />
                          Ortak Masa Telefonu
                        </span>
                        {agentHotdeskConfig?.enabled && (
                          <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            AKTİF
                          </span>
                        )}
                      </button>
                    )}
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
                      onClick={() => setActiveModalTab("topbar")}
                      className={"w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeModalTab === "topbar" ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <span className="flex items-center gap-3">
                        <PanelTop size={16} />
                        Üst Bar Özelleştirme
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase ${lightBg} ${text}`}>
                        Yeni
                      </span>
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
                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-clip">
                  <div
                    ref={profileModalScrollPaneRef}
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] p-7 space-y-4"
                  >

                    {/* Klavye Kısayolları Sekmesi */}
                    {activeModalTab === "shortcuts" && (
                      <KeyboardShortcutsModal
                        embedded
                        isOpen={settingsModalOpen && activeModalTab === "shortcuts"}
                        onClose={handleCancelSettingsModal}
                        customShortcuts={callPanelPrefs?.keyboardShortcuts || {}}
                        onSaveShortcuts={(nextShortcuts) => {
                          setCallPanelPrefs((prev) => ({
                            ...(prev || {}),
                            keyboardShortcuts: nextShortcuts
                          }));
                        }}
                      />
                    )}

                    {/* Başlangıç Ekranı Sekmesi (Yetkiye Göre Tüm Ekran Seçenekleri) */}
                    {activeModalTab === "landing" && (() => {
                      const effectiveRoleCode = isAdminRole ? "admin" : String(currentUser?.role || "agent");
                      const allowedLandingList = getAllowedLandingScreensForRole(
                        effectiveRoleCode,
                        isAdminRole ? ["*"] : currentRolePermissions,
                        { desktopMode: isDesktopMode }
                      );
                      const allowedSubTabList = getAllowedAgentSubTabsForRole(
                        effectiveRoleCode,
                        isAdminRole ? ["*"] : currentRolePermissions
                      );
                      const selectedLanding = String(callPanelPrefs?.defaultLandingTab || "auto");
                      const selectedSubTab = String(callPanelPrefs?.defaultAgentSubTab || "auto");
                      const canAccessCallPanel = allowedLandingList.some((s) => s.id === "call-center");
                      const showSubTabPicker =
                        canAccessCallPanel &&
                        (selectedLanding === "call-center" ||
                          (selectedLanding === "auto" &&
                            (allowedLandingList.length === 1 || effectiveRoleCode === "agent")));

                      const qNorm = landingSearchQuery.trim().toLowerCase();
                      const filteredScreens = allowedLandingList.filter((item) => {
                        if (!qNorm) return true;
                        return (
                          item.label.toLowerCase().includes(qNorm) ||
                          (item.shortLabel || "").toLowerCase().includes(qNorm) ||
                          item.group.toLowerCase().includes(qNorm)
                        );
                      });
                      const landingGroups = Array.from(new Set(filteredScreens.map((s) => s.group)));

                      return (
                        <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
                          {/* Header + Quick Action */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                                <Pin size={16} />
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                                  Girişte Açılacak Başlangıç Ekranı
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Rol yetkinize göre erişebildiğiniz tüm ekranlar aşağıda listelenmiştir ({allowedLandingList.length} ekran).
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!isWallboardOnlyUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activeTab === "call-center") {
                                      updateLandingPrefsLive({
                                        defaultLandingTab: "call-center",
                                        defaultAgentSubTab: currentAgentSubTab || "auto"
                                      });
                                    } else {
                                      updateLandingPrefsLive({
                                        defaultLandingTab: activeTab
                                      });
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isCurrentViewPinnedAsLanding
                                      ? `${bg} text-white border-transparent shadow-sm`
                                      : `bg-white dark:bg-slate-900 ${borderLight} ${text} hover:opacity-90`
                                  }`}
                                >
                                  {isCurrentViewPinnedAsLanding ? <Check size={12} /> : <Pin size={12} />}
                                  <span>
                                    {isCurrentViewPinnedAsLanding
                                      ? "Açık Ekran Seçili"
                                      : "Açık Ekranı Seç"}
                                  </span>
                                </button>
                              )}

                              {(selectedLanding !== "auto" || selectedSubTab !== "auto") && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateLandingPrefsLive({
                                      defaultLandingTab: "auto",
                                      defaultAgentSubTab: "auto"
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <RotateCcw size={12} />
                                  <span>Varsayılana Sıfırla</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Active Preference Summary Banner */}
                          <div className={`px-3.5 py-2.5 rounded-2xl border ${borderLight} ${lightBg} flex flex-wrap items-center justify-between gap-2 text-[11px]`}>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              Seçili Başlangıç Tercihi:{" "}
                              <strong className={text}>
                                {selectedLanding === "call-center"
                                  ? `Temsilci Çağrı Paneli › ${getAgentSubTabLabel(selectedSubTab)}`
                                  : getLandingScreenLabel(selectedLanding)}
                              </strong>
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              Seçiminiz anında kaydedilir
                            </span>
                          </div>

                          {/* Smart Startup Modes */}
                          {allowedLandingList.length > 1 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                                Akıllı Başlangıç Modları
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {[
                                  {
                                    id: "auto",
                                    title: "Varsayılan (Role Göre Otomatik)",
                                    desc: "Kullanıcı rolünüze göre önerilen ana ekran ile başlar."
                                  },
                                  {
                                    id: "last_visited",
                                    title: "Son Kaldığım Ekrandan Devam Et",
                                    desc: "Oturumu kapattığınızda açık olan son ekranı yeniden açar."
                                  }
                                ].map((modeOpt) => {
                                  const isSel = selectedLanding === modeOpt.id;
                                  return (
                                    <button
                                      key={modeOpt.id}
                                      type="button"
                                      onClick={() =>
                                        updateLandingPrefsLive({
                                          defaultLandingTab: modeOpt.id,
                                          ...(modeOpt.id !== "auto" ? { defaultAgentSubTab: "auto" } : {})
                                        })
                                      }
                                      className={`p-3 rounded-2xl border text-left transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                        isSel
                                          ? `${lightBg} ${border} ring-1 ring-primary/30 shadow-sm`
                                          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className={`text-xs font-extrabold ${isSel ? text : "text-slate-800 dark:text-white"}`}>
                                          {modeOpt.title}
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                          {modeOpt.desc}
                                        </div>
                                      </div>
                                      {isSel && <Check size={14} className={`${text} shrink-0 mt-0.5`} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Call Panel Sub-tab Selector (when Temsilci Çağrı Paneli is selected) */}
                          {showSubTabPicker && (
                            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                              <div>
                                <label
                                  htmlFor="profile-default-agent-subtab"
                                  className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                                >
                                  Temsilci Çağrı Paneli Açılış Alt Sekmesi
                                </label>
                                <p className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Çağrı Paneli açıldığında hangi alt sekmenin aktif geleceğini seçin.
                                </p>
                              </div>
                              <select
                                id="profile-default-agent-subtab"
                                name="default_agent_subtab"
                                value={selectedSubTab}
                                onChange={(e) =>
                                  updateLandingPrefsLive({
                                    ...(allowedLandingList.length === 1 && allowedLandingList[0]?.id === "call-center"
                                      ? { defaultLandingTab: "call-center" }
                                      : {}),
                                    defaultAgentSubTab: e.target.value
                                  })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                              >
                                <option value="auto">Sıralamadaki İlk Sekme (Varsayılan)</option>
                                <option value="last_visited">Son Kaldığım Alt Sekmeden Devam Et</option>
                                {allowedSubTabList.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Search Input for All Permitted Screens */}
                          {allowedLandingList.length > 6 && (
                            <div className="relative">
                              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={landingSearchQuery}
                                onChange={(e) => setLandingSearchQuery(e.target.value)}
                                placeholder="Ekran, modül veya rapor ara..."
                                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary"
                              />
                              {landingSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setLandingSearchQuery("")}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          )}

                          {/* All Permitted Screens Grouped by Category */}
                          {landingGroups.length === 0 ? (
                            <div className="p-6 text-center text-xs font-semibold text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                              Aramanızla eşleşen yetkili ekran bulunamadı.
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              {landingGroups.map((grp) => {
                                const grpItems = filteredScreens.filter((item) => item.group === grp);
                                return (
                                  <div key={grp} className="space-y-1.5">
                                    <div className="flex items-center justify-between px-1">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        {grp}
                                      </span>
                                      <span className="text-[9.5px] font-bold text-slate-400">
                                        {grpItems.length} ekran
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {grpItems.map((item) => {
                                        const isSelected = selectedLanding === item.id;
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                              updateLandingPrefsLive({
                                                defaultLandingTab: item.id,
                                                ...(item.id !== "call-center" ? { defaultAgentSubTab: "auto" } : {})
                                              })
                                            }
                                            className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                              isSelected
                                                ? `${lightBg} ${border} ring-1 ring-primary/30 shadow-sm`
                                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                            }`}
                                          >
                                            <span
                                              className={`text-[11px] font-bold truncate ${
                                                isSelected ? text : "text-slate-800 dark:text-slate-100"
                                              }`}
                                            >
                                              {item.label}
                                            </span>
                                            {isSelected ? (
                                              <Check size={13} className={`${text} shrink-0`} />
                                            ) : (
                                              <Pin size={12} className="text-slate-300 dark:text-slate-700 shrink-0" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Üst Bar Özelleştirme Sekmesi (Kısayollar, Global Arama & Avatar Kapsülü) */}
                    {activeModalTab === "topbar" && (() => {
                      const togglePinFeature = (featId) => {
                        const exists = topbarPrefs.pinnedItems.includes(featId);
                        const nextList = exists
                          ? topbarPrefs.pinnedItems.filter((id) => id !== featId)
                          : [...topbarPrefs.pinnedItems, featId];
                        updateTopbarPrefsLive({ pinnedItems: nextList });
                      };

                      const movePinnedItem = (idx, dir) => {
                        const currentIds = pinnedTopbarFeatures.map((f) => f.id);
                        const targetIdx = idx + dir;
                        if (targetIdx < 0 || targetIdx >= currentIds.length) return;
                        const [moved] = currentIds.splice(idx, 1);
                        currentIds.splice(targetIdx, 0, moved);
                        updateTopbarPrefsLive({ pinnedItems: currentIds });
                      };

                      const handlePinDragStart = (idx) => setDraggedPinnedIdx(idx);
                      const handlePinDragOver = (e, idx) => {
                        e.preventDefault();
                        if (draggedPinnedIdx === null || draggedPinnedIdx === idx) return;
                        const currentIds = pinnedTopbarFeatures.map((f) => f.id);
                        const [moved] = currentIds.splice(draggedPinnedIdx, 1);
                        currentIds.splice(idx, 0, moved);
                        setDraggedPinnedIdx(idx);
                        updateTopbarPrefsLive({ pinnedItems: currentIds });
                      };
                      const handlePinDragEnd = () => setDraggedPinnedIdx(null);

                      const loadSuggestedPins = () => {
                        const candidateIds = ["dashboard", "call-center", "users", "acd-queues", "inbound-rules", "reports-pano"];
                        const allowedIds = candidateIds.filter((cid) =>
                          allowedTopbarFeatures.some((f) => f.id === cid)
                        );
                        updateTopbarPrefsLive({ pinnedItems: allowedIds.slice(0, 5) });
                      };

                      const resetTopbarDefaults = () => {
                        updateTopbarPrefsLive({
                          ...DEFAULT_TOPBAR_PREFS,
                          pinnedItems: [],
                          layoutZones: {
                            left: [...DEFAULT_TOPBAR_ZONES.left],
                            center: [...DEFAULT_TOPBAR_ZONES.center],
                            right: [...DEFAULT_TOPBAR_ZONES.right]
                          },
                          _syncPinsFromZones: true
                        });
                      };

                      const qFilter = pinCatalogSearch.trim().toLowerCase();
                      const filteredCatalog = allowedTopbarFeatures.filter((f) => {
                        if (!qFilter) return true;
                        return (
                          f.label.toLowerCase().includes(qFilter) ||
                          f.shortLabel.toLowerCase().includes(qFilter) ||
                          f.group.toLowerCase().includes(qFilter)
                        );
                      });

                      const catalogGroups = Array.from(new Set(filteredCatalog.map((f) => f.group)));
                      const previewVisiblePins = pinnedTopbarFeatures.slice(0, topbarPrefs.maxVisiblePins);
                      const previewVisiblePinIds = new Set(previewVisiblePins.map((p) => p.id));
                      const previewLastVisiblePinId =
                        previewVisiblePins.length > 0
                          ? previewVisiblePins[previewVisiblePins.length - 1].id
                          : null;
                      const previewOverflowCount = Math.max(0, pinnedTopbarFeatures.length - topbarPrefs.maxVisiblePins);

                      const isPreviewTokenVisible = (tok) => {
                        if (!tok) return false;
                        if (tok.startsWith("pin:")) {
                          return !isDesktopMode && previewVisiblePinIds.has(tok.slice(4));
                        }
                        if (tok === "widget:search") {
                          return canUseGlobalSearch && topbarPrefs.searchMode !== "hidden";
                        }
                        return (
                          tok === "widget:notifications" ||
                          tok === "widget:theme" ||
                          tok === "widget:profile"
                        );
                      };

                      const getPreviewTokenLabel = (tok) => {
                        if (!tok) return "";
                        if (tok.startsWith("pin:")) {
                          const f = pinnedTopbarFeatures.find((x) => x.id === tok.slice(4));
                          return f ? `Kısayol: ${f.label}` : "Sabit Kısayol";
                        }
                        if (tok === "widget:search") return "Global Arama Alanı";
                        if (tok === "widget:notifications") return "Bildirim Merkezi";
                        if (tok === "widget:theme") return "Aydınlık / Karanlık Tema";
                        if (tok === "widget:profile") return "Kullanıcı Avatar & Profil Kapsülü";
                        return tok;
                      };

                      const commitTopbarTokenDrop = (targetZone, rawTargetIndex, explicitToken = null) => {
                        const activeToken = explicitToken || draggedTopbarToken;
                        setDraggedTopbarToken(null);
                        setTopbarDropIndicator(null);
                        if (!activeToken || !["left", "center", "right"].includes(targetZone)) return;

                        const nextZones = {
                          left: [...(topbarPrefs.layoutZones?.left || [])],
                          center: [...(topbarPrefs.layoutZones?.center || [])],
                          right: [...(topbarPrefs.layoutZones?.right || [])]
                        };

                        let adjustedIndex = rawTargetIndex;
                        const prevIdxInTarget = nextZones[targetZone].indexOf(activeToken);
                        if (prevIdxInTarget !== -1 && prevIdxInTarget < adjustedIndex) {
                          adjustedIndex -= 1;
                        }

                        ["left", "center", "right"].forEach((zKey) => {
                          nextZones[zKey] = nextZones[zKey].filter((t) => t !== activeToken);
                        });

                        const safeIdx = Math.max(0, Math.min(nextZones[targetZone].length, adjustedIndex));
                        nextZones[targetZone].splice(safeIdx, 0, activeToken);

                        const nextOrderedPins = [
                          ...nextZones.left,
                          ...nextZones.center,
                          ...nextZones.right
                        ]
                          .filter((t) => t.startsWith("pin:"))
                          .map((t) => t.slice(4));

                        updateTopbarPrefsLive({
                          layoutZones: nextZones,
                          pinnedItems: nextOrderedPins,
                          _syncPinsFromZones: true
                        });
                      };

                      const moveTopbarTokenByStep = (token, delta) => {
                        const zoneOrder = ["left", "center", "right"];
                        const curZones = {
                          left: [...(topbarPrefs.layoutZones?.left || [])],
                          center: [...(topbarPrefs.layoutZones?.center || [])],
                          right: [...(topbarPrefs.layoutZones?.right || [])]
                        };
                        let foundZoneIdx = -1;
                        let foundPos = -1;
                        zoneOrder.forEach((zKey, zIdx) => {
                          const p = curZones[zKey].indexOf(token);
                          if (p !== -1) {
                            foundZoneIdx = zIdx;
                            foundPos = p;
                          }
                        });
                        if (foundZoneIdx === -1) return;

                        const curZoneKey = zoneOrder[foundZoneIdx];
                        const list = curZones[curZoneKey];

                        if (delta < 0) {
                          // Find previous visible item in current zone
                          let prevVisIdx = -1;
                          for (let i = foundPos - 1; i >= 0; i -= 1) {
                            if (isPreviewTokenVisible(list[i])) {
                              prevVisIdx = i;
                              break;
                            }
                          }
                          if (prevVisIdx !== -1) {
                            commitTopbarTokenDrop(curZoneKey, prevVisIdx, token);
                          } else if (foundZoneIdx > 0) {
                            const prevZoneKey = zoneOrder[foundZoneIdx - 1];
                            commitTopbarTokenDrop(prevZoneKey, curZones[prevZoneKey].length, token);
                          }
                        } else {
                          // Find next visible item in current zone
                          let nextVisIdx = -1;
                          for (let i = foundPos + 1; i < list.length; i += 1) {
                            if (isPreviewTokenVisible(list[i])) {
                              nextVisIdx = i;
                              break;
                            }
                          }
                          if (nextVisIdx !== -1) {
                            commitTopbarTokenDrop(curZoneKey, nextVisIdx + 1, token);
                          } else if (foundZoneIdx < zoneOrder.length - 1) {
                            const nextZoneKey = zoneOrder[foundZoneIdx + 1];
                            commitTopbarTokenDrop(nextZoneKey, 0, token);
                          }
                        }
                      };

                      const renderPreviewTokenContent = (tok) => {
                        if (tok.startsWith("pin:")) {
                          const fid = tok.slice(4);
                          const pf = previewVisiblePins.find((x) => x.id === fid);
                          if (!pf) return null;
                          const PfIcon = pf.icon;
                          const isLastVis = fid === previewLastVisiblePinId;
                          return (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs ${
                                  topbarPrefs.pinStyle === "icon" ? "p-1.5" : "px-2 py-1"
                                }`}
                              >
                                <PfIcon size={11} className={text} />
                                {topbarPrefs.pinStyle !== "icon" && (
                                  <span className="max-w-[70px] truncate">{pf.shortLabel}</span>
                                )}
                              </span>
                              {isLastVis && previewOverflowCount > 0 && (
                                <span className="px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[9px] font-extrabold text-slate-500">
                                  +{previewOverflowCount}
                                </span>
                              )}
                            </span>
                          );
                        }

                        if (tok === "widget:search") {
                          if (topbarPrefs.searchMode === "icon") {
                            return (
                              <span className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 inline-flex items-center justify-center">
                                <Search size={11} className={text} />
                              </span>
                            );
                          }
                          return (
                            <div
                              className={`h-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/70 px-2.5 flex items-center gap-1.5 ${
                                topbarPrefs.searchMode === "wide" ? "w-48 sm:w-56" : "w-36"
                              }`}
                            >
                              <Search size={11} className="text-slate-400 shrink-0" />
                              <span className="text-[9px] font-semibold text-slate-400 truncate">
                                {topbarPrefs.searchMode === "wide"
                                  ? "Menü, ayar, kullanıcı ara... (⌘K)"
                                  : "Hızlı ara..."}
                              </span>
                            </div>
                          );
                        }

                        if (tok === "widget:notifications") {
                          return (
                            <span className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 inline-flex items-center justify-center">
                              <Bell size={11} className="text-slate-500 dark:text-slate-400" />
                            </span>
                          );
                        }

                        if (tok === "widget:theme") {
                          return (
                            <span className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 inline-flex items-center justify-center">
                              {isDarkMode ? (
                                <Sun size={11} className="text-amber-400" />
                              ) : (
                                <Moon size={11} className={text} />
                              )}
                            </span>
                          );
                        }

                        if (tok === "widget:profile") {
                          return (
                            <div
                              className={`flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 ${
                                hasAnyAvatarText ? "gap-1.5 px-2 py-0.5" : "p-0.5"
                              }`}
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={agentAvatar}
                                  alt="Önizleme"
                                  draggable={false}
                                  className="w-5 h-5 rounded-full object-cover pointer-events-none select-none"
                                />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-white dark:border-slate-900 rounded-full ${resolvedActiveProfileDotCls}`}
                                />
                              </div>
                              {hasAnyAvatarText && (
                                <div className="flex flex-col leading-none">
                                  {(topbarPrefs.showName || (topbarPrefs.showExtension && effectiveUserExtension)) && (
                                    <div className="flex items-center gap-1">
                                      {topbarPrefs.showName && (
                                        <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 max-w-[75px] truncate">
                                          {currentUser?.full_name || currentUser?.name || currentUser?.username || "Kullanıcı"}
                                        </span>
                                      )}
                                      {topbarPrefs.showExtension && effectiveUserExtension && (
                                        <span className={`px-1 py-0.2 rounded text-[8px] font-mono font-extrabold ${lightBg} ${text}`}>
                                          #{effectiveUserExtension}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {(topbarPrefs.showRole || topbarPrefs.showProfile) && (
                                    <span className="text-[8px] text-slate-400 mt-0.5 flex items-center gap-1">
                                      {topbarPrefs.showRole && <span>{resolvedUserRoleLabel}</span>}
                                      {topbarPrefs.showRole && topbarPrefs.showProfile && <span>•</span>}
                                      {topbarPrefs.showProfile && (
                                        <span className={resolvedActiveProfileTextCls}>
                                          {resolvedActiveProfileName}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return null;
                      };

                      const renderPreviewDropZone = (zoneId, zoneTitle, alignCls) => {
                        const rawTokens = topbarPrefs.layoutZones?.[zoneId] || [];
                        const visibleEntries = rawTokens
                          .map((tok, rawIdx) => ({ tok, rawIdx }))
                          .filter((entry) => isPreviewTokenVisible(entry.tok));
                        const isZoneHighlighted =
                          Boolean(draggedTopbarToken) && topbarDropIndicator?.zone === zoneId;

                        return (
                          <div
                            key={zoneId}
                            onDragOver={(e) => {
                              if (!draggedTopbarToken) return;
                              e.preventDefault();
                              setTopbarDropIndicator({ zone: zoneId, index: rawTokens.length });
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const dropTok =
                                draggedTopbarToken || e.dataTransfer?.getData("text/plain") || null;
                              const dropIdx =
                                topbarDropIndicator?.zone === zoneId
                                  ? topbarDropIndicator.index
                                  : rawTokens.length;
                              commitTopbarTokenDrop(zoneId, dropIdx, dropTok);
                            }}
                            className={`flex items-center gap-1.5 min-h-[38px] rounded-xl transition-all duration-150 ${alignCls} ${
                              zoneId === "center" ? "flex-1 min-w-[72px]" : "shrink-0 min-w-[64px]"
                            } ${
                              draggedTopbarToken
                                ? isZoneHighlighted
                                  ? `border border-dashed ${border} ${lightBg} px-2 py-1`
                                  : "border border-dashed border-slate-300/70 dark:border-slate-700/80 px-2 py-1"
                                : "px-0.5 py-0.5"
                            }`}
                          >
                            {visibleEntries.length === 0 ? (
                              draggedTopbarToken ? (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 select-none ${isZoneHighlighted ? text : "text-slate-400 dark:text-slate-500"}`}>
                                  {zoneTitle}
                                </span>
                              ) : zoneId === "left" && pinnedTopbarFeatures.length === 0 ? (
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 italic px-1 select-none">
                                  Sabit kısayol seçilmedi
                                </span>
                              ) : null
                            ) : (
                              visibleEntries.map(({ tok, rawIdx }) => {
                                const isBeingDragged = draggedTopbarToken === tok;
                                const showLineBefore =
                                  draggedTopbarToken &&
                                  draggedTopbarToken !== tok &&
                                  topbarDropIndicator?.zone === zoneId &&
                                  topbarDropIndicator?.index === rawIdx;
                                const showLineAfter =
                                  draggedTopbarToken &&
                                  draggedTopbarToken !== tok &&
                                  topbarDropIndicator?.zone === zoneId &&
                                  topbarDropIndicator?.index === rawIdx + 1;
                                const tokLabel = getPreviewTokenLabel(tok);

                                return (
                                  <div
                                    key={tok}
                                    draggable
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${tokLabel} — Sürükleyerek veya sol/sağ yön tuşlarıyla yerini değiştirin`}
                                    title={`${tokLabel} (Taşımak için sürükleyin)`}
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      try {
                                        e.dataTransfer.effectAllowed = "move";
                                        e.dataTransfer.setData("text/plain", tok);
                                      } catch (err) {}
                                      setDraggedTopbarToken(tok);
                                    }}
                                    onDragOver={(e) => {
                                      if (!draggedTopbarToken) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const after = e.clientX > rect.left + rect.width / 2;
                                      setTopbarDropIndicator({
                                        zone: zoneId,
                                        index: after ? rawIdx + 1 : rawIdx
                                      });
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const dropTok =
                                        draggedTopbarToken || e.dataTransfer?.getData("text/plain") || null;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const after = e.clientX > rect.left + rect.width / 2;
                                      commitTopbarTokenDrop(zoneId, after ? rawIdx + 1 : rawIdx, dropTok);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedTopbarToken(null);
                                      setTopbarDropIndicator(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                                        e.preventDefault();
                                        moveTopbarTokenByStep(tok, e.key === "ArrowLeft" ? -1 : 1);
                                      }
                                    }}
                                    className={`relative inline-flex items-center rounded-xl cursor-grab active:cursor-grabbing select-none [-webkit-user-select:none] touch-none transition-all duration-150 focus:outline-none focus:ring-2 ${ring} hover:-translate-y-0.5 hover:ring-2 ${
                                      isBeingDragged ? "opacity-40 scale-95" : ""
                                    }`}
                                  >
                                    {showLineBefore && (
                                      <span className={`absolute -left-1 top-1 bottom-1 w-0.5 rounded-full ${bg} pointer-events-none`} />
                                    )}
                                    {renderPreviewTokenContent(tok)}
                                    {showLineAfter && (
                                      <span className={`absolute -right-1 top-1 bottom-1 w-0.5 rounded-full ${bg} pointer-events-none`} />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                          {/* Canlı Üst Bar Önizlemesi + Sürükle & Bırak Alanı */}
                          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                    Canlı Üst Bar Önizlemesi
                                  </h5>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${lightBg} ${text} ${borderLight}`}>
                                    <GripVertical size={10} />
                                    <span>Sürükle & Bırak</span>
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  Önizleme üzerindeki kısayolları, arama kutusunu, tema, bildirim ve profil alanını sürükleyip sol, orta veya sağ bölgeye bırakarak yerlerini değiştirebilirsiniz.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={resetTopbarDefaults}
                                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <RotateCcw size={12} />
                                <span>Varsayılanlara Dön</span>
                              </button>
                            </div>

                            {/* İnteraktif Sürükle-Bırak Mini Header Simülasyonu */}
                            <div className="w-full min-h-[58px] py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2 shadow-sm overflow-x-auto">
                              {renderPreviewDropZone("left", "Sol Alan", "justify-start")}
                              {renderPreviewDropZone("center", "Orta Alan", "justify-center")}
                              {renderPreviewDropZone("right", "Sağ Alan", "justify-end")}
                            </div>

                            {/* Akıllı Yatay Mod Uyumu (Yaklaşım B) Bilgi Notu */}
                            <div className={`px-3 py-2 rounded-xl border ${borderLight} ${lightBg} flex items-start gap-2`}>
                              <Sparkles size={13} className={`${text} shrink-0 mt-0.5`} />
                              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                                <strong className={text}>Akıllı Yatay Görünüm Uyumu:</strong> Çağrı Paneli&apos;nde{" "}
                                <strong>Üst Bar (Yatay Tam Genişlik)</strong> düzeni açıkken üst bar iki satıra bölünmez; Global Arama otomatik olarak{" "}
                                <strong>İkon (🔍)</strong> moduna, kısayollar ise kompakt ikon/taşma menüsüne (<strong>⋯</strong>) küçülür. Diğer ekranlara geçtiğinizde seçtiğiniz tam genişliğe geri döner.
                              </p>
                            </div>
                          </div>

                          {/* 1. Global Arama (Global Search) Görünümü */}
                          {canUseGlobalSearch && (
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3.5">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                    Global Arama (Search) Görünümü
                                  </h5>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    Üst bardaki menü, ayar, kişi ve hızlı işlem arama alanının boyutunu belirleyin.
                                  </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${lightBg} ${text} border ${borderLight}`}>
                                  {topbarPrefs.searchMode === "icon"
                                    ? "Sadece İkon"
                                    : topbarPrefs.searchMode === "wide"
                                    ? "Daha Geniş"
                                    : topbarPrefs.searchMode === "hidden"
                                    ? "Kapalı"
                                    : "Geniş (Standart)"}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {[
                                  {
                                    id: "icon",
                                    title: "Sadece İkon",
                                    desc: "Kompakt büyüteç (🔍) butonu; tıklayınca veya Ctrl+K ile açılır.",
                                    icon: Search
                                  },
                                  {
                                    id: "normal",
                                    title: "Geniş (Standart)",
                                    desc: "Kısayollarla dengeli duran standart arama kutusu.",
                                    icon: Search
                                  },
                                  {
                                    id: "wide",
                                    title: "Daha Geniş",
                                    desc: "Komut merkezi genişliğinde ferah arama alanı.",
                                    icon: Sliders
                                  },
                                  {
                                    id: "hidden",
                                    title: "Kapalı",
                                    desc: "Global arama alanını üst bardan tamamen gizler.",
                                    icon: EyeOff
                                  }
                                ].map((opt) => {
                                  const OptIcon = opt.icon;
                                  const isSel = topbarPrefs.searchMode === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => updateTopbarPrefsLive({ searchMode: opt.id })}
                                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                        isSel
                                          ? `${lightBg} ${border} ring-2 ${ring}`
                                          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div
                                          className={`p-2 rounded-xl ${
                                            isSel
                                              ? `${bg} text-white shadow-sm`
                                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                          }`}
                                        >
                                          <OptIcon size={14} />
                                        </div>
                                        {isSel && <CheckCircle size={14} className={text} />}
                                      </div>
                                      <div>
                                        <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                                          {opt.title}
                                        </div>
                                        <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                                          {opt.desc}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 2. Avatar & Profil Kapsülü Özelleştirme */}
                          <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                  Avatar & Profil Alanı Özelleştirme
                                </h5>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  Sağ üstteki kullanıcı kapsülünde sadece avatarı gösterebilir veya dahili, profil ve rol bilgilerini açıp kapatabilirsiniz.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Anlık Kapsül Önizlemesi */}
                                <div
                                  title="Canlı Kapsül Önizlemesi"
                                  className={`flex items-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all ${
                                    hasAnyAvatarText ? "gap-2 px-2.5 py-1" : "p-1"
                                  }`}
                                >
                                  <div className="relative shrink-0">
                                    <img
                                      src={agentAvatar}
                                      alt="Önizleme"
                                      className="w-6 h-6 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
                                    />
                                    <span
                                      className={`absolute bottom-0 right-0 w-2 h-2 border border-white dark:border-slate-900 rounded-full ${resolvedActiveProfileDotCls}`}
                                    />
                                  </div>
                                  {hasAnyAvatarText && (
                                    <div className="flex flex-col text-left leading-tight max-w-[165px]">
                                      {(topbarPrefs.showName || (topbarPrefs.showExtension && effectiveUserExtension)) && (
                                        <div className="flex items-center gap-1 min-w-0">
                                          {topbarPrefs.showName && (
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                                              {currentUser?.full_name || currentUser?.name || currentUser?.username || "Kullanıcı"}
                                            </span>
                                          )}
                                          {topbarPrefs.showExtension && effectiveUserExtension && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold font-mono leading-none shrink-0 border ${lightBg} ${text} ${borderLight}`}>
                                              #{effectiveUserExtension}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {(topbarPrefs.showRole || topbarPrefs.showProfile) && (
                                        <span className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                          {topbarPrefs.showRole && <span>{resolvedUserRoleLabel}</span>}
                                          {topbarPrefs.showRole && topbarPrefs.showProfile && <span>•</span>}
                                          {topbarPrefs.showProfile && (
                                            <span className={resolvedActiveProfileTextCls}>
                                              {resolvedActiveProfileName}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${lightBg} ${text} border ${borderLight}`}>
                                  {effectiveAvatarOnly ? "Sadece Avatar" : "Detaylı Kapsül"}
                                </span>
                              </div>
                            </div>

                            {/* Sadece Avatar Göster Ana Anahtarı */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={effectiveAvatarOnly}
                              onClick={() => {
                                updateTopbarPrefsLive((prevTop) => {
                                  const wasMinimal =
                                    Boolean(prevTop.avatarOnly) ||
                                    !(
                                      prevTop.showName ||
                                      (prevTop.showExtension && Boolean(effectiveUserExtension)) ||
                                      prevTop.showProfile ||
                                      prevTop.showRole
                                    );
                                  if (wasMinimal) {
                                    const anyFieldOn =
                                      prevTop.showName ||
                                      (prevTop.showExtension && Boolean(effectiveUserExtension)) ||
                                      prevTop.showProfile ||
                                      prevTop.showRole;
                                    return anyFieldOn
                                      ? { avatarOnly: false }
                                      : { avatarOnly: false, showName: true, showProfile: true };
                                  }
                                  return { avatarOnly: true };
                                });
                              }}
                              className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                effectiveAvatarOnly
                                  ? `${lightBg} ${border}`
                                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`p-2 rounded-xl shrink-0 ${effectiveAvatarOnly ? `${bg} text-white` : `${lightBg} ${text}`}`}>
                                  <User size={15} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                                    Sadece Avatar Göster (Minimal Görünüm)
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    İsim, rol, dahili ve profil yazısını gizleyip yalnızca durum ışıklı yuvarlak avatarı gösterir.
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 flex items-center shrink-0 ${
                                  effectiveAvatarOnly ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                                }`}
                              >
                                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                              </div>
                            </button>

                            {/* Alt Görünürlük Seçenekleri */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {[
                                {
                                  key: "showName",
                                  title: "Ad Soyad Göster",
                                  desc: "Kullanıcı ad-soyad bilgisini kapsülde gösterir"
                                },
                                {
                                  key: "showExtension",
                                  title: `Dahili Numarası Göster${effectiveUserExtension ? ` (#${effectiveUserExtension})` : ""}`,
                                  desc: effectiveUserExtension
                                    ? `Abone dahili numarasını (#${effectiveUserExtension}) rozet olarak gösterir`
                                    : "Bu hesapta tanımlı dahili numarası bulunmuyor",
                                  disabled: !effectiveUserExtension
                                },
                                {
                                  key: "showProfile",
                                  title: "Aktif Profil Göster / Gizle",
                                  desc: `Aktif durum metnini (${resolvedActiveProfileName}) gösterir`
                                },
                                {
                                  key: "showRole",
                                  title: "Kullanıcı Rolü Göster / Gizle",
                                  desc: `Kullanıcı rol ünvanını (${resolvedUserRoleLabel}) gösterir`
                                }
                              ].map((field) => {
                                const isChecked =
                                  !effectiveAvatarOnly &&
                                  Boolean(topbarPrefs[field.key]) &&
                                  !field.disabled;
                                return (
                                  <button
                                    key={field.key}
                                    type="button"
                                    role="switch"
                                    aria-checked={isChecked}
                                    disabled={Boolean(field.disabled)}
                                    onClick={() => {
                                      if (field.disabled) return;
                                      updateTopbarPrefsLive((prevTop) => {
                                        const wasMinimal =
                                          Boolean(prevTop.avatarOnly) ||
                                          !(
                                            prevTop.showName ||
                                            (prevTop.showExtension && Boolean(effectiveUserExtension)) ||
                                            prevTop.showProfile ||
                                            prevTop.showRole
                                          );
                                        if (wasMinimal) {
                                          return {
                                            avatarOnly: false,
                                            showName: field.key === "showName",
                                            showExtension: field.key === "showExtension",
                                            showProfile: field.key === "showProfile",
                                            showRole: field.key === "showRole"
                                          };
                                        }
                                        const nextVal = !Boolean(prevTop[field.key]);
                                        const nextCandidate = {
                                          ...prevTop,
                                          avatarOnly: false,
                                          [field.key]: nextVal
                                        };
                                        const stillHasAny =
                                          nextCandidate.showName ||
                                          (nextCandidate.showExtension && Boolean(effectiveUserExtension)) ||
                                          nextCandidate.showProfile ||
                                          nextCandidate.showRole;
                                        if (!stillHasAny) {
                                          return {
                                            ...nextCandidate,
                                            avatarOnly: true
                                          };
                                        }
                                        return nextCandidate;
                                      });
                                    }}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 ${
                                      field.disabled
                                        ? "bg-slate-100/60 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60 opacity-50 cursor-not-allowed"
                                        : isChecked
                                        ? `${lightBg} ${border} cursor-pointer`
                                        : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 opacity-75 hover:opacity-100 cursor-pointer"
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">
                                        {field.title}
                                      </div>
                                      <div className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                        {field.desc}
                                      </div>
                                    </div>
                                    <div
                                      className={`w-8 h-4 rounded-full p-0.5 transition-all flex items-center shrink-0 ${
                                        isChecked ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                                      }`}
                                    >
                                      <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3. Sık Kullanılan Özellik Kısayolları (Pinleme & Sıralama) */}
                          <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                  Sık Kullanılan Özellik Kısayolları
                                </h5>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  En sık kullandığınız ekranları üst bara sabitleyin, sürükleyerek sıralayın ve taşma limitini belirleyin.
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={loadSuggestedPins}
                                  className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-extrabold transition-colors cursor-pointer ${lightBg} ${text} ${borderLight}`}
                                >
                                  Önerilenleri Ekle
                                </button>
                                {pinnedTopbarFeatures.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => updateTopbarPrefsLive({ pinnedItems: [] })}
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    Tümünü Kaldır
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Kısayol Görünüm Stili & Maksimum Görünür Sayı */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  Kısayol Buton Stili
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {[
                                    { id: "icon_label", label: "İkon + Başlık" },
                                    { id: "icon", label: "Sadece İkon" }
                                  ].map((st) => {
                                    const active = topbarPrefs.pinStyle === st.id;
                                    return (
                                      <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => updateTopbarPrefsLive({ pinStyle: st.id })}
                                        className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                                          active
                                            ? `${bg} text-white border-transparent shadow-sm`
                                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                                        }`}
                                      >
                                        {st.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  Üst Barda Görünür Adet (Fazlası ⋯ Menüsünde)
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {[3, 4, 5, 6, 8].map((cnt) => {
                                    const active = topbarPrefs.maxVisiblePins === cnt;
                                    return (
                                      <button
                                        key={cnt}
                                        type="button"
                                        onClick={() => updateTopbarPrefsLive({ maxVisiblePins: cnt })}
                                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                                          active
                                            ? `${bg} text-white border-transparent shadow-sm`
                                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                                        }`}
                                      >
                                        {cnt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Sabitlenen Kısayolların Sıralaması */}
                            {pinnedTopbarFeatures.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Sabitlenen Kısayol Sıralaması ({pinnedTopbarFeatures.length})
                                  </span>
                                  <span className="text-[9.5px] font-semibold text-slate-400">
                                    Sürükleyerek veya oklarla sıralayın
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {pinnedTopbarFeatures.map((pf, idx) => {
                                    const PfIcon = pf.icon;
                                    const isOverflowing = idx >= topbarPrefs.maxVisiblePins;
                                    return (
                                      <div
                                        key={pf.id}
                                        draggable
                                        onDragStart={() => handlePinDragStart(idx)}
                                        onDragOver={(e) => handlePinDragOver(e, idx)}
                                        onDragEnd={handlePinDragEnd}
                                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 transition-all cursor-grab active:cursor-grabbing ${
                                          draggedPinnedIdx === idx
                                            ? `${border} ${lightBg} opacity-75`
                                            : "border-slate-200/80 dark:border-slate-800"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <GripVertical size={13} className="text-slate-400 shrink-0" />
                                          <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                                            {idx + 1}
                                          </span>
                                          <PfIcon size={14} className={`${text} shrink-0`} />
                                          <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                            {pf.label}
                                          </span>
                                          {isOverflowing && (
                                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                              ⋯ Taşma Menüsünde
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => movePinnedItem(idx, -1)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                                            title="Yukarı Taşı"
                                          >
                                            <ArrowUp size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={idx === pinnedTopbarFeatures.length - 1}
                                            onClick={() => movePinnedItem(idx, 1)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                                            title="Aşağı Taşı"
                                          >
                                            <ArrowDown size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => togglePinFeature(pf.id)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                            title="Üst Bardan Kaldır"
                                          >
                                            <X size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Kısayol Ekleme Kataloğu */}
                            <div className="space-y-3 pt-1">
                              <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  value={pinCatalogSearch}
                                  onChange={(e) => setPinCatalogSearch(e.target.value)}
                                  placeholder="Üst bara eklenecek ekran veya modül ara..."
                                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                                />
                              </div>

                              <div className="space-y-3">
                                {catalogGroups.map((grp) => {
                                  const grpItems = filteredCatalog.filter((f) => f.group === grp);
                                  return (
                                    <div key={grp} className="space-y-1.5">
                                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                                        {grp}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {grpItems.map((feat) => {
                                          const FeatIcon = feat.icon;
                                          const isPinned = topbarPrefs.pinnedItems.includes(feat.id);
                                          return (
                                            <button
                                              key={feat.id}
                                              type="button"
                                              onClick={() => togglePinFeature(feat.id)}
                                              className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                                isPinned
                                                  ? `${lightBg} ${border} shadow-sm`
                                                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                  className={`p-1.5 rounded-lg shrink-0 ${
                                                    isPinned
                                                      ? `${bg} text-white`
                                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                  }`}
                                                >
                                                  <FeatIcon size={13} />
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-800 dark:text-white truncate">
                                                  {feat.label}
                                                </span>
                                              </div>
                                              {isPinned ? (
                                                <Pin size={13} className={`${text} shrink-0`} />
                                              ) : (
                                                <Plus size={13} className="text-slate-400 shrink-0" />
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Canlı İzleme Paneli (Wallboard) Özelleştirme Sekmesi */}
                    {activeModalTab === "wallboard" && (
                      <WallboardStudioSettings
                        backendHost={backendHost}
                        currentUserId={currentUser?.id || currentUser?.extension || "admin"}
                        currentUser={currentUser}
                        deferPersist
                        draftLayout={modalDraftWallboardLayout}
                        onDraftLayoutChange={setModalDraftWallboardLayout}
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
                    setCallPanelPrefs((prev) => ({
                      ...(prev || {}),
                      ...patch
                    }));
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
                        deferPersist
                        draftLayout={modalDraftWallboardLayout}
                        onDraftLayoutChange={setModalDraftWallboardLayout}
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

                {/* Personal Profiles & Forwarding Tab (Müsait, Dışarıda, Toplantı, Diğer) */}
                {activeModalTab === "profiles" && (() => {
                  const curProf = agentProfiles.find(p => p.id === selectedAgentProfileTab) || agentProfiles[0] || DEFAULT_USER_PROFILES[0];
                  const updateCurProf = (patch) => {
                    setAgentProfiles(prev => prev.map(p => p.id === curProf.id ? { ...p, ...patch } : p));
                  };
                  const updateCurProfForwarding = (ruleKey, patch) => {
                    const curRule = curProf[ruleKey] || { active: false, type: "internal", target: "" };
                    updateCurProf({
                      [ruleKey]: { ...curRule, ...patch }
                    });
                  };
                  const toggleProfDevice = (devId) => {
                    const curDevs = Array.isArray(curProf.devices) ? curProf.devices : [];
                    const nextDevs = curDevs.includes(devId)
                      ? curDevs.filter(d => d !== devId)
                      : [...curDevs, devId];
                    updateCurProf({ devices: nextDevs });
                  };

                  const pAlways = curProf.forwarding_always || { active: false, type: "internal", target: "" };
                  const pBusy = curProf.forwarding_busy || { active: false, type: "internal", target: "" };
                  const pNoAns = curProf.forwarding_no_answer || { active: false, type: "internal", target: "" };
                  const pTimeout = curProf.timeout ?? 30;

                  return (
                    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider block">
                            Profiller & Çağrı Yönlendirme
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Her profil için çalacak cihazları, çalma süresini ve yönlendirme kurallarını ayrı ayrı yapılandırın.
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

                      {/* 4 Profile Selector Cards */}
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

                        {/* 1. Ring Devices */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                            1. Çalacak Cihazlar (Device)
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

                        {/* 2. Ring Timeout & 3. Digit Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-2">
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                                2. Çalma Süresi (sn)
                              </label>
                              <span className="text-[10px] text-slate-400">Zaman aşımı süresi</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min="5"
                                max="120"
                                value={pTimeout}
                                onChange={(e) => updateCurProf({ timeout: Math.max(5, Math.min(120, parseInt(e.target.value, 10) || 30)) })}
                                className="w-14 text-xs font-bold px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none text-center"
                              />
                              {[15, 30, 45].map((sec) => (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => updateCurProf({ timeout: sec })}
                                  className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                                    Number(pTimeout) === sec
                                      ? `${bg} text-white border-transparent`
                                      : "bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800"
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-2">
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                                3. Tuşlama Kodu (Digit)
                              </label>
                              <span className="text-[10px] text-slate-400">Hızlı profil geçiş kodu</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={2}
                                value={curProf.digit ?? ""}
                                onChange={(e) =>
                                  updateCurProf({ digit: e.target.value.replace(/\D/g, "").slice(0, 2) })
                                }
                                placeholder="1"
                                className="w-14 text-xs font-mono font-extrabold text-center px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              />
                              <span className={`px-2 py-1.5 rounded-xl text-[10px] font-mono font-extrabold ${lightBg} ${text} border ${borderLight} whitespace-nowrap`}>
                                *70*{curProf.digit || "1"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 4. Per-Profile Call Forwarding Rules */}
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                4. Çağrı Yönlendirme Kuralları ({curProf.name} Profili)
                              </label>
                              <span className="text-[10px] text-slate-400">
                                {curProf.name} profilindeyken uygulanacak yönlendirmeler
                              </span>
                            </div>
                            {(pAlways.active || pBusy.active || pNoAns.active) && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateCurProf({
                                    forwarding_always: { ...pAlways, active: false },
                                    forwarding_busy: { ...pBusy, active: false },
                                    forwarding_no_answer: { ...pNoAns, active: false }
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                Yönlendirmeleri Kapat
                              </button>
                            )}
                          </div>
                          <div className="space-y-2.5">
                            {renderForwardingRow(
                              "Her Zaman (Koşulsuz)",
                              !!pAlways.active,
                              (val) => updateCurProfForwarding("forwarding_always", { active: val }),
                              pAlways.type || "internal",
                              (val) => updateCurProfForwarding("forwarding_always", { type: val }),
                              pAlways.target || "",
                              (val) => updateCurProfForwarding("forwarding_always", { target: val }),
                              null,
                              null
                            )}
                            {renderForwardingRow(
                              "Meşgul Durumda",
                              !!pBusy.active,
                              (val) => updateCurProfForwarding("forwarding_busy", { active: val }),
                              pBusy.type || "internal",
                              (val) => updateCurProfForwarding("forwarding_busy", { type: val }),
                              pBusy.target || "",
                              (val) => updateCurProfForwarding("forwarding_busy", { target: val }),
                              null,
                              null
                            )}
                            {renderForwardingRow(
                              "Zaman Aşımında (Cevapsız)",
                              !!pNoAns.active,
                              (val) => updateCurProfForwarding("forwarding_no_answer", { active: val }),
                              pNoAns.type || "internal",
                              (val) => updateCurProfForwarding("forwarding_no_answer", { type: val }),
                              pNoAns.target || "",
                              (val) => updateCurProfForwarding("forwarding_no_answer", { target: val }),
                              null,
                              null
                            )}
                          </div>
                        </div>

                        {/* Akıllı Mobil Aktarım (AI GSM) */}
                        <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Smartphone size={15} className={text} />
                              <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                Akıllı Mobil Aktarım (AI GSM)
                              </span>
                            </div>
                            {hasMobileTransferPermission ? (
                              <button
                                type="button"
                                onClick={() => setMobileTransferEnabled(!mobileTransferEnabled)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                                  mobileTransferEnabled ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                                }`}
                              >
                                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                              </button>
                            ) : (
                              <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 px-2.5 py-0.5 rounded-lg">
                                Yetkisiz
                              </span>
                            )}
                          </div>

                          {hasMobileTransferPermission ? (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                                GSM Numarası
                              </label>
                              <input
                                type="tel"
                                placeholder="Örn: +905553332211"
                                value={gsmNumber}
                                onChange={(e) => setGsmNumber(e.target.value)}
                                disabled={!mobileTransferEnabled}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary disabled:opacity-50"
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
                          {ALL_AVATAR_ITEMS.length} hazır avatardan (telifsiz sinema karakterleri dahil) seçin veya görsel yükleyin
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

                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Avatar kategori filtresi">
                    {AVATAR_CATEGORIES.map((cat) => {
                      const isActiveCat = profileAvatarCategory === cat.id;
                      const catCount = cat.id === "all"
                        ? ALL_AVATAR_ITEMS.length
                        : ALL_AVATAR_ITEMS.filter((a) => a.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={isActiveCat}
                          onClick={() => setProfileAvatarCategory(cat.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                            isActiveCat
                              ? `${bg} text-white border-transparent shadow-sm`
                              : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {cat.label} ({catCount})
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto p-1">
                    {ALL_AVATAR_ITEMS.filter((item) => profileAvatarCategory === "all" || item.category === profileAvatarCategory).map((item) => {
                      const isSelected = item.url === agentAvatar;
                      const shortLabel = item.label.split(" (")[0];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={item.label}
                          aria-pressed={isSelected}
                          title={item.label}
                          onClick={() => setAgentAvatar(item.url)}
                          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 ${ring} bg-slate-50 dark:bg-slate-950 ${
                            isSelected 
                              ? `${border} ${lightBg}` 
                              : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt=""
                            loading="lazy"
                            fetchpriority="low"
                            className="w-10 h-10 rounded-lg object-contain aspect-square shrink-0"
                          />
                          <span className={`text-[9px] font-semibold leading-tight truncate w-full text-center ${
                            isSelected ? text : "text-slate-600 dark:text-slate-400"
                          }`}>
                            {shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* UI Appearance Template Selector (Arayüz Görünüm Şablonu) */}
                <div className={`space-y-3 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
                  {(() => {
                    const currentUiTemplate = normalizeUiTemplate(callPanelPrefs?.uiTemplate);
                    const previewPrimaryHex = rgbStringToHex(tempThemeColor);
                    const activeTemplateMeta =
                      SYSTEM_UI_TEMPLATES.find((item) => item.id === currentUiTemplate) ||
                      SYSTEM_UI_TEMPLATES[0];

                    const selectUiTemplateLive = (tpl) => {
                      const nextId = normalizeUiTemplate(tpl?.id);
                      applyDocumentUiTemplate(nextId);
                      setCallPanelPrefs((prev) => ({
                        ...(prev || {}),
                        uiTemplate: nextId
                      }));
                      if (tpl?.autoDark && !isDarkMode) {
                        setIsDarkMode(true);
                        applyDocumentDarkClass(true);
                      } else if (
                        !tpl?.autoDark &&
                        currentUiTemplate === "oled" &&
                        modalInitialSnapshotRef.current?.isDarkMode === false &&
                        (callPanelPrefs?.autoThemeConfig?.mode || "manual") === "manual"
                      ) {
                        setIsDarkMode(false);
                        applyDocumentDarkClass(false);
                      }
                    };

                    const renderTemplateMiniPreview = (tplId) => {
                      if (tplId === "executive") {
                        return (
                          <div className="h-20 w-full rounded-lg overflow-hidden border border-slate-300/80 dark:border-slate-700 bg-[#eef2f8] dark:bg-[#080c17] flex">
                            <div className="w-10 h-full bg-gradient-to-b from-[#0d1528] to-[#070c18] border-r border-slate-700/60 p-1.5 flex flex-col gap-1.5">
                              <span
                                className="h-2 w-full rounded-md"
                                style={{
                                  background: `linear-gradient(135deg, ${previewPrimaryHex}, rgba(${tempThemeColor}, 0.72))`,
                                  boxShadow: `0 2px 8px rgba(${tempThemeColor}, 0.55)`
                                }}
                              />
                              <span className="h-1 w-4/5 rounded-full bg-slate-600/80" />
                              <span className="h-1 w-3/5 rounded-full bg-slate-600/70" />
                              <span className="h-1 w-4/5 rounded-full bg-slate-700/80" />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <div className="h-4 bg-white dark:bg-[#0d1424] border-b border-slate-200 dark:border-slate-800" />
                              <div className="flex-1 grid grid-cols-2 gap-1.5 p-2">
                                <div
                                  className="rounded-md bg-white dark:bg-[#0e1628] border border-slate-200/90 dark:border-slate-700/80 shadow-sm"
                                  style={{ boxShadow: `inset 0 2px 0 0 rgba(${tempThemeColor}, 0.65)` }}
                                />
                                <div
                                  className="rounded-md bg-white dark:bg-[#0e1628] border border-slate-200/90 dark:border-slate-700/80 shadow-sm"
                                  style={{ boxShadow: `inset 0 2px 0 0 rgba(${tempThemeColor}, 0.65)` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (tplId === "aurora") {
                        return (
                          <div
                            className="h-20 w-full rounded-lg overflow-hidden border border-white/80 dark:border-slate-700/70 relative flex p-1.5 gap-1.5"
                            style={{
                              background: isDarkMode
                                ? `radial-gradient(circle at 12% 8%, rgba(${tempThemeColor}, 0.52), transparent 58%), radial-gradient(circle at 90% 18%, rgba(14, 165, 233, 0.36), transparent 55%), radial-gradient(circle at 55% 95%, rgba(168, 85, 247, 0.32), #060b18 75%)`
                                : `radial-gradient(circle at 12% 8%, rgba(${tempThemeColor}, 0.42), transparent 58%), radial-gradient(circle at 90% 18%, rgba(14, 165, 233, 0.34), transparent 55%), radial-gradient(circle at 55% 95%, rgba(168, 85, 247, 0.26), #eaf0fc 75%)`
                            }}
                          >
                            <div className="w-9 h-full rounded-md bg-white/55 dark:bg-slate-900/55 border border-white/90 dark:border-white/15 p-1.5 flex flex-col gap-1.5 backdrop-blur-sm">
                              <span
                                className="h-2 w-full rounded-md"
                                style={{
                                  background: `linear-gradient(135deg, ${previewPrimaryHex}, rgba(${tempThemeColor}, 0.72))`
                                }}
                              />
                              <span className="h-1 w-4/5 rounded-full bg-slate-400/70 dark:bg-slate-500/80" />
                              <span className="h-1 w-3/5 rounded-full bg-slate-400/60 dark:bg-slate-500/70" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                              <div className="h-3.5 rounded-md bg-white/60 dark:bg-slate-900/55 border border-white/90 dark:border-white/15" />
                              <div className="flex-1 grid grid-cols-2 gap-1.5">
                                <div className="rounded-md bg-white/65 dark:bg-slate-900/55 border border-white/95 dark:border-white/20 shadow-sm" />
                                <div className="rounded-md bg-white/65 dark:bg-slate-900/55 border border-white/95 dark:border-white/20 shadow-sm" />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (tplId === "bento") {
                        return (
                          <div className="h-20 w-full rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-[#dce2ee] dark:bg-[#07090f] flex p-2 gap-2">
                            <div className="w-9 h-full rounded-2xl bg-white dark:bg-[#131926] shadow-md p-1.5 flex flex-col gap-1.5">
                              <span className="h-2 w-full rounded-full" style={{ backgroundColor: previewPrimaryHex }} />
                              <span className="h-1 w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                              <span className="h-1 w-3/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                              <div className="h-3.5 rounded-full bg-white dark:bg-[#131926] shadow-sm" />
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl bg-white dark:bg-[#131926] shadow-md" />
                                <div className="rounded-2xl bg-white dark:bg-[#131926] shadow-md" />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (tplId === "linear") {
                        return (
                          <div
                            className="h-20 w-full rounded-[3px] overflow-hidden border border-zinc-300 dark:border-zinc-700 flex"
                            style={{
                              backgroundColor: isDarkMode ? "#09090b" : "#f7f7f9",
                              backgroundImage: `radial-gradient(rgba(${tempThemeColor}, 0.35) 1px, transparent 1px)`,
                              backgroundSize: "8px 8px"
                            }}
                          >
                            <div className="w-9 h-full bg-white dark:bg-[#0c0c0f] border-r border-zinc-300 dark:border-zinc-700 p-1.5 flex flex-col gap-1.5">
                              <span className="h-2 w-full rounded-[2px]" style={{ backgroundColor: previewPrimaryHex }} />
                              <span className="h-1 w-4/5 rounded-[1px] bg-zinc-300 dark:bg-zinc-700" />
                              <span className="h-1 w-3/5 rounded-[1px] bg-zinc-300 dark:bg-zinc-700" />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <div className="h-3.5 bg-white dark:bg-[#0c0c0f] border-b border-zinc-300 dark:border-zinc-700" />
                              <div className="flex-1 grid grid-cols-2 gap-1.5 p-2">
                                <div className="rounded-[2px] bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-700" />
                                <div className="rounded-[2px] bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-700" />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (tplId === "oled") {
                        return (
                          <div
                            className="h-20 w-full rounded-lg overflow-hidden border flex"
                            style={{
                              backgroundColor: "#000000",
                              backgroundImage: `linear-gradient(to right, rgba(${tempThemeColor}, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(${tempThemeColor}, 0.12) 1px, transparent 1px)`,
                              backgroundSize: "10px 10px",
                              borderColor: `rgba(${tempThemeColor}, 0.55)`
                            }}
                          >
                            <div
                              className="w-9 h-full p-1.5 flex flex-col gap-1.5 border-r"
                              style={{
                                backgroundColor: "#03050a",
                                borderColor: `rgba(${tempThemeColor}, 0.42)`
                              }}
                            >
                              <span
                                className="h-2 w-full rounded-md"
                                style={{
                                  backgroundColor: previewPrimaryHex,
                                  boxShadow: `0 0 10px rgba(${tempThemeColor}, 0.9)`
                                }}
                              />
                              <span className="h-1 w-4/5 rounded-full bg-slate-800" />
                              <span className="h-1 w-3/5 rounded-full bg-slate-800" />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <div
                                className="h-3.5 border-b"
                                style={{
                                  backgroundColor: "#03050a",
                                  borderColor: `rgba(${tempThemeColor}, 0.38)`
                                }}
                              />
                              <div className="flex-1 grid grid-cols-2 gap-1.5 p-2">
                                <div
                                  className="rounded-md border"
                                  style={{
                                    backgroundColor: "#050811",
                                    borderColor: `rgba(${tempThemeColor}, 0.55)`,
                                    boxShadow: `0 0 10px -2px rgba(${tempThemeColor}, 0.45)`
                                  }}
                                />
                                <div
                                  className="rounded-md border"
                                  style={{
                                    backgroundColor: "#050811",
                                    borderColor: `rgba(${tempThemeColor}, 0.55)`,
                                    boxShadow: `0 0 10px -2px rgba(${tempThemeColor}, 0.45)`
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Default: "classic"
                      return (
                        <div className="h-20 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex">
                          <div className="w-9 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-1.5 flex flex-col gap-1.5">
                            <span className="h-2 w-full rounded-md" style={{ backgroundColor: previewPrimaryHex }} />
                            <span className="h-1 w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <span className="h-1 w-3/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                          </div>
                          <div className="flex-1 flex flex-col">
                            <div className="h-3.5 bg-white/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800" />
                            <div className="flex-1 grid grid-cols-2 gap-1.5 p-2">
                              <div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm" />
                              <div className="rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm" />
                            </div>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                              <Layers size={15} />
                            </div>
                            <div>
                              <label className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider block">
                                Arayüz Görünüm Şablonu
                              </label>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Mevcut AIDA Klasik yapısını koruyabilir veya belirgin tasarım şablonlarını anında önizleyebilirsiniz
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onPointerDown={() => setIsPeekingUiTemplate(true)}
                              onPointerUp={() => setIsPeekingUiTemplate(false)}
                              onPointerLeave={() => setIsPeekingUiTemplate(false)}
                              title="Seçili şablonu arkadaki tam ekranda görmek için basılı tutun"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-primary/60 transition-all cursor-pointer select-none shadow-sm"
                            >
                              <Eye size={12} className={text} />
                              <span>Ekranı Gör (Basılı Tut)</span>
                            </button>

                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${lightBg} ${text} ${border}`}>
                              <Sparkles size={11} />
                              <span>Aktif: {activeTemplateMeta.name}</span>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {SYSTEM_UI_TEMPLATES.map((tpl) => {
                            const isSelected = currentUiTemplate === tpl.id;
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => selectUiTemplateLive(tpl)}
                                className={`group relative p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? `${border} ${lightBg} ring-2 ring-primary/20 shadow-sm`
                                    : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                {renderTemplateMiniPreview(tpl.id)}

                                <div className="flex items-start justify-between gap-1.5 pt-0.5">
                                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-xs font-extrabold truncate ${isSelected ? text : "text-slate-800 dark:text-slate-100"}`}>
                                      {tpl.name}
                                    </span>
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      {tpl.badge}
                                    </span>
                                  </div>

                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                                      isSelected
                                        ? `${bg} text-white border-transparent shadow-sm`
                                        : "border-slate-300 dark:border-slate-700 bg-transparent"
                                    }`}
                                  >
                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                  </span>
                                </div>

                                <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                                  {tpl.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* System Theme Color Selection */}
                <div className={`space-y-3 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
                  {(() => {
                    const currentThemeHex = rgbStringToHex(tempThemeColor);
                    const isCustomTheme = !SYSTEM_THEME_PRESETS.some((p) => p.value === tempThemeColor);
                    const applyThemeColorLive = (rawColor) => {
                      const safeColor = getSafeThemeColor(rawColor);
                      setTempThemeColor(safeColor);
                      document.documentElement.style.setProperty("--color-primary", safeColor);
                    };

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-widest block">
                              Sistem Tema Rengi
                            </label>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                              Genişletilmiş hazır renklerden seçin veya renk paletinden özel renginizi belirleyin
                            </span>
                          </div>

                          <label
                            title="Renk Paletinden Özel Sistem Rengi Seç"
                            className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all shadow-sm ${
                              isCustomTheme
                                ? `${border} ${lightBg}`
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary/60"
                            }`}
                          >
                            <Palette size={13} className={text} />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-sm shrink-0"
                              style={{ backgroundColor: currentThemeHex }}
                            />
                            <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
                              Renk Paleti
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                              {currentThemeHex}
                            </span>
                            <input
                              type="color"
                              value={currentThemeHex}
                              onChange={(e) => applyThemeColorLive(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 gap-2">
                          {SYSTEM_THEME_PRESETS.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => applyThemeColorLive(t.value)}
                              className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                tempThemeColor === t.value
                                  ? "border-slate-800 dark:border-white ring-2 ring-slate-800/10 dark:ring-white/10 bg-slate-50/80 dark:bg-slate-800/60"
                                  : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                              title={`${t.name} (${t.hex.toUpperCase()})`}
                            >
                              <span
                                className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-black/10"
                                style={{ backgroundColor: t.hex }}
                              />
                              <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center">
                                {t.name}
                              </span>
                            </button>
                          ))}

                          {/* Özel Palet Kartı */}
                          <label
                            title="Renk Paletinden İstediğiniz Rengi Seçin"
                            className={`relative p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                              isCustomTheme
                                ? "border-slate-800 dark:border-white ring-2 ring-slate-800/10 dark:ring-white/10 bg-slate-50/80 dark:bg-slate-800/60"
                                : "border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/60"
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-black/15 flex items-center justify-center"
                              style={{
                                background: isCustomTheme
                                  ? currentThemeHex
                                  : "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)"
                              }}
                            >
                              <Palette size={10} className="text-white drop-shadow" />
                            </span>
                            <span className="text-[8px] font-extrabold text-slate-700 dark:text-slate-200 truncate w-full text-center">
                              {isCustomTheme ? currentThemeHex.toUpperCase() : "Özel Seç"}
                            </span>
                            <input
                              type="color"
                              value={currentThemeHex}
                              onChange={(e) => applyThemeColorLive(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Auto Dark Mode & Customer 360 Screen-Pop Preferences */}
                <div className={`p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4 ${activeModalTab === "profile" ? "block" : "hidden"}`}>
                  {(() => {
                    const autoCfg = callPanelPrefs?.autoThemeConfig || { mode: "manual", darkStart: "19:00", darkEnd: "07:00" };
                    const updateAutoThemeLive = (patch) => {
                      setCallPanelPrefs((prev) => {
                        const mergedAuto = {
                          mode: "manual",
                          darkStart: "19:00",
                          darkEnd: "07:00",
                          ...(prev?.autoThemeConfig || {}),
                          ...patch,
                        };
                        const nextDark = resolveEffectiveDarkMode(
                          mergedAuto,
                          modalInitialSnapshotRef.current?.isDarkMode ? "dark" : "light"
                        );
                        setIsDarkMode(nextDark);
                        applyDocumentDarkClass(nextDark);
                        return {
                          ...(prev || {}),
                          autoThemeConfig: mergedAuto,
                        };
                      });
                    };

                    const toggleAutoOpen360 = () => {
                      setCallPanelPrefs((prev) => ({
                        ...(prev || {}),
                        autoOpenCustomer360OnCall: !Boolean(prev?.autoOpenCustomer360OnCall),
                      }));
                    };

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                              <Moon size={15} />
                            </div>
                            <div>
                              <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                Otomatik Karanlık Mod & Görünüm Zamanlaması
                              </h5>
                              <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Akşam mesaisinde göz yorgunluğunu önlemek için saate veya işletim sisteminize göre otomatik karanlık moda geçin.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            {
                              id: "manual",
                              title: "Manuel Seçim",
                              desc: "Üst bardaki Güneş/Ay ikonundan kendiniz değiştirirsiniz.",
                            },
                            {
                              id: "system",
                              title: "İşletim Sistemiyle Eşitle",
                              desc: "Bilgisayarınızın gece/gündüz temasını otomatik takip eder.",
                            },
                            {
                              id: "schedule",
                              title: "Saate Göre Otomatik",
                              desc: "Belirlediğiniz akşam saatinde otomatik Karanlık Moda geçer.",
                            },
                          ].map((opt) => {
                            const active = (autoCfg.mode || "manual") === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateAutoThemeLive({ mode: opt.id })}
                                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                  active
                                    ? `${border} ${lightBg} shadow-sm`
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                                    {opt.title}
                                  </span>
                                  {active && <Check size={13} className={text} />}
                                </div>
                                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                  {opt.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {autoCfg.mode === "schedule" && (
                          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Karanlık Mod Başlangıcı
                              </label>
                              <input
                                type="time"
                                value={autoCfg.darkStart || "19:00"}
                                onChange={(e) => updateAutoThemeLive({ darkStart: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Aydınlık Moda Dönüş
                              </label>
                              <input
                                type="time"
                                value={autoCfg.darkEnd || "07:00"}
                                onChange={(e) => updateAutoThemeLive({ darkEnd: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4">
                          <div>
                            <h6 className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                              Gelen Çağrıda Müşteri 360° Kartını Otomatik Aç
                            </h6>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Web Telefonunuz çaldığında arayan müşterinin geçmiş çağrı, WhatsApp ve VIP notlarını otomatik olarak sağ çekmecede açar.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={Boolean(callPanelPrefs?.autoOpenCustomer360OnCall)}
                            onClick={toggleAutoOpen360}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                              callPanelPrefs?.autoOpenCustomer360OnCall ? bg : "bg-slate-200 dark:bg-slate-800"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                callPanelPrefs?.autoOpenCustomer360OnCall ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        {/* UI Motion & Chart Animation Mode Selector */}
                        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h6 className="text-[11px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <Sparkles size={13} className={text} />
                                <span>Arayüz Geçiş & Grafik Animasyonları</span>
                              </h6>
                              <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Ekranlar arası pencere süzülmesi, kademeli kart yüklenişi, grafik çizimi ve KPI sayaç hızını belirleyin.
                              </p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider border ${lightBg} ${text} ${borderLight}`}>
                              {(callPanelPrefs?.uiMotionMode || "fluid") === "minimal"
                                ? "Minimal (Hızlı)"
                                : (callPanelPrefs?.uiMotionMode || "fluid") === "off"
                                ? "Kapalı"
                                : "Akıcı (Varsayılan)"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                              {
                                id: "fluid",
                                title: "Akıcı (Varsayılan)",
                                desc: "Yumuşak ve sakin pencere süzülmesi (540ms), kademeli kart akışı, canlı grafik çizimi ve sayaç animasyonu."
                              },
                              {
                                id: "minimal",
                                title: "Minimal (Hızlı)",
                                desc: "Yalnızca 200ms hafif netleşme; kademeli gecikmeler olmadan daha seri sekme geçişi."
                              },
                              {
                                id: "off",
                                title: "Kapalı (Anında)",
                                desc: "Tüm pencere, kart ve grafik geçiş efektlerini kapatarak anında statik yükleme yapar."
                              }
                            ].map((mOpt) => {
                              const currentMotion = normalizeUiMotionMode(callPanelPrefs?.uiMotionMode);
                              const isMotionSelected = currentMotion === mOpt.id;
                              return (
                                <button
                                  key={mOpt.id}
                                  type="button"
                                  onClick={() => {
                                    setCallPanelPrefs((prev) => ({
                                      ...(prev || {}),
                                      uiMotionMode: mOpt.id,
                                    }));
                                    applyDocumentMotionMode(mOpt.id);
                                  }}
                                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                    isMotionSelected
                                      ? `${border} ${lightBg} shadow-sm`
                                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                                      {mOpt.title}
                                    </span>
                                    {isMotionSelected && <Check size={13} className={text} />}
                                  </div>
                                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                    {mOpt.desc}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Hardware Devices Header + Refresh */}
                <div className={`flex items-center justify-between gap-2 pb-1 ${activeModalTab === "hardware" ? "flex" : "hidden"}`}>
                  <div>
                    <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                      <Headphones size={13} className={text} />
                      <span>PC Ses Donanımı & Çalma Aygıtları</span>
                    </h5>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Mikrofonu, görüşme kulaklığını ve çağrı çalma tonu hoparlörünü birbirinden bağımsız seçebilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshHardwareAudioDevices}
                    title="Bağlı USB / Bluetooth ses aygıtlarını yeniden tara"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={11} className={`${text} ${isRefreshingDevices ? "animate-spin" : ""}`} />
                    <span>Aygıtları Tara</span>
                  </button>
                </div>

                {/* Quick Audio Hardware Check (Mikrofon & Hoparlör Hızlı Test Alanı) */}
                <div className={`p-3.5 rounded-2xl border ${borderLight} bg-white/90 dark:bg-slate-900/90 shadow-xs space-y-3 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
                        <Activity size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10.5px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide block">
                          Ses Cihazı Hızlı Test (Mikrofon & Hoparlör)
                        </span>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block truncate">
                          Çağrıya girmeden önce mikrofon donanımınızı ve kulaklık ses çıkışınızı tek tıkla doğrulayın
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleQuickHardwareCheck}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                        isTestingMic || isTestingSpeaker
                          ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                          : `${bg} ${hover} text-white shadow-xs`
                      }`}
                    >
                      {isTestingMic || isTestingSpeaker ? (
                        <>
                          <Square size={11} className="fill-current animate-pulse" />
                          <span>Hızlı Testi Durdur</span>
                        </>
                      ) : (
                        <>
                          <Play size={11} className="fill-current" />
                          <span>Hızlı Ses Testi Başlat</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Single-Piece Smooth Microphone Hardware Bar */}
                    <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[9.5px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <Mic size={11} className={isTestingMic && micTestLevels.inputLevel > 3 ? "text-emerald-500" : "text-slate-400"} />
                          <span>Mikrofon Donanımı</span>
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          {isTestingMic ? `%${micTestLevels.inputLevel}` : "Beklemede"}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"
                          style={{
                            width: `${isTestingMic ? Math.max(micTestLevels.inputLevel > 0 ? 4 : 0, micTestLevels.inputLevel) : 0}%`,
                            boxShadow: isTestingMic && micTestLevels.inputLevel > 8 ? "0 0 8px rgba(16, 185, 129, 0.45)" : "none"
                          }}
                        />
                      </div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 leading-tight">
                        {isTestingMic
                          ? micTestLevels.inputLevel > 3
                            ? "Mikrofonunuzdan canlı ses sinyali alınıyor."
                            : "Ses algılanmıyor (Kulaklık üzerindeki fiziksel mute tuşunu kontrol edin)."
                          : "Test başlatıldığında doğrudan mikrofon sinyalini gösterir."}
                      </p>
                    </div>

                    {/* Single-Piece Smooth Speaker Output Bar */}
                    <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[9.5px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <Volume2 size={11} className={isTestingSpeaker || (isTestingMic && micTestLevels.outputLevel > 3) ? "text-sky-500" : "text-slate-400"} />
                          <span>Hoparlör / Kulaklık Çıkışı</span>
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          {isTestingSpeaker
                            ? `%${quickSpeakerLevel}`
                            : isTestingMic
                            ? `%${micTestLevels.outputLevel}`
                            : "Beklemede"}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500"
                          style={{
                            width: `${
                              isTestingSpeaker
                                ? quickSpeakerLevel
                                : isTestingMic
                                ? Math.max(micTestLevels.outputLevel > 0 ? 4 : 0, micTestLevels.outputLevel)
                                : 0
                            }%`,
                            boxShadow:
                              isTestingSpeaker || (isTestingMic && micTestLevels.outputLevel > 8)
                                ? "0 0 8px rgba(59, 130, 246, 0.45)"
                                : "none"
                          }}
                        />
                      </div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 leading-tight">
                        {isTestingSpeaker
                          ? "Seçili kulaklık/hoparlör çıkışına test melodisi gönderiliyor."
                          : isTestingMic
                          ? "Mikrofon sesiniz 0.3 sn gecikmeyle kulaklığa iletiliyor."
                          : "Test başlatıldığında kulaklığa giden ses paketini gösterir."}
                      </p>
                    </div>
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
                  <label className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Konuşma Çıkış Aygıtı (Görüşme Kulaklığı / Hoparlör)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedSpeaker(nextId);
                        if (isTestingMic) {
                          startMicLoopbackTest(noiseSuppressionMode, selectedMic, nextId);
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
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

                    <button
                      type="button"
                      onClick={() => {
                        if (isTestingSpeaker) {
                          stopSpeakerTestSound();
                          stopQuickSpeakerMeter();
                          setIsTestingSpeaker(false);
                        } else {
                          const spkObj = audioDevices.outputs.find((d) => d.deviceId === selectedSpeaker);
                          setIsTestingSpeaker(true);
                          startQuickSpeakerMeter();
                          playSpeakerTestSound(selectedSpeaker, spkObj?.label || "", () => {
                            setIsTestingSpeaker(false);
                            stopQuickSpeakerMeter();
                          });
                        }
                      }}
                      className="px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer shrink-0"
                    >
                      {isTestingSpeaker ? (
                        <>
                          <Square size={11} className="text-primary fill-rose-500 animate-pulse" />
                          <span>Durdur</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} className={text} />
                          <span>Test Et</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Ringtone Speaker Selection + Independent Volume */}
                <div className={`p-3.5 rounded-2xl border ${borderLight} ${lightBg} space-y-2.5 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <div>
                    <label className="text-[9.5px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest block">
                      Çalma Tonu Aygıtı (Zil Sesi Hangi Hoparlörden Çalsın?)
                    </label>
                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Kulaklığınız masadayken çağrıyı duymak için çalma tonunu bilgisayar hoparlörüne, konuşma sesini ise kulaklığa verebilirsiniz.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedRingtoneSpeaker}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedRingtoneSpeaker(nextId);
                        const devObj = audioDevices.outputs.find((d) => d.deviceId === nextId);
                        if (isPreviewingRingtone) {
                          playRingtoneSound(agentRingtone, nextId, devObj?.label || "");
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
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
                      className="px-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer shrink-0"
                    >
                      {isPreviewingRingtone ? (
                        <>
                          <Square size={11} className="text-primary fill-rose-500 animate-pulse" />
                          <span>Durdur</span>
                        </>
                      ) : (
                        <>
                          <Play size={11} className="text-primary fill-emerald-500" />
                          <span>Zili Çal</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                      Çalma Tonu Seviyesi:
                    </span>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={ringtoneVolume}
                      onChange={(e) => {
                        const savedVol = setSavedRingtoneVolume(parseFloat(e.target.value));
                        setRingtoneVolume(savedVol);
                      }}
                      className="flex-1 accent-primary cursor-pointer h-1.5 rounded-lg"
                    />
                    <span className={`text-[10px] font-extrabold font-mono w-9 text-right ${text}`}>
                      %{Math.round(ringtoneVolume * 100)}
                    </span>
                  </div>
                </div>

                {/* Desktop & OS Notification Controls */}
                <div className={`p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2.5 ${activeModalTab === "hardware" ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BellRing size={14} className={text} />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide block">
                          Masaüstü & Gelen Çağrı Bildirimleri
                        </span>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400">
                          Uygulama arka plandayken gelen çağrı, geri arama ve mesaj bildirimleri
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isNativeElectron() && typeof Notification !== "undefined" && Notification.permission !== "granted") {
                          try {
                            await Notification.requestPermission();
                          } catch (e) {}
                        }
                        sendDesktopNotification({
                          title: "🔔 AIDA Agent Bildirim Testi",
                          body: "Gelen çağrı ve mesaj bildirimleriniz sorunsuz çalışıyor.",
                          urgent: false,
                          forceEvenIfDisabled: true
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                      Test Bildirimi
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 cursor-pointer">
                      <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                        Sistem Bildirimlerini Göster
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(desktopPrefs?.osNotifications)}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          if (checked && !isNativeElectron() && typeof Notification !== "undefined" && Notification.permission === "default") {
                            try {
                              await Notification.requestPermission();
                            } catch (err) {}
                          }
                          setDesktopPrefs((prev) => ({ ...(prev || {}), osNotifications: checked }));
                        }}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                    </label>

                    {isNativeElectron() && (
                      <>
                        <label className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 cursor-pointer">
                          <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                            Çağrı Geldiğinde Pencereyi Otomatik Öne Getir
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(desktopPrefs?.popWindowOnCall)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDesktopPrefs((prev) => ({ ...(prev || {}), popWindowOnCall: checked }));
                            }}
                            className="h-4 w-4 rounded accent-primary cursor-pointer"
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 cursor-pointer">
                          <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                            Pencere Kapatıldığında (X) Sistem Tepsisinde Açık Tut
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(desktopPrefs?.minimizeToTray)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDesktopPrefs((prev) => ({ ...(prev || {}), minimizeToTray: checked }));
                            }}
                            className="h-4 w-4 rounded accent-primary cursor-pointer"
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 cursor-pointer">
                          <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                            Bilgisayar Açıldığında AIDA Agent Otomatik Başlasın
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(desktopPrefs?.startOnBoot)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDesktopPrefs((prev) => ({ ...(prev || {}), startOnBoot: checked }));
                            }}
                            className="h-4 w-4 rounded accent-primary cursor-pointer"
                          />
                        </label>
                      </>
                    )}
                  </div>
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
                  <div ref={profileTwoFactorCardRef} className="p-4 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
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
                          userTouched2faInModalRef.current = true;
                          const nextVal = !twoFactorEnabled;
                          setTwoFactorEnabled(nextVal);
                          setTwoFactorStatusMsg(null);
                          if (nextVal) {
                            scrollProfileTwoFactorIntoPane();
                          }
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
                        {/* DOĞRULAMA MODU (TEK YÖNTEM / 2 AŞAMALI ZORUNLU / YEDEKLİ) */}
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Doğrulama Çalışma Modu (Tek / 2 Aşamalı 2FA)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            {[
                              { mode: "single", title: "Tek Yöntem", desc: "Standart tek doğrulama" },
                              { mode: "all", title: "2 Aşamalı Zorunlu", desc: "Örn: Mail + Authenticator" },
                              { mode: "any", title: "Esnek / Yedekli", desc: "Seçilenlerden herhangi biri" }
                            ].map((opt) => {
                              const isModeActive = twoFactorMultiMode === opt.mode;
                              return (
                                <button
                                  key={opt.mode}
                                  type="button"
                                  onClick={() => {
                                    userTouched2faInModalRef.current = true;
                                    setTwoFactorMultiMode(opt.mode);
                                    if (opt.mode === "single") {
                                      const keepM = twoFactorMethod || twoFactorActiveMethods[0] || "google_auth";
                                      setTwoFactorActiveMethods([keepM]);
                                      setTwoFactorMethod(keepM);
                                      activeProfileTwoFactorMethodRef.current = keepM;
                                    } else {
                                      let nextList = Array.isArray(twoFactorActiveMethods) ? [...twoFactorActiveMethods] : [];
                                      if (nextList.length < 2) {
                                        const curr = nextList[0] || twoFactorMethod || "google_auth";
                                        nextList = (curr === "google_auth" || curr === "microsoft_auth") ? ["email", curr] : [curr, "google_auth"];
                                      }
                                      setTwoFactorActiveMethods(nextList);
                                      if (nextList.includes("google_auth") && !twoFactorMethodsMap?.google_auth?.qrSvg) {
                                        fetchProfile2faSetup(false, "google_auth");
                                      }
                                      if (nextList.includes("microsoft_auth") && !twoFactorMethodsMap?.microsoft_auth?.qrSvg) {
                                        fetchProfile2faSetup(false, "microsoft_auth");
                                      }
                                    }
                                  }}
                                  className={`p-2 rounded-xl text-left border transition-all ${
                                    isModeActive
                                      ? `${lightBg} ${border} ring-2 ${ring}`
                                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[10px] font-extrabold ${isModeActive ? text : "text-slate-800 dark:text-slate-100"}`}>
                                      {opt.title}
                                    </span>
                                    {isModeActive && <CheckCircle size={12} className={text} />}
                                  </div>
                                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                                    {opt.desc}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {twoFactorMultiMode === "single"
                                ? "2FA Doğrulama Yöntemi Seçiniz"
                                : "Aktif 2FA Yöntemlerini Seçiniz (Birden Fazla Seçilebilir)"}
                            </label>
                            {twoFactorMultiMode !== "single" && twoFactorActiveMethods.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  userTouched2faInModalRef.current = true;
                                  setTwoFactorActiveMethods((prev) => [...prev].reverse());
                                }}
                                className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 flex items-center gap-1"
                              >
                                <RefreshCw size={10} />
                                Sırayı Değiştir (1 ⇄ 2)
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { id: "email", title: "E-Posta (E-Mail)", desc: "E-posta adresinize 6 haneli kod gönderilir", icon: Mail },
                              { id: "whatsapp", title: "WhatsApp (Giriş Kodu)", desc: "WhatsApp'a 'Giriş Kodu' yazıldığında 5 dk geçerli kod gelir", icon: Phone },
                              { id: "google_auth", title: "Google Authenticator", desc: "Google Authenticator ile 30 sn'lik kod", icon: Smartphone },
                              { id: "microsoft_auth", title: "Microsoft Authenticator", desc: "Microsoft Authenticator ile 30 sn'lik kod", icon: Key }
                            ].map((m) => {
                              const IconComp = m.icon;
                              const isFocused = twoFactorMethod === m.id || (m.id === "google_auth" && twoFactorMethod === "app");
                              const activeIdx = twoFactorActiveMethods.indexOf(m.id);
                              const isActiveMethod = twoFactorMultiMode === "single" ? isFocused : activeIdx !== -1;

                              const focusProfMethod = (methodId) => {
                                userTouched2faInModalRef.current = true;
                                activeProfileTwoFactorMethodRef.current = methodId;
                                setTwoFactorMethod(methodId);
                                setTwoFactorStatusMsg(null);
                                setTwoFactorTestCode("");
                                const cachedM = twoFactorMethodsMap[methodId] || {};
                                setTwoFactorEnrolled(Boolean(cachedM.enrolled));
                                if (methodId === "google_auth" || methodId === "microsoft_auth") {
                                  setTwoFactorSecret(cachedM.secret || "");
                                  setTwoFactorQrSvg(cachedM.qrSvg || "");
                                  if (!cachedM.qrSvg) {
                                    fetchProfile2faSetup(false, methodId);
                                  }
                                }
                                scrollProfileTwoFactorIntoPane();
                              };

                              return (
                                <div
                                  key={m.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    if (twoFactorMultiMode === "single") {
                                      setTwoFactorActiveMethods([m.id]);
                                      focusProfMethod(m.id);
                                    } else {
                                      if (!isActiveMethod) {
                                        setTwoFactorActiveMethods([...twoFactorActiveMethods, m.id]);
                                      }
                                      focusProfMethod(m.id);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.currentTarget.click();
                                    }
                                  }}
                                  className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                                    isActiveMethod
                                      ? `${lightBg} ${border} ${isFocused ? `ring-2 ${ring}` : ""}`
                                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                                  }`}
                                >
                                  <div className="flex items-center justify-between w-full gap-1">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActiveMethod ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                      <IconComp size={13} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {twoFactorMultiMode === "all" && isActiveMethod && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold text-white ${bg}`}>
                                          {activeIdx + 1}. Aşama
                                        </span>
                                      )}
                                      {twoFactorMultiMode === "any" && isActiveMethod && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold text-white ${bg}`}>
                                          Aktif
                                        </span>
                                      )}
                                      {twoFactorMultiMode !== "single" && isActiveMethod && twoFactorActiveMethods.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            userTouched2faInModalRef.current = true;
                                            const filtered = twoFactorActiveMethods.filter((id) => id !== m.id);
                                            const safeNext = filtered.length > 0 ? filtered : ["google_auth"];
                                            setTwoFactorActiveMethods(safeNext);
                                            if (safeNext.length <= 1) setTwoFactorMultiMode("single");
                                            if (isFocused && safeNext[0]) focusProfMethod(safeNext[0]);
                                          }}
                                          className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                                        >
                                          Çıkar
                                        </button>
                                      )}
                                      {twoFactorMultiMode === "single" && !isActiveMethod && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            userTouched2faInModalRef.current = true;
                                            const currPrimary = twoFactorMethod || "google_auth";
                                            const combined = currPrimary === m.id ? [m.id] : [currPrimary, m.id];
                                            setTwoFactorMultiMode("all");
                                            setTwoFactorActiveMethods(combined);
                                            focusProfMethod(m.id);
                                          }}
                                          className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                        >
                                          + Birlikte Kullan
                                        </button>
                                      )}
                                      {isActiveMethod && <CheckCircle size={13} className={text} />}
                                    </div>
                                  </div>
                                  <div>
                                    <div className={`text-[11px] font-extrabold ${isActiveMethod ? text : "text-slate-800 dark:text-slate-100"}`}>
                                      {m.title}
                                    </div>
                                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                      {m.desc}
                                    </div>
                                  </div>
                                </div>
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
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="\d{6}"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
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
                                <label htmlFor="profile-2fa-whatsapp-phone" className="block text-[9px] font-bold uppercase text-slate-400 mb-1">WhatsApp / GSM Numaranız</label>
                                <input
                                  id="profile-2fa-whatsapp-phone"
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                  spellCheck={false}
                                  value={gsmNumber}
                                  onChange={(e) => {
                                    userTouched2faInModalRef.current = true;
                                    setGsmNumber(e.target.value);
                                  }}
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
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="\d{6}"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
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
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="\d{6}"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
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

                {/* Self-Service Hot-Desking Tab */}
                <div className={`space-y-4 ${activeModalTab === "hotdesk" ? "block" : "hidden"}`}>
                  <div className="p-5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agentHotdeskConfig?.enabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                          <Phone size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                              Ortak Masa Telefonu (Masa Paylaşımı)
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${agentHotdeskConfig?.enabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                              {agentHotdeskConfig?.enabled ? "Aktif" : "Pasif"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Ofisteki herhangi bir masa telefonuna oturup kendi dahilinizi ({currentUser?.extension}) bağlamak için özel PIN şifrenizi ve gece 00:00 otomatik çıkış tercihinizi yönetin.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAgentHotdeskConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
                        }
                        className={`transition-colors shrink-0 ${agentHotdeskConfig?.enabled ? text : "text-slate-400"}`}
                      >
                        {agentHotdeskConfig?.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      </button>
                    </div>

                    {agentHotdeskConfig?.enabled && (
                      <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Dedicated Hot-Desk PIN */}
                          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="self-hotdesk-pin"
                                className="text-xs font-extrabold text-slate-800 dark:text-white"
                              >
                                Ortak Masa Telefonu Özel PIN Şifrem
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const rnd = String(Math.floor(100000 + Math.random() * 900000));
                                  setAgentHotdeskConfig((prev) => ({ ...prev, pin: rnd }));
                                  setShowAgentHotdeskPin(true);
                                }}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center gap-1`}
                              >
                                <RefreshCw size={11} />
                                PIN Üret
                              </button>
                            </div>
                            <p
                              id="self-hotdesk-pin-hint"
                              className="text-[10px] text-slate-500 dark:text-slate-400"
                            >
                              Giriş ve SIP şifrenizden ayrıdır; 4 ile 8 haneli sadece rakam belirleyiniz.
                            </p>
                            <div className="relative flex items-center">
                              <input
                                id="self-hotdesk-pin"
                                type={showAgentHotdeskPin ? "text" : "password"}
                                inputMode="numeric"
                                autoComplete="off"
                                pattern="\d{4,8}"
                                maxLength={8}
                                aria-describedby="self-hotdesk-pin-hint"
                                value={agentHotdeskConfig?.pin || ""}
                                onChange={(e) =>
                                  setAgentHotdeskConfig((prev) => ({
                                    ...prev,
                                    pin: e.target.value.replace(/\D/g, "").slice(0, 8)
                                  }))
                                }
                                onBlur={() => setAgentHotdeskPinTouched(true)}
                                placeholder="Örn: 482910"
                                className={`w-full text-xs font-mono font-extrabold tracking-widest px-3.5 py-2.5 pr-10 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none ${
                                  agentHotdeskPinTouched && !/^\d{4,8}$/.test(String(agentHotdeskConfig?.pin || ""))
                                    ? "border-rose-400 dark:border-rose-600"
                                    : "border-slate-200 dark:border-slate-800"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowAgentHotdeskPin((p) => !p)}
                                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              >
                                {showAgentHotdeskPin ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                            {agentHotdeskPinTouched && !/^\d{4,8}$/.test(String(agentHotdeskConfig?.pin || "")) && (
                              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <AlertTriangle size={12} />
                                Lütfen 4 ile 8 haneli rakamlardan oluşan bir PIN giriniz.
                              </p>
                            )}
                          </div>

                          {/* Midnight Auto-Logout Toggle */}
                          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white">
                                  Gece 00:00&apos;da Oturumu Otomatik Kapat
                                </h5>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                  Mesai sonunda masa telefonundan çıkış yapmayı unutursanız gece 00:00&apos;da oturumunuz güvenli şekilde otomatik kapatılır.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setAgentHotdeskConfig((prev) => ({
                                    ...prev,
                                    auto_logout_midnight: !prev.auto_logout_midnight
                                  }))
                                }
                                className={`transition-colors shrink-0 ${agentHotdeskConfig?.auto_logout_midnight ? text : "text-slate-400"}`}
                              >
                                {agentHotdeskConfig?.auto_logout_midnight ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                              </button>
                            </div>
                            <div className={`p-2.5 rounded-xl border ${lightBg} ${borderLight} text-[10px] font-semibold ${text}`}>
                              Masa telefonundan <span className="font-mono font-extrabold">*75*{currentUser?.extension || "1000"}*PIN</span> ile giriş, <span className="font-mono font-extrabold">*76</span> ile çıkış yapabilirsiniz.
                            </div>
                          </div>
                        </div>

                        {/* Active Hot-Desk Sessions */}
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white">
                              Açık Masa Telefonu Oturumlarım
                            </h5>
                            <span className="text-[10px] font-bold text-slate-400">
                              {agentHotdeskSessions.length > 0 ? `${agentHotdeskSessions.length} Aktif Telefon` : "Aktif Oturum Yok"}
                            </span>
                          </div>
                          {agentHotdeskSessions.length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              Şu anda herhangi bir ortak masa telefonunda açık Hot-Desk oturumunuz bulunmuyor.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {agentHotdeskSessions.map((sess) => (
                                <div
                                  key={sess.device_sip_username}
                                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800"
                                >
                                  <div>
                                    <div className="text-xs font-mono font-extrabold text-slate-800 dark:text-white">
                                      Cihaz: {sess.device_sip_username}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      Giriş Zamanı: {sess.logged_in_at || "-"}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={agentHotdeskLogoutBusy}
                                    onClick={async () => {
                                      setAgentHotdeskLogoutBusy(true);
                                      try {
                                        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                                        const res = await fetch(
                                          `${protocol}//${backendHost}/api/hotdesk/sessions/${encodeURIComponent(sess.device_sip_username)}`,
                                          { method: "DELETE" }
                                        );
                                        if (res.ok) {
                                          setAgentHotdeskSessions((prev) =>
                                            prev.filter((x) => x.device_sip_username !== sess.device_sip_username)
                                          );
                                          showNotification("Masa telefonu Hot-Desk oturumu kapatıldı.", "success", "Hot-Desking");
                                        }
                                      } finally {
                                        setAgentHotdeskLogoutBusy(false);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                                  >
                                    <LogOut size={13} />
                                    Oturumu Kapat
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-3 px-7 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelSettingsModal}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
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

                        const cleanSelfHotdeskPin = String(agentHotdeskConfig?.pin || "").replace(/\D/g, "").slice(0, 8);
                        if (agentHotdeskConfig?.enabled && !/^\d{4,8}$/.test(cleanSelfHotdeskPin)) {
                          setAgentHotdeskPinTouched(true);
                          setActiveModalTab("hotdesk");
                          showNotification("Hot-Desking aktifken 4 ile 8 haneli bir PIN şifresi belirlemelisiniz.", "error", "Hot-Desking");
                          return;
                        }
                        const normalizedSelfHotdesk = {
                          enabled: Boolean(agentHotdeskConfig?.enabled),
                          pin: cleanSelfHotdeskPin,
                          auto_logout_midnight: agentHotdeskConfig?.auto_logout_midnight !== false
                        };

                        stopRingtoneSound();
                        stopSpeakerTestSound();
                        stopMicLoopbackTest();
                        setIsPreviewingRingtone(false);
                        setIsTestingSpeaker(false);
                        localStorage.setItem("temp_playing", "false");
                        localStorage.setItem("agent_avatar", agentAvatar);
                        try {
                          if (currentUser?.id) localStorage.setItem(`agent_avatar_${currentUser.id}`, agentAvatar);
                          if (currentUser?.extension) localStorage.setItem(`agent_avatar_${currentUser.extension}`, agentAvatar);
                          const storedLoginId = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id");
                          if (storedLoginId) localStorage.setItem(`agent_avatar_${storedLoginId}`, agentAvatar);
                        } catch (e) {}
                        localStorage.setItem("ringtone", agentRingtone);
                        setSavedRingtoneVolume(ringtoneVolume);
                        localStorage.setItem("selected_mic", selectedMic);
                        localStorage.setItem("selected_speaker", selectedSpeaker);
                        localStorage.setItem("selected_ringtone_speaker", selectedRingtoneSpeaker);

                        const micObj = audioDevices.inputs.find((d) => d.deviceId === selectedMic);
                        if (micObj?.label) localStorage.setItem("selected_mic_label", micObj.label);
                        const spkObj = audioDevices.outputs.find((d) => d.deviceId === selectedSpeaker);
                        if (spkObj?.label) localStorage.setItem("selected_speaker_label", spkObj.label);
                        const ringSpkObj = audioDevices.outputs.find((d) => d.deviceId === selectedRingtoneSpeaker);
                        if (ringSpkObj?.label) localStorage.setItem("selected_ringtone_speaker_label", ringSpkObj.label);

                        const savedNoise = saveNoiseSuppressionMode(noiseSuppressionMode);
                        setNoiseSuppressionMode(savedNoise);
                        window.dispatchEvent(new CustomEvent("NOISE_MODE_UPDATED", { detail: { mode: savedNoise, silent: true } }));
                        window.dispatchEvent(new CustomEvent("AUDIO_DEVICES_UPDATED"));

                        if (desktopPrefs && typeof desktopPrefs === "object") {
                          localStorage.setItem(
                            "aida_desktop_notif_enabled",
                            desktopPrefs.osNotifications ? "true" : "false"
                          );
                          try {
                            const nextDp = await updateDesktopPrefs(desktopPrefs);
                            setDesktopPrefs(nextDp);
                          } catch (e) {}
                        }

                        const safeSavedColor = getSafeThemeColor(tempThemeColor);
                        document.documentElement.style.setProperty("--color-primary", safeSavedColor);
                        localStorage.setItem("theme_primary_color", safeSavedColor);
                        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
                        localStorage.setItem("agent_active_profile", agentActiveProfile);
                        applyDocumentMotionMode(normalizeUiMotionMode(callPanelPrefs?.uiMotionMode));
                        applyDocumentUiTemplate(normalizeUiTemplate(callPanelPrefs?.uiTemplate));

                        localStorage.setItem("auto_logout_enabled", autoLogoutEnabled ? "true" : "false");
                        localStorage.setItem("auto_logout_duration", autoLogoutDuration.toString());
                        localStorage.setItem("two_factor_enabled", twoFactorEnabled ? "true" : "false");
                        localStorage.setItem("password_expiry_enabled", passwordExpiryEnabled ? "true" : "false");
                        localStorage.setItem("password_expiry_months", passwordExpiryMonths.toString());
                        const savedPrefsSnapshot = saveCallPanelPrefs(currentUser, {
                          ...(callPanelPrefs || {}),
                          profileAvatar: agentAvatar
                        });
                        setCallPanelPrefs(savedPrefsSnapshot);
                        const cleanedGsmNumber = (gsmNumber || "").trim();
                        const resolvedProfActiveMethods =
                          twoFactorMultiMode === "single"
                            ? [twoFactorMethod || "google_auth"]
                            : Array.isArray(twoFactorActiveMethods) && twoFactorActiveMethods.length > 0
                              ? twoFactorActiveMethods
                              : [twoFactorMethod || "google_auth"];
                        const resolvedProfMultiMode =
                          resolvedProfActiveMethods.length <= 1
                            ? "single"
                            : twoFactorMultiMode === "any"
                              ? "any"
                              : "all";
                        const primaryProfSaveMethod = resolvedProfActiveMethods[0] || twoFactorMethod || "google_auth";
                        const localProfilePatch = {
                          avatar: agentAvatar,
                          call_panel_prefs: savedPrefsSnapshot,
                          gsm_number: cleanedGsmNumber,
                          follow_me: {
                            ...(currentUser?.follow_me && typeof currentUser.follow_me === "object" ? currentUser.follow_me : {}),
                            mobile_number: cleanedGsmNumber
                          },
                          two_factor_enabled: Boolean(twoFactorEnabled),
                          two_factor_method: primaryProfSaveMethod,
                          two_factor_active_methods: resolvedProfActiveMethods,
                          two_factor_multi_mode: resolvedProfMultiMode,
                          ...(twoFactorSecret ? { two_factor_secret: twoFactorSecret } : {}),
                          two_factor_enrolled: Boolean(twoFactorMethodsMap[primaryProfSaveMethod]?.enrolled ?? twoFactorEnrolled),
                          hotdesk_config: normalizedSelfHotdesk
                        };
                        setCurrentUser((prev) =>
                          prev
                            ? {
                                ...prev,
                                ...localProfilePatch
                              }
                            : prev
                        );
                        setSystemUsers((prev) =>
                          Array.isArray(prev)
                            ? prev.map((u) =>
                                (currentUser?.id && String(u.id) === String(currentUser.id)) ||
                                (currentUser?.extension && String(u.extension) === String(currentUser.extension))
                                  ? { ...u, ...localProfilePatch }
                                  : u
                              )
                            : prev
                        );

                        const wbUid = String(currentUser?.id || currentUser?.extension || "admin");
                        if (modalDraftWallboardLayout && typeof modalDraftWallboardLayout === "object") {
                          try {
                            localStorage.setItem(`wallboard_layout_${wbUid}`, JSON.stringify(modalDraftWallboardLayout));
                            window.dispatchEvent(new CustomEvent("wallboard-layout-updated", { detail: modalDraftWallboardLayout }));
                          } catch (e) {}
                        }

                        if (currentUser) {
                          try {
                            const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                            const mobileTransferPayload = hasMobileTransferPermission
                              ? { mobile_transfer_enabled: mobileTransferEnabled }
                              : {};
                            const wallboardPayload =
                              modalDraftWallboardLayout && typeof modalDraftWallboardLayout === "object"
                                ? { wallboard_layout: modalDraftWallboardLayout }
                                : {};
                            const profileUid = encodeURIComponent(
                              String(currentUser.id || currentUser.extension || "admin")
                            );
                            const activeProfSaveObj = agentProfiles.find(p => p.id === agentActiveProfile) || agentProfiles[0] || DEFAULT_USER_PROFILES[0];
                            const saveAlways = activeProfSaveObj.forwarding_always || { active: false, type: "internal", target: "" };
                            const saveBusy = activeProfSaveObj.forwarding_busy || { active: false, type: "internal", target: "" };
                            const saveNoAns = activeProfSaveObj.forwarding_no_answer || { active: false, type: "internal", target: "" };
                            const saveRingTimeout = Math.max(5, Math.min(120, parseInt(activeProfSaveObj.timeout, 10) || 30));
                            const res = await fetch(`${protocol}//${backendHost}/api/agent/profile/${profileUid}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                avatar: agentAvatar,
                                gsm_number: cleanedGsmNumber,
                                follow_me: {
                                  ...(currentUser.follow_me && typeof currentUser.follow_me === "object" ? currentUser.follow_me : {}),
                                  mobile_number: cleanedGsmNumber
                                },
                                ...mobileTransferPayload,
                                theme_color: safeSavedColor,
                                theme_mode: isDarkMode ? "dark" : "light",
                                forwarding_always: { active: Boolean(saveAlways.active && saveAlways.target), type: saveAlways.type || "internal", target: String(saveAlways.target || "").trim() },
                                forwarding_busy: { active: Boolean(saveBusy.active && saveBusy.target), type: saveBusy.type || "internal", target: String(saveBusy.target || "").trim() },
                                forwarding_no_answer: { active: Boolean(saveNoAns.active && saveNoAns.target), type: saveNoAns.type || "internal", target: String(saveNoAns.target || "").trim(), timeout: saveRingTimeout },
                                active_profile: agentActiveProfile,
                                profiles: agentProfiles,
                                hotdesk_config: normalizedSelfHotdesk,
                                call_panel_prefs: savedPrefsSnapshot,
                                ...wallboardPayload,
                                auto_logout_enabled: autoLogoutEnabled,
                                auto_logout_duration: autoLogoutDuration,
                                two_factor_enabled: twoFactorEnabled,
                                two_factor_method: primaryProfSaveMethod,
                                two_factor_active_methods: resolvedProfActiveMethods,
                                two_factor_multi_mode: resolvedProfMultiMode,
                                two_factor_secret:
                                  (primaryProfSaveMethod === "google_auth" || primaryProfSaveMethod === "microsoft_auth" || primaryProfSaveMethod === "app")
                                    ? ((twoFactorMethod === primaryProfSaveMethod ? twoFactorSecret : "") || twoFactorMethodsMap[primaryProfSaveMethod === "app" ? "google_auth" : primaryProfSaveMethod]?.secret || undefined)
                                    : undefined,
                                two_factor_enrolled: Boolean(twoFactorMethodsMap[primaryProfSaveMethod]?.enrolled ?? twoFactorEnrolled),
                                password_expiry_enabled: passwordExpiryEnabled,
                                password_expiry_months: passwordExpiryMonths,
                                ...passwordPayload
                              })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              try {
                                await fetch(`${protocol}//${backendHost}/api/auth/2fa/save-config`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    user_id: String(currentUser.id || currentUser.extension || "admin"),
                                    extension: currentUser.extension || "",
                                    email: currentUser.email || "",
                                    enabled: Boolean(twoFactorEnabled),
                                    method: primaryProfSaveMethod,
                                    active_methods: resolvedProfActiveMethods,
                                    multi_mode: resolvedProfMultiMode,
                                    phone: cleanedGsmNumber,
                                    secret:
                                      (primaryProfSaveMethod === "google_auth" || primaryProfSaveMethod === "microsoft_auth" || primaryProfSaveMethod === "app")
                                        ? ((twoFactorMethod === primaryProfSaveMethod ? twoFactorSecret : "") || twoFactorMethodsMap[primaryProfSaveMethod === "app" ? "google_auth" : primaryProfSaveMethod]?.secret || null)
                                        : null,
                                    secrets: {
                                      google_auth: (twoFactorMethod === "google_auth" ? twoFactorSecret : "") || twoFactorMethodsMap?.google_auth?.secret || "",
                                      microsoft_auth: (twoFactorMethod === "microsoft_auth" ? twoFactorSecret : "") || twoFactorMethodsMap?.microsoft_auth?.secret || ""
                                    },
                                    enrolled: Boolean(twoFactorMethodsMap[primaryProfSaveMethod]?.enrolled ?? twoFactorEnrolled)
                                  })
                                });
                              } catch (e2fa) {}
                              const serverTfMeta =
                                data.user?.call_panel_prefs?.twoFactorMeta &&
                                typeof data.user.call_panel_prefs.twoFactorMeta === "object"
                                  ? data.user.call_panel_prefs.twoFactorMeta
                                  : {
                                      enabled: Boolean(twoFactorEnabled),
                                      method: primaryProfSaveMethod,
                                      active_methods: resolvedProfActiveMethods,
                                      multi_mode: resolvedProfMultiMode,
                                      enrolled: Boolean(twoFactorMethodsMap[primaryProfSaveMethod]?.enrolled ?? twoFactorEnrolled),
                                      phone: cleanedGsmNumber,
                                      updatedTs: Date.now()
                                    };
                              const mergedSavedUser = {
                                ...(currentUser || {}),
                                ...localProfilePatch,
                                ...(data.user || {}),
                                two_factor_enabled: Boolean(twoFactorEnabled),
                                two_factor_method: primaryProfSaveMethod,
                                two_factor_active_methods: resolvedProfActiveMethods,
                                two_factor_multi_mode: resolvedProfMultiMode,
                                gsm_number: cleanedGsmNumber,
                                avatar: agentAvatar,
                                call_panel_prefs: {
                                  ...(data.user?.call_panel_prefs && typeof data.user.call_panel_prefs === "object" ? data.user.call_panel_prefs : {}),
                                  ...savedPrefsSnapshot,
                                  twoFactorMeta: serverTfMeta
                                },
                                ...(modalDraftWallboardLayout ? { wallboard_layout: modalDraftWallboardLayout } : {})
                              };
                              setCurrentUser(mergedSavedUser);
                              setSystemUsers((prev) =>
                                Array.isArray(prev)
                                  ? prev.map((u) =>
                                      (currentUser?.id && String(u.id) === String(currentUser.id)) ||
                                      (currentUser?.extension && String(u.extension) === String(currentUser.extension))
                                        ? { ...u, ...mergedSavedUser }
                                        : u
                                    )
                                  : prev
                              );
                              try {
                                const savedAuthLocal = localStorage.getItem("is_logged_in") === "true";
                                const storeUid = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id") || String(mergedSavedUser.id || "admin");
                                persistAuthenticatedSession(storeUid, savedAuthLocal, mergedSavedUser);
                              } catch (e) {}
                              if (newPassword) {
                                SUPER_ADMIN.password = newPassword;
                                updateRememberedPasswordIfSaved(newPassword);
                                showNotification("Şifreniz başarılı olarak güncellenmiştir.", "success", "Şifre Güncellendi");
                                setCurrentPassword("");
                                setNewPassword("");
                                setConfirmPassword("");
                                setPasswordStatusMsg({ type: "success", text: "Şifreniz başarılı olarak güncellenmiştir." });
                              }
                              // Force update the UI theme color if they changed it
                              if (data.user?.theme_color) {
                                const safeColor = getSafeThemeColor(data.user.theme_color);
                                document.documentElement.style.setProperty("--color-primary", safeColor);
                                localStorage.setItem("theme_primary_color", safeColor);
                              }
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              const errMsg = errData.detail || "Profil ayarları kaydedilemedi.";
                              const isPassAttempt = Boolean(newPassword || confirmPassword);
                              showNotification(
                                errMsg,
                                "error",
                                isPassAttempt ? "Şifre Güncellenemedi" : "Ayarlar Kaydedilemedi"
                              );
                              if (isPassAttempt) {
                                setPasswordStatusMsg({ type: "error", text: errMsg });
                                setActiveModalTab("security");
                              }
                              return;
                            }
                          } catch (err) {
                            console.error("Failed to save profile on backend:", err);
                            showNotification("Ayarlar kaydedilirken sunucu hatası oluştu.", "error", "Bağlantı Hatası");
                            return;
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
        {/* Global Customer 360° Unified Drawer */}
        {isLoggedIn && (
          <Customer360Drawer
            backendHost={backendHost}
            currentUser={currentUser}
            currentRolePermissions={currentRolePermissions}
            onNavigateTab={(targetTab, targetSubTab) => {
              setActiveTab(targetTab);
              if (targetTab === "call-center" && targetSubTab) {
                setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", {
                      detail: { subTab: targetSubTab }
                    })
                  );
                }, 60);
              }
            }}
          />
        )}

        {/* Global Customizable Keyboard Shortcuts Modal */}
        {isLoggedIn && isShortcutsModalOpen && (
          <KeyboardShortcutsModal
            isOpen={isShortcutsModalOpen}
            onClose={() => setIsShortcutsModalOpen(false)}
            customShortcuts={callPanelPrefs?.keyboardShortcuts || {}}
            onSaveShortcuts={(nextShortcuts) => {
              const current = loadCallPanelPrefs(currentUser);
              const next = saveCallPanelPrefs(currentUser, {
                ...current,
                keyboardShortcuts: nextShortcuts
              });
              setCallPanelPrefs(next);
              persistUserVisualPatch({ call_panel_prefs: next });
            }}
          />
        )}

        {/* Global License Verification & Renewal Modal */}
        {isLicenseModalOpen && (
          <LicenseModal
            isOpen={isLicenseModalOpen}
            onClose={() => setIsLicenseModalOpen(false)}
            backendHost={backendHost}
            onLicenseUpdated={() => fetchGlobalLicenseStatus()}
          />
        )}
      </main>
    </div>
  );
}
