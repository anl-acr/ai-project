import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit2, X, User, Mail, Phone, Shield, Check, CheckCircle, ToggleLeft, ToggleRight, Search, Copy, RefreshCw, KeyRound, PhoneCall, Settings, Image as ImageIcon, Monitor, Smartphone, AlertTriangle, PhoneOutgoing, Users, Forward, Mic, MicOff, Download, Upload, Building2, Eye, EyeOff, Cable, ExternalLink, Database, Play, LayoutGrid, ChevronRight, Lock, Unlock, Terminal, Wifi, Cpu, ArrowUp, ArrowDown, Power, Sparkles, Layers, Sliders, Palette, Sun, Moon, Clock, Volume2, Square, BellRing, GripVertical, RotateCcw, List, PanelTop, Keyboard, Pin } from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import {
  useTheme,
  SYSTEM_THEME_PRESETS,
  SYSTEM_UI_TEMPLATES,
  getSafeThemeColor,
  rgbStringToHex,
  normalizeUiTemplate,
  applyDocumentUiTemplate
} from "../../utils/theme";
import { normalizeUiMotionMode, applyDocumentMotionMode } from "../../utils/uiMotion";
import { resolveEffectiveDarkMode, applyDocumentDarkClass } from "../../utils/themeSchedule";
import { playRingtoneSound, stopRingtoneSound, setSavedRingtoneVolume } from "../../utils/audioHelper";
import {
  ALL_TABS as CALL_PANEL_ALL_TABS,
  loadCallPanelPrefs,
  saveCallPanelPrefs,
  DEFAULT_CALL_PANEL_PREFS,
  DEFAULT_TOPBAR_PREFS,
  DEFAULT_TOPBAR_ZONES,
  normalizeTopbarPrefs
} from "../callcenter/AgentPanel";
import { CallPanelAgentsAppearanceSettings } from "../callcenter/tabs/AgentQueuePeersTab";
import { WallboardStudioSettings } from "../dashboard/WallboardPanel";
import KeyboardShortcutsModal from "../common/KeyboardShortcutsModal";
import SearchableSelect from "../ui/SearchableSelect";
import TablePagination from "../ui/TablePagination";
import BulkConfigPanel from "./BulkConfigPanel";
import UserApplicationsPanel from "./UserApplicationsPanel";

import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import { webphoneManager } from "../../utils/webphoneManager";
import {
  getDeviceKeySync,
  normalizeDeviceKey,
  extractUserDeviceSecurity
} from "../../utils/deviceIdentity";
import useClickOutside from "../../utils/useClickOutside";
import { PRESET_AVATARS, AVATAR_CATEGORIES, ALL_AVATAR_ITEMS } from "../../utils/avatarPresets";
import {
  DEFAULT_USER_PROFILES,
  RING_DEVICES_METADATA,
  normalizeUserProfiles
} from "../../utils/userProfileDefaults";
import {
  classifyRoleScope,
  getAllowedLandingScreensForRole,
  getAllowedAgentSubTabsForRole,
  isLandingTabAllowedForRole
} from "../../utils/landingPagePrefs";

export { DEFAULT_USER_PROFILES, RING_DEVICES_METADATA, normalizeUserProfiles };

const DEFAULT_TENANT_LIST = [
  { id: "tenant-default", name: "Ana Müşteri (Varsayılan)" },
  { id: "tenant-test-teknoloji", name: "Test Teknoloji" },
  { id: "tenant-nolto", name: "Nolto" }
];

const ANNOUNCEMENTS = [
  "Varsayılan Anons",
  "Kişisel Anons 1",
  "Mesai Dışı Anonsu"
];

const SIP_VENDOR_OUI_MAP = {
  "00:15:65": "Yealink",
  "80:5e:c0": "Yealink",
  "80:5e:0c": "Yealink",
  "24:9a:d8": "Yealink",
  "c4:fc:e4": "Yealink",
  "00:0b:82": "Grandstream",
  "c0:74:ad": "Grandstream",
  "ec:74:d7": "Grandstream",
  "0c:38:3e": "Fanvil",
  "00:a8:59": "Fanvil",
  "d0:7a:b5": "Fanvil",
  "00:04:13": "Snom",
  "00:08:5d": "Aastra",
  "00:0e:08": "Cisco",
  "68:bc:0c": "Cisco",
  "00:1b:d4": "Cisco",
  "7c:2f:80": "Gigaset"
};

const SIP_PHONE_MODELS = {
  Yealink: ["T31P", "T31G", "T33G", "T43U", "T46U", "T48U", "T54W", "T58W"],
  Fanvil: ["X3U", "X4U", "X5U", "X6U", "V62", "V64", "V65"],
  Grandstream: ["GRP2602", "GRP2612", "GRP2614", "GXP1625", "GXP2140", "GXP2170"],
  Snom: ["D315", "D385", "D717", "D735", "D785"],
  Cisco: ["SPA504G", "CP-7821", "CP-8841"],
  Gigaset: ["N510 IP PRO", "Maxwell 3"]
};

const AVAILABLE_SIP_CODECS = [
  { id: "g722", label: "G.722", desc: "HD Genişbant Ses (16 kHz)" },
  { id: "alaw", label: "G.711 A-Law (PCMA)", desc: "Türkiye / Avrupa Standart Kodek" },
  { id: "ulaw", label: "G.711 µ-Law (PCMU)", desc: "Standart Kayıpsız Ses" },
  { id: "opus", label: "Opus", desc: "Uyarlanabilir Genişbant Ses" },
  { id: "g729", label: "G.729", desc: "Düşük Bant Genişliği (8 kbps)" }
];

const DSS_KEY_TYPES = [
  { id: "blf", label: "BLF (Meşguliyet & Çağrı Çekme)" },
  { id: "line", label: "Hat (Line)" },
  { id: "speed_dial", label: "Hızlı Arama" },
  { id: "voicemail", label: "Sesli Mesaj" },
  { id: "dnd", label: "Rahatsız Etmeyin (DND)" },
  { id: "transfer", label: "Çağrı Aktar" }
];

const SOFTKEY_ACTIONS = [
  { id: "history", label: "Çağrı Geçmişi" },
  { id: "directory", label: "Rehber" },
  { id: "dnd", label: "Rahatsız Etme (DND)" },
  { id: "menu", label: "Menü" },
  { id: "redial", label: "Tekrar Ara" },
  { id: "transfer", label: "Aktar" },
  { id: "pickup", label: "Çağrı Çek (**)" }
];

const formatMacAddress = (raw) => {
  const hex = String(raw || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 12).toUpperCase();
  const pairs = hex.match(/.{1,2}/g) || [];
  return pairs.join(":");
};

const detectBrandByMac = (macStr) => {
  const clean = formatMacAddress(macStr).toLowerCase();
  if (clean.length >= 8) {
    const prefix = clean.slice(0, 8);
    if (SIP_VENDOR_OUI_MAP[prefix]) return SIP_VENDOR_OUI_MAP[prefix];
  }
  return null;
};

export default function UserSettings({ backendHost = "localhost:8000", currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const isAdmin = currentUser?.role === "admin";
  const canWrite = isAdmin || !Array.isArray(currentUser?.permissions) || currentUser.permissions.includes("users:write");
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState(DEFAULT_TENANT_LIST);
  const [userTenantId, setUserTenantId] = useState("tenant-default");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Columns filter
  const columnLabels = {
    status: "Durum",
    profile: "Profil",
    username: "Kullanıcı Adı",
    role: "Rol",
    email: "E-Posta Adresi",
    extension: "Dahili Numarası",
    recording: "Ses Kayıt",
    outboundRule: "Giden Kuralı",
    pickupGroup: "Çağrı Toplama Grubu",
    location: "Lokasyon",
    department: "Departman",
    tenant: "Müşteri / Tenant"
  };

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("users_visible_columns");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("visibleColumns parse error:", e);
        }
      }
    }
    return {
      status: true,
      profile: true,
      username: true,
      role: true,
      email: true,
      extension: true,
      recording: true,
      outboundRule: true,
      pickupGroup: true,
      location: true,
      department: true,
      tenant: true
    };
  });
  const [isColumnSelectOpen, setIsColumnSelectOpen] = useState(false);
  const columnSelectRef = useClickOutside(() => setIsColumnSelectOpen(false));

  const handleToggleColumn = (key) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        localStorage.setItem("users_visible_columns", JSON.stringify(updated));
      }
      return updated;
    });
  };
  
  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Modal / Popup States
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [announcementsList, setAnnouncementsList] = useState([]);

  // Basic Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [extension, setExtension] = useState("");
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [avatarCategoryFilter, setAvatarCategoryFilter] = useState("all");
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  // SIP Fields & Multi-Device (SIP Cihazları) States
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [maxActivations, setMaxActivations] = useState(1);
  const [maxConcurrentOutbound, setMaxConcurrentOutbound] = useState(0);
  const [outboundQuarantined, setOutboundQuarantined] = useState(false);
  const [outboundCallerId, setOutboundCallerId] = useState("");
  const [sipDevices, setSipDevices] = useState([]);

  // SIP Device Edit / Add Dialog States
  const sipDeviceEditDialogRef = useRef(null);
  const [isSipDeviceEditOpen, setIsSipDeviceEditOpen] = useState(false);
  const [sipDeviceFormMode, setSipDeviceFormMode] = useState("add"); // 'add' | 'edit'
  const [sipDeviceDraft, setSipDeviceDraft] = useState(null);
  const [showDraftSipPassword, setShowDraftSipPassword] = useState(false);
  const [copiedDeviceKey, setCopiedDeviceKey] = useState(null);
  const [sipDeviceDeleteTarget, setSipDeviceDeleteTarget] = useState(null);

  // SIP Device Inspector (Büyüteç) Dialog States
  const sipDeviceInspectDialogRef = useRef(null);
  const inspectTabRefs = useRef({});
  const [isSipDeviceInspectOpen, setIsSipDeviceInspectOpen] = useState(false);
  const [inspectTab, setInspectTab] = useState("overview"); // 'overview' | 'blf' | 'phone_settings' | 'pjsip'
  const [inspectDraft, setInspectDraft] = useState(null);
  const [inspectLiveInfo, setInspectLiveInfo] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectActionMsg, setInspectActionMsg] = useState(null);
  const [inspectSaving, setInspectSaving] = useState(false);

  // Forwarding Fields
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

  // Voicemail Fields
  const [voicemailActive, setVoicemailActive] = useState(false);
  const [voicemailAnnouncement, setVoicemailAnnouncement] = useState(ANNOUNCEMENTS[0]);
  const [voicemailPin, setVoicemailPin] = useState("");
  const [voicemailToEmail, setVoicemailToEmail] = useState(false);

  // Feature Fields
  const [recordingActive, setRecordingActive] = useState(false);
  const [transport, setTransport] = useState("UDP");
  const [bossSecretary, setBossSecretary] = useState({
    enabled: false,
    secretaries: [],
    vip_whitelist: []
  });
  const [newBossSecExt, setNewBossSecExt] = useState("");
  const [newBossVipExt, setNewBossVipExt] = useState("");

  // Hot-Desking Fields (Dedicated PIN + Midnight Auto-Logout)
  const [hotdeskConfig, setHotdeskConfig] = useState({
    enabled: false,
    pin: "",
    auto_logout_midnight: true
  });
  const [showHotdeskPin, setShowHotdeskPin] = useState(false);
  const [hotdeskPinTouched, setHotdeskPinTouched] = useState(false);
  const [activeHotdeskSessions, setActiveHotdeskSessions] = useState([]);
  const [hotdeskLogoutBusy, setHotdeskLogoutBusy] = useState(false);
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
  const modalScrollPaneRef = useRef(null);
  const twoFactorCardRef = useRef(null);
  const twoFactorSetupInFlightMethodRef = useRef(null);
  const activeTwoFactorMethodRef = useRef("google_auth");

  const buildUser2faMethodsMap = (u) => {
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

  const extractUser2faActiveConfig = (u, fallbackMethod = "google_auth") => {
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

  const scrollTwoFactorCardIntoPane = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        const pane = modalScrollPaneRef.current;
        const card = twoFactorCardRef.current;
        if (!pane || !card) return;
        const paneRect = pane.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const targetTop = pane.scrollTop + (cardRect.top - paneRect.top) - 16;
        pane.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }, 60);
    });
  };

  // Follow Me (Beni Takip Et) Fields
  const [followMeEnabled, setFollowMeEnabled] = useState(false);
  const [followMeTimeout, setFollowMeTimeout] = useState(15);
  const [followMeFirstTarget, setFollowMeFirstTarget] = useState("mobile_app");
  const [followMeSecondTarget, setFollowMeSecondTarget] = useState("mobile_number");
  const [followMeMobileNumber, setFollowMeMobileNumber] = useState("");

  // Profiles Fields (Müsait, Dışarıda, Toplantı, Diğer)
  const [activeProfile, setActiveProfile] = useState("available");
  const [userProfiles, setUserProfiles] = useState(() => normalizeUserProfiles(null));
  const [selectedProfileTab, setSelectedProfileTab] = useState("available");
  const [defaultLandingTab, setDefaultLandingTab] = useState("auto");
  const [defaultAgentSubTab, setDefaultAgentSubTab] = useState("auto");

  // Extended User Personal, Security, Audio, Theme & Layout Preferences (Admin-Configurable)
  const [themeColor, setThemeColor] = useState("225, 29, 72");
  const [themeMode, setThemeMode] = useState("light");
  const [mobileTransferEnabled, setMobileTransferEnabled] = useState(false);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
  const [autoLogoutDuration, setAutoLogoutDuration] = useState(1);
  const [passwordExpiryEnabled, setPasswordExpiryEnabled] = useState(false);
  const [passwordExpiryMonths, setPasswordExpiryMonths] = useState(3);
  const [userCallPanelPrefs, setUserCallPanelPrefs] = useState(() => ({
    ...DEFAULT_CALL_PANEL_PREFS,
    uiTemplate: "classic",
    uiMotionMode: "fluid",
    autoThemeConfig: { mode: "manual", darkStart: "19:00", darkEnd: "07:00" },
    autoOpenCustomer360OnCall: false,
    ringtone: "classic",
    ringtoneVolume: 0.85,
    noiseSuppressionMode: "ai",
    desktopPrefs: {
      osNotifications: true,
      popWindowOnCall: true,
      minimizeToTray: true,
      startOnBoot: false
    }
  }));
  const [userWallboardLayout, setUserWallboardLayout] = useState({});
  const [uiLayoutSubTab, setUiLayoutSubTab] = useState("call_panel");
  const [isPreviewingUserRingtone, setIsPreviewingUserRingtone] = useState(false);
  const [draggedUserPanelTabIdx, setDraggedUserPanelTabIdx] = useState(null);
  const [pinCatalogSearch, setPinCatalogSearch] = useState("");
  const [queuesList, setQueuesList] = useState([]);
  const [aiAgentsList, setAiAgentsList] = useState([]);

  const [systemRoles, setSystemRoles] = useState([]);

  // Associations Fields
  const [trunksList, setTrunksList] = useState([]);
  const [outboundRules, setOutboundRules] = useState([]);
  const [callPickupGroups, setCallPickupGroups] = useState([]);
  const [selectedOutboundRules, setSelectedOutboundRules] = useState([]);
  const [selectedCallPickupGroups, setSelectedCallPickupGroups] = useState([]);

  // Locations & Departments Fields
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  // Supervisor Management Filter Fields
  const [managedUsers, setManagedUsers] = useState([]);
  const [managedQueues, setManagedQueues] = useState([]);
  const [supFilterView, setSupFilterView] = useState("users"); // 'users' | 'queues'
  const [subscriberGroupsList, setSubscriberGroupsList] = useState([]);
  const [supUserSearch, setSupUserSearch] = useState("");
  const [supQueueSearch, setSupQueueSearch] = useState("");

  // CTI & CRM Integration Fields (Per Human Agent)
  const DEFAULT_CTI_CONFIG = {
    enabled: false,
    crm_name: "Müşteri CRM",
    preset: "custom",
    screen_pop_url: "",
    trigger_mode: "on_ring",
    open_mode: "new_tab",
    lookup_api_enabled: false,
    lookup_api_url: "",
    lookup_api_method: "GET",
    lookup_auth_type: "none",
    lookup_auth_header_name: "X-API-Key",
    lookup_auth_token: ""
  };
  const [ctiConfig, setCtiConfig] = useState(DEFAULT_CTI_CONFIG);
  const [ctiTestPhone, setCtiTestPhone] = useState("05321234567");
  const [ctiTesting, setCtiTesting] = useState(false);
  const [ctiTestResult, setCtiTestResult] = useState(null);

  // User Connection & Environment History (IP / Browser / OS changes) & Trusted Device Binding
  const [connHistoryList, setConnHistoryList] = useState([]);
  const [connHistoryPage, setConnHistoryPage] = useState(1);
  const [connHistoryPageSize, setConnHistoryPageSize] = useState(10);
  const [connHistoryLoading, setConnHistoryLoading] = useState(false);
  const [connHistoryLive, setConnHistoryLive] = useState(null);
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [newTrustedDeviceLabel, setNewTrustedDeviceLabel] = useState("");
  const [newTrustedDeviceKey, setNewTrustedDeviceKey] = useState("");
  const [trustedDeviceMsg, setTrustedDeviceMsg] = useState(null);
  const [trustedDeviceBusy, setTrustedDeviceBusy] = useState(false);
  const [adminLocalDeviceKey, setAdminLocalDeviceKey] = useState("");

  useEffect(() => {
    setAdminLocalDeviceKey(getDeviceKeySync());
  }, []);

  const safeFetch = async (path, options = {}) => {
    const apiBase = getApiBaseUrl(backendHost);
    const url = path.startsWith("http") ? path : `${apiBase}${path}`;
    return await tenantFetch(url, options);
  };

  const fetchUserConnectionHistory = async (targetUser) => {
    const uObj = targetUser || editingUser;
    const targetKey = uObj?.extension || uObj?.id;
    if (!targetKey) {
      setConnHistoryList([]);
      setConnHistoryLive(null);
      return;
    }
    setConnHistoryLoading(true);
    try {
      const res = await safeFetch(`/api/settings/users/${encodeURIComponent(String(targetKey))}/connection-history`);
      if (res.ok) {
        const data = await res.json();
        setConnHistoryList(Array.isArray(data?.history) ? data.history : []);
        setConnHistoryPage(1);
        setConnHistoryLive({
          is_online: Boolean(data?.is_online),
          current_ip: data?.current_ip || "",
          current_browser: data?.current_browser || "",
          current_os: data?.current_os || "",
          current_device_key: data?.current_device_key || "",
        });
        if (typeof data?.device_lock_enabled === "boolean") {
          setDeviceLockEnabled(data.device_lock_enabled);
        }
        if (Array.isArray(data?.trusted_devices)) {
          setTrustedDevices(data.trusted_devices);
        }
      }
    } catch (_) {
    } finally {
      setConnHistoryLoading(false);
    }
  };

  const syncUserTrustedDevicesInLocalState = (nextLockVal, nextDevicesList) => {
    if (!editingUser) return;
    const patch = {
      device_lock_enabled: Boolean(nextLockVal),
      trusted_devices: nextDevicesList,
      call_panel_prefs: {
        ...(editingUser.call_panel_prefs && typeof editingUser.call_panel_prefs === "object" ? editingUser.call_panel_prefs : {}),
        securityPolicy: {
          ...(editingUser.call_panel_prefs?.securityPolicy && typeof editingUser.call_panel_prefs.securityPolicy === "object"
            ? editingUser.call_panel_prefs.securityPolicy
            : {}),
          device_lock_enabled: Boolean(nextLockVal),
          trusted_devices: nextDevicesList,
        },
      },
    };
    setEditingUser((prev) => (prev ? { ...prev, ...patch } : prev));
    setUsers((prev) =>
      Array.isArray(prev)
        ? prev.map((u) =>
            (editingUser.id !== undefined && String(u.id) === String(editingUser.id)) ||
            (editingUser.extension && String(u.extension) === String(editingUser.extension))
              ? { ...u, ...patch }
              : u
          )
        : prev
    );
  };

  const handleToggleDeviceLock = async (nextLockVal) => {
    setDeviceLockEnabled(Boolean(nextLockVal));
    setTrustedDeviceMsg(null);
    const targetKey = editingUser?.extension || editingUser?.id;
    if (!targetKey) return;
    setTrustedDeviceBusy(true);
    try {
      const res = await safeFetch(`/api/settings/users/${encodeURIComponent(String(targetKey))}/trusted-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_lock",
          device_lock_enabled: Boolean(nextLockVal),
          trusted_devices: trustedDevices,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const savedLock = Boolean(data?.device_lock_enabled ?? nextLockVal);
        const savedList = Array.isArray(data?.trusted_devices) ? data.trusted_devices : trustedDevices;
        setDeviceLockEnabled(savedLock);
        setTrustedDevices(savedList);
        syncUserTrustedDevicesInLocalState(savedLock, savedList);
        setTrustedDeviceMsg({
          type: "success",
          text: savedLock
            ? "Güvenilir Cihaz Kilidi etkinleştirildi. Sadece listedeki cihazlar erişebilir."
            : "Güvenilir Cihaz Kilidi kapatıldı.",
        });
      }
    } catch (_) {
    } finally {
      setTrustedDeviceBusy(false);
    }
  };

  const handleAddTrustedDevice = async (arg1, arg2 = "", arg3 = "", arg4 = "", arg5 = "") => {
    const isObj = arg1 && typeof arg1 === "object";
    const key = isObj ? arg1.key : arg1;
    const label = isObj ? arg1.label : arg2;
    const browser = isObj ? (arg1.browser || "") : arg3;
    const os = isObj ? (arg1.os || "") : arg4;
    const ip_address = isObj ? (arg1.ip_address || "") : arg5;
    const normKey = normalizeDeviceKey(key);
    if (!normKey || normKey.length < 6) {
      setTrustedDeviceMsg({
        type: "error",
        text: "Lütfen geçerli bir Cihaz Anahtarı (Örn: AIDA-DEV-8F3A-91C4) giriniz.",
      });
      return;
    }
    if (trustedDevices.some((d) => normalizeDeviceKey(d.key) === normKey)) {
      setTrustedDeviceMsg({
        type: "info",
        text: `${normKey} zaten güvenilir cihaz listesinde kayıtlı.`,
      });
      return;
    }
    const cleanLabel = String(label || "").trim() || ([browser, os].filter(Boolean).join(" / ") ? `${[browser, os].filter(Boolean).join(" / ")}${ip_address ? ` (${ip_address})` : ""}` : `Güvenilir PC (${normKey.slice(-4)})`);
    const newItem = {
      key: normKey,
      label: cleanLabel,
      browser,
      os,
      ip_address,
      added_at: new Date().toISOString(),
    };
    const nextList = [...trustedDevices, newItem];
    setTrustedDevices(nextList);
    setNewTrustedDeviceKey("");
    setNewTrustedDeviceLabel("");
    setTrustedDeviceMsg(null);

    const targetKey = editingUser?.extension || editingUser?.id;
    if (!targetKey) {
      setTrustedDeviceMsg({
        type: "success",
        text: `${normKey} listeye eklendi (Kullanıcıyı kaydettiğinizde etkinleşecektir).`,
      });
      return;
    }
    setTrustedDeviceBusy(true);
    try {
      const res = await safeFetch(`/api/settings/users/${encodeURIComponent(String(targetKey))}/trusted-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          device_key: normKey,
          label: cleanLabel,
          browser,
          os,
          ip_address,
          device_lock_enabled: deviceLockEnabled,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const savedList = Array.isArray(data?.trusted_devices) ? data.trusted_devices : nextList;
        setTrustedDevices(savedList);
        syncUserTrustedDevicesInLocalState(deviceLockEnabled, savedList);
        setTrustedDeviceMsg({
          type: "success",
          text: `${cleanLabel} (${normKey}) güvenilir cihazlara eklendi.`,
        });
      }
    } catch (_) {
    } finally {
      setTrustedDeviceBusy(false);
    }
  };

  const handleRemoveTrustedDevice = async (rawKey) => {
    const normKey = normalizeDeviceKey(rawKey);
    const nextList = trustedDevices.filter((d) => normalizeDeviceKey(d.key) !== normKey);
    setTrustedDevices(nextList);
    setTrustedDeviceMsg(null);

    const targetKey = editingUser?.extension || editingUser?.id;
    if (!targetKey) return;
    setTrustedDeviceBusy(true);
    try {
      const res = await safeFetch(`/api/settings/users/${encodeURIComponent(String(targetKey))}/trusted-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          device_key: normKey,
          device_lock_enabled: deviceLockEnabled,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const savedList = Array.isArray(data?.trusted_devices) ? data.trusted_devices : nextList;
        setTrustedDevices(savedList);
        syncUserTrustedDevicesInLocalState(deviceLockEnabled, savedList);
        setTrustedDeviceMsg({
          type: "info",
          text: `${normKey} güvenilir cihaz listesinden çıkarıldı.`,
        });
      }
    } catch (_) {
    } finally {
      setTrustedDeviceBusy(false);
    }
  };

  useEffect(() => {
    if (showModal && activeTab === "connection_history" && editingUser) {
      fetchUserConnectionHistory(editingUser);
    }
  }, [showModal, activeTab, editingUser]);

  const saveInFlightRef = useRef(false);
  const lastSaveCompletedAtRef = useRef(0);

  useEffect(() => {
    fetchAllData(true);
    const handleTenantChange = () => {
      fetchAllData(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantChange);
    }
    const interval = setInterval(() => {
      if (saveInFlightRef.current || Date.now() - lastSaveCompletedAtRef.current < 2500) {
        return;
      }
      fetchAllData(false);
    }, 3000);
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("tenantChanged", handleTenantChange);
      }
    };
  }, [backendHost]);

  const fetchAllData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      try {
        const resUsers = await safeFetch(`/api/settings/users`);
        if (resUsers.ok && !saveInFlightRef.current) {
          const dataUsers = await resUsers.json();
          if (!saveInFlightRef.current) {
            setUsers(Array.isArray(dataUsers) ? dataUsers : (dataUsers?.users || []));
          }
        }
      } catch (e) {
        console.error("Users fetch error:", e);
      }

      try {
        const resTenants = await safeFetch(`/api/settings/tenants`);
        if (resTenants.ok) {
          const dataTenants = await resTenants.json();
          if (Array.isArray(dataTenants) && dataTenants.length > 0) {
            setTenants(dataTenants);
          }
        }
      } catch (e) {}

      try {
        const resRoles = await safeFetch(`/api/settings/roles`);
        if (resRoles.ok) {
          const dataRoles = await resRoles.json();
          setSystemRoles(Array.isArray(dataRoles) ? dataRoles : (dataRoles?.roles || []));
        }
      } catch (e) {}

      try {
        const resTrunks = await safeFetch(`/api/settings/trunks`);
        if (resTrunks.ok) {
          const dataTrunks = await resTrunks.json();
          setTrunksList(Array.isArray(dataTrunks) ? dataTrunks : (dataTrunks?.trunks || []));
        }
      } catch (e) {}

      try {
        const resOut = await safeFetch(`/api/settings/outbound_rules`);
        if (resOut.ok) {
          const dataOut = await resOut.json();
          setOutboundRules(Array.isArray(dataOut) ? dataOut : (dataOut?.outbound_rules || []));
        }
      } catch (e) {}

      try {
        const resGroups = await safeFetch(`/api/settings/call_pickup_groups`);
        if (resGroups.ok) {
          const dataGroups = await resGroups.json();
          setCallPickupGroups(Array.isArray(dataGroups) ? dataGroups : (dataGroups?.call_pickup_groups || []));
        }
      } catch (e) {}

      try {
        const resSubGroups = await safeFetch(`/api/settings/subscriber_groups`);
        if (resSubGroups.ok) {
          const dataSubGroups = await resSubGroups.json();
          setSubscriberGroupsList(Array.isArray(dataSubGroups) ? dataSubGroups : (dataSubGroups?.subscriber_groups || []));
        }
      } catch (e) {}

      try {
        const resLocs = await safeFetch(`/api/settings/locations`);
        if (resLocs.ok) {
          const dataLocs = await resLocs.json();
          setLocations(Array.isArray(dataLocs) ? dataLocs : (dataLocs?.locations || []));
        }
      } catch (e) {}

      try {
        const resDepts = await safeFetch(`/api/settings/departments`);
        if (resDepts.ok) {
          const dataDepts = await resDepts.json();
          setDepartments(Array.isArray(dataDepts) ? dataDepts : (dataDepts?.departments || []));
        }
      } catch (e) {}

      try {
        const resQueues = await safeFetch(`/api/settings/queues`);
        if (resQueues.ok) {
          const dataQueues = await resQueues.json();
          setQueuesList(Array.isArray(dataQueues) ? dataQueues : (dataQueues?.queues || []));
        }
      } catch (e) {}

      try {
        const resAgents = await safeFetch(`/api/settings/ai-agents`);
        if (resAgents.ok) {
          const dataAgents = await resAgents.json();
          setAiAgentsList(Array.isArray(dataAgents) ? dataAgents : (dataAgents?.ai_agents || []));
        }
      } catch (e) {}

      try {
        const resAnns = await safeFetch(`/api/settings/announcements`);
        if (resAnns.ok) {
          const dataAnns = await resAnns.json();
          setAnnouncementsList(Array.isArray(dataAnns) ? dataAnns : (dataAnns?.announcements || []));
        }
      } catch (e) {}

    } catch (err) {
      console.error(`Veriler yüklenemedi:`, err);
    } finally {
      setLoading(false);
    }
  };



  const fileInputRef = useRef(null);

  const handleExportExcel = () => {
    const data = users.map(u => ({
      "Ad Soyad": u.full_name || "",
      "Kullanıcı Adı / E-Posta": u.email || "",
      "Dahili Numara": u.extension || "",
      "Şifre": "", // Leave blank for security
      "Rol": systemRoles.find(r => r.role_code === u.role)?.name || u.role || "",
      "Aktif": u.is_active ? "Evet" : "Hayır",
      "Ses Kayıt": u.recording_active ? "Evet" : "Hayır",
      "Giden Kuralı": outboundRules.find(r => r.allowed_users?.includes(u.id))?.name || "",
      "Çağrı Toplama Grupları": callPickupGroups.filter(g => g.extensions?.includes(u.id)).map(g => g.name).join(", "),
      "Lokasyon": locations.find(l => String(l.id) === String(u.location_id))?.name || "",
      "Departman": departments.find(d => String(d.id) === String(u.department_id))?.name || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kullanıcılar");
    XLSX.writeFile(workbook, "Kullanicilar.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          const email = row["Kullanıcı Adı / E-Posta"];
          if (!email) continue; // Skip empty rows

          // Map names back to IDs/codes
          let role_code = "user";
          if (row["Rol"]) {
             const r = systemRoles.find(r => r.name.toLowerCase() === row["Rol"].toLowerCase());
             if (r) role_code = r.role_code;
          }
          
          let location_id = null;
          if (row["Lokasyon"]) {
             const l = locations.find(l => l.name.toLowerCase() === row["Lokasyon"].toLowerCase());
             if (l) location_id = l.id;
          }

          let department_id = null;
          if (row["Departman"]) {
             const d = departments.find(d => d.name.toLowerCase() === row["Departman"].toLowerCase());
             if (d) department_id = d.id;
          }

          const is_active = row["Aktif"] === "Evet";
          const recording_active = row["Ses Kayıt"] === "Evet";

          const payload = {
            full_name: row["Ad Soyad"] || "",
            email: email,
            role: role_code,
            extension: row["Dahili Numara"] ? String(row["Dahili Numara"]) : "",
            is_active: is_active,
            recording_active: recording_active,
            location_id: location_id,
            department_id: department_id
          };
          if (row["Şifre"]) {
             payload.password = String(row["Şifre"]);
          }

          const existingUser = users.find(u => u.email === email || (u.extension && u.extension === String(row["Dahili Numara"])));
          
          if (existingUser) {
             const res = await safeFetch(`/api/settings/users/${existingUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
             });
             if (res.ok) successCount++;
             else errorCount++;
          } else {
             if (!payload.password) payload.password = "123456"; // Default password
             const res = await safeFetch(`/api/settings/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
             });
             if (res.ok) successCount++;
             else errorCount++;
          }
        }

        setError(null);
        setSuccess(`İçe aktarma tamamlandı. ${successCount} başarılı, ${errorCount} hatalı kayıt.`);
        setTimeout(() => setSuccess(false), 5000);
        await fetchAllData();
      } catch (err) {
        console.error("Excel import error:", err);
        setError("Excel dosyası okunurken bir hata oluştu.");
        setTimeout(() => setError(null), 3000);
        setLoading(false);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (systemRoles.length > 0 && !systemRoles.find(r => r.role_code === role)) {
      setRole(systemRoles[0].role_code);
    }
  }, [systemRoles, role]);

  const [submitting, setSubmitting] = useState(false);

  const handleSaveAll = async (updatedUsers) => {
    setError(null);
    saveInFlightRef.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await safeFetch(`/api/settings/users`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify(updatedUsers),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        lastSaveCompletedAtRef.current = Date.now();
        if (data.users) setUsers(data.users);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        return true;
      } else {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        const rawDetail = errData?.detail;
        const errMsg = Array.isArray(rawDetail)
          ? rawDetail.map((d) => (typeof d === "string" ? d : d?.msg || JSON.stringify(d))).join(" | ")
          : typeof rawDetail === "object" && rawDetail !== null
          ? rawDetail.msg || JSON.stringify(rawDetail)
          : rawDetail || "Kullanıcı kaydedilirken bir hata oluştu.";
        setError(String(errMsg));
        return false;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Kullanıcı ayarları kaydedilemedi:", err);
      if (err.name === 'AbortError') {
        setError("Sunucu yanıt vermedi (Zaman aşımı). Lütfen sunucu bağlantınızı kontrol ediniz.");
      } else {
        setError("Bağlantı hatası oluştu.");
      }
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const generateSipUsernameStr = () => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const all = upper + lower + nums;
    const arr = [
      upper.charAt(Math.floor(Math.random() * upper.length)),
      lower.charAt(Math.floor(Math.random() * lower.length)),
      nums.charAt(Math.floor(Math.random() * nums.length))
    ];
    for (let i = 3; i < 8; i++) {
      arr.push(all.charAt(Math.floor(Math.random() * all.length)));
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join("");
  };

  const generateSipUsername = () => {
    setSipUsername(generateSipUsernameStr());
  };

  const copySipUsername = () => {
    navigator.clipboard.writeText(sipUsername);
  };

  const generateSipPasswordStr = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$*()";
    let pwd = "";
    for (let i = 0; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const generateSipPassword = () => {
    setSipPassword(generateSipPasswordStr());
  };

  const copySipPassword = () => {
    navigator.clipboard.writeText(sipPassword);
  };

  const copyTextWithFeedback = (val, feedbackKey) => {
    if (!val) return;
    navigator.clipboard.writeText(String(val));
    setCopiedDeviceKey(feedbackKey);
    setTimeout(() => {
      setCopiedDeviceKey((prev) => (prev === feedbackKey ? null : prev));
    }, 1800);
  };

  const createSipDeviceItem = (index = 1, overrides = {}) => {
    const isVirtualSub = overrides.device_type === "virtual_subscriber";
    const isWebPhone = overrides.device_type === "web_phone";
    return {
      id: overrides.id || (isWebPhone ? `dev-web-${Date.now()}` : `dev-${Date.now()}-${index}`),
      name: overrides.name || (isWebPhone ? "Web Telefonu" : isVirtualSub ? `Sanal Abone ${index}` : `Masa Telefonu ${index}`),
      device_type: overrides.device_type || "desk_phone",
      sip_username: isVirtualSub ? "" : (overrides.sip_username || generateSipUsernameStr()),
      sip_password: isVirtualSub ? "" : (overrides.sip_password || generateSipPasswordStr()),
      max_activations: isWebPhone
        ? (overrides.max_activations ? Math.max(1, Math.min(10, Number(overrides.max_activations))) : 5)
        : (overrides.max_activations ? Math.max(1, Math.min(5, Number(overrides.max_activations))) : 1),
      transport: isWebPhone ? "WSS" : (overrides.transport || "UDP"),
      is_active: overrides.is_active !== false,
      is_deletable: !isWebPhone,
      trunk: overrides.trunk || "",
      prefix: overrides.prefix !== undefined && overrides.prefix !== null ? String(overrides.prefix) : "",
      virtual_target_mode: overrides.virtual_target_mode === "custom" ? "custom" : "extension",
      custom_target: overrides.custom_target !== undefined && overrides.custom_target !== null ? String(overrides.custom_target) : "",
      is_virtual: Boolean(overrides.is_virtual || isVirtualSub),
      mac: isWebPhone ? "" : formatMacAddress(overrides.mac || ""),
      ip: overrides.ip || "",
      live_ip: overrides.live_ip || "",
      is_online: isVirtualSub ? Boolean(overrides.is_active !== false && overrides.trunk) : Boolean(overrides.is_online),
      brand: isWebPhone ? "" : (overrides.brand || "Yealink"),
      model: isWebPhone ? "" : (overrides.model || "T46U"),
      codecs: Array.isArray(overrides.codecs) && overrides.codecs.length > 0 ? [...overrides.codecs] : ["g722", "alaw", "ulaw", "g729"],
      dtmf_mode: overrides.dtmf_mode || "rfc4733",
      language: overrides.language || "Turkish",
      timezone: overrides.timezone || "+3",
      ntp_server: overrides.ntp_server || "pool.ntp.org",
      auto_answer: Boolean(overrides.auto_answer),
      direct_ip_call_block: overrides.direct_ip_call_block !== false,
      dss_keys: Array.isArray(overrides.dss_keys) ? overrides.dss_keys.map((k, idx) => ({ ...k, key: Number(k.key) || idx + 1 })) : [],
      soft_keys: Array.isArray(overrides.soft_keys) && overrides.soft_keys.length > 0
        ? overrides.soft_keys.map((sk, idx) => ({ ...sk, key: Number(sk.key) || idx + 1 }))
        : [
            { key: 1, type: "history", label: "Geçmiş" },
            { key: 2, type: "directory", label: "Rehber" },
            { key: 3, type: "dnd", label: "DND" },
            { key: 4, type: "menu", label: "Menü" }
          ]
    };
  };

  const ensureWebPhoneFirst = (list, uObj = null, fallbackExt = "") => {
    const safeList = Array.isArray(list) ? list : [];
    const extSeed = String(fallbackExt || uObj?.extension || uObj?.id || "1").trim();
    const existingWeb = safeList.find((d) => d && d.device_type === "web_phone");
    const others = safeList.filter((d) => d && d.device_type !== "web_phone");
    const webItem = existingWeb
      ? createSipDeviceItem(1, { ...existingWeb, device_type: "web_phone", transport: "WSS", is_deletable: false })
      : createSipDeviceItem(1, {
          id: `dev-web-${extSeed}`,
          name: "Web Telefonu",
          device_type: "web_phone",
          sip_username: generateSipUsernameStr(),
          sip_password: uObj?.sip_password || generateSipPasswordStr(),
          max_activations: 5,
          transport: "WSS",
          is_active: true,
          is_deletable: false
        });
    return [webItem, ...others];
  };

  const normalizeSipDevicesFromUser = (uObj) => {
    if (!uObj) return ensureWebPhoneFirst([createSipDeviceItem(2)]);
    let raw = uObj.sip_devices;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    const ctiObj = typeof uObj.cti_config === "object" && uObj.cti_config ? uObj.cti_config : {};
    if (Array.isArray(raw)) {
      if (raw.length === 0 && ctiObj.sip_devices_empty) {
        return ensureWebPhoneFirst([], uObj, uObj.extension);
      }
      if (raw.length > 0) {
        return ensureWebPhoneFirst(
          raw.map((d, idx) => createSipDeviceItem(idx + 1, d)),
          uObj,
          uObj.extension
        );
      }
    }
    return ensureWebPhoneFirst(
      [
        createSipDeviceItem(2, {
          id: `dev-${uObj.extension || uObj.id || "1"}-1`,
          name: "Masa Telefonu 1",
          device_type: "desk_phone",
          sip_username: uObj.sip_username || generateSipUsernameStr(),
          sip_password: uObj.sip_password || generateSipPasswordStr(),
          max_activations: uObj.max_activations || 1,
          transport: uObj.transport || "UDP",
          is_active: true
        })
      ],
      uObj,
      uObj.extension
    );
  };

  // Sync live online/IP badges on SIP Cihazları while the User Edit modal is open
  useEffect(() => {
    if (!showModal || !editingUser) return;
    const fresh = users.find((u) => u.id === editingUser.id || String(u.extension) === String(editingUser.extension));
    if (!fresh || !Array.isArray(fresh.sip_devices)) return;
    const byId = {};
    const bySu = {};
    fresh.sip_devices.forEach((fd) => {
      if (fd?.id) byId[fd.id] = fd;
      if (fd?.sip_username) bySu[fd.sip_username] = fd;
    });
    setSipDevices((prev) =>
      prev.map((d) => {
        const m = (d.id && byId[d.id]) || (d.sip_username && bySu[d.sip_username]);
        if (!m) return d;
        if (Boolean(d.is_online) === Boolean(m.is_online) && (d.live_ip || "") === (m.live_ip || "")) return d;
        return { ...d, is_online: Boolean(m.is_online), live_ip: m.live_ip || d.live_ip || "" };
      })
    );
  }, [users, showModal, editingUser]);

  // Manage native <dialog> showModal() / close() lifecycle for SIP Cihazı Edit & Büyüteç Inspector
  useEffect(() => {
    const dlg = sipDeviceEditDialogRef.current;
    if (!dlg) return;
    if (isSipDeviceEditOpen) {
      if (!dlg.open) {
        try { dlg.showModal(); } catch (e) {}
      }
    } else if (dlg.open) {
      try { dlg.close(); } catch (e) {}
    }
  }, [isSipDeviceEditOpen]);

  useEffect(() => {
    const dlg = sipDeviceInspectDialogRef.current;
    if (!dlg) return;
    if (isSipDeviceInspectOpen) {
      if (!dlg.open) {
        try { dlg.showModal(); } catch (e) {}
      }
    } else if (dlg.open) {
      try { dlg.close(); } catch (e) {}
    }
  }, [isSipDeviceInspectOpen]);

  const applyUpdatedSipDevices = async (nextDevices, persistImmediately = true) => {
    const orderedDevices = ensureWebPhoneFirst(nextDevices, editingUser, extension);
    setSipDevices(orderedDevices);
    const firstRealDev = orderedDevices.find((d) => d.device_type !== "virtual_subscriber" && d.device_type !== "web_phone") || null;
    if (firstRealDev) {
      setSipUsername(firstRealDev.sip_username || "");
      setSipPassword(firstRealDev.sip_password || "");
      setMaxActivations(Number(firstRealDev.max_activations) || 1);
      setTransport(firstRealDev.transport || "UDP");
    } else {
      setSipUsername("");
    }

    if (persistImmediately && editingUser && (editingUser.id || editingUser.extension)) {
      try {
        const {
          is_registered: _ir,
          sip_status: _ss,
          web_online: _wo,
          call_state: _cs,
          ip_address: _ip,
          client_browser: _cb,
          client_os: _cos,
          quarantine_details: _qd,
          ...cleanBaseUser
        } = editingUser;
        const safeDictOrNull = (val) => (val && typeof val === "object" && !Array.isArray(val) ? val : null);
        const targetExt = (extension || "").trim() || String(editingUser.extension || "").trim();
        const singlePayload = {
          ...cleanBaseUser,
          full_name: fullName.trim() || editingUser.full_name || "",
          email: email.trim() || editingUser.email || "",
          extension: targetExt,
          sip_username: firstRealDev?.sip_username || "",
          sip_password: firstRealDev?.sip_password || sipPassword,
          max_activations: Number(firstRealDev?.max_activations || maxActivations || 1),
          transport: firstRealDev?.transport || transport || "UDP",
          forwarding_always: safeDictOrNull(editingUser.forwarding_always),
          forwarding_busy: safeDictOrNull(editingUser.forwarding_busy),
          forwarding_no_answer: safeDictOrNull(editingUser.forwarding_no_answer),
          follow_me: safeDictOrNull(editingUser.follow_me),
          cti_config: safeDictOrNull(editingUser.cti_config) || {},
          call_panel_prefs: safeDictOrNull(editingUser.call_panel_prefs) || {},
          wallboard_layout: safeDictOrNull(editingUser.wallboard_layout) || {},
          sip_devices: orderedDevices
        };
        const res = await safeFetch("/api/settings/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": localStorage.getItem("current_user_id") || "admin"
          },
          body: JSON.stringify(singlePayload)
        });
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.users)) {
            setUsers(data.users);
            const savedMatch = data.users.find(
              (u) =>
                (editingUser.id !== undefined && editingUser.id !== null && String(u.id) === String(editingUser.id)) ||
                (targetExt && String(u.extension) === targetExt)
            );
            if (savedMatch) {
              setEditingUser((prev) => (prev ? { ...prev, ...savedMatch } : prev));
              if (Array.isArray(savedMatch.sip_devices)) {
                setSipDevices(
                  ensureWebPhoneFirst(
                    savedMatch.sip_devices.map((d, idx) => createSipDeviceItem(idx + 1, d)),
                    savedMatch,
                    savedMatch.extension
                  )
                );
              }
            }
          }
          if (
            targetExt &&
            webphoneManager?.state?.currentUser?.extension &&
            String(webphoneManager.state.currentUser.extension) === String(targetExt) &&
            typeof webphoneManager.reloadWebrtcConfig === "function"
          ) {
            webphoneManager.reloadWebrtcConfig();
          }
        } else if (res) {
          const errData = await res.json().catch(() => ({ detail: res.statusText }));
          const rawDetail = errData?.detail;
          const errMsg = Array.isArray(rawDetail)
            ? rawDetail.map((e) => e?.msg || JSON.stringify(e)).join(" | ")
            : typeof rawDetail === "string"
            ? rawDetail
            : `SIP cihazı kaydedilemedi (${res.status})`;
          setError(errMsg);
        }
      } catch (err) {
        console.warn("SIP cihazı anlık senkronizasyon uyarısı:", err);
        setError("SIP cihazı Asterisk'e kaydedilirken bağlantı hatası oluştu: " + (err?.message || ""));
      }
    }
  };

  const openSipDeviceAddModal = () => {
    const nonWebCount = sipDevices.filter((d) => d.device_type !== "web_phone").length;
    const nextIdx = nonWebCount + 1;
    setSipDeviceFormMode("add");
    setShowDraftSipPassword(false);
    setSipDeviceDraft(
      createSipDeviceItem(nextIdx, {
        name: nextIdx === 1 ? "Masa Telefonu 1" : `SIP Cihazı ${nextIdx}`,
        device_type: "desk_phone",
        sip_username: generateSipUsernameStr(),
        sip_password: generateSipPasswordStr(),
        max_activations: 1,
        transport: "UDP",
        is_active: true
      })
    );
    setIsSipDeviceEditOpen(true);
  };

  const openSipDeviceEditModal = (dev) => {
    setSipDeviceFormMode("edit");
    setShowDraftSipPassword(false);
    setSipDeviceDraft(createSipDeviceItem(1, dev));
    setIsSipDeviceEditOpen(true);
  };

  const handleSaveSipDeviceModal = async (e) => {
    if (e) e.preventDefault();
    if (!sipDeviceDraft) return;

    let normalizedItem = null;

    if (sipDeviceDraft.device_type === "virtual_subscriber") {
      const cleanTrunk = String(sipDeviceDraft.trunk || "").trim();
      if (!cleanTrunk) {
        setError("Lütfen sanal abonenin aranacağı SIP Trunk bağlantısını seçiniz.");
        return;
      }
      const vMode = sipDeviceDraft.virtual_target_mode === "custom" ? "custom" : "extension";
      const cleanPrefix = String(sipDeviceDraft.prefix || "").replace(/[^0-9a-zA-Z*#+_.-]/g, "").trim();
      const cleanCustomTarget = String(sipDeviceDraft.custom_target || "").replace(/[^0-9a-zA-Z*#+_.-]/g, "").trim();
      const extTrimmed = String(extension || editingUser?.extension || "").trim();

      if (vMode === "custom" && !cleanCustomTarget) {
        setError("Lütfen karşı santrale gönderilecek özel veriyi / hedef numarayı giriniz.");
        return;
      }
      if (vMode === "extension" && !extTrimmed && !cleanPrefix) {
        setError("Prefix + Dahili modunda karşı santrale gönderilecek hedef için önce Dahili Numarası tanımlanmalı veya Özel Veri modu seçilmelidir.");
        return;
      }

      normalizedItem = {
        ...sipDeviceDraft,
        name: (sipDeviceDraft.name || "").trim() || "Sanal Abone",
        device_type: "virtual_subscriber",
        sip_username: "",
        sip_password: "",
        trunk: cleanTrunk,
        prefix: cleanPrefix,
        virtual_target_mode: vMode,
        custom_target: cleanCustomTarget,
        is_virtual: true,
        is_deletable: true,
        is_active: sipDeviceDraft.is_active !== false,
        is_online: sipDeviceDraft.is_active !== false && Boolean(cleanTrunk)
      };
    } else {
      const isWeb = sipDeviceDraft.device_type === "web_phone";
      const cleanSu = String(sipDeviceDraft.sip_username || "").replace(/[^a-zA-Z0-9_.-]/g, "").trim();
      if (!cleanSu) {
        setError("Lütfen geçerli bir SIP Aktivasyon Kullanıcı Adı giriniz.");
        return;
      }
      if (/^\d+$/.test(cleanSu) || cleanSu === String(extension || "").trim()) {
        setError("Asterisk PJSIP üzerinde sayısal dahili oluşmaması için SIP Kullanıcı Adı tamamen rakamlardan oluşamaz; en az bir harf içermelidir.");
        return;
      }
      const dupInSelf = sipDevices.find(
        (d) => d.id !== sipDeviceDraft.id && d.device_type !== "virtual_subscriber" && String(d.sip_username).toLowerCase() === cleanSu.toLowerCase()
      );
      if (dupInSelf) {
        setError(`'${cleanSu}' kullanıcı adı bu abonenin '${dupInSelf.name}' cihazında zaten kullanılıyor.`);
        return;
      }
      const dupOtherUser = users.find((u) => {
        if (editingUser && ((editingUser.id !== undefined && String(u.id) === String(editingUser.id)) || (editingUser.extension && String(u.extension) === String(editingUser.extension)))) {
          return false;
        }
        if (String(u.extension || "").trim().toLowerCase() === cleanSu.toLowerCase()) return true;
        return Array.isArray(u.sip_devices) && u.sip_devices.some((od) => od?.device_type !== "virtual_subscriber" && String(od?.sip_username || "").trim().toLowerCase() === cleanSu.toLowerCase());
      });
      if (dupOtherUser) {
        setError(`'${cleanSu}' kullanıcı adı '${dupOtherUser.full_name || dupOtherUser.extension}' isimli kullanıcıda zaten tanımlı.`);
        return;
      }

      normalizedItem = {
        ...sipDeviceDraft,
        name: (sipDeviceDraft.name || "").trim() || (isWeb ? "Web Telefonu" : "SIP Cihazı"),
        device_type: isWeb ? "web_phone" : (sipDeviceDraft.device_type || "desk_phone"),
        sip_username: cleanSu,
        sip_password: (sipDeviceDraft.sip_password || "").trim() || generateSipPasswordStr(),
        max_activations: Math.max(1, Math.min(isWeb ? 10 : 5, Number(sipDeviceDraft.max_activations) || (isWeb ? 5 : 1))),
        transport: isWeb ? "WSS" : (sipDeviceDraft.transport || "UDP"),
        is_virtual: false,
        is_deletable: !isWeb,
        is_active: sipDeviceDraft.is_active !== false
      };
    }

    const rawNextList =
      sipDeviceFormMode === "add"
        ? [...sipDevices, normalizedItem]
        : sipDevices.map((d) => (d.id === normalizedItem.id ? { ...d, ...normalizedItem } : d));
    const nextList = ensureWebPhoneFirst(rawNextList, editingUser, extension);

    setIsSipDeviceEditOpen(false);
    await applyUpdatedSipDevices(nextList, true);
  };

  const confirmDeleteSipDevice = async () => {
    if (!sipDeviceDeleteTarget || sipDeviceDeleteTarget.device_type === "web_phone") {
      setSipDeviceDeleteTarget(null);
      return;
    }
    const nextList = sipDevices.filter((d) => d.id !== sipDeviceDeleteTarget.id);
    setSipDeviceDeleteTarget(null);
    await applyUpdatedSipDevices(nextList, true);
  };

  const fetchSipDeviceInspection = async (extVal, sipUserVal) => {
    const cleanExt = String(extVal || extension || "").trim();
    const cleanSu = String(sipUserVal || "").trim();
    if (!cleanExt || !cleanSu) return;
    setInspectLoading(true);
    try {
      const res = await safeFetch(
        `/api/settings/users/${encodeURIComponent(cleanExt)}/sip-devices/${encodeURIComponent(cleanSu)}/inspect`
      );
      if (res && res.ok) {
        const data = await res.json();
        setInspectLiveInfo(data);
      } else {
        setInspectLiveInfo({
          status: "info",
          pjsip: {
            found: false,
            endpoint: cleanSu,
            raw_output: "Kullanıcı henüz kaydedilmediği veya Asterisk PJSIP üzerinde oluşturulmadığı için canlı çıktı alınamadı."
          }
        });
      }
    } catch (err) {
      setInspectLiveInfo({
        status: "error",
        pjsip: {
          found: false,
          endpoint: cleanSu,
          raw_output: "Canlı PJSIP sorgusu başarısız: " + err.message
        }
      });
    } finally {
      setInspectLoading(false);
    }
  };

  const openSipDeviceInspectModal = (dev) => {
    const draftCopy = createSipDeviceItem(1, dev);
    setInspectDraft(draftCopy);
    setInspectTab("overview");
    setInspectActionMsg(null);
    setInspectLiveInfo(null);
    setIsSipDeviceInspectOpen(true);
    if (editingUser && extension) {
      fetchSipDeviceInspection(extension, draftCopy.sip_username);
    }
  };

  const handleApplyInspectChanges = async () => {
    if (!inspectDraft) return;
    setInspectSaving(true);
    setInspectActionMsg(null);
    try {
      const cleanedDraft = {
        ...inspectDraft,
        mac: formatMacAddress(inspectDraft.mac || ""),
        ip: String(inspectDraft.ip || "").trim(),
        codecs: Array.isArray(inspectDraft.codecs) && inspectDraft.codecs.length > 0 ? inspectDraft.codecs : ["g722", "alaw", "ulaw"]
      };
      const nextList = sipDevices.map((d) => (d.id === cleanedDraft.id ? { ...d, ...cleanedDraft } : d));
      await applyUpdatedSipDevices(nextList, true);
      if (editingUser && extension) {
        await fetchSipDeviceInspection(extension, cleanedDraft.sip_username);
      }
      setInspectActionMsg({
        type: "success",
        text: "Cihaz, BLF tuşları ve telefon ayarları güncellendi."
      });
    } catch (err) {
      setInspectActionMsg({
        type: "error",
        text: "Ayarlar kaydedilirken hata oluştu: " + err.message
      });
    } finally {
      setInspectSaving(false);
    }
  };

  const handleSendSipDeviceNotify = async (actionType = "check-sync") => {
    if (!inspectDraft || !extension) return;
    setInspectActionMsg(null);
    try {
      const res = await safeFetch(
        `/api/settings/users/${encodeURIComponent(extension.trim())}/sip-devices/${encodeURIComponent(inspectDraft.sip_username)}/notify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionType })
        }
      );
      const data = await res.json();
      setInspectActionMsg({
        type: data.ok ? "success" : "error",
        text: data.output || (actionType === "reboot" ? "Reboot komutu gönderildi." : "Check-Sync komutu gönderildi.")
      });
    } catch (err) {
      setInspectActionMsg({
        type: "error",
        text: "SIP NOTIFY gönderilemedi: " + err.message
      });
    }
  };

  const handleDownloadSipDeviceConfig = async () => {
    if (!inspectDraft || !extension) return;
    try {
      // Save current draft first if editing an existing user so downloaded config includes latest BLF & codecs
      if (editingUser) {
        const nextList = sipDevices.map((d) => (d.id === inspectDraft.id ? { ...d, ...inspectDraft } : d));
        await applyUpdatedSipDevices(nextList, true);
      }
      const res = await safeFetch(
        `/api/settings/users/${encodeURIComponent(extension.trim())}/sip-devices/${encodeURIComponent(inspectDraft.sip_username)}/config-file`
      );
      if (!res.ok) {
        setInspectActionMsg({ type: "error", text: "Konfigürasyon dosyası oluşturulamadı (Önce kullanıcıyı kaydedin)." });
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") || "";
      const fnMatch = disp.match(/filename="?([^"]+)"?/i);
      const filename = fnMatch ? fnMatch[1] : `${inspectDraft.sip_username}.cfg`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setInspectActionMsg({ type: "success", text: `${filename} başarıyla indirildi.` });
    } catch (err) {
      setInspectActionMsg({ type: "error", text: "İndirme hatası: " + err.message });
    }
  };

  const INSPECT_TABS_ORDER = ["overview", "blf", "phone_settings", "pjsip"];
  const handleInspectTabKeyDown = (e, currentTabId, tabIds = INSPECT_TABS_ORDER) => {
    const idx = tabIds.indexOf(currentTabId);
    if (idx === -1) return;
    let nextIdx = -1;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabIds.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabIds.length) % tabIds.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabIds.length - 1;
    if (nextIdx !== -1) {
      e.preventDefault();
      const nextId = tabIds[nextIdx];
      setInspectTab(nextId);
      const nextBtn = inspectTabRefs.current[nextId];
      if (nextBtn) nextBtn.focus();
    }
  };

  const copyTwoFactorSecret = () => {
    if (!twoFactorSecret) return;
    navigator.clipboard.writeText(twoFactorSecret);
    setTwoFactorSecretCopied(true);
    setTimeout(() => setTwoFactorSecretCopied(false), 2000);
  };

  const fetchTwoFactorSetup = async (resetSecret = false, overrideMethod = null, overrideSecret = null, overrideUserId = null, overrideEmail = null) => {
    const rawTarget = overrideMethod || twoFactorMethod || "google_auth";
    const targetMethod = rawTarget === "app" ? "google_auth" : rawTarget;
    if (targetMethod === "email" || targetMethod === "whatsapp") return;
    if (!resetSecret && twoFactorSetupInFlightMethodRef.current === targetMethod) return;
    twoFactorSetupInFlightMethodRef.current = targetMethod;
    setTwoFactorSetupLoading(true);
    if (resetSecret) setTwoFactorStatusMsg(null);
    try {
      const targetUid = overrideUserId !== null ? overrideUserId : (editingUser?.id || "preview");
      const targetEmail = (overrideEmail !== null ? overrideEmail : (email || editingUser?.email || "kullanici@aida.local")).trim() || "kullanici@aida.local";
      const isPreviewUid = String(targetUid).toLowerCase() === "preview";
      const existingSec = !resetSecret && isPreviewUid
        ? (overrideSecret !== null ? overrideSecret : (twoFactorMethodsMap[targetMethod]?.secret || ""))
        : "";
      const qs = new URLSearchParams({
        reset: resetSecret ? "true" : "false",
        method: targetMethod,
        email: targetEmail
      });
      if (existingSec) qs.set("secret", existingSec);
      const res = await safeFetch(`/api/auth/setup_2fa/${encodeURIComponent(String(targetUid))}?${qs.toString()}`);
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
        if (activeTwoFactorMethodRef.current === targetMethod) {
          setTwoFactorSecret(data.secret || "");
          setTwoFactorQrSvg(data.qr_svg || "");
          setTwoFactorEnrolled(resolvedEnrolled);
        }
        if (resetSecret) {
          setTwoFactorStatusMsg({
            type: "success",
            text: "Yeni kurulum anahtarı ve QR kod üretildi. Lütfen uygulamadan tekrar taratınız."
          });
        }
      } else {
        setTwoFactorStatusMsg({
          type: "error",
          text: data.detail || data.message || "2FA QR bilgisi alınamadı."
        });
      }
    } catch (err) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "2FA kurulum bilgisi alınırken hata oluştu: " + err.message
      });
    } finally {
      if (twoFactorSetupInFlightMethodRef.current === targetMethod) {
        twoFactorSetupInFlightMethodRef.current = null;
      }
      setTwoFactorSetupLoading(false);
    }
  };

  useEffect(() => {
    if (
      showModal &&
      twoFactorEnabled &&
      (twoFactorMethod === "google_auth" || twoFactorMethod === "microsoft_auth") &&
      !twoFactorQrSvg &&
      !twoFactorSetupLoading
    ) {
      fetchTwoFactorSetup(false, twoFactorMethod);
    }
  }, [showModal, twoFactorEnabled, twoFactorMethod]);

  const handleSendTestEmailOtp = async () => {
    const targetEmail = (email || editingUser?.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "Lütfen önce Genel sekmesinden geçerli bir E-Posta adresi giriniz."
      });
      return;
    }
    setTwoFactorEmailSending(true);
    setTwoFactorStatusMsg(null);
    try {
      const res = await safeFetch(`/api/auth/2fa/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(editingUser?.id || "preview"),
          email: targetEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorStatusMsg({
          type: "success",
          text: data.message || `6 haneli doğrulama kodu ${targetEmail} adresine gönderildi.`
        });
      } else {
        setTwoFactorStatusMsg({
          type: "error",
          text: data.detail || data.message || "E-Posta gönderilemedi. SMTP ayarlarınızı kontrol edin."
        });
      }
    } catch (err) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "E-Posta gönderim hatası: " + err.message
      });
    } finally {
      setTwoFactorEmailSending(false);
    }
  };

  const handleSendTestWhatsAppOtp = async () => {
    const targetPhone = (followMeMobileNumber || editingUser?.gsm_number || "").trim();
    const digits = targetPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "Lütfen geçerli bir Cep Telefonu (GSM) numarası giriniz (Örn: 0532 123 45 67)."
      });
      return;
    }
    setTwoFactorEmailSending(true);
    setTwoFactorStatusMsg(null);
    try {
      const res = await safeFetch(`/api/auth/2fa/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(editingUser?.id || "preview"),
          phone: targetPhone
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorEnabled(true);
        setTwoFactorMethod("whatsapp");
        const nextWaActive = twoFactorMultiMode === "single"
          ? ["whatsapp"]
          : (twoFactorActiveMethods.includes("whatsapp") ? twoFactorActiveMethods : [...twoFactorActiveMethods, "whatsapp"]);
        setTwoFactorActiveMethods(nextWaActive);
        if (editingUser && editingUser.id !== undefined) {
          const waPatch = {
            gsm_number: targetPhone,
            follow_me: {
              ...(editingUser.follow_me && typeof editingUser.follow_me === "object" ? editingUser.follow_me : {}),
              mobile_number: targetPhone
            },
            two_factor_enabled: true,
            two_factor_method: nextWaActive[0] || "whatsapp",
            two_factor_active_methods: nextWaActive,
            two_factor_multi_mode: nextWaActive.length > 1 ? twoFactorMultiMode : "single"
          };
          lastSaveCompletedAtRef.current = Date.now();
          setEditingUser((prev) => (prev ? { ...prev, ...waPatch } : prev));
          setUsers((prev) =>
            Array.isArray(prev)
              ? prev.map((u) => (String(u.id) === String(editingUser.id) ? { ...u, ...waPatch } : u))
              : prev
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("USER_PROFILE_SYNC", {
                detail: { userId: editingUser.id, extension: editingUser.extension, patch: waPatch }
              })
            );
          }
        }
        setTwoFactorStatusMsg({
          type: "success",
          text: data.message || "5 dakika geçerli 6 haneli WhatsApp doğrulama kodu oluşturuldu."
        });
      } else {
        setTwoFactorStatusMsg({
          type: "error",
          text: data.detail || data.message || "WhatsApp doğrulama kodu gönderilemedi."
        });
      }
    } catch (err) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "WhatsApp gönderim hatası: " + err.message
      });
    } finally {
      setTwoFactorEmailSending(false);
    }
  };

  const handleVerifyTest2faCode = async () => {
    const cleanCode = (twoFactorTestCode || "").replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz."
      });
      return;
    }
    setTwoFactorVerifyLoading(true);
    setTwoFactorStatusMsg(null);
    try {
      const res = await safeFetch(`/api/auth/verify_2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(editingUser?.id || "preview"),
          code: cleanCode,
          method: twoFactorMethod,
          secret: twoFactorSecret || undefined,
          phone: (followMeMobileNumber || editingUser?.gsm_number || "").trim() || undefined
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
        if (editingUser && editingUser.id !== undefined) {
          const targetPhone = (followMeMobileNumber || editingUser?.gsm_number || "").trim();
          const prevCppVer = editingUser.call_panel_prefs && typeof editingUser.call_panel_prefs === "object" ? editingUser.call_panel_prefs : {};
          const prevTfMetaVer = prevCppVer.twoFactorMeta && typeof prevCppVer.twoFactorMeta === "object" ? prevCppVer.twoFactorMeta : {};
          const nextVerActive = twoFactorMultiMode === "single"
            ? [verMethod]
            : (twoFactorActiveMethods.includes(verMethod) ? twoFactorActiveMethods : [...twoFactorActiveMethods, verMethod]);
          const nextVerMode = nextVerActive.length > 1 ? (twoFactorMultiMode === "any" ? "any" : "all") : "single";
          setTwoFactorActiveMethods(nextVerActive);
          const verPatch = {
            two_factor_enabled: true,
            two_factor_method: nextVerActive[0] || verMethod,
            two_factor_active_methods: nextVerActive,
            two_factor_multi_mode: nextVerMode,
            two_factor_enrolled: true,
            ...(twoFactorSecret ? { two_factor_secret: twoFactorSecret } : {}),
            ...(data.methods
              ? {
                  call_panel_prefs: {
                    ...prevCppVer,
                    twoFactorMeta: {
                      ...prevTfMetaVer,
                      enabled: true,
                      method: nextVerActive[0] || verMethod,
                      active_methods: nextVerActive,
                      multi_mode: nextVerMode,
                      enrolled: true,
                      ...(twoFactorSecret ? { secret: twoFactorSecret } : {}),
                      methods: data.methods,
                      updatedTs: Date.now()
                    }
                  }
                }
              : {}),
            ...(targetPhone
              ? {
                  gsm_number: targetPhone,
                  follow_me: {
                    ...(editingUser.follow_me && typeof editingUser.follow_me === "object" ? editingUser.follow_me : {}),
                    mobile_number: targetPhone
                  }
                }
              : {})
          };
          lastSaveCompletedAtRef.current = Date.now();
          setEditingUser((prev) => (prev ? { ...prev, ...verPatch } : prev));
          setUsers((prev) =>
            Array.isArray(prev)
              ? prev.map((u) => (String(u.id) === String(editingUser.id) ? { ...u, ...verPatch } : u))
              : prev
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("USER_PROFILE_SYNC", {
                detail: { userId: editingUser.id, extension: editingUser.extension, patch: verPatch }
              })
            );
          }
        }
        setTwoFactorStatusMsg({
          type: "success",
          text: data.message || "Doğrulama başarılı! 2FA yöntemi test edildi ve aktif olarak eşleştirildi."
        });
      } else {
        setTwoFactorStatusMsg({
          type: "error",
          text: data.detail || data.message || "Doğrulama kodu geçersiz veya süresi dolmuş."
        });
      }
    } catch (err) {
      setTwoFactorStatusMsg({
        type: "error",
        text: "Doğrulama hatası: " + err.message
      });
    } finally {
      setTwoFactorVerifyLoading(false);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setActiveTab("general");
    setUserTenantId(typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default");
    setFullName("");
    setEmail("");
    setExtension("");
    setAvatar(PRESET_AVATARS[0]);
    setRole(systemRoles.length > 0 ? systemRoles[0].role_code : "agent");
    setDefaultLandingTab("auto");
    setDefaultAgentSubTab("auto");
    setIsActive(true);
    setPassword("");
    setSipUsername("");
    setSipPassword("");
    setShowSipPassword(false);
    setMaxActivations(1);
    setMaxConcurrentOutbound(0);
    setOutboundQuarantined(false);
    setOutboundCallerId("");
    setSipDevices([]);
    setIsSipDeviceEditOpen(false);
    setIsSipDeviceInspectOpen(false);
    setSipDeviceDeleteTarget(null);

    setFwdAlwaysActive(false); setFwdAlwaysType("internal"); setFwdAlwaysTarget("");
    setFwdBusyActive(false); setFwdBusyType("internal"); setFwdBusyTarget("");
    setFwdNoAnswerActive(false); setFwdNoAnswerType("internal"); setFwdNoAnswerTarget(""); setFwdNoAnswerTimeout(30);

    setVoicemailActive(false); setVoicemailAnnouncement(ANNOUNCEMENTS[0]);
    setVoicemailPin(""); setVoicemailToEmail(false);

    setRecordingActive(false); setTransport("UDP");
    setTwoFactorEnabled(false);
    setTwoFactorMethod("google_auth");
    setTwoFactorActiveMethods(["google_auth"]);
    setTwoFactorMultiMode("single");
    activeTwoFactorMethodRef.current = "google_auth";
    setTwoFactorSecret("");
    setTwoFactorEnrolled(false);
    setTwoFactorQrSvg("");
    setTwoFactorMethodsMap({
      google_auth: { secret: "", qrSvg: "", enrolled: false },
      microsoft_auth: { secret: "", qrSvg: "", enrolled: false },
      whatsapp: { enrolled: false },
      email: { enrolled: false }
    });
    setTwoFactorTestCode("");
    setTwoFactorStatusMsg(null);

    setFollowMeEnabled(false);
    setFollowMeTimeout(15);
    setFollowMeFirstTarget("mobile_app");
    setFollowMeSecondTarget("mobile_number");
    setFollowMeMobileNumber("");

    setBossSecretary({ enabled: false, secretaries: [], vip_whitelist: [] });
    setNewBossSecExt("");
    setNewBossVipExt("");
    setHotdeskConfig({ enabled: false, pin: "", auto_logout_midnight: true });
    setShowHotdeskPin(false);
    setHotdeskPinTouched(false);
    setActiveHotdeskSessions([]);
    setHotdeskLogoutBusy(false);

    setSelectedOutboundRules([]);
    setSelectedCallPickupGroups([]);
    setSelectedLocation("");
    setSelectedDepartment("");
    setActiveProfile("available");
    setUserProfiles(normalizeUserProfiles(null));
    setSelectedProfileTab("available");
    setManagedUsers([]);
    setManagedQueues([]);
    setSupFilterView("users");
    setSupUserSearch("");
    setSupQueueSearch("");
    setCtiConfig(DEFAULT_CTI_CONFIG);
    setCtiTestResult(null);

    stopRingtoneSound();
    setIsPreviewingUserRingtone(false);
    setThemeColor("225, 29, 72");
    setThemeMode("light");
    setMobileTransferEnabled(false);
    setAutoLogoutEnabled(false);
    setAutoLogoutDuration(1);
    setPasswordExpiryEnabled(false);
    setPasswordExpiryMonths(3);
    setDeviceLockEnabled(false);
    setTrustedDevices([]);
    setNewTrustedDeviceLabel("");
    setNewTrustedDeviceKey("");
    setTrustedDeviceMsg(null);
    setUserCallPanelPrefs({
      ...DEFAULT_CALL_PANEL_PREFS,
      uiTemplate: "classic",
      uiMotionMode: "fluid",
      autoThemeConfig: { mode: "manual", darkStart: "19:00", darkEnd: "07:00" },
      autoOpenCustomer360OnCall: false,
      ringtone: "classic",
      ringtoneVolume: 0.85,
      noiseSuppressionMode: "ai",
      desktopPrefs: {
        osNotifications: true,
        popWindowOnCall: true,
        minimizeToTray: true,
        startOnBoot: false
      }
    });
    setUserWallboardLayout({});
    setUiLayoutSubTab("call_panel");
    setDraggedUserPanelTabIdx(null);
    setPinCatalogSearch("");
  };

  const getNextAvailableExtension = (targetTenantId = null) => {
    const allUsedSet = new Set(
      users
        .map((u) => String(u.extension || "").trim())
        .filter((ext) => /^\d+$/.test(ext))
        .map((ext) => parseInt(ext, 10))
    );

    const activeTenant = targetTenantId || userTenantId || "tenant-default";
    const tenantNumericExts = users
      .filter((u) => !u.tenant_id || u.tenant_id === activeTenant)
      .map((u) => String(u.extension || "").trim())
      .filter((ext) => /^\d+$/.test(ext))
      .map((ext) => parseInt(ext, 10))
      .filter((num) => num >= 100);

    const allNumericExts = Array.from(allUsedSet).filter((num) => num >= 100);
    const referenceExts = tenantNumericExts.length > 0 ? tenantNumericExts : allNumericExts;

    let candidate = 1000;
    if (referenceExts.length > 0) {
      const sorted = [...referenceExts].sort((a, b) => a - b);
      candidate = sorted[0];
      while (allUsedSet.has(candidate)) {
        candidate += 1;
      }
    } else {
      while (allUsedSet.has(candidate)) {
        candidate += 1;
      }
    }
    return String(candidate);
  };

  const openAddModal = () => {
    resetForm();
    const initialTenant = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    const nextExt = getNextAvailableExtension(initialTenant);
    const initWebSu = generateSipUsernameStr();
    const initSu = generateSipUsernameStr();
    const initPwd = generateSipPasswordStr();
    setExtension(nextExt);
    setSipUsername(initSu);
    setSipPassword(initPwd);
    setSipDevices([
      createSipDeviceItem(1, {
        id: `dev-web-${nextExt}`,
        name: "Web Telefonu",
        device_type: "web_phone",
        sip_username: initWebSu === initSu ? generateSipUsernameStr() : initWebSu,
        sip_password: initPwd,
        max_activations: 5,
        transport: "WSS",
        is_active: true,
        is_deletable: false
      }),
      createSipDeviceItem(2, {
        id: `dev-${nextExt}-1`,
        name: "Masa Telefonu 1",
        device_type: "desk_phone",
        sip_username: initSu,
        sip_password: initPwd,
        max_activations: 1,
        transport: "UDP",
        is_active: true
      })
    ]);
    setShowModal(true);
  };

  const checkIsUserActive = (userItem) => {
    if (!userItem) return false;
    const act = userItem.is_active;
    const st = userItem.status;
    if (act === false || act === "false" || act === 0) return false;
    if (st === "pasif" || st === "passive" || st === "inactive" || st === "offline") {
      if (act !== true && act !== "true" && act !== 1) return false;
    }
    if (typeof act === "string") {
      const lower = act.trim().toLowerCase();
      if (lower === "false" || lower === "pasif" || lower === "passive" || lower === "0") return false;
      if (lower === "true" || lower === "aktif" || lower === "active" || lower === "1") return true;
    }
    return act === true || act === 1 || (act !== false && act !== 0 && act !== "false");
  };

  const openEditModal = (u) => {
    resetForm();
    setEditingUser(u);
    setUserTenantId(u.tenant_id || "tenant-default");
    setFullName(u.full_name || "");
    setEmail(u.email || "");
    setExtension(u.extension || "");
    setAvatar(u?.call_panel_prefs?.profileAvatar || u.avatar || PRESET_AVATARS[0]);
    setRole(u.role || "agent");
    setDefaultLandingTab(u?.call_panel_prefs?.defaultLandingTab || "auto");
    setDefaultAgentSubTab(u?.call_panel_prefs?.defaultAgentSubTab || "auto");
    setIsActive(checkIsUserActive(u));
    setPassword(u.password || "");
    
    const resolvedDevices = normalizeSipDevicesFromUser(u);
    setSipDevices(resolvedDevices);
    const primaryDev = resolvedDevices.find((d) => d.device_type !== "virtual_subscriber" && d.device_type !== "web_phone") || null;
    const fallbackCredDev = primaryDev || resolvedDevices[0];
    setSipUsername(primaryDev?.sip_username || u.sip_username || "");
    setSipPassword(fallbackCredDev?.sip_password || u.sip_password || generateSipPasswordStr());
    setShowSipPassword(false);
    setMaxActivations(primaryDev?.max_activations || (u.max_activations ? Math.max(1, Math.min(5, Number(u.max_activations))) : 1));
    setMaxConcurrentOutbound(u.max_concurrent_outbound !== undefined && u.max_concurrent_outbound !== null ? Number(u.max_concurrent_outbound) : 0);
    setOutboundQuarantined(Boolean(u.outbound_quarantined));
    
    setOutboundCallerId(u.outbound_caller_id || "");

    const resolvedActiveProf = u.active_profile || "available";
    const normalizedProfiles = normalizeUserProfiles(u.profiles, u);
    const activeProfObj = normalizedProfiles.find((p) => p.id === resolvedActiveProf) || normalizedProfiles[0];
    const initAlways = activeProfObj?.forwarding_always || u.forwarding_always;
    const initBusy = activeProfObj?.forwarding_busy || u.forwarding_busy;
    const initNoAns = activeProfObj?.forwarding_no_answer || u.forwarding_no_answer;
    if (initAlways) { setFwdAlwaysActive(initAlways.active || false); setFwdAlwaysType(initAlways.type || "internal"); setFwdAlwaysTarget(initAlways.target || ""); }
    if (initBusy) { setFwdBusyActive(initBusy.active || false); setFwdBusyType(initBusy.type || "internal"); setFwdBusyTarget(initBusy.target || ""); }
    if (initNoAns) {
      setFwdNoAnswerActive(initNoAns.active || false);
      setFwdNoAnswerType(initNoAns.type || "internal");
      setFwdNoAnswerTarget(initNoAns.target || "");
      setFwdNoAnswerTimeout(activeProfObj?.timeout || u.forwarding_no_answer?.timeout || 30);
    } else {
      setFwdNoAnswerTimeout(activeProfObj?.timeout || 30);
    }

    setVoicemailActive(u.voicemail_active || false);
    setVoicemailAnnouncement(u.voicemail_announcement || ANNOUNCEMENTS[0]);
    setVoicemailPin(u.voicemail_pin || "");
    setVoicemailToEmail(u.voicemail_to_email || false);

    setRecordingActive(u.recording_active || false);
    setTransport(u.transport || "UDP");
    const tfMeta = u?.call_panel_prefs?.twoFactorMeta && typeof u.call_panel_prefs.twoFactorMeta === "object"
      ? u.call_panel_prefs.twoFactorMeta
      : null;
    const rawMethod = u.two_factor_method || tfMeta?.method;
    const normMethod = (!rawMethod || rawMethod === "app") ? "google_auth" : rawMethod;
    const resolved2faEnabled =
      typeof u.two_factor_enabled === "boolean"
        ? u.two_factor_enabled
        : Boolean(u.two_factor_enabled ?? tfMeta?.enabled ?? false);
    const initMethodsMap = buildUser2faMethodsMap(u);
    const { activeMethods: initActiveMethods, multiMode: initMultiMode } = extractUser2faActiveConfig(u, normMethod);
    const primaryFocusMethod = initActiveMethods[0] || normMethod;
    setTwoFactorEnabled(resolved2faEnabled);
    setTwoFactorActiveMethods(initActiveMethods);
    setTwoFactorMultiMode(initMultiMode);
    setTwoFactorMethod(primaryFocusMethod);
    activeTwoFactorMethodRef.current = primaryFocusMethod;
    setTwoFactorMethodsMap(initMethodsMap);
    setTwoFactorSecret(initMethodsMap[primaryFocusMethod]?.secret || "");
    setTwoFactorEnrolled(Boolean(initMethodsMap[primaryFocusMethod]?.enrolled));
    setTwoFactorQrSvg("");
    setTwoFactorTestCode("");
    setTwoFactorStatusMsg(null);

    let fmObj = u.follow_me;
    if (typeof fmObj === "string") {
      try { fmObj = JSON.parse(fmObj); } catch (e) { fmObj = null; }
    }
    if (fmObj && typeof fmObj === "object") {
      setFollowMeEnabled(Boolean(fmObj.enabled));
      setFollowMeTimeout(fmObj.timeout ? Math.max(5, Math.min(120, Number(fmObj.timeout))) : 15);
      setFollowMeFirstTarget(fmObj.first_target || "mobile_app");
      setFollowMeSecondTarget(fmObj.second_target || "mobile_number");
      setFollowMeMobileNumber(u.gsm_number || fmObj.mobile_number || "");
    } else {
      setFollowMeEnabled(false);
      setFollowMeTimeout(15);
      setFollowMeFirstTarget("mobile_app");
      setFollowMeSecondTarget("mobile_number");
      setFollowMeMobileNumber(u.gsm_number || "");
    }

    let bsObj = u.boss_secretary;
    if (typeof bsObj === "string") {
      try { bsObj = JSON.parse(bsObj); } catch (e) { bsObj = null; }
    }
    if (bsObj && typeof bsObj === "object") {
      setBossSecretary({
        enabled: Boolean(bsObj.enabled),
        secretaries: Array.isArray(bsObj.secretaries) ? bsObj.secretaries.map(String).filter(Boolean) : [],
        vip_whitelist: Array.isArray(bsObj.vip_whitelist) ? bsObj.vip_whitelist.map(String).filter(Boolean) : []
      });
    } else {
      setBossSecretary({ enabled: false, secretaries: [], vip_whitelist: [] });
    }
    setNewBossSecExt("");
    setNewBossVipExt("");

    let hdObj = u.hotdesk_config;
    if (typeof hdObj === "string") {
      try { hdObj = JSON.parse(hdObj); } catch (e) { hdObj = null; }
    }
    if (hdObj && typeof hdObj === "object") {
      setHotdeskConfig({
        enabled: Boolean(hdObj.enabled),
        pin: String(hdObj.pin || ""),
        auto_logout_midnight: hdObj.auto_logout_midnight !== false
      });
    } else {
      setHotdeskConfig({ enabled: false, pin: "", auto_logout_midnight: true });
    }
    setShowHotdeskPin(false);
    setHotdeskPinTouched(false);
    setActiveHotdeskSessions(Array.isArray(u.active_hotdesk_sessions) ? u.active_hotdesk_sessions : []);
    if (u.extension) {
      safeFetch(`/api/hotdesk/sessions?extension=${encodeURIComponent(u.extension)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && Array.isArray(d.sessions)) {
            setActiveHotdeskSessions(d.sessions);
          }
        })
        .catch(() => {});
    }

    const activeOutbound = outboundRules.filter(r => r.allowed_users && r.allowed_users.includes(u.id)).map(r => r.id);
    setSelectedOutboundRules(activeOutbound);
    
    const activePickup = callPickupGroups.filter(g => g.extensions && g.extensions.includes(u.id)).map(g => g.id);
    setSelectedCallPickupGroups(activePickup);

    setSelectedLocation(u.location_id || "");
    setSelectedDepartment(u.department_id || "");

    setActiveProfile(resolvedActiveProf);
    setSelectedProfileTab(resolvedActiveProf);
    setUserProfiles(normalizedProfiles);

    let parsedManagedUsers = u.managed_users;
    if (typeof parsedManagedUsers === "string") {
      try { parsedManagedUsers = JSON.parse(parsedManagedUsers); } catch (e) { parsedManagedUsers = []; }
    }
    setManagedUsers(Array.isArray(parsedManagedUsers) ? parsedManagedUsers.map(String) : []);

    let parsedManagedQueues = u.managed_queues;
    if (typeof parsedManagedQueues === "string") {
      try { parsedManagedQueues = JSON.parse(parsedManagedQueues); } catch (e) { parsedManagedQueues = []; }
    }
    setManagedQueues(Array.isArray(parsedManagedQueues) ? parsedManagedQueues.map(String) : []);

    let parsedCti = u.cti_config;
    if (typeof parsedCti === "string") {
      try { parsedCti = JSON.parse(parsedCti); } catch (e) { parsedCti = null; }
    }
    setCtiConfig({
      ...DEFAULT_CTI_CONFIG,
      ...(parsedCti && typeof parsedCti === "object" ? parsedCti : {})
    });
    setCtiTestResult(null);

    // Hydrate Extended Personal, Theme, Audio, Security & Layout Preferences
    let rawCpp = u.call_panel_prefs;
    if (typeof rawCpp === "string") {
      try { rawCpp = JSON.parse(rawCpp); } catch (e) { rawCpp = {}; }
    }
    const safeCpp = rawCpp && typeof rawCpp === "object" ? rawCpp : {};
    const secPol = safeCpp.securityPolicy && typeof safeCpp.securityPolicy === "object" ? safeCpp.securityPolicy : {};

    setThemeColor(getSafeThemeColor(u.theme_color || "rose"));
    setThemeMode(u.theme_mode === "dark" ? "dark" : "light");
    setMobileTransferEnabled(Boolean(u.mobile_transfer_enabled));
    setAutoLogoutEnabled(Boolean(u.auto_logout_enabled ?? secPol.auto_logout_enabled ?? false));
    setAutoLogoutDuration(Number(u.auto_logout_duration ?? secPol.auto_logout_duration ?? 1) || 1);
    setPasswordExpiryEnabled(Boolean(u.password_expiry_enabled ?? secPol.password_expiry_enabled ?? false));
    setPasswordExpiryMonths(Number(u.password_expiry_months ?? secPol.password_expiry_months ?? 3) || 3);

    const devSec = extractUserDeviceSecurity(u);
    setDeviceLockEnabled(Boolean(devSec.device_lock_enabled));
    setTrustedDevices(Array.isArray(devSec.trusted_devices) ? devSec.trusted_devices : []);
    setNewTrustedDeviceLabel("");
    setNewTrustedDeviceKey("");
    setTrustedDeviceMsg("");
    try { setAdminLocalDeviceKey(getDeviceKeySync()); } catch (e) {}

    const loadedBasePrefs = loadCallPanelPrefs(u);
    setUserCallPanelPrefs({
      ...DEFAULT_CALL_PANEL_PREFS,
      ...loadedBasePrefs,
      ...safeCpp,
      uiTemplate: normalizeUiTemplate(safeCpp.uiTemplate || loadedBasePrefs?.uiTemplate || "classic"),
      uiMotionMode: normalizeUiMotionMode(safeCpp.uiMotionMode || loadedBasePrefs?.uiMotionMode || "fluid"),
      autoThemeConfig: {
        mode: "manual",
        darkStart: "19:00",
        darkEnd: "07:00",
        ...(loadedBasePrefs?.autoThemeConfig || {}),
        ...(safeCpp.autoThemeConfig && typeof safeCpp.autoThemeConfig === "object" ? safeCpp.autoThemeConfig : {})
      },
      autoOpenCustomer360OnCall: Boolean(safeCpp.autoOpenCustomer360OnCall ?? loadedBasePrefs?.autoOpenCustomer360OnCall ?? false),
      topbar: normalizeTopbarPrefs(safeCpp.topbar || loadedBasePrefs?.topbar),
      keyboardShortcuts: safeCpp.keyboardShortcuts && typeof safeCpp.keyboardShortcuts === "object"
        ? safeCpp.keyboardShortcuts
        : (loadedBasePrefs?.keyboardShortcuts || {}),
      ringtone: String(safeCpp.ringtone || "classic"),
      ringtoneVolume: typeof safeCpp.ringtoneVolume === "number" ? Math.max(0.1, Math.min(1, safeCpp.ringtoneVolume)) : 0.85,
      noiseSuppressionMode: ["ai", "standard", "off"].includes(safeCpp.noiseSuppressionMode) ? safeCpp.noiseSuppressionMode : "ai",
      desktopPrefs: {
        osNotifications: true,
        popWindowOnCall: true,
        minimizeToTray: true,
        startOnBoot: false,
        ...(safeCpp.desktopPrefs && typeof safeCpp.desktopPrefs === "object" ? safeCpp.desktopPrefs : {})
      }
    });

    let rawWbLayout = u.wallboard_layout;
    if (typeof rawWbLayout === "string") {
      try { rawWbLayout = JSON.parse(rawWbLayout); } catch (e) { rawWbLayout = {}; }
    }
    setUserWallboardLayout(rawWbLayout && typeof rawWbLayout === "object" ? rawWbLayout : {});
    setUiLayoutSubTab("call_panel");

    setShowModal(true);
  };

  const syncUserAssociations = async (userId, isDelete = false) => {
    try {
      if (Array.isArray(outboundRules)) {
        for (let rule of outboundRules) {
          const wasInRule = rule.allowed_users && rule.allowed_users.includes(userId);
          const isInRule = !isDelete && selectedOutboundRules.includes(rule.id);
          
          if (wasInRule !== isInRule) {
            let newAllowed = [...(rule.allowed_users || [])];
            if (isInRule) newAllowed.push(userId);
            else newAllowed = newAllowed.filter(id => id !== userId);
            
            await safeFetch(`/api/settings/outbound_rules`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-User-ID": localStorage.getItem("current_user_id") || "admin"
              },
              body: JSON.stringify({ ...rule, allowed_users: newAllowed })
            });
          }
        }
      }

      if (Array.isArray(callPickupGroups)) {
        for (let group of callPickupGroups) {
          const wasInGroup = group.extensions && group.extensions.includes(userId);
          const isInGroup = !isDelete && selectedCallPickupGroups.includes(group.id);
          
          if (wasInGroup !== isInGroup) {
            let newExtensions = [...(group.extensions || [])];
            if (isInGroup) newExtensions.push(userId);
            else newExtensions = newExtensions.filter(id => id !== userId);
            
            await safeFetch(`/api/settings/call_pickup_groups`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-User-ID": localStorage.getItem("current_user_id") || "admin"
              },
              body: JSON.stringify({ ...group, extensions: newExtensions })
            });
          }
        }
      }
    } catch (e) {
      console.warn("syncUserAssociations warning:", e);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setActiveTab("general");
      setError("Lütfen Genel sekmesindeki Ad Soyad ve E-posta alanlarını doldurunuz.");
      return;
    }
    if (!extension.trim()) {
      setActiveTab("sip");
      setError("Lütfen SIP sekmesindeki Dahili Numarası (Extension) alanını doldurunuz.");
      return;
    }

    const extInput = extension.trim();
    const duplicateUser = users.find(
      (u) => String(u.extension).trim() === extInput && (!editingUser || u.id !== editingUser.id)
    );
    if (duplicateUser) {
      setError(`Bu dahili numara (${extInput}) zaten '${duplicateUser.full_name}' isimli kullanıcı tarafından kullanılıyor.`);
      return;
    }

    const cleanFmMobile = (followMeMobileNumber || "").trim();
    const cleanHotdeskPin = String(hotdeskConfig?.pin || "").replace(/\D/g, "").slice(0, 8);
    if (hotdeskConfig?.enabled && !/^\d{4,8}$/.test(cleanHotdeskPin)) {
      setHotdeskPinTouched(true);
      setActiveTab("features");
      setError("Ortak Masa Telefonu (Masa Paylaşımı) aktifken 4 ile 8 haneli sadece rakamlardan oluşan bir PIN şifresi belirlemelisiniz.");
      return;
    }

    const orderedSaveDevices = ensureWebPhoneFirst(sipDevices, editingUser, extInput);
    const primarySipDev = orderedSaveDevices.find((d) => d.device_type !== "virtual_subscriber" && d.device_type !== "web_phone") || null;
    const webSaveDev = orderedSaveDevices.find((d) => d.device_type === "web_phone") || null;
    const prevCallPanelPrefs =
      editingUser?.call_panel_prefs && typeof editingUser.call_panel_prefs === "object"
        ? editingUser.call_panel_prefs
        : {};
    const matchedSaveRole = systemRoles.find(
      (r) => String(r.role_code || "").toLowerCase() === String(role || "").toLowerCase()
    );
    const sanitizedLandingTab =
      defaultLandingTab === "auto" ||
      defaultLandingTab === "last_visited" ||
      isLandingTabAllowedForRole(defaultLandingTab, role, matchedSaveRole?.permissions)
        ? defaultLandingTab
        : "auto";

    const resolvedSaveActiveMethods =
      twoFactorMultiMode === "single"
        ? [twoFactorMethod || "google_auth"]
        : Array.isArray(twoFactorActiveMethods) && twoFactorActiveMethods.length > 0
          ? twoFactorActiveMethods
          : [twoFactorMethod || "google_auth"];
    const resolvedSaveMultiMode =
      resolvedSaveActiveMethods.length <= 1
        ? "single"
        : twoFactorMultiMode === "any"
          ? "any"
          : "all";
    const primarySave2faMethod = resolvedSaveActiveMethods[0] || twoFactorMethod || "google_auth";

    const sanitizedProfiles = (userProfiles || []).map((p) => ({
      ...p,
      timeout: Math.max(5, Math.min(120, Number(p.timeout) || 30)),
      timeout_action: "none",
      timeout_target: "",
      forwarding_always: {
        active: Boolean(p.forwarding_always?.active && String(p.forwarding_always?.target || "").trim()),
        type: p.forwarding_always?.type === "external" ? "external" : "internal",
        target: String(p.forwarding_always?.target || "").trim()
      },
      forwarding_busy: {
        active: Boolean(p.forwarding_busy?.active && String(p.forwarding_busy?.target || "").trim()),
        type: p.forwarding_busy?.type === "external" ? "external" : "internal",
        target: String(p.forwarding_busy?.target || "").trim()
      },
      forwarding_no_answer: {
        active: Boolean(p.forwarding_no_answer?.active && String(p.forwarding_no_answer?.target || "").trim()),
        type: p.forwarding_no_answer?.type === "external" ? "external" : "internal",
        target: String(p.forwarding_no_answer?.target || "").trim()
      }
    }));
    const activeSaveProfObj =
      sanitizedProfiles.find((p) => p.id === (activeProfile || "available")) ||
      sanitizedProfiles[0] ||
      {};

    // Yönlendirme Döngüsü (Forwarding Loop) ve Kendine Yönlendirme (Self-Forwarding) Kontrolü
    const getUserActiveForwardTargets = (u) => {
      if (!u) return [];
      const targets = new Set();
      const addRule = (r) => {
        if (!r) return;
        let parsed = r;
        if (typeof parsed === "string") {
          try { parsed = JSON.parse(parsed); } catch (e) { return; }
        }
        if (parsed && parsed.active && String(parsed.target || "").trim()) {
          targets.add(String(parsed.target || "").trim());
        }
      };
      addRule(u.forwarding_always);
      addRule(u.forwarding_busy);
      addRule(u.forwarding_no_answer);
      if (Array.isArray(u.profiles)) {
        const actId = u.active_profile || "available";
        const prof = u.profiles.find((pr) => pr.id === actId) || u.profiles[0];
        if (prof) {
          addRule(prof.forwarding_always);
          addRule(prof.forwarding_busy);
          addRule(prof.forwarding_no_answer);
        }
      }
      return Array.from(targets);
    };

    const fwdRuleLabels = {
      forwarding_always: "Her Zaman Yönlendir",
      forwarding_busy: "Meşgulde Yönlendir",
      forwarding_no_answer: "Cevapsızda Yönlendir"
    };

    for (const prof of sanitizedProfiles) {
      for (const ruleKey of ["forwarding_always", "forwarding_busy", "forwarding_no_answer"]) {
        const ruleObj = prof[ruleKey];
        if (!ruleObj || !ruleObj.active || !ruleObj.target) continue;
        const targetExt = String(ruleObj.target).trim();
        if (targetExt === extInput) {
          setActiveTab("forwarding");
          setError(`Yönlendirme Hatası (${prof.name || prof.id} - ${fwdRuleLabels[ruleKey]}): Bir abone (${extInput}) kendi dahili numarasına yönlendirilemez.`);
          return;
        }
        // Çok adımlı dairesel yönlendirme (Circular Loop: 1000 -> 1001 -> 1000) kontrolü
        const visitedChain = [extInput];
        let currExt = targetExt;
        for (let hop = 0; hop < 6; hop++) {
          if (visitedChain.includes(currExt)) {
            const loopStr = [...visitedChain, currExt].join(" ➔ ");
            setActiveTab("forwarding");
            setError(`Dairesel Yönlendirme Döngüsü Tespit Edildi (${loopStr}): ${targetExt} dahilisinin yönlendirme zinciri tekrar ${currExt} abonesine dönüyor. Sonsuz döngüyü önlemek için bu yönlendirme kaydedilemez.`);
            return;
          }
          visitedChain.push(currExt);
          const nextUser = (users || []).find(
            (u) => String(u.extension).trim() === currExt && (!editingUser || u.id !== editingUser.id)
          );
          if (!nextUser) break;
          const nextTargets = getUserActiveForwardTargets(nextUser);
          if (nextTargets.length === 0) break;
          const loopMatch = nextTargets.find((t) => visitedChain.includes(t));
          currExt = loopMatch || nextTargets[0];
        }
      }
    }

    const userData = {
      full_name: fullName.trim(),
      email: email.trim(),
      extension: extInput,
      avatar,
      role,
      is_active: isActive,
      tenant_id: userTenantId,
      password,
      sip_username: primarySipDev ? primarySipDev.sip_username : "",
      sip_password: primarySipDev?.sip_password || webSaveDev?.sip_password || sipPassword || generateSipPasswordStr(),
      max_activations: Number(primarySipDev?.max_activations || maxActivations) || 1,
      sip_devices: orderedSaveDevices,
      max_concurrent_outbound: Number.isNaN(Number(maxConcurrentOutbound)) ? 0 : Number(maxConcurrentOutbound),
      outbound_quarantined: Boolean(outboundQuarantined),
      outbound_caller_id: outboundCallerId.trim(),
      gsm_number: cleanFmMobile || "",
      forwarding_always: activeSaveProfObj.forwarding_always || { active: false, type: "internal", target: "" },
      forwarding_busy: activeSaveProfObj.forwarding_busy || { active: false, type: "internal", target: "" },
      forwarding_no_answer: {
        ...(activeSaveProfObj.forwarding_no_answer || { active: false, type: "internal", target: "" }),
        timeout: Number(activeSaveProfObj.timeout) || 30
      },
      voicemail_active: voicemailActive,
      voicemail_announcement: voicemailAnnouncement,
      voicemail_pin: voicemailPin,
      voicemail_to_email: voicemailToEmail,
      recording_active: recordingActive,
      transport: primarySipDev?.transport || transport || "UDP",
      two_factor_enabled: twoFactorEnabled,
      two_factor_method: primarySave2faMethod,
      two_factor_active_methods: resolvedSaveActiveMethods,
      two_factor_multi_mode: resolvedSaveMultiMode,
      two_factor_secret:
        (primarySave2faMethod === "google_auth" || primarySave2faMethod === "microsoft_auth" || primarySave2faMethod === "app")
          ? ((twoFactorMethod === primarySave2faMethod ? twoFactorSecret : "") || twoFactorMethodsMap[primarySave2faMethod === "app" ? "google_auth" : primarySave2faMethod]?.secret || null)
          : (twoFactorSecret || null),
      two_factor_enrolled: Boolean(twoFactorMethodsMap[primarySave2faMethod]?.enrolled ?? twoFactorEnrolled),
      follow_me: {
        enabled: Boolean(followMeEnabled),
        timeout: Math.max(5, Math.min(120, Number(followMeTimeout) || 15)),
        first_target: followMeFirstTarget || "mobile_app",
        second_target: followMeSecondTarget || "none",
        mobile_number: cleanFmMobile
      },
      boss_secretary: {
        enabled: Boolean(bossSecretary?.enabled),
        secretaries: Array.isArray(bossSecretary?.secretaries) ? bossSecretary.secretaries : [],
        vip_whitelist: Array.isArray(bossSecretary?.vip_whitelist) ? bossSecretary.vip_whitelist : []
      },
      hotdesk_config: {
        enabled: Boolean(hotdeskConfig?.enabled),
        pin: cleanHotdeskPin,
        auto_logout_midnight: hotdeskConfig?.auto_logout_midnight !== false
      },
      location_id: selectedLocation || null,
      department_id: selectedDepartment || null,
      active_profile: activeProfile || "available",
      profiles: sanitizedProfiles,
      theme_color: getSafeThemeColor(themeColor),
      theme_mode: themeMode === "dark" ? "dark" : "light",
      mobile_transfer_enabled: Boolean(mobileTransferEnabled),
      auto_logout_enabled: Boolean(autoLogoutEnabled),
      auto_logout_duration: Number(autoLogoutDuration) || 1,
      password_expiry_enabled: Boolean(passwordExpiryEnabled),
      password_expiry_months: Number(passwordExpiryMonths) || 3,
      device_lock_enabled: Boolean(deviceLockEnabled),
      trusted_devices: Array.isArray(trustedDevices) ? trustedDevices : [],
      wallboard_layout: userWallboardLayout && typeof userWallboardLayout === "object" ? userWallboardLayout : {},
      call_panel_prefs: {
        ...prevCallPanelPrefs,
        ...(userCallPanelPrefs && typeof userCallPanelPrefs === "object" ? userCallPanelPrefs : {}),
        defaultLandingTab: sanitizedLandingTab || "auto",
        defaultAgentSubTab: defaultAgentSubTab || "auto",
        profileAvatar: avatar || "",
        uiTemplate: normalizeUiTemplate(userCallPanelPrefs?.uiTemplate || prevCallPanelPrefs?.uiTemplate || "classic"),
        uiMotionMode: normalizeUiMotionMode(userCallPanelPrefs?.uiMotionMode || prevCallPanelPrefs?.uiMotionMode || "fluid"),
        topbar: normalizeTopbarPrefs(userCallPanelPrefs?.topbar || prevCallPanelPrefs?.topbar),
        securityPolicy: {
          auto_logout_enabled: Boolean(autoLogoutEnabled),
          auto_logout_duration: Number(autoLogoutDuration) || 1,
          password_expiry_enabled: Boolean(passwordExpiryEnabled),
          password_expiry_months: Number(passwordExpiryMonths) || 3,
          device_lock_enabled: Boolean(deviceLockEnabled),
          trusted_devices: Array.isArray(trustedDevices) ? trustedDevices : []
        }
      },
      managed_users: managedUsers,
      managed_queues: managedQueues,
      cti_config: ctiConfig
    };

    setSubmitting(true);
    let ok = false;
    let savedTargetId = editingUser?.id;
    try {
      if (editingUser) {
        // Edit mode
        const updated = users.map((u) => {
          const idMatches =
            editingUser.id !== undefined &&
            editingUser.id !== null &&
            String(u.id) === String(editingUser.id);
          const extMatches =
            !idMatches &&
            editingUser.extension &&
            String(u.extension) === String(editingUser.extension);
          if (idMatches || extMatches) {
            return { ...u, ...userData };
          }
          return u;
        });
        ok = await handleSaveAll(updated);
        if (ok) {
          await syncUserAssociations(editingUser.id);
        }
      } else {
        // Add mode
        const numericIds = users.map((u) => (Number.isFinite(Number(u.id)) ? Number(u.id) : 0));
        const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
        savedTargetId = nextId;
        const newUser = { id: nextId, ...userData };
        const updated = [...users, newUser];
        ok = await handleSaveAll(updated);
        if (ok) {
          await syncUserAssociations(newUser.id);
        }
      }

      if (ok) {
        try {
          const tfRes = await safeFetch("/api/auth/2fa/save-config", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": localStorage.getItem("current_user_id") || "admin"
            },
            body: JSON.stringify({
              user_id: savedTargetId ?? extInput ?? "admin",
              extension: extInput,
              email: email.trim(),
              enabled: Boolean(twoFactorEnabled),
              method: primarySave2faMethod,
              active_methods: resolvedSaveActiveMethods,
              multi_mode: resolvedSaveMultiMode,
              phone: cleanFmMobile,
              secret:
                (primarySave2faMethod === "google_auth" || primarySave2faMethod === "microsoft_auth" || primarySave2faMethod === "app")
                  ? ((twoFactorMethod === primarySave2faMethod ? twoFactorSecret : "") || twoFactorMethodsMap[primarySave2faMethod === "app" ? "google_auth" : primarySave2faMethod]?.secret || null)
                  : null,
              secrets: {
                google_auth: (twoFactorMethod === "google_auth" ? twoFactorSecret : "") || twoFactorMethodsMap?.google_auth?.secret || "",
                microsoft_auth: (twoFactorMethod === "microsoft_auth" ? twoFactorSecret : "") || twoFactorMethodsMap?.microsoft_auth?.secret || ""
              },
              enrolled: Boolean(twoFactorMethodsMap[primarySave2faMethod]?.enrolled ?? twoFactorEnrolled)
            })
          });
          if (tfRes.ok) {
            const tfData = await tfRes.json().catch(() => null);
            if (tfData?.user?.two_factor_secret && !userData.two_factor_secret) {
              userData.two_factor_secret = tfData.user.two_factor_secret;
            }
            if (tfData?.user?.call_panel_prefs) {
              userData.call_panel_prefs = {
                ...tfData.user.call_panel_prefs,
                ...userData.call_panel_prefs,
                twoFactorMeta: tfData.user.call_panel_prefs.twoFactorMeta || userData.call_panel_prefs?.twoFactorMeta
              };
            }
          }
        } catch (tfErr) {
          console.warn("Atomic 2FA save notice:", tfErr);
        }

        lastSaveCompletedAtRef.current = Date.now();
        setUsers((prev) =>
          Array.isArray(prev)
            ? prev.map((u) => {
                const matchById =
                  savedTargetId !== undefined &&
                  savedTargetId !== null &&
                  String(u.id) === String(savedTargetId);
                const matchByExt = extInput && String(u.extension) === String(extInput);
                return matchById || matchByExt
                    ? {
                        ...u,
                        ...userData,
                        two_factor_enabled: Boolean(twoFactorEnabled),
                        two_factor_method: primarySave2faMethod,
                        two_factor_active_methods: resolvedSaveActiveMethods,
                        two_factor_multi_mode: resolvedSaveMultiMode,
                        two_factor_enrolled: Boolean(twoFactorMethodsMap[primarySave2faMethod]?.enrolled ?? twoFactorEnrolled),
                        gsm_number: cleanFmMobile || ""
                      }
                  : u;
              })
            : prev
        );
      }
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      stopRingtoneSound();
      setIsPreviewingUserRingtone(false);
      if (typeof window !== "undefined") {
        try {
          saveCallPanelPrefs({ id: savedTargetId, extension: extInput }, userData.call_panel_prefs);
          if (userData.wallboard_layout && typeof userData.wallboard_layout === "object") {
            const wbKey = String(savedTargetId || extInput || "");
            if (wbKey) {
              localStorage.setItem(`wallboard_layout_${wbKey}`, JSON.stringify(userData.wallboard_layout));
            }
          }
        } catch (e) {}
      }
      if (editingUser && typeof window !== "undefined") {
        if (avatar) {
          window.dispatchEvent(
            new CustomEvent("USER_AVATAR_UPDATED", {
              detail: {
                userId: editingUser.id,
                extension: extInput,
                avatar
              }
            })
          );
        }
        window.dispatchEvent(
          new CustomEvent("USER_PROFILE_SYNC", {
            detail: {
              userId: editingUser.id,
              extension: extInput,
              patch: userData
            }
          })
        );
        if (
          extInput &&
          webphoneManager?.state?.currentUser?.extension &&
          String(webphoneManager.state.currentUser.extension) === String(extInput) &&
          typeof webphoneManager.reloadWebrtcConfig === "function"
        ) {
          webphoneManager.reloadWebrtcConfig();
        }
      }
      setShowModal(false);
    }
  };

  const handleQuickUnquarantineUser = async (extStr) => {
    if (!extStr) return;
    try {
      const res = await safeFetch("/api/security/unquarantine_subscriber", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({ extension: String(extStr) })
      });
      if (res && res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            String(u.extension) === String(extStr)
              ? { ...u, outbound_quarantined: false, quarantine_details: undefined }
              : u
          )
        );
        if (editingUser && String(editingUser.extension) === String(extStr)) {
          setOutboundQuarantined(false);
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Unquarantine subscriber error:", e);
    }
  };

  const handleQuickCancelForwarding = async (extStr, ruleType = "all") => {
    if (!extStr) return;
    try {
      const res = await safeFetch("/api/subscriber/cancel_forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: String(extStr), rule_type: ruleType })
      });
      if (res && res.ok) {
        const data = await res.json();
        const updates = data.updates || {};
        setUsers((prev) =>
          prev.map((u) => (String(u.extension) === String(extStr) ? { ...u, ...updates } : u))
        );
        if (editingUser && String(editingUser.extension) === String(extStr)) {
          if (ruleType === "all" || ruleType === "always") {
            setFwdAlwaysActive(false);
            setFwdAlwaysTarget("");
          }
          if (ruleType === "all" || ruleType === "busy") {
            setFwdBusyActive(false);
            setFwdBusyTarget("");
          }
          if (ruleType === "all" || ruleType === "no_answer") {
            setFwdNoAnswerActive(false);
            setFwdNoAnswerTarget("");
          }
          setUserProfiles((prev) =>
            (prev || []).map((p) => {
              if (p.id !== (activeProfile || "available")) return p;
              return {
                ...p,
                ...(ruleType === "all" || ruleType === "always"
                  ? { forwarding_always: { active: false, type: "internal", target: "" } }
                  : {}),
                ...(ruleType === "all" || ruleType === "busy"
                  ? { forwarding_busy: { active: false, type: "internal", target: "" } }
                  : {}),
                ...(ruleType === "all" || ruleType === "no_answer"
                  ? { forwarding_no_answer: { active: false, type: "internal", target: "" } }
                  : {})
              };
            })
          );
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Cancel forwarding error:", e);
    }
  };

  const handleDeleteUser = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteUser = async () => {
    if (deleteTargetId) {
      const filtered = users.filter((u) => u.id !== deleteTargetId);
      setUsers(filtered);
      await handleSaveAll(filtered);
      await syncUserAssociations(deleteTargetId, true);
      setDeleteTargetId(null);
    }
  };

  const toggleUserActive = async (userItem) => {
    const currentActive = checkIsUserActive(userItem);
    const newActiveState = !currentActive;
    const updated = users.map((u) => {
      if (u.id === userItem.id) {
        return { ...u, is_active: newActiveState, status: newActiveState ? "active" : "pasif" };
      }
      return u;
    });
    setUsers(updated);
    try {
      await safeFetch(`/api/settings/users/${userItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userItem,
          is_active: newActiveState,
          status: newActiveState ? "active" : "pasif"
        })
      });
    } catch (e) {
      console.error("User status update error:", e);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (u.username === "admin") return false; // Hide admin from list
    const query = searchQuery.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.extension || "").includes(query)
    );
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkConfigModal, setShowBulkConfigModal] = useState(false);
  const [bulkQuickBusy, setBulkQuickBusy] = useState(false);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSelectUser = (userId) => {
    const idStr = String(userId);
    setSelectedUserIds((prev) =>
      prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
    );
  };

  const toggleSelectAllUsers = () => {
    const allIds = filteredUsers.map((u) => String(u.id));
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(allIds);
    }
  };

  const handleQuickBulkUserAction = async (changesObj) => {
    if (selectedUserIds.length === 0 || bulkQuickBusy) return;
    setBulkQuickBusy(true);
    try {
      const res = await safeFetch("/api/settings/bulk-config/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify({
          module: "users",
          target_mode: "selected",
          target_ids: selectedUserIds,
          changes: changesObj
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await fetchUsers(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Toplu işlem uygulanırken hata oluştu.");
      }
    } catch (e) {
      setError("Toplu işlem sırasında sunucu hatası oluştu.");
    } finally {
      setBulkQuickBusy(false);
    }
  };

  const renderForwardingRow = (label, active, setActive, type, setType, target, setTarget) => (
    <div className={`grid grid-cols-12 gap-3 items-end p-3 rounded-xl border transition-all ${active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 opacity-70'}`}>
        <div className="col-span-12 flex items-center justify-between mb-1 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <label className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{label}</label>
            <button type="button" onClick={() => setActive(!active)} className="text-slate-400 hover:text-slate-700 transition-colors">
                {active ? <ToggleRight size={24} className={text} /> : <ToggleLeft size={24} />}
            </button>
        </div>
        <div className="col-span-12 sm:col-span-4">
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
        <div className="col-span-12 sm:col-span-8">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Hedef</label>
            {type === "internal" ? (
                <SearchableSelect
                    disabled={!active}
                    value={target}
                    onChange={setTarget}
                    options={users.map(u => ({ value: u.extension, label: `${u.full_name} (${u.extension})` }))}
                />
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
    </div>
  );

  const selectedRoleObj = (Array.isArray(systemRoles) ? systemRoles : []).find(
    (r) => String(r.role_code || "").toLowerCase() === String(role || "").toLowerCase()
  );
  const selectedRolePerms = Array.isArray(selectedRoleObj?.permissions) ? selectedRoleObj.permissions : [];
  const hasSupervisorPerm =
    String(role || "").toLowerCase() === "supervisor" ||
    selectedRolePerms.some((p) => String(p || "").startsWith("supervisor"));

  const currentAdminRoleObj = (Array.isArray(systemRoles) ? systemRoles : []).find(
    (r) => String(r.role_code || "").toLowerCase() === String(currentUser?.role || "").toLowerCase()
  );
  const currentAdminPerms = Array.isArray(currentAdminRoleObj?.permissions) ? currentAdminRoleObj.permissions : [];
  const canViewCtiTab =
    isAdmin ||
    currentAdminPerms.includes("cti_integration:read") ||
    currentAdminPerms.includes("cti_integration:write") ||
    currentAdminPerms.includes("call_panel:cti_screen_pop") ||
    currentAdminPerms.includes("users:write");
  const canWriteCtiTab =
    isAdmin ||
    currentAdminPerms.includes("cti_integration:write") ||
    currentAdminPerms.includes("users:write");
  const targetRoleHasCtiPerm =
    String(role || "").toLowerCase() === "admin" ||
    selectedRolePerms.includes("call_panel:cti_screen_pop") ||
    selectedRolePerms.includes("cti_integration:read") ||
    selectedRolePerms.includes("cti_integration:write");

  const handleToggleTargetRoleCtiPerm = async () => {
    if (!selectedRoleObj) return;
    const currentPerms = Array.isArray(selectedRoleObj.permissions) ? [...selectedRoleObj.permissions] : [];
    let updatedPerms;
    if (targetRoleHasCtiPerm) {
      updatedPerms = currentPerms.filter(
        (p) => p !== "call_panel:cti_screen_pop" && p !== "cti_integration:read" && p !== "cti_integration:write"
      );
    } else {
      updatedPerms = Array.from(
        new Set([...currentPerms, "call_panel:cti_screen_pop", "cti_integration:read", "cti_integration:write"])
      );
    }
    const updatedRoles = systemRoles.map((r) =>
      r.id === selectedRoleObj.id ? { ...r, permissions: updatedPerms } : r
    );
    setSystemRoles(updatedRoles);
    try {
      await safeFetch(`/api/settings/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRoles)
      });
    } catch (e) {
      console.error("CTI role permission update error:", e);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header and Search & Add Action */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <User size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">KULLANICI YÖNETİMİ</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              Sistem yöneticileri ve çağrı merkezi temsilcilerinin erişim tanımlarını yönetin.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          {isSearchOpen || searchQuery ? (
            <div className="relative animate-in fade-in zoom-in-95 duration-200">
              <input
                autoFocus
                type="text"
                placeholder="Kullanıcı ara..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onBlur={() => {
                  if (!searchQuery) setIsSearchOpen(false);
                }}
                className={`w-48 text-xs pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
              <button 
                onClick={() => { setSearchQuery(""); setIsSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Ara"
            >
              <Search size={16} />
            </button>
          )}

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleImportExcel}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
            title="Excel'den İçe Aktar (Import)"
          >
            <Upload size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          <div ref={columnSelectRef} className="relative">
            <button
              onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
              className={`p-2 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border ${isColumnSelectOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
              title="Sütunlar"
            >
              <Settings size={16} />
            </button>
            {isColumnSelectOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xl z-30 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                <h4 className="font-bold text-[9px] text-slate-400 dark:text-slate-555 uppercase tracking-wider mb-1 px-1">Görünür Sütunlar</h4>
                {Object.keys(columnLabels).map((key) => {
                  if (key === "tenant" && !isAdmin) return null;
                  return (
                    <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors">
                      <input 
                        type="checkbox"
                        checked={visibleColumns[key] !== false}
                        onChange={() => handleToggleColumn(key)}
                        className="rounded border-slate-300 text-primary focus:ring-primary/50"
                      />
                      <span>{columnLabels[key]}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowBulkConfigModal(true)}
            className={`relative p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 ${text} rounded-xl transition-all flex items-center justify-center h-8 w-8 shrink-0 border border-slate-200/80 dark:border-slate-700`}
            title={
              selectedUserIds.length > 0
                ? `Toplu Konfigürasyon (${selectedUserIds.length} Kullanıcı Seçili)`
                : "Toplu Konfigürasyon & Kitle Yönetimi"
            }
          >
            <Sliders size={16} />
            {selectedUserIds.length > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold text-white ${bg} flex items-center justify-center shadow-sm`}>
                {selectedUserIds.length}
              </span>
            )}
          </button>

          <button
            onClick={openAddModal}
            className={`p-2 ${bg} ${hover} text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
            title="Yeni Kullanıcı Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>


      {/* Status Bar */}
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-primary dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
          <CheckCircle size={14} /> Değişiklikler başarıyla kaydedildi!
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
            title="Kapat"
          >
            <X size={14} />
          </button>
        </div>
      )}


      {/* Users List (Responsive Full Width Table Rows) */}
      {loading ? (
        <div className="text-center py-10 text-xs text-slate-500">Kullanıcı listesi yükleniyor...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
          Arama kriterine uygun veya kayıtlı sistem kullanıcısı bulunmuyor.
        </div>
      ) : (
        <div className="space-y-3.5 w-full">
          {/* Column Header Row */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-5 flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  checked={
                    filteredUsers.length > 0 &&
                    filteredUsers.every((u) => selectedUserIds.includes(String(u.id)))
                  }
                  onChange={toggleSelectAllUsers}
                  title="Tüm Kullanıcıları Seç / Bırak"
                  className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                />
              </div>
              {visibleColumns.status && <div className="w-10 text-center shrink-0 min-w-0">Durum</div>}
              {visibleColumns.profile && <div className="w-12 text-center shrink-0 min-w-0">Profil</div>}
              {visibleColumns.username && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Kullanıcı Adı</div>}
              {visibleColumns.role && <div className="flex-1 min-w-0 truncate">Rol</div>}
              {visibleColumns.email && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>E-Posta Adresi</div>}
              {visibleColumns.extension && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Dahili Numarası</div>}
              {visibleColumns.recording && <div className="flex-1 text-center min-w-0 truncate">Ses Kayıt</div>}
              {visibleColumns.outboundRule && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Giden Kuralı</div>}
              {visibleColumns.pickupGroup && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Çağrı Toplama Grubu</div>}
              {visibleColumns.location && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Lokasyon</div>}
              {visibleColumns.department && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Departman</div>}
              {visibleColumns.tenant !== false && isAdmin && <div className="min-w-0 truncate" style={{ flex: '2 2 0%' }}>Müşteri / Tenant</div>}
            </div>
            <div className="w-24 text-right shrink-0">İşlem</div>
          </div>

          {paginatedUsers.map((u) => (
            <div
              key={u.id}
              className={`p-4 bg-white dark:bg-slate-900 border ${
                selectedUserIds.includes(String(u.id))
                  ? `${border} ring-1 ${ring}`
                  : "border-slate-200/80 dark:border-slate-800/85"
              } rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 hover:scale-[1.005] w-full ${
                !checkIsUserActive(u) ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-5 flex items-center justify-center shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(String(u.id))}
                      onChange={() => toggleSelectUser(u.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                  </div>
                  {visibleColumns.status && (
                    <div className="w-10 flex items-center justify-center shrink-0 min-w-0">
                      <div className="relative group flex items-center justify-center cursor-pointer">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all duration-300 relative flex items-center justify-center ${
                            (u.is_registered || u.sip_status === "online" || u.is_online)
                              ? "bg-emerald-400 group-hover:bg-emerald-500 shadow-emerald-400/50"
                              : "bg-rose-500 group-hover:bg-rose-600 shadow-rose-500/50"
                          }`}
                        >
                          {(u.is_registered || u.sip_status === "online" || u.is_online) && (
                            <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                        </div>
                        {(u.is_registered || u.sip_status === "online" || u.is_online) ? (
                          <span className="absolute bottom-full mb-2 left-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-emerald-50/95 dark:bg-emerald-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl whitespace-nowrap shadow-lg border border-emerald-200/80 dark:border-emerald-800/80 z-[100] pointer-events-none flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${u.omnichannel_busy ? "bg-rose-500" : "bg-emerald-500"} animate-pulse shrink-0`}></span>
                            <span>{u.omnichannel_busy ? `Meşgul (${u.omnichannel_label || "Yazışmada"})` : "Web Telefon Bağlı"}</span>
                            {(u.ip_address || u.client_browser || u.client_os) && (
                              <span className="text-emerald-600/90 dark:text-emerald-400/90 font-mono text-[9px] bg-emerald-100/70 dark:bg-emerald-900/70 px-1.5 py-0.5 rounded font-normal">
                                (
                                {[
                                  u.ip_address,
                                  [u.client_browser, u.client_os].filter(Boolean).join(" / ")
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                                )
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="absolute bottom-full mb-2 left-0 text-[10px] font-bold text-rose-600 dark:text-rose-400 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-rose-50/95 dark:bg-rose-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl whitespace-nowrap shadow-lg border border-rose-200/80 dark:border-rose-800/80 z-[100] pointer-events-none flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            <span>Web Telefon Bağlı Değil</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {visibleColumns.profile && (
                    <div className="w-12 flex items-center justify-center shrink-0 min-w-0">
                      <img
                        src={u?.call_panel_prefs?.profileAvatar || u.avatar}
                        alt={u.full_name}
                        className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 shrink-0"
                      />
                    </div>
                  )}
                  {visibleColumns.username && (
                    <div className="min-w-0 flex flex-col gap-1" style={{ flex: '2 2 0%' }}>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate" title={u.full_name}>
                        {u.full_name}
                      </h4>
                      {(() => {
                        const pId = u.active_profile || "available";
                        const pMeta =
                          pId === "away" ? { label: "Dışarıda", cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50", dot: "bg-amber-500" } :
                          pId === "meeting" ? { label: "Toplantı", cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50", dot: "bg-rose-500" } :
                          pId === "other" ? { label: "Diğer", cls: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50", dot: "bg-indigo-500" } :
                          { label: "Müsait", cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50", dot: "bg-emerald-500" };
                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border w-fit ${pMeta.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pMeta.dot}`}></span>
                            <span>{pMeta.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  
                  {visibleColumns.role && (
                    <div className="flex-1 flex items-center min-w-0">
                      {(() => {
                        const userRoleObj = systemRoles.find(r => r.role_code === u.role);
                        const roleLabel = userRoleObj ? userRoleObj.name : u.role;
                        const roleColor = 
                          u.role === 'admin' ? 'text-rose-500 bg-rose-50 border-rose-200' :
                          u.role === 'manager' ? 'text-blue-500 bg-blue-50 border-blue-200' :
                          u.role === 'supervisor' ? 'text-amber-500 bg-amber-50 border-amber-200' :
                          'text-slate-500 bg-slate-50 border-slate-200';
                          
                        return (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${roleColor} truncate min-w-0`} title={roleLabel}>
                            {roleLabel}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  
                  {visibleColumns.email && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate" style={{ flex: '2 2 0%' }} title={u.email}>
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  )}

                  {visibleColumns.extension && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-450 flex flex-col items-start justify-center gap-1.5" style={{ flex: '2 2 0%' }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold shrink-0">
                          <Phone size={10} /> Dahili:
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-700 dark:text-slate-300 text-[9px] shrink-0">
                          {u.extension}
                        </span>
                        {u.outbound_quarantined && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-[8px] font-extrabold shrink-0"
                            title={
                              u.quarantine_details?.attacker_ip
                                ? `Dış Arama Karantinasında! Yakalanan IP: ${u.quarantine_details.attacker_ip}`
                                : "Dış Arama Karantinasında (Hız / Eş Zamanlı Çağrı İhlali)"
                            }
                          >
                            <Lock size={9} />
                            <span>Karantina</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickUnquarantineUser(u.extension);
                              }}
                              title="Dış arama karantinasını kaldır"
                              className="ml-0.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              <Unlock size={9} />
                            </button>
                          </span>
                        )}
                      </div>
                      {(() => {
                        const activeFwds = [];
                        const actProfIdRow = u.active_profile || "available";
                        const actProfObjRow = Array.isArray(u.profiles)
                          ? u.profiles.find((p) => p && p.id === actProfIdRow)
                          : null;
                        const rowAlways = actProfObjRow?.forwarding_always || u.forwarding_always;
                        const rowBusy = actProfObjRow?.forwarding_busy || u.forwarding_busy;
                        const rowNoAns = actProfObjRow?.forwarding_no_answer || u.forwarding_no_answer;
                        if (rowAlways?.active) {
                          activeFwds.push({ key: "always", label: "Her Zaman", target: rowAlways.target });
                        }
                        if (rowBusy?.active) {
                          activeFwds.push({ key: "busy", label: "Meşgulde", target: rowBusy.target });
                        }
                        if (rowNoAns?.active) {
                          activeFwds.push({ key: "no_answer", label: "Cevapsız", target: rowNoAns.target });
                        }
                        if (activeFwds.length > 0) {
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {activeFwds.map((fw) => (
                                <div
                                  key={fw.key}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-bold shrink-0 border border-amber-200/50 dark:border-amber-800/50"
                                  title={`Yönlendirme: ${fw.label} -> ${fw.target || "Belirtilmedi"}`}
                                >
                                  <Forward size={10} />
                                  <span>
                                    {fw.label} {fw.target && <span className="opacity-75 font-medium">({fw.target})</span>}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickCancelForwarding(u.extension, fw.key);
                                    }}
                                    title={`${fw.label} yönlendirmesini iptal et`}
                                    className="ml-0.5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {visibleColumns.recording && (
                    <div className="flex-1 flex justify-center min-w-0">
                      {u.recording_active ? (
                        <div className="flex items-center justify-center text-rose-500 bg-rose-50 dark:bg-rose-900/20 w-6 h-6 rounded-lg border border-rose-200 dark:border-rose-800/50" title="Ses Kaydı Açık">
                          <Mic size={12} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 w-6 h-6 rounded-lg border border-slate-100 dark:border-slate-800/50" title="Ses Kaydı Kapalı">
                          <MicOff size={12} />
                        </div>
                      )}
                    </div>
                  )}

                  {visibleColumns.outboundRule && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate" style={{ flex: '2 2 0%' }} title={outboundRules.find(r => r.allowed_users?.includes(u.id))?.name || "-"}>
                      <PhoneOutgoing size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">{outboundRules.find(r => r.allowed_users?.includes(u.id))?.name || "-"}</span>
                    </div>
                  )}

                  {visibleColumns.pickupGroup && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate" style={{ flex: '2 2 0%' }} title={callPickupGroups.filter(g => g.extensions?.includes(u.id)).map(g => g.name).join(", ") || "-"}>
                      <Users size={12} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{callPickupGroups.filter(g => g.extensions?.includes(u.id)).map(g => g.name).join(", ") || "-"}</span>
                    </div>
                  )}
                  {visibleColumns.location && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 truncate" style={{ flex: '2 2 0%' }} title={locations.find(l => String(l.id) === String(u.location_id))?.name || "-"}>
                      <span className="truncate">{locations.find(l => String(l.id) === String(u.location_id))?.name || "-"}</span>
                    </div>
                  )}

                  {visibleColumns.department && (
                    <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 truncate" style={{ flex: '2 2 0%' }} title={departments.find(d => String(d.id) === String(u.department_id))?.name || "-"}>
                      <span className="truncate">{departments.find(d => String(d.id) === String(u.department_id))?.name || "-"}</span>
                    </div>
                  )}

                  {visibleColumns.tenant !== false && isAdmin && (
                    <div className="min-w-0 text-[10px] truncate" style={{ flex: '2 2 0%' }}>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 truncate max-w-[130px]" title={tenants.find(t => t.id === u.tenant_id || t.code === u.tenant_id)?.name || u.tenant_name || (u.tenant_id === "tenant-nolto" ? "Nolto" : "Ana Müşteri")}>
                        <Building2 size={11} className="shrink-0" />
                        <span className="truncate">{tenants.find(t => t.id === u.tenant_id || t.code === u.tenant_id)?.name || u.tenant_name || (u.tenant_id === "tenant-nolto" ? "Nolto" : "Ana Müşteri")}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2 justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60 w-24 shrink-0">
                  <button
                    onClick={() => openEditModal(u)}
                    className="p-1.5 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                    title="Düzenle"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-primary rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-250"
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
          ))}

          <TablePagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="kullanıcı"
          />
        </div>
      )}

      {showBulkConfigModal && (
        <BulkConfigPanel
          backendHost={backendHost}
          isModal={true}
          initialModule="users"
          initialTargetMode="selected"
          initialSelectedIds={selectedUserIds}
          onClose={() => setShowBulkConfigModal(false)}
          onApplied={() => {
            fetchUsers(true);
            fetchRelations();
          }}
        />
      )}

      {/* POPUP MODAL (Add / Edit Form with Tabs) */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 transition-all duration-300">
          <div className="w-full max-w-6xl h-[88vh] h-[88dvh] max-h-[880px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-clip flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı Ekle"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-clip">
                {/* Sidebar Tabs */}
                <div className="w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto overscroll-contain">
                    <nav className="space-y-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("general")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'general' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <User size={16} />
                            Genel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!editingUser && !extension.trim()) {
                                    setExtension(getNextAvailableExtension(userTenantId));
                                }
                                setActiveTab("sip");
                            }}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'sip' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <KeyRound size={16} />
                            SIP
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("profiles")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'profiles' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <Users size={16} />
                            Profiller & Yönlendirme
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("features")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'features' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <Settings size={16} />
                            Özellikler
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("applications")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'applications' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <LayoutGrid size={16} />
                            Uygulamalar
                        </button>
                        {canViewCtiTab && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("cti")}
                                className={"w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'cti' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                            >
                                <span className="flex items-center gap-3">
                                    <Cable size={16} />
                                    CTI
                                </span>
                                {ctiConfig?.enabled && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                        AKTİF
                                    </span>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab("avatar")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'avatar' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <ImageIcon size={16} />
                            Avatar & Tema
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("ui_layout")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'ui_layout' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <Monitor size={16} />
                            Arayüz & Panel Düzeni
                        </button>
                        {hasSupervisorPerm && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("supervisor_filter")}
                                className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'supervisor_filter' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                            >
                                <Shield size={16} />
                                Rapor & Yönetim Filtresi
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("tenant_select")}
                                className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'tenant_select' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                            >
                                <Building2 size={16} />
                                Müşteri / Tenant
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab("connection_history")}
                            className={"w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'connection_history' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <span className="flex items-center gap-3 min-w-0 truncate">
                                <Clock size={16} className="shrink-0" />
                                <span className="truncate">Bağlantı & Cihaz Kilidi</span>
                            </span>
                            {deviceLockEnabled && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                    Kilitli
                                </span>
                            )}
                        </button>
                    </nav>
                </div>

                {/* Tab Content Area */}
                <form noValidate onSubmit={handleFormSubmit} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-clip">
                    <div
                        ref={modalScrollPaneRef}
                        className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] p-7 space-y-6"
                    >
                        {error && (
                          <div className="p-3.5 bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-primary dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2.5">
                            <span>{error}</span>
                            <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        
                        {/* TAB 1: GENEL */}
                        {activeTab === "general" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-700 dark:text-white">Kullanıcı Aktif mi?</h5>
                                        <p className="text-[10px] text-slate-400">Pasif kullanıcılar sisteme giremez ve SIP kaydedemez.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsActive(!isActive)}
                                        className="text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {isActive ? <ToggleRight size={30} className={text} /> : <ToggleLeft size={30} />}
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">İsim Soyisim</label>
                                        <input type="text" placeholder="Örn: Ahmet Yılmaz" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">E-posta Adresi</label>
                                        <input type="email" placeholder="ahmet@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Kullanıcı Rolü</label>
                                        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none">
                                            {systemRoles.length === 0 && <option value="agent">Agent</option>}
                                            {systemRoles.map(r => <option key={r.role_code} value={r.role_code}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Arayüz Şifresi (Login)</label>
                                        <input type="password" placeholder="Şifre belirleyin" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Lokasyon</label>
                                        <select 
                                            value={selectedLocation} 
                                            onChange={(e) => {
                                                setSelectedLocation(e.target.value);
                                                setSelectedDepartment(""); // reset department when location changes
                                            }} 
                                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        >
                                            <option value="">Seçiniz</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Departman</label>
                                        <select 
                                            value={selectedDepartment} 
                                            onChange={(e) => setSelectedDepartment(e.target.value)} 
                                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            disabled={!selectedLocation}
                                        >
                                            <option value="">Seçiniz</option>
                                            {departments.filter(d => String(d.location_id) === String(selectedLocation)).map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Admin-Assignable Startup / Landing Screen */}
                                {(() => {
                                    const selectedRoleObj = systemRoles.find(
                                        (r) => String(r.role_code || "").toLowerCase() === String(role || "").toLowerCase()
                                    );
                                    const rolePerms = selectedRoleObj?.permissions || [];
                                    const { isWallboardOnly, isAgentOnly } = classifyRoleScope(role, rolePerms);
                                    const allowedScreens = getAllowedLandingScreensForRole(role, rolePerms);
                                    const allowedSubTabs = getAllowedAgentSubTabsForRole(role, rolePerms);
                                    const screenGroups = Array.from(new Set(allowedScreens.map((s) => s.group)));
                                    const effectiveLandingVal =
                                        defaultLandingTab === "auto" ||
                                        defaultLandingTab === "last_visited" ||
                                        allowedScreens.some((s) => s.id === defaultLandingTab)
                                            ? defaultLandingTab
                                            : "auto";
                                    const showAgentSubSelect =
                                        !isWallboardOnly && (isAgentOnly || effectiveLandingVal === "call-center");

                                    return (
                                        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                                                        Girişte Açılacak Başlangıç Ekranı
                                                    </span>
                                                    <span id="admin-user-landing-help" className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                                        Kullanıcı oturum açtığında ilk gelecek ekran (kullanıcı dilerse kendi Profil Ayarları&apos;ndan değiştirebilir).
                                                    </span>
                                                </div>
                                            </div>

                                            {isWallboardOnly ? (
                                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    Seçilen rol yalnızca Canlı İzleme Paneli (Wallboard) yetkisine sahip olduğu için otomatik olarak Wallboard ile açılır.
                                                </div>
                                            ) : (
                                                <div className={`grid grid-cols-1 ${showAgentSubSelect && !isAgentOnly ? "sm:grid-cols-2" : ""} gap-3`}>
                                                    {!isAgentOnly && (
                                                        <div>
                                                            <label
                                                                htmlFor="admin-user-default-landing"
                                                                className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"
                                                            >
                                                                Başlangıç Modülü
                                                            </label>
                                                            <select
                                                                id="admin-user-default-landing"
                                                                name="default_landing_tab"
                                                                aria-describedby="admin-user-landing-help"
                                                                value={effectiveLandingVal}
                                                                onChange={(e) => {
                                                                    const nextVal = e.target.value;
                                                                    setDefaultLandingTab(nextVal);
                                                                    if (nextVal !== "call-center") {
                                                                        setDefaultAgentSubTab("auto");
                                                                    }
                                                                }}
                                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                            >
                                                                <optgroup label="Akıllı Başlangıç Modları">
                                                                    <option value="auto">Varsayılan (Role Göre Otomatik)</option>
                                                                    <option value="last_visited">Son Kaldığı Ekrandan Devam Etsin</option>
                                                                </optgroup>
                                                                {screenGroups.map((grp) => (
                                                                    <optgroup key={grp} label={grp}>
                                                                        {allowedScreens
                                                                            .filter((item) => item.group === grp)
                                                                            .map((item) => (
                                                                                <option key={item.id} value={item.id}>
                                                                                    {item.label}
                                                                                </option>
                                                                            ))}
                                                                    </optgroup>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}

                                                    {showAgentSubSelect && (
                                                        <div>
                                                            <label
                                                                htmlFor="admin-user-default-agent-subtab"
                                                                className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"
                                                            >
                                                                Çağrı Paneli Açılış Sekmesi
                                                            </label>
                                                            <select
                                                                id="admin-user-default-agent-subtab"
                                                                name="default_agent_subtab"
                                                                aria-describedby="admin-user-landing-help"
                                                                value={defaultAgentSubTab}
                                                                onChange={(e) => {
                                                                    if (isAgentOnly) setDefaultLandingTab("call-center");
                                                                    setDefaultAgentSubTab(e.target.value);
                                                                }}
                                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                            >
                                                                <option value="auto">Sıralamadaki İlk Sekme (Varsayılan)</option>
                                                                <option value="last_visited">Son Kaldığı Alt Sekmeden Devam Etsin</option>
                                                                {allowedSubTabs.map((st) => (
                                                                    <option key={st.id} value={st.id}>
                                                                        {st.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* TAB 2: SIP */}
                        {activeTab === "sip" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                        SIP Ayarları &amp; SIP Cihazları
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Kullanıcının dahili numarası, giden arama kuralı, çağrı toplama grubu ve aboneye bağlı çoklu SIP cihazlarının yönetimi.
                                    </p>
                                </div>

                                <div className={`p-5 rounded-2xl border ${borderLight} ${lightBg} space-y-5`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="sip-extension-input" className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                                                Dahili Numarası (Extension)
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    id="sip-extension-input"
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoCorrect="off"
                                                    autoCapitalize="off"
                                                    spellCheck={false}
                                                    placeholder="Örn: 1000"
                                                    value={extension}
                                                    onChange={(e) => setExtension(e.target.value)}
                                                    className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setExtension(getNextAvailableExtension(userTenantId))}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                                                    title="Sıradaki Boş Dahili Numarasını Getir"
                                                    aria-label="Sıradaki Boş Dahili Numarasını Getir"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="sip-outbound-callerid" className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                                                Dış Aramada Görünecek Numara
                                            </label>
                                            <input
                                                id="sip-outbound-callerid"
                                                type="text"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                placeholder="Boş bırakılırsa varsayılan kural"
                                                value={outboundCallerId}
                                                onChange={(e) => setOutboundCallerId(e.target.value)}
                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="sip-outbound-rule-select" className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                                                Giden Arama Kuralları
                                            </label>
                                            <select
                                                id="sip-outbound-rule-select"
                                                value={selectedOutboundRules[0] || ""}
                                                onChange={(e) => setSelectedOutboundRules(e.target.value ? [e.target.value] : [])}
                                                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            >
                                                <option value="">Kural Seçilmedi</option>
                                                {outboundRules.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="sip-pickup-group-select" className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                                                Çağrı Toplama Grubu
                                            </label>
                                            <select
                                                id="sip-pickup-group-select"
                                                value={selectedCallPickupGroups[0] || ""}
                                                onChange={(e) => setSelectedCallPickupGroups(e.target.value ? [e.target.value] : [])}
                                                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            >
                                                <option value="">Grup Seçilmedi</option>
                                                {callPickupGroups.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {outboundQuarantined && (
                                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-2.5">
                                                <Lock size={16} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                                                <div className="text-xs">
                                                    <div className="font-extrabold text-rose-800 dark:text-rose-300">
                                                        Bu Abone Şu Anda Dış Arama Karantinasında!
                                                    </div>
                                                    <div className="text-[11px] text-rose-700/90 dark:text-rose-300/80 mt-0.5">
                                                        Eş zamanlı veya saniyelik dış arama hız limiti aşıldığı için dış arama yetkisi otomatik kilitlendi.
                                                        {editingUser?.quarantine_details?.attacker_ip && (
                                                            <span className="font-mono font-bold ml-1">
                                                                (Kaynak IP: {editingUser.quarantine_details.attacker_ip})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleQuickUnquarantineUser(extension)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} shrink-0 transition-all`}
                                            >
                                                <Unlock size={13} />
                                                <span>Karantinayı Kaldır</span>
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="sip-max-concurrent-outbound" className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                                            Eş Zamanlı Dış Arama Limiti (Güvenlik)
                                        </label>
                                        <select
                                            id="sip-max-concurrent-outbound"
                                            name="max_concurrent_outbound"
                                            value={maxConcurrentOutbound}
                                            onChange={(e) => setMaxConcurrentOutbound(Number(e.target.value))}
                                            aria-describedby="sip-max-concurrent-hint"
                                            className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        >
                                            <option value={0}>Sistem Varsayılanını Kullan (Güvenlik Kalkanı)</option>
                                            <option value={1}>1 Eş Zamanlı Dış Çağrı (Standart Abone)</option>
                                            <option value={2}>2 Eş Zamanlı Dış Çağrı (Aktarım / Konferans)</option>
                                            <option value={3}>3 Eş Zamanlı Dış Çağrı</option>
                                            <option value={5}>5 Eş Zamanlı Dış Çağrı</option>
                                            <option value={10}>10 Eş Zamanlı Dış Çağrı</option>
                                            <option value={-1}>Limitsiz (Muaf)</option>
                                        </select>
                                        <p id="sip-max-concurrent-hint" className="text-[10px] text-slate-500 mt-1">
                                            Sızma durumunda saldırganın aynı anda çoklu dış arama başlatmasını engeller.
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-4">
                                        <div>
                                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Ses Kayıt</h5>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Bu kullanıcının tüm görüşmeleri kaydedilsin mi?</p>
                                        </div>
                                        <button type="button" onClick={() => setRecordingActive(!recordingActive)} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
                                            {recordingActive ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>
                                </div>

                                {/* MULTI-DEVICE SECTION: SIP CİHAZLARI */}
                                <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                    SIP Cihazları
                                                </h5>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}>
                                                    {sipDevices.length} Cihaz
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Masa telefonu, DECT veya harici SIP istemcilerini ayrı ayrı tanımlayın; büyüteç ile BLF, kodek ve canlı PJSIP detaylarını inceleyin.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={openSipDeviceAddModal}
                                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
                                            title="Yeni SIP Cihazı Ekle"
                                            aria-label="Yeni SIP Cihazı Ekle"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    {sipDevices.length === 0 ? (
                                        <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 text-center space-y-1.5">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                Henüz tanımlı bir SIP Cihazı bulunmuyor
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Sağ üstteki artı (+) butonuna tıklayarak bu aboneye yeni bir masa telefonu veya SIP cihazı ekleyebilirsiniz.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {sipDevices.map((dev, devIdx) => {
                                                const isVirtualSub = dev.device_type === "virtual_subscriber";
                                                const isWebPhone = dev.device_type === "web_phone";
                                                const devOnline = isVirtualSub
                                                    ? dev.is_active !== false && Boolean(dev.trunk)
                                                    : Boolean(dev.is_online) && dev.is_active !== false;
                                                const devIpShown = dev.live_ip || dev.ip || "";
                                                const blfCount = !isWebPhone && Array.isArray(dev.dss_keys) ? dev.dss_keys.length : 0;
                                                const resolvedVirtualData =
                                                    dev.virtual_target_mode === "custom"
                                                        ? (dev.custom_target || "-")
                                                        : `${dev.prefix || ""}${extension || editingUser?.extension || "<Dahili>"}`;
                                                const typeLabel = isWebPhone
                                                    ? "Web Telefonu"
                                                    : isVirtualSub
                                                    ? "Sanal Abone"
                                                    : dev.device_type === "dect"
                                                    ? "DECT Telefon"
                                                    : dev.device_type === "softphone"
                                                    ? "SIP İstemci"
                                                    : "Masa Telefonu";
                                                return (
                                                    <div
                                                        key={dev.id || `${dev.sip_username}-${devIdx}`}
                                                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                            dev.is_active === false
                                                                ? "bg-slate-100/70 dark:bg-slate-950/30 border-slate-200/70 dark:border-slate-800/60 opacity-70"
                                                                : "bg-white dark:bg-slate-950/80 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                                                        }`}
                                                    >
                                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${lightBg} ${text} border ${borderLight}`}>
                                                                {isWebPhone ? (
                                                                    <Wifi size={17} />
                                                                ) : isVirtualSub ? (
                                                                    <Cable size={17} />
                                                                ) : dev.device_type === "softphone" ? (
                                                                    <Monitor size={17} />
                                                                ) : dev.device_type === "dect" ? (
                                                                    <Smartphone size={17} />
                                                                ) : (
                                                                    <Phone size={17} />
                                                                )}
                                                                <span
                                                                    className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                                                                        devOnline ? "bg-emerald-500" : "bg-slate-400"
                                                                    }`}
                                                                    title={
                                                                        isVirtualSub
                                                                            ? devOnline
                                                                                ? `Sanal Abone Aktif (Trunk: ${dev.trunk})`
                                                                                : "Pasif / Trunk Seçilmedi"
                                                                            : devOnline
                                                                            ? `${isWebPhone ? "Web Phone Bağlı" : "Çevrimiçi"}${devIpShown ? ` (${devIpShown})` : ""}`
                                                                            : "Çevrimdışı"
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="min-w-0 space-y-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                                                        {dev.name || (isWebPhone ? "Web Telefonu" : isVirtualSub ? `Sanal Abone ${devIdx + 1}` : `SIP Cihazı ${devIdx + 1}`)}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                                        {typeLabel}
                                                                    </span>
                                                                    {isWebPhone && (
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${lightBg} ${text}`}>
                                                                            SABİT
                                                                        </span>
                                                                    )}
                                                                    {dev.is_active === false ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                            PASİF
                                                                        </span>
                                                                    ) : isVirtualSub && devOnline ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                                                            TRUNK YÖNLENDİRME
                                                                        </span>
                                                                    ) : devOnline ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                                                            BAĞLI
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                                                            ÇEVRİMDIŞI
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {isVirtualSub ? (
                                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                            Trunk: <span className="font-mono font-bold">{dev.trunk || "-"}</span>
                                                                        </span>
                                                                        <span>•</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => copyTextWithFeedback(resolvedVirtualData, `vd-${dev.id}`)}
                                                                            className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200 hover:underline"
                                                                            title="Karşı Santrale Gönderilecek Veriyi Kopyala"
                                                                        >
                                                                            <span>Gönderilen: {resolvedVirtualData}</span>
                                                                            {copiedDeviceKey === `vd-${dev.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                                        </button>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text}`}>
                                                                            {dev.virtual_target_mode === "custom"
                                                                                ? "Özel Veri"
                                                                                : dev.prefix
                                                                                ? `Prefix: ${dev.prefix}`
                                                                                : "Doğrudan Dahili"}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => copyTextWithFeedback(dev.sip_username, `su-${dev.id}`)}
                                                                            className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200 hover:underline"
                                                                            title="SIP Kullanıcı Adını Kopyala"
                                                                        >
                                                                            <span>SIP: {dev.sip_username}</span>
                                                                            {copiedDeviceKey === `su-${dev.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                                        </button>
                                                                        <span>•</span>
                                                                        <span className="font-semibold">{isWebPhone ? "WSS / WebRTC" : (dev.transport || "UDP")}</span>
                                                                        {!isWebPhone && dev.brand && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span>{dev.brand} {dev.model || ""}</span>
                                                                            </>
                                                                        )}
                                                                        {!isWebPhone && dev.mac && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="font-mono text-[10px]">{dev.mac}</span>
                                                                            </>
                                                                        )}
                                                                        {devIpShown && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    IP: {devIpShown}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        {blfCount > 0 && (
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text}`}>
                                                                                {blfCount} BLF Tuşu
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                                                            {!isVirtualSub && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openSipDeviceInspectModal(dev)}
                                                                    className={`p-2 rounded-xl border ${borderLight} ${lightBg} ${text} hover:opacity-90 transition-all`}
                                                                    title={isWebPhone ? "Web Telefonu PJSIP & Bağlantı İncele" : "Cihaz Detayları, BLF & PJSIP İncele"}
                                                                    aria-label={`${dev.name || "SIP Cihazı"} Cihaz Detayları ve PJSIP İncele`}
                                                                >
                                                                    <Search size={15} />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => openSipDeviceEditModal(dev)}
                                                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
                                                                title="SIP Cihazı Ayarlarını Düzenle"
                                                                aria-label={`${dev.name || "SIP Cihazı"} Ayarlarını Düzenle`}
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            {!isWebPhone && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSipDeviceDeleteTarget(dev)}
                                                                    className="p-2 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-all"
                                                                    title="SIP Cihazını Sil"
                                                                    aria-label={`${dev.name || "SIP Cihazı"} Sil`}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: PROFİLLER & YÖNLENDİRME (Müsait, Dışarıda, Toplantı, Diğer) */}
                        {activeTab === "profiles" && (() => {
                            const currentProf = userProfiles.find(p => p.id === selectedProfileTab) || userProfiles[0] || DEFAULT_USER_PROFILES[0];
                            const updateCurrentProfile = (patch) => {
                                setUserProfiles(prev => prev.map(p => p.id === currentProf.id ? { ...p, ...patch } : p));
                            };
                            const updateProfileForwarding = (ruleKey, patch) => {
                                const curRule = currentProf[ruleKey] || { active: false, type: "internal", target: "" };
                                updateCurrentProfile({
                                    [ruleKey]: { ...curRule, ...patch }
                                });
                            };
                            const toggleProfileDevice = (devId) => {
                                const curDevs = Array.isArray(currentProf.devices) ? currentProf.devices : [];
                                const nextDevs = curDevs.includes(devId)
                                    ? curDevs.filter(d => d !== devId)
                                    : [...curDevs, devId];
                                updateCurrentProfile({ devices: nextDevs });
                            };

                            const profAlways = currentProf.forwarding_always || { active: false, type: "internal", target: "" };
                            const profBusy = currentProf.forwarding_busy || { active: false, type: "internal", target: "" };
                            const profNoAns = currentProf.forwarding_no_answer || { active: false, type: "internal", target: "" };
                            const profTimeout = currentProf.timeout ?? 30;

                            return (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Top Header & Active Profile Selector */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                Profiller & Çağrı Yönlendirme
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Her profil için çalacak cihazları, çalma süresini ve çağrı yönlendirme kurallarını ayrı ayrı yapılandırın.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase">Aktif Profil:</span>
                                            <select
                                                value={activeProfile}
                                                onChange={(e) => {
                                                    setActiveProfile(e.target.value);
                                                    setSelectedProfileTab(e.target.value);
                                                }}
                                                className={`text-xs font-extrabold px-3.5 py-2 rounded-xl border ${border} ${lightBg} ${text} focus:outline-none`}
                                            >
                                                {userProfiles.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 4 Profile Sub-Tabs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                        {userProfiles.map((prof) => {
                                            const isSelected = selectedProfileTab === prof.id;
                                            const isCurrentlyActive = activeProfile === prof.id;
                                            const dotColor =
                                                prof.id === "available" ? "bg-emerald-500" :
                                                prof.id === "away" ? "bg-amber-500" :
                                                prof.id === "meeting" ? "bg-rose-500" : "bg-indigo-500";
                                            return (
                                                <div
                                                    key={prof.id}
                                                    onClick={() => {
                                                        setSelectedProfileTab(prof.id);
                                                        setActiveProfile(prof.id);
                                                    }}
                                                    className={`cursor-pointer px-4 py-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 ${
                                                        isSelected
                                                            ? `${border} ${lightBg} shadow-sm`
                                                            : "border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}></span>
                                                        <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">{prof.name}</span>
                                                    </div>
                                                    {isCurrentlyActive && (
                                                        <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500 text-white shrink-0">
                                                            AKTİF
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Selected Profile Configuration Card */}
                                    <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                    {currentProf.name} Profili Ayarları
                                                </span>
                                                {activeProfile === currentProf.id ? (
                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                                        Şu Anda Kullanımda
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveProfile(currentProf.id)}
                                                        className={`px-3 py-1 rounded-lg text-[10px] font-bold ${bg} ${hover} text-white transition-all shadow-sm`}
                                                    >
                                                        Bu Profili Aktif Yap
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => updateCurrentProfile({ devices: ["desk_phone", "mobile_app", "web_phone", "pc_app"] })}
                                                    className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:underline"
                                                >
                                                    Tüm Cihazları Seç
                                                </button>
                                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateCurrentProfile({ devices: [] })}
                                                    className="text-[11px] font-bold text-slate-500 hover:underline"
                                                >
                                                    Tümünü Kaldır
                                                </button>
                                            </div>
                                        </div>

                                        {/* 1. Ring Devices Selection */}
                                        <div>
                                            <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                                                1. Bu Profilde Çalacak Cihazlar (Device Seçimi)
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                                {RING_DEVICES_METADATA.map((dev) => {
                                                    const checked = Array.isArray(currentProf.devices) && currentProf.devices.includes(dev.id);
                                                    return (
                                                        <label
                                                            key={dev.id}
                                                            onClick={() => toggleProfileDevice(dev.id)}
                                                            className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between gap-3.5 select-none ${
                                                                checked
                                                                    ? `bg-white dark:bg-slate-900 ${border} shadow-sm`
                                                                    : "bg-white/50 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-800/70 opacity-75 hover:opacity-100"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3.5 min-w-0">
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${checked ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                                                                    {dev.id === "mobile_app" ? <Smartphone size={18} /> : dev.id === "desk_phone" ? <Phone size={18} /> : <Monitor size={18} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{dev.label}</div>
                                                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{dev.desc}</div>
                                                                </div>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${checked ? `${bg} border-transparent text-white` : "border-slate-300 dark:border-slate-700"}`}>
                                                                {checked && <Check size={13} />}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            {(!currentProf.devices || currentProf.devices.length === 0) && (
                                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-3">
                                                    Hiçbir cihaz seçilmediğinde telefon çalmaz ve gelen çağrı doğrudan yönlendirme veya sesli posta kurallarına aktarılır.
                                                </p>
                                            )}
                                        </div>

                                        {/* 2. Ring Timeout & Digit Switch */}
                                        <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Çalma Süresi (sn) */}
                                            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 flex items-center justify-between gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                        2. Çalma Süresi (sn)
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        Zaman aşımına düşmeden önceki çalma süresi
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="5"
                                                        max="120"
                                                        value={profTimeout}
                                                        onChange={(e) =>
                                                            updateCurrentProfile({
                                                                timeout: Math.max(5, Math.min(120, parseInt(e.target.value, 10) || 30))
                                                            })
                                                        }
                                                        className="w-14 text-xs font-bold px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none text-center"
                                                    />
                                                    {[15, 30, 45].map((sec) => (
                                                        <button
                                                            key={sec}
                                                            type="button"
                                                            onClick={() => updateCurrentProfile({ timeout: sec })}
                                                            className={`px-2 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                                                Number(profTimeout) === sec
                                                                    ? `${bg} text-white border-transparent`
                                                                    : "bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                                            }`}
                                                        >
                                                            {sec}s
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Telefon Tuşlama Kodu (Digit) */}
                                            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 flex items-center justify-between gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                        3. Telefon Tuşlama Kodu (Digit)
                                                    </label>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        Telefondan hızlı profil geçiş kodu
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={2}
                                                        value={currentProf.digit ?? ""}
                                                        onChange={(e) =>
                                                            updateCurrentProfile({
                                                                digit: e.target.value.replace(/\D/g, "").slice(0, 2)
                                                            })
                                                        }
                                                        placeholder="1"
                                                        className="w-14 text-xs font-mono font-extrabold text-center px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    />
                                                    <span className={`px-2.5 py-2 rounded-xl text-[10px] font-mono font-extrabold ${lightBg} ${text} border ${borderLight} whitespace-nowrap`}>
                                                        *70*{currentProf.digit || "1"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. Per-Profile Call Forwarding Rules */}
                                        <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                        4. Çağrı Yönlendirme Kuralları ({currentProf.name} Profili)
                                                    </label>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        Kullanıcı <strong>{currentProf.name}</strong> profilindeyken uygulanacak çağrı yönlendirme kuralları.
                                                    </p>
                                                </div>
                                                {(profAlways.active || profBusy.active || profNoAns.active) && (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            updateCurrentProfile({
                                                                forwarding_always: { ...profAlways, active: false },
                                                                forwarding_busy: { ...profBusy, active: false },
                                                                forwarding_no_answer: { ...profNoAns, active: false }
                                                            });
                                                            if (activeProfile === currentProf.id && editingUser && editingUser.extension) {
                                                                await handleQuickCancelForwarding(editingUser.extension, "all");
                                                            }
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[10px] font-bold flex items-center gap-1 transition-all shrink-0"
                                                    >
                                                        <X size={12} /> Yönlendirmeleri Kapat
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {renderForwardingRow(
                                                    "Her Zaman",
                                                    !!profAlways.active,
                                                    (val) => updateProfileForwarding("forwarding_always", { active: val }),
                                                    profAlways.type || "internal",
                                                    (val) => updateProfileForwarding("forwarding_always", { type: val }),
                                                    profAlways.target || "",
                                                    (val) => updateProfileForwarding("forwarding_always", { target: val })
                                                )}
                                                {renderForwardingRow(
                                                    "Meşgul Durumda",
                                                    !!profBusy.active,
                                                    (val) => updateProfileForwarding("forwarding_busy", { active: val }),
                                                    profBusy.type || "internal",
                                                    (val) => updateProfileForwarding("forwarding_busy", { type: val }),
                                                    profBusy.target || "",
                                                    (val) => updateProfileForwarding("forwarding_busy", { target: val })
                                                )}
                                                {renderForwardingRow(
                                                    "Zaman Aşımında (Cevapsız)",
                                                    !!profNoAns.active,
                                                    (val) => updateProfileForwarding("forwarding_no_answer", { active: val }),
                                                    profNoAns.type || "internal",
                                                    (val) => updateProfileForwarding("forwarding_no_answer", { type: val }),
                                                    profNoAns.target || "",
                                                    (val) => updateProfileForwarding("forwarding_no_answer", { target: val })
                                                )}
                                            </div>
                                        </div>

                                        {/* 5. Akıllı Mobil Aktarım (AI GSM) */}
                                        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800">
                                            <div className={`p-4 bg-white dark:bg-slate-900 rounded-xl border transition-all space-y-3 ${mobileTransferEnabled ? border : "border-slate-200/80 dark:border-slate-800"}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`p-2 rounded-lg shrink-0 ${mobileTransferEnabled ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                            <Smartphone size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                                    5. Akıllı Mobil Aktarım (AI GSM)
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mobileTransferEnabled ? `${lightBg} ${text} border ${border}` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                                    {mobileTransferEnabled ? "Aktif" : "Pasif"}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                Web Telefon kapalıyken mesai saatlerinde gelen çağrılar kullanıcının GSM numarasına aktarılır ve yapay zeka çağrı özetini fısıldar.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMobileTransferEnabled(!mobileTransferEnabled)}
                                                        className={`transition-colors shrink-0 ${mobileTransferEnabled ? text : "text-slate-400"}`}
                                                    >
                                                        {mobileTransferEnabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                    <div>
                                                        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                                            Kullanıcı GSM / Cep Telefonu Numarası
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            placeholder="Örn: 0532 123 45 67"
                                                            value={followMeMobileNumber}
                                                            onChange={(e) => setFollowMeMobileNumber(e.target.value)}
                                                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <div className={`w-full p-2.5 rounded-xl border ${lightBg} ${borderLight} text-[10px] font-semibold ${text}`}>
                                                            Bu numara aynı zamanda <strong>Beni Takip Et (Follow-Me)</strong> ve <strong>WhatsApp 2FA</strong> doğrulama numarası olarak kullanılır.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* TAB 3: ÖZELLİKLER */}
                        {activeTab === "features" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* SESLİ POSTA (VOICEMAIL) */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all ${voicemailActive ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${voicemailActive ? (lightBg + " " + text) : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <PhoneCall size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">Sesli Posta</h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${voicemailActive ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {voicemailActive ? "Aktif" : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                                    Kullanıcıya ulaşılamadığında veya sesli postaya yönlendirildiğinde devreye girecek sesli posta kutusu ayarları.
                                                </p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setVoicemailActive(!voicemailActive)} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 ml-3">
                                            {voicemailActive ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>

                                    {voicemailActive && (
                                        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Sesli Posta Karşılama Anonsu</label>
                                                <select value={voicemailAnnouncement} onChange={(e) => setVoicemailAnnouncement(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none">
                                                    <option value="Varsayılan Anons">Varsayılan Sistem Sesi (Sesli Posta Karşılama)</option>
                                                    {(() => {
                                                        const sysVoicemailAnns = (announcementsList || []).filter(a => String(a?.type || "").toLowerCase() === "system");
                                                        const customVoicemailAnns = (announcementsList || []).filter(a => {
                                                            const t = String(a?.type || "").toLowerCase();
                                                            return t !== "moh" && t !== "music" && t !== "hold_music" && t !== "system" && t !== "sistem";
                                                        });
                                                        const allValidIds = new Set([
                                                            "Varsayılan Anons",
                                                            ...sysVoicemailAnns.map(a => String(a.id)),
                                                            ...customVoicemailAnns.map(a => String(a.id))
                                                        ]);
                                                        return (
                                                            <>
                                                                {voicemailAnnouncement && !allValidIds.has(String(voicemailAnnouncement)) && (
                                                                    <option value={voicemailAnnouncement}>{voicemailAnnouncement}</option>
                                                                )}
                                                                {sysVoicemailAnns.length > 0 && (
                                                                    <optgroup label="Sistem Anonsları">
                                                                        {sysVoicemailAnns.map(a => (
                                                                            <option key={a.id} value={a.id}>{a.name}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                                {customVoicemailAnns.length > 0 && (
                                                                    <optgroup label="Özel Anonslar">
                                                                        {customVoicemailAnns.map(a => (
                                                                            <option key={a.id} value={a.id}>{a.name}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Sesli Posta Şifresi (Sadece 4 Rakam)</label>
                                                <input type="text" maxLength={4} pattern="\d{4}" placeholder="Örn: 1234" value={voicemailPin} onChange={(e) => setVoicemailPin(e.target.value.replace(/\D/g, ''))} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none" />
                                            </div>
                                            <div className="sm:col-span-2 flex items-center justify-between pt-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bırakılan sesli postaları e-posta ile gönder</span>
                                                <button type="button" onClick={() => setVoicemailToEmail(!voicemailToEmail)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                                    {voicemailToEmail ? <ToggleRight size={24} className={`${text}`} /> : <ToggleLeft size={24} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ORTAK MASA TELEFONU (MASA PAYLAŞIMI) */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all space-y-4 ${hotdeskConfig?.enabled ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${hotdeskConfig?.enabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Monitor size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">
                                                        Ortak Masa Telefonu (Masa Paylaşımı)
                                                    </h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hotdeskConfig?.enabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {hotdeskConfig?.enabled ? "Aktif" : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                                    Kullanıcının ofisteki herhangi bir fiziksel IP masa telefonundan kendi dahilisi ve özel PIN şifresiyle oturum açmasını sağlar.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setHotdeskConfig((prev) => ({
                                                    ...prev,
                                                    enabled: !prev.enabled
                                                }))
                                            }
                                            className={`transition-colors shrink-0 ${hotdeskConfig?.enabled ? text : "text-slate-400"}`}
                                        >
                                            {hotdeskConfig?.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>

                                    {hotdeskConfig?.enabled && (
                                        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Dedicated PIN */}
                                                <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <label
                                                            htmlFor="admin-hotdesk-pin"
                                                            className="text-xs font-extrabold text-slate-800 dark:text-white"
                                                        >
                                                            Ortak Masa Telefonu PIN Şifresi
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const rnd = String(Math.floor(100000 + Math.random() * 900000));
                                                                setHotdeskConfig((prev) => ({ ...prev, pin: rnd }));
                                                                setShowHotdeskPin(true);
                                                            }}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center gap-1`}
                                                        >
                                                            <RefreshCw size={11} />
                                                            Rastgele PIN Üret
                                                        </button>
                                                    </div>
                                                    <p
                                                        id="admin-hotdesk-pin-hint"
                                                        className="text-[10px] text-slate-500 dark:text-slate-400"
                                                    >
                                                        SIP ve Sesli Posta şifresinden bağımsız, 4 ile 8 haneli sadece rakam giriniz.
                                                    </p>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            id="admin-hotdesk-pin"
                                                            type={showHotdeskPin ? "text" : "password"}
                                                            inputMode="numeric"
                                                            autoComplete="off"
                                                            pattern="\d{4,8}"
                                                            maxLength={8}
                                                            aria-describedby="admin-hotdesk-pin-hint"
                                                            value={hotdeskConfig?.pin || ""}
                                                            onChange={(e) =>
                                                                setHotdeskConfig((prev) => ({
                                                                    ...prev,
                                                                    pin: e.target.value.replace(/\D/g, "").slice(0, 8)
                                                                }))
                                                            }
                                                            onBlur={() => setHotdeskPinTouched(true)}
                                                            placeholder="Örn: 482910"
                                                            className={`w-full text-xs font-mono font-extrabold tracking-widest px-3.5 py-2.5 pr-10 rounded-xl border bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} ${
                                                                hotdeskPinTouched && !/^\d{4,8}$/.test(String(hotdeskConfig?.pin || ""))
                                                                    ? "border-rose-400 dark:border-rose-600"
                                                                    : "border-slate-200 dark:border-slate-800"
                                                            }`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowHotdeskPin((p) => !p)}
                                                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                            title={showHotdeskPin ? "PIN Gizle" : "PIN Göster"}
                                                        >
                                                            {showHotdeskPin ? <EyeOff size={15} /> : <Eye size={15} />}
                                                        </button>
                                                    </div>
                                                    {hotdeskPinTouched && !/^\d{4,8}$/.test(String(hotdeskConfig?.pin || "")) && (
                                                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                            <AlertTriangle size={12} />
                                                            Lütfen 4 ile 8 haneli rakamlardan oluşan bir PIN belirleyin.
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Midnight Auto-Logout */}
                                                <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                                Gece 00:00&apos;da Oturumu Otomatik Kapat
                                                            </h5>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                                Açık bırakıldığında vardiya bitiminde unutulan masa telefonu oturumu her gece 00:00&apos;da otomatik olarak sonlandırılır.
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setHotdeskConfig((prev) => ({
                                                                    ...prev,
                                                                    auto_logout_midnight: !prev.auto_logout_midnight
                                                                }))
                                                            }
                                                            className={`transition-colors shrink-0 ${hotdeskConfig?.auto_logout_midnight ? text : "text-slate-400"}`}
                                                        >
                                                            {hotdeskConfig?.auto_logout_midnight ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                                        </button>
                                                    </div>
                                                    <div className={`p-2.5 rounded-xl border ${lightBg} ${borderLight} text-[10px] font-semibold ${text}`}>
                                                        Telefon yeniden başlatılmaz: Masa telefonundan <span className="font-mono font-extrabold">*75*{extension || "1001"}*PIN</span> ile giriş, <span className="font-mono font-extrabold">*76</span> ile çıkış yapılır.
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Active Sessions */}
                                            <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                        Aktif Masa Telefonu Oturumu
                                                    </h5>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {activeHotdeskSessions.length > 0 ? `${activeHotdeskSessions.length} Aktif Cihaz` : "Aktif Oturum Yok"}
                                                    </span>
                                                </div>
                                                {activeHotdeskSessions.length === 0 ? (
                                                    <p className="text-[11px] text-slate-400">
                                                        Bu dahili şu anda herhangi bir ortak masa telefonunda oturum açmamış.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {activeHotdeskSessions.map((sess) => (
                                                            <div
                                                                key={sess.device_sip_username}
                                                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                                                            >
                                                                <div>
                                                                    <div className="text-xs font-extrabold text-slate-800 dark:text-white font-mono">
                                                                        SIP Cihaz: {sess.device_sip_username}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                                        Giriş Zamanı: {sess.logged_in_at || "-"}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={hotdeskLogoutBusy}
                                                                    onClick={async () => {
                                                                        setHotdeskLogoutBusy(true);
                                                                        try {
                                                                            const res = await safeFetch(
                                                                                `/api/hotdesk/sessions/${encodeURIComponent(sess.device_sip_username)}`,
                                                                                { method: "DELETE" }
                                                                            );
                                                                            if (res.ok) {
                                                                                setActiveHotdeskSessions((prev) =>
                                                                                    prev.filter((x) => x.device_sip_username !== sess.device_sip_username)
                                                                                );
                                                                            }
                                                                        } finally {
                                                                            setHotdeskLogoutBusy(false);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                                                                >
                                                                    <Power size={13} />
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

                                {/* BENİ TAKİP ET (FOLLOW ME) */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all ${followMeEnabled ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${followMeEnabled ? (lightBg + " " + text) : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Smartphone size={18} />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-slate-800 dark:text-white">Beni Takip Et</h5>
                                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                                    Masa telefonu tek başına çalıyor ve yanıt verilmiyorsa, belirlenen saniye sonunda çağrıyı sırasıyla mobil uygulamaya veya mobil telefon numarasına yönlendirir.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFollowMeEnabled(!followMeEnabled)}
                                            className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 ml-3"
                                        >
                                            {followMeEnabled ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>

                                    {followMeEnabled && (
                                        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                            {/* Saniye Seçme Alanı */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5">
                                                    Çalma / Bekleme Süresi (Saniye)
                                                </label>
                                                <p className="text-[10px] text-slate-500 mb-2">
                                                    Masa telefonu kaç saniye çaldıktan sonra çağrı diğer hedeflere aktarılsın?
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="relative w-28">
                                                        <input
                                                            type="number"
                                                            min={5}
                                                            max={120}
                                                            value={followMeTimeout}
                                                            onChange={(e) => setFollowMeTimeout(Math.max(1, Math.min(120, Number(e.target.value) || 15)))}
                                                            className={`w-full text-xs font-bold px-3 py-2 pr-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                                                        />
                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                            sn
                                                        </span>
                                                    </div>
                                                    {[10, 15, 20, 30].map((sec) => (
                                                        <button
                                                            key={sec}
                                                            type="button"
                                                            onClick={() => setFollowMeTimeout(sec)}
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                                                Number(followMeTimeout) === sec
                                                                    ? (lightBg + " " + border + " " + text)
                                                                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                                                            }`}
                                                        >
                                                            {sec} sn
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 1. ve 2. Gideceği Yer Seçimi */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5">
                                                        1. Gideceği Yer (İlk Hedef)
                                                    </label>
                                                    <select
                                                        value={followMeFirstTarget}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFollowMeFirstTarget(val);
                                                            if (val === "mobile_app" && followMeSecondTarget === "mobile_app") {
                                                                setFollowMeSecondTarget("mobile_number");
                                                            } else if (val === "mobile_number" && followMeSecondTarget === "mobile_number") {
                                                                setFollowMeSecondTarget("mobile_app");
                                                            }
                                                        }}
                                                        className={`w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                                                    >
                                                        <option value="mobile_app">Mobil Uygulama</option>
                                                        <option value="mobile_number">Mobil Telefon Numarası</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5">
                                                        2. Gideceği Yer (İkinci Hedef)
                                                    </label>
                                                    <select
                                                        value={followMeSecondTarget}
                                                        onChange={(e) => setFollowMeSecondTarget(e.target.value)}
                                                        className={`w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                                                    >
                                                        <option value="mobile_number">Mobil Telefon Numarası</option>
                                                        <option value="mobile_app">Mobil Uygulama</option>
                                                        <option value="none">Yok (Sadece 1. Hedefe Gitsin)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Mobil Telefon Numarası Alanı */}
                                            {(followMeFirstTarget === "mobile_number" || followMeSecondTarget === "mobile_number") && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1.5">
                                                        Mobil Telefon Numarası (GSM)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Örn: 0532 123 45 67"
                                                        value={followMeMobileNumber}
                                                        onChange={(e) => setFollowMeMobileNumber(e.target.value)}
                                                        className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                                                    />
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        Mobil Telefon Numarası seçildiğinde çağrının yönlendirileceği cep telefonu numarası.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Akış Özeti */}
                                            <div className={`p-3 rounded-xl border ${lightBg} ${borderLight} flex items-center gap-2 text-[11px] font-bold ${text}`}>
                                                <Forward size={14} className="shrink-0" />
                                                <span>
                                                    Akış: Masa Telefonu ({followMeTimeout} sn) ➔ 1. {followMeFirstTarget === "mobile_app" ? "Mobil Uygulama" : `Mobil Telefon (${followMeMobileNumber || "Numara Girilmedi"})`}
                                                    {followMeSecondTarget !== "none" && (
                                                        <> ({followMeTimeout} sn) ➔ 2. {followMeSecondTarget === "mobile_app" ? "Mobil Uygulama" : `Mobil Telefon (${followMeMobileNumber || "Numara Girilmedi"})`}</>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* YÖNETİCİ - SEKRETER FİLTRESİ (BOSS / SECRETARY MODE) */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bossSecretary?.enabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Users size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">
                                                        Yönetici - Sekreter Filtresi (Boss / Secretary)
                                                    </h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${bossSecretary?.enabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {bossSecretary?.enabled ? "Aktif" : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    Aktifken yöneticiye gelen aramalar önce sekreter(ler)e düşer; yalnızca sekreterler ve VIP listesindeki numaralar yöneticiyi doğrudan çaldırabilir.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setBossSecretary((prev) => ({
                                                    ...prev,
                                                    enabled: !prev.enabled
                                                }))
                                            }
                                            className={`transition-colors ${bossSecretary?.enabled ? text : "text-slate-400"}`}
                                        >
                                            {bossSecretary?.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>

                                    {bossSecretary?.enabled && (
                                        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                            {/* Sekreter Seçimi */}
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Atanan Sekreter Dahilileri
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={newBossSecExt}
                                                        onChange={(e) => setNewBossSecExt(e.target.value)}
                                                        className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none"
                                                    >
                                                        <option value="">Sekreter Seçiniz...</option>
                                                        {users
                                                            .filter(
                                                                (u) =>
                                                                    u.extension &&
                                                                    String(u.extension) !== String(extension) &&
                                                                    !(bossSecretary?.secretaries || []).includes(String(u.extension))
                                                            )
                                                            .map((u) => (
                                                                <option key={u.id || u.extension} value={u.extension}>
                                                                    {u.full_name} ({u.extension})
                                                                </option>
                                                            ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!newBossSecExt) return;
                                                            setBossSecretary((prev) => ({
                                                                ...prev,
                                                                secretaries: [...new Set([...(prev.secretaries || []), String(newBossSecExt)])]
                                                            }));
                                                            setNewBossSecExt("");
                                                        }}
                                                        title="Sekreter Ekle"
                                                        className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {(bossSecretary?.secretaries || []).length === 0 ? (
                                                        <span className="text-[10px] text-slate-400 italic">Henüz sekreter seçilmedi.</span>
                                                    ) : (
                                                        (bossSecretary?.secretaries || []).map((secExt) => {
                                                            const matchedSec = users.find((u) => String(u.extension) === String(secExt));
                                                            return (
                                                                <span
                                                                    key={secExt}
                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold ${lightBg} ${text} border ${borderLight}`}
                                                                >
                                                                    {matchedSec ? `${matchedSec.full_name} (${secExt})` : `Dahili ${secExt}`}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setBossSecretary((prev) => ({
                                                                                ...prev,
                                                                                secretaries: (prev.secretaries || []).filter((x) => x !== secExt)
                                                                            }))
                                                                        }
                                                                        className="opacity-70 hover:opacity-100"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* VIP Doğrudan Erişim Listesi */}
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    VIP Doğrudan Erişim Listesi (Dahili veya GSM)
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={newBossVipExt}
                                                        onChange={(e) => setNewBossVipExt(e.target.value.replace(/[^\d+]/g, ""))}
                                                        onKeyDown={(e) => {
                                                            if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                const v = newBossVipExt.trim();
                                                                if (!v) return;
                                                                setBossSecretary((prev) => ({
                                                                    ...prev,
                                                                    vip_whitelist: [...new Set([...(prev.vip_whitelist || []), v])]
                                                                }));
                                                                setNewBossVipExt("");
                                                            }
                                                        }}
                                                        placeholder="Örn: 1002 veya 05321234567"
                                                        className="flex-1 text-xs font-mono font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const v = newBossVipExt.trim();
                                                            if (!v) return;
                                                            setBossSecretary((prev) => ({
                                                                ...prev,
                                                                vip_whitelist: [...new Set([...(prev.vip_whitelist || []), v])]
                                                            }));
                                                            setNewBossVipExt("");
                                                        }}
                                                        title="VIP Numara Ekle"
                                                        className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {(bossSecretary?.vip_whitelist || []).length === 0 ? (
                                                        <span className="text-[10px] text-slate-400 italic">Sekreter harici doğrudan çaldırabilecek numara yok.</span>
                                                    ) : (
                                                        (bossSecretary?.vip_whitelist || []).map((vipNum) => (
                                                            <span
                                                                key={vipNum}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                                            >
                                                                {vipNum}
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setBossSecretary((prev) => ({
                                                                            ...prev,
                                                                            vip_whitelist: (prev.vip_whitelist || []).filter((x) => x !== vipNum)
                                                                        }))
                                                                    }
                                                                    className="text-slate-400 hover:text-rose-500"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`md:col-span-2 p-2.5 rounded-xl border ${lightBg} ${borderLight} text-[11px] font-semibold ${text}`}>
                                                Masa telefonundan hızlı aç/kapat: Yönetici kendi telefonundan <span className="font-mono font-extrabold">*74</span>, sekreter ise kendi telefonundan <span className="font-mono font-extrabold">*74*{extension || "1000"}</span> tuşlayabilir.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div ref={twoFactorCardRef} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${twoFactorEnabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Shield size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">İki Aşamalı Doğrulama (2FA)</h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${twoFactorEnabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {twoFactorEnabled ? "Aktif" : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Kullanıcı sisteme girerken ikinci aşama doğrulama kodu sorulsun mu?</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextVal = !twoFactorEnabled;
                                                setTwoFactorEnabled(nextVal);
                                                setTwoFactorStatusMsg(null);
                                                if (nextVal && (!twoFactorMethod || twoFactorMethod === "app")) {
                                                    setTwoFactorMethod("google_auth");
                                                }
                                                if (nextVal) {
                                                    scrollTwoFactorCardIntoPane();
                                                }
                                            }}
                                            className="text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            {twoFactorEnabled ? <ToggleRight size={32} className={`${text}`} /> : <ToggleLeft size={32} />}
                                        </button>
                                    </div>
                                    
                                    {twoFactorEnabled && (
                                        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                            {/* DOĞRULAMA MODU (TEK YÖNTEM / 2 AŞAMALI ZORUNLU / YEDEKLİ) */}
                                            <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                            Doğrulama Çalışma Modu (Tek / 2 Aşamalı 2FA)
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            İsterseniz tek bir yöntem, isterseniz aynı anda hem E-Posta hem Google Authenticator (2 Aşamalı) kullanabilirsiniz.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {[
                                                        {
                                                            mode: "single",
                                                            title: "Tek Yöntem (Standart)",
                                                            desc: "Sadece seçili olan tek doğrulama yöntemi sorulur"
                                                        },
                                                        {
                                                            mode: "all",
                                                            title: "2 Aşamalı Zorunlu (VE Modu)",
                                                            desc: "Örn: Önce E-Posta kodu, ardından Google Authenticator zorunlu"
                                                        },
                                                        {
                                                            mode: "any",
                                                            title: "Esnek / Yedekli (VEYA Modu)",
                                                            desc: "Seçili yöntemlerden herhangi biriyle giriş yapılabilir"
                                                        }
                                                    ].map((opt) => {
                                                        const isModeActive = twoFactorMultiMode === opt.mode;
                                                        return (
                                                            <button
                                                                key={opt.mode}
                                                                type="button"
                                                                onClick={() => {
                                                                    setTwoFactorMultiMode(opt.mode);
                                                                    if (opt.mode === "single") {
                                                                        const keepM = twoFactorMethod || twoFactorActiveMethods[0] || "google_auth";
                                                                        setTwoFactorActiveMethods([keepM]);
                                                                        setTwoFactorMethod(keepM);
                                                                        activeTwoFactorMethodRef.current = keepM;
                                                                    } else {
                                                                        let nextList = Array.isArray(twoFactorActiveMethods) ? [...twoFactorActiveMethods] : [];
                                                                        if (nextList.length < 2) {
                                                                            const curr = nextList[0] || twoFactorMethod || "google_auth";
                                                                            if (curr === "google_auth" || curr === "microsoft_auth") {
                                                                                nextList = ["email", curr];
                                                                            } else {
                                                                                nextList = [curr, "google_auth"];
                                                                            }
                                                                        }
                                                                        setTwoFactorActiveMethods(nextList);
                                                                        if (nextList.includes("google_auth") && !twoFactorMethodsMap?.google_auth?.qrSvg) {
                                                                            fetchTwoFactorSetup(false, "google_auth");
                                                                        }
                                                                        if (nextList.includes("microsoft_auth") && !twoFactorMethodsMap?.microsoft_auth?.qrSvg) {
                                                                            fetchTwoFactorSetup(false, "microsoft_auth");
                                                                        }
                                                                    }
                                                                }}
                                                                className={`p-2.5 rounded-xl text-left border transition-all ${
                                                                    isModeActive
                                                                        ? `${lightBg} ${border} ring-2 ${ring}`
                                                                        : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1.5">
                                                                    <span className={`text-[11px] font-extrabold ${isModeActive ? text : "text-slate-800 dark:text-slate-100"}`}>
                                                                        {opt.title}
                                                                    </span>
                                                                    {isModeActive && <CheckCircle size={13} className={text} />}
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1">
                                                                    {opt.desc}
                                                                </p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <label className="block text-xs font-bold text-slate-800 dark:text-white">
                                                        {twoFactorMultiMode === "single"
                                                            ? "2FA Doğrulama Yöntemi Seçiniz"
                                                            : "Aktif 2FA Doğrulama Yöntemlerini Seçiniz (Birden Fazla Seçilebilir)"}
                                                    </label>
                                                    {twoFactorMultiMode !== "single" && twoFactorActiveMethods.length >= 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setTwoFactorActiveMethods((prev) => [...prev].reverse());
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                                                        >
                                                            <RefreshCw size={11} />
                                                            Doğrulama Sırasını Değiştir (1 ⇄ 2)
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                    {[
                                                        {
                                                            id: "email",
                                                            title: "E-Posta (E-Mail)",
                                                            desc: "Girişte e-posta adresine 6 haneli tek kullanımlık kod gönderilir",
                                                            icon: Mail
                                                        },
                                                        {
                                                            id: "whatsapp",
                                                            title: "WhatsApp (Giriş Kodu)",
                                                            desc: "WhatsApp'a 'Giriş Kodu' yazıldığında 5 dk geçerli ücretsiz kod yanıtlanır",
                                                            icon: PhoneCall
                                                        },
                                                        {
                                                            id: "google_auth",
                                                            title: "Google Authenticator",
                                                            desc: "Google Authenticator mobil uygulaması ile 30 sn'lik kod üretilir",
                                                            icon: Smartphone
                                                        },
                                                        {
                                                            id: "microsoft_auth",
                                                            title: "Microsoft Authenticator",
                                                            desc: "Microsoft Authenticator mobil uygulaması ile 30 sn'lik kod üretilir",
                                                            icon: KeyRound
                                                        }
                                                    ].map((m) => {
                                                        const IconComp = m.icon;
                                                        const isFocused = twoFactorMethod === m.id || (m.id === "google_auth" && twoFactorMethod === "app");
                                                        const activeIdx = twoFactorActiveMethods.indexOf(m.id);
                                                        const isActiveMethod = twoFactorMultiMode === "single" ? isFocused : activeIdx !== -1;

                                                        const focusMethodSetup = (methodId) => {
                                                            activeTwoFactorMethodRef.current = methodId;
                                                            setTwoFactorMethod(methodId);
                                                            setTwoFactorStatusMsg(null);
                                                            setTwoFactorTestCode("");
                                                            const cachedM = twoFactorMethodsMap[methodId] || {};
                                                            setTwoFactorEnrolled(Boolean(cachedM.enrolled));
                                                            if (methodId === "google_auth" || methodId === "microsoft_auth") {
                                                                setTwoFactorSecret(cachedM.secret || "");
                                                                setTwoFactorQrSvg(cachedM.qrSvg || "");
                                                                if (!cachedM.qrSvg) {
                                                                    fetchTwoFactorSetup(false, methodId);
                                                                }
                                                            }
                                                            scrollTwoFactorCardIntoPane();
                                                        };

                                                        return (
                                                            <div
                                                                key={m.id}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => {
                                                                    if (twoFactorMultiMode === "single") {
                                                                        setTwoFactorActiveMethods([m.id]);
                                                                        focusMethodSetup(m.id);
                                                                    } else {
                                                                        if (!isActiveMethod) {
                                                                            const nextAct = [...twoFactorActiveMethods, m.id];
                                                                            setTwoFactorActiveMethods(nextAct);
                                                                        }
                                                                        focusMethodSetup(m.id);
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" || e.key === " ") {
                                                                        e.preventDefault();
                                                                        e.currentTarget.click();
                                                                    }
                                                                }}
                                                                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                                                    isActiveMethod
                                                                        ? `${lightBg} ${border} ${isFocused ? `ring-2 ${ring}` : ""}`
                                                                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-900"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between w-full gap-1">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActiveMethod ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                                        <IconComp size={14} />
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {twoFactorMultiMode === "all" && isActiveMethod && (
                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white ${bg}`}>
                                                                                {activeIdx + 1}. Aşama
                                                                            </span>
                                                                        )}
                                                                        {twoFactorMultiMode === "any" && isActiveMethod && (
                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white ${bg}`}>
                                                                                Aktif
                                                                            </span>
                                                                        )}
                                                                        {twoFactorMultiMode !== "single" && isActiveMethod && twoFactorActiveMethods.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                title="Bu yöntemi zincirden çıkar"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const filtered = twoFactorActiveMethods.filter((id) => id !== m.id);
                                                                                    const safeNext = filtered.length > 0 ? filtered : ["google_auth"];
                                                                                    setTwoFactorActiveMethods(safeNext);
                                                                                    if (safeNext.length <= 1) {
                                                                                        setTwoFactorMultiMode("single");
                                                                                    }
                                                                                    if (isFocused && safeNext[0]) {
                                                                                        focusMethodSetup(safeNext[0]);
                                                                                    }
                                                                                }}
                                                                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-200"
                                                                            >
                                                                                Çıkar
                                                                            </button>
                                                                        )}
                                                                        {twoFactorMultiMode === "single" && !isActiveMethod && (
                                                                            <button
                                                                                type="button"
                                                                                title="Mevcut yöntemle birlikte 2 aşamalı olarak kullan"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const currPrimary = twoFactorMethod || "google_auth";
                                                                                    const combined = currPrimary === m.id ? [m.id] : [currPrimary, m.id];
                                                                                    setTwoFactorMultiMode("all");
                                                                                    setTwoFactorActiveMethods(combined);
                                                                                    focusMethodSetup(m.id);
                                                                                }}
                                                                                className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                                            >
                                                                                + Birlikte Kullan
                                                                            </button>
                                                                        )}
                                                                        {isActiveMethod && <CheckCircle size={14} className={text} />}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className={`text-xs font-extrabold ${isActiveMethod ? text : "text-slate-800 dark:text-slate-100"}`}>
                                                                        {m.title}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                                                        {m.desc}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {twoFactorMultiMode !== "single" && twoFactorActiveMethods.length > 1 && (
                                                    <div className="mt-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400">
                                                                {twoFactorMultiMode === "all" ? "Giriş Doğrulama Sırası:" : "Aktif Alternatif Yöntemler:"}
                                                            </span>
                                                            {twoFactorActiveMethods.map((mId, idx) => {
                                                                const labelMap = {
                                                                    email: "E-Posta (E-Mail)",
                                                                    whatsapp: "WhatsApp",
                                                                    google_auth: "Google Authenticator",
                                                                    microsoft_auth: "Microsoft Authenticator"
                                                                };
                                                                const isCurrFocused = twoFactorMethod === mId;
                                                                return (
                                                                    <React.Fragment key={mId}>
                                                                        {idx > 0 && (
                                                                            <span className="text-slate-400 font-bold">
                                                                                {twoFactorMultiMode === "all" ? "➔" : "veya"}
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                activeTwoFactorMethodRef.current = mId;
                                                                                setTwoFactorMethod(mId);
                                                                                const cachedM = twoFactorMethodsMap[mId] || {};
                                                                                setTwoFactorEnrolled(Boolean(cachedM.enrolled));
                                                                                if (mId === "google_auth" || mId === "microsoft_auth") {
                                                                                    setTwoFactorSecret(cachedM.secret || "");
                                                                                    setTwoFactorQrSvg(cachedM.qrSvg || "");
                                                                                    if (!cachedM.qrSvg) {
                                                                                        fetchTwoFactorSetup(false, mId);
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                                                                                isCurrFocused
                                                                                    ? `${bg} text-white shadow-sm`
                                                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                                                                            }`}
                                                                        >
                                                                            {twoFactorMultiMode === "all" ? `${idx + 1}. ${labelMap[mId] || mId}` : (labelMap[mId] || mId)}
                                                                            {" (Ayarları Göster)"}
                                                                        </button>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* METHOD 1: E-MAIL OTP DETAILS */}
                                            {twoFactorMethod === "email" && (
                                                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div>
                                                            <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                                                <Mail size={14} className={text} />
                                                                Hedef E-Posta Adresi:
                                                                <span className="font-mono text-slate-700 dark:text-slate-200">
                                                                    {email && email.includes("@") ? email : "Tanımlanmadı"}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                                Kullanıcı giriş yaptığında 6 haneli doğrulama kodu bu e-posta adresine gönderilecektir.
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleSendTestEmailOtp}
                                                            disabled={twoFactorEmailSending || !email || !email.includes("@")}
                                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${bg} ${hover}`}
                                                        >
                                                            <RefreshCw size={12} className={twoFactorEmailSending ? "animate-spin" : ""} />
                                                            {twoFactorEmailSending ? "Gönderiliyor..." : "Test Kodu Gönder"}
                                                        </button>
                                                    </div>

                                                    {(!email || !email.includes("@")) && (
                                                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                                            <AlertTriangle size={14} className="shrink-0" />
                                                            Lütfen önce "Genel" sekmesinden kullanıcıya geçerli bir E-Posta adresi giriniz.
                                                        </div>
                                                    )}

                                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                                                            placeholder="E-postaya gelen 6 haneli test kodunu girin"
                                                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleVerifyTest2faCode}
                                                            disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold transition-all disabled:opacity-50 shrink-0"
                                                        >
                                                            {twoFactorVerifyLoading ? "Doğrulanıyor..." : "Kodu Test Et & Onayla"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* METHOD 2: WHATSAPP ("GİRİŞ KODU") DETAILS */}
                                            {twoFactorMethod === "whatsapp" && (
                                                <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <PhoneCall size={15} className={text} />
                                                            <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                                WhatsApp İki Faktörlü Doğrulama ("Giriş Kodu" Sistemi)
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                                %100 Ücretsiz • 5 Dk Geçerli
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                                        <div>
                                                            <label htmlFor="usersettings-2fa-whatsapp-phone" className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                                                Kullanıcının WhatsApp / GSM Numarası
                                                            </label>
                                                            <input
                                                                id="usersettings-2fa-whatsapp-phone"
                                                                type="tel"
                                                                inputMode="tel"
                                                                autoComplete="tel"
                                                                autoCorrect="off"
                                                                autoCapitalize="off"
                                                                spellCheck={false}
                                                                placeholder="Örn: 0532 123 45 67"
                                                                value={followMeMobileNumber}
                                                                onChange={(e) => setFollowMeMobileNumber(e.target.value)}
                                                                className={`w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href="https://wa.me/908503607390?text=Giri%C5%9F%20Kodu"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex-1 px-3 py-2 rounded-lg text-[11px] font-bold text-center bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                                                            >
                                                                WhatsApp'ta "Giriş Kodu" Aç
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={handleSendTestWhatsAppOtp}
                                                                disabled={twoFactorEmailSending || (followMeMobileNumber || "").replace(/\D/g, "").length < 10}
                                                                className={`px-3 py-2 rounded-lg text-[11px] font-bold text-white transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${bg} ${hover}`}
                                                            >
                                                                <RefreshCw size={12} className={twoFactorEmailSending ? "animate-spin" : ""} />
                                                                {twoFactorEmailSending ? "Gönderiliyor..." : "Test Kodu Gönder"}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed">
                                                        <div className="font-bold text-slate-800 dark:text-white">Nasıl Çalışır?</div>
                                                        <p>1. Kullanıcı WhatsApp üzerinden sistem hattımıza (<strong>0850 360 7390</strong>) <strong>"Giriş Kodu"</strong> mesajı gönderir.</p>
                                                        <p>2. Sistem numarayı otomatik tanır ve <strong>5 dakika (300 saniye)</strong> geçerli 6 haneli doğrulama kodunu anında ücretsiz yanıtlar.</p>
                                                        <p>3. Kullanıcı sisteme girerken kullanıcı adı, şifre ve WhatsApp'a gelen 6 haneli kodu yazarak giriş yapar.</p>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                                                            placeholder="WhatsApp'a gelen 6 haneli kodu test edin"
                                                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleVerifyTest2faCode}
                                                            disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold transition-all disabled:opacity-50 shrink-0"
                                                        >
                                                            {twoFactorVerifyLoading ? "Doğrulanıyor..." : "Kodu Test Et & Onayla"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* METHOD 3 & 4: GOOGLE / MICROSOFT AUTHENTICATOR QR & SECRET */}
                                            {(twoFactorMethod === "google_auth" || twoFactorMethod === "microsoft_auth" || twoFactorMethod === "app") && (
                                                <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                                {twoFactorMethod === "microsoft_auth" ? "Microsoft Authenticator Kurulumu" : "Google Authenticator Kurulumu"}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                twoFactorEnrolled
                                                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                                                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                                            }`}>
                                                                {twoFactorEnrolled ? "✓ Cihaz Eşleştirildi" : "İlk Girişte veya Aşağıdan Eşleştirilebilir"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => fetchTwoFactorSetup(true, twoFactorMethod)}
                                                            disabled={twoFactorSetupLoading}
                                                            className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <RefreshCw size={11} className={twoFactorSetupLoading ? "animate-spin" : ""} />
                                                            Yeni QR / Anahtar Üret
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                                        <div className="w-36 h-36 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white p-2 flex items-center justify-center shrink-0 shadow-sm">
                                                            {twoFactorSetupLoading ? (
                                                                <RefreshCw size={24} className="animate-spin text-slate-400" />
                                                            ) : twoFactorQrSvg ? (
                                                                <img src={twoFactorQrSvg} alt="2FA QR Code" className="w-full h-full object-contain" />
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 text-center px-2">QR Kod Yükleniyor...</span>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 space-y-2.5 w-full">
                                                            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed">
                                                                <p className="font-bold text-slate-800 dark:text-white">Nasıl Eşleştirilir?</p>
                                                                <p>1. Telefonunuzda <strong>{twoFactorMethod === "microsoft_auth" ? "Microsoft Authenticator" : "Google Authenticator"}</strong> uygulamasını açın.</p>
                                                                <p>2. <strong>+ (Hesap Ekle)</strong> menüsünden <strong>QR Kodu Tara</strong> seçeneği ile yandaki kodu okutun (veya kullanıcı ilk girişinde kendi ekranından okutabilir).</p>
                                                            </div>

                                                            <div>
                                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                                                    Manuel Kurulum Anahtarı (Secret Key)
                                                                </label>
                                                                <div className="flex items-center gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        value={twoFactorSecret || "Üretiliyor..."}
                                                                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 outline-none"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={copyTwoFactorSecret}
                                                                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                                                                        title="Anahtarı Kopyala"
                                                                    >
                                                                        {twoFactorSecretCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                                                        {twoFactorSecretCopied ? "Kopyalandı" : "Kopyala"}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                                                                    placeholder="Uygulamadaki 6 haneli kodu test edin"
                                                                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tracking-widest text-slate-800 dark:text-white outline-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleVerifyTest2faCode}
                                                                    disabled={twoFactorVerifyLoading || twoFactorTestCode.length !== 6}
                                                                    className={`px-3.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all disabled:opacity-50 shrink-0 ${bg} ${hover}`}
                                                                >
                                                                    {twoFactorVerifyLoading ? "Doğrulanıyor..." : "Test Et & Eşleştir"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {twoFactorStatusMsg && (
                                                <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 ${
                                                    twoFactorStatusMsg.type === "success"
                                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                                }`}>
                                                    {twoFactorStatusMsg.type === "success" ? <CheckCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                                                    <span>{twoFactorStatusMsg.text}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ARAYÜZ OTURUM SÜRESİ & OTOMATİK EKRAN KAPATMA */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all ${autoLogoutEnabled ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${autoLogoutEnabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Clock size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">Arayüz Oturum Süresi & Otomatik Ekran Kapatma</h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoLogoutEnabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {autoLogoutEnabled ? `${autoLogoutDuration} Saat` : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Belirtilen süre boyunca işlem yapılmadığında kullanıcının web/masaüstü oturumu otomatik olarak sonlandırılır.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoLogoutEnabled(!autoLogoutEnabled)}
                                            className={`transition-colors shrink-0 ${autoLogoutEnabled ? text : "text-slate-400"}`}
                                        >
                                            {autoLogoutEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>
                                    {autoLogoutEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-3 gap-2.5 animate-in fade-in duration-200">
                                            {[
                                                { label: "1 Saat", value: 1, desc: "60 dakika hareketsizlik" },
                                                { label: "2 Saat", value: 2, desc: "120 dakika hareketsizlik" },
                                                { label: "3 Saat", value: 3, desc: "180 dakika hareketsizlik" }
                                            ].map((opt) => {
                                                const isSel = Number(autoLogoutDuration) === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setAutoLogoutDuration(opt.value)}
                                                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                            isSel
                                                                ? `${lightBg} ${border} ring-2 ${ring}`
                                                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between w-full mb-1">
                                                            <span className={`text-xs font-extrabold ${isSel ? text : "text-slate-800 dark:text-white"}`}>{opt.label}</span>
                                                            {isSel && <CheckCircle size={14} className={text} />}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">{opt.desc}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* ŞİFRE GEÇERLİLİK SÜRESİ (ZORUNLU ŞİFRE DEĞİŞİMİ) */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all ${passwordExpiryEnabled ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${passwordExpiryEnabled ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Lock size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">Şifre Geçerlilik Süresi (Zorunlu Değişim)</h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${passwordExpiryEnabled ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {passwordExpiryEnabled ? `${passwordExpiryMonths} Ay` : "Süresiz"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Kullanıcı şifresinin belirli periyotlarla zorunlu olarak yenilenmesini sağlar.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPasswordExpiryEnabled(!passwordExpiryEnabled)}
                                            className={`transition-colors shrink-0 ${passwordExpiryEnabled ? text : "text-slate-400"}`}
                                        >
                                            {passwordExpiryEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>
                                    {passwordExpiryEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-in fade-in duration-200">
                                            {[
                                                { label: "1 Ay", value: 1, desc: "30 günde bir" },
                                                { label: "3 Ay", value: 3, desc: "90 günde bir" },
                                                { label: "6 Ay", value: 6, desc: "180 günde bir" },
                                                { label: "12 Ay", value: 12, desc: "365 günde bir" }
                                            ].map((opt) => {
                                                const isSel = Number(passwordExpiryMonths) === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setPasswordExpiryMonths(opt.value)}
                                                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                                            isSel
                                                                ? `${lightBg} ${border} ring-2 ${ring}`
                                                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between w-full mb-0.5">
                                                            <span className={`text-xs font-extrabold ${isSel ? text : "text-slate-800 dark:text-white"}`}>{opt.label}</span>
                                                            {isSel && <CheckCircle size={13} className={text} />}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">{opt.desc}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* GELEN ÇAĞRIDA MÜŞTERİ 360° KARTINI OTOMATİK AÇ */}
                                <div className={`p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border transition-all ${userCallPanelPrefs?.autoOpenCustomer360OnCall ? border : "border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${userCallPanelPrefs?.autoOpenCustomer360OnCall ? `${lightBg} ${text}` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"}`}>
                                                <Sparkles size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">Gelen Çağrıda Müşteri 360° Kartını Otomatik Aç</h5>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${userCallPanelPrefs?.autoOpenCustomer360OnCall ? `${lightBg} ${text} border ${border}` : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                                        {userCallPanelPrefs?.autoOpenCustomer360OnCall ? "Aktif" : "Pasif"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Web Telefon çaldığında arayan müşterinin geçmiş çağrı, WhatsApp ve VIP notlarını otomatik olarak sağ çekmecede açar.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setUserCallPanelPrefs((prev) => ({
                                                    ...(prev || {}),
                                                    autoOpenCustomer360OnCall: !Boolean(prev?.autoOpenCustomer360OnCall)
                                                }))
                                            }
                                            className={`transition-colors shrink-0 ${userCallPanelPrefs?.autoOpenCustomer360OnCall ? text : "text-slate-400"}`}
                                        >
                                            {userCallPanelPrefs?.autoOpenCustomer360OnCall ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>
                                </div>

                                {/* WEB TELEFON ZİL SESİ, AI GÜRÜLTÜ ENGELLEME & MASAÜSTÜ BİLDİRİMLERİ */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${lightBg} ${text}`}>
                                            <Volume2 size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-white">
                                                Web Telefon Zil Sesi, AI Gürültü Engelleme & Masaüstü Bildirim Tercihleri
                                            </h5>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Kullanıcının varsayılan çağrı zil melodisini, ses seviyesini, mikrofon AI gürültü filtresini ve masaüstü bildirimlerini yapılandırın.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                                        {/* Çağrı Zil Sesi */}
                                        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                                Çağrı Zil Sesi Melodisi
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={userCallPanelPrefs?.ringtone || "classic"}
                                                    onChange={(e) => {
                                                        const nextRing = e.target.value;
                                                        stopRingtoneSound();
                                                        setIsPreviewingUserRingtone(false);
                                                        setUserCallPanelPrefs((prev) => ({ ...(prev || {}), ringtone: nextRing }));
                                                    }}
                                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
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
                                                        if (isPreviewingUserRingtone) {
                                                            stopRingtoneSound();
                                                            setIsPreviewingUserRingtone(false);
                                                        } else {
                                                            setIsPreviewingUserRingtone(true);
                                                            playRingtoneSound(userCallPanelPrefs?.ringtone || "classic");
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0"
                                                >
                                                    {isPreviewingUserRingtone ? (
                                                        <>
                                                            <Square size={12} className="text-rose-500 fill-rose-500" />
                                                            <span>Durdur</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={12} className={text} />
                                                            <span>Dinle</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3 pt-1">
                                                <span className="text-[10px] font-bold text-slate-500 shrink-0">Zil Ses Seviyesi:</span>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="1"
                                                    step="0.05"
                                                    value={userCallPanelPrefs?.ringtoneVolume ?? 0.85}
                                                    onChange={(e) => {
                                                        const vol = Math.max(0.1, Math.min(1, parseFloat(e.target.value) || 0.85));
                                                        setSavedRingtoneVolume(vol);
                                                        setUserCallPanelPrefs((prev) => ({ ...(prev || {}), ringtoneVolume: vol }));
                                                    }}
                                                    className="flex-1 accent-primary cursor-pointer h-1.5 rounded-lg"
                                                />
                                                <span className={`text-[11px] font-extrabold font-mono w-10 text-right ${text}`}>
                                                    %{Math.round((userCallPanelPrefs?.ringtoneVolume ?? 0.85) * 100)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* AI Gürültü Engelleme */}
                                        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                                Yapay Zeka (AI) Mikrofon Gürültü Engelleme
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: "ai", title: "Yapay Zeka (AI)", desc: "RNNoise + Yan Ses Kesici" },
                                                    { id: "standard", title: "Standart", desc: "Tarayıcı Filtresi" },
                                                    { id: "off", title: "Kapalı", desc: "Ham Mikrofon" }
                                                ].map((opt) => {
                                                    const active = (userCallPanelPrefs?.noiseSuppressionMode || "ai") === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setUserCallPanelPrefs((prev) => ({
                                                                    ...(prev || {}),
                                                                    noiseSuppressionMode: opt.id
                                                                }))
                                                            }
                                                            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                                                                active
                                                                    ? `${lightBg} ${border} ring-1 ${ring}`
                                                                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className={`text-[10px] font-extrabold ${active ? text : "text-slate-700 dark:text-slate-200"}`}>
                                                                    {opt.title}
                                                                </span>
                                                                {active && <Check size={12} className={text} />}
                                                            </div>
                                                            <span className="text-[9px] text-slate-400 leading-tight">{opt.desc}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Masaüstü & Gelen Çağrı Bildirimleri */}
                                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <BellRing size={14} className={text} />
                                            <span className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                Masaüstü & Gelen Çağrı Bildirim Tercihleri
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                { key: "osNotifications", label: "Sistem Bildirimlerini Göster (Arka Plan Çağrı & Mesaj)" },
                                                { key: "popWindowOnCall", label: "Çağrı Geldiğinde Pencereyi Otomatik Öne Getir" },
                                                { key: "minimizeToTray", label: "Pencere Kapatıldığında (X) Sistem Tepsisinde Açık Tut" },
                                                { key: "startOnBoot", label: "Bilgisayar Açıldığında AIDA Agent Otomatik Başlasın" }
                                            ].map((dpItem) => {
                                                const checked = Boolean(userCallPanelPrefs?.desktopPrefs?.[dpItem.key]);
                                                return (
                                                    <label
                                                        key={dpItem.key}
                                                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 cursor-pointer"
                                                    >
                                                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                            {dpItem.label}
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const val = e.target.checked;
                                                                setUserCallPanelPrefs((prev) => ({
                                                                    ...(prev || {}),
                                                                    desktopPrefs: {
                                                                        ...(prev?.desktopPrefs || {}),
                                                                        [dpItem.key]: val
                                                                    }
                                                                }));
                                                            }}
                                                            className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                                                        />
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: AVATAR */}
                        {activeTab === "avatar" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                {/* Custom Upload & Current Preview Card */}
                                <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-800 shadow-lg bg-white dark:bg-slate-950 overflow-hidden shrink-0">
                                            <img src={avatar} alt="Seçili Avatar" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                                Aktif Profil Görseli
                                            </span>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                                                Kendi Avatarınızı Yükleyin veya Hazır Seçin
                                            </h5>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                Bilgisayarınızdan PNG, JPG, WEBP, GIF veya SVG formatında görsel yükleyebilirsiniz.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                                        <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center justify-center gap-2 ${bg} ${hover}`}>
                                            <Upload size={15} />
                                            <span>Bilgisayardan Avatar Yükle</span>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    if (file.size > 5 * 1024 * 1024) {
                                                        setError("Avatar dosyası en fazla 5 MB olabilir.");
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const dataUrl = ev.target?.result;
                                                        if (typeof dataUrl === "string") {
                                                            if (file.type === "image/svg+xml" || file.type === "image/gif") {
                                                                setAvatar(dataUrl);
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
                                                                    setAvatar(canvas.toDataURL("image/webp", 0.9));
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
                                </div>

                                {/* Preset Avatars Grid */}
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                Hazır Avatar Koleksiyonu ({ALL_AVATAR_ITEMS.length} Seçenek)
                                            </label>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                Telifsiz kamu malı efsaneler ve özgün sinema karakterleri dahildir
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Avatar kategori filtresi">
                                            {AVATAR_CATEGORIES.map((cat) => {
                                                const isActiveCat = avatarCategoryFilter === cat.id;
                                                const catCount = cat.id === "all"
                                                    ? ALL_AVATAR_ITEMS.length
                                                    : ALL_AVATAR_ITEMS.filter((a) => a.category === cat.id).length;
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        aria-pressed={isActiveCat}
                                                        onClick={() => setAvatarCategoryFilter(cat.id)}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 ${ring} ${
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
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-h-[340px] overflow-y-auto p-1">
                                        {ALL_AVATAR_ITEMS.filter((item) => avatarCategoryFilter === "all" || item.category === avatarCategoryFilter).map((item) => {
                                            const isSelected = avatar === item.url;
                                            const shortLabel = item.label.split(" (")[0];
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    aria-label={item.label}
                                                    aria-pressed={isSelected}
                                                    title={item.label}
                                                    onClick={() => setAvatar(item.url)}
                                                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 transition-all p-2 bg-slate-50 dark:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                                                        isSelected
                                                            ? `${border} ${lightBg} shadow-md scale-[1.03]`
                                                            : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                                    }`}
                                                >
                                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                                                        <img
                                                            src={item.url}
                                                            alt=""
                                                            loading="lazy"
                                                            fetchpriority="low"
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-semibold leading-tight truncate w-full text-center ${
                                                        isSelected ? text : "text-slate-600 dark:text-slate-400"
                                                    }`}>
                                                        {shortLabel}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 1. Arayüz Görünüm Şablonu (UI Template) */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                                                <Layers size={16} />
                                            </div>
                                            <div>
                                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                    Arayüz Görünüm Şablonu
                                                </h5>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Kullanıcının panelde göreceği tasarım şablonunu seçin (Klasik, Executive, Aurora, Bento, Linear, OLED).
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${lightBg} ${text} ${border}`}>
                                            Aktif: {(SYSTEM_UI_TEMPLATES.find((t) => t.id === normalizeUiTemplate(userCallPanelPrefs?.uiTemplate)) || SYSTEM_UI_TEMPLATES[0]).name}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                        {SYSTEM_UI_TEMPLATES.map((tpl) => {
                                            const isSelected = normalizeUiTemplate(userCallPanelPrefs?.uiTemplate) === tpl.id;
                                            return (
                                                <button
                                                    key={tpl.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setUserCallPanelPrefs((prev) => ({
                                                            ...(prev || {}),
                                                            uiTemplate: tpl.id
                                                        }));
                                                        if (tpl.autoDark && themeMode !== "dark") {
                                                            setThemeMode("dark");
                                                        }
                                                    }}
                                                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                                                        isSelected
                                                            ? `${lightBg} ${border} ring-2 ${ring} shadow-sm`
                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className={`text-xs font-extrabold truncate ${isSelected ? text : "text-slate-800 dark:text-white"}`}>
                                                                {tpl.name}
                                                            </span>
                                                            {tpl.badge && (
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${lightBg} ${text}`}>
                                                                    {tpl.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isSelected && <CheckCircle size={14} className={`${text} shrink-0`} />}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 leading-snug">
                                                        {tpl.desc}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. Sistem Tema Rengi Seçimi */}
                                {(() => {
                                    const safeThemeVal = getSafeThemeColor(themeColor);
                                    const currentThemeHex = rgbStringToHex(safeThemeVal);
                                    const matchedPreset = SYSTEM_THEME_PRESETS.find((t) => t.value === safeThemeVal);
                                    const isCustomTheme = !matchedPreset;
                                    return (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                                                        <Palette size={16} />
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Sistem Tema Rengi
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Kullanıcının ekranındaki birincil vurgu ve buton rengini belirleyin.
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                                                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: currentThemeHex }} />
                                                    <span>{matchedPreset ? matchedPreset.name : `Özel (${currentThemeHex.toUpperCase()})`}</span>
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 gap-2">
                                                {SYSTEM_THEME_PRESETS.map((t) => (
                                                    <button
                                                        key={t.value}
                                                        type="button"
                                                        onClick={() => setThemeColor(getSafeThemeColor(t.value))}
                                                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                                            safeThemeVal === t.value
                                                                ? "border-slate-800 dark:border-white ring-2 ring-slate-800/10 dark:ring-white/10 bg-white dark:bg-slate-800"
                                                                : "bg-white/70 dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 hover:border-slate-300"
                                                        }`}
                                                        title={`${t.name} (${t.hex.toUpperCase()})`}
                                                    >
                                                        <span className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: t.hex }} />
                                                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center">
                                                            {t.name}
                                                        </span>
                                                    </button>
                                                ))}

                                                <label
                                                    title="Renk Paletinden İstediğiniz Rengi Seçin"
                                                    className={`relative p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                                        isCustomTheme
                                                            ? "border-slate-800 dark:border-white ring-2 ring-slate-800/10 dark:ring-white/10 bg-white dark:bg-slate-800"
                                                            : "border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900"
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
                                                    <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-200 truncate w-full text-center">
                                                        {isCustomTheme ? currentThemeHex.toUpperCase() : "Özel Seç"}
                                                    </span>
                                                    <input
                                                        type="color"
                                                        value={currentThemeHex}
                                                        onChange={(e) => setThemeColor(getSafeThemeColor(e.target.value))}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 3. Görünüm Modu (Aydınlık / Karanlık) & Otomatik Karanlık Mod Zamanlaması */}
                                {(() => {
                                    const autoCfg = userCallPanelPrefs?.autoThemeConfig || { mode: "manual", darkStart: "19:00", darkEnd: "07:00" };
                                    const updateUserAutoTheme = (patch) => {
                                        setUserCallPanelPrefs((prev) => ({
                                            ...(prev || {}),
                                            autoThemeConfig: {
                                                mode: "manual",
                                                darkStart: "19:00",
                                                darkEnd: "07:00",
                                                ...(prev?.autoThemeConfig || {}),
                                                ...patch
                                            }
                                        }));
                                    };
                                    return (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                                                        {themeMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Görünüm Modu & Karanlık Mod Zamanlaması
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Kullanıcının varsayılan Aydınlık / Karanlık modunu ve otomatik zamanlama kuralını belirleyin.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                                                    <button
                                                        type="button"
                                                        onClick={() => setThemeMode("light")}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                                                            themeMode !== "dark" ? `${bg} text-white shadow-sm` : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                                        }`}
                                                    >
                                                        <Sun size={13} />
                                                        <span>Aydınlık</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setThemeMode("dark")}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                                                            themeMode === "dark" ? `${bg} text-white shadow-sm` : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                                        }`}
                                                    >
                                                        <Moon size={13} />
                                                        <span>Karanlık</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                {[
                                                    { id: "manual", title: "Manuel Seçim", desc: "Kullanıcı üst bardaki Güneş/Ay ikonundan değiştirir." },
                                                    { id: "system", title: "İşletim Sistemiyle Eşitle", desc: "Bilgisayarın gece/gündüz temasını takip eder." },
                                                    { id: "schedule", title: "Saate Göre Otomatik", desc: "Belirlenen akşam saatinde otomatik Karanlık Moda geçer." }
                                                ].map((opt) => {
                                                    const active = (autoCfg.mode || "manual") === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => updateUserAutoTheme({ mode: opt.id })}
                                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                                active
                                                                    ? `${border} ${lightBg} shadow-sm`
                                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-xs font-extrabold text-slate-800 dark:text-white">{opt.title}</span>
                                                                {active && <Check size={13} className={text} />}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{opt.desc}</p>
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
                                                            onChange={(e) => updateUserAutoTheme({ darkStart: e.target.value })}
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
                                                            onChange={(e) => updateUserAutoTheme({ darkEnd: e.target.value })}
                                                            className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* 4. Arayüz Geçiş & Grafik Animasyonları */}
                                            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                                                        <Sparkles size={14} className={text} />
                                                        <span>Arayüz Geçiş & Grafik Animasyonları</span>
                                                    </span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${lightBg} ${text} ${borderLight}`}>
                                                        {normalizeUiMotionMode(userCallPanelPrefs?.uiMotionMode) === "minimal"
                                                            ? "Minimal (Hızlı)"
                                                            : normalizeUiMotionMode(userCallPanelPrefs?.uiMotionMode) === "off"
                                                            ? "Kapalı"
                                                            : "Akıcı (Varsayılan)"}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                    {[
                                                        { id: "fluid", title: "Akıcı (Varsayılan)", desc: "Yumuşak pencere süzülmesi ve canlı grafik animasyonu." },
                                                        { id: "minimal", title: "Minimal (Hızlı)", desc: "Yalnızca 200ms hafif netleşme; seri sekme geçişi." },
                                                        { id: "off", title: "Kapalı (Anında)", desc: "Tüm geçiş efektlerini kapatarak anında statik yükleme yapar." }
                                                    ].map((mOpt) => {
                                                        const isMotionSel = normalizeUiMotionMode(userCallPanelPrefs?.uiMotionMode) === mOpt.id;
                                                        return (
                                                            <button
                                                                key={mOpt.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setUserCallPanelPrefs((prev) => ({
                                                                        ...(prev || {}),
                                                                        uiMotionMode: mOpt.id
                                                                    }))
                                                                }
                                                                className={`p-3 rounded-xl border text-left transition-all ${
                                                                    isMotionSel
                                                                        ? `${border} ${lightBg} shadow-sm`
                                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">{mOpt.title}</span>
                                                                    {isMotionSel && <Check size={13} className={text} />}
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{mOpt.desc}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* TAB: ARAYÜZ & PANEL DÜZENİ (Çağrı Paneli, Üst Bar, Wallboard, Klavye Kısayolları) */}
                        {activeTab === "ui_layout" && (() => {
                            const matchedRoleObj = systemRoles.find(
                                (r) => String(r.role_code || "").toLowerCase() === String(role || "").toLowerCase()
                            );
                            const rolePerms = role === "admin" ? ["*"] : (Array.isArray(matchedRoleObj?.permissions) ? matchedRoleObj.permissions : []);
                            const hasConfiguredRoleTabs = role !== "admin" && rolePerms.some((p) => p.startsWith("call_panel:tab_"));
                            const isTabAllowedByUserRole = (tabObj) => {
                                if (!tabObj) return false;
                                if (role === "admin" || !hasConfiguredRoleTabs) return true;
                                return rolePerms.includes(tabObj.perm);
                            };

                            const currentOrder =
                                Array.isArray(userCallPanelPrefs?.tabOrder) && userCallPanelPrefs.tabOrder.length > 0
                                    ? userCallPanelPrefs.tabOrder
                                    : DEFAULT_CALL_PANEL_PREFS.tabOrder;

                            const orderedTabItems = currentOrder
                                .map((id) => CALL_PANEL_ALL_TABS.find((t) => t.id === id))
                                .filter((t) => isTabAllowedByUserRole(t));

                            CALL_PANEL_ALL_TABS.forEach((t) => {
                                if (isTabAllowedByUserRole(t) && !orderedTabItems.some((item) => item.id === t.id)) {
                                    orderedTabItems.push(t);
                                }
                            });

                            const updateUserPanelPrefs = (patch) => {
                                setUserCallPanelPrefs((prev) => ({
                                    ...(prev || {}),
                                    ...patch
                                }));
                            };

                            const moveUserTabItem = (index, direction) => {
                                const targetIndex = index + direction;
                                if (targetIndex < 0 || targetIndex >= orderedTabItems.length) return;
                                const nextIds = orderedTabItems.map((t) => t.id);
                                const [moved] = nextIds.splice(index, 1);
                                nextIds.splice(targetIndex, 0, moved);
                                updateUserPanelPrefs({ tabOrder: nextIds });
                            };

                            const topbarPrefs = normalizeTopbarPrefs(userCallPanelPrefs?.topbar);
                            const updateUserTopbarPrefs = (patchOrUpdater) => {
                                setUserCallPanelPrefs((prev) => {
                                    const curTop = normalizeTopbarPrefs(prev?.topbar);
                                    const rawPatch =
                                        typeof patchOrUpdater === "function" ? patchOrUpdater(curTop) : patchOrUpdater;
                                    const nextTop = normalizeTopbarPrefs({
                                        ...curTop,
                                        ...(rawPatch || {})
                                    });
                                    return {
                                        ...(prev || {}),
                                        topbar: nextTop
                                    };
                                });
                            };

                            const allowedTopbarScreens = getAllowedLandingScreensForRole(role, rolePerms);

                            return (
                                <div className="space-y-5 animate-in fade-in duration-300">
                                    {/* Sub-navigation Pills */}
                                    <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        {[
                                            { id: "call_panel", label: "Çağrı Paneli Düzeni", icon: LayoutGrid },
                                            { id: "topbar", label: "Üst Bar Özelleştirme", icon: PanelTop },
                                            { id: "wallboard", label: "Canlı İzleme Paneli (Wallboard)", icon: Monitor },
                                            { id: "shortcuts", label: "Klavye Kısayolları", icon: Keyboard }
                                        ].map((st) => {
                                            const StIcon = st.icon;
                                            const active = uiLayoutSubTab === st.id;
                                            return (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    onClick={() => setUiLayoutSubTab(st.id)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all ${
                                                        active
                                                            ? `${bg} text-white border-transparent shadow-sm`
                                                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    <StIcon size={14} />
                                                    <span>{st.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* SUBTAB 1: ÇAĞRI PANELİ DÜZENİ */}
                                    {uiLayoutSubTab === "call_panel" && (
                                        <div className="space-y-5">
                                            {/* Menü Konumu */}
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Menü Konumu & Ekran Yerleşimi
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Çağrı paneli sekmelerinin sol dikey menüde mi yoksa üst barda yatay mı yer alacağını seçin.
                                                        </p>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${lightBg} ${text} ${borderLight}`}>
                                                        {userCallPanelPrefs?.navPosition === "top" ? "Üst Bar (Yatay)" : "Sol Menü (Klasik)"}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {[
                                                        { id: "left", title: "Sol Menü (Dikey Yerleşim)", desc: "Sekmeler ve kuyruk oturum kartı sol sütunda yer alır." },
                                                        { id: "top", title: "Üst Bar (Yatay Tam Genişlik)", desc: "Sekmeler ve mola/oturum kontrolü üst bara taşınır." }
                                                    ].map((opt) => {
                                                        const active = (userCallPanelPrefs?.navPosition || "left") === opt.id;
                                                        return (
                                                            <button
                                                                key={opt.id}
                                                                type="button"
                                                                onClick={() => updateUserPanelPrefs({ navPosition: opt.id })}
                                                                className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                                                                    active
                                                                        ? `${lightBg} ${border} ring-2 ${ring}`
                                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="text-xs font-extrabold text-slate-800 dark:text-white">{opt.title}</div>
                                                                    <p className="text-[10px] text-slate-400 mt-1">{opt.desc}</p>
                                                                </div>
                                                                {active && <CheckCircle size={15} className={`${text} shrink-0 mt-0.5`} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Temsilci Ekranı Görünüm Düzeni (Liste / Kutucuk) */}
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Temsilci Ekranı Görünüm Düzeni
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Temsilci ekranının ve çağrı paneli seçeneklerinin liste veya kutucuk şeklinde görünmesini belirleyin.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                    {[
                                                        { id: "list", mode: "list", size: userCallPanelPrefs?.boxSize || "large", title: "Liste Görünümü", desc: "Tablo/satır listesi ve yatay şerit görünümü", icon: List },
                                                        { id: "box_large", mode: "box", size: "large", title: "Büyük Kutucuk", desc: "Ferah kart kutucukları görünümü", icon: LayoutGrid },
                                                        { id: "box_small", mode: "box", size: "small", title: "Küçük Kutucuk", desc: "Kompakt kart kutucukları görünümü", icon: LayoutGrid }
                                                    ].map((vOpt) => {
                                                        const VIcon = vOpt.icon;
                                                        const active =
                                                            vOpt.mode === "list"
                                                                ? (userCallPanelPrefs?.viewMode || "list") === "list"
                                                                : userCallPanelPrefs?.viewMode === "box" && (userCallPanelPrefs?.boxSize || "large") === vOpt.size;
                                                        return (
                                                            <button
                                                                key={vOpt.id}
                                                                type="button"
                                                                onClick={() => updateUserPanelPrefs({ viewMode: vOpt.mode, boxSize: vOpt.size })}
                                                                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                                                    active
                                                                        ? `${lightBg} ${border} ring-2 ${ring}`
                                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-lg shrink-0 ${active ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                                    <VIcon size={15} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">{vOpt.title}</span>
                                                                        {active && <CheckCircle size={13} className={text} />}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">{vOpt.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Temsilciler Sekmesi Kutucuk Boyutu, Sıralama & Durum/Mola Renkleri */}
                                            <CallPanelAgentsAppearanceSettings
                                                backendHost={backendHost}
                                                currentUserId={editingUser?.id || extension || "admin"}
                                                currentUser={{ ...(editingUser || {}), wallboard_layout: userWallboardLayout }}
                                                deferPersist
                                                draftLayout={userWallboardLayout}
                                                onDraftLayoutChange={setUserWallboardLayout}
                                            />

                                            {/* Temsilci Çağrı Paneli Seçenek Sıralaması */}
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Temsilci Çağrı Paneli Seçenek Sıralaması
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Seçenekleri sürükleyerek veya yukarı/aşağı oklarla sıralayın.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateUserPanelPrefs({
                                                                navPosition: DEFAULT_CALL_PANEL_PREFS.navPosition,
                                                                viewMode: DEFAULT_CALL_PANEL_PREFS.viewMode,
                                                                boxSize: DEFAULT_CALL_PANEL_PREFS.boxSize,
                                                                tabOrder: [...DEFAULT_CALL_PANEL_PREFS.tabOrder]
                                                            })
                                                        }
                                                        className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 flex items-center gap-1.5"
                                                    >
                                                        <RotateCcw size={12} />
                                                        <span>Varsayılana Sıfırla</span>
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 gap-1.5">
                                                    {orderedTabItems.map((tabItem, idx) => {
                                                        const IconComp = tabItem.icon;
                                                        return (
                                                            <div
                                                                key={tabItem.id}
                                                                draggable
                                                                onDragStart={() => setDraggedUserPanelTabIdx(idx)}
                                                                onDragOver={(e) => {
                                                                    e.preventDefault();
                                                                    if (draggedUserPanelTabIdx === null || draggedUserPanelTabIdx === idx) return;
                                                                    const nextIds = orderedTabItems.map((t) => t.id);
                                                                    const [moved] = nextIds.splice(draggedUserPanelTabIdx, 1);
                                                                    nextIds.splice(idx, 0, moved);
                                                                    setDraggedUserPanelTabIdx(idx);
                                                                    updateUserPanelPrefs({ tabOrder: nextIds });
                                                                }}
                                                                onDragEnd={() => setDraggedUserPanelTabIdx(null)}
                                                                className="flex items-center justify-between px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 cursor-move select-none"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <GripVertical size={14} className="text-slate-400 shrink-0" />
                                                                    <span className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                                                                        {idx + 1}
                                                                    </span>
                                                                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                                                        <IconComp size={13} />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                        {tabItem.name || tabItem.label}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        disabled={idx === 0}
                                                                        onClick={() => moveUserTabItem(idx, -1)}
                                                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 disabled:opacity-30"
                                                                    >
                                                                        <ArrowUp size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={idx === orderedTabItems.length - 1}
                                                                        onClick={() => moveUserTabItem(idx, 1)}
                                                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 disabled:opacity-30"
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
                                    )}

                                    {/* SUBTAB 2: ÜST BAR ÖZELLEŞTİRME */}
                                    {uiLayoutSubTab === "topbar" && (() => {
                                        const effectiveAvatarOnly =
                                            Boolean(topbarPrefs.avatarOnly) ||
                                            !(topbarPrefs.showName || topbarPrefs.showExtension || topbarPrefs.showProfile || topbarPrefs.showRole);

                                        const togglePinItem = (screenId) => {
                                            const curPins = Array.isArray(topbarPrefs.pinnedItems) ? topbarPrefs.pinnedItems : [];
                                            const nextPins = curPins.includes(screenId)
                                                ? curPins.filter((x) => x !== screenId)
                                                : [...curPins, screenId];
                                            updateUserTopbarPrefs({ pinnedItems: nextPins });
                                        };

                                        const movePinItem = (idx, dir) => {
                                            const curPins = [...(topbarPrefs.pinnedItems || [])];
                                            const targetIdx = idx + dir;
                                            if (targetIdx < 0 || targetIdx >= curPins.length) return;
                                            const [moved] = curPins.splice(idx, 1);
                                            curPins.splice(targetIdx, 0, moved);
                                            updateUserTopbarPrefs({ pinnedItems: curPins });
                                        };

                                        const qPin = pinCatalogSearch.trim().toLowerCase();
                                        const filteredScreens = allowedTopbarScreens.filter((s) => {
                                            if (!qPin) return true;
                                            return (
                                                s.label.toLowerCase().includes(qPin) ||
                                                (s.shortLabel || "").toLowerCase().includes(qPin) ||
                                                (s.group || "").toLowerCase().includes(qPin)
                                            );
                                        });
                                        const screenGroups = Array.from(new Set(filteredScreens.map((s) => s.group)));

                                        return (
                                            <div className="space-y-5">
                                                {/* 1. Global Arama Görünümü */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                                Global Arama (Search) Görünümü
                                                            </h5>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                Üst bardaki menü, ayar, kişi ve hızlı işlem arama alanının boyutunu belirleyin.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                        {[
                                                            { id: "icon", title: "Sadece İkon", desc: "Kompakt büyüteç (🔍) butonu" },
                                                            { id: "normal", title: "Geniş (Standart)", desc: "Standart arama kutusu" },
                                                            { id: "wide", title: "Daha Geniş", desc: "Ferah komut arama alanı" },
                                                            { id: "hidden", title: "Kapalı", desc: "Üst bardan gizler" }
                                                        ].map((opt) => {
                                                            const isSel = topbarPrefs.searchMode === opt.id;
                                                            return (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => updateUserTopbarPrefs({ searchMode: opt.id })}
                                                                    className={`p-3 rounded-xl border text-left transition-all ${
                                                                        isSel
                                                                            ? `${lightBg} ${border} ring-2 ${ring}`
                                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">{opt.title}</span>
                                                                        {isSel && <CheckCircle size={13} className={text} />}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 mt-1">{opt.desc}</p>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* 2. Avatar & Profil Kapsülü Özelleştirme */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
                                                    <div>
                                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                            Avatar & Profil Alanı Özelleştirme
                                                        </h5>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Sağ üstteki kullanıcı kapsülünde hangi bilgilerin görüneceğini belirleyin.
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateUserTopbarPrefs((prevTop) =>
                                                                effectiveAvatarOnly
                                                                    ? { avatarOnly: false, showName: true, showProfile: true }
                                                                    : { avatarOnly: true }
                                                            );
                                                        }}
                                                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                                                            effectiveAvatarOnly
                                                                ? `${lightBg} ${border}`
                                                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                                Sadece Avatar Göster (Minimal Görünüm)
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                İsim, rol, dahili ve profil yazısını gizleyip yalnızca yuvarlak avatarı gösterir.
                                                            </div>
                                                        </div>
                                                        {effectiveAvatarOnly ? <ToggleRight size={28} className={text} /> : <ToggleLeft size={28} className="text-slate-400" />}
                                                    </button>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {[
                                                            { key: "showName", title: "Ad Soyad Göster", desc: "Kullanıcı adını kapsülde gösterir" },
                                                            { key: "showExtension", title: "Dahili Numarası Göster", desc: "Dahili numarasını (#1000) rozet olarak gösterir" },
                                                            { key: "showProfile", title: "Aktif Profil Göster", desc: "Müsait / Dışarıda / Toplantı durumunu gösterir" },
                                                            { key: "showRole", title: "Kullanıcı Rolü Göster", desc: "Kullanıcı rol ünvanını gösterir" }
                                                        ].map((f) => {
                                                            const isChecked = !effectiveAvatarOnly && Boolean(topbarPrefs[f.key]);
                                                            return (
                                                                <button
                                                                    key={f.key}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        updateUserTopbarPrefs((prevTop) => {
                                                                            if (effectiveAvatarOnly) {
                                                                                return {
                                                                                    avatarOnly: false,
                                                                                    showName: f.key === "showName",
                                                                                    showExtension: f.key === "showExtension",
                                                                                    showProfile: f.key === "showProfile",
                                                                                    showRole: f.key === "showRole"
                                                                                };
                                                                            }
                                                                            return {
                                                                                ...prevTop,
                                                                                avatarOnly: false,
                                                                                [f.key]: !Boolean(prevTop[f.key])
                                                                            };
                                                                        });
                                                                    }}
                                                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                                                                        isChecked
                                                                            ? `${lightBg} ${border}`
                                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div className="text-xs font-extrabold text-slate-800 dark:text-white">{f.title}</div>
                                                                        <div className="text-[10px] text-slate-400">{f.desc}</div>
                                                                    </div>
                                                                    {isChecked ? <ToggleRight size={26} className={text} /> : <ToggleLeft size={26} className="text-slate-400" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* 3. Sık Kullanılan Özellik Kısayolları */}
                                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                                Sık Kullanılan Özellik Kısayolları (Üst Bar Pinleri)
                                                            </h5>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                Kullanıcının üst barda göreceği hızlı erişim kısayollarını seçin ve sıralayın.
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const suggested = ["dashboard", "call-center", "users", "acd-queues", "inbound-rules", "reports-pano"].filter(
                                                                        (cid) => allowedTopbarScreens.some((s) => s.id === cid)
                                                                    );
                                                                    updateUserTopbarPrefs({ pinnedItems: suggested.slice(0, 5) });
                                                                }}
                                                                className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-extrabold ${lightBg} ${text} ${borderLight}`}
                                                            >
                                                                Önerilenleri Ekle
                                                            </button>
                                                            {(topbarPrefs.pinnedItems || []).length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateUserTopbarPrefs({ pinnedItems: [] })}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 hover:text-rose-600"
                                                                >
                                                                    Tümünü Kaldır
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                                        <div className="space-y-1.5">
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                                                                Kısayol Buton Stili
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                {[
                                                                    { id: "icon_label", label: "İkon + Başlık" },
                                                                    { id: "icon", label: "Sadece İkon" }
                                                                ].map((st) => (
                                                                    <button
                                                                        key={st.id}
                                                                        type="button"
                                                                        onClick={() => updateUserTopbarPrefs({ pinStyle: st.id })}
                                                                        className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border ${
                                                                            topbarPrefs.pinStyle === st.id
                                                                                ? `${bg} text-white border-transparent`
                                                                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                                                                        }`}
                                                                    >
                                                                        {st.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                                                                Üst Barda Görünür Adet
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                {[3, 4, 5, 6, 8].map((cnt) => (
                                                                    <button
                                                                        key={cnt}
                                                                        type="button"
                                                                        onClick={() => updateUserTopbarPrefs({ maxVisiblePins: cnt })}
                                                                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-extrabold border ${
                                                                            topbarPrefs.maxVisiblePins === cnt
                                                                                ? `${bg} text-white border-transparent`
                                                                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                                                                        }`}
                                                                    >
                                                                        {cnt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(topbarPrefs.pinnedItems || []).length > 0 && (
                                                        <div className="space-y-1.5">
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                                                                Sabitlenen Kısayol Sıralaması ({(topbarPrefs.pinnedItems || []).length})
                                                            </span>
                                                            <div className="space-y-1.5">
                                                                {(topbarPrefs.pinnedItems || []).map((pid, idx) => {
                                                                    const sc = allowedTopbarScreens.find((s) => s.id === pid);
                                                                    const label = sc ? sc.label : pid;
                                                                    return (
                                                                        <div
                                                                            key={pid}
                                                                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
                                                                        >
                                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                                <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                                                                                    {idx + 1}
                                                                                </span>
                                                                                <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                                                                    {label}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={idx === 0}
                                                                                    onClick={() => movePinItem(idx, -1)}
                                                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                                                                >
                                                                                    <ArrowUp size={13} />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={idx === (topbarPrefs.pinnedItems || []).length - 1}
                                                                                    onClick={() => movePinItem(idx, 1)}
                                                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                                                                >
                                                                                    <ArrowDown size={13} />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => togglePinItem(pid)}
                                                                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500"
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

                                                    <div className="space-y-3 pt-1">
                                                        <div className="relative">
                                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                value={pinCatalogSearch}
                                                                onChange={(e) => setPinCatalogSearch(e.target.value)}
                                                                placeholder="Üst bara eklenecek ekran veya modül ara..."
                                                                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                                                            />
                                                        </div>

                                                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                                            {screenGroups.map((grp) => {
                                                                const grpItems = filteredScreens.filter((s) => s.group === grp);
                                                                return (
                                                                    <div key={grp} className="space-y-1.5">
                                                                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                                                                            {grp}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                            {grpItems.map((sc) => {
                                                                                const isPinned = (topbarPrefs.pinnedItems || []).includes(sc.id);
                                                                                return (
                                                                                    <button
                                                                                        key={sc.id}
                                                                                        type="button"
                                                                                        onClick={() => togglePinItem(sc.id)}
                                                                                        className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                                                                                            isPinned
                                                                                                ? `${lightBg} ${border} shadow-sm`
                                                                                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
                                                                                        }`}
                                                                                    >
                                                                                        <span className="text-[11px] font-bold text-slate-800 dark:text-white truncate">
                                                                                            {sc.label}
                                                                                        </span>
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

                                    {/* SUBTAB 3: CANLI İZLEME PANELİ (WALLBOARD) */}
                                    {uiLayoutSubTab === "wallboard" && (
                                        <WallboardStudioSettings
                                            backendHost={backendHost}
                                            currentUserId={editingUser?.id || extension || "admin"}
                                            currentUser={{ ...(editingUser || {}), wallboard_layout: userWallboardLayout }}
                                            deferPersist
                                            draftLayout={userWallboardLayout}
                                            onDraftLayoutChange={setUserWallboardLayout}
                                        />
                                    )}

                                    {/* SUBTAB 4: KLAVYE KISAYOLLARI */}
                                    {uiLayoutSubTab === "shortcuts" && (
                                        <KeyboardShortcutsModal
                                            embedded
                                            isOpen={showModal && activeTab === "ui_layout" && uiLayoutSubTab === "shortcuts"}
                                            onClose={() => {}}
                                            customShortcuts={userCallPanelPrefs?.keyboardShortcuts || {}}
                                            onSaveShortcuts={(nextShortcuts) => {
                                                setUserCallPanelPrefs((prev) => ({
                                                    ...(prev || {}),
                                                    keyboardShortcuts: nextShortcuts
                                                }));
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })()}

                        {/* TAB 5: MÜŞTERİ / TENANT (ADMIN ONLY) */}
                        {activeTab === "tenant_select" && isAdmin && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                        Müşteri / Tenant Ataması
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Bu kullanıcının sistem içinde ait olduğu Müşteri / Tenant tanımını güncelleyin.
                                    </p>
                                </div>

                                <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 dark:text-white mb-2">
                                            Bağlı Olduğu Müşteri / Tenant
                                        </label>
                                        <select
                                            value={userTenantId}
                                            onChange={(e) => setUserTenantId(e.target.value)}
                                            className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ring-rose-500"
                                        >
                                            {tenants.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({t.id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-xl flex items-start gap-2.5">
                                        <Building2 size={16} className="text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                                            Kullanıcıyı farklı bir tenant'a aktardığınızda, kullanıcı yalnızca o tenant'a ait dahili hatları, çağrı verilerini ve müşteri panelini görüntüleyebilecektir.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: RAPOR & YÖNETİM FİLTRESİ (SUPERVIZOR) */}
                        {activeTab === "supervisor_filter" && hasSupervisorPerm && (() => {
                            const safeUsers = Array.isArray(users) ? users : [];
                            const safeQueues = Array.isArray(queuesList) ? queuesList : [];
                            const safeSubGroups = Array.isArray(subscriberGroupsList) ? subscriberGroupsList : [];

                            const getUserDisplayName = (u) =>
                                u?.full_name || u?.name || u?.username || u?.email || `Kullanıcı #${u?.id}`;

                            const getRoleDisplayName = (roleCode) => {
                                const foundRole = (systemRoles || []).find((r) => r.role_code === roleCode);
                                return foundRole ? foundRole.name : (roleCode || "Temsilci");
                            };

                            const isUserManaged = (u) => {
                                const uid = String(u.id);
                                const uext = u.extension ? String(u.extension) : null;
                                return managedUsers.includes(uid) || (uext ? managedUsers.includes(uext) : false);
                            };

                            const addManagedUser = (u) => {
                                const uid = String(u.id);
                                setManagedUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
                            };

                            const removeManagedUser = (u) => {
                                const uid = String(u.id);
                                const uext = u.extension ? String(u.extension) : null;
                                setManagedUsers((prev) =>
                                    prev.filter((x) => String(x) !== uid && (!uext || String(x) !== uext))
                                );
                            };

                            const getSubGroupMemberIds = (grp) => {
                                const rawExts = grp?.extensions || grp?.members || [];
                                const matchedIds = [];
                                rawExts.forEach((val) => {
                                    const found = safeUsers.find(
                                        (usr) =>
                                            usr.id === val ||
                                            String(usr.id) === String(val) ||
                                            String(usr.extension) === String(val)
                                    );
                                    if (found && !matchedIds.includes(String(found.id))) {
                                        matchedIds.push(String(found.id));
                                    }
                                });
                                return matchedIds;
                            };

                            const selectedUsersList = safeUsers.filter(isUserManaged);
                            const selectedUserIdSet = new Set(selectedUsersList.map((u) => String(u.id)));
                            const unassignedUsersList = safeUsers.filter((u) => !isUserManaged(u));

                            const enrichedSubGroups = safeSubGroups
                                .map((grp) => {
                                    const memberIds = getSubGroupMemberIds(grp);
                                    const allSelected =
                                        memberIds.length > 0 && memberIds.every((id) => selectedUserIdSet.has(id));
                                    return {
                                        ...grp,
                                        memberIds,
                                        allSelected
                                    };
                                })
                                .filter((grp) => grp.memberIds.length > 0);

                            const unassignedSubGroups = enrichedSubGroups.filter((grp) => !grp.allSelected);
                            const selectedSubGroups = enrichedSubGroups.filter((grp) => grp.allSelected);

                            const userQuery = supUserSearch.trim().toLowerCase();
                            const filteredUnassignedSubGroups = unassignedSubGroups.filter(
                                (grp) => !userQuery || String(grp.name || "").toLowerCase().includes(userQuery)
                            );
                            const filteredUnassignedUsers = unassignedUsersList.filter((u) => {
                                if (!userQuery) return true;
                                return (
                                    String(getUserDisplayName(u)).toLowerCase().includes(userQuery) ||
                                    String(u.extension || "").toLowerCase().includes(userQuery) ||
                                    String(u.email || "").toLowerCase().includes(userQuery)
                                );
                            });

                            const handleAddSubGroup = (grp) => {
                                setManagedUsers((prev) => {
                                    const next = [...prev];
                                    grp.memberIds.forEach((uid) => {
                                        if (!next.includes(uid)) next.push(uid);
                                    });
                                    return next;
                                });
                            };

                            const handleRemoveSubGroup = (grp) => {
                                const protectedIds = new Set();
                                selectedSubGroups.forEach((other) => {
                                    if (String(other.id) !== String(grp.id)) {
                                        other.memberIds.forEach((uid) => protectedIds.add(uid));
                                    }
                                });
                                const removeExts = new Set(
                                    safeUsers
                                        .filter((u) => grp.memberIds.includes(String(u.id)) && !protectedIds.has(String(u.id)))
                                        .flatMap((u) => [String(u.id), u.extension ? String(u.extension) : null])
                                        .filter(Boolean)
                                );
                                setManagedUsers((prev) => prev.filter((x) => !removeExts.has(String(x))));
                            };

                            const getQueueKey = (q) => String(q.id || q.name || q.queue_name);
                            const getQueueDisplayName = (q) => q.name || q.queue_name || getQueueKey(q);
                            const isQueueManaged = (q) => {
                                const keys = [q.id, q.name, q.queue_name, q.extension].filter(Boolean).map(String);
                                return keys.some((k) => managedQueues.includes(k));
                            };

                            const addManagedQueue = (q) => {
                                const qKey = getQueueKey(q);
                                setManagedQueues((prev) => (prev.includes(qKey) ? prev : [...prev, qKey]));
                            };

                            const removeManagedQueue = (q) => {
                                const keysToRemove = new Set(
                                    [q.id, q.name, q.queue_name, q.extension].filter(Boolean).map(String)
                                );
                                setManagedQueues((prev) => prev.filter((x) => !keysToRemove.has(String(x))));
                            };

                            const selectedQueuesList = safeQueues.filter(isQueueManaged);
                            const unassignedQueuesList = safeQueues.filter((q) => !isQueueManaged(q));
                            const queueQuery = supQueueSearch.trim().toLowerCase();
                            const filteredUnassignedQueues = unassignedQueuesList.filter((q) => {
                                if (!queueQuery) return true;
                                return (
                                    String(getQueueDisplayName(q)).toLowerCase().includes(queueQuery) ||
                                    String(q.extension || "").toLowerCase().includes(queueQuery)
                                );
                            });

                            return (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                        <h5 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                            <Shield size={16} className={text} />
                                            Supervizor Rapor & Yönetim Filtresi
                                        </h5>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Bu supervizor kullanıcısının Canlı İzleme Panelinde müdahale edebileceği ve Raporlarda görüntüleyebileceği temsilcileri ve çağrı kuyruklarını sol listeden seçerek sağ listeye aktarın.
                                        </p>
                                    </div>

                                    {/* Kuyruk Üye Ekleme Tarzı Alt Sekmeler (Sub-Tabs) */}
                                    <div
                                        className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 rounded-2xl"
                                        role="group"
                                        aria-label="Rapor ve yönetim filtresi seçim türü"
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={supFilterView === "users"}
                                            onClick={() => setSupFilterView("users")}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                                                supFilterView === "users"
                                                    ? `${bg} text-white shadow-sm`
                                                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300/80 dark:hover:bg-slate-700"
                                            }`}
                                        >
                                            <Users size={13} />
                                            <span>Yönetebileceği Temsilciler ({selectedUsersList.length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={supFilterView === "queues"}
                                            onClick={() => setSupFilterView("queues")}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                                                supFilterView === "queues"
                                                    ? `${bg} text-white shadow-sm`
                                                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300/80 dark:hover:bg-slate-700"
                                            }`}
                                        >
                                            <PhoneCall size={13} />
                                            <span>Yönetebileceği Çağrı Kuyrukları ({selectedQueuesList.length})</span>
                                        </button>
                                    </div>

                                    {/* GÖRÜNÜM 1: YÖNETEBİLECEĞİ TEMSİLCİLER (ÇİFT SÜTUN AKTARIM) */}
                                    {supFilterView === "users" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[420px]">
                                            {/* Sol: Atanabilecek Kullanıcılar & Abone Grupları */}
                                            <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h6 className="text-xs font-bold text-slate-800 dark:text-white">
                                                            Kullanıcılar & Abone Grupları
                                                        </h6>
                                                        {unassignedUsersList.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setManagedUsers(safeUsers.map((u) => String(u.id)))}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${lightBg} ${text} border ${borderLight} transition-all focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                Tümünü Ekle
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Temsilci, dahili veya abone grubu ara..."
                                                            aria-label="Atanabilecek temsilci veya abone grubu ara"
                                                            value={supUserSearch}
                                                            onChange={(e) => setSupUserSearch(e.target.value)}
                                                            className={`w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 ${ring}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                    {filteredUnassignedSubGroups.map((grp) => (
                                                        <button
                                                            key={`subgrp_${grp.id}`}
                                                            type="button"
                                                            onClick={() => handleAddSubGroup(grp)}
                                                            className={`w-full text-left flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${lightBg} ${borderLight} hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-lg ${lightBg} ${text} flex items-center justify-center shrink-0 border ${borderLight}`}>
                                                                <Users size={16} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                                        {grp.name}
                                                                    </p>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                                                                        Abone Grubu
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                    {grp.memberIds.length} Abone
                                                                </p>
                                                            </div>
                                                            <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                                        </button>
                                                    ))}

                                                    {filteredUnassignedUsers.map((u) => {
                                                        const uName = getUserDisplayName(u);
                                                        return (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                onClick={() => addManagedUser(u)}
                                                                className={`w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                <img
                                                                    src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=random`}
                                                                    alt=""
                                                                    loading="lazy"
                                                                    fetchpriority="low"
                                                                    className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 object-contain shrink-0"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                                        {uName}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 truncate">
                                                                        {getRoleDisplayName(u.role)} • Dahili: {u.extension || "-"}
                                                                    </p>
                                                                </div>
                                                                <ChevronRight size={14} className="text-slate-300 shrink-0" />
                                                            </button>
                                                        );
                                                    })}

                                                    {filteredUnassignedSubGroups.length === 0 && filteredUnassignedUsers.length === 0 && (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            Atanabilecek temsilci bulunamadı.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sağ: Seçili Temsilciler */}
                                            <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex items-center justify-between gap-2">
                                                    <h6 className="text-xs font-bold text-slate-800 dark:text-white">
                                                        Seçili Temsilciler
                                                    </h6>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`px-2 py-0.5 rounded-lg ${lightBg} ${text} text-[10px] font-bold`}>
                                                            {selectedUsersList.length} Seçili
                                                        </span>
                                                        {selectedUsersList.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setManagedUsers([])}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                Temizle
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                                                    {selectedSubGroups.map((grp) => (
                                                        <div
                                                            key={`sel_subgrp_${grp.id}`}
                                                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border shadow-sm ${lightBg} ${borderLight}`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className={`w-7 h-7 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
                                                                    <Users size={15} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                                                            {grp.name}
                                                                        </p>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                                                                            Abone Grubu
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {grp.memberIds.length} Abone (Grup çıkarıldığında üyeleri de çıkarılır)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                aria-label={`${grp.name} abone grubunu ve üyelerini çıkar`}
                                                                title="Abone Grubunu ve Üyelerini Çıkar"
                                                                onClick={() => handleRemoveSubGroup(grp)}
                                                                className={`w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 text-slate-400 flex items-center justify-center transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {selectedUsersList.map((u) => {
                                                        const uName = getUserDisplayName(u);
                                                        return (
                                                            <div
                                                                key={u.id}
                                                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <img
                                                                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(uName)}&background=random`}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        fetchpriority="low"
                                                                        className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 object-contain shrink-0"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                                                            {uName}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 truncate">
                                                                            {getRoleDisplayName(u.role)} • Dahili: {u.extension || "-"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`${uName} temsilcisini çıkar`}
                                                                    title="Çıkar"
                                                                    onClick={() => removeManagedUser(u)}
                                                                    className={`w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 text-slate-300 flex items-center justify-center transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}

                                                    {selectedUsersList.length === 0 && (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            Henüz temsilci seçilmedi (Seçim yapılmazsa tüm temsilciler görünür).
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* GÖRÜNÜM 2: YÖNETEBİLECEĞİ ÇAĞRI KUYRUKLARI (ÇİFT SÜTUN AKTARIM) */}
                                    {supFilterView === "queues" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[420px]">
                                            {/* Sol: Atanabilecek Çağrı Kuyrukları */}
                                            <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h6 className="text-xs font-bold text-slate-800 dark:text-white">
                                                            Çağrı Kuyrukları (ACD)
                                                        </h6>
                                                        {unassignedQueuesList.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setManagedQueues(safeQueues.map(getQueueKey))}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${lightBg} ${text} border ${borderLight} transition-all focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                Tümünü Ekle
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Kuyruk adı veya numarası ara..."
                                                            aria-label="Atanabilecek çağrı kuyruğu ara"
                                                            value={supQueueSearch}
                                                            onChange={(e) => setSupQueueSearch(e.target.value)}
                                                            className={`w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 ${ring}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                    {filteredUnassignedQueues.map((q) => {
                                                        const qKey = getQueueKey(q);
                                                        const qName = getQueueDisplayName(q);
                                                        const memberCount = Array.isArray(q.queueMembers)
                                                            ? q.queueMembers.length
                                                            : Array.isArray(q.members)
                                                            ? q.members.length
                                                            : null;
                                                        return (
                                                            <button
                                                                key={qKey}
                                                                type="button"
                                                                onClick={() => addManagedQueue(q)}
                                                                className={`w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
                                                                    <PhoneCall size={15} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                                        {qName}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 truncate">
                                                                        Kuyruk No: {q.extension || "-"}
                                                                        {memberCount !== null ? ` • ${memberCount} Üye` : ""}
                                                                    </p>
                                                                </div>
                                                                <ChevronRight size={14} className="text-slate-300 shrink-0" />
                                                            </button>
                                                        );
                                                    })}

                                                    {filteredUnassignedQueues.length === 0 && (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            {safeQueues.length === 0
                                                                ? "Sistemde tanımlı çağrı kuyruğu bulunamadı."
                                                                : "Atanabilecek çağrı kuyruğu bulunamadı."}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sağ: Seçili Çağrı Kuyrukları */}
                                            <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex items-center justify-between gap-2">
                                                    <h6 className="text-xs font-bold text-slate-800 dark:text-white">
                                                        Seçili Çağrı Kuyrukları
                                                    </h6>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`px-2 py-0.5 rounded-lg ${lightBg} ${text} text-[10px] font-bold`}>
                                                            {selectedQueuesList.length} Seçili
                                                        </span>
                                                        {selectedQueuesList.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setManagedQueues([])}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                            >
                                                                Temizle
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                                                    {selectedQueuesList.map((q) => {
                                                        const qKey = getQueueKey(q);
                                                        const qName = getQueueDisplayName(q);
                                                        return (
                                                            <div
                                                                key={qKey}
                                                                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className={`w-7 h-7 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
                                                                        <PhoneCall size={14} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                                                            {qName}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 truncate">
                                                                            Kuyruk No: {q.extension || "-"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`${qName} kuyruğunu çıkar`}
                                                                    title="Çıkar"
                                                                    onClick={() => removeManagedQueue(q)}
                                                                    className={`w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 text-slate-300 flex items-center justify-center transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}

                                                    {selectedQueuesList.length === 0 && (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            Henüz kuyruk seçilmedi (Seçim yapılmazsa tüm kuyruklar görünür).
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* TAB: CTI & CRM ENTEGRASYONU */}
                        {activeTab === "cti" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <div>
                                        <h5 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                            <Cable size={16} className={text} />
                                            CTI & Müşteri CRM Otomatik Ekran Açma (Screen Pop)
                                        </h5>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Bu insan temsilciye çağrı geldiğinde müşterinin CRM kartını otomatik olarak 2. sekmede açın ve arayan verisini aktarın.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canWriteCtiTab}
                                        onClick={() => setCtiConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                                        className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-all ${
                                            ctiConfig.enabled
                                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300"
                                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                                        } disabled:opacity-50`}
                                    >
                                        {ctiConfig.enabled ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                                        <span>{ctiConfig.enabled ? "CTI Otomatik Ekran Açık" : "CTI Devre Dışı"}</span>
                                    </button>
                                </div>

                                {/* Role Permission Quick Banner */}
                                <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    targetRoleHasCtiPerm
                                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-800/50"
                                        : "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50"
                                }`}>
                                    <div className="flex items-start gap-2.5">
                                        <Shield size={16} className={targetRoleHasCtiPerm ? "text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" : "text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"} />
                                        <div>
                                            <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                                                Rol Bazlı CTI Yetki Durumu ({selectedRoleObj?.name || role}):{" "}
                                                <span className={targetRoleHasCtiPerm ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                                                    {targetRoleHasCtiPerm ? "YETKİLİ (AÇIK)" : "YETKİ KAPALI"}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {targetRoleHasCtiPerm
                                                    ? "Bu kullanıcının bağlı olduğu rolde CTI & CRM otomatik sekme açma yetkisi aktif."
                                                    : "Bu kullanıcının rolünde CTI yetkisi kapalı. Sağdaki butonla veya Rol ve Yetki Tanımları ekranından açıp kapatabilirsiniz."}
                                            </p>
                                        </div>
                                    </div>
                                    {isAdmin && selectedRoleObj && (
                                        <button
                                            type="button"
                                            onClick={handleToggleTargetRoleCtiPerm}
                                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border shrink-0 transition-all ${
                                                targetRoleHasCtiPerm
                                                    ? "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50"
                                                    : `${bg} ${hover} border-transparent text-white shadow-sm`
                                            }`}
                                        >
                                            {targetRoleHasCtiPerm ? "Rolün CTI Yetkisini Kapat" : "Rolün CTI Yetkisini Aç"}
                                        </button>
                                    )}
                                </div>

                                {/* 1. CRM Preset & Screen Pop URL Configuration */}
                                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                                Hızlı CRM Şablonu
                                            </label>
                                            <select
                                                disabled={!canWriteCtiTab}
                                                value={ctiConfig.preset || "custom"}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const presets = {
                                                        custom: { crm_name: ctiConfig.crm_name || "Özel Müşteri CRM", url: ctiConfig.screen_pop_url || "https://crm.sirketiniz.com/musteri?telefon={caller_clean}&cagri={call_id}" },
                                                        hubspot: { crm_name: "HubSpot CRM", url: "https://app.hubspot.com/contacts/search?query={caller_clean}" },
                                                        salesforce: { crm_name: "Salesforce CRM", url: "https://login.salesforce.com/_ui/search/ui/UnifiedSearchResults?str={caller_clean}" },
                                                        zoho: { crm_name: "Zoho CRM", url: "https://crm.zoho.com/crm/Search?searchword={caller_clean}" },
                                                        zendesk: { crm_name: "Zendesk Support", url: "https://sirketiniz.zendesk.com/agent/search/1?q={caller_clean}" },
                                                        bitrix24: { crm_name: "Bitrix24 CRM", url: "https://sirketiniz.bitrix24.com.tr/crm/configs/import/?phone={caller_clean}" },
                                                        freshdesk: { crm_name: "Freshdesk CRM", url: "https://sirketiniz.freshdesk.com/a/search/tickets?term={caller_clean}" }
                                                    };
                                                    const picked = presets[val] || presets.custom;
                                                    setCtiConfig(prev => ({
                                                        ...prev,
                                                        preset: val,
                                                        crm_name: picked.crm_name,
                                                        screen_pop_url: picked.url
                                                    }));
                                                }}
                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            >
                                                <option value="custom">Özel CRM / ERP / Web Uygulaması</option>
                                                <option value="hubspot">HubSpot CRM</option>
                                                <option value="salesforce">Salesforce CRM</option>
                                                <option value="zoho">Zoho CRM</option>
                                                <option value="zendesk">Zendesk Support</option>
                                                <option value="bitrix24">Bitrix24 CRM</option>
                                                <option value="freshdesk">Freshdesk / Freshsales</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                                CRM Sistem Başlığı
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canWriteCtiTab}
                                                placeholder="Örn: Şirket CRM / ERP Müşteri Kartı"
                                                value={ctiConfig.crm_name || ""}
                                                onChange={(e) => setCtiConfig(prev => ({ ...prev, crm_name: e.target.value }))}
                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                2. Sekmede Otomatik Açılacak Müşteri CRM URL Adresi (Screen Pop URL)
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rawTpl = (ctiConfig.screen_pop_url || "").trim();
                                                    if (!rawTpl) {
                                                        setError("Lütfen önce test edilecek Müşteri CRM URL adresini giriniz.");
                                                        return;
                                                    }
                                                    const samplePhone = (ctiTestPhone || "05321234567").trim();
                                                    const sampleClean = samplePhone.replace(/\D/g, "");
                                                    const sampleLast10 = sampleClean.slice(-10);
                                                    const testUrl = rawTpl
                                                        .replace(/\{caller\}/g, encodeURIComponent(samplePhone))
                                                        .replace(/\{caller_clean\}/g, encodeURIComponent(sampleClean))
                                                        .replace(/\{phone\}/g, encodeURIComponent(sampleClean))
                                                        .replace(/\{last10\}/g, encodeURIComponent(sampleLast10))
                                                        .replace(/\{extension\}/g, encodeURIComponent(extension || "1000"))
                                                        .replace(/\{call_id\}/g, "test-call-1001")
                                                        .replace(/\{queue\}/g, "2000")
                                                        .replace(/\{agent_name\}/g, encodeURIComponent(fullName || "Temsilci"));
                                                    if (typeof window !== "undefined") {
                                                        window.open(testUrl, ctiConfig.open_mode === "reuse_tab" ? "aida_crm_tab" : "_blank", "noopener,noreferrer");
                                                    }
                                                }}
                                                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold ${bg} ${hover} text-white flex items-center gap-1.5 shadow-sm transition-all`}
                                            >
                                                <ExternalLink size={12} />
                                                <span>2. Sekmede Test Et</span>
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            disabled={!canWriteCtiTab}
                                            placeholder="https://crm.sirketiniz.com/musteri-karti?telefon={caller_clean}&dahili={extension}&call_id={call_id}"
                                            value={ctiConfig.screen_pop_url || ""}
                                            onChange={(e) => setCtiConfig(prev => ({ ...prev, screen_pop_url: e.target.value }))}
                                            className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 mr-1">Dinamik Parametre Ekle:</span>
                                            {[
                                                { tag: "{caller_clean}", desc: "Rakam Numara (05321234567)" },
                                                { tag: "{caller}", desc: "Ham Arayan No" },
                                                { tag: "{last10}", desc: "Son 10 Hane (5321234567)" },
                                                { tag: "{extension}", desc: "Temsilci Dahili" },
                                                { tag: "{call_id}", desc: "Çağrı ID" },
                                                { tag: "{queue}", desc: "Kuyruk No" },
                                                { tag: "{agent_name}", desc: "Temsilci Adı" }
                                            ].map((chip) => (
                                                <button
                                                    key={chip.tag}
                                                    type="button"
                                                    disabled={!canWriteCtiTab}
                                                    onClick={() =>
                                                        setCtiConfig(prev => ({
                                                            ...prev,
                                                            screen_pop_url: (prev.screen_pop_url || "") + chip.tag
                                                        }))
                                                    }
                                                    title={chip.desc}
                                                    className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 transition-all"
                                                >
                                                    + {chip.tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                                Otomatik Sekme Açılma Zamanı
                                            </label>
                                            <select
                                                disabled={!canWriteCtiTab}
                                                value={ctiConfig.trigger_mode || "on_ring"}
                                                onChange={(e) => setCtiConfig(prev => ({ ...prev, trigger_mode: e.target.value }))}
                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            >
                                                <option value="on_ring">Çağrı Çaldığında Otomatik Aç (Anında 2. Sekme)</option>
                                                <option value="on_answer">Çağrı Cevaplandığında Otomatik Aç (Görüşme Başlayınca)</option>
                                                <option value="manual">Sadece Manuel Buton İle Aç</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                                Tarayıcı Sekme Davranışı
                                            </label>
                                            <select
                                                disabled={!canWriteCtiTab}
                                                value={ctiConfig.open_mode || "new_tab"}
                                                onChange={(e) => setCtiConfig(prev => ({ ...prev, open_mode: e.target.value }))}
                                                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                            >
                                                <option value="new_tab">Her Çağrıda Yeni Sekme Aç (_blank)</option>
                                                <option value="reuse_tab">Mevcut CRM Sekmesini Yenile (Tek Sekme)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Optional Live CRM API Lookup for Agent Webphone Card */}
                                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                                <Database size={14} className={text} />
                                                Web Telefon Üzerinde Canlı CRM Müşteri Kartı Ön İzleme (REST API)
                                            </h6>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                2. sekmede CRM ekranını açarken aynı zamanda temsilcinin Web Telefon ekranında müşterinin CRM özet bilgilerini gösterir.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!canWriteCtiTab}
                                            onClick={() => setCtiConfig(prev => ({ ...prev, lookup_api_enabled: !prev.lookup_api_enabled }))}
                                            className="text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            {ctiConfig.lookup_api_enabled ? <ToggleRight size={24} className={text} /> : <ToggleLeft size={24} />}
                                        </button>
                                    </div>

                                    {ctiConfig.lookup_api_enabled && (
                                        <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">HTTP Metodu</label>
                                                    <select
                                                        disabled={!canWriteCtiTab}
                                                        value={ctiConfig.lookup_api_method || "GET"}
                                                        onChange={(e) => setCtiConfig(prev => ({ ...prev, lookup_api_method: e.target.value }))}
                                                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                                    >
                                                        <option value="GET">GET</option>
                                                        <option value="POST">POST</option>
                                                    </select>
                                                </div>
                                                <div className="sm:col-span-9">
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CRM Müşteri Sorgu API URL</label>
                                                    <input
                                                        type="text"
                                                        disabled={!canWriteCtiTab}
                                                        placeholder="https://api.sirketiniz.com/v1/customers/lookup?phone={caller_clean}"
                                                        value={ctiConfig.lookup_api_url || ""}
                                                        onChange={(e) => setCtiConfig(prev => ({ ...prev, lookup_api_url: e.target.value }))}
                                                        className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                <div className="sm:col-span-4">
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Kimlik Doğrulama (Auth)</label>
                                                    <select
                                                        disabled={!canWriteCtiTab}
                                                        value={ctiConfig.lookup_auth_type || "none"}
                                                        onChange={(e) => setCtiConfig(prev => ({ ...prev, lookup_auth_type: e.target.value }))}
                                                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                                    >
                                                        <option value="none">Doğrulama Yok</option>
                                                        <option value="bearer">Bearer Token</option>
                                                        <option value="api_key">Özel Header (API Key)</option>
                                                        <option value="basic">Basic Auth</option>
                                                    </select>
                                                </div>
                                                {ctiConfig.lookup_auth_type === "api_key" && (
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Header Adı</label>
                                                        <input
                                                            type="text"
                                                            disabled={!canWriteCtiTab}
                                                            placeholder="X-API-Key"
                                                            value={ctiConfig.lookup_auth_header_name || "X-API-Key"}
                                                            onChange={(e) => setCtiConfig(prev => ({ ...prev, lookup_auth_header_name: e.target.value }))}
                                                            className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                                        />
                                                    </div>
                                                )}
                                                {ctiConfig.lookup_auth_type && ctiConfig.lookup_auth_type !== "none" && (
                                                    <div className={ctiConfig.lookup_auth_type === "api_key" ? "sm:col-span-5" : "sm:col-span-8"}>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">API Token / Anahtar</label>
                                                        <input
                                                            type="password"
                                                            disabled={!canWriteCtiTab}
                                                            placeholder="Gizli API anahtarınızı giriniz..."
                                                            value={ctiConfig.lookup_auth_token || ""}
                                                            onChange={(e) => setCtiConfig(prev => ({ ...prev, lookup_auth_token: e.target.value }))}
                                                            className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Live CRM Test Row */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                                                <input
                                                    type="text"
                                                    placeholder="Test Telefon No (0532...)"
                                                    value={ctiTestPhone}
                                                    onChange={(e) => setCtiTestPhone(e.target.value)}
                                                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 sm:w-56"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={ctiTesting}
                                                    onClick={async () => {
                                                        setCtiTesting(true);
                                                        setCtiTestResult(null);
                                                        try {
                                                            const res = await safeFetch(`/api/cti/test`, {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({
                                                                    caller: ctiTestPhone || "05321234567",
                                                                    extension: extension || "1000",
                                                                    call_id: "test-call-1001",
                                                                    custom_api_url: ctiConfig.lookup_api_url,
                                                                    custom_api_method: ctiConfig.lookup_api_method || "GET",
                                                                    custom_auth_type: ctiConfig.lookup_auth_type || "none",
                                                                    custom_auth_header_name: ctiConfig.lookup_auth_header_name || "X-API-Key",
                                                                    custom_auth_token: ctiConfig.lookup_auth_token || ""
                                                                })
                                                            });
                                                            const data = await res.json();
                                                            setCtiTestResult(data);
                                                        } catch (err) {
                                                            setCtiTestResult({ status: "error", message: err.message });
                                                        } finally {
                                                            setCtiTesting(false);
                                                        }
                                                    }}
                                                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-1.5 transition-all"
                                                >
                                                    <Play size={12} />
                                                    <span>{ctiTesting ? "Sorgulanıyor..." : "CRM Sorgusunu Test Et"}</span>
                                                </button>
                                            </div>

                                            {ctiTestResult && (
                                                <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-40">
                                                    <pre>{JSON.stringify(ctiTestResult, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: UYGULAMALAR */}
                        {activeTab === "applications" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        <LayoutGrid size={16} className={text} />
                                        Uygulamalar & Kolay Giriş Yönetimi
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Kullanıcının masaüstü ve mobil uygulama kurulum paketlerini, süreli Kolay Giriş Linkini (URL), QR kodunu, e-posta davetiyesini ve bağlı oturumlarını buradan yönetin.
                                    </p>
                                </div>

                                {editingUser ? (
                                    <UserApplicationsPanel
                                        userId={editingUser.id || editingUser.extension}
                                        userObj={{
                                            ...editingUser,
                                            full_name: fullName || editingUser.full_name,
                                            email: email || editingUser.email,
                                            extension: extension || editingUser.extension
                                        }}
                                        isAdminView={true}
                                        canEdit={true}
                                    />
                                ) : (
                                    <div className={"p-8 rounded-2xl border " + borderLight + " " + lightBg + " flex flex-col items-center justify-center text-center space-y-3 my-4"}>
                                        <div className={"w-12 h-12 rounded-2xl border " + border + " bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm " + text}>
                                            <Monitor size={22} />
                                        </div>
                                        <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                                            Önce Kullanıcıyı Kaydedin
                                        </h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                                            Yeni kullanıcıyı kaydettikten sonra bu sekme üzerinden süreli <strong>Kolay Giriş Linki (URL)</strong>, <strong>Mobil QR Kod</strong> ve <strong>E-Posta Kurulum Davetiyesi</strong> oluşturabilirsiniz.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB: BAĞLANTI GEÇMİŞİ & GÜVENİLİR CİHAZ KİLİDİ (YÖNTEM A VE B) */}
                        {activeTab === "connection_history" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                {/* 1. GÜVENİLİR CİHAZ KİLİDİ KARTI (YÖNTEM A: MANUEL & KOPYALA-YAPIŞTIR + TOGGLE) */}
                                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                                deviceLockEnabled
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/60 dark:border-slate-700"
                                            }`}>
                                                {deviceLockEnabled ? <Lock size={18} /> : <Unlock size={18} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                                                        Güvenilir Cihaz Kilidi (PC & Web Phone Doğrulama)
                                                    </h5>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                                                        deviceLockEnabled
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                                                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                                    }`}>
                                                        {deviceLockEnabled ? `Aktif (${trustedDevices.length} Cihaz Yetkili)` : "Pasif (Tüm Cihazlara Açık)"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                    Açıldığında kullanıcı <strong>şifre ve 2FA doğrulamasını geçse bile</strong> yalnızca aşağıda tanımlı <code>AIDA-DEV-XXXX-YYYY</code> anahtarına sahip bilgisayar/tarayıcılardan panele girebilir ve Web Phone (SIP) kaydedebilir.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!canWrite || trustedDeviceBusy}
                                            onClick={() => handleToggleDeviceLock(!deviceLockEnabled)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                                                deviceLockEnabled
                                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            }`}
                                        >
                                            {deviceLockEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            <span>{deviceLockEnabled ? "Cihaz Kilidi Açık" : "Cihaz Kilidini Aç"}</span>
                                        </button>
                                    </div>

                                    {trustedDeviceMsg && (
                                        <div className={`px-3.5 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${
                                            trustedDeviceMsg?.type === "error"
                                                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                                                : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                                        }`}>
                                            <span>{typeof trustedDeviceMsg === "object" ? (trustedDeviceMsg.text || "") : String(trustedDeviceMsg)}</span>
                                            <button type="button" onClick={() => setTrustedDeviceMsg(null)} className="hover:opacity-75">
                                                <X size={13} />
                                            </button>
                                        </div>
                                    )}

                                    {/* YÖNTEM A: MANUEL EKLEME FORMU + BU PC ANAHTARI YARDIMCISI */}
                                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                                <KeyRound size={13} className={text} />
                                                Yöntem A — Cihaz Anahtarı İle Manuel Ekle
                                            </span>
                                            {adminLocalDeviceKey && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-slate-400">Bu PC:</span>
                                                    <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {adminLocalDeviceKey}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewTrustedDeviceKey(adminLocalDeviceKey);
                                                            if (!newTrustedDeviceLabel) setNewTrustedDeviceLabel("Yönetici / Ofis PC");
                                                        }}
                                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                                                    >
                                                        Forma Yaz
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <input
                                                type="text"
                                                value={newTrustedDeviceLabel}
                                                onChange={(e) => setNewTrustedDeviceLabel(e.target.value)}
                                                placeholder="Cihaz Adı (Örn: Ofis Masaüstü PC, Ev Laptop)"
                                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={newTrustedDeviceKey}
                                                onChange={(e) => setNewTrustedDeviceKey(e.target.value.toUpperCase())}
                                                placeholder="AIDA-DEV-XXXX-YYYY"
                                                className="sm:w-56 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-white uppercase focus:outline-none"
                                            />
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    disabled={trustedDeviceBusy || !normalizeDeviceKey(newTrustedDeviceKey)}
                                                    onClick={() => handleAddTrustedDevice(newTrustedDeviceKey, newTrustedDeviceLabel || "Güvenilir PC")}
                                                    title="Güvenilir Cihaz Ekle"
                                                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-40 self-end sm:self-center"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                            İpucu: Kullanıcı giriş ekranının altındaki veya Web Telefon Tanılama penceresindeki <strong>Cihaz Anahtarı</strong> kodunu kopyalayıp buraya ekleyebilir ya da aşağıdaki <strong>Bağlantı Geçmişi</strong> tablosundan <strong>1 Tıkla (Yöntem B)</strong> yetkilendirebilirsiniz.
                                        </p>
                                    </div>

                                    {/* KAYITLI GÜVENİLİR CİHAZLAR LİSTESİ */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                                                Kayıtlı Güvenilir Cihazlar ({trustedDevices.length})
                                            </span>
                                            {deviceLockEnabled && trustedDevices.length === 0 && (
                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                    <AlertTriangle size={12} />
                                                    Henüz cihaz eklenmediği için bu kullanıcı şu an hiçbir bilgisayardan giriş yapamaz!
                                                </span>
                                            )}
                                        </div>

                                        {trustedDevices.length === 0 ? (
                                            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                                                Henüz tanımlanmış güvenilir cihaz anahtarı bulunmuyor.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {trustedDevices.map((td) => (
                                                    <div
                                                        key={td.key}
                                                        className="p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <Shield size={13} className="text-emerald-500 shrink-0" />
                                                                <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                                                    {td.label || "Güvenilir PC"}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                                                                    {td.key}
                                                                </code>
                                                                {td.added_at && (
                                                                    <span className="text-[10px] text-slate-400 truncate">
                                                                        {new Date(td.added_at).toLocaleDateString("tr-TR")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    try { navigator.clipboard.writeText(td.key); } catch (e) {}
                                                                    setTrustedDeviceMsg(`Kopyalandı: ${td.key}`);
                                                                    setTimeout(() => setTrustedDeviceMsg(""), 2000);
                                                                }}
                                                                title="Anahtarı Kopyala"
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                            >
                                                                <Copy size={13} />
                                                            </button>
                                                            {canWrite && (
                                                                <button
                                                                    type="button"
                                                                    disabled={trustedDeviceBusy}
                                                                    onClick={() => handleRemoveTrustedDevice(td.key)}
                                                                    title="Güvenilir Cihazı Kaldır"
                                                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-40"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. BAĞLANTI GEÇMİŞİ VE YÖNTEM B (1 TIKLA YETKİLENDİRME) */}
                                {editingUser ? (
                                    <>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                                            <div>
                                                <h5 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                                    <Monitor size={16} className={text} />
                                                    Bağlantı & Cihaz Değişim Geçmişi (Yöntem B — 1 Tıkla Yetkilendirme)
                                                </h5>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Kullanıcının bağlandığı veya engellendiği cihazların IP, tarayıcı, işletim sistemi ve <strong>Cihaz Anahtarı</strong> kayıtları. Tek tıkla güvenilir listeye ekleyebilirsiniz.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Current Live Environment Banner */}
                                        {(() => {
                                            const liveDeviceKey = normalizeDeviceKey(connHistoryLive?.current_device_key || editingUser?.client_device_key || "");
                                            const isLiveKeyTrusted = liveDeviceKey && trustedDevices.some((d) => normalizeDeviceKey(d.key) === liveDeviceKey);
                                            const liveLabel = [
                                                connHistoryLive?.current_browser || editingUser?.client_browser,
                                                connHistoryLive?.current_os || editingUser?.client_os
                                            ].filter(Boolean).join(" / ") || "Aktif Cihaz";
                                            return (
                                                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                    (connHistoryLive?.is_online || editingUser?.is_registered)
                                                        ? "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/60"
                                                        : "bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800"
                                                }`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                                                            (connHistoryLive?.is_online || editingUser?.is_registered)
                                                                ? "bg-emerald-500 animate-pulse"
                                                                : "bg-rose-500"
                                                        }`} />
                                                        <div>
                                                            <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                                                                <span>
                                                                    {(connHistoryLive?.is_online || editingUser?.is_registered)
                                                                        ? "Şu Anda Web Telefon Bağlı"
                                                                        : "Şu Anda Çevrimdışı"}
                                                                </span>
                                                                {liveDeviceKey && (
                                                                    <code className="px-2 py-0.5 rounded bg-white/90 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                                        {liveDeviceKey}
                                                                    </code>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                {(connHistoryLive?.current_ip || editingUser?.ip_address)
                                                                    ? `Anlık Ortam: ${connHistoryLive?.current_ip || editingUser?.ip_address} • ${liveLabel}`
                                                                    : "Aktif SIP / WebRTC bağlantısı algılanmadı."}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {liveDeviceKey && canWrite && (
                                                            isLiveKeyTrusted ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                                    <Check size={12} />
                                                                    Güvenilir Cihaz
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={trustedDeviceBusy}
                                                                    onClick={() => handleAddTrustedDevice(liveDeviceKey, liveLabel)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                                                >
                                                                    <Plus size={13} />
                                                                    <span>Güvenilir Listeye Ekle</span>
                                                                </button>
                                                            )
                                                        )}
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                            Toplam {connHistoryList.length} kayıt
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* History Table */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                                            {connHistoryLoading ? (
                                                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                                    <RefreshCw size={15} className="animate-spin" />
                                                    <span>Bağlantı geçmişi yükleniyor...</span>
                                                </div>
                                            ) : connHistoryList.length === 0 ? (
                                                <div className="p-8 text-center text-xs text-slate-400">
                                                    Bu kullanıcı için henüz kaydedilmiş bir IP, tarayıcı veya cihaz geçmişi bulunmuyor.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                                <th className="py-3 px-3.5">Tarih / Saat</th>
                                                                <th className="py-3 px-3.5">Durum / Tür</th>
                                                                <th className="py-3 px-3.5">Önceki Ortam</th>
                                                                <th className="py-3 px-3.5">Bağlantı Ortamı</th>
                                                                <th className="py-3 px-3.5">Cihaz Anahtarı & 1 Tıkla Yetki</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                                                            {connHistoryList
                                                                .slice((connHistoryPage - 1) * connHistoryPageSize, connHistoryPage * connHistoryPageSize)
                                                                .map((item, idx) => {
                                                                const dtStr = item.timestamp
                                                                    ? new Date(item.timestamp.endsWith("Z") || item.timestamp.includes("+") ? item.timestamp : `${item.timestamp}Z`).toLocaleString("tr-TR", {
                                                                        day: "2-digit",
                                                                        month: "2-digit",
                                                                        year: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                        second: "2-digit",
                                                                      })
                                                                    : "-";
                                                                const isBlocked = item.action === "DEVICE_KEY_BLOCKED";
                                                                const isInitial = item.action === "CLIENT_ENV_CONNECT" || (!item.previous_ip && !isBlocked);
                                                                const prevEnv = item.previous_ip
                                                                    ? [
                                                                        item.previous_ip,
                                                                        [item.previous_browser, item.previous_os].filter(Boolean).join(" / ")
                                                                      ].filter(Boolean).join(" • ")
                                                                    : "-";
                                                                const newEnv = [
                                                                    item.ip_address,
                                                                    [item.browser, item.os].filter(Boolean).join(" / ")
                                                                ].filter(Boolean).join(" • ") || "-";
                                                                const rowDevKey = normalizeDeviceKey(item.device_key || "");
                                                                const isRowKeyTrusted = rowDevKey && trustedDevices.some((d) => normalizeDeviceKey(d.key) === rowDevKey);
                                                                const suggestedLabel = [item.browser, item.os].filter(Boolean).join(" / ") || (item.ip_address ? `PC (${item.ip_address})` : "Kullanıcı PC");
                                                                return (
                                                                    <tr key={item.id || idx} className={`transition-colors ${
                                                                        isBlocked
                                                                            ? "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30"
                                                                            : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                                                                    }`}>
                                                                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                                            {dtStr}
                                                                        </td>
                                                                        <td className="py-3 px-3.5 whitespace-nowrap">
                                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                                                                                isBlocked
                                                                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                                                                                    : isInitial
                                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                                                                                    : "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                                                                            }`}>
                                                                                {item.change_label || (isBlocked ? "Yetkisiz Cihaz Engellendi" : isInitial ? "İlk Bağlantı" : "Ortam Değişti")}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                            {prevEnv}
                                                                        </td>
                                                                        <td className="py-3 px-3.5 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                                                            {newEnv}
                                                                        </td>
                                                                        <td className="py-3 px-3.5 whitespace-nowrap">
                                                                            {rowDevKey ? (
                                                                                <div className="flex items-center gap-2">
                                                                                    <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                                                        {rowDevKey}
                                                                                    </code>
                                                                                    {isRowKeyTrusted ? (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                                                            <Check size={11} />
                                                                                            Güvenilir
                                                                                        </span>
                                                                                    ) : canWrite ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={trustedDeviceBusy}
                                                                                            onClick={() => handleAddTrustedDevice(rowDevKey, suggestedLabel)}
                                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-40"
                                                                                            title="Bu cihaz anahtarını tek tıkla kullanıcının güvenilir cihaz listesine ekle"
                                                                                        >
                                                                                            <Plus size={11} />
                                                                                            <span>Güvenilir Listeye Ekle</span>
                                                                                        </button>
                                                                                    ) : null}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[10px] text-slate-400">-</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    <TablePagination
                                                        currentPage={connHistoryPage}
                                                        totalItems={connHistoryList.length}
                                                        pageSize={connHistoryPageSize}
                                                        onPageChange={setConnHistoryPage}
                                                        onPageSizeChange={(sz) => {
                                                            setConnHistoryPageSize(sz);
                                                            setConnHistoryPage(1);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                                        Kullanıcı oluşturulduktan sonra bağlantı geçmişi ve 1 tıkla cihaz yetkilendirme tablosu burada görüntülenecektir.
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Fixed Action Buttons Footer */}
                    <div className="shrink-0 flex gap-3 px-7 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${bg} ${hover} text-white transition-all shadow-sm disabled:opacity-50`}
                        >
                            {submitting ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Native Modal Dialog 1: SIP Cihazı Ekle / Düzenle */}
      <dialog
        ref={sipDeviceEditDialogRef}
        aria-labelledby="sip-device-edit-dialog-title"
        onClose={(e) => {
          e.currentTarget.returnValue = "";
          setIsSipDeviceEditOpen(false);
        }}
        className="m-auto w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-0 shadow-2xl overscroll-contain backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain"
      >
        {sipDeviceDraft && (() => {
          const isVirtualDraft = sipDeviceDraft.device_type === "virtual_subscriber";
          const isWebPhoneDraft = sipDeviceDraft.device_type === "web_phone";
          const draftVMode = sipDeviceDraft.virtual_target_mode === "custom" ? "custom" : "extension";
          const cleanDraftPfx = String(sipDeviceDraft.prefix || "").replace(/[^0-9a-zA-Z*#+_.-]/g, "").trim();
          const cleanDraftCustom = String(sipDeviceDraft.custom_target || "").replace(/[^0-9a-zA-Z*#+_.-]/g, "").trim();
          const extForPreview = String(extension || editingUser?.extension || "").trim() || "<Dahili>";
          const computedVirtualPayload = draftVMode === "custom"
            ? (cleanDraftCustom || "<Özel_Veri>")
            : `${cleanDraftPfx}${extForPreview}`;
          const selectedTrunkObj = trunksList.find(
            (t) => String(t.trunk_name || t.name || "") === String(sipDeviceDraft.trunk || "")
          );
          const safeTrunkPreview = String(sipDeviceDraft.trunk || "")
            .trim()
            .replace(/[^a-zA-Z0-9_.-]/g, "_") || "<Secili_Trunk>";
          const trunkDialPreview = selectedTrunkObj
            ? String(selectedTrunkObj.trunk_type || "register").toLowerCase() === "account" || !selectedTrunkObj.host
              ? `PJSIP/${computedVirtualPayload}@${safeTrunkPreview}`
              : (selectedTrunkObj.trunk_name === "908503607390" || safeTrunkPreview === "Operator_Trunk")
              ? `PJSIP/Operator_Trunk/sip:${computedVirtualPayload}@${selectedTrunkObj.host}:${selectedTrunkObj.port || 5060}`
              : `PJSIP/${safeTrunkPreview}/sip:${computedVirtualPayload}@${selectedTrunkObj.host}:${selectedTrunkObj.port || 5060}`
            : `PJSIP/${computedVirtualPayload}@${safeTrunkPreview}`;
          const syncAriaInvalid = (ev) => {
            const el = ev?.currentTarget;
            if (el && typeof el.matches === "function") {
              try {
                el.setAttribute("aria-invalid", el.matches(":user-invalid") ? "true" : "false");
              } catch (_) {}
            }
          };

          return (
          <form onSubmit={handleSaveSipDeviceModal} className="flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-950/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lightBg} ${text}`}>
                  {isWebPhoneDraft ? <Wifi size={16} /> : isVirtualDraft ? <Cable size={16} /> : <Phone size={16} />}
                </div>
                <div>
                  <h2 id="sip-device-edit-dialog-title" className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    {isWebPhoneDraft
                      ? "Web Telefonu (WebRTC) Ayarları"
                      : sipDeviceFormMode === "add"
                      ? "Yeni SIP Cihazı Ekle"
                      : "SIP Cihazı Ayarlarını Düzenle"}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isWebPhoneDraft
                      ? `Dahili ${extension || "-"} tarayıcı telefonunun Asterisk PJSIP kayıt kimliği`
                      : isVirtualDraft
                      ? `Dahili ${extension || "-"} arandığında seçili SIP Trunk üzerinden harici santrale yönlendirir`
                      : `Dahili ${extension || "-"} için SIP kayıt ve aktivasyon kimlik bilgileri`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSipDeviceEditOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                aria-label="Pencereyi Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sip-dev-name" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {isWebPhoneDraft ? "Web Telefonu Etiketi" : isVirtualDraft ? "Sanal Abone / Tanım Adı" : "SIP Cihazı Adı"}
                  </label>
                  <input
                    id="sip-dev-name"
                    name="name"
                    type="text"
                    autoFocus
                    required
                    placeholder={isWebPhoneDraft ? "Web Telefonu" : isVirtualDraft ? "Örn: Merkez Santral Dahili" : "Örn: Masa Telefonu 1, Ev Telefonu"}
                    value={sipDeviceDraft.name || ""}
                    onChange={(e) => setSipDeviceDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="sip-dev-type" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Telefon / Cihaz Tipi
                  </label>
                  <select
                    id="sip-dev-type"
                    name="device_type"
                    disabled={isWebPhoneDraft}
                    value={sipDeviceDraft.device_type || "desk_phone"}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setSipDeviceDraft((prev) => {
                        const curName = String(prev?.name || "").trim();
                        let updatedName = prev?.name || "";
                        if (nextType === "virtual_subscriber" && (!curName || /^(Masa Telefonu|SIP Cihazı)\s*\d*$/i.test(curName))) {
                          updatedName = "Sanal Abone";
                        } else if (nextType !== "virtual_subscriber" && /^Sanal Abone\s*\d*$/i.test(curName)) {
                          updatedName = `Masa Telefonu ${sipDevices.filter((d) => d.device_type !== "web_phone").length + 1}`;
                        }
                        return {
                          ...prev,
                          device_type: nextType,
                          name: updatedName,
                          sip_username: nextType !== "virtual_subscriber" && !prev?.sip_username ? generateSipUsernameStr() : prev?.sip_username || "",
                          sip_password: nextType !== "virtual_subscriber" && !prev?.sip_password ? generateSipPasswordStr() : prev?.sip_password || "",
                          virtual_target_mode: prev?.virtual_target_mode === "custom" ? "custom" : "extension"
                        };
                      });
                    }}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isWebPhoneDraft ? (
                      <option value="web_phone">Web Telefonu (Tarayıcı / WebRTC)</option>
                    ) : (
                      <>
                        <option value="desk_phone">Masa Telefonu (IP Telefon)</option>
                        <option value="dect">DECT Kablosuz Telefon</option>
                        <option value="softphone">Masaüstü / Mobil SIP İstemci</option>
                        <option value="virtual_subscriber">Sanal Abone (Harici Santral / Trunk)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {isVirtualDraft ? (
                <>
                  <div>
                    <label htmlFor="sip-dev-trunk" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      SIP Trunk Bağlantısı <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="sip-dev-trunk"
                      name="trunk"
                      required
                      value={sipDeviceDraft.trunk || ""}
                      onBlur={syncAriaInvalid}
                      onChange={(e) => {
                        syncAriaInvalid(e);
                        setSipDeviceDraft((prev) => ({ ...prev, trunk: e.target.value }));
                      }}
                      aria-describedby="virtual-sub-preview"
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none user-invalid:border-rose-500"
                    >
                      <option value="" disabled>
                        {trunksList.length > 0 ? "SIP Trunk seçiniz..." : "Tanımlı SIP Trunk bulunamadı"}
                      </option>
                      {sipDeviceDraft.trunk &&
                        !trunksList.some((t) => String(t.trunk_name || t.name || "") === String(sipDeviceDraft.trunk)) && (
                          <option value={sipDeviceDraft.trunk}>{sipDeviceDraft.trunk}</option>
                        )}
                      {trunksList.map((tItem, tIdx) => {
                        const tVal = tItem.trunk_name || tItem.name || `trunk_${tIdx + 1}`;
                        const tHostLbl = tItem.host ? ` (${tItem.host}${tItem.port ? `:${tItem.port}` : ""})` : "";
                        const tStateLbl = tItem.is_active === false ? " [Pasif]" : "";
                        return (
                          <option key={tItem.id || `${tVal}-${tIdx}`} value={tVal}>
                            {tVal}{tHostLbl}{tStateLbl}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Karşı Santrale Gönderilecek Veri Seçimi
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label
                        htmlFor="vmode-extension"
                        className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                          draftVMode === "extension"
                            ? `${border} ${lightBg}`
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <input
                          id="vmode-extension"
                          type="radio"
                          name="virtual_target_mode"
                          value="extension"
                          checked={draftVMode === "extension"}
                          onChange={() => setSipDeviceDraft((prev) => ({ ...prev, virtual_target_mode: "extension" }))}
                          className="mt-0.5 accent-current"
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${draftVMode === "extension" ? text : "text-slate-800 dark:text-slate-100"}`}>
                            Prefix + Dahili Numarası
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Ön ek ile dahili numarasını ({extForPreview}) birleştirip gönderir
                          </div>
                        </div>
                      </label>

                      <label
                        htmlFor="vmode-custom"
                        className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                          draftVMode === "custom"
                            ? `${border} ${lightBg}`
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <input
                          id="vmode-custom"
                          type="radio"
                          name="virtual_target_mode"
                          value="custom"
                          checked={draftVMode === "custom"}
                          onChange={() => setSipDeviceDraft((prev) => ({ ...prev, virtual_target_mode: "custom" }))}
                          className="mt-0.5 accent-current"
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${draftVMode === "custom" ? text : "text-slate-800 dark:text-slate-100"}`}>
                            Özel Veri / Farklı Hedef
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Dahiliden bağımsız özel numara veya SIP verisi gönderir
                          </div>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  {draftVMode === "extension" ? (
                    <div>
                      <label htmlFor="sip-dev-prefix" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Arama Prefix (Ön Ek) <span className="font-normal normal-case text-slate-400">(İsteğe Bağlı)</span>
                      </label>
                      <input
                        id="sip-dev-prefix"
                        name="prefix"
                        type="text"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        aria-describedby="virtual-sub-preview"
                        placeholder="Örn: 8, 09, *77 (Doğrudan dahili göndermek için boş bırakın)"
                        value={sipDeviceDraft.prefix || ""}
                        onChange={(e) => setSipDeviceDraft((prev) => ({ ...prev, prefix: e.target.value }))}
                        className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="sip-dev-custom-target" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Karşı Santrale Gönderilecek Özel Veri / Hedef <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="sip-dev-custom-target"
                        name="custom_target"
                        type="text"
                        required
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        aria-describedby="virtual-sub-preview"
                        placeholder="Örn: 4420, sales_ivr, *77100 veya 902125554433"
                        value={sipDeviceDraft.custom_target || ""}
                        onBlur={syncAriaInvalid}
                        onChange={(e) => {
                          syncAriaInvalid(e);
                          setSipDeviceDraft((prev) => ({ ...prev, custom_target: e.target.value }));
                        }}
                        className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none user-invalid:border-rose-500"
                      />
                    </div>
                  )}

                  <div
                    id="virtual-sub-preview"
                    className={`p-3 rounded-xl border ${borderLight} ${lightBg} space-y-1`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-slate-300">Karşı Santrale İletilecek Veri:</span>
                      <span className={`font-mono font-extrabold ${text}`}>{computedVirtualPayload}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                      Çağrı Hedefi: {trunkDialPreview}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="sip-dev-username" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      {isWebPhoneDraft ? "Web Telefonu SIP Kullanıcı Adı" : "Kullanıcı Adı (SIP Aktivasyon)"}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="sip-dev-username"
                        name="sip_username"
                        type="text"
                        required
                        pattern=".*[A-Za-z].*"
                        aria-describedby="sip-dev-username-hint"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={isWebPhoneDraft ? "Örn: Wg4K9p2X" : "Örn: Ab8kP2x9"}
                        value={sipDeviceDraft.sip_username || ""}
                        onBlur={syncAriaInvalid}
                        onChange={(e) => {
                          syncAriaInvalid(e);
                          setSipDeviceDraft((prev) => ({ ...prev, sip_username: e.target.value }));
                        }}
                        className="flex-1 text-xs font-bold font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none user-invalid:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => copyTextWithFeedback(sipDeviceDraft.sip_username, "modal-su")}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        title="Kullanıcı Adını Kopyala"
                        aria-label="SIP Kullanıcı Adını Kopyala"
                      >
                        {copiedDeviceKey === "modal-su" ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSipDeviceDraft((prev) => ({ ...prev, sip_username: generateSipUsernameStr() }))}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        title="Yeni Kullanıcı Adı Üret"
                        aria-label="Yeni SIP Kullanıcı Adı Üret"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <p id="sip-dev-username-hint" className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      Asterisk PJSIP üzerinde sayısal dahili ({extension || "1000"}) oluşmaması için en az bir harf içermelidir.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="sip-dev-password" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      SIP Register Şifresi
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="sip-dev-password"
                        name="sip_password"
                        type={showDraftSipPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={sipDeviceDraft.sip_password || ""}
                        onChange={(e) => setSipDeviceDraft((prev) => ({ ...prev, sip_password: e.target.value }))}
                        className="flex-1 text-xs font-mono tracking-wider px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-pressed={showDraftSipPassword}
                        onClick={() => setShowDraftSipPassword((v) => !v)}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        title={showDraftSipPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                        aria-label={showDraftSipPassword ? "SIP Şifresini Gizle" : "SIP Şifresini Göster"}
                      >
                        {showDraftSipPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyTextWithFeedback(sipDeviceDraft.sip_password, "modal-pwd")}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        title="Şifreyi Kopyala"
                        aria-label="SIP Şifresini Kopyala"
                      >
                        {copiedDeviceKey === "modal-pwd" ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSipDeviceDraft((prev) => ({ ...prev, sip_password: generateSipPasswordStr() }))}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        title="Yeni Şifre Üret"
                        aria-label="Yeni SIP Şifresi Üret"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sip-dev-max-activations" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Maksimum Aktivasyon Sayısı
                      </label>
                      <select
                        id="sip-dev-max-activations"
                        name="max_activations"
                        value={sipDeviceDraft.max_activations || (isWebPhoneDraft ? 5 : 1)}
                        onChange={(e) => setSipDeviceDraft((prev) => ({ ...prev, max_activations: Number(e.target.value) }))}
                        className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                      >
                        {(isWebPhoneDraft ? [1, 2, 3, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5]).map((cnt) => (
                          <option key={cnt} value={cnt}>{cnt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sip-dev-transport" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Transport Protokolü
                      </label>
                      {isWebPhoneDraft ? (
                        <input
                          id="sip-dev-transport"
                          name="transport"
                          type="text"
                          readOnly
                          value="WSS / WebRTC (DTLS-SRTP - 8089)"
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed focus:outline-none"
                        />
                      ) : (
                        <select
                          id="sip-dev-transport"
                          name="transport"
                          value={sipDeviceDraft.transport || "UDP"}
                          onChange={(e) => setSipDeviceDraft((prev) => ({ ...prev, transport: e.target.value }))}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                        >
                          <option value="UDP">UDP (Standart - 5060)</option>
                          <option value="TCP">TCP (Güvenilir Akış - 5060)</option>
                          <option value="TLS">TLS (Şifreli Sinyalizasyon)</option>
                        </select>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">
                    {isWebPhoneDraft
                      ? "Web Telefonu Aktif"
                      : isVirtualDraft
                      ? "Sanal Abone Yönlendirmesi Aktif"
                      : "SIP Cihazı Aktif"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isWebPhoneDraft
                      ? "Pasif yapıldığında tarayıcı içi Web Telefonu Asterisk'e kayıt olmaz ve gelen aramalarda çalmaz."
                      : isVirtualDraft
                      ? "Pasif yapıldığında bu sanal abone üzerinden seçili SIP Trunk hattına çağrı yönlendirilmez."
                      : "Pasif yapıldığında bu cihaz Asterisk PJSIP üzerinde çalmaz ve dış arama yapamaz."}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sipDeviceDraft.is_active !== false}
                  aria-label="SIP Cihazı Aktif Durumu"
                  onClick={() => setSipDeviceDraft((prev) => ({ ...prev, is_active: prev.is_active === false }))}
                  className="shrink-0"
                >
                  {sipDeviceDraft.is_active !== false ? (
                    <ToggleRight size={30} className={text} />
                  ) : (
                    <ToggleLeft size={30} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20 shrink-0">
              <button
                type="button"
                onClick={() => setIsSipDeviceEditOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm`}
              >
                {sipDeviceFormMode === "add"
                  ? (isVirtualDraft ? "Sanal Aboneyi Ekle" : "SIP Cihazını Ekle")
                  : "Cihaz Ayarlarını Uygula"}
              </button>
            </div>
          </form>
          );
        })()}
      </dialog>

      {/* Native Modal Dialog 2: 🔍 Büyüteç — SIP Cihazı İnceleme, BLF & PJSIP Dahili Detay */}
      <dialog
        ref={sipDeviceInspectDialogRef}
        aria-labelledby="sip-device-inspect-dialog-title"
        onClose={(e) => {
          e.currentTarget.returnValue = "";
          setIsSipDeviceInspectOpen(false);
        }}
        className="m-auto w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-0 shadow-2xl overscroll-contain backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain"
      >
        {inspectDraft && (() => {
          const isWebInspect = inspectDraft.device_type === "web_phone";
          const pjsipData = inspectLiveInfo?.pjsip || {};
          const liveIp = pjsipData.ip_address || inspectDraft.live_ip || inspectDraft.ip || "";
          const livePort = pjsipData.port || "";
          const isOnlineNow = Boolean(inspectLiveInfo?.is_online || pjsipData.registered || inspectDraft.is_online);
          const brandModels = SIP_PHONE_MODELS[inspectDraft.brand] || ["Standart SIP"];
          const provUrl = inspectLiveInfo?.prov_url || "";
          const visibleInspectTabs = isWebInspect
            ? [
                { id: "overview", label: "WebRTC & Bağlantı Özeti", icon: Wifi },
                { id: "pjsip", label: "PJSIP Dahili Detay", icon: Terminal }
              ]
            : [
                { id: "overview", label: "Cihaz & Ağ Detayları", icon: Wifi },
                { id: "blf", label: `BLF & Tuş Tanımları (${(inspectDraft.dss_keys || []).length})`, icon: LayoutGrid },
                { id: "phone_settings", label: "Diğer Telefon Ayarları", icon: Settings },
                { id: "pjsip", label: "PJSIP Dahili Detay", icon: Terminal }
              ];
          const visibleInspectTabIds = visibleInspectTabs.map((t) => t.id);

          const addDssKeyRow = () => {
            const cur = Array.isArray(inspectDraft.dss_keys) ? inspectDraft.dss_keys : [];
            const usedNums = new Set(cur.map((k) => Number(k.key)));
            let nextKey = 1;
            while (usedNums.has(nextKey) && nextKey <= 48) nextKey += 1;
            setInspectDraft((prev) => ({
              ...prev,
              dss_keys: [
                ...(prev.dss_keys || []),
                { key: nextKey, type: "blf", label: "", value: "", extension: "**" }
              ]
            }));
          };

          const autoFillDirectoryBlf = () => {
            const peerUsers = users
              .filter((u) => u.extension && String(u.extension) !== String(extension) && u.is_active !== false)
              .slice(0, 12);
            const autoKeys = peerUsers.map((u, idx) => ({
              key: idx + 1,
              type: "blf",
              label: (u.full_name || u.extension).slice(0, 18),
              value: String(u.extension),
              extension: "**"
            }));
            setInspectDraft((prev) => ({ ...prev, dss_keys: autoKeys }));
          };

          const toggleCodec = (codecId) => {
            setInspectDraft((prev) => {
              const cur = Array.isArray(prev.codecs) ? [...prev.codecs] : [];
              const exists = cur.includes(codecId);
              if (exists && cur.length <= 1) return prev; // keep at least 1 codec
              const next = exists ? cur.filter((c) => c !== codecId) : [...cur, codecId];
              return { ...prev, codecs: next };
            });
          };

          const moveCodec = (codecId, dir) => {
            setInspectDraft((prev) => {
              const cur = Array.isArray(prev.codecs) ? [...prev.codecs] : [];
              const idx = cur.indexOf(codecId);
              const swapIdx = idx + dir;
              if (idx < 0 || swapIdx < 0 || swapIdx >= cur.length) return prev;
              [cur[idx], cur[swapIdx]] = [cur[swapIdx], cur[idx]];
              return { ...prev, codecs: cur };
            });
          };

          return (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${lightBg} ${text} border ${borderLight}`}>
                    <Search size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 id="sip-device-inspect-dialog-title" className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider truncate">
                        {inspectDraft.name} — Cihaz İnceleme &amp; Telefon Ayarları
                      </h2>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isOnlineNow ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        {isOnlineNow ? "ÇEVRİMİÇİ" : "ÇEVRİMDIŞI"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      Dahili: {extension || "-"} • SIP Endpoint: {inspectDraft.sip_username} {liveIp ? `• IP: ${liveIp}${livePort ? `:${livePort}` : ""}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSipDeviceInspectOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                  aria-label="İnceleme Penceresini Kapat"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Accessible WAI-ARIA Tablist */}
              <div
                role="tablist"
                aria-label="SIP Cihazı İnceleme Sekmeleri"
                className="flex flex-wrap gap-1.5 px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 shrink-0"
              >
                {visibleInspectTabs.map((tb) => {
                  const IconComp = tb.icon;
                  const selected = inspectTab === tb.id;
                  return (
                    <button
                      key={tb.id}
                      ref={(el) => { inspectTabRefs.current[tb.id] = el; }}
                      id={`inspect-tab-${tb.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`inspect-panel-${tb.id}`}
                      tabIndex={selected ? 0 : -1}
                      onKeyDown={(e) => handleInspectTabKeyDown(e, tb.id, visibleInspectTabIds)}
                      onClick={() => setInspectTab(tb.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        selected
                          ? `${bg} text-white shadow-sm`
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <IconComp size={14} />
                      <span>{tb.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Status Banner */}
              {inspectActionMsg && (
                <div className={`mx-6 mt-4 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                  inspectActionMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                }`}>
                  <span>{inspectActionMsg.text}</span>
                  <button type="button" onClick={() => setInspectActionMsg(null)} aria-label="Bildirimi Kapat">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Body Panels */}
              <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
                {/* TAB 1: CİHAZ & AĞ DETAYLARI */}
                {inspectTab === "overview" && (
                  <div id="inspect-panel-overview" role="tabpanel" aria-labelledby="inspect-tab-overview" className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kayıt &amp; Durum</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isOnlineNow ? "bg-emerald-500" : "bg-slate-400"}`} />
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                            {isOnlineNow ? "Kayıtlı (Online)" : "Kayıtsız (Offline)"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Durum: {pjsipData.device_state || "Bilinmiyor"} {pjsipData.rtt_ms ? `• RTT: ${pjsipData.rtt_ms} ms` : ""}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {isWebInspect ? "İstemci IP Adresi & WSS" : "Canlı IP Adresi & Web Arayüzü"}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold font-mono text-slate-800 dark:text-white truncate">
                            {liveIp ? `${liveIp}${livePort ? `:${livePort}` : ""}` : "IP Algılanmadı"}
                          </span>
                          {!isWebInspect && liveIp && (
                            <a
                              href={`http://${liveIp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${lightBg} ${text} hover:opacity-80 shrink-0`}
                              title="Telefonun Web Yönetim Arayüzünü Aç"
                            >
                              <span>Web GUI</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          Transport: {isWebInspect ? "WSS / WebRTC (DTLS-SRTP)" : (pjsipData.transport || inspectDraft.transport || "UDP")}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {isWebInspect ? "Tarayıcı / SIP.js İstemci" : "Telefon Yazılımı (User-Agent)"}
                        </div>
                        <div className="mt-1.5 text-xs font-extrabold text-slate-800 dark:text-white truncate" title={pjsipData.user_agent || ""}>
                          {pjsipData.user_agent || (isWebInspect ? "Tarayıcı WebRTC (SIP.js WSS)" : `${inspectDraft.brand || "Yealink"} ${inspectDraft.model || ""}`)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {isWebInspect ? `Maks. Oturum: ${inspectDraft.max_activations || 5} Sekme/Tarayıcı` : `MAC: ${inspectDraft.mac || "Tanımlanmadı"}`}
                        </div>
                      </div>
                    </div>

                    {isWebInspect ? (
                      <div className={`p-5 rounded-2xl border ${borderLight} ${lightBg} space-y-2.5`}>
                        <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Wifi size={15} className={text} />
                          Web Telefonu (WebRTC) Sayısal Dahilisiz PJSIP Mimarisi
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Bu tarayıcı telefonu Asterisk PJSIP üzerinde sayısal dahili yerine <span className="font-mono font-bold">{inspectDraft.sip_username}</span> kullanıcı adı ile kayıt olur. İç aramalarda, kuyruklarda ve giden/gelen çağrılarda mantıksal dahili numaranız (<span className="font-mono font-bold">{extension || "-"}</span>) korunur.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className={`p-5 rounded-2xl border ${borderLight} ${lightBg} space-y-4`}>
                          <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Cpu size={15} className={text} />
                            Masa Telefonu Donanım &amp; Ağ Kimliği (MAC / Marka / Model / IP)
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div>
                              <label htmlFor="inspect-mac-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                MAC Adresi (Otomatik Marka)
                              </label>
                              <input
                                id="inspect-mac-input"
                                type="text"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="00:15:65:AA:BB:CC"
                                value={inspectDraft.mac || ""}
                                onChange={(e) => {
                                  const formatted = formatMacAddress(e.target.value);
                                  const autoBrand = detectBrandByMac(formatted);
                                  setInspectDraft((prev) => {
                                    const nextBrand = autoBrand || prev.brand || "Yealink";
                                    const modelsForBrand = SIP_PHONE_MODELS[nextBrand] || [];
                                    const nextModel = autoBrand && !modelsForBrand.includes(prev.model) ? (modelsForBrand[0] || prev.model) : prev.model;
                                    return { ...prev, mac: formatted, brand: nextBrand, model: nextModel };
                                  });
                                }}
                                className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label htmlFor="inspect-brand-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Telefon Markası
                              </label>
                              <select
                                id="inspect-brand-select"
                                value={inspectDraft.brand || "Yealink"}
                                onChange={(e) => {
                                  const newBrand = e.target.value;
                                  const firstModel = (SIP_PHONE_MODELS[newBrand] || [])[0] || "";
                                  setInspectDraft((prev) => ({ ...prev, brand: newBrand, model: firstModel }));
                                }}
                                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              >
                                {Object.keys(SIP_PHONE_MODELS).map((b) => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="inspect-model-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Model
                              </label>
                              <select
                                id="inspect-model-select"
                                value={inspectDraft.model || brandModels[0] || ""}
                                onChange={(e) => setInspectDraft((prev) => ({ ...prev, model: e.target.value }))}
                                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              >
                                {brandModels.map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="inspect-ip-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Sabit / Bilinen IP Adresi
                              </label>
                              <input
                                id="inspect-ip-input"
                                type="text"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder={liveIp || "Örn: 192.168.1.55"}
                                value={inspectDraft.ip || ""}
                                onChange={(e) => setInspectDraft((prev) => ({ ...prev, ip: e.target.value }))}
                                className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Autoprovision & Remote Control */}
                        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                Otomatik Kurulum (Autoprovision) &amp; Uzaktan Komutlar
                              </h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Telefonun Auto-Provision Server URL alanına aşağıdaki bağlantıyı yapıştırabilir veya yapılandırma dosyasını indirebilirsiniz.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={handleDownloadSipDeviceConfig}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                              >
                                <Download size={13} />
                                <span>.cfg / .xml İndir</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendSipDeviceNotify("check-sync")}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all`}
                                title="Telefonu Yeniden Başlatmadan Konfigürasyonu Güncelle (SIP NOTIFY check-sync)"
                              >
                                <RefreshCw size={13} />
                                <span>Check-Sync Gönder</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendSipDeviceNotify("reboot")}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all"
                                title="SIP NOTIFY ile Masa Telefonunu Uzaktan Yeniden Başlat"
                              >
                                <Power size={13} />
                                <span>Reboot</span>
                              </button>
                            </div>
                          </div>

                          {provUrl && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                aria-label="Otomatik Kurulum Provisioning URL"
                                value={provUrl}
                                className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => copyTextWithFeedback(provUrl, "prov-url")}
                                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                              >
                                {copiedDeviceKey === "prov-url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                <span>Kopyala</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 2: BLF & TUŞ TANIMLARI */}
                {inspectTab === "blf" && (
                  <div id="inspect-panel-blf" role="tabpanel" aria-labelledby="inspect-tab-blf" className="space-y-5">
                    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                            BLF &amp; Programlanabilir DSS Tuşları (1–24)
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Masa telefonunun yan ekran tuşlarına dahili meşguliyet izleme (BLF), hızlı arama veya DND atayın.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={autoFillDirectoryBlf}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${borderLight} ${lightBg} ${text} hover:opacity-90 transition-all`}
                          >
                            Rehberden Otomatik BLF Doldur
                          </button>
                          <button
                            type="button"
                            onClick={addDssKeyRow}
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
                            title="Yeni BLF / Tuş Tanımı Ekle"
                            aria-label="Yeni BLF veya Tuş Tanımı Ekle"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {(!inspectDraft.dss_keys || inspectDraft.dss_keys.length === 0) ? (
                        <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                          Henüz BLF tuşu tanımlanmadı. Sağ üstteki artı (+) butonundan ekleyebilir veya &ldquo;Rehberden Otomatik BLF Doldur&rdquo; ile tek tıkla oluşturabilirsiniz.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {inspectDraft.dss_keys.map((row, rIdx) => (
                            <div
                              key={`dss-${rIdx}`}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                            >
                              <div className="sm:col-span-2">
                                <label htmlFor={`dss-key-${rIdx}`} className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                  Tuş No
                                </label>
                                <select
                                  id={`dss-key-${rIdx}`}
                                  value={row.key || rIdx + 1}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setInspectDraft((prev) => ({
                                      ...prev,
                                      dss_keys: prev.dss_keys.map((it, i) => (i === rIdx ? { ...it, key: val } : it))
                                    }));
                                  }}
                                  className="w-full text-xs font-bold px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                >
                                  {Array.from({ length: 24 }, (_, idx) => idx + 1).map((n) => (
                                    <option key={n} value={n}>Tuş {n}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <label htmlFor={`dss-type-${rIdx}`} className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                  Tuş Tipi
                                </label>
                                <select
                                  id={`dss-type-${rIdx}`}
                                  value={row.type || "blf"}
                                  onChange={(e) => {
                                    const newType = e.target.value;
                                    setInspectDraft((prev) => ({
                                      ...prev,
                                      dss_keys: prev.dss_keys.map((it, i) => (i === rIdx ? { ...it, type: newType } : it))
                                    }));
                                  }}
                                  className="w-full text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                >
                                  {DSS_KEY_TYPES.map((kt) => (
                                    <option key={kt.id} value={kt.id}>{kt.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <label htmlFor={`dss-target-${rIdx}`} className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                  Dahili / Hedef Değeri
                                </label>
                                {row.type === "blf" ? (
                                  <select
                                    id={`dss-target-${rIdx}`}
                                    value={row.value || ""}
                                    onChange={(e) => {
                                      const selExt = e.target.value;
                                      const peer = users.find((u) => String(u.extension) === String(selExt));
                                      setInspectDraft((prev) => ({
                                        ...prev,
                                        dss_keys: prev.dss_keys.map((it, i) =>
                                          i === rIdx
                                            ? {
                                                ...it,
                                                value: selExt,
                                                label: it.label || (peer?.full_name || selExt)
                                              }
                                            : it
                                        )
                                      }));
                                    }}
                                    className="w-full text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                  >
                                    <option value="">Dahili Seçiniz...</option>
                                    {users
                                      .filter((u) => u.extension && String(u.extension) !== String(extension))
                                      .map((u) => (
                                        <option key={u.id || u.extension} value={u.extension}>
                                          {u.full_name} ({u.extension})
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <input
                                    id={`dss-target-${rIdx}`}
                                    type="text"
                                    placeholder={row.type === "voicemail" ? "*97" : "Numara / Kod"}
                                    value={row.value || ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setInspectDraft((prev) => ({
                                        ...prev,
                                        dss_keys: prev.dss_keys.map((it, i) => (i === rIdx ? { ...it, value: v } : it))
                                      }));
                                    }}
                                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                  />
                                )}
                              </div>

                              <div className="sm:col-span-3">
                                <label htmlFor={`dss-label-${rIdx}`} className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                  Ekran Etiketi
                                </label>
                                <input
                                  id={`dss-label-${rIdx}`}
                                  type="text"
                                  placeholder="Örn: Muhasebe"
                                  value={row.label || ""}
                                  onChange={(e) => {
                                    const lbl = e.target.value;
                                    setInspectDraft((prev) => ({
                                      ...prev,
                                      dss_keys: prev.dss_keys.map((it, i) => (i === rIdx ? { ...it, label: lbl } : it))
                                    }));
                                  }}
                                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                />
                              </div>

                              <div className="sm:col-span-1 flex sm:justify-end pt-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInspectDraft((prev) => ({
                                      ...prev,
                                      dss_keys: prev.dss_keys.filter((_, i) => i !== rIdx)
                                    }))
                                  }
                                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Tuş Tanımını Kaldır"
                                  aria-label={`${row.key || rIdx + 1}. BLF Tuş Tanımını Kaldır`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Softkeys F1-F4 */}
                    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                        Ekran Altı Esnek Tuşlar (Softkeys F1–F4)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {[0, 1, 2, 3].map((skIdx) => {
                          const skItem = (inspectDraft.soft_keys || [])[skIdx] || { key: skIdx + 1, type: "history", label: "" };
                          return (
                            <div key={`sk-${skIdx}`} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                              <label htmlFor={`softkey-type-${skIdx}`} className="block text-[10px] font-extrabold text-slate-500 uppercase">
                                F{skIdx + 1} Tuşu
                              </label>
                              <select
                                id={`softkey-type-${skIdx}`}
                                value={skItem.type || "history"}
                                onChange={(e) => {
                                  const nextType = e.target.value;
                                  const defLbl = SOFTKEY_ACTIONS.find((a) => a.id === nextType)?.label || nextType;
                                  setInspectDraft((prev) => {
                                    const copy = [...(prev.soft_keys || [])];
                                    while (copy.length < 4) copy.push({ key: copy.length + 1, type: "history", label: "Geçmiş" });
                                    copy[skIdx] = { key: skIdx + 1, type: nextType, label: defLbl };
                                    return { ...prev, soft_keys: copy };
                                  });
                                }}
                                className="w-full text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                              >
                                {SOFTKEY_ACTIONS.map((act) => (
                                  <option key={act.id} value={act.id}>{act.label}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: DİĞER TELEFON AYARLARI */}
                {inspectTab === "phone_settings" && (
                  <div id="inspect-panel-phone_settings" role="tabpanel" aria-labelledby="inspect-tab-phone_settings" className="space-y-5">
                    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                        Ses Kodek Önceliği (Audio Codecs)
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hem Asterisk PJSIP endpoint&apos;ine hem de telefonun otomatik kurulum (autoprovision) dosyasına uygulanır.
                      </p>
                      <div className="space-y-2">
                        {AVAILABLE_SIP_CODECS.map((cdc) => {
                          const enabledIdx = (inspectDraft.codecs || []).indexOf(cdc.id);
                          const isEnabled = enabledIdx !== -1;
                          return (
                            <div
                              key={cdc.id}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                isEnabled
                                  ? `bg-white dark:bg-slate-900 ${borderLight}`
                                  : "bg-slate-100/50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/60 opacity-65"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  id={`codec-chk-${cdc.id}`}
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => toggleCodec(cdc.id)}
                                  className="w-4 h-4 rounded"
                                />
                                <label htmlFor={`codec-chk-${cdc.id}`} className="cursor-pointer">
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">{cdc.label}</span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">{cdc.desc}</span>
                                </label>
                              </div>
                              {isEnabled && (
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lightBg} ${text}`}>
                                    Öncelik #{enabledIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => moveCodec(cdc.id, -1)}
                                    disabled={enabledIdx === 0}
                                    className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30"
                                    aria-label={`${cdc.label} Önceliğini Yükselt`}
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveCodec(cdc.id, 1)}
                                    disabled={enabledIdx === (inspectDraft.codecs || []).length - 1}
                                    className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30"
                                    aria-label={`${cdc.label} Önceliğini Düşür`}
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="inspect-dtmf-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          DTMF Tuşlama Modu
                        </label>
                        <select
                          id="inspect-dtmf-select"
                          value={inspectDraft.dtmf_mode || "rfc4733"}
                          onChange={(e) => setInspectDraft((prev) => ({ ...prev, dtmf_mode: e.target.value }))}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                        >
                          <option value="rfc4733">RFC 4733 / RFC 2833 (Önerilen)</option>
                          <option value="info">SIP INFO</option>
                          <option value="inband">Inband (Ses İçi)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="inspect-lang-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Telefon Ekran Dili
                        </label>
                        <select
                          id="inspect-lang-select"
                          value={inspectDraft.language || "Turkish"}
                          onChange={(e) => setInspectDraft((prev) => ({ ...prev, language: e.target.value }))}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                        >
                          <option value="Turkish">Türkçe</option>
                          <option value="English">English</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="inspect-tz-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Saat Dilimi
                        </label>
                        <select
                          id="inspect-tz-select"
                          value={inspectDraft.timezone || "+3"}
                          onChange={(e) => setInspectDraft((prev) => ({ ...prev, timezone: e.target.value }))}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                        >
                          <option value="+3">GMT+3 (Türkiye)</option>
                          <option value="+2">GMT+2 (Avrupa / KKTC Kış)</option>
                          <option value="+1">GMT+1 (Orta Avrupa)</option>
                          <option value="+0">GMT+0 (UTC / Londra)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="inspect-ntp-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          NTP Saat Sunucusu
                        </label>
                        <input
                          id="inspect-ntp-input"
                          type="text"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={inspectDraft.ntp_server || "pool.ntp.org"}
                          onChange={(e) => setInspectDraft((prev) => ({ ...prev, ntp_server: e.target.value }))}
                          className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white">İnterkom / Otomatik Cevap (Auto-Answer)</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">İç interkom çağrılarında ahizeyi kaldırmadan hoparlörden yanıtlar.</div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(inspectDraft.auto_answer)}
                          aria-label="İnterkom Otomatik Cevap"
                          onClick={() => setInspectDraft((prev) => ({ ...prev, auto_answer: !prev.auto_answer }))}
                        >
                          {inspectDraft.auto_answer ? <ToggleRight size={28} className={text} /> : <ToggleLeft size={28} className="text-slate-400" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white">Doğrudan IP Çağrı Engeli (Ghost Call Koruması)</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Santral dışı sahte SIP tarama aramalarının telefonu çaldırmasını engeller.</div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={inspectDraft.direct_ip_call_block !== false}
                          aria-label="Doğrudan IP Çağrı Engeli"
                          onClick={() => setInspectDraft((prev) => ({ ...prev, direct_ip_call_block: prev.direct_ip_call_block === false }))}
                        >
                          {inspectDraft.direct_ip_call_block !== false ? <ToggleRight size={28} className={text} /> : <ToggleLeft size={28} className="text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: PJSIP DAHİLİ DETAY (pjsip show endpoint) */}
                {inspectTab === "pjsip" && (
                  <div id="inspect-panel-pjsip" role="tabpanel" aria-labelledby="inspect-tab-pjsip" className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Endpoint / Context</div>
                        <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1 truncate">
                          {inspectDraft.sip_username} / {pjsipData.context || "webrtc_agents"}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">İzinli Kodekler (allow)</div>
                        <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1 truncate">
                          {pjsipData.allow || (inspectDraft.codecs || []).join(",")}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">CallerID &amp; DTMF</div>
                        <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1 truncate">
                          {pjsipData.callerid || `${extension}`} • {pjsipData.dtmf_mode || inspectDraft.dtmf_mode || "rfc4733"}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Çağrı Toplama / Max Kayıt</div>
                        <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1 truncate">
                          {pjsipData.named_pickup_group || "Yok"} • Max: {pjsipData.max_contacts || inspectDraft.max_activations || 1}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/90">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-200">
                          <Terminal size={14} className="text-emerald-400" />
                          <span>asterisk -rx &quot;pjsip show endpoint {inspectDraft.sip_username}&quot;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fetchSipDeviceInspection(extension, inspectDraft.sip_username)}
                            disabled={inspectLoading}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          >
                            <RefreshCw size={12} className={inspectLoading ? "animate-spin" : ""} />
                            <span>Yenile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => copyTextWithFeedback(pjsipData.raw_output || "", "pjsip-raw")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          >
                            {copiedDeviceKey === "pjsip-raw" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>Kopyala</span>
                          </button>
                        </div>
                      </div>
                      <pre className="p-4 text-[11px] leading-relaxed font-mono text-emerald-300/95 overflow-x-auto max-h-80 whitespace-pre">
                        {inspectLoading
                          ? "Asterisk PJSIP endpoint bilgileri sorgulanıyor..."
                          : (pjsipData.raw_output || "Henüz çıktı yok. Kullanıcıyı kaydettikten sonra 'Yenile' butonuna tıklayın.") +
                            (pjsipData.contact_raw_output ? `\n\n--- pjsip show contact ---\n${pjsipData.contact_raw_output}` : "")}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/30 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectDraft;
                    setIsSipDeviceInspectOpen(false);
                    openSipDeviceEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  <Edit2 size={13} />
                  <span>SIP Kimlik Bilgilerini Düzenle</span>
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSipDeviceInspectOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Kapat
                  </button>
                  {!isWebInspect && (
                    <button
                      type="button"
                      disabled={inspectSaving}
                      onClick={handleApplyInspectChanges}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm disabled:opacity-50`}
                    >
                      {inspectSaving ? "Uygulanıyor..." : "Değişiklikleri Uygula"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </dialog>

      {/* Confirm Delete Modal for SIP Cihazı */}
      <ConfirmDeleteModal
        isOpen={!!sipDeviceDeleteTarget}
        onClose={() => setSipDeviceDeleteTarget(null)}
        onConfirm={confirmDeleteSipDevice}
        title="SIP Cihazını Sil"
        message={`'${sipDeviceDeleteTarget?.name || ""}' (${sipDeviceDeleteTarget?.sip_username || ""}) SIP cihazını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteUser}
        title="Kullanıcıyı Sil"
        message="Seçilen sistem kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
