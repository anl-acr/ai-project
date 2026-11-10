import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Server,
  Smartphone,
  Settings,
  Coffee,
  Shield,
  Cable,
  Languages,
  Heart,
  Bot,
  FileText,
  ShieldAlert,
  Fingerprint,
  Hash,
  MapPin,
  Lock,
  HardDrive,
  Database,
  Building2,
  Network,
  GitCommit,
  Mail,
  RotateCcw,
  Cpu,
  KeyRound,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Clock,
  PhoneOutgoing
} from "lucide-react";
import dynamic from "next/dynamic";
import { getTurkishSlugForSubtab, getSubtabFromTurkishSlug } from "../../utils/slugHelper";
import { useTheme } from "../../utils/theme";
import {
  PanelShimmerSkeleton,
  runStageViewTransition,
  useStageRevealObserver,
  readDocumentMotionMode
} from "../../utils/uiMotion";

const SubPanelLoading = () => <PanelShimmerSkeleton variant="cards" />;

const lazySub = (loader) => dynamic(loader, { ssr: false, loading: SubPanelLoading });

const PBXSettings = lazySub(() => import("./PBXSettings"));
const NATSettings = lazySub(() => import("./NATSettings"));
const NumberingPlanPanel = lazySub(() => import("./NumberingPlanPanel"));
const ChannelSettings = lazySub(() => import("./ChannelSettings"));
const BreakDefinitions = lazySub(() => import("./BreakDefinitions"));
const RoleSettings = lazySub(() => import("./RoleSettings"));
const LanguageDetectionSettings = lazySub(() => import("./LanguageDetectionSettings"));
const EmotionManagementSettings = lazySub(() => import("./EmotionManagementSettings"));
const WhisperSettings = lazySub(() => import("./WhisperSettings"));
const CannedResponsesSettings = lazySub(() => import("./CannedResponsesSettings"));
const QASettings = lazySub(() => import("./QASettings"));
const UniversalAPISettings = lazySub(() => import("./UniversalAPISettings"));
const VoiceBiometricsSettings = lazySub(() => import("./VoiceBiometricsSettings"));
const AutoprovisionTemplatesPanel = lazySub(() => import("./AutoprovisionTemplatesPanel"));
const LocationsDepartmentsPanel = lazySub(() => import("./LocationsDepartmentsPanel"));
const RoiSettings = lazySub(() => import("./RoiSettings"));
const SSLSettings = lazySub(() => import("./SSLSettings"));
const BackupRestorePanel = lazySub(() => import("./BackupRestorePanel"));
const RecordingRetentionSettings = lazySub(() => import("./RecordingRetentionSettings"));
const AIProvidersSettings = lazySub(() => import("./AIProvidersSettings"));
const AITaskRoutingSettings = lazySub(() => import("./AITaskRoutingSettings"));
const TenantManagementPanel = lazySub(() => import("./TenantManagementPanel"));
const LicenseSettingsPanel = lazySub(() => import("./LicenseSettingsPanel"));
const ChangelogPanel = lazySub(() => import("./ChangelogPanel"));
const EmailNotificationsPanel = lazySub(() => import("./EmailNotificationsPanel"));
const RestorePointsPanel = lazySub(() => import("./RestorePointsPanel"));
const WorkHoursSettingsPanel = lazySub(() => import("./WorkHoursSettingsPanel"));
const SmartCallbackSettings = lazySub(() => import("./SmartCallbackSettings"));
import InfoTooltip from "../common/InfoTooltip";

const normalizeSubTab = (subTab) => {
  if (!subTab) return "pbx";
  if (subTab === "ai_providers") return "ai-providers";
  return subTab;
};

export default function SettingsPanel({ backendHost = "localhost:8000" }) {
  const { bg, text, lightBg, borderLight } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState("pbx");
  const [activeCategory, setActiveCategory] = useState("pbx_network");
  const categoryTabRefs = useRef({});
  const subPanelStageRef = useRef(null);

  useStageRevealObserver(subPanelStageRef, activeSubTab);

  const switchSettingsSubTab = (nextId) => {
    if (!nextId || nextId === activeSubTab) return;
    runStageViewTransition(
      subPanelStageRef.current,
      () => setActiveSubTab(nextId),
      readDocumentMotionMode()
    );
  };

  // Read URL subtab query parameter on initial mount & listen for global navigation events
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const subtabFromUrl = urlParams.get("subtab");
      if (subtabFromUrl) {
        const resolvedSubtab = normalizeSubTab(getSubtabFromTurkishSlug(subtabFromUrl));
        setActiveSubTab(resolvedSubtab);
      }
    }

    const handleSwitchSettingsSubTab = (e) => {
      if (e?.detail?.subTab) {
        setActiveSubTab(normalizeSubTab(e.detail.subTab));
      }
    };
    window.addEventListener("SWITCH_SETTINGS_SUBTAB", handleSwitchSettingsSubTab);
    return () => window.removeEventListener("SWITCH_SETTINGS_SUBTAB", handleSwitchSettingsSubTab);
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
  const [hasAiTaskRoutingPermission, setHasAiTaskRoutingPermission] = useState(true);
  const [hasWorkHoursPermission, setHasWorkHoursPermission] = useState(true);
  const [hasSmartCallbackPermission, setHasSmartCallbackPermission] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const savedAuth =
          localStorage.getItem("is_logged_in") === "true" ||
          sessionStorage.getItem("is_logged_in") === "true";
        const savedUserId =
          localStorage.getItem("current_user_id") ||
          sessionStorage.getItem("current_user_id");

        if (!savedAuth || savedUserId === "admin") {
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
          setHasAiTaskRoutingPermission(true);
          return;
        }

        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?t=${Date.now()}`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(
          (u) => String(u.id) === String(savedUserId) || u.extension === savedUserId
        );

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
          setHasAiTaskRoutingPermission(true);
          return;
        }

        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles?t=${Date.now()}`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find((r) => r.role_code === currentUser.role);

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
          setHasAiTaskRoutingPermission(true);
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
        setHasApiBudgetsPermission(
          currentRole.permissions.includes("api_budgets:read") ||
            currentRole.permissions.includes("api_budgets:write")
        );
        setHasAiTaskRoutingPermission(
          currentRole.permissions.includes("ai_task_routing:read") ||
            currentRole.permissions.includes("ai_task_routing:write")
        );
        setHasWorkHoursPermission(
          currentRole.permissions.includes("work_hours:read") ||
            currentRole.permissions.includes("pbx:read")
        );
        setHasSmartCallbackPermission(
          currentRole.permissions.includes("smart_callback:read") ||
            currentRole.permissions.includes("pbx:read")
        );
      } catch (err) {
        console.error("Settings permission check error:", err);
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
        setHasAiTaskRoutingPermission(true);
      }
    };
    checkPermissions();
  }, [backendHost]);

  const categories = useMemo(() => {
    const rawCategories = [
      {
        id: "pbx_network",
        label: "Santral & Ağ",
        description: "Asterisk santral bağlantısı, NAT/IP yapılandırması, numara planı, otoprovizyon ve SSL sertifikaları.",
        icon: Server,
        items: [
          {
            id: "pbx",
            label: "Santral Entegrasyonu",
            subtitle: "Asterisk & AMI bağlantısı",
            icon: Server,
            visible: true
          },
          {
            id: "nat",
            label: "NAT ve Dış IP Ayarları",
            subtitle: "Genel IP ve yerel ağlar",
            icon: Network,
            visible: true
          },
          {
            id: "numbering-plan",
            label: "Numara Planı",
            subtitle: "Dahili ve yönlendirme kodları",
            icon: Hash,
            visible: true
          },
          {
            id: "autoprovision-templates",
            label: "Otoprovizyon Şablonları",
            subtitle: "IP telefon kurulum şablonları",
            icon: FileText,
            visible: hasAutoprovTemplatesPermission
          },
          {
            id: "ssl",
            label: "SSL Sertifikaları",
            subtitle: "HTTPS & WSS TLS güvenliği",
            icon: Lock,
            visible: hasSSLPermission
          },
          {
            id: "smart-callback",
            label: "Akıllı Geri Arama (Callback)",
            subtitle: "Kuyruk bekleme süresi ve otomatik geri arama",
            icon: PhoneOutgoing,
            visible: hasSmartCallbackPermission
          }
        ]
      },
      {
        id: "organization",
        label: "Organizasyon & Lisans",
        description: "Rol bazlı erişim yetkileri, şube/departman yapısı, mola türleri, çoklu müşteri ve lisans yönetimi.",
        icon: Shield,
        items: [
          {
            id: "roles",
            label: "Roller",
            subtitle: "Yetki profilleri ve erişim matrisi",
            icon: Shield,
            visible: true
          },
          {
            id: "locations",
            label: "Lokasyon ve Departmanlar",
            subtitle: "Şube ve birim tanımları",
            icon: MapPin,
            visible: true
          },
          {
            id: "breaks",
            label: "Mola Tanımları",
            subtitle: "Temsilci mola türleri ve süreleri",
            icon: Coffee,
            visible: true
          },
          {
            id: "work-hours",
            label: "Mesai & Resmi Tatiller",
            subtitle: "Haftalık çalışma saatleri ve resmi tatiller",
            icon: Clock,
            visible: hasWorkHoursPermission
          },
          {
            id: "tenants",
            label: "Müşteri (Tenant) Yönetimi",
            subtitle: "Çoklu müşteri izolasyonu",
            icon: Building2,
            visible: true
          },
          {
            id: "license",
            label: "Lisans & Key Yönetimi",
            subtitle: "Donanım kilidi ve abonelik anahtarı",
            icon: KeyRound,
            visible: true
          }
        ]
      },
      {
        id: "ai_quality",
        label: "Yapay Zeka & Analiz",
        description: "LLM sağlayıcıları, görev yönlendirme, kalite değerlendirme, dil/duygu algılama ve biyometrik analiz.",
        icon: Bot,
        items: [
          {
            id: "ai-providers",
            label: "Yapay Zeka API Ayarları",
            subtitle: "Gemini, OpenAI ve LLM anahtarları",
            icon: Bot,
            visible: true
          },
          {
            id: "ai-task-routing",
            label: "AI Görev & Model Yönlendirme",
            subtitle: "Görev bazlı aktif model seçimi",
            icon: Cpu,
            visible: hasAiTaskRoutingPermission
          },
          {
            id: "qa",
            label: "Çağrı Kalite Kontrol",
            subtitle: "Otomatik değerlendirme kriterleri",
            icon: ShieldAlert,
            visible: hasQAPermission
          },
          {
            id: "lang-detect",
            label: "Otomatik Dil Algılama",
            subtitle: "Çok dilli karşılama ve algılama",
            icon: Languages,
            visible: true
          },
          {
            id: "emotion-management",
            label: "Dinamik Duygu Yönetimi",
            subtitle: "Müşteri duygu tonu analizi",
            icon: Heart,
            visible: true
          },
          {
            id: "whisper-management",
            label: "AI Fısıldama Yönetimi",
            subtitle: "Canlı temsilci koçluğu",
            icon: Sparkles,
            visible: true
          },
          {
            id: "voice-biometrics",
            label: "Biyometrik Ses Analizi",
            subtitle: "Ses izi ile kimlik doğrulama",
            icon: Fingerprint,
            visible: hasBioPermission
          },
          {
            id: "roi-settings",
            label: "ROI Rapor Ayarları",
            subtitle: "Maliyet ve kazanım parametreleri",
            icon: TrendingUp,
            visible: hasRoiSettingsPermission
          }
        ]
      },
      {
        id: "channels_api",
        label: "Kanallar & Entegrasyon",
        description: "WhatsApp, sosyal medya kanalları, hazır yanıt şablonları, harici CRM API bağlantıları ve bildirimler.",
        icon: Cable,
        items: [
          {
            id: "channels",
            label: "Kanal Entegrasyonları",
            subtitle: "WhatsApp, Telegram, Meta ve E-Posta",
            icon: Smartphone,
            visible: true
          },
          {
            id: "canned-responses",
            label: "Hızlı Cevaplar",
            subtitle: "Hazır mesaj ve yanıt şablonları",
            icon: FileText,
            visible: hasCannedPermission
          },
          {
            id: "universal-api",
            label: "Evrensel API Sihirbazı",
            subtitle: "Harici CRM & Webhook bağlantıları",
            icon: Cable,
            visible: hasAPIPermission
          },
          {
            id: "email-notifications",
            label: "E-Mail Bildirimleri",
            subtitle: "SMTP uyarı ve sistem bildirimleri",
            icon: Mail,
            visible: true
          }
        ]
      },
      {
        id: "maintenance",
        label: "Bakım & Sistem",
        description: "Sistem yedekleme, anlık geri yükleme noktaları, ses kaydı saklama politikaları ve versiyon geçmişi.",
        icon: HardDrive,
        items: [
          {
            id: "backup",
            label: "Sistem Yedekleme",
            subtitle: "Tam sistem ve veritabanı yedeği",
            icon: HardDrive,
            visible: hasBackupPermission
          },
          {
            id: "restore-points",
            label: "Geri Yükleme Noktası",
            subtitle: "Anlık yapılandırma geri dönüşü",
            icon: RotateCcw,
            visible: true
          },
          {
            id: "recording-retention",
            label: "Kayıt & Saklama Sistemi",
            subtitle: "Ses kaydı arşiv ve engelli IP saklama süresi",
            icon: Database,
            visible: hasRecordingRetentionPermission
          },
          {
            id: "version",
            label: "Sistem Versiyonu & Günlük",
            subtitle: "Sürüm bilgisi ve değişiklik günlüğü",
            icon: GitCommit,
            visible: true
          }
        ]
      }
    ];

    return rawCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.visible)
      }))
      .filter((cat) => cat.items.length > 0);
  }, [
    hasAutoprovTemplatesPermission,
    hasSSLPermission,
    hasSmartCallbackPermission,
    hasWorkHoursPermission,
    hasQAPermission,
    hasAiTaskRoutingPermission,
    hasBioPermission,
    hasRoiSettingsPermission,
    hasCannedPermission,
    hasAPIPermission,
    hasBackupPermission,
    hasRecordingRetentionPermission
  ]);

  // Keep activeCategory synchronized whenever activeSubTab changes (e.g., via URL slug or GlobalSearchBar)
  useEffect(() => {
    const matchedCat = categories.find((cat) =>
      cat.items.some((item) => item.id === activeSubTab)
    );
    if (matchedCat && matchedCat.id !== activeCategory) {
      setActiveCategory(matchedCat.id);
    }
  }, [activeSubTab, categories]);

  const handleCategorySelect = (categoryId) => {
    setActiveCategory(categoryId);
    const targetCat = categories.find((c) => c.id === categoryId);
    if (targetCat && targetCat.items.length > 0) {
      const hasCurrentSubTab = targetCat.items.some((item) => item.id === activeSubTab);
      if (!hasCurrentSubTab) {
        setActiveSubTab(targetCat.items[0].id);
      }
    }
  };

  // WAI-ARIA Tabs keyboard navigation (ArrowRight, ArrowLeft, Home, End)
  const handleCategoryKeyDown = (e, index) => {
    if (!categories.length) return;
    let nextIndex = null;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % categories.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + categories.length) % categories.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = categories.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextCategory = categories[nextIndex];
      handleCategorySelect(nextCategory.id);
      categoryTabRefs.current[nextCategory.id]?.focus();
    }
  };

  const currentCategory =
    categories.find((c) => c.id === activeCategory) || categories[0] || null;
  const activeItemMeta = currentCategory?.items.find((i) => i.id === activeSubTab);

  return (
    <div className="w-full space-y-5">
      {/* Page Title & Active Category Summary Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Settings size={22} aria-hidden="true" className={text} />
            <span>Sistem Ayarları</span>
          </h2>
          <InfoTooltip
            title={currentCategory ? currentCategory.label : "Sistem Ayarları"}
            text={
              currentCategory
                ? currentCategory.description
                : "Asterisk santral, yapay zeka entegrasyonu, çoklu kanal ve sistem bakım yapılandırmaları."
            }
          />
        </div>

        {/* Breadcrumb Pill showing Current Category -> Active Module */}
        {currentCategory && activeItemMeta && (
          <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 shadow-sm shrink-0">
            <span>{currentCategory.label}</span>
            <ChevronRight size={13} aria-hidden="true" className="text-slate-400" />
            <span className={"font-bold " + text}>{activeItemMeta.label}</span>
          </div>
        )}
      </div>

      {/* Top Horizontal Category Tab Bar */}
      <div
        role="tablist"
        aria-label="Sistem ayar kategorileri"
        className={
          "w-full p-1.5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar " +
          borderLight
        }
      >
        {categories.map((cat, idx) => {
          const CatIcon = cat.icon;
          const isSelected = currentCategory?.id === cat.id;
          return (
            <button
              key={cat.id}
              ref={(el) => {
                categoryTabRefs.current[cat.id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-cat-tab-${cat.id}`}
              aria-selected={isSelected}
              aria-controls={`settings-cat-panel-${cat.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleCategorySelect(cat.id)}
              onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
              className={
                "flex-1 min-w-fit flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (isSelected
                  ? `${bg} text-white shadow-sm`
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60")
              }
            >
              <CatIcon
                size={15}
                aria-hidden="true"
                className={isSelected ? "text-white" : "text-slate-400 dark:text-slate-500"}
              />
              <span>{cat.label}</span>
              <span
                className={
                  "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none transition-colors " +
                  (isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")
                }
              >
                {cat.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Content Area: Scoped Left Sub-Navigation + Right Setting Module */}
      {currentCategory && (
        <div
          role="tabpanel"
          id={`settings-cat-panel-${currentCategory.id}`}
          aria-labelledby={`settings-cat-tab-${currentCategory.id}`}
          className="flex flex-col md:flex-row gap-6 items-start w-full"
        >
          {/* Left Side Scoped Sub-Tab Menu */}
          <nav
            aria-label={`${currentCategory.label} modülleri`}
            className={
              "w-full md:w-64 lg:w-72 shrink-0 p-2.5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm space-y-1.5 " +
              borderLight
            }
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
              <div className="flex items-center gap-2">
                {(() => {
                  const HeaderIcon = currentCategory.icon;
                  return <HeaderIcon size={14} aria-hidden="true" className={text} />;
                })()}
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {currentCategory.label}
                </span>
              </div>
            </div>

            {currentCategory.items.map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <div
                  key={item.id}
                  className={
                    "w-full flex items-center gap-2 pr-2.5 rounded-xl transition-all duration-200 border " +
                    (isActive
                      ? `${lightBg} ${text} border-primary/25 shadow-sm`
                      : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50")
                  }
                >
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => switchSettingsSubTab(item.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 pl-3 pr-1 py-2 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div
                      className={
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors " +
                        (isActive
                          ? `${bg} text-white shadow-sm`
                          : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400")
                      }
                    >
                      <ItemIcon size={14} aria-hidden="true" />
                    </div>
                    <span
                      className={
                        "text-xs font-bold truncate " +
                        (isActive ? text : "text-slate-700 dark:text-slate-200")
                      }
                    >
                      {item.label}
                    </span>
                  </button>
                  {item.subtitle && (
                    <InfoTooltip
                      title={item.label}
                      text={item.subtitle}
                      className="ml-0"
                    />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Side Settings Panel Area */}
          <div
            ref={subPanelStageRef}
            key={activeSubTab}
            className="flex-1 min-w-0 w-full flex flex-col gap-6 aida-panel-enter"
          >
            {activeSubTab === "pbx" && <PBXSettings backendHost={backendHost} />}
            {activeSubTab === "nat" && <NATSettings backendHost={backendHost} />}
            {activeSubTab === "numbering-plan" && (
              <NumberingPlanPanel backendHost={backendHost} />
            )}
            {activeSubTab === "lang-detect" && (
              <LanguageDetectionSettings backendHost={backendHost} />
            )}
            {activeSubTab === "emotion-management" && (
              <EmotionManagementSettings backendHost={backendHost} />
            )}
            {activeSubTab === "whisper-management" && (
              <WhisperSettings backendHost={backendHost} />
            )}
            {activeSubTab === "channels" && <ChannelSettings backendHost={backendHost} />}
            {activeSubTab === "breaks" && <BreakDefinitions backendHost={backendHost} />}
            {activeSubTab === "work-hours" && <WorkHoursSettingsPanel backendHost={backendHost} />}
            {activeSubTab === "roles" && <RoleSettings backendHost={backendHost} />}
            {activeSubTab === "canned-responses" && (
              <CannedResponsesSettings backendHost={backendHost} />
            )}
            {activeSubTab === "qa" && <QASettings backendHost={backendHost} />}
            {activeSubTab === "universal-api" && (
              <UniversalAPISettings backendHost={backendHost} />
            )}
            {activeSubTab === "voice-biometrics" && (
              <VoiceBiometricsSettings backendHost={backendHost} />
            )}
            {activeSubTab === "autoprovision-templates" && (
              <AutoprovisionTemplatesPanel backendHost={backendHost} />
            )}
            {activeSubTab === "locations" && (
              <LocationsDepartmentsPanel backendHost={backendHost} />
            )}
            {activeSubTab === "roi-settings" && <RoiSettings backendHost={backendHost} />}
            {activeSubTab === "ssl" && <SSLSettings backendHost={backendHost} />}
            {activeSubTab === "smart-callback" && (
              <SmartCallbackSettings backendHost={backendHost} />
            )}
            {activeSubTab === "backup" && <BackupRestorePanel backendHost={backendHost} />}
            {activeSubTab === "recording-retention" && (
              <RecordingRetentionSettings backendHost={backendHost} />
            )}
            {activeSubTab === "ai-providers" && (
              <AIProvidersSettings backendHost={backendHost} />
            )}
            {activeSubTab === "ai-task-routing" && (
              <AITaskRoutingSettings backendHost={backendHost} />
            )}
            {activeSubTab === "tenants" && (
              <TenantManagementPanel backendHost={backendHost} />
            )}
            {activeSubTab === "license" && (
              <LicenseSettingsPanel backendHost={backendHost} />
            )}
            {activeSubTab === "email-notifications" && (
              <EmailNotificationsPanel backendHost={backendHost} />
            )}
            {activeSubTab === "restore-points" && (
              <RestorePointsPanel backendHost={backendHost} />
            )}
            {activeSubTab === "version" && <ChangelogPanel backendHost={backendHost} />}
          </div>
        </div>
      )}
    </div>
  );
}
