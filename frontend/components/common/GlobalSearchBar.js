import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  Phone,
  PhoneCall,
  MessageSquare,
  User,
  Users,
  Settings,
  Bot,
  GitBranch,
  Database,
  Sliders,
  Calendar,
  Activity,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Server,
  Cable,
  Volume2,
  ClipboardList,
  BookOpen,
  Award,
  TrendingUp,
  Layers,
  Terminal,
  Lock,
  Coffee,
  Building2,
  Network,
  HardDrive,
  Mail,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  LayoutGrid,
  List,
  ArrowRight,
  Sparkles,
  PhoneForwarded,
  Clock
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getTurkishSlugForSubtab } from "../../utils/slugHelper";
import { webphoneManager } from "../../utils/webphoneManager";
import DictationButton from "./DictationButton";

export default function GlobalSearchBar({
  backendHost = "localhost:8000",
  currentUser,
  activeTab,
  setActiveTab,
  onOpenProfileModal,
  onQuickProfileSwitch,
  onToggleTheme,
  isDarkMode,
  onApplyChanges,
  hasPendingChanges,
  onLogout,
  onUpdateCallPanelPrefs
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all"); // "all" | "menu" | "action" | "user" | "contact"

  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [queues, setQueues] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  // Global keyboard shortcut: Cmd+K or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch system users, contacts, queues, and AI agents when opened or mounted
  const fetchSearchEntities = async () => {
    try {
      const [usersRes, contactsRes, queuesRes, agentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/settings/users`).catch(() => null),
        fetch(`${API_BASE}/api/contacts`).catch(() => null),
        fetch(`${API_BASE}/api/settings/queues`).catch(() => null),
        fetch(`${API_BASE}/api/settings/ai-agents`).catch(() => null)
      ]);

      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(Array.isArray(uData) ? uData : []);
      }
      if (contactsRes && contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(Array.isArray(cData) ? cData : []);
      }
      if (queuesRes && queuesRes.ok) {
        const qData = await queuesRes.json();
        setQueues(Array.isArray(qData) ? qData : qData?.queues || []);
      }
      if (agentsRes && agentsRes.ok) {
        const aData = await agentsRes.json();
        setAiAgents(Array.isArray(aData) ? aData : aData?.ai_agents || []);
      }
    } catch (e) {
      // ignore background fetch errors
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSearchEntities();
    }
  }, [isOpen, API_BASE]);

  // Navigate to a main tab, and optionally a subtab inside AgentPanel or SettingsPanel
  const navigateTo = (tabId, options = {}) => {
    setActiveTab(tabId);
    if (options.agentPanelSubTab && typeof window !== "undefined") {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("SWITCH_AGENT_PANEL_SUBTAB", {
            detail: { subTab: options.agentPanelSubTab }
          })
        );
      }, 30);
    }
    if (options.settingsSubTab && typeof window !== "undefined") {
      const turkishSubtab = getTurkishSlugForSubtab(options.settingsSubTab);
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set("subtab", turkishSubtab);
      window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("SWITCH_SETTINGS_SUBTAB", {
            detail: { subTab: options.settingsSubTab }
          })
        );
      }, 30);
    }
    setIsOpen(false);
    setQuery("");
  };

  const handleDirectCall = (targetNumber) => {
    if (!targetNumber) return;
    const cleanNum = String(targetNumber).trim();
    navigateTo("call-center", { agentPanelSubTab: "webphone" });
    setTimeout(() => {
      webphoneManager.setDialNumber(cleanNum);
      webphoneManager.startCall(cleanNum);
    }, 80);
  };

  // Static catalog of all system menus, sub-panels, reports, and quick actions
  const staticCatalog = useMemo(() => {
    return [
      // --- OPERASYON & İLETİŞİM ---
      {
        id: "menu-dashboard",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Canlı Çağrı Ekranı (Ana Pano)",
        subtitle: "Aktif çağrılar, anlık santral trafiği ve canlı izleme",
        keywords: "canlı çağrı ekranı ana sayfa dashboard pano aktif görüşmeler",
        icon: Activity,
        run: () => navigateTo("dashboard")
      },
      {
        id: "menu-call-center",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Pano",
        subtitle: "Günlük çağrı istatistikleri, mola süreleri ve performans özeti",
        keywords: "temsilci çağrı paneli pano agent istatistik mola süresi",
        icon: PhoneCall,
        run: () => navigateTo("call-center", { agentPanelSubTab: "dashboard" })
      },
      {
        id: "menu-call-center-webphone",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > WebPhone (Telefon)",
        subtitle: "WebRTC telefon ekranı, tuş takımı, aktarma ve konferans",
        keywords: "webphone telefon arama yap tuş takımı dahili ara konferans transfer",
        icon: Phone,
        run: () => navigateTo("call-center", { agentPanelSubTab: "webphone" })
      },
      {
        id: "menu-call-center-agents",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Temsilciler",
        subtitle: "Kuyruktaki diğer temsilcilerin canlı durumu, mola ve çağrı süreleri",
        keywords: "temsilciler kuyruk arkadaşlar canlı durum müsait molada meşgul",
        icon: Users,
        run: () => navigateTo("call-center", { agentPanelSubTab: "agents" })
      },
      {
        id: "menu-call-center-speeddial",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Hızlı Arama",
        subtitle: "Kişisel ve kurumsal hızlı arama kısayolları",
        keywords: "hızlı arama speed dial kısayol",
        icon: Sparkles,
        run: () => navigateTo("call-center", { agentPanelSubTab: "speeddial" })
      },
      {
        id: "menu-call-center-missed",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Kayıp Çağrılar",
        subtitle: "Cevapsız kalan çağrılar ve hızlı geri dönüş listesi",
        keywords: "kayıp çağrı cevapsız aramalar missed calls",
        icon: ShieldAlert,
        run: () => navigateTo("call-center", { agentPanelSubTab: "missed" })
      },
      {
        id: "menu-call-center-contacts",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Rehber",
        subtitle: "Temsilci rehberi, dahili durum LED'leri ve tek tıkla transfer",
        keywords: "temsilci rehber kişi ara dahili rehber",
        icon: BookOpen,
        run: () => navigateTo("call-center", { agentPanelSubTab: "contacts" })
      },
      {
        id: "menu-call-center-history",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Çağrı Geçmişi",
        subtitle: "Geçmiş aramalarım, ses kayıtları ve pickup detayları",
        keywords: "çağrı geçmişi aramalarım ses kaydı dinle",
        icon: Clock,
        run: () => navigateTo("call-center", { agentPanelSubTab: "history" })
      },
      {
        id: "menu-call-center-voicemail",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Sesli Posta",
        subtitle: "Bırakılan sesli mesajlar ve ses kayıtları",
        keywords: "sesli posta voicemail mesaj",
        icon: Volume2,
        run: () => navigateTo("call-center", { agentPanelSubTab: "voicemail" })
      },
      {
        id: "menu-call-center-chat",
        category: "menu",
        groupLabel: "Temsilci Çağrı Paneli",
        title: "Temsilci Çağrı Paneli > Takım İçi Sohbet & Mesajlaşma",
        subtitle: "Personel arası iç yazışma ve bana atanan müşteri sohbetleri",
        keywords: "sohbet iç yazışma chat mesajlaşma dikte",
        icon: MessageSquare,
        run: () => navigateTo("call-center", { agentPanelSubTab: "chat" })
      },
      {
        id: "menu-omnichannel",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Omnichannel Mesajlaşma Merkezi",
        subtitle: "WhatsApp, Telegram, Instagram, Messenger ve E-Posta sohbetleri",
        keywords: "omnichannel whatsapp telegram instagram facebook e-posta canlı destek toplu mesaj",
        icon: MessageSquare,
        run: () => navigateTo("omnichannel")
      },
      {
        id: "menu-contacts",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Rehber Yönetimi (Müşteri & Kişiler)",
        subtitle: "Kurumsal telefon rehberi, kişi ekleme ve düzenleme",
        keywords: "rehber kişiler müşteri telefon defteri kişi ekle",
        icon: BookOpen,
        run: () => navigateTo("contacts")
      },
      {
        id: "menu-calendar",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Randevu Takvimi",
        subtitle: "AI ve temsilciler tarafından oluşturulan randevular",
        keywords: "randevu takvim ajanda",
        icon: Calendar,
        run: () => navigateTo("calendar")
      },
      {
        id: "menu-dialer",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Otomatik Arama (Kampanya & Dialer)",
        subtitle: "Toplu sesli arama kampanyaları ve otomatik dış arama",
        keywords: "otomatik arama dialer kampanya dış arama",
        icon: PhoneCall,
        run: () => navigateTo("dialer")
      },
      {
        id: "menu-wallboard",
        category: "menu",
        groupLabel: "Menü & Ekranlar",
        title: "Wallboard (TV / Dev Ekran Canlı Pano)",
        subtitle: "Çağrı merkezi büyük ekran canlı kuyruk ve SLA göstergesi",
        keywords: "wallboard tv ekran canlı pano sla",
        icon: TrendingUp,
        run: () => navigateTo("wallboard")
      },

      // --- YAPAY ZEKA & OTOMASYON ---
      {
        id: "menu-ai-agents",
        category: "menu",
        groupLabel: "Yapay Zeka & Otomasyon",
        title: "AI Ajanları & Görsel Senaryo Tasarımı",
        subtitle: "Sesli yapay zeka asistanları, prompt ve diyalog akışı yönetimi",
        keywords: "ai ajanları yapay zeka asistan senaryo tasarım gemini sesli bot",
        icon: Bot,
        run: () => navigateTo("ai-agents")
      },
      {
        id: "menu-call-flow",
        category: "menu",
        groupLabel: "Yapay Zeka & Otomasyon",
        title: "Çağrı Akışı (IVR & Karşılama Tasarımcısı)",
        subtitle: "Sürükle-bırak görsel santral çağrı akışı ve IVR menüleri",
        keywords: "çağrı akışı ivr menü tasarım karşılama",
        icon: GitBranch,
        run: () => navigateTo("call-flow")
      },
      {
        id: "menu-rag-kb",
        category: "menu",
        groupLabel: "Yapay Zeka & Otomasyon",
        title: "Bilgi Bankası (RAG & Doküman Eğitimi)",
        subtitle: "Web sitesi tarama, PDF/doküman yükleme ve AI bilgi havuzu",
        keywords: "bilgi bankası rag doküman pdf web sitesi eğitim",
        icon: Database,
        run: () => navigateTo("rag-kb")
      },
      {
        id: "menu-rule-editor",
        category: "menu",
        groupLabel: "Yapay Zeka & Otomasyon",
        title: "Kurallar & Otomasyon Aksiyonları",
        subtitle: "Anahtar kelime, duygu durumu ve aksiyon kuralları",
        keywords: "kurallar otomasyon aksiyon yasaklı kelime",
        icon: Sliders,
        run: () => navigateTo("rule-editor")
      },

      // --- SANTRAL (PBX) & ABONELER ---
      {
        id: "menu-users",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Aboneler / Kullanıcılar (Dahili Yönetimi)",
        subtitle: "Dahili numaralar, kullanıcılar, SIP şifreleri ve yönlendirmeler",
        keywords: "aboneler kullanıcılar dahililer personel ekle yeni kullanıcı",
        icon: User,
        run: () => navigateTo("users")
      },
      {
        id: "menu-subscriber-groups",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Abone Grupları",
        subtitle: "Departman ve abone çağrı grupları yönetimi",
        keywords: "abone grupları departman grup",
        icon: Users,
        run: () => navigateTo("subscriber-groups")
      },
      {
        id: "menu-pickup-groups",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Çağrı Yakalama (Pickup) Grupları",
        subtitle: "Çalan telefonu uzaktan çekme (**dahili) yetki grupları",
        keywords: "çağrı yakalama çekme pickup grupları",
        icon: PhoneCall,
        run: () => navigateTo("call-pickup-groups")
      },
      {
        id: "menu-acd-queues",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Çağrı Kuyrukları (ACD Queues)",
        subtitle: "Kuyruk stratejileri, temsilci atamaları ve bekleme müzikleri",
        keywords: "kuyruklar acd queues çağrı kuyruğu",
        icon: Users,
        run: () => navigateTo("acd-queues")
      },
      {
        id: "menu-announcements",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Karşılama Anonsları & Ses Dosyaları",
        subtitle: "Santral ses kayıtları, IVR anonsları ve TTS seslendirme",
        keywords: "anonslar karşılama ses dosyaları müzik",
        icon: Volume2,
        run: () => navigateTo("announcements")
      },
      {
        id: "menu-conferences",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Konferans Odaları",
        subtitle: "Çoklu sesli toplantı ve konferans odası numaraları",
        keywords: "konferans odaları toplantı",
        icon: Users,
        run: () => navigateTo("conferences")
      },
      {
        id: "menu-speed-dial",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Hızlı Arama Kodları",
        subtitle: "Santral genelinde tanımlı hızlı arama kısayol numaraları",
        keywords: "hızlı arama kodları kısayol",
        icon: Sparkles,
        run: () => navigateTo("speed-dial")
      },
      {
        id: "menu-auto-provision",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Otoprovizyon (IP Telefon Kurulumu)",
        subtitle: "MAC adresi ile IP masa telefonlarını otomatik yapılandırma",
        keywords: "otoprovizyon autoprovision ip telefon mac",
        icon: Server,
        run: () => navigateTo("auto-provision")
      },
      {
        id: "menu-blacklist",
        category: "menu",
        groupLabel: "Santral & Abone Yönetimi",
        title: "Kara Liste (Numara Engelleme)",
        subtitle: "İstenmeyen arayan numaraları engelleme listesi",
        keywords: "kara liste engelli numaralar blacklist numara engelle",
        icon: ShieldAlert,
        run: () => navigateTo("blacklist")
      },

      // --- HATLAR & YÖNLENDİRME ---
      {
        id: "menu-trunks",
        category: "menu",
        groupLabel: "Hatlar & Yönlendirme",
        title: "Dış Hatlar (SIP Trunk Yönetimi)",
        subtitle: "Operatör SIP trunk bağlantıları (0850, sabit hatlar)",
        keywords: "dış hatlar sip trunk operatör pjsip",
        icon: Cable,
        run: () => navigateTo("trunks")
      },
      {
        id: "menu-inbound-rules",
        category: "menu",
        groupLabel: "Hatlar & Yönlendirme",
        title: "Gelen Arama Kuralları (DID Yönlendirme)",
        subtitle: "Dış hatlardan gelen çağrıların kuyruk, IVR veya AI'ya yönlendirilmesi",
        keywords: "gelen arama kuralları inbound did yönlendirme",
        icon: PhoneForwarded,
        run: () => navigateTo("inbound-rules")
      },
      {
        id: "menu-outbound-rules",
        category: "menu",
        groupLabel: "Hatlar & Yönlendirme",
        title: "Giden Arama Kuralları (Outbound Routes)",
        subtitle: "Dış aramalarda kullanılacak trunk ve numara çevirimi kuralları",
        keywords: "giden arama kuralları outbound dış arama",
        icon: PhoneCall,
        run: () => navigateTo("outbound-rules")
      },

      // --- RAPORLAR & ANALİTİK ---
      {
        id: "menu-reports-cdr",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "CDR Çağrı Detay Kayıtları",
        subtitle: "Tüm gelen, giden, cevapsız ve pickup ile çekilen çağrıların listesi",
        keywords: "cdr çağrı kayıtları geçmiş raporlar arayan aranan pickup",
        icon: ClipboardList,
        run: () => navigateTo("reports-cdr")
      },
      {
        id: "menu-reports-audio",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Ses Kayıtları Arşivi",
        subtitle: "Görüşme ses kayıtlarını dinleme ve indirme ekranı",
        keywords: "ses kayıtları dinle indir arşiv",
        icon: Volume2,
        run: () => navigateTo("reports-audio")
      },
      {
        id: "menu-reports-transcripts",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Görüşme Dökümleri (Transkriptler)",
        subtitle: "AI ve temsilci telefon görüşmelerinin yazılı metin dökümleri",
        keywords: "görüşme dökümleri transkript metin özet",
        icon: FileText,
        run: () => navigateTo("reports-transcripts")
      },
      {
        id: "menu-reports-perf",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Temsilci Performans Raporları",
        subtitle: "Temsilci bazlı çağrı sayıları, konuşma ve mola süreleri",
        keywords: "temsilci performans raporu mola raporu",
        icon: Award,
        run: () => navigateTo("reports-perf")
      },
      {
        id: "menu-reports-queue",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Kuyruk (ACD) Raporları",
        subtitle: "Kuyruk bekleme süreleri, cevaplanma oranı ve SLA analizi",
        keywords: "kuyruk raporları acd sla bekleme süresi",
        icon: Users,
        run: () => navigateTo("reports-queue")
      },
      {
        id: "menu-reports-qa",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Çağrı Kalite (QA) Değerlendirme Raporları",
        subtitle: "Yapay zeka destekli çağrı puanlama ve kalite kontrol sonuçları",
        keywords: "kalite kontrol qa puanlama rapor",
        icon: ShieldCheck,
        run: () => navigateTo("reports-qa")
      },
      {
        id: "menu-reports-ceo",
        category: "menu",
        groupLabel: "Raporlar & Analitik",
        title: "Yönetici / CEO Özet Raporu",
        subtitle: "Üst yönetim için finansal, operasyonel ve AI verimlilik özeti",
        keywords: "ceo özeti yönetici raporu pano",
        icon: TrendingUp,
        run: () => navigateTo("reports-ceo-summary")
      },

      // --- SİSTEM AYARLARI & GÜVENLİK ---
      {
        id: "menu-settings-pbx",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Santral Entegrasyonu",
        subtitle: "Asterisk AMI, PJSIP ve temel santral bağlantı parametreleri",
        keywords: "sistem ayarları santral entegrasyonu asterisk ami",
        icon: Settings,
        run: () => navigateTo("settings", { settingsSubTab: "pbx" })
      },
      {
        id: "menu-settings-nat",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > NAT ve Dış IP Ayarları",
        subtitle: "Statik WAN IP, yerel ağ (localnet) ve RTP medya adres ayarları",
        keywords: "nat dış ip wan rtp ses sorunu pjsip",
        icon: Network,
        run: () => navigateTo("settings", { settingsSubTab: "nat" })
      },
      {
        id: "menu-settings-roles",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Roller ve Yetkiler",
        subtitle: "Kullanıcı rolleri, ekran izinleri ve temsilci çağrı paneli yetkileri",
        keywords: "roller yetkiler izinler admin süpervizör temsilci yetki",
        icon: ShieldCheck,
        run: () => navigateTo("settings", { settingsSubTab: "roles" })
      },
      {
        id: "menu-settings-breaks",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Mola Tanımları",
        subtitle: "Yemek molası, ihtiyaç molası ve özel mola türlerini yönetin",
        keywords: "mola tanımları yemek molası mola ekle",
        icon: Coffee,
        run: () => navigateTo("settings", { settingsSubTab: "breaks" })
      },
      {
        id: "menu-settings-channels",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Kanal Entegrasyonları",
        subtitle: "WhatsApp Cloud API, Telegram Bot, Instagram ve E-Posta kurulumu",
        keywords: "kanal entegrasyonları whatsapp token meta telegram",
        icon: MessageSquare,
        run: () => navigateTo("settings", { settingsSubTab: "channels" })
      },
      {
        id: "menu-settings-canned",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Hızlı Cevaplar (Şablonlar)",
        subtitle: "Sohbet ekranlarında / kısayolu ile kullanılan hazır mesajlar",
        keywords: "hızlı cevaplar hazır mesaj şablon",
        icon: FileText,
        run: () => navigateTo("settings", { settingsSubTab: "canned-responses" })
      },
      {
        id: "menu-settings-tenants",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Müşteri (Tenant) Yönetimi",
        subtitle: "Çoklu müşteri (Multi-Tenant) oluşturma ve izolasyon yönetimi",
        keywords: "müşteri tenant yönetimi firma ekle",
        icon: Building2,
        run: () => navigateTo("settings", { settingsSubTab: "tenants" })
      },
      {
        id: "menu-settings-license",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Lisans & Key Yönetimi",
        subtitle: "Donanım kilidi (Hardware ID) ve kriptografik lisans anahtarı",
        keywords: "lisans key anahtar donanım id süre uzatma",
        icon: Lock,
        run: () => navigateTo("settings", { settingsSubTab: "license" })
      },
      {
        id: "menu-settings-backup",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > Sistem Yedekleme & Geri Yükleme",
        subtitle: "Veritabanı ve santral ayarlarını yedekleme / geri yükleme",
        keywords: "yedekleme backup geri yükleme restore",
        icon: HardDrive,
        run: () => navigateTo("settings", { settingsSubTab: "backup" })
      },
      {
        id: "menu-settings-email",
        category: "menu",
        groupLabel: "Sistem Ayarları",
        title: "Sistem Ayarları > E-Mail Bildirimleri",
        subtitle: "SMTP sunucu ayarları ve sistem uyarı e-postaları",
        keywords: "email e-posta bildirim smtp",
        icon: Mail,
        run: () => navigateTo("settings", { settingsSubTab: "email-notifications" })
      },
      {
        id: "menu-sip-debugger",
        category: "menu",
        groupLabel: "Sistem & Güvenlik",
        title: "SIP Trafik İnceleme (Web sngrep & PCAP)",
        subtitle: "Canlı SIP paket akışı, sinyal diyagramı ve Wireshark PCAP indirme",
        keywords: "sip trafik sngrep pcap wireshark paket inceleme",
        icon: Terminal,
        run: () => navigateTo("sip-debugger")
      },
      {
        id: "menu-security",
        category: "menu",
        groupLabel: "Sistem & Güvenlik",
        title: "Güvenlik Kalkanı (Firewall & Fail2ban)",
        subtitle: "Saldırı engelleme, IP ban listesi ve SIP güvenlik duvarı",
        keywords: "güvenlik kalkanı firewall ip engelleme saldırı",
        icon: ShieldAlert,
        run: () => navigateTo("security")
      },
      {
        id: "menu-event-logs",
        category: "menu",
        groupLabel: "Sistem & Güvenlik",
        title: "Sistem Logları (Olay Günlüğü)",
        subtitle: "Kullanıcı işlemleri, denetim kayıtları ve sistem hataları",
        keywords: "sistem logları olay günlüğü audit log",
        icon: ClipboardList,
        run: () => navigateTo("event-logs")
      },
      {
        id: "menu-system-status",
        category: "menu",
        groupLabel: "Sistem & Güvenlik",
        title: "Sistem Durumu & Sunucu Kaynakları",
        subtitle: "CPU, RAM, Disk kullanımı ve servislerin çalışma durumu",
        keywords: "sistem durumu sunucu cpu ram disk",
        icon: Server,
        run: () => navigateTo("system-status")
      },
      {
        id: "menu-changelog",
        category: "menu",
        groupLabel: "Sistem & Güvenlik",
        title: "Sistem Versiyonu & Değişiklik Günlüğü",
        subtitle: "Yüklü sürüm bilgisi ve güncelleme geçmişi",
        keywords: "versiyon sürüm değişiklik günlüğü changelog",
        icon: RotateCcw,
        run: () => navigateTo("changelog")
      },

      // --- HIZLI İŞLEMLER & KİŞİSEL AYARLAR ---
      {
        id: "action-profile-theme",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Profil & Tema Rengi Ayarlarını Aç",
        subtitle: "Avatar, GSM numarası, zil sesi ve arayüz tema rengini değiştir",
        keywords: "profil ayarları tema rengi avatar zil sesi değiştir",
        icon: Settings,
        run: () => {
          onOpenProfileModal?.("profile");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-profile-call-panel",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Çağrı Paneli Görünüm ve Sekme Sıralaması Ayarlarını Aç",
        subtitle: "Temsilci ekranını Liste / Kutucuk (Büyük-Küçük) yap veya sekmeleri sırala",
        keywords: "çağrı paneli görünüm özelleştir liste kutucuk büyük küçük sıralama",
        icon: LayoutGrid,
        run: () => {
          onOpenProfileModal?.("call_panel");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-view-mode-list",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Temsilci Ekranını Liste Görünümüne Geçir",
        subtitle: "Çağrı paneli ve temsilciler ekranını anında Liste düzenine alır",
        keywords: "liste görünümü yap temsilci ekranı liste",
        icon: List,
        run: () => {
          onUpdateCallPanelPrefs?.({ viewMode: "list" });
          navigateTo("call-center");
        }
      },
      {
        id: "action-view-mode-box-large",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Temsilci Ekranını Büyük Kutucuk Görünümüne Geçir",
        subtitle: "Çağrı paneli ve temsilciler ekranını Büyük Kutucuk düzenine alır",
        keywords: "büyük kutucuk görünümü yap kart görünümü",
        icon: LayoutGrid,
        run: () => {
          onUpdateCallPanelPrefs?.({ viewMode: "box", boxSize: "large" });
          navigateTo("call-center");
        }
      },
      {
        id: "action-view-mode-box-small",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Temsilci Ekranını Küçük Kutucuk Görünümüne Geçir",
        subtitle: "Çağrı paneli ve temsilciler ekranını Küçük Kutucuk düzenine alır",
        keywords: "küçük kutucuk görünümü yap kompakt kutucuk",
        icon: LayoutGrid,
        run: () => {
          onUpdateCallPanelPrefs?.({ viewMode: "box", boxSize: "small" });
          navigateTo("call-center");
        }
      },
      {
        id: "action-profile-forwarding",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Çağrı Yönlendirme Ayarlarını Aç",
        subtitle: "Her zaman, meşgulde ve cevapsız durumda yönlendirme hedefleri",
        keywords: "yönlendirme ayarları çağrı yönlendir cep telefonu",
        icon: PhoneForwarded,
        run: () => {
          onOpenProfileModal?.("forwarding");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-profile-hardware",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Mikrofon ve Hoparlör (Ses Donanımı) Ayarlarını Aç",
        subtitle: "WebRTC telefon ve dikte için mikrofon/hoparlör cihaz seçimi",
        keywords: "mikrofon hoparlör ses ayarları donanım kulaklık",
        icon: Volume2,
        run: () => {
          onOpenProfileModal?.("hardware");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-profile-security",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Şifre Değiştir & Güvenlik Ayarlarını Aç",
        subtitle: "Hesap şifresi yenileme, otomatik çıkış ve 2FA ayarları",
        keywords: "şifre değiştir parola güvenlik 2fa otomatik çıkış",
        icon: Lock,
        run: () => {
          onOpenProfileModal?.("security");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-status-available",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Durumumu 'Müsait' Olarak Değiştir",
        subtitle: "Aktif çağrı profilini anında Müsait durumuna geçirir",
        keywords: "durum müsait yap profil müsait çevrimiçi",
        icon: User,
        run: () => {
          onQuickProfileSwitch?.("available");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-status-away",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Durumumu 'Dışarıda' Olarak Değiştir",
        subtitle: "Aktif çağrı profilini anında Dışarıda durumuna geçirir",
        keywords: "durum dışarıda yap mola uzak",
        icon: Clock,
        run: () => {
          onQuickProfileSwitch?.("away");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-status-meeting",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Durumumu 'Toplantı' Olarak Değiştir",
        subtitle: "Aktif çağrı profilini anında Toplantı durumuna geçirir",
        keywords: "durum toplantı yap meşgul",
        icon: Users,
        run: () => {
          onQuickProfileSwitch?.("meeting");
          setIsOpen(false);
          setQuery("");
        }
      },
      {
        id: "action-toggle-darkmode",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: isDarkMode ? "Aydınlık Moda Geç (Light Mode)" : "Karanlık Moda Geç (Dark Mode)",
        subtitle: "Ekran gece/gündüz görünüm modunu anında değiştirir",
        keywords: "karanlık mod aydınlık mod gece modu dark mode light mode",
        icon: isDarkMode ? Sun : Moon,
        run: () => {
          onToggleTheme?.();
          setIsOpen(false);
          setQuery("");
        }
      },
      ...(hasPendingChanges && currentUser?.role === "admin"
        ? [
            {
              id: "action-apply-changes",
              category: "action",
              groupLabel: "Hızlı İşlemler & Profil Ayarları",
              title: "Bekleyen Santral Ayarlarını Şimdi Uygula",
              subtitle: "Yapılan PJSIP ve dialplan değişikliklerini Asterisk'e uygular",
              keywords: "uygula değişiklikleri kaydet senkronize et",
              icon: Layers,
              run: () => {
                onApplyChanges?.();
                setIsOpen(false);
                setQuery("");
              }
            }
          ]
        : []),
      {
        id: "action-logout",
        category: "action",
        groupLabel: "Hızlı İşlemler & Profil Ayarları",
        title: "Oturumu Kapat (Çıkış Yap)",
        subtitle: "Mevcut kullanıcı oturumunu sonlandırır",
        keywords: "çıkış yap oturumu kapat logout",
        icon: LogOut,
        run: () => {
          setIsOpen(false);
          setQuery("");
          onLogout?.();
        }
      }
    ];
  }, [isDarkMode, hasPendingChanges, currentUser?.role]);

  // Build combined & filtered results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];

    // 1. If query looks like a dialable phone number or extension (digits >= 3), offer direct call action first
    const digitsOnly = q.replace(/\D/g, "");
    if (digitsOnly.length >= 3 && (activeCategoryFilter === "all" || activeCategoryFilter === "action")) {
      list.push({
        id: `direct-dial-${digitsOnly}`,
        category: "action",
        groupLabel: "Doğrudan Arama İşlemi",
        title: `${digitsOnly} Numarasını Hemen Ara`,
        subtitle: "WebPhone üzerinden doğrudan sesli çağrı başlat",
        icon: PhoneCall,
        badge: "Hemen Ara",
        run: () => handleDirectCall(digitsOnly)
      });
    }

    // 2. Match System Users / Extensions
    if (activeCategoryFilter === "all" || activeCategoryFilter === "user") {
      const matchedUsers = users.filter((u) => {
        const name = (u.full_name || u.name || u.username || "").toLowerCase();
        const ext = String(u.extension || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const role = (u.role || "").toLowerCase();
        if (!q) return true;
        return name.includes(q) || ext.includes(q) || email.includes(q) || role.includes(q);
      });

      matchedUsers.slice(0, q ? 8 : 3).forEach((u) => {
        const displayName = u.full_name || u.name || u.username || `Dahili ${u.extension}`;
        const ext = u.extension || "";
        const isOnline = u.status === "online" || u.status === "available";
        const isBusy = u.status === "busy" || u.status === "in_call" || u.status === "ringing";

        list.push({
          id: `user-${u.id || ext}`,
          category: "user",
          groupLabel: "Kullanıcılar & Temsilciler",
          title: `${displayName}${ext ? ` (${ext})` : ""}`,
          subtitle: `${u.role === "admin" ? "Yönetici" : u.role === "supervisor" ? "Süpervizör" : "Temsilci"} • ${
            isBusy ? "Meşgul / Görüşmede" : isOnline ? "Çevrimiçi" : "Çevrimdışı"
          }`,
          statusDot: isBusy ? "bg-rose-500" : isOnline ? "bg-emerald-500" : "bg-slate-400",
          extension: ext,
          icon: User,
          run: () => {
            if (ext) {
              handleDirectCall(ext);
            } else {
              navigateTo("users");
            }
          },
          secondaryActions: [
            ...(ext
              ? [
                  {
                    label: "Ara",
                    icon: Phone,
                    onClick: (e) => {
                      e.stopPropagation();
                      handleDirectCall(ext);
                    }
                  }
                ]
              : []),
            {
              label: "Sohbet",
              icon: MessageSquare,
              onClick: (e) => {
                e.stopPropagation();
                navigateTo("call-center", { agentPanelSubTab: "chat" });
              }
            },
            {
              label: "Yönet",
              icon: Settings,
              onClick: (e) => {
                e.stopPropagation();
                navigateTo("users");
              }
            }
          ]
        });
      });
    }

    // 3. Match Contacts (Rehber)
    if (activeCategoryFilter === "all" || activeCategoryFilter === "contact") {
      const matchedContacts = contacts.filter((c) => {
        if (!q) return false; // Show contacts when user types a search query or selects Rehber filter
        const name = `${c.first_name || ""} ${c.last_name || ""} ${c.name || ""}`.toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        const company = (c.company || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || company.includes(q);
      });

      const contactPool =
        !q && activeCategoryFilter === "contact" ? contacts.slice(0, 8) : matchedContacts.slice(0, 6);

      contactPool.forEach((c) => {
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.name || c.phone || "Kişi";
        const phone = c.phone || "";
        list.push({
          id: `contact-${c.id || phone}`,
          category: "contact",
          groupLabel: "Rehber Kişileri",
          title: fullName,
          subtitle: `${phone}${c.company ? ` • ${c.company}` : ""}`,
          icon: BookOpen,
          run: () => {
            if (phone) handleDirectCall(phone);
            else navigateTo("contacts");
          },
          secondaryActions: [
            ...(phone
              ? [
                  {
                    label: "Ara",
                    icon: Phone,
                    onClick: (e) => {
                      e.stopPropagation();
                      handleDirectCall(phone);
                    }
                  }
                ]
              : []),
            {
              label: "Rehberde Aç",
              icon: ArrowRight,
              onClick: (e) => {
                e.stopPropagation();
                navigateTo("contacts");
              }
            }
          ]
        });
      });
    }

    // 4. Match Dynamic Queues & AI Agents when searching
    if (q && (activeCategoryFilter === "all" || activeCategoryFilter === "menu")) {
      queues
        .filter((item) => {
          const name = (item.name || item.queue_name || "").toLowerCase();
          const num = String(item.extension || item.number || "").toLowerCase();
          return name.includes(q) || num.includes(q);
        })
        .slice(0, 3)
        .forEach((item) => {
          list.push({
            id: `queue-${item.id || item.name}`,
            category: "menu",
            groupLabel: "Çağrı Kuyrukları (ACD)",
            title: `Kuyruk: ${item.name || item.queue_name}`,
            subtitle: `Kuyruk Ayarlarına Git${item.strategy ? ` • Strateji: ${item.strategy}` : ""}`,
            icon: Users,
            run: () => navigateTo("acd-queues")
          });
        });

      aiAgents
        .filter((ag) => {
          const name = (ag.name || "").toLowerCase();
          const role = (ag.role || "").toLowerCase();
          return name.includes(q) || role.includes(q);
        })
        .slice(0, 3)
        .forEach((ag) => {
          list.push({
            id: `ai-agent-${ag.id || ag.name}`,
            category: "menu",
            groupLabel: "AI Ajanları",
            title: `AI Ajanı: ${ag.name}`,
            subtitle: ag.role || "Yapay Zeka Sesli Asistanı",
            icon: Bot,
            run: () => navigateTo("ai-agents")
          });
        });
    }

    // 5. Match Static Catalog (Menus, Subtabs, Reports, Quick Actions)
    const matchedStatic = staticCatalog.filter((item) => {
      if (activeCategoryFilter !== "all" && item.category !== activeCategoryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.title} ${item.subtitle} ${item.keywords || ""} ${item.groupLabel || ""}`.toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });

    list.push(...(q ? matchedStatic : matchedStatic.slice(0, 14)));
    return list;
  }, [query, activeCategoryFilter, users, contacts, queues, aiAgents, staticCatalog]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategoryFilter]);

  const handleInputKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target && target.run) {
        target.run();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl mx-4 z-50">
      {/* Top Header Search Input Bar */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border transition-all duration-200 cursor-text ${
          isOpen
            ? `bg-white dark:bg-slate-900 ${border} ring-2 ${ring} shadow-lg`
            : "bg-slate-100/80 dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
        }`}
      >
        <Search size={15} className={`shrink-0 ${isOpen ? text : "text-slate-400 dark:text-slate-500"}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Menü, ayar, kullanıcı, dahili veya işlem ara... (Ctrl+K)"
          className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors shrink-0"
            title="Temizle"
          >
            <X size={13} />
          </button>
        )}

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DictationButton
            value={query}
            onChange={(val) => {
              setQuery(val);
              if (!isOpen) setIsOpen(true);
            }}
            size="sm"
            className="border-0 bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800"
          />
        </div>

        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shrink-0">
          ⌘K
        </kbd>
      </div>

      {/* Global Search Results Dropdown Modal */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Category Filter Pills */}
          <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: "all", label: "Tümü" },
              { id: "menu", label: "Menüler & Ayarlar" },
              { id: "action", label: "Hızlı İşlemler" },
              { id: "user", label: "Kullanıcılar & Dahililer" },
              { id: "contact", label: "Rehber" }
            ].map((cat) => {
              const isAct = activeCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap transition-all ${
                    isAct
                      ? `${bg} text-white shadow-sm`
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Results List */}
          <div className="max-h-[62vh] overflow-y-auto p-2 space-y-1">
            {results.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-1.5">
                <Search size={24} className="mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  "{query}" ile eşleşen sonuç bulunamadı
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Menü adı, ayar başlığı, kullanıcı ismi, dahili numara veya telefon numarası yazabilirsiniz.
                </p>
              </div>
            ) : (
              results.map((item, idx) => {
                const IconComp = item.icon || Search;
                const isSelected = idx === selectedIndex;
                const prevGroup = idx > 0 ? results[idx - 1].groupLabel : null;
                const showGroupHeader = item.groupLabel && item.groupLabel !== prevGroup;

                return (
                  <React.Fragment key={item.id}>
                    {showGroupHeader && (
                      <div className="px-3 pt-2 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {item.groupLabel}
                      </div>
                    )}
                    <div
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => item.run && item.run()}
                      className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                        isSelected
                          ? `${lightBg} ${border} border`
                          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`p-2 rounded-xl shrink-0 relative ${
                            isSelected
                              ? `${bg} text-white shadow-sm`
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <IconComp size={15} />
                          {item.statusDot && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${item.statusDot}`}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${bg} text-white`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-medium">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons on Row */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {Array.isArray(item.secondaryActions) &&
                          item.secondaryActions.map((act, aIdx) => {
                            const ActIcon = act.icon;
                            return (
                              <button
                                key={aIdx}
                                type="button"
                                onClick={act.onClick}
                                className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-center gap-1 shadow-sm"
                              >
                                {ActIcon && <ActIcon size={11} />}
                                <span>{act.label}</span>
                              </button>
                            );
                          })}
                        <ArrowRight
                          size={14}
                          className={`transition-transform ${
                            isSelected
                              ? `${text} translate-x-0.5`
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Footer Hint Bar */}
          <div className="px-4 py-2 bg-slate-50/90 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <div className="flex items-center gap-3">
              <span>↑↓ Gezin</span>
              <span>↵ Çalıştır / Git</span>
              <span>ESC Kapat</span>
            </div>
            <span>Global Hızlı Erişim & Arama</span>
          </div>
        </div>
      )}
    </div>
  );
}
