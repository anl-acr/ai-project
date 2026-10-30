import React, { useState, useEffect, useMemo } from "react";
import {
  Coffee,
  MessageSquare,
  Tag,
  PhoneOutgoing,
  Target,
  Repeat,
  Building2,
  Activity,
  RefreshCw,
  Download,
  Search,
  Filter,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Headphones,
  Wifi,
  ArrowUpRight,
  PhoneIncoming,
  PhoneMissed,
  PhoneForwarded,
  Eye,
  ShieldAlert,
  Database,
  Calendar,
  Mail,
  Smartphone,
  Lock,
  Award,
  Sliders,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import DateTimePickerInput from "../common/DateTimePickerInput";

const REPORT_META = {
  "breaks-attendance": {
    title: "Mola & Vardiya Puantaj Raporu",
    subtitle: "Temsilci ilk giriş / son çıkış saatleri, mola türü kırılımları, limit aşımı ve doluluk (Occupancy) analizi",
    endpoint: "/api/reports/enterprise/breaks-attendance",
    icon: Coffee
  },
  omnichannel: {
    title: "Omnichannel Kanal & SLA Raporu",
    subtitle: "WhatsApp, Instagram, Telegram, Facebook ve E-Posta hacmi, İlk Yanıt Süresi (FRT) ve AI otonom çözüm oranı",
    endpoint: "/api/reports/enterprise/omnichannel",
    icon: MessageSquare
  },
  disposition: {
    title: "Çağrı Sonuç Kodları (Disposition) Raporu",
    subtitle: "Görüşme sonu sonuç kodu (Wrap-up) dağılımı, satış/onay dönüşüm yüzdesi ve eksik kodlama denetimi",
    endpoint: "/api/reports/enterprise/disposition",
    icon: Tag
  },
  "dialer-callback": {
    title: "Kampanya (Dialer) & Geri Arama Raporu",
    subtitle: "Otomatik dış arama kampanya penetrasyonu, isabet oranı ve cevapsız çağrı geri kazanım (Callback) süresi",
    endpoint: "/api/reports/enterprise/dialer-callback",
    icon: PhoneOutgoing
  },
  "queue-sla": {
    title: "Kuyruk SLA & Cevaplama Hızı Dilimleri",
    subtitle: "Hedef saniye bazlı Hizmet Seviyesi (SLA %), kısa terk (Short Abandon) filtresi ve bekleme hızı dilimleri",
    endpoint: "/api/reports/enterprise/queue-sla",
    icon: Target
  },
  "repeat-callers": {
    title: "Tekrar Eden Arayanlar (Kronik Çağrı) Raporu",
    subtitle: "Belirlenen dönemde birden fazla kez arayan dış numaralar, risk seviyesi ve çözümsüz çağrı takibi",
    endpoint: "/api/reports/enterprise/repeat-callers",
    icon: Repeat
  },
  "dept-pickup": {
    title: "Departman, Lokasyon & Çağrı Toplama Raporu",
    subtitle: "Birim/şube bazlı telefon trafiği ve grup çağrı çekme (*8 / **dahili) performans sıralaması",
    endpoint: "/api/reports/enterprise/dept-pickup",
    icon: Building2
  },
  "voip-quality": {
    title: "VoIP & WebRTC Ses Kalitesi (MOS) Raporu",
    subtitle: "Çağrı ve dahili bazlı MOS puanı (1.0–4.5), Jitter (ms), Paket Kaybı (%) ve Gecikme (RTT) telemetrisi",
    endpoint: "/api/reports/enterprise/voip-quality",
    icon: Wifi
  },
  "forwarding-gsm": {
    title: "Çağrı Yönlendirme (Follow-Me / GSM) Raporu",
    subtitle: "Abone yönlendirme kuralları (*21* / *67* / *61*), mobil GSM köprüleme çağrıları ve dış hat dakika maliyeti",
    endpoint: "/api/reports/enterprise/forwarding-gsm",
    icon: PhoneForwarded
  },
  "supervisor-audit": {
    title: "Süpervizör Dinleme & Müdahale Raporu",
    subtitle: "Canlı çağrı sessiz dinleme (*551*), sufle/fısıldama (*552*), araya girme (*553*) ve temsilci durum müdahale denetimi",
    endpoint: "/api/reports/enterprise/supervisor-audit",
    icon: Eye
  },
  "blacklist-security": {
    title: "Engellenen Çağrı & İhlal Raporu",
    subtitle: "Kara liste numara engellemeleri, yasaklı kelime / uygunsuz dil tespitleri ve en çok ihlal yapan numaralar",
    endpoint: "/api/reports/enterprise/blacklist-security",
    icon: ShieldAlert
  },
  "ai-appointments-rag": {
    title: "AI Randevu & Bilgi Bankası (RAG) Raporu",
    subtitle: "Yapay zeka tarafından oluşturulan randevular, otonom çözüm yüzdesi, bilgi bankası kaynakları ve bilgi açığı analizi",
    endpoint: "/api/reports/enterprise/ai-appointments-rag",
    icon: Bot
  },
  voicemail: {
    title: "Sesli Posta (Voicemail) Raporu",
    subtitle: "Dahili bazlı sesli posta kutuları, e-posta yönlendirme durumu ve bırakılan mesajlara geri dönüş (Callback) takibi",
    endpoint: "/api/reports/enterprise/voicemail",
    icon: Mail
  },
  conferences: {
    title: "Konferans Odası Kullanım Raporu",
    subtitle: "Konferans köprüleri (3000–3999), toplantı oturum sayıları, zirve katılımcı kapasitesi ve toplam toplantı dakikaları",
    endpoint: "/api/reports/enterprise/conferences",
    icon: Users
  }
};

function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s} sn`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h} sa ${m} dk`;
  return rem > 0 ? `${m} dk ${rem} sn` : `${m} dk`;
}

function formatLocalYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EnterpriseReportsPanel({ backendHost, reportType = "breaks-attendance" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);
  const meta = REPORT_META[reportType] || REPORT_META["breaks-attendance"];
  const HeaderIcon = meta.icon || Activity;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Default range: Last 7 days so managers immediately see rich historical context
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatLocalYMD(d);
  });
  const [endDate, setEndDate] = useState(() => formatLocalYMD(new Date()));
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  // Report-specific parameters
  const [maxBreakMinutes, setMaxBreakMinutes] = useState(60);
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [slaSeconds, setSlaSeconds] = useState(20);
  const [shortAbandonSeconds, setShortAbandonSeconds] = useState(5);
  const [minRepeatCalls, setMinRepeatCalls] = useState(2);
  const [minuteRateTl, setMinuteRateTl] = useState(0.85);
  const [activeSubView, setActiveSubView] = useState("primary");

  useEffect(() => {
    setActiveSubView("primary");
    setSearchQuery("");
  }, [reportType]);

  const datePresets = useMemo(
    () => [
      {
        label: "Bugün",
        apply: () => {
          const t = formatLocalYMD(new Date());
          setStartDate(t);
          setEndDate(t);
          setStartTime("00:00");
          setEndTime("23:59");
        }
      },
      {
        label: "Dün",
        apply: () => {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          const ys = formatLocalYMD(y);
          setStartDate(ys);
          setEndDate(ys);
          setStartTime("00:00");
          setEndTime("23:59");
        }
      },
      {
        label: "Son 7 Gün",
        apply: () => {
          const now = new Date();
          const w = new Date();
          w.setDate(w.getDate() - 6);
          setStartDate(formatLocalYMD(w));
          setEndDate(formatLocalYMD(now));
          setStartTime("00:00");
          setEndTime("23:59");
        }
      },
      {
        label: "Son 30 Gün",
        apply: () => {
          const now = new Date();
          const m = new Date();
          m.setDate(m.getDate() - 29);
          setStartDate(formatLocalYMD(m));
          setEndDate(formatLocalYMD(now));
          setStartTime("00:00");
          setEndTime("23:59");
        }
      }
    ],
    []
  );

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (startTime) params.set("start_time", startTime);
      if (endTime) params.set("end_time", endTime);

      if (reportType === "breaks-attendance") {
        params.set("max_break_minutes", String(maxBreakMinutes));
      } else if (reportType === "omnichannel" && selectedChannel !== "all") {
        params.set("channel", selectedChannel);
      } else if (reportType === "queue-sla") {
        params.set("sla_seconds", String(slaSeconds));
        params.set("short_abandon_seconds", String(shortAbandonSeconds));
      } else if (reportType === "repeat-callers") {
        params.set("min_calls", String(minRepeatCalls));
      } else if (reportType === "forwarding-gsm") {
        params.set("minute_rate_tl", String(minuteRateTl));
      }

      const res = await tenantFetch(`${API_BASE}${meta.endpoint}?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("[EnterpriseReportsPanel] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [
    reportType,
    startDate,
    endDate,
    startTime,
    endTime,
    maxBreakMinutes,
    selectedChannel,
    slaSeconds,
    shortAbandonSeconds,
    minRepeatCalls,
    minuteRateTl
  ]);

  const handleExportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    if (reportType === "breaks-attendance") {
      const agentSheet = (data.agents || []).map((a) => ({
        Dahili: a.extension,
        Temsilci: a.agent_name,
        "Aktif Gün": a.active_days,
        "İlk Aktivite / Giriş": a.first_login,
        "Son Aktivite / Çıkış": a.last_logout,
        "Cevaplanan Çağrı": a.answered_calls,
        "Konuşma Süresi (sn)": a.talk_seconds,
        "Mola Adedi": a.break_count,
        "Otomatik Mola": a.auto_pause_count,
        "Limit Aşımı": a.overlimit_count,
        "Toplam Mola (dk)": Math.round((a.total_break_seconds || 0) / 60),
        "Occupancy (%)": a.occupancy_pct,
        "Mola Dağılımı": a.break_summary
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agentSheet), "Temsilci Puantaj");
      if ((data.items || []).length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items), "Mola Kayitlari");
      }
    } else if (reportType === "omnichannel") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_channel || []), "Kanal Ozeti");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Oturum Detaylari");
    } else if (reportType === "disposition") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_code || []), "Sonuc Kodlari");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_agent || []), "Temsilci Kodlama");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Cagri Detaylari");
    } else if (reportType === "dialer-callback") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.campaigns || []), "Kampanyalar");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.callbacks || []), "Geri Aramalar");
    } else if (reportType === "queue-sla") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.queues || []), "Kuyruk SLA");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.buckets || []), "Hiz Dilimleri");
    } else if (reportType === "repeat-callers") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Tekrar Arayanlar");
    } else if (reportType === "dept-pickup") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_department || []), "Departmanlar");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_location || []), "Lokasyonlar");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_picker || []), "Cagri Toplayanlar");
    } else if (reportType === "voip-quality") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_extension || []), "Dahili Kalite");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Cagri MOS Detay");
    } else if (reportType === "forwarding-gsm") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.subscribers || []), "Abone Yonlendirme Kurallari");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Yonlendirilen Cagrilar");
    } else if (reportType === "supervisor-audit") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_supervisor || []), "Supervizor Ozeti");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Mudahale Denetim Kayitlari");
    } else if (reportType === "blacklist-security") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.top_offenders || []), "En Cok Ihlal Yapanlar");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.blacklist_rules || []), "Aktif Kara Liste");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Engellenen Cagrilar");
    } else if (reportType === "ai-appointments-rag") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.appointments || []), "AI Randevular");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rag_sources || []), "RAG Bilgi Bankasi");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.knowledge_gaps || []), "Bilgi Acigi Analizi");
    } else if (reportType === "voicemail") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.by_extension || []), "Sesli Posta Kutulari");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.items || []), "Sesli Mesajlar");
    } else if (reportType === "conferences") {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rooms || []), "Konferans Odalari");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.sessions || []), "Konferans Oturumlari");
    }

    XLSX.writeFile(wb, `aida_${reportType}_${startDate || "rapor"}.xlsx`);
  };

  const qLower = searchQuery.trim().toLowerCase();
  const matchSearch = (obj, fields) => {
    if (!qLower) return true;
    return fields.some((f) => String(obj?.[f] || "").toLowerCase().includes(qLower));
  };

  const summary = data?.summary || {};

  return (
    <div className="w-full space-y-5">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${lightText} border ${borderLight} shrink-0`}>
              <HeaderIcon size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">
                {meta.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Date Presets */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
              {datePresets.map((pr) => {
                const isTodayActive =
                  pr.label === "Bugün" &&
                  startDate === formatLocalYMD(new Date()) &&
                  endDate === formatLocalYMD(new Date());
                return (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={pr.apply}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      isTodayActive
                        ? `${bg} text-white shadow-sm`
                        : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700"
                    }`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsFilterOpen((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                isFilterOpen
                  ? `${lightBg} ${lightText} ${borderLight}`
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Filter size={14} />
              <span>Tarih & Parametre</span>
            </button>

            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Yenile"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!data || loading}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
            >
              <Download size={14} />
              <span>Excel İndir</span>
            </button>
          </div>
        </div>

        {/* Expandable Filter & Threshold Bar */}
        {isFilterOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
            <DateTimePickerInput
              label="Başlangıç Tarihi & Saati"
              dateValue={startDate}
              timeValue={startTime}
              onDateChange={setStartDate}
              onTimeChange={setStartTime}
              placeholder="Başlangıç"
              allowClear={false}
              presets={datePresets}
            />
            <DateTimePickerInput
              label="Bitiş Tarihi & Saati"
              dateValue={endDate}
              timeValue={endTime}
              onDateChange={setEndDate}
              onTimeChange={setEndTime}
              placeholder="Bitiş"
              allowClear={false}
              presets={datePresets}
            />

            <div className="flex flex-col justify-end gap-2">
              {reportType === "breaks-attendance" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tek Seferlik Mola Limit Eşiği (Dk)
                  </label>
                  <select
                    value={maxBreakMinutes}
                    onChange={(e) => setMaxBreakMinutes(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    <option value={15}>15 Dakika</option>
                    <option value={30}>30 Dakika</option>
                    <option value={45}>45 Dakika</option>
                    <option value={60}>60 Dakika</option>
                  </select>
                </div>
              )}

              {reportType === "omnichannel" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    İletişim Kanalı Filtresi
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    <option value="all">Tüm Dijital Kanallar</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram Direct</option>
                    <option value="telegram">Telegram</option>
                    <option value="facebook">Facebook Messenger</option>
                    <option value="email">E-Posta</option>
                  </select>
                </div>
              )}

              {reportType === "queue-sla" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Hedef SLA Süresi
                    </label>
                    <select
                      value={slaSeconds}
                      onChange={(e) => setSlaSeconds(Number(e.target.value))}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}
                    >
                      <option value={15}>15 Saniye</option>
                      <option value={20}>20 Saniye (80/20)</option>
                      <option value={30}>30 Saniye</option>
                      <option value={60}>60 Saniye</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Kısa Terk (Hariç)
                    </label>
                    <select
                      value={shortAbandonSeconds}
                      onChange={(e) => setShortAbandonSeconds(Number(e.target.value))}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}
                    >
                      <option value={3}>&lt; 3 Saniye</option>
                      <option value={5}>&lt; 5 Saniye</option>
                      <option value={10}>&lt; 10 Saniye</option>
                    </select>
                  </div>
                </div>
              )}

              {reportType === "repeat-callers" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Minimum Tekrar Arama Sayısı
                  </label>
                  <select
                    value={minRepeatCalls}
                    onChange={(e) => setMinRepeatCalls(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}
                  >
                    <option value={2}>2 ve üzeri arayanlar (2+)</option>
                    <option value={3}>3 ve üzeri arayanlar (3+)</option>
                    <option value={5}>5 ve üzeri kronik arayanlar (5+)</option>
                  </select>
                </div>
              )}

              {reportType === "forwarding-gsm" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Operatör Birim Dakika Tarifesi (₺ / Dk)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={minuteRateTl}
                    onChange={(e) => setMinuteRateTl(Math.max(0, Number(e.target.value) || 0))}
                    className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tabloda temsilci, dahili, numara veya kod ara..."
            className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 ${ring}`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Dönem: <span className="font-bold text-slate-700 dark:text-slate-200">{startDate} {startTime}</span> —{" "}
          <span className="font-bold text-slate-700 dark:text-slate-200">{endDate} {endTime}</span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className={`animate-spin ${text}`} />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rapor verileri hesaplanıyor...</p>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 1. BREAKS & ATTENDANCE REPORT                                  */}
          {/* ============================================================== */}
          {reportType === "breaks-attendance" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label="Aktif Temsilci" value={`${summary.active_agents || 0} / ${summary.total_agents || 0}`} sub="Vardiyada işlem yapan" icon={Users} theme={{ lightBg, lightText }} />
                <KpiCard label="Toplam Mola Adedi" value={summary.total_breaks_count || 0} sub={`Oto-Mola: ${summary.auto_pause_count || 0}`} icon={Coffee} theme={{ lightBg, lightText }} />
                <KpiCard label="Toplam Mola Süresi" value={formatDuration(summary.total_break_seconds || 0)} sub="Tüm mola tipleri" icon={Clock} theme={{ lightBg, lightText }} />
                <KpiCard label="Mola Limit Aşımı" value={summary.overlimit_count || 0} sub={`>${maxBreakMinutes} dk aşan mola`} icon={AlertTriangle} alert={summary.overlimit_count > 0} theme={{ lightBg, lightText }} />
                <KpiCard label="Ortalama Occupancy" value={`%${summary.avg_occupancy_pct || 0}`} sub={`Konuşma: ${formatDuration(summary.total_talk_seconds || 0)}`} icon={Activity} theme={{ lightBg, lightText }} />
              </div>

              {(data?.by_break_type || []).length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                    Mola Türü Kırılımı
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(data.by_break_type || []).map((bt) => (
                      <div key={bt.break_name} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{bt.break_name}</div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className={`text-sm font-extrabold ${text}`}>{formatDuration(bt.total_seconds)}</span>
                          <span className="text-[11px] text-slate-500">{bt.count} kez</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  Temsilci Puantaj Özeti ({(data?.agents || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "logs"} onClick={() => setActiveSubView("logs")} bg={bg}>
                  Detaylı Mola Hareketleri ({(data?.items || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "primary" ? (
                <DataTable
                  ariaLabel="Temsilci Puantaj Tablosu"
                  headers={["Temsilci", "Aktif Gün", "İlk Giriş / Aktivite", "Son Çıkış / Aktivite", "Cevaplanan", "Konuşma", "Mola Adedi", "Toplam Mola", "Limit Aşımı", "Occupancy", "Mola Dağılımı"]}
                  rows={(data?.agents || []).filter((r) => matchSearch(r, ["extension", "agent_name", "break_summary"]))}
                  renderRow={(r) => (
                    <tr key={r.extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                        {r.agent_name} <span className="text-[11px] text-slate-400 font-normal">({r.extension})</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{r.active_days}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.first_login}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.last_logout}</td>
                      <td className="px-4 py-3 text-center font-semibold">{r.answered_calls}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.talk_seconds)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.break_count}
                        {r.auto_pause_count > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            {r.auto_pause_count} oto
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatDuration(r.total_break_seconds)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.overlimit_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                            {r.overlimit_count} Aşım
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${text}`}>%{r.occupancy_pct}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate" title={r.break_summary}>
                        {r.break_summary}
                      </td>
                    </tr>
                  )}
                />
              ) : (
                <DataTable
                  ariaLabel="Detaylı Mola Kayıtları"
                  headers={["Temsilci", "Mola Tipi", "Başlangıç", "Bitiş", "Süre", "Durum"]}
                  rows={(data?.items || []).filter((r) => matchSearch(r, ["extension", "agent_name", "break_name"]))}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        {r.agent_name} ({r.extension})
                      </td>
                      <td className="px-4 py-3">{r.break_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.start_time}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.end_time}</td>
                      <td className="px-4 py-3 font-semibold">{formatDuration(r.duration_seconds)}</td>
                      <td className="px-4 py-3">
                        {r.is_overlimit ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Süre Aşımı
                          </span>
                        ) : r.is_auto_pause ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            Oto-Mola
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. OMNICHANNEL CHANNEL & SLA REPORT                            */}
          {/* ============================================================== */}
          {reportType === "omnichannel" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label="Toplam Sohbet Oturumu" value={summary.total_sessions || 0} sub={`${summary.total_messages || 0} toplam mesaj`} icon={MessageSquare} theme={{ lightBg, lightText }} />
                <KpiCard label="Ort. İlk Yanıt (FRT)" value={formatDuration(summary.avg_frt_seconds || 0)} sub="İlk müşteri mesajına dönüş" icon={Clock} theme={{ lightBg, lightText }} />
                <KpiCard label="AI Otonom Çözüm" value={`%${summary.ai_resolution_pct || 0}`} sub={`${summary.ai_only_sessions || 0} oturum`} icon={Bot} theme={{ lightBg, lightText }} />
                <KpiCard label="Canlı Temsilci Devir" value={`%${summary.handoff_pct || 0}`} sub={`${summary.human_handoff_sessions || 0} oturum`} icon={Headphones} theme={{ lightBg, lightText }} />
                <KpiCard label="Ort. Diyalog Süresi" value={formatDuration(summary.avg_duration_seconds || 0)} sub={`Ort. QA: ${summary.avg_qa_score || "-"}`} icon={Award} theme={{ lightBg, lightText }} />
              </div>

              {(data?.by_channel || []).length > 0 && (
                <DataTable
                  ariaLabel="Kanal Bazlı Performans"
                  headers={["Kanal", "Oturum Sayısı", "Gelen Mesaj", "Giden Mesaj", "AI Otonom Çözüm", "Temsilciye Devir", "AI Başarı %", "Ort. İlk Yanıt (FRT)"]}
                  rows={data.by_channel}
                  renderRow={(c) => (
                    <tr key={c.channel} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold uppercase text-slate-800 dark:text-white">{c.channel}</td>
                      <td className="px-4 py-3 font-semibold">{c.sessions}</td>
                      <td className="px-4 py-3">{c.inbound_messages}</td>
                      <td className="px-4 py-3">{c.outbound_messages}</td>
                      <td className="px-4 py-3 font-semibold">{c.ai_resolved}</td>
                      <td className="px-4 py-3">{c.human_handoff}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${text}`}>%{c.ai_rate_pct}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatDuration(c.avg_frt_seconds)}</td>
                    </tr>
                  )}
                />
              )}

              <DataTable
                ariaLabel="Omnichannel Oturum Listesi"
                headers={["Son Mesaj", "Kanal", "Müşteri / Gönderen", "Hat / Alıcı", "Yöneten", "Mesaj (Gelen/Giden)", "İlk Yanıt (FRT)", "Süre"]}
                rows={(data?.items || []).filter((r) => matchSearch(r, ["channel", "sender_info", "recipient_info", "handler"]))}
                renderRow={(r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.last_message_time}</td>
                    <td className="px-4 py-3 font-bold uppercase text-[11px]">{r.channel}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.sender_info}</td>
                    <td className="px-4 py-3 text-slate-500">{r.recipient_info}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.is_human_handoff ? `${lightBg} ${lightText}` : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
                        {r.handler}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{r.inbound_messages} / {r.outbound_messages}</td>
                    <td className="px-4 py-3">{r.frt_seconds !== null ? formatDuration(r.frt_seconds) : "-"}</td>
                    <td className="px-4 py-3">{formatDuration(r.duration_seconds)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. DISPOSITION / WRAP-UP CODES REPORT                          */}
          {/* ============================================================== */}
          {reportType === "disposition" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiCard label="Cevaplanan Çağrı" value={summary.total_answered || 0} sub="Wrap-up beklenen toplam" icon={CheckCircle2} theme={{ lightBg, lightText }} />
                <KpiCard label="Kod Girilen Çağrı" value={`${summary.tagged_calls || 0} (%${summary.wrapup_completion_pct || 0})`} sub={`Eksik Kodlama: ${summary.untagged_calls || 0}`} icon={Tag} theme={{ lightBg, lightText }} />
                <KpiCard label="Olumlu Sonuç / Satış" value={summary.positive_outcomes || 0} sub={`Dönüşüm Oranı: %${summary.conversion_pct || 0}`} icon={Award} theme={{ lightBg, lightText }} />
                <KpiCard label="Eksik Wrap-Up Çağrısı" value={summary.untagged_calls || 0} sub="Temsilci sonuç kodu seçmemiş" icon={AlertTriangle} alert={summary.untagged_calls > 0} theme={{ lightBg, lightText }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DataTable
                  ariaLabel="Sonuç Kodu Dağılımı"
                  headers={["Sonuç Kodu (Disposition)", "Adet", "Pay (%)", "Ort. Konuşma", "Ort. QA"]}
                  rows={(data?.by_code || []).filter((r) => matchSearch(r, ["code"]))}
                  renderRow={(r) => (
                    <tr key={r.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.code}</td>
                      <td className="px-4 py-3 font-bold">{r.count}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${text}`}>%{r.share_pct}</span>
                      </td>
                      <td className="px-4 py-3">{formatDuration(r.avg_talk_seconds)}</td>
                      <td className="px-4 py-3">{r.avg_qa_score ?? "-"}</td>
                    </tr>
                  )}
                />

                <DataTable
                  ariaLabel="Temsilci Kodlama Disiplini"
                  headers={["Temsilci", "Cevaplanan", "Kodlanan", "Eksik", "Tamamlama %", "Dönüşüm %"]}
                  rows={(data?.by_agent || []).filter((r) => matchSearch(r, ["agent_name", "top_code"]))}
                  renderRow={(r) => (
                    <tr key={r.agent_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.agent_name}</td>
                      <td className="px-4 py-3 text-center">{r.answered_calls}</td>
                      <td className="px-4 py-3 text-center font-semibold">{r.tagged_calls}</td>
                      <td className="px-4 py-3 text-center text-rose-500 font-semibold">{r.untagged_calls}</td>
                      <td className="px-4 py-3 font-bold">%{r.completion_pct}</td>
                      <td className={`px-4 py-3 font-bold ${text}`}>%{r.conversion_pct}</td>
                    </tr>
                  )}
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. DIALER CAMPAIGN & SMART CALLBACK REPORT                     */}
          {/* ============================================================== */}
          {reportType === "dialer-callback" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label="Kampanya Penetrasyonu" value={`%${summary.penetration_pct || 0}`} sub={`${summary.dialed_leads || 0} / ${summary.total_leads || 0} kişi arandı`} icon={PhoneOutgoing} theme={{ lightBg, lightText }} />
                <KpiCard label="Kampanya İsabet (Hit)" value={`%${summary.hit_rate_pct || 0}`} sub={`${summary.connected_leads || 0} başarılı temas`} icon={CheckCircle2} theme={{ lightBg, lightText }} />
                <KpiCard label="Kaçan Tekil Müşteri" value={summary.missed_customers || 0} sub="Dış hattan cevapsız kalan" icon={PhoneMissed} theme={{ lightBg, lightText }} />
                <KpiCard label="Geri Kazanım (Callback)" value={`%${summary.recovery_rate_pct || 0}`} sub={`${summary.recovered_customers || 0} geri kazanıldı / ${summary.unrecovered_customers || 0} bekliyor`} icon={ArrowUpRight} theme={{ lightBg, lightText }} />
                <KpiCard label="Ort. Geri Dönüş Süresi" value={`${summary.avg_callback_minutes || 0} dk`} sub="Cevapsızdan ilk temasa" icon={Clock} theme={{ lightBg, lightText }} />
              </div>

              <div className="flex items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  Geri Arama (Callback) Takibi ({(data?.callbacks || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "campaigns"} onClick={() => setActiveSubView("campaigns")} bg={bg}>
                  Dış Arama Kampanyaları ({(data?.campaigns || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "campaigns" ? (
                <DataTable
                  ariaLabel="Dış Arama Kampanyaları"
                  headers={["Kampanya Adı", "Durum", "Mod", "Toplam Kayıt", "Aranan", "Ulaşılan", "Penetrasyon %", "İsabet (Hit) %", "Ort. Deneme"]}
                  rows={(data?.campaigns || []).filter((r) => matchSearch(r, ["name", "status", "destination"]))}
                  renderRow={(r) => (
                    <tr key={r.id || r.name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.name}</td>
                      <td className="px-4 py-3 uppercase text-[11px] font-bold">{r.status}</td>
                      <td className="px-4 py-3">{r.dial_mode}</td>
                      <td className="px-4 py-3 font-semibold">{r.total_leads}</td>
                      <td className="px-4 py-3">{r.dialed_leads}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{r.connected_leads}</td>
                      <td className="px-4 py-3 font-bold">%{r.penetration_pct}</td>
                      <td className={`px-4 py-3 font-bold ${text}`}>%{r.hit_rate_pct}</td>
                      <td className="px-4 py-3">{r.avg_retries}</td>
                    </tr>
                  )}
                />
              ) : (
                <DataTable
                  ariaLabel="Cevapsız Çağrı Geri Kazanım Tablosu"
                  headers={["Müşteri Numarası", "İlk Cevapsız Zamanı", "Kaçırma Adedi", "Hedef Hat/Kuyruk", "Durum", "Geri Dönüş Zamanı", "İlgilenen", "Gecikme (Dk)"]}
                  rows={(data?.callbacks || []).filter((r) => matchSearch(r, ["customer_number", "target", "recovered_by"]))}
                  renderRow={(r, idx) => (
                    <tr key={`${r.customer_number}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{r.customer_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.missed_at}</td>
                      <td className="px-4 py-3 text-center font-semibold">{r.missed_count}</td>
                      <td className="px-4 py-3">{r.target}</td>
                      <td className="px-4 py-3">
                        {r.recovered ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Geri Kazanıldı
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Dönüş Bekliyor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.recovered_at}</td>
                      <td className="px-4 py-3">{r.recovered_by}</td>
                      <td className="px-4 py-3 font-semibold">{r.delay_minutes !== null ? `${r.delay_minutes} dk` : "-"}</td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. QUEUE SLA & SPEED OF ANSWER BUCKETS REPORT                  */}
          {/* ============================================================== */}
          {reportType === "queue-sla" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label={`Hizmet Seviyesi (SLA ≤${summary.sla_threshold_seconds || slaSeconds}sn)`} value={`%${summary.sla_pct ?? 100}`} sub={`${summary.answered_in_sla || 0} çağrı hedef sürede`} icon={Target} theme={{ lightBg, lightText }} />
                <KpiCard label="Gelen Kuyruk Çağrısı" value={summary.total_offered || 0} sub={`Cevaplanan: ${summary.total_answered || 0}`} icon={PhoneIncoming} theme={{ lightBg, lightText }} />
                <KpiCard label="Ort. Cevaplama Hızı (ASA)" value={`${summary.asa_seconds || 0} sn`} sub="Average Speed of Answer" icon={Clock} theme={{ lightBg, lightText }} />
                <KpiCard label="Terk (Abandon) Oranı" value={`%${summary.abandon_pct || 0}`} sub={`${summary.total_abandoned || 0} terk (${summary.short_abandoned || 0} kısa terk)`} icon={PhoneMissed} alert={(summary.abandon_pct || 0) > 15} theme={{ lightBg, lightText }} />
                <KpiCard label="Ort. Terk Sabrı (AWT)" value={`${summary.awt_seconds || 0} sn`} sub="Kapatmadan önce bekleme" icon={Activity} theme={{ lightBg, lightText }} />
              </div>

              {/* Speed Buckets Visual Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                  Bekleme Süresi Dilimleri (Speed of Answer Buckets)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {(data?.buckets || []).map((b) => (
                    <div key={b.bucket} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                        <span>{b.bucket}</span>
                        <span className={text}>%{b.share_pct}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full ${bg}`} style={{ width: `${Math.min(100, b.share_pct || 0)}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{b.answered} Cevap</span>
                        <span className="text-rose-500 font-semibold">{b.abandoned} Terk</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DataTable
                ariaLabel="Kuyruk Bazlı SLA Tablosu"
                headers={["Kuyruk", "Gelen", "Cevaplanan", `SLA İçi (≤${slaSeconds}s)`, "Terk", `Kısa Terk (<${shortAbandonSeconds}s)`, "SLA %", "ASA (sn)", "Ort. Terk (sn)", "Ort. Konuşma"]}
                rows={(data?.queues || []).filter((r) => matchSearch(r, ["queue_extension", "queue_name"]))}
                renderRow={(r) => (
                  <tr key={r.queue_extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                      {r.queue_name} <span className="text-[11px] text-slate-400">({r.queue_extension})</span>
                    </td>
                    <td className="px-4 py-3 font-bold">{r.offered}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-semibold">{r.answered}</td>
                    <td className="px-4 py-3 font-semibold">{r.answered_in_sla}</td>
                    <td className="px-4 py-3 text-rose-500 font-semibold">{r.abandoned}</td>
                    <td className="px-4 py-3 text-slate-500">{r.short_abandoned}</td>
                    <td className="px-4 py-3">
                      <span className={`font-extrabold ${text}`}>%{r.sla_pct}</span>
                    </td>
                    <td className="px-4 py-3">{r.asa_seconds} sn</td>
                    <td className="px-4 py-3">{r.awt_seconds} sn</td>
                    <td className="px-4 py-3">{formatDuration(r.aht_seconds)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 6. REPEAT / CHRONIC CALLERS REPORT                             */}
          {/* ============================================================== */}
          {reportType === "repeat-callers" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiCard label="Tekil Dış Arayan" value={summary.unique_external_callers || 0} sub="Farklı telefon numarası" icon={Users} theme={{ lightBg, lightText }} />
                <KpiCard label={`Tekrar Arayan (${minRepeatCalls}+)`} value={`${summary.repeat_callers_count || 0} (%${summary.repeat_rate_pct || 0})`} sub={`Toplam ${summary.total_repeat_calls || 0} çağrı üretti`} icon={Repeat} theme={{ lightBg, lightText }} />
                <KpiCard label="Kronik Arayan (5+ Çağrı)" value={summary.critical_repeat_count || 0} sub="Yüksek memnuniyetsizlik riski" icon={AlertTriangle} alert={summary.critical_repeat_count > 0} theme={{ lightBg, lightText }} />
                <KpiCard label="Son Çağrısı Cevapsız" value={summary.unresolved_repeat_count || 0} sub="Acil geri dönüş önerilir" icon={PhoneMissed} alert={summary.unresolved_repeat_count > 0} theme={{ lightBg, lightText }} />
              </div>

              <DataTable
                ariaLabel="Tekrar Eden Arayanlar Tablosu"
                headers={["Telefon Numarası", "Rehber Kaydı", "Toplam Arama", "Cevaplanan", "Cevapsız", "Toplam Konuşma", "Farklı Temsilci", "Son Arama", "Son Durum", "Risk Seviyesi"]}
                rows={(data?.items || []).filter((r) => matchSearch(r, ["phone_number", "contact_name", "last_agent", "targets"]))}
                renderRow={(r) => (
                  <tr key={r.phone_number} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{r.phone_number}</td>
                    <td className="px-4 py-3">{r.contact_name}</td>
                    <td className={`px-4 py-3 text-center font-extrabold ${text}`}>{r.call_count}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.answered_count}</td>
                    <td className="px-4 py-3 text-center text-rose-500 font-semibold">{r.missed_count}</td>
                    <td className="px-4 py-3">{formatDuration(r.talk_seconds)}</td>
                    <td className="px-4 py-3 text-center">{r.distinct_agents}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.last_call}</td>
                    <td className="px-4 py-3">
                      {r.is_unresolved ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          Son Çağrı Cevapsız
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Yanıtlandı
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.risk_level === "critical"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            : r.risk_level === "high"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {r.risk_level === "critical" ? "Kritik (5+)" : r.risk_level === "high" ? "Yüksek (3+)" : "Orta (2+)"}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 7. DEPARTMENT, LOCATION & CALL PICKUP REPORT                   */}
          {/* ============================================================== */}
          {reportType === "dept-pickup" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiCard label="Aktif Departman" value={summary.departments_count || 0} sub="Trafik üreten birim" icon={Building2} theme={{ lightBg, lightText }} />
                <KpiCard label="Aktif Lokasyon / Şube" value={summary.locations_count || 0} sub="Konum bazlı dağılım" icon={Activity} theme={{ lightBg, lightText }} />
                <KpiCard label="Toplam Çekilen Çağrı (Pickup)" value={summary.total_picked_calls || 0} sub="*8 / **dahili ile kurtarılan" icon={CheckCircle2} theme={{ lightBg, lightText }} />
                <KpiCard label="Çağrı Toplayan Personel" value={summary.active_pickers_count || 0} sub={`${summary.pickup_groups_count || 0} toplama grubu tanımlı`} icon={Users} theme={{ lightBg, lightText }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DataTable
                  ariaLabel="Departman Bazlı Trafik"
                  headers={["Departman", "Gelen", "Giden", "Dahili", "Cevaplanan", "Cevapsız", "Konuşma"]}
                  rows={(data?.by_department || []).filter((r) => matchSearch(r, ["department"]))}
                  renderRow={(r) => (
                    <tr key={r.department} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.department}</td>
                      <td className="px-4 py-3 text-center">{r.inbound}</td>
                      <td className="px-4 py-3 text-center">{r.outbound}</td>
                      <td className="px-4 py-3 text-center">{r.internal}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.answered}</td>
                      <td className="px-4 py-3 text-center text-rose-500 font-semibold">{r.missed}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.talk_seconds)}</td>
                    </tr>
                  )}
                />

                <DataTable
                  ariaLabel="Lokasyon Bazlı Trafik"
                  headers={["Lokasyon / Şube", "Gelen", "Giden", "Dahili", "Cevaplanan", "Cevapsız", "Konuşma"]}
                  rows={(data?.by_location || []).filter((r) => matchSearch(r, ["location"]))}
                  renderRow={(r) => (
                    <tr key={r.location} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.location}</td>
                      <td className="px-4 py-3 text-center">{r.inbound}</td>
                      <td className="px-4 py-3 text-center">{r.outbound}</td>
                      <td className="px-4 py-3 text-center">{r.internal}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.answered}</td>
                      <td className="px-4 py-3 text-center text-rose-500 font-semibold">{r.missed}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.talk_seconds)}</td>
                    </tr>
                  )}
                />
              </div>

              <DataTable
                ariaLabel="Çağrı Toplama Liderlik Tablosu"
                headers={["Çağrıyı Çeken Personel", "Departman", "Toplama Grubu", "Çekilen Çağrı Adedi", "Toplam Konuşma Süresi"]}
                rows={(data?.by_picker || []).filter((r) => matchSearch(r, ["picker_extension", "picker_name", "department", "pickup_group"]))}
                renderRow={(r) => (
                  <tr key={r.picker_extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                      {r.picker_name} <span className="text-[11px] text-slate-400">({r.picker_extension})</span>
                    </td>
                    <td className="px-4 py-3">{r.department}</td>
                    <td className="px-4 py-3">{r.pickup_group}</td>
                    <td className={`px-4 py-3 font-extrabold ${text}`}>{r.picked_count} Çağrı</td>
                    <td className="px-4 py-3">{formatDuration(r.talk_seconds)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 8. WEBRTC & VOIP QUALITY (MOS) REPORT                          */}
          {/* ============================================================== */}
          {reportType === "voip-quality" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label="Ortalama MOS Puanı" value={`${summary.avg_mos ?? "4.40"} / 4.50`} sub="ITU-T G.107 E-Model" icon={Wifi} theme={{ lightBg, lightText }} />
                <KpiCard label="Ortalama Jitter" value={`${summary.avg_jitter_ms || 0} ms`} sub="Hedef: < 30 ms" icon={Activity} theme={{ lightBg, lightText }} />
                <KpiCard label="Paket Kaybı (Loss)" value={`%${summary.avg_packet_loss_pct || 0}`} sub="Hedef: < %1.0" icon={AlertTriangle} alert={(summary.avg_packet_loss_pct || 0) >= 2} theme={{ lightBg, lightText }} />
                <KpiCard label="Ortalama Gecikme (RTT)" value={`${summary.avg_rtt_ms || 0} ms`} sub="Uçtan uca RTP gecikmesi" icon={Clock} theme={{ lightBg, lightText }} />
                <KpiCard label="Analiz Edilen Medya" value={summary.total_analyzed_streams || 0} sub={`${summary.live_webrtc_samples || 0} canlı WebRTC örneği`} icon={Headphones} theme={{ lightBg, lightText }} />
              </div>

              {(data?.by_extension || []).length > 0 && (
                <DataTable
                  ariaLabel="Dahili Bazlı Ses Kalitesi"
                  headers={["Dahili / Temsilci", "Çağrı Adedi", "Ort. MOS", "Ort. Jitter (ms)", "Ort. Paket Kaybı (%)", "Ort. RTT (ms)", "Sorunlu Çağrı"]}
                  rows={(data?.by_extension || []).filter((r) => matchSearch(r, ["extension", "agent_name"]))}
                  renderRow={(r) => (
                    <tr key={r.extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        {r.agent_name} <span className="text-[11px] text-slate-400">({r.extension})</span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{r.calls}</td>
                      <td className="px-4 py-3">
                        <MosBadge mos={r.avg_mos} />
                      </td>
                      <td className="px-4 py-3">{r.avg_jitter_ms} ms</td>
                      <td className="px-4 py-3">%{r.avg_packet_loss_pct}</td>
                      <td className="px-4 py-3">{r.avg_rtt_ms} ms</td>
                      <td className="px-4 py-3 text-center">
                        {r.degraded_calls > 0 ? (
                          <span className="text-rose-500 font-bold">{r.degraded_calls}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">0</span>
                        )}
                      </td>
                    </tr>
                  )}
                />
              )}

              <DataTable
                ariaLabel="Çağrı Bazlı Ses Kalitesi (MOS) Kayıtları"
                headers={["Tarih / Saat", "Temsilci / Dahili", "Karşı Numara", "Yön", "MOS Puanı", "Jitter", "Paket Kaybı", "RTT", "Kodek", "Kaynak"]}
                rows={(data?.items || []).filter((r) => matchSearch(r, ["extension", "agent_name", "remote_number", "codec"]))}
                renderRow={(r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.timestamp}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                      {r.agent_name} {r.extension !== "-" ? `(${r.extension})` : ""}
                    </td>
                    <td className="px-4 py-3">{r.remote_number}</td>
                    <td className="px-4 py-3 uppercase text-[11px] font-semibold">{r.direction === "inbound" ? "Gelen" : "Giden"}</td>
                    <td className="px-4 py-3">
                      <MosBadge mos={r.mos_score} />
                    </td>
                    <td className="px-4 py-3">{r.jitter_ms} ms</td>
                    <td className="px-4 py-3">%{r.packet_loss_pct}</td>
                    <td className="px-4 py-3">{r.rtt_ms} ms</td>
                    <td className="px-4 py-3 text-[11px] font-mono">{r.codec}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {r.source === "webrtc_rtcstats" ? "WebRTC Canlı" : "SIP Medya"}
                    </td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 9. CALL FORWARDING (FOLLOW-ME / GSM) REPORT                    */}
          {/* ============================================================== */}
          {reportType === "forwarding-gsm" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="Aktif Yönlendirme Kuralı"
                  value={`${summary.active_forwarding_users || 0} / ${summary.total_subscribers || 0}`}
                  sub={`${summary.mobile_transfer_users || 0} mobil transfer açık`}
                  icon={Smartphone}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Yönlendirilen Çağrı"
                  value={summary.total_forwarded_calls || 0}
                  sub="Dış hat / GSM köprülenen"
                  icon={PhoneForwarded}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="GSM Cevaplanma Oranı"
                  value={`%${summary.answer_rate_pct || 0}`}
                  sub={`${summary.answered_forwarded_calls || 0} cevaplanan / ${summary.missed_forwarded_calls || 0} cevapsız`}
                  icon={CheckCircle2}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Dış Hat GSM Konuşma"
                  value={`${summary.total_gsm_minutes || 0} dk`}
                  sub="Operatör trunk tüketimi"
                  icon={Clock}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Tahmini Yönlendirme Maliyeti"
                  value={`₺${summary.estimated_cost_tl ?? "0.00"}`}
                  sub={`Birim tarife: ₺${summary.minute_rate_tl ?? minuteRateTl}/dk`}
                  icon={Activity}
                  theme={{ lightBg, lightText }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  Abone Yönlendirme Matrisi ({(data?.subscribers || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "logs"} onClick={() => setActiveSubView("logs")} bg={bg}>
                  Yönlendirilen Çağrı Kayıtları ({(data?.items || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "primary" ? (
                <DataTable
                  ariaLabel="Abone Yönlendirme Kuralları Matrisi"
                  headers={[
                    "Dahili / Abone",
                    "Kayıtlı GSM",
                    "Mobil Transfer",
                    "Her Zaman (*21*)",
                    "Meşgulde (*67*)",
                    "Cevapsızda (*61*)",
                    "Yönlendirilen",
                    "Cevaplanan",
                    "GSM Süre"
                  ]}
                  rows={(data?.subscribers || []).filter((r) =>
                    matchSearch(r, ["extension", "full_name", "gsm_number", "always_rule", "busy_rule", "no_answer_rule"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        {r.full_name} <span className="text-[11px] text-slate-400">({r.extension})</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">{r.gsm_number}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.mobile_transfer_enabled
                              ? `${lightBg} ${lightText}`
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {r.mobile_transfer_enabled ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.always_rule}</td>
                      <td className="px-4 py-3">{r.busy_rule}</td>
                      <td className="px-4 py-3">{r.no_answer_rule}</td>
                      <td className="px-4 py-3 text-center font-bold">{r.forwarded_calls}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.answered_calls}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.talk_seconds)}</td>
                    </tr>
                  )}
                />
              ) : (
                <DataTable
                  ariaLabel="Yönlendirilen Çağrı Kayıtları"
                  headers={["Tarih / Saat", "Arayan Numara", "Abone / Dahili", "Hedef GSM / Dış Numara", "Tetiklenen Kural", "Trunk", "Durum", "Konuşma"]}
                  rows={(data?.items || []).filter((r) =>
                    matchSearch(r, ["caller_number", "extension", "agent_name", "target_gsm", "rule_type", "trunk_name"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-4 py-3 font-mono">{r.caller_number}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        {r.agent_name} {r.extension !== "-" ? `(${r.extension})` : ""}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">{r.target_gsm}</td>
                      <td className="px-4 py-3">{r.rule_type}</td>
                      <td className="px-4 py-3 text-[11px]">{r.trunk_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === "answered"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {r.status === "answered" ? "Cevaplandı" : "Cevapsız"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.talk_seconds)}</td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 10. SUPERVISOR LISTEN / WHISPER / BARGE AUDIT REPORT           */}
          {/* ============================================================== */}
          {reportType === "supervisor-audit" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="Toplam Denetim / Müdahale"
                  value={summary.total_interventions || 0}
                  sub={`${summary.active_supervisors_count || 0} aktif süpervizör`}
                  icon={Eye}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label={`Sessiz Dinleme (${summary.feature_codes?.listen || "*551*"})`}
                  value={summary.listen_count || 0}
                  sub="Müşteri & temsilci duymaz"
                  icon={Headphones}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label={`Sufle / Fısıldama (${summary.feature_codes?.whisper || "*552*"})`}
                  value={summary.whisper_count || 0}
                  sub="Yalnızca temsilci duyar"
                  icon={MessageSquare}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label={`Araya Girme (${summary.feature_codes?.barge || "*553*"})`}
                  value={summary.barge_count || 0}
                  sub="Üçlü konferans müdahalesi"
                  icon={PhoneOutgoing}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Durum / Oturum Müdahalesi"
                  value={summary.status_override_count || 0}
                  sub={`Toplam dinleme: ${formatDuration(summary.total_monitor_seconds || 0)}`}
                  icon={Sliders}
                  theme={{ lightBg, lightText }}
                />
              </div>

              {(data?.by_supervisor || []).length > 0 && (
                <DataTable
                  ariaLabel="Süpervizör Bazlı Denetim Özeti"
                  headers={["Süpervizör", "Sessiz Dinleme", "Sufle / Fısıldama", "Araya Girme", "Durum Müdahalesi", "Toplam İşlem", "Dinleme Süresi"]}
                  rows={(data?.by_supervisor || []).filter((r) => matchSearch(r, ["supervisor"]))}
                  renderRow={(r) => (
                    <tr key={r.supervisor} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.supervisor}</td>
                      <td className="px-4 py-3 text-center">{r.listen}</td>
                      <td className="px-4 py-3 text-center">{r.whisper}</td>
                      <td className="px-4 py-3 text-center">{r.barge}</td>
                      <td className="px-4 py-3 text-center">{r.status_override}</td>
                      <td className={`px-4 py-3 text-center font-extrabold ${text}`}>{r.total}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.duration_seconds)}</td>
                    </tr>
                  )}
                />
              )}

              <DataTable
                ariaLabel="Kronolojik Süpervizör Müdahale Günlüğü"
                headers={["Tarih / Saat", "Süpervizör", "Müdahale Türü", "Hedef Temsilci / Dahili", "Süre", "Açıklama / Detay", "Kaynak IP"]}
                rows={(data?.items || []).filter((r) =>
                  matchSearch(r, ["supervisor", "type_label", "target_agent", "details", "ip_address"])
                )}
                renderRow={(r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap">{r.timestamp}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.supervisor}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${lightText}`}>
                        {r.type_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.target_agent}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.duration_seconds > 0 ? formatDuration(r.duration_seconds) : "-"}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={r.details}>{r.details}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{r.ip_address}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* 11. BLACKLIST, BLOCKED CALLS & PROFANITY SECURITY REPORT       */}
          {/* ============================================================== */}
          {reportType === "blacklist-security" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="Engellenen Çağrı Adedi"
                  value={summary.blocked_calls_count || 0}
                  sub="Kara liste / güvenlik reddi"
                  icon={ShieldAlert}
                  alert={(summary.blocked_calls_count || 0) > 0}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Uygunsuz Dil / Küfür Tespiti"
                  value={summary.profanity_incidents_count || 0}
                  sub={`${summary.active_block_words_count || 0} yasaklı kelime aktif`}
                  icon={AlertTriangle}
                  alert={(summary.profanity_incidents_count || 0) > 0}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Aktif Kara Liste Kuralı"
                  value={summary.active_blacklist_count || 0}
                  sub="Numara & e-posta engeli"
                  icon={Lock}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Tekil İhlalci Numara"
                  value={summary.unique_offenders_count || 0}
                  sub="Tekrarlayan spam / taciz"
                  icon={PhoneMissed}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Toplam Güvenlik Olayı"
                  value={summary.total_security_events || 0}
                  sub="Otomatik koruma kalkanı"
                  icon={Activity}
                  theme={{ lightBg, lightText }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  İhlal & Engelleme Kayıtları ({(data?.items || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "offenders"} onClick={() => setActiveSubView("offenders")} bg={bg}>
                  En Çok İhlal Yapan Numaralar ({(data?.top_offenders || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "rules"} onClick={() => setActiveSubView("rules")} bg={bg}>
                  Aktif Kara Liste Kuralları ({(data?.blacklist_rules || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "primary" && (
                <DataTable
                  ariaLabel="Engellenen Çağrı ve İhlal Kayıtları"
                  headers={["Tarih / Saat", "Arayan Numara", "Hedef Hat", "İhlal Türü", "Eşleşen Kural / Kelime", "Görüşme Özeti"]}
                  rows={(data?.items || []).filter((r) =>
                    matchSearch(r, ["caller_number", "callee_number", "incident_label", "matched_rule", "summary"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{r.caller_number}</td>
                      <td className="px-4 py-3 font-mono">{r.callee_number}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.incident_type === "blacklist"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {r.incident_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.matched_rule}</td>
                      <td className="px-4 py-3 max-w-sm truncate" title={r.summary}>{r.summary}</td>
                    </tr>
                  )}
                />
              )}

              {activeSubView === "offenders" && (
                <DataTable
                  ariaLabel="En Çok İhlal Yapan Numaralar"
                  headers={["Arayan Numara", "Toplam Deneme", "Kara Liste Reddi", "Küfür / Hakaret", "Son Görülme", "Gerekçe"]}
                  rows={(data?.top_offenders || []).filter((r) => matchSearch(r, ["caller_number", "reason"]))}
                  renderRow={(r) => (
                    <tr key={r.caller_number} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{r.caller_number}</td>
                      <td className="px-4 py-3 text-center font-extrabold text-rose-600">{r.attempts}</td>
                      <td className="px-4 py-3 text-center">{r.blocked_count}</td>
                      <td className="px-4 py-3 text-center">{r.profanity_count}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.last_seen}</td>
                      <td className="px-4 py-3">{r.reason}</td>
                    </tr>
                  )}
                />
              )}

              {activeSubView === "rules" && (
                <DataTable
                  ariaLabel="Aktif Kara Liste Kuralları"
                  headers={["Engellenen Numara / Değer", "Tip", "Engellenme Gerekçesi", "Eklenme Tarihi", "Dönem İçi Yakalanan"]}
                  rows={(data?.blacklist_rules || []).filter((r) => matchSearch(r, ["value", "reason", "type"]))}
                  renderRow={(r) => (
                    <tr key={r.value} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">{r.value}</td>
                      <td className="px-4 py-3 uppercase text-[11px]">{r.type}</td>
                      <td className="px-4 py-3">{r.reason}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.created_at}</td>
                      <td className="px-4 py-3 text-center font-bold">{r.hit_count}</td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 12. AI APPOINTMENTS & RAG KNOWLEDGE BASE REPORT                */}
          {/* ============================================================== */}
          {reportType === "ai-appointments-rag" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="AI Onaylı Randevu"
                  value={summary.confirmed_appointments || 0}
                  sub={`${summary.upcoming_appointments || 0} yaklaşan / ${summary.cancelled_appointments || 0} iptal`}
                  icon={Calendar}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Randevu Dönüşüm Oranı"
                  value={`%${summary.appointment_conversion_pct || 0}`}
                  sub={`${summary.ai_calls_count || 0} AI görüşmesi üzerinden`}
                  icon={Award}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="AI Otonom Çözüm Oranı"
                  value={`%${summary.ai_autonomous_rate_pct ?? 100}`}
                  sub={`${summary.human_transfer_count || 0} canlı temsilciye aktarım`}
                  icon={Bot}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Bilgi Bankası Kaynağı"
                  value={summary.rag_sources_count || 0}
                  sub="Doküman & Web URL kaynağı"
                  icon={Database}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Vektör Bilgi Parçası (Chunk)"
                  value={summary.rag_chunks_count || 0}
                  sub="pgvector 768-dim indeksli"
                  icon={CheckCircle2}
                  theme={{ lightBg, lightText }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  AI Randevu Listesi ({(data?.appointments || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "rag"} onClick={() => setActiveSubView("rag")} bg={bg}>
                  Bilgi Bankası (RAG) Kaynakları ({(data?.rag_sources || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "gaps"} onClick={() => setActiveSubView("gaps")} bg={bg}>
                  Aktarım & Bilgi Açığı Analizi ({(data?.knowledge_gaps || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "primary" && (
                <DataTable
                  ariaLabel="AI Tarafından Oluşturulan Randevular"
                  headers={["Randevu Zamanı", "Müşteri Adı", "Telefon", "E-Posta", "Durum", "Notlar / Detay"]}
                  rows={(data?.appointments || []).filter((r) =>
                    matchSearch(r, ["customer_name", "customer_phone", "customer_email", "notes", "status"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800 dark:text-white">{r.appointment_time}</td>
                      <td className="px-4 py-3 font-semibold">{r.customer_name}</td>
                      <td className="px-4 py-3 font-mono">{r.customer_phone}</td>
                      <td className="px-4 py-3">{r.customer_email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === "cancelled"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {r.status === "cancelled" ? "İptal Edildi" : "Onaylı"}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={r.notes}>{r.notes}</td>
                    </tr>
                  )}
                />
              )}

              {activeSubView === "rag" && (
                <DataTable
                  ariaLabel="Bilgi Bankası (RAG) Kaynak Envanteri"
                  headers={["Doküman / Web URL Kaynağı", "Kaynak Türü", "Vektör Parça (Chunk)", "Karakter Boyutu", "Tahmini Token"]}
                  rows={(data?.rag_sources || []).filter((r) => matchSearch(r, ["filename", "source_type"]))}
                  renderRow={(r) => (
                    <tr key={r.filename} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white max-w-md truncate" title={r.filename}>
                        {r.filename}
                      </td>
                      <td className="px-4 py-3">{r.source_type}</td>
                      <td className={`px-4 py-3 font-extrabold ${text}`}>{r.chunk_count}</td>
                      <td className="px-4 py-3">{(r.char_count || 0).toLocaleString("tr-TR")} kr</td>
                      <td className="px-4 py-3">~{(r.est_tokens || 0).toLocaleString("tr-TR")} tok</td>
                    </tr>
                  )}
                />
              )}

              {activeSubView === "gaps" && (
                <DataTable
                  ariaLabel="AI Temsilci Aktarım ve Bilgi Açığı Analizi"
                  headers={["Tarih / Saat", "Arayan Numara", "Tespit Nedeni", "Konu / Niyet", "Duygu", "AI Görüşme Özeti"]}
                  rows={(data?.knowledge_gaps || []).filter((r) =>
                    matchSearch(r, ["caller_number", "reason", "topic", "summary"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-4 py-3 font-mono">{r.caller_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          {r.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.topic}</td>
                      <td className="px-4 py-3">{r.sentiment}</td>
                      <td className="px-4 py-3 max-w-sm truncate" title={r.summary}>{r.summary}</td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 13. VOICEMAIL & CALLBACK FOLLOW-UP REPORT                      */}
          {/* ============================================================== */}
          {reportType === "voicemail" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="Sesli Posta Aktif Dahili"
                  value={`${summary.voicemail_enabled_users || 0} / ${summary.total_extensions || 0}`}
                  sub={`${summary.voicemail_email_users || 0} e-posta iletimi açık`}
                  icon={Mail}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Bırakılan Sesli Mesaj"
                  value={summary.total_voicemails || 0}
                  sub={`Ort. süre: ${formatDuration(summary.avg_duration_sec || 0)}`}
                  icon={PhoneIncoming}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Geri Dönüş Yapılan"
                  value={summary.returned_callbacks || 0}
                  sub="Müşteriye geri arandı"
                  icon={CheckCircle2}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Bekleyen Sesli Mesaj"
                  value={summary.pending_callbacks || 0}
                  sub="Henüz geri dönüş yapılmadı"
                  icon={AlertTriangle}
                  alert={(summary.pending_callbacks || 0) > 0}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Geri Dönüş Oranı"
                  value={`%${summary.callback_rate_pct ?? 100}`}
                  sub="Sesli mesaj SLA takibi"
                  icon={Award}
                  theme={{ lightBg, lightText }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SubTabButton active={activeSubView === "primary"} onClick={() => setActiveSubView("primary")} bg={bg}>
                  Bırakılan Sesli Mesajlar ({(data?.items || []).length})
                </SubTabButton>
                <SubTabButton active={activeSubView === "boxes"} onClick={() => setActiveSubView("boxes")} bg={bg}>
                  Dahili Posta Kutusu Durumu ({(data?.by_extension || []).length})
                </SubTabButton>
              </div>

              {activeSubView === "primary" ? (
                <DataTable
                  ariaLabel="Bırakılan Sesli Posta Kayıtları"
                  headers={["Tarih / Saat", "Arayan Numara", "Posta Kutusu (Dahili)", "Mesaj Süresi", "E-Posta İletimi", "Geri Dönüş Durumu", "Dönüş Yapan / Zaman"]}
                  rows={(data?.items || []).filter((r) =>
                    matchSearch(r, ["caller_number", "extension", "agent_name", "callback_by"])
                  )}
                  renderRow={(r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">{r.caller_number}</td>
                      <td className="px-4 py-3">
                        {r.agent_name} {r.extension !== "-" ? `(${r.extension})` : ""}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.duration_seconds)}</td>
                      <td className="px-4 py-3">{r.email_forwarded ? "Gönderildi" : "Kapalı"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.callback_done
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {r.callback_done ? "Geri Arandı" : "Bekliyor"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {r.callback_done ? `${r.callback_by} (${r.callback_at})` : "-"}
                      </td>
                    </tr>
                  )}
                />
              ) : (
                <DataTable
                  ariaLabel="Dahili Sesli Posta Kutuları"
                  headers={["Dahili / Abone", "E-Posta Adresi", "Sesli Posta", "E-Postaya İlet", "Gelen Mesaj", "Dönüş Yapılan", "Bekleyen"]}
                  rows={(data?.by_extension || []).filter((r) => matchSearch(r, ["extension", "full_name", "email"]))}
                  renderRow={(r) => (
                    <tr key={r.extension} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                        {r.full_name} <span className="text-[11px] text-slate-400">({r.extension})</span>
                      </td>
                      <td className="px-4 py-3">{r.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.voicemail_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {r.voicemail_active ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.voicemail_to_email ? "Açık" : "Kapalı"}</td>
                      <td className="px-4 py-3 text-center font-bold">{r.messages_count}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.returned_count}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-semibold">{r.pending_count}</td>
                    </tr>
                  )}
                />
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 14. CONFERENCE ROOM UTILIZATION REPORT                         */}
          {/* ============================================================== */}
          {reportType === "conferences" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard
                  label="Tanımlı Konferans Odası"
                  value={summary.configured_rooms_count || 0}
                  sub={`${summary.active_rooms_count || 0} oda dönemde kullanıldı`}
                  icon={Building2}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Gerçekleşen Toplantı"
                  value={summary.total_sessions || 0}
                  sub={`Ort. oturum: ${summary.avg_session_minutes || 0} dk`}
                  icon={Calendar}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Toplam Katılımcı Girişi"
                  value={summary.total_participant_legs || 0}
                  sub="Dahili & dış hat katılımcılar"
                  icon={Users}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Zirve Eşzamanlı Katılımcı"
                  value={summary.peak_participants || 0}
                  sub="Tek toplantıda en yüksek"
                  icon={Award}
                  theme={{ lightBg, lightText }}
                />
                <KpiCard
                  label="Toplam Konferans Dakikası"
                  value={`${summary.total_conference_minutes || 0} dk`}
                  sub="Katılımcı toplam ses süresi"
                  icon={Clock}
                  theme={{ lightBg, lightText }}
                />
              </div>

              <DataTable
                ariaLabel="Konferans Odaları Envanter ve Kullanım Özeti"
                headers={["Oda No", "Konferans Odası Adı", "PIN Koruması", "Ses Kaydı", "Kapasite", "Toplantı Sayısı", "Toplam Katılımcı", "Toplam Dakika", "Son Kullanım"]}
                rows={(data?.rooms || []).filter((r) => matchSearch(r, ["room_number", "name"]))}
                renderRow={(r) => (
                  <tr key={r.room_number} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className={`px-4 py-3 font-mono font-extrabold ${text}`}>{r.room_number}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{r.name}</td>
                    <td className="px-4 py-3">{r.pin_protected ? "PIN Korumalı" : "Açık"}</td>
                    <td className="px-4 py-3">{r.record_enabled ? "Aktif" : "Pasif"}</td>
                    <td className="px-4 py-3 text-center">{r.max_members} Kişi</td>
                    <td className="px-4 py-3 text-center font-bold">{r.sessions_count}</td>
                    <td className="px-4 py-3 text-center">{r.participants_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">{r.total_minutes} dk</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.last_used_at}</td>
                  </tr>
                )}
              />

              <DataTable
                ariaLabel="Gerçekleşen Konferans Oturumları"
                headers={["Oda", "Başlangıç", "Bitiş", "Katılımcı Adedi", "Katılımcı Numaralar / Dahililer", "Toplantı Süresi", "Toplam Bacak Süresi"]}
                rows={(data?.sessions || []).filter((r) =>
                  matchSearch(r, ["room_number", "room_name", "participant_numbers"])
                )}
                renderRow={(r) => (
                  <tr key={r.session_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">
                      {r.room_name} <span className="text-[11px] text-slate-400">({r.room_number})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.start_time}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.end_time}</td>
                    <td className={`px-4 py-3 text-center font-extrabold ${text}`}>{r.participants_count}</td>
                    <td className="px-4 py-3 font-mono text-[11px] max-w-xs truncate" title={r.participant_numbers}>
                      {r.participant_numbers}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.duration_seconds)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.total_leg_seconds)}</td>
                  </tr>
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, alert = false, theme }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p
          className={`text-lg font-extrabold mt-1 tracking-tight ${
            alert ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {Icon && (
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            alert ? "bg-rose-50 dark:bg-rose-950/40 text-rose-500" : `${theme.lightBg} ${theme.lightText}`
          }`}
        >
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}

function SubTabButton({ active, onClick, bg, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
        active
          ? `${bg} text-white shadow-sm`
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function MosBadge({ mos }) {
  const m = Number(mos || 0);
  const cls =
    m >= 4.0
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
      : m >= 3.6
      ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
      : m >= 3.1
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${cls}`}>{m.toFixed(2)}</span>;
}

function DataTable({ headers, rows, renderRow, ariaLabel }) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto max-h-[540px] overflow-y-auto focus:outline-none"
    >
      <table className="w-full text-left border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
          {rows && rows.length > 0 ? (
            rows.map((r, i) => renderRow(r, i))
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                Seçilen tarih aralığı ve kriterlere uygun kayıt bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
