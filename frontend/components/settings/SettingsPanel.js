import React, { useState, useEffect } from "react";
import { Server, Smartphone, Settings, Coffee, User, Shield, Cable, Shuffle, PhoneCall, Languages, Heart, Bot, FileText, ShieldAlert, Fingerprint, Palette, Hash, ArrowUpRight, MapPin, Lock, HardDrive, Database, Building2 } from "lucide-react";
import PBXSettings from "./PBXSettings";
import NumberingPlanPanel from "./NumberingPlanPanel";
import ChannelSettings from "./ChannelSettings";
import BreakDefinitions from "./BreakDefinitions";
import UserSettings from "./UserSettings";
import RoleSettings from "./RoleSettings";
import SmartCallbackSettings from "./SmartCallbackSettings";
import LanguageDetectionSettings from "./LanguageDetectionSettings";
import EmotionManagementSettings from "./EmotionManagementSettings";
import WhisperSettings from "./WhisperSettings";
import CannedResponsesSettings from "./CannedResponsesSettings";
import BlacklistSettings from "./BlacklistSettings";
import QASettings from "./QASettings";
import UniversalAPISettings from "./UniversalAPISettings";
import VoiceBiometricsSettings from "./VoiceBiometricsSettings";
import AutoprovisionTemplatesPanel from "./AutoprovisionTemplatesPanel";
import LocationsDepartmentsPanel from "./LocationsDepartmentsPanel";
import RoiSettings from "./RoiSettings";
import SSLSettings from "./SSLSettings";
import BackupRestorePanel from "./BackupRestorePanel";
import RecordingRetentionSettings from "./RecordingRetentionSettings";
import AIProvidersSettings from "./AIProvidersSettings";
import APIBudgetSettings from "./APIBudgetSettings";
import TenantManagementPanel from "./TenantManagementPanel";
import { getTurkishSlugForSubtab, getSubtabFromTurkishSlug } from "../../utils/slugHelper";

export default function SettingsPanel({ backendHost = "localhost:8000" }) {
  const [activeSubTab, setActiveSubTab] = useState("pbx"); // pbx, trunks, channels

  // Read URL subtab query parameter on initial mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const subtabFromUrl = urlParams.get("subtab");
      if (subtabFromUrl) {
        const resolvedSubtab = getSubtabFromTurkishSlug(subtabFromUrl);
        setActiveSubTab(resolvedSubtab);
      }
    }
  }, []);

  // Sync activeSubTab state changes to URL query string with Turkish Slugs (?subtab=...)
  useEffect(() => {
    if (typeof window !== "undefined" && activeSubTab) {
      const turkishSubtab = getTurkishSlugForSubtab(activeSubTab);
      const currentUrlParams = new URLSearchParams(window.location.search);
      const currentSubtabInUrl = currentUrlParams.get("subtab");
      if (currentSubtabInUrl !== turkishSubtab) {
        currentUrlParams.set("subtab", turkishSubtab);
        const newUrl = `${window.location.pathname}?${currentUrlParams.toString()}`;
        window.history.replaceState({ subtab: turkishSubtab }, "", newUrl);
      }
    }
  }, [activeSubTab]);


  const [hasCannedPermission, setHasCannedPermission] = useState(false);
  const [hasBlacklistPermission, setHasBlacklistPermission] = useState(false);
  const [hasQAPermission, setHasQAPermission] = useState(false);
  const [hasAPIPermission, setHasAPIPermission] = useState(false);
  const [hasBioPermission, setHasBioPermission] = useState(false);
  const [hasAutoprovTemplatesPermission, setHasAutoprovTemplatesPermission] = useState(false);
  const [hasRoiSettingsPermission, setHasRoiSettingsPermission] = useState(false);
  const [hasSSLPermission, setHasSSLPermission] = useState(false);
  const [hasBackupPermission, setHasBackupPermission] = useState(false);
  const [hasRecordingRetentionPermission, setHasRecordingRetentionPermission] = useState(false);
  const [hasApiBudgetsPermission, setHasApiBudgetsPermission] = useState(true);
  const [debugPerms, setDebugPerms] = useState("");

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const savedAuth = localStorage.getItem('is_logged_in') === 'true' || sessionStorage.getItem('is_logged_in') === 'true';
        const savedUserId = localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id');

        if (!savedAuth || savedUserId === 'admin') {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          setHasRoiSettingsPermission(true);
          setHasSSLPermission(true);
          setHasBackupPermission(true);
          setHasRecordingRetentionPermission(true);
          setHasApiBudgetsPermission(true);
          return;
        }

        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?t=${Date.now()}`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => str(u.id) === str(savedUserId) || u.extension === savedUserId);
        
        if (!currentUser || currentUser.role === "admin" || currentUser.id === "admin") {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          setHasRoiSettingsPermission(true);
          setHasSSLPermission(true);
          setHasBackupPermission(true);
          setHasRecordingRetentionPermission(true);
          setHasApiBudgetsPermission(true);
          return;
        }

        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles?t=${Date.now()}`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUser.role);

        if (!currentRole || currentRole.role_code === "admin" || currentRole.role_code === "superadmin") {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          setHasRoiSettingsPermission(true);
          setHasSSLPermission(true);
          setHasBackupPermission(true);
          setHasRecordingRetentionPermission(true);
          setHasApiBudgetsPermission(true);
          return;
        }

        setHasCannedPermission(currentRole.permissions.includes("canned_responses:read"));
        setHasBlacklistPermission(currentRole.permissions.includes("blacklist:read"));
        setHasQAPermission(currentRole.permissions.includes("qa:read"));
        setHasAPIPermission(currentRole.permissions.includes("universal_api:read"));
        setHasBioPermission(currentRole.permissions.includes("voice_biometrics:read"));
        setHasAutoprovTemplatesPermission(currentRole.permissions.includes("autoprovision_templates:read"));
        setHasRoiSettingsPermission(currentRole.permissions.includes("roi_settings:read"));
        setHasSSLPermission(currentRole.permissions.includes("ssl:read"));
        setHasBackupPermission(currentRole.permissions.includes("backup_restore:read"));
        setHasRecordingRetentionPermission(currentRole.permissions.includes("recording_retention:read"));
        setHasApiBudgetsPermission(currentRole.permissions.includes("api_budgets:read") || currentRole.permissions.includes("api_budgets:write"));
        setDebugPerms(JSON.stringify(currentRole.permissions));
      } catch (err) {
        console.error("Canned/Blacklist permission check error:", err);
        setHasCannedPermission(true);
        setHasBlacklistPermission(true);
        setHasQAPermission(true);
        setHasAPIPermission(true);
        setHasBioPermission(true);
        setHasAutoprovTemplatesPermission(true);
        setHasRoiSettingsPermission(true);
        setHasSSLPermission(true);
        setHasBackupPermission(true);
        setHasRecordingRetentionPermission(true);
        setHasApiBudgetsPermission(true);
      }
    };
    checkPermissions();
  }, [backendHost]);

  return (
    <div className="w-full space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/85 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Settings size={22} className="text-slate-500 dark:text-slate-400" />
            Sistem Ayarları
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asterisk santral, Gemini entegrasyonu, SIP trunk hatları ve sosyal mesajlaşma kanalları yapılandırması.
          </p>
        </div>
      </div>

      {/* Side-by-Side Settings Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start w-full">
        
        {/* Left Side Sub-Tab Menu (Vertical Stack) */}
        <div className="w-full md:w-64 lg:w-72 shrink-0 p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-1">
          <button
            onClick={() => setActiveSubTab("pbx")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "pbx"
                ? "bg-rose-50/50 dark:bg-rose-950/20 text-primary dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Server size={14} className={activeSubTab === "pbx" ? "text-primary" : ""} />
            <span>Santral Entegrasyonu</span>
          </button>
          <button
            onClick={() => setActiveSubTab("qa")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "qa"
                ? "bg-slate-100/50 dark:bg-slate-800/50 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <ShieldAlert size={14} className={activeSubTab === "qa" ? "text-slate-800 dark:text-white" : ""} />
            <span>Çağrı Kalite Kontrol</span>
          </button>

          <button
            onClick={() => setActiveSubTab("locations")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "locations"
                ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <MapPin size={14} className={activeSubTab === "locations" ? "text-rose-600 dark:text-rose-450" : ""} />
            <span>Lokasyon ve Departmanlar</span>
          </button>
          <button
            onClick={() => setActiveSubTab("numbering-plan")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "numbering-plan"
                ? "bg-slate-100/50 dark:bg-slate-800/50 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Hash size={14} className={activeSubTab === "numbering-plan" ? "text-slate-800 dark:text-white" : ""} />
            <span>Numara Planı</span>
          </button>
          <button
            onClick={() => setActiveSubTab("smart-callback")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "smart-callback"
                ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-primary dark:text-primary border-indigo-100/50 dark:border-indigo-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Shuffle size={14} className={activeSubTab === "smart-callback" ? "text-primary" : ""} />
            <span>Akıllı Geri Arama</span>
          </button>

          <button
            onClick={() => setActiveSubTab("lang-detect")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "lang-detect"
                ? "bg-rose-50/50 dark:bg-rose-950/20 text-primary dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Languages size={14} className={activeSubTab === "lang-detect" ? "text-primary" : ""} />
            <span>Otomatik Dil Algılama</span>
          </button>

          <button
            onClick={() => setActiveSubTab("emotion-management")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "emotion-management"
                ? "bg-rose-50/50 dark:bg-rose-950/20 text-primary dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Heart size={14} className={activeSubTab === "emotion-management" ? "text-primary fill-rose-500" : ""} />
            <span>Dinamik Duygu Yönetimi</span>
          </button>
          
          <button
            onClick={() => setActiveSubTab("whisper-management")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "whisper-management"
                ? "bg-amber-50/50 dark:bg-amber-950/20 text-primary dark:text-amber-450 border-amber-100/50 dark:border-amber-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Bot size={14} className={activeSubTab === "whisper-management" ? "text-primary" : ""} />
            <span>AI Fısıldama Yönetimi</span>
          </button>

          {hasBioPermission && (
            <button
              onClick={() => setActiveSubTab("voice-biometrics")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "voice-biometrics"
                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-primary dark:text-indigo-455 border-indigo-100/50 dark:border-indigo-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <Fingerprint size={14} className={activeSubTab === "voice-biometrics" ? "text-primary" : ""} />
              <span>Biyometrik Ses Analizi</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab("channels")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "channels"
                ? "bg-pink-50/50 dark:bg-pink-950/20 text-pink-650 dark:text-pink-400 border-pink-100/50 dark:border-pink-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Smartphone size={14} className={activeSubTab === "channels" ? "text-pink-500" : ""} />
            <span>Kanal Entegrasyonları</span>
          </button>
          <button
            onClick={() => setActiveSubTab("breaks")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "breaks"
                ? "bg-amber-50/50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Coffee size={14} className={activeSubTab === "breaks" ? "text-primary" : ""} />
            <span>Mola Tanımları</span>
          </button>
          <button
            onClick={() => setActiveSubTab("roles")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "roles"
                ? "bg-purple-50/50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-100/50 dark:border-purple-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Shield size={14} className={activeSubTab === "roles" ? "text-primary" : ""} />
            <span>Roller</span>
          </button>

          {hasCannedPermission && (
            <button
              onClick={() => setActiveSubTab("canned-responses")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "canned-responses"
                  ? "bg-pink-50/50 dark:bg-pink-950/20 text-pink-650 dark:text-pink-400 border-pink-100/50 dark:border-pink-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <FileText size={14} className={activeSubTab === "canned-responses" ? "text-pink-500" : ""} />
              <span>Hızlı Cevaplar</span>
            </button>
          )}

          {hasAPIPermission && (
            <button
              onClick={() => setActiveSubTab("universal-api")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "universal-api"
                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-primary dark:text-primary border-indigo-100/50 dark:border-indigo-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <Cable size={14} className={activeSubTab === "universal-api" ? "text-primary" : ""} />
              <span>Evrensel API Sihirbazı</span>
            </button>
          )}

          {hasAutoprovTemplatesPermission && (
            <button
              onClick={() => setActiveSubTab("autoprovision-templates")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "autoprovision-templates"
                  ? "bg-amber-50/50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <FileText size={14} className={activeSubTab === "autoprovision-templates" ? "text-primary" : ""} />
              <span>Otoprovizyon Şablonları</span>
            </button>
          )}

          {hasRoiSettingsPermission && (
            <button
              onClick={() => setActiveSubTab("roi-settings")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "roi-settings"
                  ? "bg-amber-50/50 dark:bg-amber-950/20 text-primary dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <FileText size={14} className={activeSubTab === "roi-settings" ? "text-primary" : ""} />
              <span>ROI Rapor Ayarları</span>
            </button>
          )}

          {hasSSLPermission && (
            <button
              onClick={() => setActiveSubTab("ssl")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "ssl"
                  ? "bg-slate-100/50 dark:bg-slate-800/50 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <Lock size={14} className={activeSubTab === "ssl" ? "text-slate-800 dark:text-white" : ""} />
              <span>SSL Sertifikaları</span>
            </button>
          )}

          {hasBackupPermission && (
            <button
              onClick={() => setActiveSubTab("backup")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "backup"
                  ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <HardDrive size={14} className={activeSubTab === "backup" ? "text-rose-600 dark:text-rose-450" : ""} />
              <span>Sistem Yedekleme</span>
            </button>
          )}

          {hasRecordingRetentionPermission && (
            <button
              onClick={() => setActiveSubTab("recording-retention")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "recording-retention"
                  ? "bg-slate-100/50 dark:bg-slate-800/50 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <HardDrive size={14} className={activeSubTab === "recording-retention" ? "text-slate-800 dark:text-white" : ""} />
              <span>Kayıt & Saklama Sistemi</span>
            </button>
          )}
          <button
            onClick={() => setActiveSubTab("ai-providers")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "ai-providers"
                ? "bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Bot size={14} className={activeSubTab === "ai-providers" ? "text-purple-600 dark:text-purple-400" : ""} />
            <span>Yapay Zeka API Ayarları</span>
          </button>

          {hasApiBudgetsPermission && (
            <button
              onClick={() => setActiveSubTab("api-budgets")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "api-budgets"
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <Database size={14} className={activeSubTab === "api-budgets" ? "text-emerald-600 dark:text-emerald-400" : ""} />
              <span>API Bütçe ve Tüketim</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab("tenants")}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
              activeSubTab === "tenants"
                ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-900/30 shadow-sm"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Building2 size={14} className={activeSubTab === "tenants" ? "text-rose-600 dark:text-rose-400" : ""} />
            <span>Müşteri (Tenant) Yönetimi</span>
          </button>
        </div>

        {/* Right Side Settings Panel Area */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {activeSubTab === "pbx" && <PBXSettings backendHost={backendHost} />}
          {activeSubTab === "numbering-plan" && <NumberingPlanPanel backendHost={backendHost} />}
          {activeSubTab === "smart-callback" && <SmartCallbackSettings backendHost={backendHost} />}
          {activeSubTab === "lang-detect" && <LanguageDetectionSettings backendHost={backendHost} />}
          {activeSubTab === "emotion-management" && <EmotionManagementSettings backendHost={backendHost} />}
          {activeSubTab === "whisper-management" && <WhisperSettings backendHost={backendHost} />}
          {activeSubTab === "channels" && <ChannelSettings backendHost={backendHost} />}
          {activeSubTab === "breaks" && <BreakDefinitions backendHost={backendHost} />}
          {activeSubTab === "roles" && <RoleSettings backendHost={backendHost} />}
          {activeSubTab === "canned-responses" && <CannedResponsesSettings backendHost={backendHost} />}
          {activeSubTab === "qa" && <QASettings backendHost={backendHost} />}
          {activeSubTab === "universal-api" && <UniversalAPISettings backendHost={backendHost} />}
          {activeSubTab === "voice-biometrics" && <VoiceBiometricsSettings backendHost={backendHost} />}
          {activeSubTab === "autoprovision-templates" && <AutoprovisionTemplatesPanel backendHost={backendHost} />}
          {activeSubTab === "locations" && <LocationsDepartmentsPanel backendHost={backendHost} />}
          {activeSubTab === "roi-settings" && <RoiSettings backendHost={backendHost} />}
          {activeSubTab === "ssl" && <SSLSettings backendHost={backendHost} />}
          {activeSubTab === "backup" && <BackupRestorePanel backendHost={backendHost} />}
          {activeSubTab === "recording-retention" && (
            <RecordingRetentionSettings backendHost={backendHost} />
          )}
          {activeSubTab === "ai-providers" && (
            <AIProvidersSettings backendHost={backendHost} />
          )}
          {activeSubTab === "api-budgets" && (
            <APIBudgetSettings backendHost={backendHost} />
          )}
          {activeSubTab === "tenants" && (
            <TenantManagementPanel backendHost={backendHost} />
          )}
        </div>
      </div>
    </div>
  );
}
