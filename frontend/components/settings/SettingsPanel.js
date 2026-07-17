import React, { useState, useEffect } from "react";
import { Server, Smartphone, Settings, Coffee, User, Shield, Cable, Shuffle, PhoneCall, Languages, Heart, Bot, FileText, ShieldAlert, Fingerprint, Palette, Hash, ArrowUpRight } from "lucide-react";
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

export default function SettingsPanel({ backendHost = "localhost:8000" }) {
  const [activeSubTab, setActiveSubTab] = useState("pbx"); // pbx, trunks, channels
  const [hasCannedPermission, setHasCannedPermission] = useState(false);
  const [hasBlacklistPermission, setHasBlacklistPermission] = useState(false);
  const [hasQAPermission, setHasQAPermission] = useState(false);
  const [hasAPIPermission, setHasAPIPermission] = useState(false);
  const [hasBioPermission, setHasBioPermission] = useState(false);
  const [hasAutoprovTemplatesPermission, setHasAutoprovTemplatesPermission] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          return;
        }
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (!currentUser) {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          return;
        }
        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUser.role);
        if (!currentRole) {
          setHasCannedPermission(true);
          setHasBlacklistPermission(true);
          setHasQAPermission(true);
          setHasAPIPermission(true);
          setHasBioPermission(true);
          setHasAutoprovTemplatesPermission(true);
          return;
        }
        setHasCannedPermission(currentRole.permissions.includes("canned_responses:read"));
        setHasBlacklistPermission(currentRole.permissions.includes("blacklist:read"));
        setHasQAPermission(currentRole.permissions.includes("qa:read"));
        setHasAPIPermission(currentRole.permissions.includes("universal_api:read"));
        setHasBioPermission(currentRole.permissions.includes("voice_biometrics:read"));
        setHasAutoprovTemplatesPermission(currentRole.permissions.includes("autoprovision_templates:read"));
      } catch (err) {
        console.error("Canned/Blacklist permission check error:", err);
        setHasCannedPermission(true);
        setHasBlacklistPermission(true);
        setHasQAPermission(true);
        setHasAPIPermission(true);
        setHasBioPermission(true);
        setHasAutoprovTemplatesPermission(true);
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
      <div className={`grid grid-cols-1 ${["universal-api", "voice-biometrics", "autoprovision-templates"].includes(activeSubTab) ? "xl:grid-cols-12" : "md:grid-cols-4"} gap-6 items-start`}>
        
        {/* Left Side Sub-Tab Menu (Vertical Stack) */}
        <div className={`${["universal-api", "voice-biometrics", "autoprovision-templates"].includes(activeSubTab) ? "xl:col-span-2" : "md:col-span-1"} p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-1`}>
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



          {hasQAPermission && (
            <button
              onClick={() => setActiveSubTab("qa")}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 border text-left ${
                activeSubTab === "qa"
                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-primary dark:text-primary border-indigo-100/50 dark:border-indigo-900/30 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <FileText size={14} className={activeSubTab === "qa" ? "text-primary" : ""} />
              <span>Otomatik QA Kuralları</span>
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
        </div>

        {/* Right Side Content Panel */}
        <div className={`${["universal-api", "voice-biometrics", "autoprovision-templates"].includes(activeSubTab) ? "xl:col-span-10" : "md:col-span-3"} transition-all duration-300`}>
          {activeSubTab === "pbx" && (
            <PBXSettings viewMode="pbx" backendHost={backendHost} />
          )}

          {activeSubTab === "numbering-plan" && (
            <NumberingPlanPanel backendHost={backendHost} />
          )}

          {activeSubTab === "smart-callback" && (
            <SmartCallbackSettings backendHost={backendHost} />
          )}
          {activeSubTab === "lang-detect" && (
            <LanguageDetectionSettings backendHost={backendHost} />
          )}

          {activeSubTab === "autoprovision-templates" && (
            <AutoprovisionTemplatesPanel backendHost={backendHost} />
          )}
          {activeSubTab === "emotion-management" && (
            <EmotionManagementSettings backendHost={backendHost} />
          )}
          {activeSubTab === "whisper-management" && (
            <WhisperSettings backendHost={backendHost} />
          )}
          {activeSubTab === "channels" && (
            <ChannelSettings backendHost={backendHost} />
          )}
          {activeSubTab === "breaks" && (
            <BreakDefinitions backendHost={backendHost} />
          )}

          {activeSubTab === "roles" && (
            <RoleSettings backendHost={backendHost} />
          )}
          {activeSubTab === "canned-responses" && (
            <CannedResponsesSettings backendHost={backendHost} />
          )}

          {activeSubTab === "qa" && (
            <QASettings backendHost={backendHost} />
          )}
          {activeSubTab === "universal-api" && (
            <UniversalAPISettings backendHost={backendHost} />
          )}
          {activeSubTab === "voice-biometrics" && (
            <VoiceBiometricsSettings backendHost={backendHost} />
          )}
        </div>
      </div>
    </div>
  );
}
