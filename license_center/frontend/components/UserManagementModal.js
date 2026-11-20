import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  CheckCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Mail,
  User,
  Key,
  KeyRound,
  Copy,
  RefreshCw,
  Smartphone,
  Send,
  Settings,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

const METHOD_DEFS = [
  {
    id: "email",
    title: "E-Posta (E-Mail)",
    shortTitle: "E-Posta",
    desc: "Girişte e-posta adresine 6 haneli tek kullanımlık kod gönderilir",
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

export default function UserManagementModal({
  isOpen,
  onClose,
  currentUser,
  onCurrentUserUpdated,
  onOpenSecuritySmtp,
  initialEditUserId = null
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // User Form states
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom Delete Confirmation Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Custom 2FA Disable Confirmation Modal state
  const [confirmDisable2fa, setConfirmDisable2fa] = useState(false);

  // PBX-Style Unified 2FA Designer State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMultiMode, setTwoFactorMultiMode] = useState("single"); // single | all | any
  const [twoFactorActiveMethods, setTwoFactorActiveMethods] = useState(["google_auth"]);
  const [focusedMethod, setFocusedMethod] = useState("google_auth"); // email | google_auth | microsoft_auth
  const [methodsCache, setMethodsCache] = useState({
    email: { enrolled: false, codeSent: false },
    google_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false },
    microsoft_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false }
  });
  const [setupLoading, setSetupLoading] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null); // { type: 'ok' | 'err', text, needsSmtp?: bool }
  const [secretCopied, setSecretCopied] = useState(false);

  const reset2faDesigner = () => {
    setTwoFactorEnabled(false);
    setTwoFactorMultiMode("single");
    setTwoFactorActiveMethods(["google_auth"]);
    setFocusedMethod("google_auth");
    setMethodsCache({
      email: { enrolled: false, codeSent: false },
      google_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false },
      microsoft_auth: { secret: "", otpauthUrl: "", qrSvg: "", enrolled: false }
    });
    setSetupLoading(false);
    setTestCode("");
    setVerifyLoading(false);
    setEmailSending(false);
    setStatusFeedback(null);
    setSecretCopied(false);
    setConfirmDisable2fa(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers().then((loadedUsers) => {
        if (initialEditUserId && Array.isArray(loadedUsers)) {
          const target = loadedUsers.find((x) => x.id === initialEditUserId);
          if (target) {
            handleOpenEdit(target);
          }
        }
      });
    } else {
      setShowFormModal(false);
      reset2faDesigner();
    }
  }, [isOpen, initialEditUserId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/users");
      if (res.ok) {
        const list = await res.json();
        setUsers(list);
        return list;
      }
    } catch (e) {
      console.error("Fetch users error:", e);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const syncCurrentUser = (updatedUserObj) => {
    if (currentUser && updatedUserObj && currentUser.id === updatedUserObj.id) {
      try {
        sessionStorage.setItem("master_user", JSON.stringify(updatedUserObj));
      } catch (e) {}
      if (onCurrentUserUpdated) {
        onCurrentUserUpdated(updatedUserObj);
      }
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
          "X-User-Name": currentUser?.username || "admin"
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
      setStatusFeedback({
        type: "err",
        text: err.message || "QR kodu alınırken hata oluştu."
      });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername("");
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("admin");
    setIsActive(true);
    setErrorMsg("");
    reset2faDesigner();
    setShowFormModal(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role || "admin");
    setIsActive(u.is_active);
    setErrorMsg("");
    setStatusFeedback(null);
    setTestCode("");
    setSecretCopied(false);
    setConfirmDisable2fa(false);

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

    setShowFormModal(true);

    if (isEnabled && (initialFocus === "google_auth" || initialFocus === "microsoft_auth")) {
      fetchTotpSetupForMethod(u, initialFocus, false);
    }
  };

  const focusMethod = (methodId) => {
    setFocusedMethod(methodId);
    setStatusFeedback(null);
    setTestCode("");
    if (
      editingUser &&
      (methodId === "google_auth" || methodId === "microsoft_auth") &&
      !methodsCache[methodId]?.qrSvg &&
      !methodsCache[methodId]?.secret
    ) {
      fetchTotpSetupForMethod(editingUser, methodId, false);
    }
  };

  const handleToggleMaster2fa = () => {
    if (twoFactorEnabled) {
      if (editingUser && (editingUser.two_factor_enabled || editingUser.totp_enabled || editingUser.email_2fa_enabled)) {
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
    if (editingUser && (firstMethod === "google_auth" || firstMethod === "microsoft_auth")) {
      if (!methodsCache[firstMethod]?.qrSvg && !methodsCache[firstMethod]?.secret) {
        fetchTotpSetupForMethod(editingUser, firstMethod, false);
      }
    }
  };

  const executeConfirmDisable2fa = async () => {
    if (!editingUser?.id) {
      setTwoFactorEnabled(false);
      setConfirmDisable2fa(false);
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}/2fa/disable`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "2FA kapatılamadı.");
      }
      setTwoFactorEnabled(false);
      setConfirmDisable2fa(false);
      if (data.user) {
        setEditingUser(data.user);
        syncCurrentUser(data.user);
      }
      setStatusFeedback({ type: "ok", text: "2 Aşamalı Doğrulama (2FA) bu kullanıcı için kapatıldı." });
      fetchUsers();
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
        if (curr === "google_auth" || curr === "microsoft_auth") {
          nextList = ["email", curr];
        } else {
          nextList = ["email", "google_auth"];
        }
      }
      setTwoFactorActiveMethods(nextList);
      if (editingUser) {
        nextList.forEach((m) => {
          if ((m === "google_auth" || m === "microsoft_auth") && !methodsCache[m]?.secret) {
            fetchTotpSetupForMethod(editingUser, m, false);
          }
        });
      }
    }
  };

  const handleCardClick = (methodId) => {
    if (twoFactorMultiMode === "single") {
      setTwoFactorActiveMethods([methodId]);
      focusMethod(methodId);
      return;
    }
    // In multi mode (all / any), clicking card focuses its setup panel (and adds it if not active yet)
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
      // "+ Birlikte Kullan" switches to 2 Aşamalı Zorunlu (VE Modu) with both selected!
      const ordered =
        methodId === "email" ? ["email", currentSingle] : [currentSingle, methodId];
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
      if (nextList.length === 1) {
        setTwoFactorMultiMode("single");
      }
      if (focusedMethod === methodId) {
        focusMethod(nextList[0]);
      }
    } else {
      const nextList = [...twoFactorActiveMethods, methodId];
      setTwoFactorActiveMethods(nextList);
      focusMethod(methodId);
    }
  };

  const handleSendEmailTestCode = async () => {
    if (!editingUser?.id) return;
    const targetEmail = (email || editingUser.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setStatusFeedback({ type: "err", text: "Lütfen geçerli bir e-posta adresi giriniz." });
      return;
    }
    setEmailSending(true);
    setStatusFeedback(null);
    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}/2fa/email/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({ email: targetEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.detail || "Doğrulama e-postası gönderilemedi.";
        setStatusFeedback({
          type: "err",
          text: msg,
          needsSmtp: msg.toLowerCase().includes("smtp")
        });
        return;
      }
      setMethodsCache((prev) => ({
        ...prev,
        email: { ...(prev.email || {}), codeSent: true }
      }));
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
    if (!editingUser?.id) return;
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

      const res = await fetch(`/api/v1/users/${editingUser.id}/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          method: focusedMethod,
          code: cleanCode,
          mode: twoFactorMultiMode,
          active_methods: activeToSave
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Doğrulama kodu hatalı.");
      }

      setMethodsCache((prev) => ({
        ...prev,
        [focusedMethod]: { ...(prev[focusedMethod] || {}), enrolled: true, codeSent: false }
      }));
      setTestCode("");
      if (data.user) {
        setEditingUser(data.user);
        syncCurrentUser(data.user);
      }
      setStatusFeedback({
        type: "ok",
        text: data.message || "Doğrulama başarılı! Yöntem eşleştirildi ve kaydedildi."
      });
      fetchUsers();
    } catch (err) {
      setStatusFeedback({ type: "err", text: err.message || "Doğrulama başarısız." });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCopySecret = (sec) => {
    if (!sec) return;
    navigator.clipboard?.writeText(sec);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim() || !email.trim()) {
      setErrorMsg("Lütfen zorunlu alanları doldurunuz.");
      return;
    }

    setSavingUser(true);
    setErrorMsg("");
    try {
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : `/api/v1/users`;
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          full_name: fullName.trim(),
          email: email.trim(),
          password: password,
          role,
          is_active: isActive,
          performed_by: currentUser?.username || "admin"
        })
      });

      const savedUser = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(savedUser.detail || "İşlem başarısız.");
      }

      // Persist complete 2FA configuration (enabled, single/all/any mode, active methods)
      if (savedUser?.id) {
        const cfgRes = await fetch(`/api/v1/users/${savedUser.id}/2fa/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Name": currentUser?.username || "admin"
          },
          body: JSON.stringify({
            enabled: twoFactorEnabled,
            mode: twoFactorMultiMode,
            active_methods: twoFactorEnabled ? twoFactorActiveMethods : []
          })
        });
        const cfgData = await cfgRes.json().catch(() => ({}));
        if (cfgRes.ok && cfgData?.user) {
          syncCurrentUser(cfgData.user);
        }
      }

      await fetchUsers();
      setShowFormModal(false);
      reset2faDesigner();
    } catch (err) {
      setErrorMsg(err.message || "Kaydederken bir hata oluştu.");
    } finally {
      setSavingUser(false);
    }
  };

  const confirmDelete = (u) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/v1/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        setDeleteModalOpen(false);
        setUserToDelete(null);
        fetchUsers();
      }
    } catch (e) {
      console.error("Delete user error:", e);
    }
  };

  if (!isOpen) return null;

  const focusedCache = methodsCache[focusedMethod] || {};
  const focusedQrSrc =
    focusedCache.qrSvg ||
    (focusedCache.otpauthUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
          focusedCache.otpauthUrl
        )}`
      : "");
  const focusedDef = METHOD_DEFS.find((m) => m.id === focusedMethod) || METHOD_DEFS[1];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-600/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-extrabold">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Merkezi Portal Kullanıcı Yönetimi
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Kullanıcı hesapları, yetkiler ve kullanıcı bazlı Tek / 2 Aşamalı 2FA ayarları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unified Add Button Rule */}
            <button
              onClick={handleOpenAdd}
              className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all text-white shadow-md shadow-rose-600/20 cursor-pointer"
              title="Yeni Kullanıcı Ekle"
            >
              <Plus size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Users List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading && users.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400">
              Kullanıcılar yükleniyor...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((u) => {
                const mList =
                  Array.isArray(u.two_factor_methods) && u.two_factor_methods.length > 0
                    ? u.two_factor_methods
                    : [
                        ...(u.email_2fa_enabled ? ["email"] : []),
                        ...(u.totp_enabled ? ["google_auth"] : [])
                      ];
                const hasAny2fa = Boolean(u.two_factor_enabled || mList.length > 0);
                const isTwoStage = u.two_factor_mode === "all" && mList.length >= 2;
                return (
                  <div
                    key={u.id}
                    className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3 relative group hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                          <User size={15} className="text-slate-400 shrink-0" />
                          <span className="truncate">{u.full_name}</span>
                        </div>
                        <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
                          @{u.username}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            u.role === "admin"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30"
                          }`}
                        >
                          {u.role === "admin" ? "Sistem Yöneticisi" : "Operatör"}
                        </span>

                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {hasAny2fa ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1">
                              <ShieldCheck size={10} />
                              <span>
                                {isTwoStage ? "2 Aşamalı 2FA" : "2FA Aktif"} (
                                {mList
                                  .map(
                                    (id) =>
                                      METHOD_DEFS.find((d) => d.id === id)?.shortTitle || id
                                  )
                                  .join(" + ")}
                                )
                              </span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/60 dark:border-slate-700 flex items-center gap-1">
                              <Shield size={10} />
                              <span>2FA Kapalı</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold space-y-1 border-t border-slate-200 dark:border-slate-800/60 pt-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        Son Giriş:{" "}
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString("tr-TR")
                          : "Henüz Giriş Yapmadı"}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/40">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer border ${
                          hasAny2fa
                            ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border-indigo-500/25"
                        }`}
                        title="Bu kullanıcının 2FA ayarlarını aç/kapat"
                      >
                        {hasAny2fa ? <ShieldCheck size={12} /> : <Key size={12} />}
                        <span>{hasAny2fa ? "2FA Yönet" : "2FA Ayarları"}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Kullanıcıyı Düzenle & 2FA Ayarları"
                        >
                          <Edit3 size={15} />
                        </button>

                        {u.username !== "admin" && (
                          <button
                            type="button"
                            onClick={() => confirmDelete(u)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT USER MODAL — PBX-STYLE SPACIOUS 2FA DESIGNER */}
      {showFormModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <User size={16} className="text-rose-600 dark:text-rose-500" />
                <span>
                  {editingUser
                    ? `Kullanıcıyı Düzenle — ${editingUser.full_name}`
                    : "Yeni Master Portal Kullanıcısı Ekle"}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  reset2faDesigner();
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-semibold">
              {/* Basic User Metadata Form */}
              <form id="master-user-form" onSubmit={handleSaveUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Ad Soyad</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Kullanıcı Adı</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingUser)}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Örn: ahmetyilmaz"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 font-mono text-slate-900 dark:text-white disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">E-Posta Adresi</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Örn: ahmet@nornia.com.tr"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      {editingUser ? "Yeni Şifre (Boş bırakılırsa değişmez)" : "Şifre"}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Yetki / Rol</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="admin">Yönetici (Tam Yetkili)</option>
                      <option value="operator">Operatör (Lisans Üretebilir)</option>
                    </select>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </form>

              {/* PBX-STYLE İKİ AŞAMALI DOĞRULAMA (2FA) PANEL */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 space-y-4">
                {/* 2FA Card Header + Master Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                        twoFactorEnabled
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/70"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Shield size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          İki Aşamalı Doğrulama (2FA)
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            twoFactorEnabled
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/70"
                              : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300/60 dark:border-slate-700"
                          }`}
                        >
                          {twoFactorEnabled ? "Aktif" : "Pasif"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Kullanıcı sisteme girerken ikinci aşama doğrulama kodu sorulsun mu?
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMaster2fa}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                    title={twoFactorEnabled ? "2FA Kapat" : "2FA Aç"}
                  >
                    {twoFactorEnabled ? (
                      <ToggleRight size={36} className="text-amber-600 dark:text-amber-400" />
                    ) : (
                      <ToggleLeft size={36} />
                    )}
                  </button>
                </div>

                {twoFactorEnabled && (
                  <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 animate-fadeIn">
                    {/* 1. DOĞRULAMA ÇALIŞMA MODU (TEK / 2 AŞAMALI VE / ESNEK VEYA) */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                      <div>
                        <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                          Doğrulama Çalışma Modu (Tek / 2 Aşamalı 2FA)
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          İsterseniz tek bir yöntem, isterseniz aynı anda hem E-Posta hem Google/Microsoft Authenticator (2 Aşamalı) kullanabilirsiniz.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {MODE_DEFS.map((opt) => {
                          const isModeActive = twoFactorMultiMode === opt.mode;
                          return (
                            <button
                              key={opt.mode}
                              type="button"
                              onClick={() => handleSelectMode(opt.mode)}
                              className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                                isModeActive
                                  ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/20"
                                  : "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span
                                  className={`text-[11px] font-extrabold ${
                                    isModeActive
                                      ? "text-amber-700 dark:text-amber-300"
                                      : "text-slate-800 dark:text-slate-100"
                                  }`}
                                >
                                  {opt.title}
                                </span>
                                {isModeActive && (
                                  <CheckCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-1">
                                {opt.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. 2FA DOĞRULAMA YÖNTEMİ SEÇİNİZ (3 KART — WHATSAPP YOK) */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-extrabold text-slate-800 dark:text-white">
                          {twoFactorMultiMode === "single"
                            ? "2FA Doğrulama Yöntemi Seçiniz"
                            : "Aktif 2FA Doğrulama Yöntemlerini Seçiniz (Birden Fazla Seçilebilir)"}
                        </label>

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
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                                      title="Mevcut yöntemle birlikte 2 aşamalı olarak kullan"
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
                                        className="w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 flex items-center justify-center text-[10px] font-extrabold cursor-pointer transition-colors"
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
                                    isSelected
                                      ? "text-amber-700 dark:text-amber-300"
                                      : "text-slate-800 dark:text-slate-100"
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

                    {/* 3. FOCUSED METHOD SETUP CARD (SIDE-BY-SIDE QR OR E-MAIL TEST) */}
                    {!editingUser ? (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        Seçtiğiniz 2FA çalışma modu ve yöntemler kullanıcıyı kaydettiğinizde otomatik aktif olur. QR / E-Posta test eşleştirmesini kullanıcı kaydedildikten sonra hemen yapabilir veya kullanıcı ilk girişinde tamamlayabilir.
                      </div>
                    ) : focusedMethod === "email" ? (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
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
                              {focusedCache.enrolled
                                ? "Doğrulandı & Hazır"
                                : "Aşağıdan Test Kodu Gönderip Doğrulayabilirsiniz"}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={emailSending}
                            onClick={handleSendEmailTestCode}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
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

                        <div className="space-y-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <div className="font-extrabold text-slate-800 dark:text-white">Nasıl Çalışır?</div>
                          <p className="leading-relaxed">
                            1. Kullanıcı giriş yaparken{" "}
                            <strong className="font-mono text-slate-900 dark:text-white">
                              {email || editingUser.email}
                            </strong>{" "}
                            adresine 5 dakika geçerli 6 haneli tek kullanımlık doğrulama kodu gönderilir.
                          </p>
                          <p className="leading-relaxed">
                            2. Yukarıdaki <strong>Test Kodu Gönder</strong> butonuna basıp gelen 6 haneli kodu aşağıdan doğrulayarak SMTP teslimatını hemen test edebilirsiniz.
                          </p>

                          <div className="flex items-center gap-2 pt-1">
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
                              placeholder="E-postaya gelen 6 haneli kodu test edin"
                              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              disabled={verifyLoading || testCode.length !== 6}
                              onClick={handleVerifyAndEnrollMethod}
                              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer shadow-xs shrink-0 transition-colors"
                            >
                              {verifyLoading ? "Doğrulanıyor..." : "Test Et & Eşleştir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
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
                              {focusedCache.enrolled
                                ? "Eşleştirildi ✓"
                                : "İlk Girişte veya Aşağıdan Eşleştirilebilir"}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={setupLoading}
                            onClick={() => fetchTotpSetupForMethod(editingUser, focusedMethod, true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw size={12} className={setupLoading ? "animate-spin" : ""} />
                            <span>Yeni QR / Anahtar Üret</span>
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                          {/* Left QR Code */}
                          <div className="w-40 h-40 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
                            {setupLoading && !focusedQrSrc ? (
                              <span className="text-[11px] font-bold text-slate-400">QR Yükleniyor...</span>
                            ) : focusedQrSrc ? (
                              <img
                                src={focusedQrSrc}
                                alt={`${focusedDef.title} QR`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => fetchTotpSetupForMethod(editingUser, focusedMethod, false)}
                                className="text-[11px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                              >
                                QR Kodu Yükle
                              </button>
                            )}
                          </div>

                          {/* Right Instructions + Manual Key + Test Input */}
                          <div className="flex-1 w-full space-y-3 text-[11px] text-slate-600 dark:text-slate-300">
                            <div className="space-y-1">
                              <div className="font-extrabold text-slate-800 dark:text-white">
                                Nasıl Eşleştirilir?
                              </div>
                              <p className="leading-relaxed">
                                1. Telefonunuzda <strong>{focusedDef.title}</strong> uygulamasını açın.
                              </p>
                              <p className="leading-relaxed">
                                2. <strong>+ (Hesap Ekle)</strong> menüsünden <strong>QR Kodu Tara</strong> seçeneği ile yandaki kodu okutun (veya kullanıcı ilk girişinde kendi ekranından okutabilir).
                              </p>
                            </div>

                            <div className="space-y-1">
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                MANUEL KURULUM ANAHTARI (SECRET KEY)
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs font-extrabold text-slate-800 dark:text-slate-100 select-all tracking-wider truncate">
                                  {focusedCache.secret || "—"}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopySecret(focusedCache.secret)}
                                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                                >
                                  {secretCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                  <span>{secretCopied ? "Kopyalandı" : "Kopyala"}</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-0.5">
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
                                placeholder="Uygulamadaki 6 haneli kodu test edin"
                                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                disabled={verifyLoading || testCode.length !== 6}
                                onClick={handleVerifyAndEnrollMethod}
                                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer shadow-xs shrink-0 transition-colors"
                              >
                                {verifyLoading ? "Test Ediliyor..." : "Test Et & Eşleştir"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback Banner (Success / Error + SMTP Shortcut) */}
                    {statusFeedback && (
                      <div
                        className={`p-3 rounded-xl border text-[11px] font-extrabold space-y-2 ${
                          statusFeedback.type === "ok"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {statusFeedback.type === "ok" ? (
                            <Check size={14} className="shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
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
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  reset2faDesigner();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Kapat
              </button>
              <button
                type="submit"
                form="master-user-form"
                disabled={savingUser}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                {savingUser ? "Kaydediliyor..." : "Bilgileri Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL FOR DISABLING 2FA */}
      {confirmDisable2fa && editingUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                2FA Korumasını Kapat?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="text-slate-900 dark:text-white font-bold">
                  {editingUser.full_name}
                </span>{" "}
                (@{editingUser.username}) kullanıcısının İki Aşamalı Doğrulama (2FA) korumasını tamamen devre dışı bırakmak istediğinize emin misiniz?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDisable2fa(false)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={verifyLoading}
                onClick={executeConfirmDisable2fa}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL RULE COMPLIANCE */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                Kullanıcıyı Sil?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="text-slate-900 dark:text-white font-bold">
                  {userToDelete.full_name}
                </span>{" "}
                (@{userToDelete.username}) isimli kullanıcıyı silmek istediğinize emin misiniz?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
