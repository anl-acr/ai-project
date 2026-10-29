import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit2, X, User, Mail, Phone, Shield, Check, CheckCircle, ToggleLeft, ToggleRight, Search, Copy, RefreshCw, KeyRound, PhoneCall, Settings, Image as ImageIcon, Monitor, Smartphone, AlertTriangle, PhoneOutgoing, Users, Forward, Mic, MicOff, Download, Upload, Building2, Eye, EyeOff, Cable, ExternalLink, Database, Play } from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import SearchableSelect from "../ui/SearchableSelect";

import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import useClickOutside from "../../utils/useClickOutside";

const DEFAULT_TENANT_LIST = [
  { id: "tenant-default", name: "Ana Müşteri (Varsayılan)" },
  { id: "tenant-test-teknoloji", name: "Test Teknoloji" },
  { id: "tenant-nolto", name: "Nolto" }
];

const PRESET_AVATARS = [
  // Klasik & Kurumsal Temsilciler (Avataaars)
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
  // Modern İllüstrasyon (Adventurer & Lorelei)
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Emre",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Ayse",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Kaan",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Defne",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Merve",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Kerem",
  // Minimalist & Notion Tarzı / Robotik
  "https://api.dicebear.com/7.x/micah/svg?seed=Cem",
  "https://api.dicebear.com/7.x/micah/svg?seed=Ece",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Bora",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Pelin",
  "https://api.dicebear.com/7.x/bottts/svg?seed=AgentAlpha",
  "https://api.dicebear.com/7.x/bottts/svg?seed=AgentNova"
];

const ANNOUNCEMENTS = [
  "Varsayılan Anons",
  "Kişisel Anons 1",
  "Mesai Dışı Anonsu"
];

export const DEFAULT_USER_PROFILES = [
  {
    id: "available",
    name: "Müsait",
    devices: ["desk_phone", "mobile_app", "web_phone", "pc_app"],
    timeout: 30,
    timeout_action: "voicemail",
    timeout_target: ""
  },
  {
    id: "away",
    name: "Dışarıda",
    devices: ["mobile_app"],
    timeout: 25,
    timeout_action: "external",
    timeout_target: ""
  },
  {
    id: "meeting",
    name: "Toplantı",
    devices: [],
    timeout: 15,
    timeout_action: "voicemail",
    timeout_target: ""
  },
  {
    id: "other",
    name: "Diğer",
    devices: ["web_phone"],
    timeout: 30,
    timeout_action: "none",
    timeout_target: ""
  }
];

export const RING_DEVICES_METADATA = [
  { id: "desk_phone", label: "Masa Telefonu", desc: "IP / SIP masa telefonu cihazı" },
  { id: "mobile_app", label: "Mobil Uygulama", desc: "iOS / Android mobil softphone" },
  { id: "web_phone", label: "Web Telefon", desc: "Tarayıcı içi WebRTC telefon" },
  { id: "pc_app", label: "PC Uygulaması", desc: "Masaüstü softphone uygulaması" }
];

export const normalizeUserProfiles = (rawProfiles) => {
  let parsed = rawProfiles;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      parsed = null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_USER_PROFILES.map(p => ({ ...p, devices: [...p.devices] }));
  }
  const byId = {};
  parsed.forEach(p => {
    if (p && p.id) byId[p.id] = p;
  });
  return DEFAULT_USER_PROFILES.map(def => {
    const ex = byId[def.id];
    if (!ex) return { ...def, devices: [...def.devices] };
    return {
      id: def.id,
      name: ex.name || def.name,
      devices: Array.isArray(ex.devices) ? [...ex.devices] : [...def.devices],
      timeout: ex.timeout !== undefined && ex.timeout !== null ? Number(ex.timeout) : def.timeout,
      timeout_action: ex.timeout_action || def.timeout_action,
      timeout_target: ex.timeout_target || ""
    };
  });
};

export default function UserSettings({ backendHost = "localhost:8000", currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const isAdmin = currentUser?.role === "admin";
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

  // Basic Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [extension, setExtension] = useState("");
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  // SIP Fields
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [maxActivations, setMaxActivations] = useState(1);
  const [outboundCallerId, setOutboundCallerId] = useState("");

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
  const [queuesList, setQueuesList] = useState([]);
  const [aiAgentsList, setAiAgentsList] = useState([]);

  const [systemRoles, setSystemRoles] = useState([]);

  // Associations Fields
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

  const safeFetch = async (path, options = {}) => {
    const apiBase = getApiBaseUrl(backendHost);
    const url = path.startsWith("http") ? path : `${apiBase}${path}`;
    return await tenantFetch(url, options);
  };

  useEffect(() => {
    fetchAllData(true);
    const handleTenantChange = () => {
      fetchAllData(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantChange);
    }
    const interval = setInterval(() => {
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
        if (resUsers.ok) {
          const dataUsers = await resUsers.json();
          setUsers(Array.isArray(dataUsers) ? dataUsers : (dataUsers?.users || []));
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
        if (data.users) setUsers(data.users);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        return true;
      } else {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        setError(errData.detail || "Kullanıcı kaydedilirken bir hata oluştu.");
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

  const generateSipPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$*()";
    let pwd = "";
    for(let i=0; i<16; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSipPassword(pwd);
  };

  const copySipPassword = () => {
    navigator.clipboard.writeText(sipPassword);
  };

  const copyTwoFactorSecret = () => {
    if (!twoFactorSecret) return;
    navigator.clipboard.writeText(twoFactorSecret);
    setTwoFactorSecretCopied(true);
    setTimeout(() => setTwoFactorSecretCopied(false), 2000);
  };

  const fetchTwoFactorSetup = async (resetSecret = false, overrideMethod = null, overrideSecret = null, overrideUserId = null, overrideEmail = null) => {
    const targetMethod = overrideMethod || twoFactorMethod || "google_auth";
    if (targetMethod === "email") return;
    setTwoFactorSetupLoading(true);
    if (resetSecret) setTwoFactorStatusMsg(null);
    try {
      const targetUid = overrideUserId !== null ? overrideUserId : (editingUser?.id || "preview");
      const targetEmail = (overrideEmail !== null ? overrideEmail : (email || editingUser?.email || "kullanici@aida.local")).trim() || "kullanici@aida.local";
      const existingSec = !resetSecret ? (overrideSecret !== null ? overrideSecret : twoFactorSecret) : "";
      const qs = new URLSearchParams({
        reset: resetSecret ? "true" : "false",
        method: targetMethod,
        email: targetEmail
      });
      if (existingSec) qs.set("secret", existingSec);
      const res = await safeFetch(`/api/auth/setup_2fa/${encodeURIComponent(String(targetUid))}?${qs.toString()}`);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorSecret(data.secret || "");
        setTwoFactorQrSvg(data.qr_svg || "");
        if (resetSecret) {
          setTwoFactorEnrolled(false);
          setTwoFactorStatusMsg({
            type: "success",
            text: "Yeni kurulum anahtarı ve QR kod üretildi. Lütfen uygulamadan tekrar taratınız."
          });
        } else if (data.enrolled !== undefined && editingUser) {
          setTwoFactorEnrolled(Boolean(data.enrolled));
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
        setTwoFactorEnrolled(true);
        setTwoFactorTestCode("");
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
    setIsActive(true);
    setPassword("");
    setSipUsername("");
    setSipPassword("");
    setShowSipPassword(false);
    setMaxActivations(1);
    setOutboundCallerId("");

    setFwdAlwaysActive(false); setFwdAlwaysType("internal"); setFwdAlwaysTarget("");
    setFwdBusyActive(false); setFwdBusyType("internal"); setFwdBusyTarget("");
    setFwdNoAnswerActive(false); setFwdNoAnswerType("internal"); setFwdNoAnswerTarget(""); setFwdNoAnswerTimeout(30);

    setVoicemailActive(false); setVoicemailAnnouncement(ANNOUNCEMENTS[0]);
    setVoicemailPin(""); setVoicemailToEmail(false);

    setRecordingActive(false); setTransport("UDP");
    setTwoFactorEnabled(false);
    setTwoFactorMethod("google_auth");
    setTwoFactorSecret("");
    setTwoFactorEnrolled(false);
    setTwoFactorQrSvg("");
    setTwoFactorTestCode("");
    setTwoFactorStatusMsg(null);

    setFollowMeEnabled(false);
    setFollowMeTimeout(15);
    setFollowMeFirstTarget("mobile_app");
    setFollowMeSecondTarget("mobile_number");
    setFollowMeMobileNumber("");

    setSelectedOutboundRules([]);
    setSelectedCallPickupGroups([]);
    setSelectedLocation("");
    setSelectedDepartment("");
    setActiveProfile("available");
    setUserProfiles(normalizeUserProfiles(null));
    setSelectedProfileTab("available");
    setManagedUsers([]);
    setManagedQueues([]);
    setSupUserSearch("");
    setSupQueueSearch("");
    setCtiConfig(DEFAULT_CTI_CONFIG);
    setCtiTestResult(null);
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
    setExtension(getNextAvailableExtension(initialTenant));
    generateSipUsername();
    generateSipPassword();
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
    setAvatar(u.avatar || PRESET_AVATARS[0]);
    setRole(u.role || "agent");
    setIsActive(checkIsUserActive(u));
    setPassword(u.password || "");
    
    setSipUsername(u.sip_username || generateSipUsernameStr());
    setSipPassword(u.sip_password || "");
    if(!u.sip_password) generateSipPassword();
    setShowSipPassword(false);
    setMaxActivations(u.max_activations ? Math.max(1, Math.min(5, Number(u.max_activations))) : 1);
    
    setOutboundCallerId(u.outbound_caller_id || "");

    if (u.forwarding_always) { setFwdAlwaysActive(u.forwarding_always.active || false); setFwdAlwaysType(u.forwarding_always.type || "internal"); setFwdAlwaysTarget(u.forwarding_always.target || ""); }
    if (u.forwarding_busy) { setFwdBusyActive(u.forwarding_busy.active || false); setFwdBusyType(u.forwarding_busy.type || "internal"); setFwdBusyTarget(u.forwarding_busy.target || ""); }
    if (u.forwarding_no_answer) { setFwdNoAnswerActive(u.forwarding_no_answer.active || false); setFwdNoAnswerType(u.forwarding_no_answer.type || "internal"); setFwdNoAnswerTarget(u.forwarding_no_answer.target || ""); setFwdNoAnswerTimeout(u.forwarding_no_answer.timeout || 30); }

    setVoicemailActive(u.voicemail_active || false);
    setVoicemailAnnouncement(u.voicemail_announcement || ANNOUNCEMENTS[0]);
    setVoicemailPin(u.voicemail_pin || "");
    setVoicemailToEmail(u.voicemail_to_email || false);

    setRecordingActive(u.recording_active || false);
    setTransport(u.transport || "UDP");
    const normMethod = (!u.two_factor_method || u.two_factor_method === "app") ? "google_auth" : u.two_factor_method;
    setTwoFactorEnabled(Boolean(u.two_factor_enabled));
    setTwoFactorMethod(normMethod);
    setTwoFactorSecret(u.two_factor_secret || "");
    setTwoFactorEnrolled(Boolean(u.two_factor_enrolled));
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
      setFollowMeMobileNumber(fmObj.mobile_number || u.gsm_number || "");
    } else {
      setFollowMeEnabled(false);
      setFollowMeTimeout(15);
      setFollowMeFirstTarget("mobile_app");
      setFollowMeSecondTarget("mobile_number");
      setFollowMeMobileNumber(u.gsm_number || "");
    }

    const activeOutbound = outboundRules.filter(r => r.allowed_users && r.allowed_users.includes(u.id)).map(r => r.id);
    setSelectedOutboundRules(activeOutbound);
    
    const activePickup = callPickupGroups.filter(g => g.extensions && g.extensions.includes(u.id)).map(g => g.id);
    setSelectedCallPickupGroups(activePickup);

    setSelectedLocation(u.location_id || "");
    setSelectedDepartment(u.department_id || "");

    const resolvedActiveProf = u.active_profile || "available";
    setActiveProfile(resolvedActiveProf);
    setSelectedProfileTab(resolvedActiveProf);
    setUserProfiles(normalizeUserProfiles(u.profiles));

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

    const userData = {
      full_name: fullName.trim(),
      email: email.trim(),
      extension: extInput,
      avatar,
      role,
      is_active: isActive,
      tenant_id: userTenantId,
      password,
      sip_username: sipUsername.trim() || generateSipUsernameStr(),
      sip_password: sipPassword,
      max_activations: Number(maxActivations) || 1,
      outbound_caller_id: outboundCallerId.trim(),
      gsm_number: cleanFmMobile || (editingUser?.gsm_number || null),
      forwarding_always: { active: Boolean(fwdAlwaysActive && fwdAlwaysTarget), type: fwdAlwaysType || "internal", target: fwdAlwaysTarget || "" },
      forwarding_busy: { active: Boolean(fwdBusyActive && fwdBusyTarget), type: fwdBusyType || "internal", target: fwdBusyTarget || "" },
      forwarding_no_answer: { active: Boolean(fwdNoAnswerActive && fwdNoAnswerTarget), type: fwdNoAnswerType || "internal", target: fwdNoAnswerTarget || "", timeout: fwdNoAnswerTimeout || 30 },
      voicemail_active: voicemailActive,
      voicemail_announcement: voicemailAnnouncement,
      voicemail_pin: voicemailPin,
      voicemail_to_email: voicemailToEmail,
      recording_active: recordingActive,
      transport,
      two_factor_enabled: twoFactorEnabled,
      two_factor_method: twoFactorMethod || "google_auth",
      two_factor_secret: twoFactorSecret || null,
      two_factor_enrolled: twoFactorEnrolled,
      follow_me: {
        enabled: Boolean(followMeEnabled),
        timeout: Math.max(5, Math.min(120, Number(followMeTimeout) || 15)),
        first_target: followMeFirstTarget || "mobile_app",
        second_target: followMeSecondTarget || "none",
        mobile_number: cleanFmMobile
      },
      location_id: selectedLocation || null,
      department_id: selectedDepartment || null,
      active_profile: activeProfile || "available",
      profiles: userProfiles,
      managed_users: managedUsers,
      managed_queues: managedQueues,
      cti_config: ctiConfig
    };

    setSubmitting(true);
    let ok = false;
    try {
      if (editingUser) {
        // Edit mode
        const updated = users.map((u) => {
          if (u.id === editingUser.id) {
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
        const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id || 0)) + 1 : 1;
        const newUser = { id: nextId, ...userData };
        const updated = [...users, newUser];
        ok = await handleSaveAll(updated);
        if (ok) {
          await syncUserAssociations(newUser.id);
        }
      }
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      setShowModal(false);
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

  const renderForwardingRow = (label, active, setActive, type, setType, target, setTarget, timeout, setTimeoutVal) => (
    <div className={`grid grid-cols-12 gap-3 items-end p-3 rounded-xl border transition-all ${active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 opacity-70'}`}>
        <div className="col-span-12 flex items-center justify-between mb-1 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <label className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{label}</label>
            <button type="button" onClick={() => setActive(!active)} className="text-slate-400 hover:text-slate-700 transition-colors">
                {active ? <ToggleRight size={24} className={text} /> : <ToggleLeft size={24} />}
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
                onChange={(e) => setSearchQuery(e.target.value)}
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

          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 hover:scale-[1.005] w-full ${
                !checkIsUserActive(u) ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
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
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            <span>Web Phone Bağlı</span>
                            {u.ip_address && (
                              <span className="text-emerald-600/90 dark:text-emerald-400/90 font-mono text-[9px] bg-emerald-100/70 dark:bg-emerald-900/70 px-1 py-0.2 rounded font-normal">({u.ip_address})</span>
                            )}
                          </span>
                        ) : (
                          <span className="absolute bottom-full mb-2 left-0 text-[10px] font-bold text-rose-600 dark:text-rose-400 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-rose-50/95 dark:bg-rose-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl whitespace-nowrap shadow-lg border border-rose-200/80 dark:border-rose-800/80 z-[100] pointer-events-none flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            <span>Web Phone Bağlı Değil</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {visibleColumns.profile && (
                    <div className="w-12 flex items-center justify-center shrink-0 min-w-0">
                      <img
                        src={u.avatar}
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
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold shrink-0">
                          <Phone size={10} /> Dahili:
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-700 dark:text-slate-300 text-[9px] shrink-0">
                          {u.extension}
                        </span>
                      </div>
                      {(() => {
                        const activeFwds = [];
                        if (u.forwarding_always?.active) {
                          activeFwds.push({ key: "always", label: "Her Zaman", target: u.forwarding_always.target });
                        }
                        if (u.forwarding_busy?.active) {
                          activeFwds.push({ key: "busy", label: "Meşgulde", target: u.forwarding_busy.target });
                        }
                        if (u.forwarding_no_answer?.active) {
                          activeFwds.push({ key: "no_answer", label: "Cevapsız", target: u.forwarding_no_answer.target });
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
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-extrabold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/50 truncate max-w-[130px]" title={tenants.find(t => t.id === u.tenant_id || t.code === u.tenant_id)?.name || u.tenant_name || (u.tenant_id === "tenant-nolto" ? "Nolto" : "Ana Müşteri")}>
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
        </div>
      )}

      {/* POPUP MODAL (Add / Edit Form with Tabs) */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 transition-all duration-300">
          <div className="w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto">
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
                            Profiller
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("forwarding")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'forwarding' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <PhoneCall size={16} />
                            Yönlendirme & Voicemail
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("features")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'features' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <Settings size={16} />
                            Özellikler
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
                            Avatar Seçimi
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
                    </nav>
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <form onSubmit={handleFormSubmit} className="p-7 space-y-6 h-full flex flex-col justify-between">
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
                                        {hasSupervisorPerm && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("supervisor_filter")}
                                                className={`mt-2 w-full flex items-center justify-between px-3 py-2 rounded-xl border ${border} ${lightBg} ${text} text-[11px] font-bold transition-all hover:opacity-90`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <Shield size={13} />
                                                    Supervizor Rapor & Yönetim Filtresi ({managedUsers.length} Temsilci, {managedQueues.length} Kuyruk)
                                                </span>
                                                <span className="underline text-[10px]">Yapılandır →</span>
                                            </button>
                                        )}
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Giden Arama Kuralları</label>
                                        <select 
                                            value={selectedOutboundRules[0] || ""} 
                                            onChange={(e) => setSelectedOutboundRules(e.target.value ? [e.target.value] : [])} 
                                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        >
                                            <option value="">Kural Seçilmedi</option>
                                            {outboundRules.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Çağrı Toplama Grubu</label>
                                        <select 
                                            value={selectedCallPickupGroups[0] || ""} 
                                            onChange={(e) => setSelectedCallPickupGroups(e.target.value ? [e.target.value] : [])} 
                                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        >
                                            <option value="">Grup Seçilmedi</option>
                                            {callPickupGroups.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: SIP */}
                        {activeTab === "sip" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                        SIP Ayarları
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Kullanıcının dahili numarası, telefon aktivasyon kullanıcı adı, SIP kayıt şifresi ve maksimum aktivasyon sayısı ayarları.
                                    </p>
                                </div>

                                <div className={`p-5 rounded-2xl border ${borderLight} ${lightBg} space-y-5`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dahili Numarası (Extension)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
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
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dış Aramada Görünecek Numara</label>
                                            <input type="text" placeholder="Boş bırakılırsa varsayılan kural" value={outboundCallerId} onChange={(e) => setOutboundCallerId(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Kullanıcı Adı (SIP Aktivasyon)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Örn: Ab8kP2x9"
                                                value={sipUsername}
                                                onChange={(e) => setSipUsername(e.target.value)}
                                                className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
                                            />
                                            <button type="button" onClick={copySipUsername} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Kullanıcı Adını Kopyala"><Copy size={16}/></button>
                                            <button type="button" onClick={generateSipUsername} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Yeni Kullanıcı Adı Üret"><RefreshCw size={16}/></button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">SIP Register Şifresi</label>
                                        <div className="flex gap-2">
                                            <input
                                                type={showSipPassword ? "text" : "password"}
                                                readOnly
                                                value={sipPassword}
                                                className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none font-mono tracking-wider"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSipPassword(!showSipPassword)}
                                                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                                                title={showSipPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                                            >
                                                {showSipPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                            <button type="button" onClick={copySipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Şifreyi Kopyala"><Copy size={16}/></button>
                                            <button type="button" onClick={generateSipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Yeni Şifre Üret"><RefreshCw size={16}/></button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Maksimum Aktivasyon Sayısı</label>
                                        <select
                                            value={maxActivations}
                                            onChange={(e) => setMaxActivations(Number(e.target.value))}
                                            className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        >
                                            {[1, 2, 3, 4, 5].map((cnt) => (
                                                <option key={cnt} value={cnt}>{cnt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: PROFİLLER (Müsait, Dışarıda, Toplantı, Diğer) */}
                        {activeTab === "profiles" && (() => {
                            const currentProf = userProfiles.find(p => p.id === selectedProfileTab) || userProfiles[0] || DEFAULT_USER_PROFILES[0];
                            const updateCurrentProfile = (patch) => {
                                setUserProfiles(prev => prev.map(p => p.id === currentProf.id ? { ...p, ...patch } : p));
                            };
                            const toggleProfileDevice = (devId) => {
                                const curDevs = Array.isArray(currentProf.devices) ? currentProf.devices : [];
                                const nextDevs = curDevs.includes(devId)
                                    ? curDevs.filter(d => d !== devId)
                                    : [...curDevs, devId];
                                updateCurrentProfile({ devices: nextDevs });
                            };

                            return (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Top Header & Active Profile Selector */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                                Kullanıcı Çağrı Profilleri
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Her profil için çalacak cihazları, çalma süresini ve zaman aşımı sonrası aksiyonu önceden kaydedin.
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

                                    {/* 4 Profile Sub-Tabs (Without device/timeout sub-info) */}
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
                                                    Hiçbir cihaz seçilmediğinde telefon çalmaz ve gelen çağrı doğrudan aşağıdaki zaman aşımı sonrası işleme yönlendirilir.
                                                </p>
                                            )}
                                        </div>

                                        {/* 2. Timeout & Post-Timeout Action */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                                            <div className="md:col-span-4">
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    2. Çalma Süresi / Zaman Aşımı (sn)
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="5"
                                                        max="120"
                                                        value={currentProf.timeout ?? 30}
                                                        onChange={(e) => updateCurrentProfile({ timeout: Math.max(5, parseInt(e.target.value) || 30) })}
                                                        className="w-20 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    />
                                                    <div className="flex items-center gap-1.5">
                                                        {[15, 25, 30, 45].map(sec => (
                                                            <button
                                                                key={sec}
                                                                type="button"
                                                                onClick={() => updateCurrentProfile({ timeout: sec })}
                                                                className={`px-2.5 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                                                    Number(currentProf.timeout) === sec
                                                                        ? `${bg} text-white border-transparent`
                                                                        : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                                                                }`}
                                                            >
                                                                {sec}s
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="md:col-span-4">
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    3. Zaman Aşımı Sonrası İşlem
                                                </label>
                                                <select
                                                    value={currentProf.timeout_action || "none"}
                                                    onChange={(e) => updateCurrentProfile({ timeout_action: e.target.value, timeout_target: "" })}
                                                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                >
                                                    <option value="none">Çağrıyı Sonlandır (İşlem Yapma)</option>
                                                    <option value="voicemail">Sesli Mesaja (Voicemail) Aktar</option>
                                                    <option value="internal">Başka Bir Dahiliye Yönlendir</option>
                                                    <option value="external">Cep Telefonuna / Dış Numaraya Yönlendir</option>
                                                    <option value="queue">Çağrı Kuyruğuna Aktar</option>
                                                    <option value="ai_agent">Yapay Zeka Temsilcisine Aktar</option>
                                                </select>
                                            </div>

                                            <div className="md:col-span-4">
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                                    Hedef Seçimi / Numara
                                                </label>
                                                {currentProf.timeout_action === "internal" ? (
                                                    <select
                                                        value={currentProf.timeout_target || ""}
                                                        onChange={(e) => updateCurrentProfile({ timeout_target: e.target.value })}
                                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    >
                                                        <option value="">Dahili Seçiniz...</option>
                                                        {users.filter(u => String(u.extension) !== String(extension)).map(u => (
                                                            <option key={u.id || u.extension} value={u.extension}>
                                                                {u.full_name} ({u.extension})
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : currentProf.timeout_action === "external" ? (
                                                    <input
                                                        type="text"
                                                        placeholder="Örn: 05321234567"
                                                        value={currentProf.timeout_target || ""}
                                                        onChange={(e) => updateCurrentProfile({ timeout_target: e.target.value })}
                                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    />
                                                ) : currentProf.timeout_action === "queue" ? (
                                                    <select
                                                        value={currentProf.timeout_target || ""}
                                                        onChange={(e) => updateCurrentProfile({ timeout_target: e.target.value })}
                                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    >
                                                        <option value="">Kuyruk Seçiniz...</option>
                                                        {queuesList.map(q => (
                                                            <option key={q.id || q.extension} value={q.extension || q.name}>
                                                                {q.name} ({q.extension})
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : currentProf.timeout_action === "ai_agent" ? (
                                                    <select
                                                        value={currentProf.timeout_target || ""}
                                                        onChange={(e) => updateCurrentProfile({ timeout_target: e.target.value })}
                                                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                                    >
                                                        <option value="">AI Temsilci Seçiniz...</option>
                                                        {aiAgentsList.map(ag => (
                                                            <option key={ag.id || ag.extension} value={ag.extension || ag.id}>
                                                                {ag.name} {ag.extension ? `(${ag.extension})` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="px-3.5 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/50 text-[11px] text-slate-400">
                                                        {currentProf.timeout_action === "voicemail" ? "Sesli mesaj kutusuna aktarılır" : "Ek hedef gerekmiyor"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* TAB 2: YÖNLENDİRME VE VOICEMAIL */}
                        {activeTab === "forwarding" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Çağrı Yönlendirme Kuralları</h4>
                                        {(fwdAlwaysActive || fwdBusyActive || fwdNoAnswerActive) && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setFwdAlwaysActive(false);
                                                    setFwdBusyActive(false);
                                                    setFwdNoAnswerActive(false);
                                                    if (editingUser && editingUser.extension) {
                                                        await handleQuickCancelForwarding(editingUser.extension, "all");
                                                    }
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                                            >
                                                <X size={12} /> Tüm Yönlendirmeleri İptal Et
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        {renderForwardingRow("Her Zaman", fwdAlwaysActive, setFwdAlwaysActive, fwdAlwaysType, setFwdAlwaysType, fwdAlwaysTarget, setFwdAlwaysTarget, null, null)}
                                        {renderForwardingRow("Meşgul Durumda", fwdBusyActive, setFwdBusyActive, fwdBusyType, setFwdBusyType, fwdBusyTarget, setFwdBusyTarget, null, null)}
                                        {renderForwardingRow("Zaman Aşımında (Cevapsız)", fwdNoAnswerActive, setFwdNoAnswerActive, fwdNoAnswerType, setFwdNoAnswerType, fwdNoAnswerTarget, setFwdNoAnswerTarget, fwdNoAnswerTimeout, setFwdNoAnswerTimeout)}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sesli Mesaj (Voicemail)</h4>
                                        <button type="button" onClick={() => setVoicemailActive(!voicemailActive)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                            {voicemailActive ? <ToggleRight size={28} className={`${text}`} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>

                                    {voicemailActive && (
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Voicemail Anonsu</label>
                                                <select value={voicemailAnnouncement} onChange={(e) => setVoicemailAnnouncement(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none">
                                                    {ANNOUNCEMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Voicemail Şifresi (Sadece 4 Rakam)</label>
                                                <input type="text" maxLength={4} pattern="\d{4}" placeholder="Örn: 1234" value={voicemailPin} onChange={(e) => setVoicemailPin(e.target.value.replace(/\D/g, ''))} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none" />
                                            </div>
                                            <div className="col-span-2 flex items-center justify-between pt-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sesli mesajları e-posta ile gönder</span>
                                                <button type="button" onClick={() => setVoicemailToEmail(!voicemailToEmail)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                                    {voicemailToEmail ? <ToggleRight size={24} className={`${text}`} /> : <ToggleLeft size={24} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: ÖZELLİKLER */}
                        {activeTab === "features" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-800 dark:text-white">Ses Kayıt</h5>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Bu kullanıcının tüm görüşmeleri kaydedilsin mi?</p>
                                    </div>
                                    <button type="button" onClick={() => setRecordingActive(!recordingActive)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                        {recordingActive ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                    </button>
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

                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <label className="block text-xs font-bold text-slate-800 dark:text-white mb-2">Transport Protokolü</label>
                                    <p className="text-[10px] text-slate-500 mb-3">Kullanıcının SIP cihazı veya softphone'u için geçerli protokol.</p>
                                    <div className="flex gap-3">
                                        {["UDP", "TCP", "TLS"].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTransport(t)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${transport === t ? (lightBg + " " + border + " " + text) : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
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
                                            }}
                                            className="text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            {twoFactorEnabled ? <ToggleRight size={32} className={`${text}`} /> : <ToggleLeft size={32} />}
                                        </button>
                                    </div>
                                    
                                    {twoFactorEnabled && (
                                        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-800 dark:text-white mb-2">
                                                    2FA Doğrulama Yöntemi Seçiniz
                                                </label>
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
                                                                        fetchTwoFactorSetup(false, m.id);
                                                                    }
                                                                }}
                                                                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 ${
                                                                    isSelected
                                                                        ? `${lightBg} ${border} ring-2 ${ring}`
                                                                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-900"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                                        <IconComp size={14} />
                                                                    </div>
                                                                    {isSelected && <CheckCircle size={15} className={text} />}
                                                                </div>
                                                                <div>
                                                                    <div className={`text-xs font-extrabold ${isSelected ? text : "text-slate-800 dark:text-slate-100"}`}>
                                                                        {m.title}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                                                        {m.desc}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
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
                                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                                                Kullanıcının WhatsApp / GSM Numarası
                                                            </label>
                                                            <input
                                                                type="text"
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
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            Hazır Avatar Koleksiyonu ({PRESET_AVATARS.length} Seçenek)
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[320px] overflow-y-auto p-1">
                                        {PRESET_AVATARS.map((av) => (
                                            <button
                                                key={av}
                                                type="button"
                                                onClick={() => setAvatar(av)}
                                                className={`aspect-square rounded-2xl border-2 transition-all p-2 bg-slate-50 dark:bg-slate-950 ${
                                                avatar === av
                                                    ? (border + " shadow-md scale-105")
                                                    : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                                }`}
                                            >
                                                <img src={av} alt="Avatar" className="w-full h-full object-contain" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                            className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ring-purple-500"
                                        >
                                            {tenants.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({t.id})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl flex items-start gap-2.5">
                                        <Building2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium leading-relaxed">
                                            Kullanıcıyı farklı bir tenant'a aktardığınızda, kullanıcı yalnızca o tenant'a ait dahili hatları, çağrı verilerini ve müşteri panelini görüntüleyebilecektir.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: RAPOR & YÖNETİM FİLTRESİ (SUPERVIZOR) */}
                        {activeTab === "supervisor_filter" && hasSupervisorPerm && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <h5 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                        <Shield size={16} className={text} />
                                        Supervizor Rapor & Yönetim Filtresi
                                    </h5>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Bu supervizor kullanıcısının Canlı İzleme Panelinde müdahale edebileceği ve Raporlarda görüntüleyebileceği temsilcileri ve kuyrukları seçin.
                                    </p>
                                </div>

                                {/* 1. Yönetebileceği Temsilciler */}
                                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <h6 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                <Users size={14} className={text} />
                                                Yönetebileceği Kullanıcılar / Temsilciler
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full ${lightBg} ${text} font-extrabold`}>
                                                    {managedUsers.length} Seçili
                                                </span>
                                            </h6>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Seçim yapıldığında supervizor yalnızca seçili temsilcileri izler, yönetir ve raporlarını görür.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setManagedUsers((Array.isArray(users) ? users : []).map(u => String(u.id)))}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                                            >
                                                Tümünü Seç
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setManagedUsers([])}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-colors"
                                            >
                                                Temizle
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="İsim veya dahili numara ile filtrele..."
                                            value={supUserSearch}
                                            onChange={(e) => setSupUserSearch(e.target.value)}
                                            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                                        {(Array.isArray(users) ? users : [])
                                            .filter(u => {
                                                if (!supUserSearch.trim()) return true;
                                                const q = supUserSearch.toLowerCase();
                                                return (
                                                    String(u.name || "").toLowerCase().includes(q) ||
                                                    String(u.extension || "").toLowerCase().includes(q) ||
                                                    String(u.email || "").toLowerCase().includes(q)
                                                );
                                            })
                                            .map(u => {
                                                const uid = String(u.id);
                                                const isChecked = managedUsers.includes(uid);
                                                return (
                                                    <label
                                                        key={uid}
                                                        onClick={() => {
                                                            setManagedUsers(prev =>
                                                                prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
                                                            );
                                                        }}
                                                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                                                            isChecked
                                                                ? `${lightBg} ${border} shadow-sm`
                                                                : "bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                                                isChecked ? `${bg} border-transparent text-white` : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                            }`}>
                                                                {isChecked && <Check size={11} strokeWidth={3} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                    {u.name}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-medium truncate">
                                                                    Dahili: {u.extension || "-"} • {u.role || "agent"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* 2. Yönetebileceği Kuyruklar */}
                                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <h6 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                <PhoneCall size={14} className={text} />
                                                Yönetebileceği Çağrı Kuyrukları (ACD)
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full ${lightBg} ${text} font-extrabold`}>
                                                    {managedQueues.length} Seçili
                                                </span>
                                            </h6>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Seçim yapıldığında Canlı İzleme kuyruk kartları ve Raporlardaki kuyruk verileri bu seçimle filtrelenir.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setManagedQueues((Array.isArray(queuesList) ? queuesList : []).map(q => String(q.id || q.name || q.queue_name)))}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                                            >
                                                Tümünü Seç
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setManagedQueues([])}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-colors"
                                            >
                                                Temizle
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Kuyruk adı veya numarası ile filtrele..."
                                            value={supQueueSearch}
                                            onChange={(e) => setSupQueueSearch(e.target.value)}
                                            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>

                                    {(Array.isArray(queuesList) ? queuesList : []).length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                            Sistemde tanımlı çağrı kuyruğu bulunamadı.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                                            {(Array.isArray(queuesList) ? queuesList : [])
                                                .filter(q => {
                                                    if (!supQueueSearch.trim()) return true;
                                                    const s = supQueueSearch.toLowerCase();
                                                    return (
                                                        String(q.name || q.queue_name || "").toLowerCase().includes(s) ||
                                                        String(q.extension || "").toLowerCase().includes(s)
                                                    );
                                                })
                                                .map(q => {
                                                    const qKey = String(q.id || q.name || q.queue_name);
                                                    const qName = q.name || q.queue_name || qKey;
                                                    const isChecked = managedQueues.includes(qKey) || managedQueues.includes(String(qName));
                                                    return (
                                                        <label
                                                            key={qKey}
                                                            onClick={() => {
                                                                setManagedQueues(prev =>
                                                                    prev.includes(qKey)
                                                                        ? prev.filter(x => x !== qKey && x !== String(qName))
                                                                        : [...prev, qKey]
                                                                );
                                                            }}
                                                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                                                                isChecked
                                                                    ? `${lightBg} ${border} shadow-sm`
                                                                    : "bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                                                    isChecked ? `${bg} border-transparent text-white` : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                                }`}>
                                                                    {isChecked && <Check size={11} strokeWidth={3} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                        {qName}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-medium truncate">
                                                                        Kuyruk No: {q.extension || "-"}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
                                                Webphone Üzerinde Canlı CRM Müşteri Kartı Ön İzleme (REST API)
                                            </h6>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                2. sekmede CRM ekranını açarken aynı zamanda temsilcinin Webphone ekranında müşterinin CRM özet bilgilerini gösterir.
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

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-800/60">
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
          </div>
        </div>,
        document.body
      )}

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
