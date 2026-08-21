import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit2, X, User, Mail, Phone, Shield, Check, CheckCircle, ToggleLeft, ToggleRight, Search, Copy, RefreshCw, KeyRound, PhoneCall, Settings, Image as ImageIcon, Monitor, Smartphone, AlertTriangle, PhoneOutgoing, Users, Forward, Mic, MicOff, Download, Upload, Building2 } from "lucide-react";
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
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Anil",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Can",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Adrian",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
];

const ANNOUNCEMENTS = [
  "Varsayılan Anons",
  "Kişisel Anons 1",
  "Mesai Dışı Anonsu"
];

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
  const [activeTab, setActiveTab] = useState("login_sip");

  // Basic Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [extension, setExtension] = useState("");
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  // SIP Fields
  const [sipPassword, setSipPassword] = useState("");
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
  const [twoFactorMethod, setTwoFactorMethod] = useState("app");

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

  const resetForm = () => {
    setEditingUser(null);
    setActiveTab("login_sip");
    setUserTenantId(typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default");
    setFullName("");
    setEmail("");
    setExtension("");
    setAvatar(PRESET_AVATARS[0]);
    setRole(systemRoles.length > 0 ? systemRoles[0].role_code : "agent");
    setIsActive(true);
    setPassword("");
    setSipPassword("");
    setOutboundCallerId("");

    setFwdAlwaysActive(false); setFwdAlwaysType("internal"); setFwdAlwaysTarget("");
    setFwdBusyActive(false); setFwdBusyType("internal"); setFwdBusyTarget("");
    setFwdNoAnswerActive(false); setFwdNoAnswerType("internal"); setFwdNoAnswerTarget(""); setFwdNoAnswerTimeout(30);

    setVoicemailActive(false); setVoicemailAnnouncement(ANNOUNCEMENTS[0]);
    setVoicemailPin(""); setVoicemailToEmail(false);

    setRecordingActive(false); setTransport("UDP");
    setTwoFactorEnabled(false); setTwoFactorMethod("app");

    setSelectedOutboundRules([]);
    setSelectedCallPickupGroups([]);
    setSelectedLocation("");
    setSelectedDepartment("");
  };

  const openAddModal = () => {
    resetForm();
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
    
    setSipPassword(u.sip_password || "");
    if(!u.sip_password) generateSipPassword();
    
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
    setTwoFactorEnabled(u.two_factor_enabled || false);
    setTwoFactorMethod(u.two_factor_method || "app");

    const activeOutbound = outboundRules.filter(r => r.allowed_users && r.allowed_users.includes(u.id)).map(r => r.id);
    setSelectedOutboundRules(activeOutbound);
    
    const activePickup = callPickupGroups.filter(g => g.extensions && g.extensions.includes(u.id)).map(g => g.id);
    setSelectedCallPickupGroups(activePickup);

    setSelectedLocation(u.location_id || "");
    setSelectedDepartment(u.department_id || "");

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
    if (!fullName.trim() || !email.trim() || !extension.trim()) {
      setError("Lütfen Ad Soyad, E-posta ve Dahili Numara alanlarını doldurunuz.");
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

    const userData = {
      full_name: fullName.trim(),
      email: email.trim(),
      extension: extInput,
      avatar,
      role,
      is_active: isActive,
      tenant_id: userTenantId,
      password,
      sip_password: sipPassword,
      outbound_caller_id: outboundCallerId.trim(),
      forwarding_always: fwdAlwaysTarget ? { active: fwdAlwaysActive, type: fwdAlwaysType, target: fwdAlwaysTarget } : null,
      forwarding_busy: fwdBusyTarget ? { active: fwdBusyActive, type: fwdBusyType, target: fwdBusyTarget } : null,
      forwarding_no_answer: fwdNoAnswerTarget ? { active: fwdNoAnswerActive, type: fwdNoAnswerType, target: fwdNoAnswerTarget, timeout: fwdNoAnswerTimeout } : null,
      voicemail_active: voicemailActive,
      voicemail_announcement: voicemailAnnouncement,
      voicemail_pin: voicemailPin,
      voicemail_to_email: voicemailToEmail,
      recording_active: recordingActive,
      transport,
      two_factor_enabled: twoFactorEnabled,
      two_factor_method: twoFactorMethod,
      location_id: selectedLocation || null,
      department_id: selectedDepartment || null
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
                          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-emerald-50/95 dark:bg-emerald-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl whitespace-nowrap shadow-lg border border-emerald-200/80 dark:border-emerald-800/80 z-[100] pointer-events-none flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Web Phone Bağlı</span>
                            {u.ip_address && (
                              <span className="text-emerald-600/90 dark:text-emerald-400/90 font-mono text-[9px] bg-emerald-100/70 dark:bg-emerald-900/70 px-1 py-0.2 rounded font-normal">({u.ip_address})</span>
                            )}
                          </span>
                        ) : (
                          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-600 dark:text-rose-400 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-rose-50/95 dark:bg-rose-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl whitespace-nowrap shadow-lg border border-rose-200/80 dark:border-rose-800/80 z-[100] pointer-events-none flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
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
                    <div className="min-w-0" style={{ flex: '2 2 0%' }}>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate" title={u.full_name}>
                        {u.full_name}
                      </h4>
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
                        let fwdType = "";
                        let fwdTarget = "";
                        if (u.forwarding_always?.active) { fwdType = "Her Zaman"; fwdTarget = u.forwarding_always.target; }
                        else if (u.forwarding_busy?.active) { fwdType = "Meşgulde"; fwdTarget = u.forwarding_busy.target; }
                        else if (u.forwarding_no_answer?.active) { fwdType = "Cevapsız"; fwdTarget = u.forwarding_no_answer.target; }
                        if (fwdType) {
                            return (
                             <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-bold shrink-0 border border-amber-200/50 dark:border-amber-800/50" title={`Yönlendirme: ${fwdType} -> ${fwdTarget || 'Belirtilmedi'}`}>
                                <Forward size={10} />
                                <span>{fwdType} {fwdTarget && <span className="opacity-75 font-medium">({fwdTarget})</span>}</span>
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
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                            onClick={() => setActiveTab("login_sip")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'login_sip' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <KeyRound size={16} />
                            Giriş ve SIP
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
                        <button
                            type="button"
                            onClick={() => setActiveTab("avatar")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'avatar' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <ImageIcon size={16} />
                            Avatar Seçimi
                        </button>
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
                    <form onSubmit={handleFormSubmit} className="p-6 space-y-6 h-full flex flex-col justify-between">
                        {error && (
                          <div className="p-3.5 bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-primary dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2.5">
                            <span>{error}</span>
                            <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        
                        {/* TAB 1: GİRİŞ VE SIP */}
                        {activeTab === "login_sip" && (
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
                                        <input type="text" required placeholder="Örn: Ahmet Yılmaz" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">E-posta Adresi</label>
                                        <input type="email" required placeholder="ahmet@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
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

                                <div className={`p-4 rounded-xl border ${borderLight} ${lightBg} space-y-4 mt-2`}>
                                    <h4 className={`text-xs font-bold ${text} border-b ${borderLight} pb-2`}>SIP AYARLARI</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dahili Numarası (Extension)</label>
                                            <input type="text" required placeholder="Örn: 202" value={extension} onChange={(e) => setExtension(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dış Aramada Görünecek Numara</label>
                                            <input type="text" placeholder="Boş bırakılırsa varsayılan kural" value={outboundCallerId} onChange={(e) => setOutboundCallerId(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">SIP Register Şifresi</label>
                                        <div className="flex gap-2">
                                            <input type="text" readOnly value={sipPassword} className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none font-mono" />
                                            <button type="button" onClick={copySipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Şifreyi Kopyala"><Copy size={16}/></button>
                                            <button type="button" onClick={generateSipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Yeni Şifre Üret"><RefreshCw size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: YÖNLENDİRME VE VOICEMAIL */}
                        {activeTab === "forwarding" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Çağrı Yönlendirme Kuralları</h4>
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
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h5 className="text-sm font-bold text-slate-800 dark:text-white">İki Aşamalı Doğrulama (2FA)</h5>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Kullanıcı sisteme girerken doğrulama kodu sorulsun mu?</p>
                                        </div>
                                        <button type="button" onClick={() => setTwoFactorEnabled(!twoFactorEnabled)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                            {twoFactorEnabled ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                        </button>
                                    </div>
                                    
                                    {twoFactorEnabled && (
                                        <div className="mt-3">
                                            <label className="block text-xs font-bold text-slate-800 dark:text-white mb-2">Doğrulama Yöntemi</label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setTwoFactorMethod("app")}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${twoFactorMethod === "app" ? (lightBg + " " + border + " " + text) : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                                >
                                                    Authenticator Uygulaması
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTwoFactorMethod("email")}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${twoFactorMethod === "email" ? (lightBg + " " + border + " " + text) : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                                >
                                                    E-Posta Gönderimi
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 4: AVATAR */}
                        {activeTab === "avatar" && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-4">Profil Avatarı Seçin</label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
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
                                <div className="mt-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Seçili Görünüm</span>
                                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-lg bg-slate-100 dark:bg-slate-950 overflow-hidden">
                                        <img src={avatar} alt="Seçili Avatar" className="w-full h-full object-cover" />
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

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-800/60">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
