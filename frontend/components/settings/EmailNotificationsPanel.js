import React, { useState, useEffect } from "react";
import {
  Mail,
  MessageSquare,
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Server,
  KeyRound,
  Cpu,
  PhoneCall,
  Bot,
  Cable,
  RefreshCw,
  Send,
  Save,
  Trash2,
  Clock,
  Settings2,
  Info,
  Check,
  Filter
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

const DEFAULT_EVENTS_META = [
  {
    key: "trunk_status_change",
    title: "Dış Hat (SIP Trunk) Bağlandığında veya Koptuğunda",
    description: "Operatör SIP Trunk hatlarından biri koptuğunda (Unreachable/Rejected) veya tekrar bağlandığında (Reachable) anında bildirim gönderir.",
    category: "Santral & Ses",
    severity: "critical",
    icon: Cable
  },
  {
    key: "concurrent_channels_full",
    title: "Eş Zamanlı Çağrı Kanalı Dolduğunda veya Tolerans Kanalı Devreye Girdiğinde",
    description: "Lisansınızda tanımlı eş zamanlı çağrı kanalı (AI Agent + Otomatik Arama Dialer + Kullanıcı) tam kapasiteye ulaştığında, +Tolerans Eş Zamanlı Çağrı Kanalı devreye girdiğinde veya çağrı reddedildiğinde E-Posta / WhatsApp ile uyarır.",
    category: "Kapasite & Çağrı",
    severity: "critical",
    icon: PhoneCall
  },
  {
    key: "ai_provider_error_or_quota",
    title: "AI Agent STT, TTS ve LLM Bağlantı Sorunlarında ve Kotaları Dolduğunda",
    description: "Gemini, OpenAI, ElevenLabs veya Deepgram servislerinde bağlantı hatası, API anahtarı reddi veya bütçe/kota aşımı yaşandığında bildirir.",
    category: "Yapay Zeka (AI)",
    severity: "critical",
    icon: Bot
  },
  {
    key: "system_reboot",
    title: "Sistem Reboot Edildiğinde / Servisler Başlatıldığında",
    description: "Sunucu yeniden başlatıldığında veya AIDA ana arka plan servisleri (Backend / AudioSocket) ayağa kalktığında durum bilgisi gönderir.",
    category: "Sistem & Sunucu",
    severity: "warning",
    icon: RefreshCw
  },
  {
    key: "license_updated",
    title: "Lisans Güncelleme İşlemi Olduğunda",
    description: "Merkezi lisans sunucusundan veya panel üzerinden lisans anahtarı, kanal limitleri ya da AI yetenekleri güncellendiğinde bilgilendirir.",
    category: "Lisans & Güvenlik",
    severity: "info",
    icon: KeyRound
  },
  {
    key: "license_limit_reached",
    title: "Lisanslar Son Limite Ulaştığında veya Süresi Dolmak Üzereyken",
    description: "Kullanıcı, AI dakika/kredi kotası, eş zamanlı kanal limiti dolduğunda veya lisans bitiş tarihine 7 günden az kaldığında uyarır.",
    category: "Lisans & Güvenlik",
    severity: "critical",
    icon: KeyRound
  },
  {
    key: "service_health_error",
    title: "Sistem Genelinde Bir Serviste Sorun Oluştuğunda",
    description: "Asterisk AMI, AudioSocket ses motoru, PostgreSQL veritabanı veya ses kayıt (NAS/Disk) biriminde erişim kaybı tespit edildiğinde acil uyarı verir.",
    category: "Sistem & Sunucu",
    severity: "critical",
    icon: Server
  },
  {
    key: "system_resource_high",
    title: "Sunucu Disk, CPU veya RAM Kullanımı Kritik Eşiği (%90+) Aştığında",
    description: "Ses kayıtlarının diski doldurması veya aşırı yük nedeniyle bellek/işlemci kullanımının %90'ı aşması durumunda uyarır.",
    category: "Sistem & Sunucu",
    severity: "warning",
    icon: Cpu
  },
  {
    key: "security_login_failed",
    title: "Güvenlik & Başarısız Giriş / IP Engelleme (Fail2Ban) Uyarıları",
    description: "Panele veya SIP santraline yönelik şüpheli art arda başarısız giriş denemeleri ve otomatik IP engellemelerinde bilgilendirir.",
    category: "Lisans & Güvenlik",
    severity: "warning",
    icon: ShieldAlert
  },
  {
    key: "abuse_blacklist_triggered",
    title: "Çağrıda Küfür/Hakaret Algılanıp Numara Kara Listeye Alındığında",
    description: "AI Abuse Shield tarafından arayan kişinin küfür/hakaret ettiği tespit edilip numara otomatik kara listeye eklendiğinde bildirir.",
    category: "Santral & Ses",
    severity: "warning",
    icon: AlertTriangle
  },
  {
    key: "dialer_campaign_status",
    title: "Otomatik Arama (Dialer) Kampanyası Başladığında / Tamamlandığında",
    description: "Dış arama kampanyaları başladığında, duraklatıldığında veya listedeki tüm numaralar aranıp tamamlandığında özet rapor gönderir.",
    category: "Kapasite & Çağrı",
    severity: "info",
    icon: PhoneCall
  },
  {
    key: "emergency_human_transfer",
    title: "Kriz / Öfke Tespiti Nedeniyle Canlı Temsilciye Acil Aktarım Yapıldığında",
    description: "Müşteri duygu durumu kritik öfke seviyesine ulaşıp AI tarafından acil olarak insan temsilciye aktarıldığında uyarır.",
    category: "Yapay Zeka (AI)",
    severity: "warning",
    icon: Bot
  }
];

export default function EmailNotificationsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success' | 'error', text: '' }
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  // Permissions
  const [canWrite, setCanWrite] = useState(true);
  const [canDelete, setCanDelete] = useState(true);

  const [config, setConfig] = useState({
    enabled: true,
    email_enabled: true,
    email_recipients: "",
    whatsapp_enabled: false,
    whatsapp_recipients: "",
    use_custom_smtp: false,
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_from_name: "AIDA Sistem Bildirimi",
    cooldown_minutes: 5,
    events: {},
    history: []
  });

  const getHeaders = () => {
    const tenantId =
      (typeof window !== "undefined" &&
        (localStorage.getItem("selected_tenant_id") ||
          sessionStorage.getItem("selected_tenant_id"))) ||
      "tenant-default";
    const userId =
      (typeof window !== "undefined" &&
        (localStorage.getItem("current_user_id") ||
          sessionStorage.getItem("current_user_id"))) ||
      "admin";
    return {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
      "X-User-ID": userId
    };
  };

  useEffect(() => {
    fetchNotificationSettings();
    checkUserPermissions();
  }, [backendHost]);

  const checkUserPermissions = async () => {
    try {
      const savedUserId =
        localStorage.getItem("current_user_id") ||
        sessionStorage.getItem("current_user_id");
      if (!savedUserId || savedUserId === "admin") {
        setCanWrite(true);
        setCanDelete(true);
        return;
      }
      const resUsers = await fetch(`/api/settings/users?t=${Date.now()}`, {
        headers: getHeaders()
      });
      const usersData = await resUsers.json();
      const userList = Array.isArray(usersData) ? usersData : usersData?.users || [];
      const currentUser = userList.find(
        (u) => String(u.id) === String(savedUserId) || u.extension === savedUserId
      );
      if (!currentUser || currentUser.role === "admin" || currentUser.role === "superadmin") {
        setCanWrite(true);
        setCanDelete(true);
        return;
      }
      const resRoles = await fetch(`/api/settings/roles?t=${Date.now()}`, {
        headers: getHeaders()
      });
      const rolesData = await resRoles.json();
      const roleList = Array.isArray(rolesData) ? rolesData : rolesData?.roles || [];
      const currentRole = roleList.find((r) => r.role_code === currentUser.role);
      if (!currentRole) return;
      const perms = currentRole.permissions || [];
      setCanWrite(perms.includes("email_notifications:write"));
      setCanDelete(perms.includes("email_notifications:delete"));
    } catch (e) {
      console.error("Permission check error:", e);
    }
  };

  const fetchNotificationSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/notifications?t=${Date.now()}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const mergedEvents = {};
        DEFAULT_EVENTS_META.forEach((meta) => {
          const existing = data?.events?.[meta.key] || {};
          mergedEvents[meta.key] = {
            title: existing.title || meta.title,
            description: existing.description || meta.description,
            category: existing.category || meta.category,
            severity: existing.severity || meta.severity,
            enabled: existing.enabled !== undefined ? existing.enabled : true,
            email: existing.email !== undefined ? existing.email : true,
            whatsapp: existing.whatsapp !== undefined ? existing.whatsapp : false
          };
        });
        setConfig({
          enabled: data.enabled !== undefined ? data.enabled : true,
          email_enabled: data.email_enabled !== undefined ? data.email_enabled : true,
          email_recipients: data.email_recipients || "",
          whatsapp_enabled: data.whatsapp_enabled !== undefined ? data.whatsapp_enabled : false,
          whatsapp_recipients: data.whatsapp_recipients || "",
          use_custom_smtp: data.use_custom_smtp || false,
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || "",
          smtp_password: data.smtp_password || "",
          smtp_from_name: data.smtp_from_name || "AIDA Sistem Bildirimi",
          cooldown_minutes: data.cooldown_minutes || 5,
          events: mergedEvents,
          history: Array.isArray(data.history) ? data.history : []
        });
      }
    } catch (err) {
      console.error("Bildirim ayarları yüklenemedi:", err);
      setStatusMsg({
        type: "error",
        text: "Bildirim ayarları sunucudan alınamadı."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/settings/notifications`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setStatusMsg({
          type: "success",
          text: "E-Mail ve WhatsApp bildirim tercihleri başarıyla kaydedildi."
        });
        if (data.settings) {
          setConfig((prev) => ({
            ...prev,
            ...data.settings,
            events: data.settings.events || prev.events,
            history: data.settings.history || prev.history
          }));
        }
      } else {
        setStatusMsg({
          type: "error",
          text: data.detail || "Ayarlar kaydedilirken bir hata oluştu."
        });
      }
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: "Sunucu bağlantı hatası: " + err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (channel) => {
    if (channel === "email") {
      if (!config.email_recipients.trim()) {
        setStatusMsg({
          type: "error",
          text: "Lütfen önce en az bir alıcı E-Posta adresi yazın."
        });
        return;
      }
      setTestingEmail(true);
    } else {
      if (!config.whatsapp_recipients.trim()) {
        setStatusMsg({
          type: "error",
          text: "Lütfen önce en az bir alıcı WhatsApp numarası yazın (Örn: 905321234567)."
        });
        return;
      }
      setTestingWhatsapp(true);
    }
    setStatusMsg(null);

    try {
      // Save current settings first so backend uses latest SMTP/recipients
      await fetch(`/api/settings/notifications`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(config)
      });

      const res = await fetch(`/api/settings/notifications/test`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          channel,
          email_recipients: config.email_recipients,
          whatsapp_recipients: config.whatsapp_recipients
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setStatusMsg({
          type: "success",
          text:
            data.message ||
            (channel === "email"
              ? "Test e-postası başarıyla gönderildi!"
              : "Test WhatsApp mesajı başarıyla gönderildi!")
        });
        fetchNotificationSettings();
      } else {
        setStatusMsg({
          type: "error",
          text:
            data.message ||
            data.detail ||
            "Test bildirimi gönderilemedi. Lütfen kanal/SMTP ayarlarınızı kontrol edin."
        });
      }
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: "Test bildirimi hatası: " + err.message
      });
    } finally {
      setTestingEmail(false);
      setTestingWhatsapp(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch(`/api/settings/notifications/history`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, history: [] }));
        setStatusMsg({
          type: "success",
          text: "Bildirim geçmişi temizlendi."
        });
      }
    } catch (err) {
      console.error("Geçmiş silinemedi:", err);
    } finally {
      setShowClearModal(false);
    }
  };

  const updateEventField = (eventKey, field, value) => {
    if (!canWrite) return;
    setConfig((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventKey]: {
          ...(prev.events[eventKey] || {}),
          [field]: value
        }
      }
    }));
  };

  const bulkToggleChannel = (field, value) => {
    if (!canWrite) return;
    setConfig((prev) => {
      const updated = { ...prev.events };
      DEFAULT_EVENTS_META.forEach((meta) => {
        updated[meta.key] = {
          ...(updated[meta.key] || {}),
          [field]: value
        };
      });
      return { ...prev, events: updated };
    });
  };

  const categories = ["Tümü", ...Array.from(new Set(DEFAULT_EVENTS_META.map((e) => e.category)))];

  const filteredEvents = DEFAULT_EVENTS_META.filter(
    (meta) => selectedCategory === "Tümü" || meta.category === selectedCategory
  );

  const getSeverityBadge = (severity) => {
    if (severity === "critical") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          KRİTİK
        </span>
      );
    }
    if (severity === "warning") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          UYARI
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
        BİLGİ
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
        <RefreshCw size={18} className="animate-spin" />
        <span>E-Mail ve WhatsApp bildirim ayarları yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${lightText} border ${borderLight} shrink-0`}>
              <Bell size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  E-Mail & WhatsApp Sistem Bildirimleri
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    config.enabled
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-500/15 text-slate-500 border border-slate-500/30"
                  }`}
                >
                  {config.enabled ? "Aktif" : "Devre Dışı"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Santral dış hat kopmaları, eş zamanlı kanal doluluğu, AI STT/TTS/LLM kota veya bağlantı sorunları, lisans işlemleri ve sunucu sağlık uyarılarını belirlediğiniz E-Posta adreslerine ve WhatsApp numaralarına anında iletin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={config.enabled}
                disabled={!canWrite}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded text-primary focus:ring-0 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Bildirim Motoru Aktif
              </span>
            </label>

            {canWrite && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm flex items-center gap-2 disabled:opacity-50`}
              >
                <Save size={15} />
                <span>{saving ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
              </button>
            )}
          </div>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertTriangle size={16} className="shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-[11px] underline opacity-75 hover:opacity-100"
            >
              Kapat
            </button>
          </div>
        )}
      </div>

      {/* Recipient Channels Grid (E-Mail & WhatsApp) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* E-Mail Channel Configuration */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Mail size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    E-Posta (E-Mail) Bildirim Kanalı
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kritik uyarıların gönderileceği yönetici e-posta adresleri
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.email_enabled}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setConfig({ ...config, email_enabled: e.target.checked })
                  }
                  className="rounded text-primary focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  E-Mail Aktif
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alıcı E-Posta Adresi (Birden fazla için virgülle ayırın)
              </label>
              <input
                type="text"
                disabled={!canWrite}
                value={config.email_recipients}
                onChange={(e) =>
                  setConfig({ ...config, email_recipients: e.target.value })
                }
                placeholder="Örn: admin@sirketiniz.com, teknik@sirketiniz.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            {/* Optional Custom SMTP Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.use_custom_smtp}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setConfig({ ...config, use_custom_smtp: e.target.checked })
                  }
                  className="rounded text-primary focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Settings2 size={13} />
                  Özel SMTP Sunucusu Kullan (Seçilmezse Kanal Entegrasyonlarındaki E-Posta hesabı kullanılır)
                </span>
              </label>

              {config.use_custom_smtp && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      SMTP Sunucu (Host)
                    </label>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={config.smtp_host}
                      onChange={(e) =>
                        setConfig({ ...config, smtp_host: e.target.value })
                      }
                      placeholder="smtp.gmail.com / mail.kurum.com"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      disabled={!canWrite}
                      value={config.smtp_port}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          smtp_port: parseInt(e.target.value || "587", 10)
                        })
                      }
                      placeholder="587 veya 465"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      SMTP Kullanıcı / E-Posta
                    </label>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={config.smtp_user}
                      onChange={(e) =>
                        setConfig({ ...config, smtp_user: e.target.value })
                      }
                      placeholder="bildirim@sirketiniz.com"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      SMTP Şifre / Uygulama Şifresi
                    </label>
                    <input
                      type="password"
                      disabled={!canWrite}
                      value={config.smtp_password}
                      onChange={(e) =>
                        setConfig({ ...config, smtp_password: e.target.value })
                      }
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              HTML tablo formatında detaylı sistem raporu iletilir.
            </span>
            <button
              type="button"
              onClick={() => handleTestNotification("email")}
              disabled={testingEmail || !canWrite}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <Send size={13} />
              <span>{testingEmail ? "Gönderiliyor..." : "Test Maili Gönder"}</span>
            </button>
          </div>
        </div>

        {/* WhatsApp Channel Configuration */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    WhatsApp Bildirim Kanalı
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kritik sistem olaylarında anlık WhatsApp uyarısı alacak numaralar
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.whatsapp_enabled}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setConfig({ ...config, whatsapp_enabled: e.target.checked })
                  }
                  className="rounded text-primary focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  WhatsApp Aktif
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alıcı WhatsApp Numarası (Ülke koduyla, birden fazla için virgülle ayırın)
              </label>
              <input
                type="text"
                disabled={!canWrite}
                value={config.whatsapp_recipients}
                onChange={(e) =>
                  setConfig({ ...config, whatsapp_recipients: e.target.value })
                }
                placeholder="Örn: 905321234567, 905079876543"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            {/* Cooldown / Anti-Spam Selector */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Tekrarlayan Uyarı Koruma Süresi (Anti-Spam)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aynı olay için art arda bildirim gönderilmesini sınırlar
                  </div>
                </div>
              </div>
              <select
                disabled={!canWrite}
                value={config.cooldown_minutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    cooldown_minutes: parseInt(e.target.value, 10)
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white shrink-0"
              >
                <option value={1}>1 Dakika</option>
                <option value={5}>5 Dakika (Önerilen)</option>
                <option value={15}>15 Dakika</option>
                <option value={30}>30 Dakika</option>
                <option value={60}>60 Dakika</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              Kanal Entegrasyonlarında tanımlı WhatsApp Business hattı üzerinden gönderilir.
            </span>
            <button
              type="button"
              onClick={() => handleTestNotification("whatsapp")}
              disabled={testingWhatsapp || !canWrite}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <Send size={13} />
              <span>
                {testingWhatsapp ? "Gönderiliyor..." : "Test WhatsApp Gönder"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Event Matrix Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={17} className={lightText} />
              <span>Kritik Sistem İşlemleri ve Bildirim İzinleri</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hangi kritik olaylarda E-Posta ve/veya WhatsApp mesajı gönderileceğini aşağıdan seçebilirsiniz.
            </p>
          </div>

          {/* Bulk Action Buttons */}
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => bulkToggleChannel("email", true)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
              >
                Tüm E-Mail'leri Seç
              </button>
              <button
                type="button"
                onClick={() => bulkToggleChannel("whatsapp", true)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              >
                Tüm WhatsApp'ları Seç
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkToggleChannel("email", false);
                  bulkToggleChannel("whatsapp", false);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Seçimleri Temizle
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={14} className="text-slate-400 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                selectedCategory === cat
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Events List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden">
          {filteredEvents.map((meta) => {
            const ev = config.events?.[meta.key] || {
              enabled: true,
              email: true,
              whatsapp: false
            };
            const IconComponent = meta.icon || Bell;

            return (
              <div
                key={meta.key}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  ev.enabled
                    ? "bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    : "bg-slate-50/60 dark:bg-slate-950/40 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                    <IconComponent size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {meta.title}
                      </span>
                      {getSeverityBadge(meta.severity)}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {meta.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                </div>

                {/* Channel Checkboxes */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {/* Active Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      disabled={!canWrite}
                      checked={!!ev.enabled}
                      onChange={(e) =>
                        updateEventField(meta.key, "enabled", e.target.checked)
                      }
                      className="rounded text-primary focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      İzle
                    </span>
                  </label>

                  {/* Email Checkbox */}
                  <label
                    className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-xl border transition-all ${
                      ev.enabled && ev.email
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canWrite || !ev.enabled}
                      checked={!!ev.email}
                      onChange={(e) =>
                        updateEventField(meta.key, "email", e.target.checked)
                      }
                      className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <Mail size={13} />
                    <span className="text-[11px] font-bold">E-Mail</span>
                  </label>

                  {/* WhatsApp Checkbox */}
                  <label
                    className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-xl border transition-all ${
                      ev.enabled && ev.whatsapp
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canWrite || !ev.enabled}
                      checked={!!ev.whatsapp}
                      onChange={(e) =>
                        updateEventField(meta.key, "whatsapp", e.target.checked)
                      }
                      className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <MessageSquare size={13} />
                    <span className="text-[11px] font-bold">WhatsApp</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {canWrite && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm flex items-center gap-2 disabled:opacity-50`}
            >
              <Save size={15} />
              <span>{saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Recent Dispatched Notifications History */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span>Son Gönderilen Bildirim Geçmişi</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sistem tarafından E-Posta ve WhatsApp üzerinden tetiklenen son uyarı kayıtları
            </p>
          </div>

          {canDelete && config.history?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Geçmişi Temizle</span>
            </button>
          )}
        </div>

        {!config.history || config.history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <Info size={20} className="opacity-50" />
            <span>Henüz gönderilmiş bir sistem bildirimi bulunmuyor.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Tarih / Saat</th>
                  <th className="py-2.5 px-3">Olay Başlığı</th>
                  <th className="py-2.5 px-3">Detay</th>
                  <th className="py-2.5 px-3">İletilen Kanallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {config.history.slice(0, 20).map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {item.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-400 max-w-md truncate">
                      {item.message}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {(item.channels || []).includes("email") && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            E-Mail
                          </span>
                        )}
                        {(item.channels || []).includes("whatsapp") && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            WhatsApp
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearHistory}
        title="Bildirim Geçmişini Temizle"
        message="Gönderilen tüm E-Posta ve WhatsApp sistem bildirim geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
