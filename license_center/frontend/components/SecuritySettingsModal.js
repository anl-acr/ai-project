import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Clock, Lock, Unlock, Plus, Trash2, X, Check, AlertTriangle, Globe, Smartphone, Key, Mail, Send, Database, Download, RefreshCw } from "lucide-react";

export default function SecuritySettingsModal({ isOpen, onClose, currentUser, onPolicyUpdated, onOpenUser2FA }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientIp, setClientIp] = useState("");
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(5);
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(60);
  const [whitelistedIps, setWhitelistedIps] = useState([]);
  const [newWhitelistIp, setNewWhitelistIp] = useState("");
  const [blockedIps, setBlockedIps] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");

  // Central SMTP Settings for E-Mail 2FA
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState(null); // { type: 'ok'|'err', text }

  // Manual IP Ban Modal
  const [showBanModal, setShowBanModal] = useState(false);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("Manuel Yönetici Engeli");
  const [banIsPermanent, setBanIsPermanent] = useState(true);

  // Custom Unban Delete Confirmation Modal
  const [unbanTarget, setUnbanTarget] = useState(null);

  // Central SQLite WAL & Backup Status
  const [backupInfo, setBackupInfo] = useState(null);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Panel Server UFW Firewall Port Management
  const [fwStatus, setFwStatus] = useState(null);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwBusy, setFwBusy] = useState(false);
  const [fwPort, setFwPort] = useState("");
  const [fwProto, setFwProto] = useState("tcp");
  const [fwAction, setFwAction] = useState("allow");
  const [fwSourceIp, setFwSourceIp] = useState("");
  const [fwFeedback, setFwFeedback] = useState(null); // { type: 'ok'|'err', text }
  const [fwDeleteRuleTarget, setFwDeleteRuleTarget] = useState(null);
  const [showFwHardenConfirm, setShowFwHardenConfirm] = useState(false);

  const fetchFirewallStatus = async () => {
    setFwLoading(true);
    try {
      const res = await fetch("/api/v1/security/firewall/status");
      if (res.ok) {
        setFwStatus(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch firewall status:", e);
    } finally {
      setFwLoading(false);
    }
  };

  const handleToggleFirewall = async () => {
    if (!fwStatus?.supported) return;
    setFwBusy(true);
    setFwFeedback(null);
    try {
      const res = await fetch("/api/v1/security/firewall/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({ enabled: !fwStatus.enabled })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setFwStatus(d);
        setFwFeedback({
          type: "ok",
          text: d.enabled
            ? "Güvenlik duvarı (UFW) aktif edildi (22/80/443 kilit korumalı)."
            : "Güvenlik duvarı (UFW) devre dışı bırakıldı."
        });
      } else {
        setFwFeedback({ type: "err", text: d.detail || "Güvenlik duvarı durumu değiştirilemedi." });
      }
    } catch (e) {
      setFwFeedback({ type: "err", text: "Sunucuya bağlanılamadı." });
    } finally {
      setFwBusy(false);
    }
  };

  const handleAddFirewallRule = async (e) => {
    e.preventDefault();
    if (!fwPort.trim()) {
      setFwFeedback({ type: "err", text: "Lütfen bir port numarası giriniz (örn. 443 veya 8050)." });
      return;
    }
    setFwBusy(true);
    setFwFeedback(null);
    try {
      const res = await fetch("/api/v1/security/firewall/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          port: fwPort.trim(),
          protocol: fwProto,
          action: fwAction,
          source_ip: fwSourceIp.trim()
        })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setFwStatus(d);
        setFwPort("");
        setFwSourceIp("");
        setFwFeedback({ type: "ok", text: "Port kuralı başarıyla eklendi." });
      } else {
        setFwFeedback({ type: "err", text: d.detail || "Port kuralı eklenemedi." });
      }
    } catch (e) {
      setFwFeedback({ type: "err", text: "Sunucuya bağlanılamadı." });
    } finally {
      setFwBusy(false);
    }
  };

  const confirmDeleteFirewallRule = async () => {
    if (!fwDeleteRuleTarget) return;
    setFwBusy(true);
    setFwFeedback(null);
    try {
      const res = await fetch(`/api/v1/security/firewall/rules/${fwDeleteRuleTarget.num}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setFwStatus(d);
        setFwFeedback({ type: "ok", text: `#${fwDeleteRuleTarget.num} kuralı silindi.` });
      } else {
        setFwFeedback({ type: "err", text: d.detail || "Kural silinemedi." });
      }
    } catch (e) {
      setFwFeedback({ type: "err", text: "Sunucuya bağlanılamadı." });
    } finally {
      setFwBusy(false);
      setFwDeleteRuleTarget(null);
    }
  };

  const confirmApplyFirewallHardenPreset = async () => {
    setFwBusy(true);
    setFwFeedback(null);
    try {
      const res = await fetch("/api/v1/security/firewall/harden-preset", {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setFwStatus(d);
        setFwFeedback({
          type: "ok",
          text: "Önerilen Panel Profili uygulandı: Sadece 22, 80, 443 açık; 8050 ve 3050 dışarıya kapatıldı."
        });
      } else {
        setFwFeedback({ type: "err", text: d.detail || "Profil uygulanamadı." });
      }
    } catch (e) {
      setFwFeedback({ type: "err", text: "Sunucuya bağlanılamadı." });
    } finally {
      setFwBusy(false);
      setShowFwHardenConfirm(false);
    }
  };

  const fetchBackupInfo = async () => {
    try {
      const res = await fetch("/api/v1/system/backups");
      if (res.ok) {
        setBackupInfo(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch backup info:", e);
    }
  };

  const handleCreateBackupNow = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch("/api/v1/system/backups/create", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setStatusMsg(`Veritabanı yedeği oluşturuldu: ${d.filename} (${d.size_kb} KB)`);
        setTimeout(() => setStatusMsg(""), 4000);
        fetchBackupInfo();
      }
    } catch (e) {
      console.error("Create backup error:", e);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = (filename = "") => {
    const tok = typeof window !== "undefined" ? (sessionStorage.getItem("master_access_token") || "") : "";
    const qs = new URLSearchParams();
    if (filename) qs.set("filename", filename);
    if (tok) qs.set("token", tok);
    window.open(`/api/v1/system/backups/download?${qs.toString()}`, "_blank");
  };

  useEffect(() => {
    if (isOpen) {
      fetchSecurityData();
      fetchBackupInfo();
      fetchFirewallStatus();
    }
  }, [isOpen]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/security/settings");
      if (res.ok) {
        const data = await res.json();
        setClientIp(data.client_ip || "");
        if (data.policy) {
          setMaxFailedAttempts(data.policy.max_failed_attempts ?? 5);
          setBlockDurationMinutes(data.policy.block_duration_minutes ?? 60);
          setWhitelistedIps(Array.isArray(data.policy.whitelisted_ips) ? data.policy.whitelisted_ips : []);
          setSmtpHost(data.policy.smtp_host || "");
          setSmtpPort(data.policy.smtp_port ?? 587);
          setSmtpUser(data.policy.smtp_user || "");
          setSmtpFromEmail(data.policy.smtp_from_email || "");
          setSmtpUseTls(data.policy.smtp_use_tls !== false);
          setHasSmtpPassword(Boolean(data.policy.has_smtp_password));
          setSmtpConfigured(Boolean(data.policy.smtp_configured));
          setSmtpPassword("");
        }
        if (!smtpTestEmail && currentUser?.email) {
          setSmtpTestEmail(currentUser.email);
        }
        setBlockedIps(Array.isArray(data.blocked_ips) ? data.blocked_ips : []);
      }
    } catch (e) {
      console.error("Security settings fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (customWl = null) => {
    setSaving(true);
    setStatusMsg("");
    const wlToSave = customWl !== null ? customWl : whitelistedIps;
    try {
      const res = await fetch("/api/v1/security/policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          max_failed_attempts: Number(maxFailedAttempts) || 5,
          block_duration_minutes: Number(blockDurationMinutes) || 60,
          whitelisted_ips: wlToSave,
          smtp_host: smtpHost.trim(),
          smtp_port: Number(smtpPort) || 587,
          smtp_user: smtpUser.trim(),
          smtp_password: smtpPassword.trim(),
          smtp_from_email: smtpFromEmail.trim(),
          smtp_use_tls: smtpUseTls
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMsg("Güvenlik ve SMTP politikası başarıyla kaydedildi.");
        setSmtpPassword("");
        setHasSmtpPassword(Boolean(data.policy?.has_smtp_password));
        setSmtpConfigured(Boolean(data.policy?.smtp_configured));
        if (onPolicyUpdated) {
          onPolicyUpdated(data.policy);
        }
        setTimeout(() => setStatusMsg(""), 3500);
      }
    } catch (e) {
      console.error("Save policy error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    const cleanTo = (smtpTestEmail || currentUser?.email || "").trim();
    if (!cleanTo || !cleanTo.includes("@")) {
      setSmtpFeedback({ type: "err", text: "Test için geçerli bir alıcı e-posta adresi giriniz." });
      return;
    }
    setSmtpTesting(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch("/api/v1/security/smtp-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          to_email: cleanTo,
          smtp_host: smtpHost.trim(),
          smtp_port: Number(smtpPort) || 587,
          smtp_user: smtpUser.trim(),
          smtp_password: smtpPassword.trim(),
          smtp_from_email: smtpFromEmail.trim(),
          smtp_use_tls: smtpUseTls
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Test e-postası gönderilemedi.");
      }
      setSmtpFeedback({ type: "ok", text: data.message || `Test e-postası ${cleanTo} adresine gönderildi.` });
    } catch (e) {
      setSmtpFeedback({ type: "err", text: e.message || "SMTP bağlantı hatası." });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleAddWhitelistIp = (ipVal) => {
    const clean = (ipVal || newWhitelistIp).trim();
    if (!clean) return;
    if (!whitelistedIps.includes(clean)) {
      const next = [...whitelistedIps, clean];
      setWhitelistedIps(next);
      setNewWhitelistIp("");
      handleSavePolicy(next);
    }
  };

  const handleRemoveWhitelistIp = (ipVal) => {
    const next = whitelistedIps.filter((x) => x !== ipVal);
    setWhitelistedIps(next);
    handleSavePolicy(next);
  };

  const handleManualBan = async (e) => {
    e.preventDefault();
    if (!banIpInput.trim()) return;
    try {
      const res = await fetch("/api/v1/security/blocked-ips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          ip_address: banIpInput.trim(),
          reason: banReasonInput.trim() || "Manuel Yönetici Engeli",
          is_permanent: banIsPermanent
        })
      });
      if (res.ok) {
        setShowBanModal(false);
        setBanIpInput("");
        fetchSecurityData();
      }
    } catch (e) {
      console.error("Manual ban error:", e);
    }
  };

  const confirmUnbanIp = async () => {
    if (!unbanTarget) return;
    try {
      const res = await fetch(`/api/v1/security/blocked-ips/${unbanTarget.id}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        setUnbanTarget(null);
        fetchSecurityData();
      }
    } catch (e) {
      console.error("Unban error:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Nornia Cloud Center — Güvenlik Kalkanı</span>
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Brute-Force IP Engelleme, Otomatik Oturum Kapatma (Auto-Logout) &amp; Beyaz Liste
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {statusMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-2">
              <Check size={15} />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Central SMTP Settings for E-Mail 2FA */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Mail size={15} className="text-sky-500" />
                  <span>E-Posta (SMTP) Sunucu Ayarları (2FA Kod Gönderimi)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      smtpConfigured
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {smtpConfigured ? "BAĞLI" : "YAPILANDIRILMADI"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  E-Posta 2FA doğrulama kodlarının gönderileceği kurumsal SMTP sunucu bilgilerini tanımlayın.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSavePolicy(null)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold cursor-pointer shadow-sm"
              >
                {saving ? "Kaydediliyor..." : "SMTP Kaydet"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Sunucusu (Host)
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="Örn: smtp.gmail.com veya mail.nornia.com.tr"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Port (587 TLS / 465 SSL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpUseTls}
                      onChange={(e) => setSmtpUseTls(e.target.checked)}
                      className="rounded accent-sky-600"
                    />
                    <span>TLS / SSL</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Gönderen E-Posta (From)
                </label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="Örn: noreply@nornia.com.tr"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="Örn: noreply@nornia.com.tr"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Şifre / Uygulama Şifresi
                </label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={hasSmtpPassword ? "•••••••• (Kayıtlı — değiştirmek için yazın)" : "SMTP şifresi"}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Test E-Postası Gönder
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="email"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    placeholder="test@nornia.com.tr"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={smtpTesting}
                    onClick={handleTestSmtp}
                    className="px-3 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-sky-600 text-white font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                    title="Test 2FA E-Postası Gönder"
                  >
                    <Send size={12} />
                    <span>{smtpTesting ? "..." : "Test"}</span>
                  </button>
                </div>
              </div>
            </div>

            {smtpFeedback && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-2 ${
                  smtpFeedback.type === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                }`}
              >
                {smtpFeedback.type === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />}
                <span>{smtpFeedback.text}</span>
              </div>
            )}
          </div>

          {/* 1. Brute-Force Policy Controls */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Lock size={15} className="text-rose-500" />
                <span>1. Brute-Force Koruması</span>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSavePolicy(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold cursor-pointer shadow-sm"
              >
                {saving ? "Kaydediliyor..." : "Politikayı Kaydet"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <label className="block font-extrabold text-slate-700 dark:text-slate-200">
                  Maksimum Hatalı Giriş Hakkı
                </label>
                <select
                  value={maxFailedAttempts}
                  onChange={(e) => setMaxFailedAttempts(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value={3}>3 Hatalı Denemede Engelle (Sıkı)</option>
                  <option value={5}>5 Hatalı Denemede Engelle (Önerilen)</option>
                  <option value={10}>10 Hatalı Denemede Engelle</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Şifre veya 2FA kodu üst üste hatalı girildiğinde IP otomatik bloklanır.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <label className="block font-extrabold text-slate-700 dark:text-slate-200">
                  Otomatik IP Bloklama Süresi
                </label>
                <select
                  value={blockDurationMinutes}
                  onChange={(e) => setBlockDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value={15}>15 Dakika</option>
                  <option value={30}>30 Dakika</option>
                  <option value={60}>1 Saat (60 Dakika)</option>
                  <option value={360}>6 Saat (360 Dakika)</option>
                  <option value={1440}>24 Saat (1440 Dakika)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Süre dolduğunda IP engeli otomatik kalkar veya aşağıdan manuel açılabilir.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Whitelisted IPs */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  <span>2. Güvenilir IP Beyaz Listesi (Whitelist)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Beyaz listedeki IP adresleri hiçbir zaman Brute-Force engeline takılmaz.
                </p>
              </div>

              {clientIp && !whitelistedIps.includes(clientIp) && (
                <button
                  type="button"
                  onClick={() => handleAddWhitelistIp(clientIp)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  + Kendi IP Adresimi Ekle ({clientIp})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWhitelistIp}
                onChange={(e) => setNewWhitelistIp(e.target.value)}
                placeholder="Güvenilir IP adresi ekle (Örn: 213.74.216.246)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleAddWhitelistIp(newWhitelistIp)}
                className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white cursor-pointer"
                title="Beyaz Listeye IP Ekle"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {whitelistedIps.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Henüz beyaz listeye eklenmiş IP yok.</span>
              ) : (
                whitelistedIps.map((ip) => (
                  <span
                    key={ip}
                    className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-extrabold flex items-center gap-2"
                  >
                    <span>{ip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWhitelistIp(ip)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Beyaz Listeden Kaldır"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 3. Blocked IPs List */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={15} className="text-rose-500" />
                  <span>3. Engellenen IP Adresleri ({blockedIps.length})</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Brute-Force koruması tarafından otomatik engellenen veya manuel bloklanan IP adresleri
                </p>
              </div>

              {/* Unified Red Plus (+) Add Button Rule */}
              <button
                type="button"
                onClick={() => setShowBanModal(true)}
                className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white shadow-md shadow-rose-600/20 cursor-pointer"
                title="Manuel IP Engelle"
              >
                <Plus size={16} />
              </button>
            </div>

            {blockedIps.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                Şu anda engellenmiş herhangi bir IP adresi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2">
                {blockedIps.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-rose-600 dark:text-rose-400">
                          {b.ip_address}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {b.is_permanent ? "Kalıcı Engel" : `${b.minutes_remaining || 1} dk kaldı`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">{b.reason}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUnbanTarget(b)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-700 dark:text-slate-300 hover:text-white font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="IP Engelini Kaldır"
                    >
                      <Unlock size={13} />
                      <span>Engeli Kaldır</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Central Database Backup & Maintenance (SQLite WAL) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Database size={15} className="text-indigo-500" />
                  <span>4. Merkezi Veritabanı Yedekleme & Bakım</span>
                  {backupInfo?.journal_mode && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      {backupInfo.journal_mode} Aktif
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Günlük otomatik SQLite çevrimiçi yedekleme (son 14 gün) ve 30 günlük telemetri log temizliği aktiftir.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={creatingBackup}
                  onClick={handleCreateBackupNow}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={creatingBackup ? "animate-spin" : ""} />
                  <span>{creatingBackup ? "Alınıyor..." : "Şimdi Yedek Al"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBackup("")}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Canlı Yedeği İndir (.db)</span>
                </button>
              </div>
            </div>

            {backupInfo && (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Veritabanı Boyutu</div>
                  <div className="font-mono font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{backupInfo.db_size_mb} MB</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Telemetri Kayıtları</div>
                  <div className="font-mono font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{Number(backupInfo.telemetry_log_count || 0).toLocaleString("tr-TR")} satır</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Kayıtlı Yedekler</div>
                  <div className="font-mono font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{(backupInfo.backups || []).length} dosya</div>
                </div>
              </div>
            )}

            {backupInfo?.backups && backupInfo.backups.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {backupInfo.backups.slice(0, 6).map((bk) => (
                  <div
                    key={bk.filename}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">{bk.filename}</div>
                      <div className="text-[10px] text-slate-400">{bk.size_kb} KB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(bk.filename)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 text-slate-700 dark:text-slate-200 hover:text-white text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Download size={11} />
                      <span>İndir</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Panel Server Firewall Management (UFW Port & Access Control) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                  <Shield size={15} className="text-emerald-500" />
                  <span>5. Panel Sunucusu Güvenlik Duvarı (UFW Port Yönetimi)</span>
                  {fwStatus?.supported && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        fwStatus.enabled
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
                      }`}
                    >
                      {fwStatus.enabled ? "UFW Aktif" : "UFW Pasif"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Panel sunucusunda dış dünyaya açık TCP/UDP portlarını yönetin. Nginx arkasındaki <strong>8050</strong> ve <strong>3050</strong> portlarının dışarıya kapalı, yalnızca <strong>22 / 80 / 443</strong> açık olması önerilir.
                </p>
              </div>

              {fwStatus?.supported && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={fwBusy}
                    onClick={() => setShowFwHardenConfirm(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Sadece 22, 80, 443 açık bırakılır; 8050 ve 3050 dışarıya kapatılır"
                  >
                    <ShieldCheck size={13} />
                    <span>Önerilen Panel Profili (22/80/443)</span>
                  </button>
                  <button
                    type="button"
                    disabled={fwBusy}
                    onClick={handleToggleFirewall}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition-colors cursor-pointer disabled:opacity-50 ${
                      fwStatus.enabled
                        ? "bg-white dark:bg-slate-900 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border-rose-200 dark:border-rose-800"
                        : "bg-white dark:bg-slate-900 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border-emerald-200 dark:border-emerald-800"
                    }`}
                  >
                    {fwStatus.enabled ? "UFW Kapat" : "UFW Aç"}
                  </button>
                </div>
              )}
            </div>

            {fwFeedback && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  fwFeedback.type === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300"
                }`}
              >
                {fwFeedback.type === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />}
                <span>{fwFeedback.text}</span>
              </div>
            )}

            {fwLoading && !fwStatus ? (
              <div className="p-4 text-center text-slate-400 text-xs font-semibold">Güvenlik duvarı durumu okunuyor...</div>
            ) : !fwStatus?.supported ? (
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                {fwStatus?.message || "UFW yalnızca Linux panel sunucusunda çalışır."}
              </div>
            ) : (
              <>
                {/* Live Listening Ports Overview */}
                {Array.isArray(fwStatus.listening_ports) && fwStatus.listening_ports.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Sunucuda Dinlenen Portlar (Canlı)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fwStatus.listening_ports.map((lp, idx) => {
                        const isInternalExposed = lp.is_public && (lp.port === 8050 || lp.port === 3050);
                        return (
                          <span
                            key={`${lp.protocol}-${lp.port}-${lp.bind}-${idx}`}
                            className={`px-2 py-1 rounded-lg font-mono text-[10.5px] font-bold border ${
                              isInternalExposed
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                                : lp.is_public
                                  ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                                  : "bg-slate-100 dark:bg-slate-900/50 text-slate-500 border-slate-200/60 dark:border-slate-800"
                            }`}
                            title={`Süreç: ${lp.process} | Bağlı Adres: ${lp.bind}`}
                          >
                            {lp.port}/{lp.protocol} ({lp.is_public ? "0.0.0.0" : lp.bind}) • {lp.process}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Add Port Rule Form */}
                <form onSubmit={handleAddFirewallRule} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <div className="col-span-1 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Port / Aralık</label>
                    <input
                      type="text"
                      value={fwPort}
                      onChange={(e) => setFwPort(e.target.value)}
                      placeholder="443 veya 8050"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Protokol</label>
                    <select
                      value={fwProto}
                      onChange={(e) => setFwProto(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="any">TCP+UDP</option>
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aksiyon</label>
                    <select
                      value={fwAction}
                      onChange={(e) => setFwAction(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="allow">İzin Ver</option>
                      <option value="deny">Engelle</option>
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kaynak IP (Boş = Tümü)</label>
                    <input
                      type="text"
                      value={fwSourceIp}
                      onChange={(e) => setFwSourceIp(e.target.value)}
                      placeholder="Örn: 78.189.210.15"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={fwBusy}
                      className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white shadow-sm cursor-pointer disabled:opacity-50"
                      title="Yeni Port Kuralı Ekle"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </form>

                {/* Numbered UFW Rules List */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {(!fwStatus.rules || fwStatus.rules.length === 0) ? (
                    <div className="p-4 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      Tanımlı UFW kuralı bulunmuyor.
                    </div>
                  ) : (
                    fwStatus.rules.map((r) => (
                      <div
                        key={r.num}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-mono text-[10px] font-extrabold text-slate-400">#{r.num}</span>
                          <span className="font-mono font-extrabold text-slate-800 dark:text-slate-100">{r.to}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              r.action.startsWith("ALLOW")
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                                : "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25"
                            }`}
                          >
                            {r.action.startsWith("ALLOW") ? "İZİN VER" : "ENGELLE"}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            Kaynak: {r.from_ip === "Anywhere" ? "Tümü" : r.from_ip}
                          </span>
                          {r.is_critical && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              Kritik Port
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={fwBusy}
                          onClick={() => setFwDeleteRuleTarget(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                          title={`#${r.num} kuralını sil`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MANUEL IP BAN MODAL */}
      {showBanModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <h4 className="text-sm font-extrabold flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-600" />
              <span>Manuel IP Adresi Engelle</span>
            </h4>
            <form onSubmit={handleManualBan} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">IP Adresi</label>
                <input
                  type="text"
                  required
                  value={banIpInput}
                  onChange={(e) => setBanIpInput(e.target.value)}
                  placeholder="Örn: 185.220.101.45"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Engelleme Nedeni</label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={banIsPermanent}
                  onChange={(e) => setBanIsPermanent(e.target.checked)}
                  className="rounded accent-rose-600"
                />
                <span>Kalıcı Olarak Engelle</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold cursor-pointer"
                >
                  IP Engelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL FOR UNBAN */}
      {unbanTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">IP Engelini Kaldır?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="font-mono font-bold text-slate-900 dark:text-white">{unbanTarget.ip_address}</span> adresinin erişim engelini kaldırmak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnbanTarget(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmUnbanIp}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CUSTOM DELETE CONFIRMATION MODAL FOR UFW RULE */}
      {fwDeleteRuleTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Güvenlik Duvarı Kuralını Sil?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="font-mono font-bold text-slate-900 dark:text-white">#{fwDeleteRuleTarget.num} • {fwDeleteRuleTarget.to} ({fwDeleteRuleTarget.action})</span> kuralını silmek istediğinize emin misiniz?
                {fwDeleteRuleTarget.is_critical && (
                  <span className="block mt-1.5 text-rose-600 dark:text-rose-400 font-extrabold">
                    Dikkat: Bu kritik bir panel/SSH erişim portudur!
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFwDeleteRuleTarget(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={fwBusy}
                onClick={confirmDeleteFirewallRule}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL FOR RECOMMENDED HARDEN PRESET */}
      {showFwHardenConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Önerilen Panel Profilini Uygula</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Güvenli otomatik UFW yapılandırması</p>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <div>• <strong>Varsayılan Gelen Trafik:</strong> Engelle (Deny)</div>
              <div>• <strong>Açık Bırakılacak Portlar:</strong> <code className="font-mono font-extrabold text-emerald-600">22/tcp (SSH)</code>, <code className="font-mono font-extrabold text-emerald-600">80/tcp</code>, <code className="font-mono font-extrabold text-emerald-600">443/tcp (HTTPS)</code></div>
              <div>• <strong>Dışarıya Kapatılacak İç Portlar:</strong> <code className="font-mono font-extrabold text-rose-600">8050</code> ve <code className="font-mono font-extrabold text-rose-600">3050</code> (yalnızca Nginx üzerinden yerel erişim)</div>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowFwHardenConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={fwBusy}
                onClick={confirmApplyFirewallHardenPreset}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
              >
                {fwBusy ? "Uygulanıyor..." : "Profili Uygula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
