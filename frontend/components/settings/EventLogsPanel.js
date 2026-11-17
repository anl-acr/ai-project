import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coffee,
  Edit3,
  Eye,
  FileText,
  Filter,
  Info,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  PlusCircle,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import DateTimePickerInput from "../common/DateTimePickerInput";

const FIELD_LABELS_TR = {
  full_name: "Ad Soyad",
  username: "Kullanıcı Adı",
  extension: "Dahili Numara",
  email: "E-Posta Adresi",
  role: "Rol / Yetki Grubu",
  role_name: "Rol Adı",
  role_code: "Rol Kodu",
  description: "Açıklama",
  gsm_number: "Cep Telefonu (GSM)",
  mobile_transfer_enabled: "Mobil Yönlendirme",
  status: "Durum",
  name: "Kayıt / Kuyruk Adı",
  strategy: "Çalma Stratejisi",
  timeout: "Çalma Süresi (sn)",
  retry: "Tekrar Deneme (sn)",
  wrapuptime: "Çağrı Sonrası Dinlenme (sn)",
  maxlen: "Maksimum Bekleyen Çağrı",
  trunk_name: "Dış Hat (Trunk) Adı",
  host: "SIP Sunucu (Host)",
  port: "Port",
  did_number: "Dış Hat Numarası (DID)",
  max_channels: "Maksimum Kanal",
  first_name: "Ad",
  last_name: "Soyad",
  phone: "Telefon Numarası",
  company: "Firma / Kurum",
  notes: "Notlar",
  number: "Telefon Numarası",
  reason: "Neden / Açıklama",
  word: "Yasaklı Kelime",
  category: "Kategori",
  screen_name: "Görüntülenen Ekran",
  break_name: "Mola Türü",
  endpoint: "İşlem Adresi",
  change_label: "Değişim Türü",
  previous_ip: "Önceki IP Adresi",
  ip_address: "Yeni IP Adresi",
  previous_browser: "Önceki Tarayıcı",
  browser: "Yeni Tarayıcı",
  previous_os: "Önceki İşletim Sistemi",
  os: "Yeni İşletim Sistemi",
  device_key: "Cihaz Anahtarı",
  source: "Giriş Kaynağı",
};

const STRATEGY_LABELS_TR = {
  ringall: "Tümü Çalsın (Ring All)",
  rrmemory: "Sıralı Dağıtım (Round Robin)",
  leastrecent: "En Az Çağrı Alan",
  fewestcalls: "En Az Konuşan",
  random: "Rastgele",
  linear: "Doğrusal Sıra",
};

const formatValueTr = (val) => {
  if (val === null || val === undefined || val === "") return "-";
  if (typeof val === "boolean") return val ? "Aktif (Açık)" : "Pasif (Kapalı)";
  if (typeof val === "string" && STRATEGY_LABELS_TR[val]) return STRATEGY_LABELS_TR[val];
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "-";
  if (typeof val === "object") {
    try {
      if ("active" in val) {
        return val.active ? `Aktif (${val.target || "-"})` : "Kapalı";
      }
      return Object.entries(val)
        .map(([k, v]) => `${FIELD_LABELS_TR[k] || k}: ${v}`)
        .join(", ");
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
};

export default function EventLogsPanel({ backendHost }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterStartTime, setFilterStartTime] = useState("00:00");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEndTime, setFilterEndTime] = useState("23:59");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const eventLogDatePresets = useMemo(() => {
    const fmtYmd = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fmtHm = (d) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const now = new Date();
    const todayStr = fmtYmd(now);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = fmtYmd(yest);
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 6);
    const sevenAgoStr = fmtYmd(sevenAgo);
    const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    return [
      {
        label: "Son 1 Saat",
        isActive: false,
        onSelect: () => {
          const endD = new Date();
          const startD = new Date(endD.getTime() - 60 * 60 * 1000);
          setFilterStartDate(fmtYmd(startD));
          setFilterStartTime(fmtHm(startD));
          setFilterEndDate(fmtYmd(endD));
          setFilterEndTime(fmtHm(endD));
        },
      },
      {
        label: "Bugün",
        isActive:
          filterStartDate === todayStr &&
          filterEndDate === todayStr &&
          filterStartTime === "00:00" &&
          filterEndTime === "23:59",
        onSelect: () => {
          setFilterStartDate(todayStr);
          setFilterStartTime("00:00");
          setFilterEndDate(todayStr);
          setFilterEndTime("23:59");
        },
      },
      {
        label: "Mesai (09:00-18:00)",
        isActive: Boolean(filterStartDate) && filterStartTime === "09:00" && filterEndTime === "18:00",
        onSelect: () => {
          if (!filterStartDate) setFilterStartDate(todayStr);
          if (!filterEndDate) setFilterEndDate(todayStr);
          setFilterStartTime("09:00");
          setFilterEndTime("18:00");
        },
      },
      {
        label: "Dün",
        isActive:
          filterStartDate === yestStr &&
          filterEndDate === yestStr &&
          filterStartTime === "00:00" &&
          filterEndTime === "23:59",
        onSelect: () => {
          setFilterStartDate(yestStr);
          setFilterStartTime("00:00");
          setFilterEndDate(yestStr);
          setFilterEndTime("23:59");
        },
      },
      {
        label: "Son 7 Gün",
        isActive:
          filterStartDate === sevenAgoStr &&
          filterEndDate === todayStr &&
          filterStartTime === "00:00" &&
          filterEndTime === "23:59",
        onSelect: () => {
          setFilterStartDate(sevenAgoStr);
          setFilterStartTime("00:00");
          setFilterEndDate(todayStr);
          setFilterEndTime("23:59");
        },
      },
      {
        label: "Bu Ay",
        isActive:
          filterStartDate === firstOfMonthStr &&
          filterEndDate === todayStr &&
          filterStartTime === "00:00" &&
          filterEndTime === "23:59",
        onSelect: () => {
          setFilterStartDate(firstOfMonthStr);
          setFilterStartTime("00:00");
          setFilterEndDate(todayStr);
          setFilterEndTime("23:59");
        },
      },
      {
        label: "Tüm Zamanlar",
        isActive: !filterStartDate && !filterEndDate,
        onSelect: () => {
          setFilterStartDate("");
          setFilterStartTime("00:00");
          setFilterEndDate("");
          setFilterEndTime("23:59");
        },
      },
    ];
  }, [filterStartDate, filterEndDate, filterStartTime, filterEndTime]);

  const hasActiveFilter = Boolean(
    filterCategory !== "all" ||
      filterModule !== "all" ||
      filterUser !== "all" ||
      searchTerm.trim() ||
      filterStartDate ||
      filterEndDate
  );

  const handleClearFilters = () => {
    setFilterCategory("all");
    setFilterModule("all");
    setFilterUser("all");
    setSearchTerm("");
    setFilterStartDate("");
    setFilterStartTime("00:00");
    setFilterEndDate("");
    setFilterEndTime("23:59");
  };

  const [selectedLog, setSelectedLog] = useState(null);
  const [clientPublicIp, setClientPublicIp] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("client_public_ip") || "" : ""
  );

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let resolvedIp = typeof window !== "undefined" ? localStorage.getItem("client_public_ip") || "" : "";
      if (!resolvedIp || resolvedIp === "127.0.0.1") {
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData?.ip && ipData.ip !== "127.0.0.1") {
              resolvedIp = String(ipData.ip).trim();
              localStorage.setItem("client_public_ip", resolvedIp);
              setClientPublicIp(resolvedIp);
            }
          }
        } catch (e) {}
      } else if (resolvedIp !== clientPublicIp) {
        setClientPublicIp(resolvedIp);
      }

      const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
      const headers = resolvedIp ? { "X-Client-IP": resolvedIp } : {};
      const res = await fetch(`${protocol}//${backendHost}/api/system/logs?limit=500`, { headers });
      if (!res.ok) throw new Error("Olay günlükleri alınırken bir hata oluştu.");
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [backendHost]);

  const moduleTranslations = {
    Auth: "Oturum & Giriş",
    Navigation: "Ekran Gezinme",
    "Call Panel": "Temsilci Çağrı Paneli",
    AgentSession: "Kuyruk & Mola Oturumu",
    Profile: "Profil Ayarları",
    Users: "Kullanıcı Yönetimi",
    Roles: "Rol ve Yetkiler",
    Queues: "Çağrı Kuyrukları",
    "SIP Trunks": "Dış Hatlar (SIP Trunk)",
    Contacts: "Telefon Rehberi",
    Blacklist: "Kara Liste & Engelleme",
    "Inbound Rules": "Gelen Arama Kuralları",
    "Outbound Rules": "Giden Arama Kuralları",
    Announcements: "Sesli Anonslar",
    Breaks: "Mola Tanımları",
    Settings: "Sistem Ayarları",
    Channels: "İletişim Kanalları",
    CallFlow: "Çağrı Akışı (IVR)",
    "AI Agents": "Yapay Zeka Asistanları",
    Tenants: "Müşteri (Tenant) Yönetimi",
    "Work Hours": "Çalışma Saatleri & Tatiller",
    "Network & NAT": "Ağ ve NAT Ayarları",
    "Speed Dials": "Hızlı Arama",
    Conferences: "Konferans Odaları",
    "Call Pickup Groups": "Çağrı Yakalama Grupları",
    "Subscriber Groups": "Abone Grupları",
    AutoProvision: "IP Telefon (AutoProvision)",
    "Knowledge Base": "Bilgi Bankası",
    Evaluation: "Kalite Değerlendirme",
  };

  const actionTranslations = {
    LOGIN: "Sisteme Giriş Yaptı",
    LOGOUT: "Sistemden Çıkış Yaptı",
    QUEUE_LOGIN: "Kuyruk Oturumu Açtı",
    QUEUE_LOGOUT: "Kuyruk Oturumunu Kapattı",
    BREAK_START: "Molaya Çıktı",
    BREAK_END: "Molayı Bitirdi",
    PAGE_VIEW: "Ekran Görüntüledi",
    CREATE_USER: "Kullanıcı Ekledi",
    UPDATE_USER: "Kullanıcı Düzenledi",
    UPDATE_USERS: "Kullanıcı Düzenledi",
    DELETE_USER: "Kullanıcı Sildi",
    CREATE_ROLE: "Yeni Rol Ekledi",
    UPDATE_ROLE: "Rol / Yetki Düzenledi",
    UPDATE_ROLES: "Rol / Yetki Düzenledi",
    DELETE_ROLE: "Rol Sildi",
    CREATE_QUEUE: "Kuyruk Ekledi",
    UPDATE_QUEUE: "Kuyruk Düzenledi",
    SAVE_QUEUE: "Kuyruk Kaydetti",
    DELETE_QUEUE: "Kuyruk Sildi",
    CREATE_TRUNK: "Dış Hat Ekledi",
    UPDATE_TRUNK: "Dış Hat Düzenledi",
    SAVE_TRUNK: "Dış Hat Kaydetti",
    DELETE_TRUNK: "Dış Hat Sildi",
    CREATE_CONTACT: "Rehbere Kişi Ekledi",
    UPDATE_CONTACT: "Rehber Kişisini Düzenledi",
    DELETE_CONTACT: "Rehberden Kişi Sildi",
    ADD_BLACKLIST: "Numara Engelledi",
    CREATE_BLACKLIST: "Numara Engelledi",
    REMOVE_BLACKLIST: "Numara Engelini Kaldırdı",
    DELETE_BLACKLIST: "Numara Engelini Kaldırdı",
    CREATE_BLOCK_WORD: "Yasaklı Kelime Ekledi",
    DELETE_BLOCK_WORD: "Yasaklı Kelime Sildi",
    UPDATE_PROFILE: "Profilini Güncelledi",
    UPDATE_SETTINGS: "Ayarları Güncelledi",
    CREATE_ITEM: "Yeni Kayıt Ekledi",
    DELETE_ITEM: "Kayıt Sildi",
    CREATE_RULE: "Kural Ekledi",
    DELETE_RULE: "Kural Sildi",
    APPLY_CONFIG: "Ayarları Santrale Uyguladı",
    CLIENT_ENV_CONNECT: "Cihaz & Bağlantı Kaydı",
    CLIENT_ENV_CHANGE: "IP / Tarayıcı / OS Değişimi",
    DEVICE_KEY_BLOCKED: "Yetkisiz Cihaz Engellendi",
  };

  const screenSlugTranslations = {
    "dashboard": "Gerçek Zamanlı AI Pano",
    "wallboard": "Canlı İzleme Paneli (Wallboard)",
    "realtime-calls": "Gerçek Zamanlı Çağrı İzleme",
    "call-center": "Temsilci Çağrı Paneli",
    "omnichannel": "Ortak Gelen Kutusu (Omnichannel)",
    "api-budgets": "API Bütçe ve Tüketim",
    "ai-config-assistant": "AI Konfigürasyon Asistanı",
    "ai-agents": "AI Temsilcileri",
    "rag-kb": "Bilgi Bankası (RAG)",
    "knowledge": "Bilgi Bankası (RAG)",
    "rule-editor": "Kural & Senaryo Editörü",
    "users": "Kullanıcı Yönetimi",
    "announcements": "Anons Yönetimi",
    "acd-queues": "ACD Kuyruk Yönetimi",
    "auto-provision": "Oto Provizyon",
    "outbound-rules": "Giden Arama Kuralları",
    "inbound-rules": "Gelen Arama Kuralları",
    "call-pickup-groups": "Çağrı Toplama Grupları",
    "subscriber-groups": "Abone Grupları",
    "bulk-config": "Toplu Konfigürasyon Merkezi",
    "contacts": "Telefon Rehberi",
    "trunks": "Dış Hat Tanımı (SIP Trunk)",
    "conferences": "Konferans Odaları",
    "speed-dial": "Hızlı Arama",
    "blacklist": "Numara Engelleme & Kara Liste",
    "scheduled-reports": "Zamanlanmış Raporlar",
    "call-flow": "Arama Akış Yönetimi",
    "work-hours": "Mesai Saatleri & Resmi Tatiller",
    "dialer": "Dış Arama (Dialer) Kampanyaları",
    "calendar": "Randevu Takvimi",
    "appointments": "Randevu Takvimi",
    "reports": "Çağrı ve Performans Raporları",
    "reports-custom-builder": "Raporlar: Özel Rapor Tasarımcısı",
    "reports-pano": "Raporlar: Genel Özet Pano",
    "reports-cdr": "Raporlar: Tüm Çağrı Kayıtları (CDR)",
    "reports-audio": "Raporlar: Ses Kayıtları",
    "reports-transcripts": "Raporlar: Çağrı Transkriptleri",
    "reports-sentiment": "Raporlar: Duygu Analizi",
    "reports-qa": "Raporlar: Kalite Değerlendirmeleri",
    "reports-notes": "Raporlar: Temsilci Notları",
    "reports-perf": "Raporlar: Temsilci Performans",
    "reports-queue": "Raporlar: Kuyruk & Bekleme Analitiği",
    "reports-survey": "Raporlar: Anket Raporları (CSAT/NPS)",
    "reports-sentiment-heat": "Raporlar: Duygu Durumu Isı Haritası",
    "reports-wordcloud": "Raporlar: Kelime Bulutu & Trendler",
    "reports-fcr": "Raporlar: İlk Aramada Çözüm (FCR)",
    "reports-roi": "Raporlar: AI & İnsan Maliyet/Tasarruf (ROI)",
    "reports-missed": "Raporlar: Kaçan Çağrı Analizi",
    "reports-agent-status-timeline": "Raporlar: Temsilci Kronolojisi",
    "reports-traffic-load": "Raporlar: Saatlik Yoğunluk Raporu",
    "reports-trunk": "Raporlar: Hat Kapasite Raporu",
    "reports-did": "Raporlar: DID Numara Bazlı Rapor",
    "reports-trunk-minutes": "Raporlar: Operatör Dakika & Paket Raporu",
    "reports-invalid-calls": "Raporlar: Hatalı & Eşleşmeyen Çağrılar",
    "reports-ivr-drop": "Raporlar: IVR Terk Oranı & Tuşlama",
    "reports-transfer-hold": "Raporlar: Aktarma & Bekletme",
    "reports-ab-testing": "Raporlar: Verimlilik Karşılaştırması",
    "reports-friction": "Raporlar: Müşteri Çile Noktaları",
    "reports-compliance": "Raporlar: Senaryo Sadakati Raporu",
    "reports-silence": "Raporlar: Sessizlik & Söz Kesme",
    "reports-ceo-summary": "Raporlar: CEO Özet Raporu",
    "reports-intent": "Raporlar: Müşteri Niyet Raporu",
    "reports-breaks-attendance": "Raporlar: Mola & Puantaj Raporu",
    "reports-omnichannel": "Raporlar: Omnichannel Kanal & SLA",
    "reports-disposition": "Raporlar: Çağrı Sonuç Kodları",
    "reports-dialer-callback": "Raporlar: Kampanya & Geri Arama",
    "reports-queue-sla": "Raporlar: Kuyruk SLA & Hız Dilimleri",
    "reports-repeat-callers": "Raporlar: Tekrar Eden Arayanlar",
    "reports-dept-pickup": "Raporlar: Departman & Çağrı Toplama",
    "reports-voip-quality": "Raporlar: VoIP & Ses Kalitesi (MOS)",
    "reports-forwarding-gsm": "Raporlar: Yönlendirme (Follow-Me / GSM)",
    "reports-supervisor-audit": "Raporlar: Süpervizör Dinleme & Müdahale",
    "reports-blacklist-security": "Raporlar: Engellenen Çağrı & İhlal",
    "reports-ai-appointments-rag": "Raporlar: AI Randevu & Bilgi Bankası",
    "reports-voicemail": "Raporlar: Sesli Posta Raporu",
    "reports-conferences": "Raporlar: Konferans Odası Kullanımı",
    "satisfaction-analytics": "Müşteri Memnuniyet Analitiği",
    "evaluation": "Kalite Değerlendirme",
    "tenants": "Müşteri (Tenant) Yönetimi",
    "system-status": "Sistem Panosu & Sağlık",
    "event-logs": "Olay Günlükleri",
    "system-logs": "Olay Günlükleri",
    "troubleshooting": "Sorun İnceleme (Ping, Traceroute, SIP Capture & sngrep)",
    "sip-debugger": "Sorun İnceleme (Ping, Traceroute, SIP Capture & sngrep)",
    "security": "Güvenlik Kalkanı",
    "changelog": "Sistem Versiyonu & Günlük",
    "pbx-settings": "Santral (PBX) Ayarları",
    "settings": "Sistem Ayarları",
  };

  const tModule = (log) =>
    screenSlugTranslations[log.module] ||
    log.module_tr ||
    moduleTranslations[log.module] ||
    log.module ||
    "Sistem";
  const tAction = (log) => log.action_tr || actionTranslations[log.action] || log.action || "İşlem";
  const tScreen = (log) => {
    const rawScreen = log.details?.screen_name;
    if (rawScreen) {
      return screenSlugTranslations[rawScreen] || moduleTranslations[rawScreen] || rawScreen;
    }
    return tModule(log);
  };
  const tSummary = (log) => {
    let raw = log.summary || log.details?.summary;
    if (!raw) {
      return `${tScreen(log)} bölümünde ${tAction(log).toLowerCase()} işlemi yapıldı.`;
    }
    return String(raw).replace(/'([^']+)'/g, (full, inner) => {
      const mapped = screenSlugTranslations[inner] || moduleTranslations[inner];
      return mapped ? `'${mapped}'` : full;
    });
  };

  const resolveCategory = (log) => {
    if (log.category) return log.category;
    const act = String(log.action || "").toUpperCase();
    if (["LOGIN", "LOGOUT", "QUEUE_LOGIN", "QUEUE_LOGOUT", "BREAK_START", "BREAK_END", "CLIENT_ENV_CONNECT", "CLIENT_ENV_CHANGE", "DEVICE_KEY_BLOCKED"].includes(act)) return "auth";
    if (act === "PAGE_VIEW" || log.module === "Navigation") return "navigation";
    if (act.includes("DELETE") || act.includes("REMOVE")) return "delete";
    if (act.includes("CREATE") || act.includes("ADD")) return "create";
    return "update";
  };

  const getActionBadgeMeta = (log) => {
    const act = String(log.action || "").toUpperCase();
    const cat = resolveCategory(log);

    if (act === "DEVICE_KEY_BLOCKED") {
      return {
        Icon: Shield,
        cls: "text-rose-700 bg-rose-50 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-300",
      };
    }
    if (act === "CLIENT_ENV_CHANGE") {
      return {
        Icon: Monitor,
        cls: "text-amber-700 bg-amber-50 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300",
      };
    }
    if (act === "CLIENT_ENV_CONNECT") {
      return {
        Icon: Monitor,
        cls: "text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
      };
    }
    if (act === "LOGIN" || act === "QUEUE_LOGIN") {
      return {
        Icon: LogIn,
        cls: "text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
      };
    }
    if (act === "LOGOUT" || act === "QUEUE_LOGOUT") {
      return {
        Icon: LogOut,
        cls: "text-amber-700 bg-amber-50 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300",
      };
    }
    if (act === "BREAK_START" || act === "BREAK_END") {
      return {
        Icon: Coffee,
        cls: "text-orange-700 bg-orange-50 border-orange-200/80 dark:bg-orange-950/40 dark:border-orange-800/50 dark:text-orange-300",
      };
    }
    if (cat === "navigation") {
      return {
        Icon: Monitor,
        cls: "text-indigo-700 bg-indigo-50 border-indigo-200/80 dark:bg-indigo-950/40 dark:border-indigo-800/50 dark:text-indigo-300",
      };
    }
    if (cat === "delete") {
      return {
        Icon: Trash2,
        cls: "text-rose-700 bg-rose-50 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-300",
      };
    }
    if (cat === "create") {
      return {
        Icon: PlusCircle,
        cls: "text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
      };
    }
    return {
      Icon: Edit3,
      cls: "text-sky-700 bg-sky-50 border-sky-200/80 dark:bg-sky-950/40 dark:border-sky-800/50 dark:text-sky-300",
    };
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    const dateStr = isoStr.endsWith("Z") || isoStr.includes("+") ? isoStr : `${isoStr}Z`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return isoStr;
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const uniqueModules = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => {
      if (l.module) map.set(l.module, tModule(l));
    });
    return Array.from(map.entries());
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    return [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
  }, [logs]);

  const stats = useMemo(() => {
    let authCount = 0;
    let navCount = 0;
    let mutationCount = 0;
    logs.forEach((l) => {
      const cat = resolveCategory(l);
      if (cat === "auth") authCount++;
      else if (cat === "navigation") navCount++;
      else mutationCount++;
    });
    return {
      total: logs.length,
      auth: authCount,
      navigation: navCount,
      mutations: mutationCount,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const startBoundMs = filterStartDate
      ? new Date(`${filterStartDate}T${filterStartTime || "00:00"}:00`).getTime()
      : null;
    const endBoundMs = filterEndDate
      ? new Date(`${filterEndDate}T${filterEndTime || "23:59"}:59.999`).getTime()
      : null;

    return logs.filter((log) => {
      if (startBoundMs !== null || endBoundMs !== null) {
        const rawTs = log.timestamp || "";
        const dateStr = rawTs.endsWith("Z") || rawTs.includes("+") ? rawTs : `${rawTs}Z`;
        const logMs = new Date(dateStr).getTime();
        if (!isNaN(logMs)) {
          if (startBoundMs !== null && logMs < startBoundMs) return false;
          if (endBoundMs !== null && logMs > endBoundMs) return false;
        }
      }

      const cat = resolveCategory(log);
      const matchesCat = filterCategory === "all" || cat === filterCategory;
      const matchesModule = filterModule === "all" || log.module === filterModule;
      const matchesUser = filterUser === "all" || log.user_id === filterUser;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (log.user_id && log.user_id.toLowerCase().includes(q)) ||
        (log.summary && log.summary.toLowerCase().includes(q)) ||
        tSummary(log).toLowerCase().includes(q) ||
        tScreen(log).toLowerCase().includes(q) ||
        tAction(log).toLowerCase().includes(q) ||
        tModule(log).toLowerCase().includes(q) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q));
      return matchesCat && matchesModule && matchesUser && matchesSearch;
    });
  }, [logs, filterCategory, filterModule, filterUser, searchTerm, filterStartDate, filterStartTime, filterEndDate, filterEndTime]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterModule, filterUser, searchTerm, filterStartDate, filterStartTime, filterEndDate, filterEndTime, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  const visiblePageNumbers = useMemo(() => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [safeCurrentPage, totalPages]);

  const categoryPills = [
    { id: "all", label: "Tüm Hareketler", count: stats.total },
    { id: "auth", label: "Giriş / Çıkış & Mola", count: stats.auth },
    { id: "navigation", label: "Ekran Gezinmeleri", count: stats.navigation },
    { id: "create", label: "Yeni Eklenenler" },
    { id: "update", label: "Düzenleme & Çıkarma" },
    { id: "delete", label: "Silinenler" },
  ];

  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Shield size={22} className={text} />
            Kullanıcı Hareket ve Denetim Günlükleri
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sistemde hangi kullanıcının ne zaman giriş/çıkış yaptığı, hangi ekranlara girdiği ve ne ekleyip çıkardığının veya sildiğinin kaydı.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
            Kayıtları Yenile
          </button>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isFilterOpen || hasActiveFilter
                ? `${bg} ${hover} text-white ${border}`
                : `${lightBg} ${text} ${borderLight || "border-slate-200 dark:border-slate-800"} ${hover} hover:text-white`
            }`}
          >
            <Filter size={15} />
            <span>Filtrele</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Toplam Hareket</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lightBg} ${text}`}>
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Giriş / Çıkış & Oturum</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{stats.auth}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <LogIn size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Ekran Gezinmeleri</p>
            <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{stats.navigation}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Monitor size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Ekleme / Düzenleme / Silme</p>
            <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">{stats.mutations}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
            <Edit3 size={20} />
          </div>
        </div>
      </div>

      {/* Detailed Filter Modal Popup (Matching ReportsPanel) */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Filter size={16} className={text} />
                <span>Detaylı Filtreleme</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-4">
              {/* Date & Time Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/60 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                <DateTimePickerInput
                  label="Başlangıç Tarihi & Saati"
                  dateValue={filterStartDate}
                  timeValue={filterStartTime}
                  defaultTime="00:00"
                  presets={eventLogDatePresets}
                  onDateChange={(newDate) => {
                    setFilterStartDate(newDate);
                    if (filterEndDate && newDate > filterEndDate) {
                      setFilterEndDate(newDate);
                    }
                  }}
                  onTimeChange={setFilterStartTime}
                />
                <DateTimePickerInput
                  label="Bitiş Tarihi & Saati"
                  dateValue={filterEndDate}
                  timeValue={filterEndTime}
                  defaultTime="23:59"
                  presets={eventLogDatePresets}
                  onDateChange={(newDate) => {
                    setFilterEndDate(newDate);
                    if (filterStartDate && newDate < filterStartDate) {
                      setFilterStartDate(newDate);
                    }
                  }}
                  onTimeChange={setFilterEndTime}
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  İşlem Kategorisi
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryPills.map((pill) => {
                    const active = filterCategory === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setFilterCategory(pill.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                          active
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{pill.label}</span>
                        {pill.count !== undefined && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                              active ? "bg-white/20 text-white" : "bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {pill.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search, User & Module Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Arama
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Kullanıcı adı, dahili, yapılan işlem veya ekran ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Kullanıcı
                  </label>
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                  >
                    <option value="all">Tüm Kullanıcılar</option>
                    {uniqueUsers.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Bölüm / Ekran
                  </label>
                  <select
                    value={filterModule}
                    onChange={(e) => setFilterModule(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                  >
                    <option value="all">Tüm Ekranlar / Bölümler</option>
                    {uniqueModules.map(([rawMod, trLabel]) => (
                      <option key={rawMod} value={rawMod}>
                        {trLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Filtreleri Temizle
              </button>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className={`flex-1 py-2 ${bg} ${hover} text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer`}
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800">
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tarih & Saat</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kullanıcı</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">İşlem Türü</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bölüm / Ekran</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Yapılan İşlem Açıklaması</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">İncele</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-14 text-center">
                    <Loader2 size={30} className={`mx-auto animate-spin ${text}`} />
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-xs font-medium">Kullanıcı hareket günlükleri yükleniyor...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-rose-500">
                    <AlertCircle size={30} className="mx-auto mb-2" />
                    <p className="text-xs font-semibold">{error}</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-14 text-center">
                    <Shield size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2.5" />
                    <p className="text-slate-600 dark:text-slate-300 text-sm font-bold">Kayıtlı Kullanıcı Hareketi Bulunamadı</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                      Kullanıcıların giriş-çıkışları, gezindiği ekranlar ve yaptığı ekleme/çıkarma/silme işlemleri burada listelenir.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const { Icon: BadgeIcon, cls: badgeCls } = getActionBadgeMeta(log);
                  const changesList = Array.isArray(log.details?.changes) ? log.details.changes : [];

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          {formatDate(log.timestamp)}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                            <User size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {log.user_id || "Sistem Yöneticisi"}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {log.ip_address && log.ip_address !== "127.0.0.1"
                                ? log.ip_address
                                : clientPublicIp || log.ip_address || ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeCls}`}>
                          <BadgeIcon size={12} className="shrink-0" />
                          {tAction(log)}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {tScreen(log)}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-md">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          {tSummary(log)}
                        </div>
                        {log.details?.device_key && (
                          <div className="mt-1">
                            <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Cihaz: {log.details.device_key}
                            </code>
                          </div>
                        )}
                        {changesList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {changesList.map((ch, idx) => (
                              <React.Fragment key={idx}>
                                {Array.isArray(ch.added_members) &&
                                  ch.added_members.map((m, mi) => (
                                    <span
                                      key={`add-${mi}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50"
                                    >
                                      <UserPlus size={10} /> + {m}
                                    </span>
                                  ))}
                                {Array.isArray(ch.removed_members) &&
                                  ch.removed_members.map((m, mi) => (
                                    <span
                                      key={`rem-${mi}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50"
                                    >
                                      <UserMinus size={10} /> - {m}
                                    </span>
                                  ))}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Eye size={13} />
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredLogs.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-950/50 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Toplam <strong className="font-bold text-slate-800 dark:text-slate-200">{filteredLogs.length}</strong> kayıttan{" "}
                <strong className="font-bold text-slate-800 dark:text-slate-200">
                  {(safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize, filteredLogs.length)}
                </strong>{" "}
                arası gösteriliyor
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold">Sayfa başına:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                İlk
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                ‹ Önceki
              </button>

              {visiblePageNumbers.map((pageNum) => {
                const isCurrent = pageNum === safeCurrentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      isCurrent
                        ? `${bg} text-white border-transparent shadow-sm`
                        : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Sonraki ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Son
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Human-Readable Detail Modal (No Technical JSON Dump) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lightBg} ${text}`}>
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Hareket Kaydı Detayı
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDate(selectedLog.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Top User & Action Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    İşlemi Yapan Kullanıcı
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User size={14} className={text} />
                    {selectedLog.user_id || "Sistem Yöneticisi"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    IP Adresi:{" "}
                    {selectedLog.ip_address && selectedLog.ip_address !== "127.0.0.1"
                      ? selectedLog.ip_address
                      : clientPublicIp || selectedLog.ip_address || "Yerel Ağ"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bölüm & İşlem Türü
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {tAction(selectedLog)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Ekran / Modül: {tScreen(selectedLog)}
                  </div>
                </div>
              </div>

              {/* Main Turkish Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  İşlem Özeti
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {tSummary(selectedLog)}
                </p>
              </div>

              {/* Detailed Changes if present */}
              {Array.isArray(selectedLog.details?.changes) && selectedLog.details.changes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Etkilenen Kayıtlar ve Değişiklikler
                  </h4>
                  {selectedLog.details.changes.map((change, idx) => {
                    const diffMap = change.fields || change.diff || null;
                    const isCreated = change.action === "CREATED";
                    const isDeleted = change.action === "DELETED";

                    return (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isCreated ? "bg-emerald-500" : isDeleted ? "bg-rose-500" : "bg-sky-500"
                              }`}
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {change.name || "Kayıt"}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isCreated
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : isDeleted
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                            }`}
                          >
                            {isCreated ? "Yeni Eklendi" : isDeleted ? "Silindi" : "Güncellendi"}
                          </span>
                        </div>

                        {change.summary && (
                          <p className="text-xs text-slate-600 dark:text-slate-300">{change.summary}</p>
                        )}

                        {/* Added / Removed Queue Members */}
                        {Array.isArray(change.added_members) && change.added_members.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <UserPlus size={13} /> Kuyruğa Eklenen Temsilciler:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {change.added_members.map((m, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50"
                                >
                                  + {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray(change.removed_members) && change.removed_members.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <UserMinus size={13} /> Kuyruktan Çıkarılan Temsilciler:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {change.removed_members.map((m, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/50"
                                >
                                  - {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Added / Removed Role Permissions */}
                        {Array.isArray(change.added_permissions) && change.added_permissions.length > 0 && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            + {change.added_permissions.length} yeni yetki tanımlandı.
                          </div>
                        )}
                        {Array.isArray(change.removed_permissions) && change.removed_permissions.length > 0 && (
                          <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                            - {change.removed_permissions.length} mevcut yetki kaldırıldı.
                          </div>
                        )}

                        {/* Field-by-Field Before/After Table */}
                        {diffMap && Object.keys(diffMap).length > 0 && (
                          <div className="space-y-2 pt-1">
                            {Object.entries(diffMap).map(([fieldKey, vals]) => (
                              <div
                                key={fieldKey}
                                className="grid grid-cols-1 sm:grid-cols-[140px_1fr_24px_1fr] items-center gap-2 text-xs bg-slate-50/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60"
                              >
                                <div className="font-bold text-slate-600 dark:text-slate-400 truncate">
                                  {FIELD_LABELS_TR[fieldKey] || fieldKey}
                                </div>
                                <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-md truncate line-through">
                                  {formatValueTr(vals?.old)}
                                </div>
                                <div className="text-center text-slate-400 hidden sm:block">
                                  <ArrowRight size={13} className="mx-auto" />
                                </div>
                                <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md truncate font-semibold">
                                  {formatValueTr(vals?.new)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/40 dark:bg-slate-950/40">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors text-xs cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
