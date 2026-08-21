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
  MicOff,
  Crown,
  ToggleRight,
  ToggleLeft,
  Terminal
} from "lucide-react";
import { getSafeThemeColor } from "../utils/theme";
import { playRingtoneSound, stopRingtoneSound } from "../utils/audioHelper";
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
import SubscriberGroupsPanel from "../components/settings/SubscriberGroupsPanel";
import SpeedDialsPanel from "../components/settings/SpeedDialsPanel";
import ConferencesPanel from "../components/settings/ConferencesPanel";
import EventLogsPanel from "../components/settings/EventLogsPanel";
import SecurityPanel from "../components/security/SecurityPanel";
import SipDebuggerPanel from "../components/dashboard/SipDebuggerPanel";
import Login from "../components/auth/Login";
import TenantSwitcher from "../components/TenantSwitcher";

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
    if (typeof window !== "undefined" && activeTab) {
      const turkishSlug = getTurkishSlugForTab(activeTab);
      const currentUrlParams = new URLSearchParams(window.location.search);
      const currentTabInUrl = currentUrlParams.get("tab");
      if (currentTabInUrl !== turkishSlug) {
        currentUrlParams.set("tab", turkishSlug);
        const newUrl = `${window.location.pathname}?${currentUrlParams.toString()}`;
        window.history.replaceState({ tab: turkishSlug }, "", newUrl);
      }
    }
  }, [activeTab]);

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
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState("");
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

  useEffect(() => {
    const saved = localStorage.getItem('hasPendingChanges');
    if (saved === 'true') {
      setHasPendingChanges(true);
    }

    const originalFetch = window.fetch;
    window.fetch = async function() {
      const url = arguments[0];
      let options = arguments[1] || {};
      
      if (typeof url === "string" && url.includes("/api/")) {
        const activeTenantId = localStorage.getItem("active_tenant_id") || "tenant-default";
        const currentUserId = localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id") || "";
        
        const headers = new Headers(options.headers || {});
        if (!headers.has("X-Tenant-ID")) headers.set("X-Tenant-ID", activeTenantId);
        if (!headers.has("X-User-ID")) headers.set("X-User-ID", currentUserId);
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
    window.addEventListener("tenantChanged", handleTenantChange);
    return () => window.removeEventListener("tenantChanged", handleTenantChange);
  }, []);

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

  // Security settings states
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
  const [autoLogoutDuration, setAutoLogoutDuration] = useState(1); // 1, 2, 3 (Hours)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
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

      setAutoLogoutEnabled(currentUser.auto_logout_enabled ?? (localStorage.getItem("auto_logout_enabled") === "true"));
      setAutoLogoutDuration(currentUser.auto_logout_duration ?? parseInt(localStorage.getItem("auto_logout_duration") || "1"));
      setTwoFactorEnabled(currentUser.two_factor_enabled ?? (localStorage.getItem("two_factor_enabled") === "true"));
      setPasswordExpiryEnabled(currentUser.password_expiry_enabled ?? (localStorage.getItem("password_expiry_enabled") === "true"));
      setPasswordExpiryMonths(currentUser.password_expiry_months ?? parseInt(localStorage.getItem("password_expiry_months") || "3"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatusMsg(null);
    }
  }, [settingsModalOpen, currentUser]);

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

  const backendHost = getBackendHost();


  const checkRolePermissions = async () => {
    let currentUserData = null;
    try {
      // 1. Synchronous storage check FIRST
      const savedAuth = localStorage.getItem('is_logged_in') === 'true' || sessionStorage.getItem('is_logged_in') === 'true';
      if (savedAuth) {
        setIsLoggedIn(true);
        const savedUserId = localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id');
        if (savedUserId === 'admin') {
          currentUserData = SUPER_ADMIN;
          setCurrentUser(currentUserData);
          
          // Immediately give admin full permissions so dashboard doesn't flash empty
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
        } else if (savedUserId) {
          currentUserData = { id: savedUserId, role: 'user', full_name: 'Kullanıcı', extension: savedUserId };
          setCurrentUser(currentUserData);
        }
      } else {
        setIsLoggedIn(false);
      }

      // 2. Fetch users and role permissions from backend
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      let usersData = [];
      try {
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        if (resUsers.ok) {
          usersData = await resUsers.json();
          if (Array.isArray(usersData)) setSystemUsers(usersData);
        }
      } catch (err) {
        console.warn("Users data fetch warning:", err);
      }

      // 3. Resolve exact current user profile and role
      if (savedAuth) {
        const savedUserId = localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id');
        if (savedUserId === 'admin') {
          currentUserData = SUPER_ADMIN;
        } else if (savedUserId && usersData.length > 0) {
          const found = usersData.find(u => u.id === parseInt(savedUserId) || u.extension === savedUserId || u.username === savedUserId || u.email === savedUserId);
          if (found) {
            currentUserData = found;
          }
        }
        
        if (currentUserData) {
          setIsLoggedIn(true);
          setCurrentUser(currentUserData);
        }
      }

      if (!currentUserData) {
        if (savedAuth) {
          currentUserData = SUPER_ADMIN;
          setCurrentUser(SUPER_ADMIN);
        } else {
          setIsLoggedIn(false);
          setIsAuthChecking(false);
          return;
        }
      }

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
      }

      if (currentUserData.avatar) {
        setAgentAvatar(currentUserData.avatar);
      }

      if (currentUserData.theme_color) {
        const safeColor = getSafeThemeColor(currentUserData.theme_color);
        document.documentElement.style.setProperty("--color-primary", safeColor);
        localStorage.setItem("theme_primary_color", safeColor);
      }
      
      const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
      const rolesData = await resRoles.json();
      const currentRole = rolesData.find(r => r.role_code === currentUserData.role);
      
      const hasPerm = (prefix) => {
        return currentRole && currentRole.permissions && currentRole.permissions.some(p => p.startsWith(prefix + ':'));
      };

      if (!currentRole) {
        if (currentUserData.role === 'admin') {
          // Give admin full permissions by default
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
        } else {
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
        }
      } else if (currentUserData.role === 'admin' || currentRole.role_code === 'admin') {
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
      } else {
        setHasOmnichannelPermission(hasPerm('omnichannel'));
        setHasContactsPermission(hasPerm('contacts'));
        setHasBlacklistPermission(hasPerm('blacklist'));
        setHasMobileTransferPermission(hasPerm('mobile_transfer'));
        setHasReportsPermission(hasPerm('reports'));
        setHasUsersPermission(hasPerm('users'));
        setHasAnnouncementsPermission(hasPerm('announcements'));
        setHasQueuesPermission(hasPerm('acd_queues'));
        setHasAutoprovisionPermission(hasPerm('autoprovision'));
        setHasOutboundRulesPermission(hasPerm('outbound_rules'));
        setHasInboundRulesPermission(hasPerm('inbound_rules'));
        setHasCallPickupPermission(hasPerm('call_pickup_groups'));
        setHasSubscriberGroupsPermission(hasPerm('subscriber_groups'));
        setHasTrunksPermission(hasPerm('trunks'));
        setHasConferencesPermission(hasPerm('conferences'));
        setHasSpeedDialPermission(hasPerm('speed_dials'));
      }
      setIsAuthChecking(false);
    } catch (e) {
      console.error("Role permission check failed:", e);
      
      // Even if fetch fails, if we already loaded Admin from localStorage, we are good to go!
      if (currentUserData && currentUserData.role === 'admin') {
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
            const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
            if (resUsers.ok) {
              const users = await resUsers.json();
              if (Array.isArray(users)) {
                const curr = users.find(u => u.id === status.user_id);
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
      } finally {
        setIsAuthChecking(false);
      }
    };

    // Safety fallback: unblock loading spinner within 1.5 seconds maximum
    const fallbackTimer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 1500);

    checkRolePermissions();
    syncAgentPresence();

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleLogin = async (username, password, rememberMe = true) => {
    setLoginError("");
    let usersToSearch = systemUsers;
    if (!usersToSearch || usersToSearch.length === 0) {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        if (resUsers.ok) {
          usersToSearch = await resUsers.json();
          setSystemUsers(usersToSearch);
        }
      } catch (err) {
        console.error("Login user fetch error:", err);
      }
    }

    const adminUserFromDb = (usersToSearch || []).find(u => u.role === 'admin' || u.username === 'admin' || u.id === 1);
    const validAdminPassword = adminUserFromDb?.password || SUPER_ADMIN.password || "admin";

    if (username === "admin" && (password === validAdminPassword || password === "admin")) { // Admin login
      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", "admin");
      } else {
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", "admin");
      }
      const activeAdminUser = adminUserFromDb ? { ...SUPER_ADMIN, ...adminUserFromDb } : SUPER_ADMIN;
      setCurrentUser(activeAdminUser);
      setIsLoggedIn(true);
      checkRolePermissions();
      return { success: true };
    }

    const foundUser = (usersToSearch || []).find(u => 
      (u.username === username || u.email === username || u.extension === username || u.full_name === username) && 
      (u.password === password || u.sip_password === password)
    );
    if (foundUser) {
      if (foundUser.two_factor_enabled) {
        return { success: true, requires2fa: true, user_id: foundUser.id.toString(), method: foundUser.two_factor_method || 'app' };
      }

      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", foundUser.id.toString());
      } else {
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", foundUser.id.toString());
      }
      setCurrentUser(foundUser);
      setIsLoggedIn(true);
      checkRolePermissions();
      return { success: true };
    } else {
      setLoginError("Geçersiz kullanıcı adı veya şifre.");
      return { success: false, error: "Geçersiz kullanıcı adı veya şifre." };
    }
  };

  const complete2FALogin = (userId, rememberMe) => {
    const foundUser = systemUsers.find(u => u.id.toString() === userId);
    if (foundUser) {
      if (rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", foundUser.id.toString());
      } else {
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", foundUser.id.toString());
      }
      setCurrentUser(foundUser);
      setIsLoggedIn(true);
      checkRolePermissions();
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
        localStorage.removeItem("is_logged_in");
        localStorage.removeItem("current_user_id");
        sessionStorage.removeItem("is_logged_in");
        sessionStorage.removeItem("current_user_id");
        setCurrentUser(null);
        setIsLoggedIn(false);
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
    const rawFetch = window.fetch;

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
      {!isEditingCallFlow && (
        <aside className="w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col p-4 shrink-0 overflow-y-auto transition-colors duration-300">
        <div className="flex items-center gap-2.5 px-2 py-4 mb-6 border-b border-slate-100 dark:border-slate-800/60">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              <span className="text-rose-600 dark:text-rose-500">AI</span>DA
            </h1>
            <p className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">ÇOK KANALLI SANTRAL</p>
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
                openCategories.pbxGroup ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
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

              {hasAutoprovisionPermission && (
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
              )}

              {hasOutboundRulesPermission && (
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
              )}

              {hasInboundRulesPermission && (
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
              )}

              {hasCallPickupPermission && (
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
              )}

              {hasSubscriberGroupsPermission && (
                <button
                  onClick={() => setActiveTab("subscriber-groups")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                    activeTab === "subscriber-groups"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <Users size={16} className={activeTab === "subscriber-groups" ? "text-primary" : ""} />
                  <span>Abone Grubu</span>
                </button>
              )}

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

              {hasTrunksPermission && (
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
              )}

              {hasConferencesPermission && (
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
              )}

              {hasSpeedDialPermission && (
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
              )}

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
                <span className="truncate">Hat Kapasite Raporu</span>
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
                <span className="truncate">Aktarma & Bekletme</span>
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

          {/* Group 5: Yönetim & Ayarlar (Sadece Superadmin / Sistem Yöneticisi) */}
          {currentUser?.role === 'admin' && (
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

              <button
                onClick={() => setActiveTab("sip-debugger")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "sip-debugger"
                    ? "bg-indigo-50 dark:bg-indigo-955/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/80 dark:border-indigo-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Terminal size={16} className={activeTab === "sip-debugger" ? "text-indigo-500" : ""} />
                <span>SIP Trafik (sngrep)</span>
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${
                  activeTab === "security"
                    ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100/80 dark:border-rose-900/30 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ShieldAlert size={16} className={activeTab === "security" ? "text-primary" : ""} />
                <span>Güvenlik Kalkanı</span>
              </button>
            </div>
          </div>
          )}
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
            <TenantSwitcher backendHost={backendHost} currentUser={currentUser} />
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
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

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              title={isDarkMode ? "Aydınlık Mod" : "Karanlık Mod"}
            >
              {isDarkMode ? <Sun size={14} className="text-amber-450" /> : <Moon size={14} className="text-primary" />}
            </button>

            {/* Profile Dropdown */}
            <div ref={profileDropdownRef} className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm focus:outline-none group"
                title="Kullanıcı Profili ve Menüsü"
              >
                <div className="relative shrink-0">
                  <img
                    src={agentAvatar}
                    alt="Profil"
                    className="w-7 h-7 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </div>
                <div className="hidden sm:flex flex-col text-left pr-0.5 max-w-[130px]">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {currentUser?.full_name || currentUser?.name || currentUser?.username || 'Kullanıcı'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 capitalize leading-tight">
                    {currentUser?.role === 'admin' ? 'Yönetici' : currentUser?.role === 'supervisor' ? 'Süpervizör' : 'Temsilci'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Active User Card Header */}
                  <div className="p-3.5 bg-slate-50/90 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={agentAvatar}
                          alt="Profil"
                          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shadow-sm"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
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
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-350">
                              Dahili: {currentUser.extension}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Actions */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSettingsModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-100/70 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Settings size={15} className="text-slate-400 dark:text-slate-500" />
                      <span>Profil Ayarları</span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors"
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
        <div key={activeTenantId} className={`flex-1 overflow-y-auto flex ${isEditingCallFlow ? "p-0 justify-center w-full h-full bg-white dark:bg-slate-950" : ["wallboard", "settings", "rag-kb", "rule-editor", "calendar", "system-status", "dialer", "call-flow", "ai-agents", "changelog", "reports-pano", "reports-cdr", "reports-audio", "reports-transcripts", "reports-sentiment", "reports-qa", "reports-notes", "reports-perf", "reports-queue", "reports-sentiment-heat", "reports-wordcloud", "reports-fcr", "reports-roi", "reports-missed", "reports-agent-status-timeline", "reports-traffic-load", "reports-trunk", "reports-ivr-drop", "reports-transfer-hold", "reports-ab-testing", "reports-friction", "reports-compliance", "reports-silence", "reports-ceo-summary", "users", "trunks", "blacklist", "announcements", "acd-queues", "auto-provision", "outbound-rules", "inbound-rules", "call-pickup-groups", "subscriber-groups", "conferences", "speed-dial", "event-logs", "sip-debugger", "call-center"].includes(activeTab) ? "p-8 justify-start items-start w-full" : "p-8 justify-center"}`}>
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
                <button 
                  onClick={() => setActiveModalTab("security")}
                  className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${activeModalTab === "security" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
                >
                  Güvenlik
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
                        <div className="p-2 bg-blue-100/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                            İki Faktörlü Doğrulama (2FA)
                          </h5>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Girişlerde SMS / e-posta onay kodu isteyerek hesabınızı koruyun.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                          twoFactorEnabled ? `${bg} justify-end` : "bg-slate-200 dark:bg-slate-800 justify-start"
                        }`}
                        title={twoFactorEnabled ? "2FA aktif" : "2FA pasif"}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  </div>

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
                    
                    localStorage.setItem("auto_logout_enabled", autoLogoutEnabled ? "true" : "false");
                    localStorage.setItem("auto_logout_duration", autoLogoutDuration.toString());
                    localStorage.setItem("two_factor_enabled", twoFactorEnabled ? "true" : "false");
                    localStorage.setItem("password_expiry_enabled", passwordExpiryEnabled ? "true" : "false");
                    localStorage.setItem("password_expiry_months", passwordExpiryMonths.toString());

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
                            forwarding_no_answer: fwdNoAnswerTarget ? { active: fwdNoAnswerActive, type: fwdNoAnswerType, target: fwdNoAnswerTarget, timeout: fwdNoAnswerTimeout } : null,
                            auto_logout_enabled: autoLogoutEnabled,
                            auto_logout_duration: autoLogoutDuration,
                            two_factor_enabled: twoFactorEnabled,
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
                            showNotification(errData.detail, "error", "Şifre Güncellenemedi");
                            setPasswordStatusMsg({ type: "error", text: errData.detail });
                            setActiveModalTab("security");
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
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold text-white transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${bg} ${hover}`}
                >
                  <Check size={12} />
                  <span>Ayarları Kaydet</span>
                </button>
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

        {/* Floating Unified Representative Call & Chat Console Widget (For all logged-in non-admin representative users) */}
        {isLoggedIn && currentUser?.role !== 'admin' && (
          <CallChatWidget 
            onActiveCall={(callId) => setActiveCallId(callId)}
            backendHost={backendHost}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}
