import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal,
  X,
  RefreshCw,
  Clock,
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Key,
  KeyRound,
  Search,
  LogIn,
  LogOut,
  Trash2,
  Edit3,
  Layers,
  Unlock,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Check
} from "lucide-react";

const ACTION_META = {
  LICENSE_GENERATE: {
    label: "Lisans Üretildi",
    category: "license",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: Key
  },
  CLIENT_CREATE: {
    label: "Yeni Müşteri",
    category: "license",
    badge: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: Layers
  },
  CLIENT_UPDATE: {
    label: "Müşteri Güncellendi",
    category: "license",
    badge: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    icon: Edit3
  },
  CLIENT_SUSPEND: {
    label: "Müşteri Askıya Alındı",
    category: "license",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: ShieldAlert
  },
  CLIENT_DELETE: {
    label: "Müşteri Silindi",
    category: "license",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: Trash2
  },
  SUBDOMAIN_UNLOCK: {
    label: "Alan Adı Kilidi Açıldı",
    category: "license",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: Unlock
  },
  PACKAGE_TEMPLATE_UPDATE: {
    label: "Paket Şablonu Güncellendi",
    category: "license",
    badge: "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/30",
    icon: Layers
  },
  PACKAGE_TEMPLATE_RESET: {
    label: "Paket Şablonu Sıfırlandı",
    category: "license",
    badge: "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    icon: RefreshCw
  },
  OTA_UPDATE: {
    label: "Uzaktan Güncelleme",
    category: "system",
    badge: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    icon: RefreshCw
  },
  SSH_CONTROL: {
    label: "SSH Erişim Ayarı",
    category: "system",
    badge: "bg-teal-500/12 text-teal-700 dark:text-teal-300 border-teal-500/30",
    icon: Terminal
  },
  ROOT_SSO_LOGIN: {
    label: "Santrale Direkt Giriş",
    category: "auth",
    badge: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/30",
    icon: ShieldCheck
  },
  USER_LOGIN: {
    label: "Oturum Açıldı",
    category: "auth",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: LogIn
  },
  USER_LOGIN_2FA: {
    label: "2FA ile Giriş",
    category: "auth",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: ShieldCheck
  },
  USER_LOGIN_FAILED: {
    label: "Hatalı Giriş Denemesi",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: AlertTriangle
  },
  USER_LOGOUT: {
    label: "Oturum Kapatıldı",
    category: "auth",
    badge: "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300/70 dark:border-slate-700",
    icon: LogOut
  },
  AUTO_LOGOUT: {
    label: "Otomatik Oturum Çıkışı",
    category: "auth",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: Clock
  },
  USER_CREATE: {
    label: "Yeni Kullanıcı",
    category: "system",
    badge: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: User
  },
  USER_UPDATE: {
    label: "Kullanıcı Güncellendi",
    category: "system",
    badge: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    icon: Edit3
  },
  USER_DELETE: {
    label: "Kullanıcı Silindi",
    category: "system",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: Trash2
  },
  USER_PASSWORD_CHANGE: {
    label: "Şifre Değiştirildi",
    category: "security",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: KeyRound
  },
  USER_AUTO_LOGOUT_PREF: {
    label: "Otomatik Oturum Ayarı",
    category: "security",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: Clock
  },
  USER_2FA_CONFIG: {
    label: "2FA Yapılandırıldı",
    category: "security",
    badge: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    icon: ShieldCheck
  },
  USER_2FA_ENABLED: {
    label: "2FA Etkinleştirildi",
    category: "security",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: ShieldCheck
  },
  USER_2FA_DISABLED: {
    label: "2FA Kapatıldı",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: ShieldAlert
  },
  USER_2FA_EMAIL_DISABLED: {
    label: "E-Posta 2FA Kapatıldı",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: ShieldAlert
  },
  USER_2FA_FAILED: {
    label: "Hatalı 2FA Kodu",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: AlertTriangle
  },
  SECURITY_POLICY_UPDATE: {
    label: "Güvenlik Politikası",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: Shield
  },
  BRUTE_FORCE_BAN: {
    label: "Otomatik IP Engeli",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: ShieldAlert
  },
  IP_MANUAL_BAN: {
    label: "Manuel IP Engeli",
    category: "security",
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: ShieldAlert
  },
  IP_UNBAN: {
    label: "IP Engeli Kaldırıldı",
    category: "security",
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: ShieldCheck
  }
};

const FILTER_TABS = [
  { id: "all", label: "Tümü" },
  { id: "auth", label: "Oturum & Giriş" },
  { id: "license", label: "Lisans & Müşteri" },
  { id: "security", label: "Güvenlik & 2FA" },
  { id: "system", label: "Sistem & Sunucu" }
];

function formatTurkishDetail(rawText) {
  if (!rawText) return "—";
  let txt = String(rawText);

  // Compact gigantic Base64 quota payload inside AIDA-... license keys so rows stay clean
  txt = txt.replace(/(AIDA-[A-Z0-9-]+)\.[A-Za-z0-9_-]{16,}/g, "$1");

  // Humanize stray English labels in historical logs
  txt = txt
    .replace(/Yeni Lisans Key Üretildi/g, "Yeni Lisans Anahtarı Üretildi")
    .replace(/\bKey=/g, "Anahtar: ")
    .replace(/\bBitiş=/g, "Bitiş: ")
    .replace(/\bHW=/g, "Donanım: ")
    .replace(/\bMaxHata=/g, "Maks. Hata: ")
    .replace(/\bBlokSüresi=/g, "Engel Süresi: ")
    .replace(/\bAutoLogout=/g, "Oto-Çıkış: ")
    .replace(/\bSubdomain:/g, "Alt Alan Adı:")
    .replace(/Eski Subdomain:/g, "Eski Alt Alan Adı:")
    .replace(/Root SSO Girişi Başlatıldı/g, "Merkezden Direkt Giriş Başlatıldı")
    .replace(/Uzaktan OTA Güncelleme Başlatıldı/g, "Uzaktan Güncelleme Başlatıldı")
    .replace(/Durum=active/g, "Durum: Aktif")
    .replace(/Durum=suspended/g, "Durum: Askıda")
    .replace(/Durum=passive/g, "Durum: Pasif");

  return txt;
}

function formatDateTimeParts(isoStr) {
  if (!isoStr) return { date: "—", time: "" };
  try {
    const d = new Date(isoStr);
    const date = d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const time = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    return { date, time };
  } catch (e) {
    return { date: String(isoStr), time: "" };
  }
}

export default function AuditLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
      setCurrentPage(1);
      setExpandedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch audit logs error:", e);
    } finally {
      setLoading(false);
    }
  };

  const getActionMeta = (actionCode) => {
    if (ACTION_META[actionCode]) return ACTION_META[actionCode];
    return {
      label: String(actionCode || "Sistem İşlemi").replace(/_/g, " "),
      category: "system",
      badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      icon: Terminal
    };
  };

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const meta = getActionMeta(log.action);
      if (categoryFilter !== "all" && meta.category !== categoryFilter) return false;
      if (!q) return true;
      const cleanDetail = formatTurkishDetail(log.details).toLowerCase();
      return (
        String(log.username || "").toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        cleanDetail.includes(q) ||
        String(log.ip_address || "").toLowerCase().includes(q)
      );
    });
  }, [logs, searchTerm, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(pageStart, pageStart + pageSize);

  const handleCopyRaw = (e, log) => {
    e.stopPropagation();
    const copyStr = `[${log.created_at || ""}] @${log.username} | ${getActionMeta(log.action).label} | IP: ${log.ip_address || "-"} | ${log.details || ""}`;
    navigator.clipboard?.writeText(copyStr);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Terminal size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  İşlem ve Denetim Kayıtları
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                  {filteredLogs.length} Kayıt
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Merkezi yönetim panelindeki tüm kullanıcı işlemleri, lisans hareketleri ve güvenlik kayıtları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {FILTER_TABS.map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative sm:w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Kullanıcı, işlem veya detay ara..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-y-auto flex-1">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400">
              İşlem kayıtları yükleniyor...
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Terminal size={20} />
              </div>
              <div className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                Eşleşen İşlem Kaydı Bulunamadı
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Farklı bir kategori seçebilir veya arama filtresini temizleyebilirsiniz.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 pl-6 pr-3 w-[128px]">Tarih / Saat</th>
                  <th className="py-3 px-3 w-[145px]">Kullanıcı</th>
                  <th className="py-3 px-3 w-[190px]">İşlem Türü</th>
                  <th className="py-3 px-3">İşlem Özeti</th>
                  <th className="py-3 pl-3 pr-6 w-[135px] text-right">IP Adresi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {paginatedLogs.map((log) => {
                  const meta = getActionMeta(log.action);
                  const IconComp = meta.icon || Terminal;
                  const dt = formatDateTimeParts(log.created_at);
                  const cleanDetail = formatTurkishDetail(log.details);
                  const isExpanded = expandedId === log.id;
                  const uname = String(log.username || "sistem");
                  const initials = uname.slice(0, 2).toUpperCase();

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className={`transition-colors cursor-pointer align-middle ${
                          isExpanded
                            ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                            : "hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                        }`}
                        title="Tam detayı görmek için tıklayın"
                      >
                        {/* Tarih / Saat */}
                        <td className="py-3 pl-6 pr-3 whitespace-nowrap">
                          <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {dt.date}
                          </div>
                          <div className="font-mono text-[10px] font-semibold text-slate-400 mt-0.5">
                            {dt.time}
                          </div>
                        </td>

                        {/* Kullanıcı */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                              {initials}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                              @{uname}
                            </span>
                          </div>
                        </td>

                        {/* İşlem Türü */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border max-w-full ${meta.badge}`}
                          >
                            <IconComp size={11} className="shrink-0" />
                            <span className="truncate">{meta.label}</span>
                          </span>
                        </td>

                        {/* İşlem Özeti */}
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug line-clamp-2 break-words min-w-0">
                              {cleanDetail}
                            </p>
                            <ChevronDown
                              size={13}
                              className={`text-slate-400 shrink-0 transition-transform ${
                                isExpanded ? "rotate-180 text-indigo-500" : ""
                              }`}
                            />
                          </div>
                        </td>

                        {/* IP Adresi */}
                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold">
                            <Globe size={10} className="opacity-70" />
                            <span>{log.ip_address || "127.0.0.1"}</span>
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-950/70">
                          <td colSpan={5} className="px-6 py-3.5 border-t border-slate-200/60 dark:border-slate-800/70">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                  Tam İşlem Detayı
                                </div>
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 break-all leading-relaxed">
                                  {cleanDetail}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleCopyRaw(e, log)}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:mt-5"
                              >
                                {copiedId === log.id ? (
                                  <>
                                    <Check size={13} className="text-emerald-500" />
                                    <span>Kopyalandı</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>Kaydı Kopyala</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-semibold">
            Gösterilen:{" "}
            <strong className="font-mono text-slate-900 dark:text-white">
              {filteredLogs.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageSize, filteredLogs.length)}
            </strong>{" "}
            / <strong className="font-mono text-slate-900 dark:text-white">{filteredLogs.length}</strong> kayıt
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-[11px] cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>Önceki</span>
            </button>
            <span className="px-2.5 py-1 font-mono text-xs font-extrabold text-slate-700 dark:text-slate-200">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-[11px] cursor-pointer"
            >
              <span>Sonraki</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
