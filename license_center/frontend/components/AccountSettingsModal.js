import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  ShieldCheck,
  Shield,
  Mail,
  Smartphone,
  Check,
  CheckCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Send,
  Settings,
  Eye,
  EyeOff,
  Lock,
  User,
  Clock
} from "lucide-react";

const AUTO_LOGOUT_OPTIONS = [
  {
    value: 5,
    title: "5 Dakika",
    desc: "Yüksek güvenlik — 5 dakika hareketsizlikte oturum otomatik kapanır."
  },
  {
    value: 15,
    title: "15 Dakika (Önerilen)",
    desc: "Dengeli güvenlik — 15 dakika hareketsizlikte otomatik çıkış yapılır."
  },
  {
    value: 30,
    title: "30 Dakika",
    desc: "30 dakika boyunca fare veya klavye hareketi olmazsa oturum sonlanır."
  },
  {
    value: 60,
    title: "1 Saat (60 Dakika)",
    desc: "Uzun çalışma oturumları için 1 saat hareketsizlik toleransı."
  },
  {
    value: 0,
    title: "Kapalı (Otomatik Çıkış Yapma)",
    desc: "Oturum siz manuel olarak çıkış yapana kadar açık kalır."
  }
];

const METHOD_DEFS = [
  {
    id: "email",
    title: "E-Posta (E-Mail)",
    shortTitle: "E-Posta",
    desc: "Girişte e-posta adresinize 6 haneli tek kullanımlık kod gönderilir",
    icon: Mail
  },
  {
    id: "google_auth",
    title: "Google Authenticator",
    shortTitle: "Google Auth",
    desc: "Google Authenticator mobil uygulaması ile 30 sn'lik kod üretilir",
    icon: Smartphone
  },
  {
    id: "microsoft_auth",
    title: "Microsoft Authenticator",
    shortTitle: "MS Auth",
    desc: "Microsoft Authenticator mobil uygulaması ile 30 sn'lik kod üretilir",
    icon: KeyRound
  }
];

const MODE_DEFS = [
  {
    mode: "single",
    title: "Tek Yöntem (Standart)",
    desc: "Sadece seçili olan tek doğrulama yöntemi sorulur"
  },
  {
    mode: "all",
    title: "2 Aşamalı Zorunlu (VE Modu)",
    desc: "Örn: Önce E-Posta kodu, ardından Google Authenticator zorunlu"
  },
  {
    mode: "any",
    title: "Esnek / Yedekli (VEYA Modu)",
    desc: "Seçili yöntemlerden herhangi biriyle giriş yapılabilir"
  }
];

export function getUserInitials(user) {
  const name = (user?.full_name || user?.username || "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onCurrentUserUpdated,
  onOpenSecuritySmtp,
  initialTab = "password" // "password" | "2fa"
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileUser, setProfileUser] = useState(currentUser || null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFeedback, setPwFeedback] = useState(null); // { type: "ok" | "err", text }

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMultiMode, setTwoFactorMultiMode] = useState("single");
  const [twoFactorActiveMethods, setTwoFactorActiveMethods] = useState(["google_auth"]);
  const [focusedMethod, setFocusedMethod] = useState("google_auth");
  const [methodsCache, setMethodsCache] = useState({
    email: { enrolled: false, codeSent: false },
    google_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false },
    microsoft_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false }
  });
  const [setupLoading, setSetupLoading] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [saving2faConfig, setSaving2faConfig] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [confirmDisable2fa, setConfirmDisable2fa] = useState(false);

  // Auto-Logout Preference State
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(15);
  const [savingAutoLogout, setSavingAutoLogout] = useState(false);
  const [autoLogoutFeedback, setAutoLogoutFeedback] = useState(null);

  const syncUser = (updatedUserObj) => {
    if (!updatedUserObj) return;
    setProfileUser(updatedUserObj);
    try {
      sessionStorage.setItem("master_user", JSON.stringify(updatedUserObj));
    } catch (e) {}
    if (onCurrentUserUpdated) {
      onCurrentUserUpdated(updatedUserObj);
    }
  };

  const fetchTotpSetupForMethod = async (targetUser, methodId, resetSecret = false) => {
    if (!targetUser?.id) return;
    if (methodId !== "google_auth" && methodId !== "microsoft_auth") return;
    setSetupLoading(true);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}/2fa/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": targetUser.username || "admin"
        },
        body: JSON.stringify({ method: methodId, reset: resetSecret })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `QR kurulumu alınamadı (HTTP ${res.status}).`);
      }
      setMethodsCache((prev) => ({
        ...prev,
        [methodId]: {
          ...(prev[methodId] || {}),
          secret: data.secret || "",
          otpauthUrl: data.otpauth_url || "",
          qrSvg: data.qr_svg_data_uri || "",
          enrolled: Boolean(data.enrolled)
        }
      }));
      if (resetSecret) {
        setTestCode("");
        setStatusFeedback({
          type: "ok",
          text: "Yeni QR kod ve kurulum anahtarı üretildi. Telefonunuzdan okutup aşağıdaki 6 haneli kodla eşleştirebilirsiniz."
        });
      }
    } catch (err) {
      setStatusFeedback({ type: "err", text: err.message || "QR kodu alınırken hata oluştu." });
    } finally {
      setSetupLoading(false);
    }
  };

  const hydrateFromUser = (u) => {
    if (!u) return;
    setProfileUser(u);
    const activeList =
      Array.isArray(u.two_factor_methods) && u.two_factor_methods.length > 0
        ? u.two_factor_methods
        : [
            ...(u.email_2fa_enabled ? ["email"] : []),
            ...(u.totp_enabled ? ["google_auth"] : [])
          ];
    const isEnabled = Boolean(u.two_factor_enabled || activeList.length > 0);
    const resolvedMethods = activeList.length > 0 ? activeList : ["google_auth"];
    const resolvedMode =
      resolvedMethods.length <= 1
        ? "single"
        : u.two_factor_mode === "all" || u.two_factor_mode === "any"
          ? u.two_factor_mode
          : "any";
    const initialFocus = resolvedMethods[0] || "google_auth";

    setTwoFactorEnabled(isEnabled);
    setTwoFactorActiveMethods(resolvedMethods);
    setTwoFactorMultiMode(resolvedMode);
    setFocusedMethod(initialFocus);

    const meta = u.two_factor_meta || {};
    setMethodsCache({
      email: { enrolled: Boolean(meta.email?.enrolled || u.email_2fa_enabled), codeSent: false },
      google_auth: {
        secret: "",
        otpauthUrl: "",
        qrSvg: "",
        enrolled: Boolean(meta.google_auth?.enrolled || u.totp_enabled)
      },
      microsoft_auth: {
        secret: "",
        otpauthUrl: "",
        qrSvg: "",
        enrolled: Boolean(meta.microsoft_auth?.enrolled)
      }
    });

    if (isEnabled && (initialFocus === "google_auth" || initialFocus === "microsoft_auth")) {
      fetchTotpSetupForMethod(u, initialFocus, false);
    }

    const savedIdle = u.auto_logout_minutes !== undefined && u.auto_logout_minutes !== null
      ? Number(u.auto_logout_minutes)
      : 15;
    setAutoLogoutMinutes(Number.isNaN(savedIdle) ? 15 : savedIdle);
  };

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setActiveTab(initialTab || "password");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPwFeedback(null);
    setStatusFeedback(null);
    setAutoLogoutFeedback(null);
    setTestCode("");
    setSecretCopied(false);
    setConfirmDisable2fa(false);

    // Fetch fresh user record from backend so 2FA status is always live
    (async () => {
      try {
        const res = await fetch("/api/v1/users");
        if (res.ok) {
          const list = await res.json();
          const fresh = Array.isArray(list) ? list.find((x) => x.id === currentUser.id) : null;
          if (fresh) {
            syncUser(fresh);
            hydrateFromUser(fresh);
            return;
          }
        }
      } catch (e) {}
      hydrateFromUser(currentUser);
    })();
  }, [isOpen, initialTab]);

  if (!isOpen || !currentUser) return null;

  const userObj = profileUser || currentUser;

  // Password Strength Helper
  const getPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 6) score += 1;
    if (pw.length >= 10) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    if (score <= 2) return { score: 1, label: "Zayıf", color: "bg-rose-500 text-rose-600 dark:text-rose-400" };
    if (score <= 3) return { score: 2, label: "Orta", color: "bg-amber-500 text-amber-600 dark:text-amber-400" };
    return { score: 3, label: "Güçlü", color: "bg-emerald-500 text-emerald-600 dark:text-emerald-400" };
  };
  const pwStrength = getPasswordStrength(newPassword);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwFeedback(null);

    if (!currentPassword.trim()) {
      setPwFeedback({ type: "err", text: "Lütfen mevcut şifrenizi giriniz." });
      return;
    }
    if (newPassword.trim().length < 6) {
      setPwFeedback({ type: "err", text: "Yeni şifre en az 6 karakter olmalıdır." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: "err", text: "Yeni şifre ve şifre tekrarı birbiriyle eşleşmiyor." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/v1/users/${userObj.id}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": userObj.username || "admin"
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Şifre güncellenemedi.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (data.user) syncUser(data.user);
      setPwFeedback({
        type: "ok",
        text: data.message || "Şifreniz başarıyla güncellendi. Bir sonraki girişinizde yeni şifreniz geçerli olacaktır."
      });
    } catch (err) {
      setPwFeedback({ type: "err", text: err.message || "Şifre değiştirme sırasında hata oluştu." });
    } finally {
      setSavingPassword(false);
    }
  };

  // 2FA Handlers
  const focusMethod = (methodId) => {
    setFocusedMethod(methodId);
    setStatusFeedback(null);
    setTestCode("");
    if (
      (methodId === "google_auth" || methodId === "microsoft_auth") &&
      !methodsCache[methodId]?.qrSvg &&
      !methodsCache[methodId]?.secret
    ) {
      fetchTotpSetupForMethod(userObj, methodId, false);
    }
  };

  const handleToggleMaster2fa = () => {
    if (twoFactorEnabled) {
      if (userObj.two_factor_enabled || userObj.totp_enabled || userObj.email_2fa_enabled) {
        setConfirmDisable2fa(true);
      } else {
        setTwoFactorEnabled(false);
        setStatusFeedback(null);
      }
      return;
    }
    setTwoFactorEnabled(true);
    setStatusFeedback(null);
    const firstMethod = twoFactorActiveMethods[0] || "google_auth";
    setFocusedMethod(firstMethod);
    if (firstMethod === "google_auth" || firstMethod === "microsoft_auth") {
      if (!methodsCache[firstMethod]?.qrSvg && !methodsCache[firstMethod]?.secret) {
        fetchTotpSetupForMethod(userObj, firstMethod, false);
      }
    }
  };

  const executeConfirmDisable2fa = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${userObj.id}/2fa/disable`, {
        method: "POST",
        headers: { "X-User-Name": userObj.username || "admin" }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "2FA kapatılamadı.");
      setTwoFactorEnabled(false);
      setConfirmDisable2fa(false);
      if (data.user) syncUser(data.user);
      setStatusFeedback({ type: "ok", text: "2 Aşamalı Doğrulama (2FA) hesabınız için kapatıldı." });
    } catch (err) {
      setConfirmDisable2fa(false);
      setStatusFeedback({ type: "err", text: err.message || "2FA kapatılırken hata oluştu." });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSelectMode = (nextMode) => {
    setTwoFactorMultiMode(nextMode);
    setStatusFeedback(null);
    if (nextMode === "single") {
      const keep = focusedMethod || twoFactorActiveMethods[0] || "google_auth";
      setTwoFactorActiveMethods([keep]);
      setFocusedMethod(keep);
    } else {
      let nextList = Array.isArray(twoFactorActiveMethods) ? [...twoFactorActiveMethods] : [];
      if (nextList.length < 2) {
        const curr = nextList[0] || focusedMethod || "google_auth";
        nextList = curr === "google_auth" || curr === "microsoft_auth" ? ["email", curr] : ["email", "google_auth"];
      }
      setTwoFactorActiveMethods(nextList);
      nextList.forEach((m) => {
        if ((m === "google_auth" || m === "microsoft_auth") && !methodsCache[m]?.secret) {
          fetchTotpSetupForMethod(userObj, m, false);
        }
      });
    }
  };

  const handleCardClick = (methodId) => {
    if (twoFactorMultiMode === "single") {
      setTwoFactorActiveMethods([methodId]);
      focusMethod(methodId);
      return;
    }
    if (!twoFactorActiveMethods.includes(methodId)) {
      setTwoFactorActiveMethods((prev) => [...prev, methodId]);
    }
    focusMethod(methodId);
  };

  const handleCombineOrToggleMethod = (e, methodId) => {
    e.stopPropagation();
    setStatusFeedback(null);
    if (twoFactorMultiMode === "single") {
      const currentSingle = twoFactorActiveMethods[0] || focusedMethod || "google_auth";
      if (currentSingle === methodId) {
        focusMethod(methodId);
        return;
      }
      const ordered = methodId === "email" ? ["email", currentSingle] : [currentSingle, methodId];
      setTwoFactorMultiMode("all");
      setTwoFactorActiveMethods(ordered);
      focusMethod(methodId);
      return;
    }
    const exists = twoFactorActiveMethods.includes(methodId);
    if (exists) {
      if (twoFactorActiveMethods.length <= 1) return;
      const nextList = twoFactorActiveMethods.filter((x) => x !== methodId);
      setTwoFactorActiveMethods(nextList);
      if (nextList.length === 1) setTwoFactorMultiMode("single");
      if (focusedMethod === methodId) focusMethod(nextList[0]);
    } else {
      setTwoFactorActiveMethods((prev) => [...prev, methodId]);
      focusMethod(methodId);
    }
  };

  const handleSendEmailTestCode = async () => {
    const targetEmail = (userObj.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setStatusFeedback({ type: "err", text: "Hesabınızda geçerli bir e-posta adresi tanımlı değil." });
      return;
    }
    setEmailSending(true);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/v1/users/${userObj.id}/2fa/email/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": userObj.username || "admin"
        },
        body: JSON.stringify({ email: targetEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.detail || "Doğrulama e-postası gönderilemedi.";
        setStatusFeedback({ type: "err", text: msg, needsSmtp: msg.toLowerCase().includes("smtp") });
        return;
      }
      setMethodsCache((prev) => ({ ...prev, email: { ...(prev.email || {}), codeSent: true } }));
      setStatusFeedback({
        type: "ok",
        text: data.message || `6 haneli test kodu ${targetEmail} adresine gönderildi.`
      });
    } catch (err) {
      setStatusFeedback({ type: "err", text: err.message || "E-posta gönderilemedi." });
    } finally {
      setEmailSending(false);
    }
  };

  const handleVerifyAndEnrollMethod = async () => {
    const cleanCode = testCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setStatusFeedback({
        type: "err",
        text:
          focusedMethod === "email"
            ? "Lütfen e-postanıza gelen 6 haneli doğrulama kodunu giriniz."
            : "Lütfen uygulamanızdaki 6 haneli kodu giriniz."
      });
      return;
    }
    setVerifyLoading(true);
    setStatusFeedback(null);
    try {
      const activeToSave = twoFactorActiveMethods.includes(focusedMethod)
        ? twoFactorActiveMethods
        : twoFactorMultiMode === "single"
          ? [focusedMethod]
          : [...twoFactorActiveMethods, focusedMethod];

      const res = await fetch(`/api/v1/users/${userObj.id}/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": userObj.username || "admin"
        },
        body: JSON.stringify({
          method: focusedMethod,
          code: cleanCode,
          mode: twoFactorMultiMode,
          active_methods: activeToSave
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Doğrulama kodu hatalı.");

      setMethodsCache((prev) => ({
        ...prev,
        [focusedMethod]: { ...(prev[focusedMethod] || {}), enrolled: true, codeSent: false }
      }));
      setTestCode("");
      if (data.user) syncUser(data.user);
      setStatusFeedback({
        type: "ok",
        text: data.message || "Doğrulama başarılı! Yöntem eşleştirildi ve kaydedildi."
      });
    } catch (err) {
      setStatusFeedback({ type: "err", text: err.message || "Doğrulama başarısız." });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSave2faConfig = async () => {
    setSaving2faConfig(true);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/v1/users/${userObj.id}/2fa/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": userObj.username || "admin"
        },
        body: JSON.stringify({
          enabled: twoFactorEnabled,
          mode: twoFactorMultiMode,
          active_methods: twoFactorEnabled ? twoFactorActiveMethods : []
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "2FA ayarları kaydedilemedi.");
      if (data.user) syncUser(data.user);
      setStatusFeedback({
        type: "ok",
        text: twoFactorEnabled
          ? "2FA güvenlik konfigürasyonunuz başarıyla kaydedildi."
          : "2FA koruması kapatıldı ve kaydedildi."
      });
    } catch (err) {
      setStatusFeedback({ type: "err", text: err.message || "2FA kaydedilirken hata oluştu." });
    } finally {
      setSaving2faConfig(false);
    }
  };

  const handleSaveAutoLogout = async () => {
    setSavingAutoLogout(true);
    setAutoLogoutFeedback(null);
    try {
      const mins = Number(autoLogoutMinutes) || 0;
      const res = await fetch(`/api/v1/users/${userObj.id}/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": userObj.username || "admin"
        },
        body: JSON.stringify({ auto_logout_minutes: mins })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Otomatik oturum ayarı kaydedilemedi.");
      try {
        sessionStorage.setItem("master_auto_logout_mins", String(mins));
      } catch (e) {}
      if (data.user) syncUser(data.user);
      setAutoLogoutFeedback({
        type: "ok",
        text:
          mins === 0
            ? "Otomatik oturum kapatma kapatıldı. Oturumunuz manuel çıkış yapana kadar açık kalacaktır."
            : `Otomatik oturum kapatma süresi ${mins} dakika olarak kaydedildi ve hemen aktif edildi.`
      });
    } catch (err) {
      setAutoLogoutFeedback({ type: "err", text: err.message || "Ayar kaydedilirken hata oluştu." });
    } finally {
      setSavingAutoLogout(false);
    }
  };

  const handleCopySecret = (sec) => {
    if (!sec) return;
    navigator.clipboard?.writeText(sec);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const focusedDef = METHOD_DEFS.find((m) => m.id === focusedMethod) || METHOD_DEFS[1];
  const focusedCache = methodsCache[focusedMethod] || {};
  const focusedQrSrc = focusedCache.qrSvg || "";
  const is2faCurrentlyActive = Boolean(
    userObj.two_factor_enabled || userObj.totp_enabled || userObj.email_2fa_enabled
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
              {getUserInitials(userObj)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Hesap Ayarları
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  @{userObj.username}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {userObj.full_name} • {userObj.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "password"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Lock size={14} />
            <span>Şifre Ayarları</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("2fa");
              if (
                twoFactorEnabled &&
                (focusedMethod === "google_auth" || focusedMethod === "microsoft_auth") &&
                !methodsCache[focusedMethod]?.qrSvg &&
                !methodsCache[focusedMethod]?.secret
              ) {
                fetchTotpSetupForMethod(userObj, focusedMethod, false);
              }
            }}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "2fa"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck size={14} />
            <span>2FA Konfigürasyonu</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                is2faCurrentlyActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {is2faCurrentlyActive ? "Aktif" : "Kapalı"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("session");
              setAutoLogoutFeedback(null);
            }}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "session"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Clock size={14} />
            <span>Otomatik Oturum</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold font-mono ${
                Number(userObj.auto_logout_minutes ?? 15) > 0
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {Number(userObj.auto_logout_minutes ?? 15) > 0
                ? `${Number(userObj.auto_logout_minutes ?? 15)} dk`
                : "Kapalı"}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === "password" ? (
            <form id="self-password-form" onSubmit={handlePasswordSubmit} className="space-y-5">
              {/* Profile Info Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Ad Soyad</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                    <User size={12} className="text-indigo-500" />
                    <span>{userObj.full_name}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">E-Posta</div>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {userObj.email}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Yetki Rolü</div>
                  <div className="mt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-extrabold uppercase text-[10px]">
                      {userObj.role || "admin"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mevcut Şifre
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Mevcut şifrenizi giriniz"
                      autoComplete="current-password"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      Yeni Şifre
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3].map((step) => (
                            <div
                              key={step}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                pwStrength.score >= step
                                  ? pwStrength.score === 1
                                    ? "bg-rose-500"
                                    : pwStrength.score === 2
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  : "bg-slate-200 dark:bg-slate-800"
                              }`}
                            />
                          ))}
                        </div>
                        <span
                          className={`text-[10px] font-extrabold ${
                            pwStrength.score === 1
                              ? "text-rose-600 dark:text-rose-400"
                              : pwStrength.score === 2
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {pwStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      Yeni Şifre (Tekrar)
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Yeni şifrenizi tekrar giriniz"
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <div
                        className={`mt-2 text-[10px] font-extrabold flex items-center gap-1 ${
                          newPassword === confirmPassword
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {newPassword === confirmPassword ? (
                          <>
                            <Check size={11} />
                            <span>Şifreler eşleşiyor</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={11} />
                            <span>Şifreler eşleşmiyor</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {pwFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-extrabold flex items-start gap-2 ${
                    pwFeedback.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {pwFeedback.type === "ok" ? (
                    <Check size={15} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  )}
                  <span>{pwFeedback.text}</span>
                </div>
              )}
            </form>
          ) : activeTab === "session" ? (
            /* AUTO-LOGOUT SESSION PREFERENCE TAB */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Hareketsizlikte Otomatik Oturum Kapatma (Auto-Logout)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Bu ayar yalnızca sizin kullanıcı hesabınız (<strong className="font-mono">@{userObj.username}</strong>) için geçerlidir. Belirlediğiniz süre boyunca fare veya klavye hareketi olmazsa oturumunuz güvenlik amacıyla otomatik sonlandırılır.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AUTO_LOGOUT_OPTIONS.map((opt) => {
                  const selected = Number(autoLogoutMinutes) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setAutoLogoutMinutes(opt.value);
                        setAutoLogoutFeedback(null);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                        selected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/35 border-indigo-500 ring-2 ring-indigo-500/20"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div
                          className={`text-xs font-extrabold ${
                            selected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {opt.title}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          {opt.desc}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {autoLogoutFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-extrabold flex items-start gap-2 ${
                    autoLogoutFeedback.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {autoLogoutFeedback.type === "ok" ? (
                    <Check size={15} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  )}
                  <span>{autoLogoutFeedback.text}</span>
                </div>
              )}
            </div>
          ) : (
            /* 2FA CONFIGURATION TAB */
            <div className="space-y-4">
              {/* Master Toggle Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      twoFactorEnabled
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                      İki Aşamalı Doğrulama (2FA) Koruması
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Giriş yaparken şifrenize ek olarak E-Posta veya Authenticator uygulaması doğrulaması ister.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleMaster2fa}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    twoFactorEnabled ? "bg-amber-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  title={twoFactorEnabled ? "2FA Kapat" : "2FA Aç"}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {twoFactorEnabled && (
                <div className="space-y-4">
                  {/* 1. Working Mode Selector */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      1. Çalışma Modu
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {MODE_DEFS.map((md) => {
                        const active = twoFactorMultiMode === md.mode;
                        return (
                          <button
                            key={md.mode}
                            type="button"
                            onClick={() => handleSelectMode(md.mode)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              active
                                ? "bg-amber-50/80 dark:bg-amber-950/35 border-amber-500 ring-2 ring-amber-500/20"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-extrabold ${
                                  active ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-100"
                                }`}
                              >
                                {md.title}
                              </span>
                              {active && <CheckCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                              {md.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Method Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        2. Doğrulama Yöntemleri
                      </span>
                      {twoFactorMultiMode !== "single" && twoFactorActiveMethods.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => setTwoFactorActiveMethods((prev) => [...prev].reverse())}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>Doğrulama Sırasını Değiştir (1 ⇄ 2)</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {METHOD_DEFS.map((m) => {
                        const IconComp = m.icon;
                        const activeIdx = twoFactorActiveMethods.indexOf(m.id);
                        const isSelected = activeIdx !== -1;
                        const isFocused = focusedMethod === m.id;
                        return (
                          <div
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCardClick(m.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCardClick(m.id);
                              }
                            }}
                            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? isFocused
                                  ? "bg-amber-50/75 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                                  : "bg-amber-50/40 dark:bg-amber-950/15 border-amber-400/70 dark:border-amber-700/70"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-amber-600 text-white shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                <IconComp size={16} />
                              </div>

                              {twoFactorMultiMode === "single" ? (
                                isSelected ? (
                                  <CheckCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCombineOrToggleMethod(e, m.id)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                  >
                                    + Birlikte Kullan
                                  </button>
                                )
                              ) : isSelected ? (
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white">
                                    {twoFactorMultiMode === "all" ? `${activeIdx + 1}. Adım` : "Aktif"}
                                  </span>
                                  {twoFactorActiveMethods.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleCombineOrToggleMethod(e, m.id)}
                                      className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 flex items-center justify-center text-[10px] font-extrabold cursor-pointer"
                                      title="Bu yöntemi kaldır"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleCombineOrToggleMethod(e, m.id)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                >
                                  + Ekle
                                </button>
                              )}
                            </div>

                            <div>
                              <div
                                className={`text-xs font-extrabold ${
                                  isSelected ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-100"
                                }`}
                              >
                                {m.title}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">
                                {m.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Focused Method Setup Box */}
                  {focusedMethod === "email" ? (
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            E-Posta (E-Mail) 2FA Kurulumu
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              focusedCache.enrolled
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            {focusedCache.enrolled ? "Doğrulandı & Hazır" : "Test Kodu ile Doğrulayabilirsiniz"}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={emailSending}
                          onClick={handleSendEmailTestCode}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Send size={12} />
                          <span>
                            {emailSending
                              ? "Gönderiliyor..."
                              : focusedCache.codeSent
                                ? "Kodu Tekrar Gönder"
                                : "Test Kodu Gönder"}
                          </span>
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Giriş sırasında <strong className="font-mono text-slate-900 dark:text-white">{userObj.email}</strong> adresinize 6 haneli tek kullanımlık kod gönderilir.
                      </p>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={testCode}
                          onChange={(e) => setTestCode(e.target.value.replace(/[^0-9]/g, ""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleVerifyAndEnrollMethod();
                            }
                          }}
                          placeholder="E-postaya gelen 6 haneli kod"
                          className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          disabled={verifyLoading || testCode.length !== 6}
                          onClick={handleVerifyAndEnrollMethod}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer shrink-0"
                        >
                          {verifyLoading ? "Doğrulanıyor..." : "Test Et & Eşleştir"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {focusedDef.title} Kurulumu
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              focusedCache.enrolled
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            {focusedCache.enrolled ? "Eşleştirildi ✓" : "QR Kodu Okutup Eşleştirin"}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={setupLoading}
                          onClick={() => fetchTotpSetupForMethod(userObj, focusedMethod, true)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={setupLoading ? "animate-spin" : ""} />
                          <span>Yeni QR / Anahtar Üret</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        <div className="w-40 h-40 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
                          {setupLoading && !focusedQrSrc ? (
                            <span className="text-[11px] font-bold text-slate-400">QR Yükleniyor...</span>
                          ) : focusedQrSrc ? (
                            <img src={focusedQrSrc} alt={`${focusedDef.title} QR`} className="w-full h-full object-contain" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => fetchTotpSetupForMethod(userObj, focusedMethod, false)}
                              className="text-[11px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                            >
                              QR Kodu Yükle
                            </button>
                          )}
                        </div>

                        <div className="flex-1 w-full space-y-3 text-[11px] text-slate-600 dark:text-slate-300">
                          <div className="space-y-1">
                            <div className="font-extrabold text-slate-800 dark:text-white">Nasıl Eşleştirilir?</div>
                            <p>
                              1. Telefonunuzda <strong>{focusedDef.title}</strong> uygulamasını açın.
                            </p>
                            <p>
                              2. <strong>QR Kodu Tara</strong> ile kodu okutun ve oluşan 6 haneli kodu aşağıya girip doğrulayın.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              MANUEL KURULUM ANAHTARI (SECRET KEY)
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs font-extrabold text-slate-800 dark:text-slate-100 select-all tracking-wider truncate">
                                {focusedCache.secret || "—"}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopySecret(focusedCache.secret)}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                              >
                                {secretCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                <span>{secretCopied ? "Kopyalandı" : "Kopyala"}</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={testCode}
                              onChange={(e) => setTestCode(e.target.value.replace(/[^0-9]/g, ""))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleVerifyAndEnrollMethod();
                                }
                              }}
                              placeholder="Uygulamadaki 6 haneli kodu girin"
                              className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              disabled={verifyLoading || testCode.length !== 6}
                              onClick={handleVerifyAndEnrollMethod}
                              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer shrink-0"
                            >
                              {verifyLoading ? "Test Ediliyor..." : "Test Et & Eşleştir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {statusFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-extrabold space-y-2 ${
                    statusFeedback.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {statusFeedback.type === "ok" ? (
                      <Check size={15} className="shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    )}
                    <span>{statusFeedback.text}</span>
                  </div>
                  {statusFeedback.needsSmtp && onOpenSecuritySmtp && (
                    <button
                      type="button"
                      onClick={onOpenSecuritySmtp}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Settings size={12} />
                      <span>Güvenlik Kalkanı → SMTP Ayarlarını Aç</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Kapat
          </button>

          {activeTab === "password" ? (
            <button
              type="submit"
              form="self-password-form"
              disabled={savingPassword}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <KeyRound size={14} />
              <span>{savingPassword ? "Güncelleniyor..." : "Şifreyi Güncelle"}</span>
            </button>
          ) : activeTab === "session" ? (
            <button
              type="button"
              disabled={savingAutoLogout}
              onClick={handleSaveAutoLogout}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Clock size={14} />
              <span>{savingAutoLogout ? "Kaydediliyor..." : "Oturum Ayarını Kaydet"}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving2faConfig}
              onClick={handleSave2faConfig}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ShieldCheck size={14} />
              <span>{saving2faConfig ? "Kaydediliyor..." : "2FA Ayarlarını Kaydet"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom 2FA Disable Confirmation Modal (No browser confirm()) */}
      {confirmDisable2fa && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center animate-pulse shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">2FA Korumasını Kapat</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hesabınız için iki aşamalı doğrulama devre dışı bırakılacak.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Emin misiniz? Kapatıldığında girişlerinizde yalnızca kullanıcı adı ve şifre sorulacaktır.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDisable2fa(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={verifyLoading}
                onClick={executeConfirmDisable2fa}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
              >
                {verifyLoading ? "Kapatılıyor..." : "2FA Kapat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
