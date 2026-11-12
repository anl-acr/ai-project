import React, { useState, useEffect, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Mail,
  Download,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Clock,
  Trash2,
  AlertTriangle,
  FileJson,
  Laptop,
  Send,
  Sparkles,
  Power,
  CheckCircle2
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getBackendHost } from "../../utils/apiHost";

const TTL_OPTIONS = [
  { value: 900, label: "15 Dakika" },
  { value: 3600, label: "1 Saat" },
  { value: 86400, label: "24 Saat (1 Gün)" },
  { value: 604800, label: "7 Gün" },
  { value: 2592000, label: "30 Gün" }
];

function formatRemainingTime(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  if (sec <= 0) return "Süresi Doldu";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days} gün ${hours} sa`;
  if (hours > 0) return `${hours} sa ${mins} dk`;
  return `${Math.max(1, mins)} dakika`;
}

export default function UserApplicationsPanel({
  userId,
  userObj = null,
  isAdminView = true,
  canEdit = true
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const backendHost = getBackendHost();

  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState(null);
  const [selectedTtl, setSelectedTtl] = useState(86400);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  // Mobile URL Entry / Auto-Open Field
  const [mobileUrlInput, setMobileUrlInput] = useState("");
  const [mobileUrlTesting, setMobileUrlTesting] = useState(false);

  // Custom Confirmation Modal state (for revoking link or terminating session)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // "revoke_link" | "terminate_session"
    sessionId: null,
    title: "",
    description: ""
  });

  const resolvedUserId =
    userId ||
    userObj?.id ||
    userObj?.extension ||
    (typeof window !== "undefined" ? localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id") : "") ||
    "admin";

  const getApiBase = useCallback(() => {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    return `${protocol}//${backendHost}`;
  }, [backendHost]);

  const getUiOrigin = useCallback(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
    return getApiBase();
  }, [getApiBase]);

  const showToast = (type, message) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const fetchAppAccessData = useCallback(async () => {
    if (!resolvedUserId) return;
    setLoading(true);
    try {
      const originParam = encodeURIComponent(getUiOrigin());
      const res = await fetch(
        `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/app-access?origin=${originParam}`
      );
      if (res.ok) {
        const data = await res.json();
        setAppData(data);
        if (data?.user?.email) {
          setEmailInput((prev) => prev || data.user.email);
        } else if (userObj?.email) {
          setEmailInput((prev) => prev || userObj.email);
        }
        if (data?.magic_link?.ttl_seconds) {
          setSelectedTtl(Number(data.magic_link.ttl_seconds) || 86400);
        }
        if (data?.magic_link?.magic_url) {
          setMobileUrlInput(data.magic_link.magic_url);
        }
      }
    } catch (err) {
      console.error("Uygulama bilgileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId, getApiBase, getUiOrigin, userObj?.email]);

  useEffect(() => {
    setEmailInput(userObj?.email || "");
    fetchAppAccessData();
  }, [resolvedUserId, userObj?.email, fetchAppAccessData]);

  const handleCopy = (val, key) => {
    if (!val) return;
    navigator.clipboard.writeText(String(val));
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleTogglePermission = async (field, nextVal) => {
    if (!canEdit) return;
    setSavingPerms(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/app-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [field]: Boolean(nextVal),
            origin: getUiOrigin()
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAppData(data);
        showToast("success", "Uygulama erişim tercihi güncellendi.");
      } else {
        showToast("error", "Tercih kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası.");
    } finally {
      setSavingPerms(false);
    }
  };

  const handleGenerateMagicLink = async (ttlOverride = null) => {
    const ttlToUse = ttlOverride !== null ? Number(ttlOverride) : Number(selectedTtl) || 86400;
    setGeneratingLink(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/app-magic-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ttl_seconds: ttlToUse,
            action: "generate",
            origin: getUiOrigin()
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAppData(data);
        if (data?.magic_link?.magic_url) {
          setMobileUrlInput(data.magic_link.magic_url);
        }
        showToast("success", "Yeni süreli Kolay Giriş Linki (URL) oluşturuldu.");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err?.detail || "Kolay giriş linki oluşturulamadı.");
      }
    } catch (err) {
      showToast("error", "Kolay giriş linki oluşturulurken hata oluştu.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const executeConfirmedAction = async () => {
    const { type, sessionId } = confirmModal;
    setConfirmModal({ open: false, type: null, sessionId: null, title: "", description: "" });

    if (type === "revoke_link") {
      setGeneratingLink(true);
      try {
        const res = await fetch(
          `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/app-magic-link`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "revoke",
              origin: getUiOrigin()
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          setAppData(data);
          setMobileUrlInput("");
          showToast("success", "Mevcut Kolay Giriş Linki iptal edildi.");
        }
      } catch (e) {
        showToast("error", "Link iptal edilirken hata oluştu.");
      } finally {
        setGeneratingLink(false);
      }
    } else if (type === "terminate_session" && sessionId) {
      try {
        const res = await fetch(
          `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/app-access`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revoke_session_id: sessionId,
              origin: getUiOrigin()
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          setAppData(data);
          showToast("success", "Uygulama oturumu sonlandırıldı.");
        }
      } catch (e) {
        showToast("error", "Oturum sonlandırılırken hata oluştu.");
      }
    }
  };

  const handleSendInviteEmail = async () => {
    const cleanEmail = String(emailInput || "").trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      showToast("error", "Lütfen geçerli bir e-posta adresi giriniz.");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/settings/users/${encodeURIComponent(resolvedUserId)}/send-app-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: cleanEmail,
            ttl_seconds: Number(selectedTtl) || 86400,
            origin: getUiOrigin()
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAppData(data);
        if (data?.magic_link?.magic_url) {
          setMobileUrlInput(data.magic_link.magic_url);
        }
        showToast(
          "success",
          data.message || `Kurulum paketleri ve Kolay Giriş Linki ${cleanEmail} adresine gönderildi.`
        );
      } else {
        showToast("error", data?.detail || "E-posta gönderilemedi. Lütfen SMTP ayarlarınızı kontrol edin.");
      }
    } catch (err) {
      showToast("error", "E-posta gönderilirken sunucu bağlantı hatası oluştu.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadConfigJson = () => {
    const u = appData?.user || userObj || {};
    const perms = appData?.permissions || {};
    const uiOrigin = getUiOrigin();
    const apiOrigin = getApiBase();
    let hostStr = "";
    try {
      hostStr = new URL(uiOrigin).host;
    } catch (e) {
      hostStr = backendHost;
    }
    const configPayload = {
      serverHost: hostStr,
      uiOrigin,
      apiOrigin,
      recentHosts: [hostStr],
      rememberMe: true,
      savedUsername: u.extension || u.email || u.username || "",
      osNotifications: true,
      popWindowOnCall: perms.pop_window_on_call !== false,
      minimizeToTray: perms.minimize_to_tray !== false,
      startOnBoot: Boolean(perms.start_on_boot)
    };
    const blob = new Blob([JSON.stringify(configPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aida-agent-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", "Hazır masaüstü yapılandırma dosyası (aida-agent-config.json) indirildi.");
  };

  const handleOpenMobileWithUrl = async () => {
    const targetUrl = String(mobileUrlInput || "").trim();
    if (!targetUrl) {
      showToast("error", "Lütfen Mobil Kolay Giriş URL'ini giriniz.");
      return;
    }
    setMobileUrlTesting(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/app-magic-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          platform: "mobile"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.status === "success") {
        showToast(
          "success",
          `Mobil bağlantı doğrulandı (${data.user?.full_name || "Aktif"} - Dahili ${data.user?.extension || "-"}). Uygulama başlatılıyor...`
        );
        fetchAppAccessData();
        // Attempt deep link for mobile app if on mobile device, or open validated magic URL
        const deepMobile = `aida-mobile://login?url=${encodeURIComponent(targetUrl)}`;
        window.location.href = deepMobile;
      } else {
        showToast("error", data?.detail || "Girilen Kolay Giriş URL'i doğrulanamadı veya süresi dolmuş.");
      }
    } catch (err) {
      showToast("error", "Mobil URL doğrulanırken bağlantı hatası oluştu.");
    } finally {
      setMobileUrlTesting(false);
    }
  };

  if (loading && !appData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw size={22} className="animate-spin" />
        <span className="text-xs font-bold">Uygulama ve kolay giriş bilgileri yükleniyor...</span>
      </div>
    );
  }

  const perms = appData?.permissions || {
    desktop_enabled: true,
    mobile_enabled: true,
    pop_window_on_call: true,
    minimize_to_tray: true,
    start_on_boot: false
  };
  const magic = appData?.magic_link || {};
  const packages = appData?.desktop_downloads?.packages || [];
  const sessions = appData?.sessions || [];
  const userSummary = appData?.user || {
    full_name: userObj?.full_name || userObj?.username || "Kullanıcı",
    extension: userObj?.extension || "-",
    email: userObj?.email || ""
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-xs ${
            feedbackBanner.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] opacity-75 hover:opacity-100 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* 1. HIZLI E-POSTA DAVETİYESİ & GEÇERLİLİK SÜRESİ BARI */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${borderLight} ${lightBg} space-y-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} text-white flex items-center justify-center shrink-0 shadow-sm`}>
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  {isAdminView
                    ? "Kullanıcıya Kurulum & Kolay Giriş Bilgilerini E-Posta Gönder"
                    : "Kurulum & Kolay Giriş Bağlantısını E-Postama Gönder"}
                </h5>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  {userSummary.full_name} {userSummary.extension ? `• Dahili ${userSummary.extension}` : ""}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Masaüstü uygulama indirme linkleri (.exe / .dmg) ve seçilen süre boyunca geçerli{" "}
                <strong>Kolay Giriş URL&apos;i</strong> tek tıkla e-posta olarak iletilir.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
          <div className="md:col-span-5">
            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Alıcı E-Posta Adresi
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="ornek@sirket.com"
              className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Link Geçerlilik Süresi
            </label>
            <select
              value={selectedTtl}
              onChange={(e) => {
                const nextTtl = Number(e.target.value);
                setSelectedTtl(nextTtl);
                handleGenerateMagicLink(nextTtl);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              {TTL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-end">
            <button
              type="button"
              disabled={sendingEmail}
              onClick={handleSendInviteEmail}
              className={`w-full py-2 px-4 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50`}
            >
              {sendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{sendingEmail ? "E-Posta Gönderiliyor..." : "Kurulum & Giriş Linkini Mail Gönder"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MASAÜSTÜ UYGULAMASI (AIDA AGENT) & SÜRELİ KOLAY GİRİŞ LİNKİ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Masaüstü Kartı */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex flex-col justify-between gap-4 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border ${borderLight} ${lightBg} ${text} flex items-center justify-center shrink-0`}>
                  <Laptop size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                      Masaüstü Uygulaması (AIDA Agent)
                    </h5>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      v2.9.3 Hazır
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Windows ve macOS için 3 kanallı ses yönlendirmeli temsilci uygulaması
                  </p>
                </div>
              </div>

              {isAdminView && (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0" title="Masaüstü uygulama giriş yetkisi">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">
                    {perms.desktop_enabled ? "İzin Aktif" : "Pasif"}
                  </span>
                  <input
                    type="checkbox"
                    checked={perms.desktop_enabled}
                    disabled={!canEdit || savingPerms}
                    onChange={(e) => handleTogglePermission("desktop_enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:${bg} relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4`} />
                </label>
              )}
            </div>

            {/* Süreli Kolay Giriş Linki (Magic Login URL) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Link2 size={14} className={text} />
                  Masaüstü Kolay Giriş Linki (URL)
                </span>
                {magic.active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    <Clock size={11} />
                    Kalan Süre: {formatRemainingTime(magic.remaining_seconds)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                    Link Pasif / Süresi Doldu
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={magic.active ? magic.magic_url : "Aktif bir kolay giriş bağlantısı bulunmuyor. Yeni link üretin."}
                  className="flex-1 px-3 py-2 rounded-xl text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                />
                {magic.active && (
                  <button
                    type="button"
                    onClick={() => handleCopy(magic.magic_url, "desktop_magic_url")}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${border} ${lightBg} ${text} hover:opacity-90 transition flex items-center gap-1.5 shrink-0 cursor-pointer`}
                    title="Kolay Giriş URL'ini Kopyala"
                  >
                    {copiedKey === "desktop_magic_url" ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey === "desktop_magic_url" ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={generatingLink}
                    onClick={() => handleGenerateMagicLink()}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={12} className={generatingLink ? "animate-spin" : ""} />
                    <span>{magic.active ? "Linki Yenile" : "Yeni Link Oluştur"}</span>
                  </button>
                  {magic.active && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          open: true,
                          type: "revoke_link",
                          sessionId: null,
                          title: "Kolay Giriş Linkini İptal Et",
                          description:
                            "Mevcut Kolay Giriş Linki (URL) ve QR Kodu anında geçersiz kılınacaktır. Bu linki kullanan yeni cihazlar giriş yapamayacaktır. Onaylıyor musunuz?"
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>İptal Et</span>
                    </button>
                  )}
                </div>

                {magic.active && magic.deep_link_url && (
                  <a
                    href={magic.deep_link_url}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold text-white ${bg} ${hover} transition inline-flex items-center gap-1.5 shadow-2xs`}
                    title="Bilgisayarda kurulu AIDA Agent uygulamasını otomatik açar ve oturumunuzu bağlar"
                  >
                    <ExternalLink size={12} />
                    <span>Masaüstü Uygulamasında Aç</span>
                  </a>
                )}
              </div>
            </div>

            {/* Masaüstü Kurulum Paketlerini İndirme Butonları */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Kurulum Paketlerini İndir (Windows & macOS)
                </span>
                <button
                  type="button"
                  onClick={handleDownloadConfigJson}
                  className={`text-[11px] font-extrabold ${text} hover:underline inline-flex items-center gap-1 cursor-pointer`}
                  title="Sunucu adresi ve dahili bilgisini içeren hazır ayar dosyasını indir"
                >
                  <FileJson size={13} />
                  <span>Hazır Ayar Dosyası (.json)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {packages.map((pkg) => (
                  <a
                    key={pkg.id}
                    href={`${getApiBase()}${pkg.endpoint}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {pkg.label}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {pkg.available ? `${pkg.size_mb} MB • Doğrudan İndir` : "Paketi İndir"}
                      </div>
                    </div>
                    <div className={`w-7 h-7 rounded-lg ${lightBg} ${text} flex items-center justify-center shrink-0 group-hover:scale-105 transition`}>
                      <Download size={14} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Masaüstü Davranış Tercihleri */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Çağrıda Pencereyi Öne Getir
              </span>
              <input
                type="checkbox"
                checked={perms.pop_window_on_call}
                disabled={!canEdit || savingPerms}
                onChange={(e) => handleTogglePermission("pop_window_on_call", e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Sistem Tepsisinde (Tray) Çalıştır
              </span>
              <input
                type="checkbox"
                checked={perms.minimize_to_tray}
                disabled={!canEdit || savingPerms}
                onChange={(e) => handleTogglePermission("minimize_to_tray", e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 3. MOBİL UYGULAMA (AIDA MOBILE) & URL / QR İLE OTOMATİK AÇMA KARTI */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex flex-col justify-between gap-4 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border ${borderLight} ${lightBg} ${text} flex items-center justify-center shrink-0`}>
                  <Smartphone size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                      Mobil Uygulama (AIDA Mobile)
                    </h5>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                      iOS & Android
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Kolay Giriş URL&apos;i veya QR Kod ile saniyeler içinde otomatik kurulum
                  </p>
                </div>
              </div>

              {isAdminView && (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0" title="Mobil uygulama giriş yetkisi">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">
                    {perms.mobile_enabled ? "İzin Aktif" : "Pasif"}
                  </span>
                  <input
                    type="checkbox"
                    checked={perms.mobile_enabled}
                    disabled={!canEdit || savingPerms}
                    onChange={(e) => handleTogglePermission("mobile_enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:${bg} relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4`} />
                </label>
              )}
            </div>

            {/* Mobil QR Kod + Hızlı Eşleştirme */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <div className="w-32 h-32 rounded-xl bg-white p-2 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                {magic.active && magic.qr_svg ? (
                  <img
                    src={magic.qr_svg}
                    alt="Mobil Kolay Giriş QR Kodu"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-[10px] font-bold text-slate-400 px-2">
                    <QrCode size={28} className="mx-auto mb-1 opacity-50" />
                    QR Kod Pasif
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <QrCode size={14} className={text} />
                  <span>QR Kod veya URL ile Otomatik Eşleştirme</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Mobil uygulamada <strong>&ldquo;QR Kod Okut&rdquo;</strong> seçeneğini kullanabilir veya aşağıdaki{" "}
                  <strong>Kolay Giriş URL&apos;ini</strong> mobil giriş ekranına yapıştırarak uygulamayı otomatik açabilirsiniz.
                </p>
                {magic.active && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(magic.magic_url, "mobile_magic_url")}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold border ${border} ${lightBg} ${text} hover:opacity-90 transition inline-flex items-center gap-1.5 cursor-pointer`}
                    >
                      {copiedKey === "mobile_magic_url" ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === "mobile_magic_url" ? "Mobil URL Kopyalandı" : "Mobil Giriş URL'ini Kopyala"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobil Uygulama Giriş Alanı: URL Girildiğinde Otomatik Açma */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={13} className={text} />
                  Mobil Kolay Giriş URL&apos;i ile Uygulamayı Otomatik Aç
                </label>
                <span className="text-[10px] font-bold text-slate-400">Hızlı Bağlantı Alanı</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kolay Giriş URL&apos;ini bu alana girip onayladığınızda kimlik doğrulaması yapılır ve mobil uygulama otomatik olarak başlatılır:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mobileUrlInput}
                  onChange={(e) => setMobileUrlInput(e.target.value)}
                  placeholder="https://santral.sirket.com/login?app_token=..."
                  className="flex-1 px-3 py-2 rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={mobileUrlTesting}
                  onClick={handleOpenMobileWithUrl}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50`}
                >
                  {mobileUrlTesting ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                  <span>{mobileUrlTesting ? "Açılıyor..." : "Otomatik Aç"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              VoIP Push &amp; Arka Plan Çağrı Uyandırma Hazır
            </span>
            <span className="font-mono text-[10px]">Dahili: {userSummary.extension || "-"}</span>
          </div>
        </div>
      </div>

      {/* 4. AKTİF UYGULAMA OTURUMLARI & BAĞLI CİHAZLAR */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Monitor size={15} className={text} />
              Bağlı Uygulama Oturumları &amp; Cihaz Geçmişi
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Kolay Giriş Linki veya uygulama üzerinden oturum açılan masaüstü ve mobil istemciler
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {sessions.length} Kayıtlı Oturum
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs font-semibold text-slate-400">
            Henüz Kolay Giriş Linki ile eşleştirilmiş masaüstü veya mobil uygulama oturumu bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b border-slate-200 dark:border-slate-800 ${lightBg}`}>
                  <th className={`p-3 font-extrabold uppercase tracking-wider text-[10px] ${text}`}>Uygulama / Cihaz</th>
                  <th className={`p-3 font-extrabold uppercase tracking-wider text-[10px] ${text}`}>IP Adresi</th>
                  <th className={`p-3 font-extrabold uppercase tracking-wider text-[10px] ${text}`}>Son Bağlantı</th>
                  <th className={`p-3 font-extrabold uppercase tracking-wider text-[10px] text-center ${text}`}>Durum</th>
                  {canEdit && (
                    <th className={`p-3 font-extrabold uppercase tracking-wider text-[10px] text-right ${text}`}>İşlem</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {sess.platform === "mobile" ? (
                        <Smartphone size={14} className={text} />
                      ) : (
                        <Laptop size={14} className={text} />
                      )}
                      <span>{sess.device_name || "AIDA Uygulaması"}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {sess.ip_address || "-"}
                    </td>
                    <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {sess.connected_at || "-"}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        {sess.status || "Aktif"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              open: true,
                              type: "terminate_session",
                              sessionId: sess.id,
                              title: "Uygulama Oturumunu Sonlandır",
                              description: `${sess.device_name} (${sess.ip_address}) cihazına ait uygulama oturumu listeden kaldırılacaktır. Onaylıyor musunuz?`
                            })
                          }
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Power size={11} />
                          <span>Sonlandır</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Application-Native Delete / Revoke Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400 animate-pulse">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ open: false, type: null, sessionId: null, title: "", description: "" })
                }
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
              >
                Sil / Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
