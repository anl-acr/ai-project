import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Mail,
  User,
  Key,
  Copy,
  RefreshCw,
  Smartphone,
  Send,
  Settings
} from "lucide-react";

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
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [isActive, setIsActive] = useState(true);
  const [setup2faAfterCreate, setSetup2faAfterCreate] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom Delete Confirmation Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Custom 2FA Disable Confirmation Modal state: { user, method: 'totp' | 'email' }
  const [disable2faTarget, setDisable2faTarget] = useState(null);

  // Inline Authenticator (TOTP) Setup state
  const [totpSetupActive, setTotpSetupActive] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpQrSvg, setTotpQrSvg] = useState("");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [totpSuccess, setTotpSuccess] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Inline E-Mail 2FA Setup state
  const [email2faSetupActive, setEmail2faSetupActive] = useState(false);
  const [email2faCodeSent, setEmail2faCodeSent] = useState(false);
  const [email2faVerifyCode, setEmail2faVerifyCode] = useState("");
  const [email2faError, setEmail2faError] = useState("");
  const [email2faSuccess, setEmail2faSuccess] = useState("");
  const [email2faLoading, setEmail2faLoading] = useState(false);
  const [email2faNeedsSmtp, setEmail2faNeedsSmtp] = useState(false);

  const resetInline2faState = () => {
    setTotpSetupActive(false);
    setTotpSecret("");
    setTotpUri("");
    setTotpQrSvg("");
    setTotpVerifyCode("");
    setTotpError("");
    setTotpSuccess("");
    setTotpLoading(false);
    setSecretCopied(false);

    setEmail2faSetupActive(false);
    setEmail2faCodeSent(false);
    setEmail2faVerifyCode("");
    setEmail2faError("");
    setEmail2faSuccess("");
    setEmail2faLoading(false);
    setEmail2faNeedsSmtp(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers().then((loadedUsers) => {
        if (initialEditUserId && Array.isArray(loadedUsers)) {
          const target = loadedUsers.find((x) => x.id === initialEditUserId);
          if (target) {
            handleOpenEdit(target, false);
          }
        }
      });
    } else {
      setShowFormModal(false);
      resetInline2faState();
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

  const syncCurrentUser2faFlags = (userId, patch) => {
    if (currentUser && currentUser.id === userId) {
      const updated = { ...currentUser, ...patch };
      try {
        sessionStorage.setItem("master_user", JSON.stringify(updated));
      } catch (e) {}
      if (onCurrentUserUpdated) {
        onCurrentUserUpdated(updated);
      }
    }
  };

  // --- Authenticator (TOTP) Handlers ---
  const startInline2FASetup = async (targetUser) => {
    if (!targetUser?.id) return;
    setTotpError("");
    setTotpSuccess("");
    setTotpVerifyCode("");
    setTotpLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}/2fa/setup`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `2FA kurulumu başlatılamadı (HTTP ${res.status}).`);
      }
      setTotpSecret(data.secret || "");
      setTotpUri(data.otpauth_url || "");
      setTotpQrSvg(data.qr_svg_data_uri || "");
      setTotpSetupActive(true);
    } catch (e) {
      setTotpError(e.message || "2FA QR kodu oluşturulurken bir hata oluştu.");
      setTotpSetupActive(false);
    } finally {
      setTotpLoading(false);
    }
  };

  const handleConfirmEnable2FA = async () => {
    if (!editingUser?.id) return;
    const cleanCode = totpVerifyCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setTotpError("Lütfen Authenticator uygulamanızdaki 6 haneli kodu giriniz.");
      return;
    }
    setTotpError("");
    setTotpSuccess("");
    setTotpLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({ code: cleanCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Doğrulama kodu hatalı.");
      }

      const updatedEditing = { ...editingUser, totp_enabled: true };
      setEditingUser(updatedEditing);
      setTotpSetupActive(false);
      setTotpVerifyCode("");
      setTotpSuccess("Authenticator (TOTP) 2FA başarıyla aktifleştirildi.");
      syncCurrentUser2faFlags(editingUser.id, { totp_enabled: true });
      fetchUsers();
    } catch (err) {
      setTotpError(err.message || "Authenticator 2FA etkinleştirilemedi.");
    } finally {
      setTotpLoading(false);
    }
  };

  // --- E-Mail 2FA Handlers ---
  const handleSendEmail2faSetupCode = async () => {
    if (!editingUser?.id) return;
    const targetEmail = (email || editingUser.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setEmail2faError("Lütfen geçerli bir e-posta adresi giriniz.");
      return;
    }
    setEmail2faError("");
    setEmail2faSuccess("");
    setEmail2faNeedsSmtp(false);
    setEmail2faLoading(true);
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
        if (msg.toLowerCase().includes("smtp")) {
          setEmail2faNeedsSmtp(true);
        }
        throw new Error(msg);
      }
      setEmail2faCodeSent(true);
      setEmail2faSuccess(data.message || `6 haneli doğrulama kodu ${targetEmail} adresine gönderildi.`);
    } catch (err) {
      setEmail2faError(err.message || "E-posta gönderilirken hata oluştu.");
    } finally {
      setEmail2faLoading(false);
    }
  };

  const handleConfirmEnableEmail2FA = async () => {
    if (!editingUser?.id) return;
    const cleanCode = email2faVerifyCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setEmail2faError("Lütfen e-postanıza gelen 6 haneli doğrulama kodunu giriniz.");
      return;
    }
    setEmail2faError("");
    setEmail2faSuccess("");
    setEmail2faLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${editingUser.id}/2fa/email/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({ code: cleanCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "E-posta doğrulama kodu hatalı.");
      }

      const updatedEditing = { ...editingUser, email_2fa_enabled: true };
      setEditingUser(updatedEditing);
      setEmail2faSetupActive(false);
      setEmail2faCodeSent(false);
      setEmail2faVerifyCode("");
      setEmail2faSuccess("E-Posta ile 2 Aşamalı Doğrulama (2FA) başarıyla aktifleştirildi.");
      syncCurrentUser2faFlags(editingUser.id, { email_2fa_enabled: true });
      fetchUsers();
    } catch (err) {
      setEmail2faError(err.message || "E-posta 2FA etkinleştirilemedi.");
    } finally {
      setEmail2faLoading(false);
    }
  };

  // --- Disable 2FA (Authenticator or E-Mail) ---
  const executeDisable2FA = async () => {
    if (!disable2faTarget?.user?.id) return;
    const { user: target, method } = disable2faTarget;
    const isEmail = method === "email";

    if (isEmail) {
      setEmail2faError("");
      setEmail2faSuccess("");
      setEmail2faLoading(true);
    } else {
      setTotpError("");
      setTotpSuccess("");
      setTotpLoading(true);
    }

    try {
      const endpoint = isEmail
        ? `/api/v1/users/${target.id}/2fa/email/disable`
        : `/api/v1/users/${target.id}/2fa/disable`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "2FA devre dışı bırakılamadı.");
      }
      setDisable2faTarget(null);
      if (editingUser && editingUser.id === target.id) {
        if (isEmail) {
          setEditingUser({ ...editingUser, email_2fa_enabled: false });
          setEmail2faSetupActive(false);
          setEmail2faCodeSent(false);
          setEmail2faSuccess("E-Posta 2FA koruması kapatıldı.");
        } else {
          setEditingUser({ ...editingUser, totp_enabled: false });
          setTotpSetupActive(false);
          setTotpSuccess("Authenticator 2FA koruması kapatıldı.");
        }
      }
      syncCurrentUser2faFlags(
        target.id,
        isEmail ? { email_2fa_enabled: false } : { totp_enabled: false }
      );
      fetchUsers();
    } catch (e) {
      if (isEmail) setEmail2faError(e.message || "E-Posta 2FA kapatılamadı.");
      else setTotpError(e.message || "Authenticator 2FA kapatılamadı.");
      setDisable2faTarget(null);
    } finally {
      if (isEmail) setEmail2faLoading(false);
      else setTotpLoading(false);
    }
  };

  const handleToggleTotpSwitch = () => {
    if (!editingUser) {
      setSetup2faAfterCreate((prev) => !prev);
      return;
    }
    if (editingUser.totp_enabled) {
      setDisable2faTarget({ user: editingUser, method: "totp" });
    } else if (totpSetupActive) {
      setTotpSetupActive(false);
      setTotpError("");
    } else {
      startInline2FASetup(editingUser);
    }
  };

  const handleToggleEmail2faSwitch = () => {
    if (!editingUser) {
      setSetup2faAfterCreate((prev) => !prev);
      return;
    }
    if (editingUser.email_2fa_enabled) {
      setDisable2faTarget({ user: editingUser, method: "email" });
    } else if (email2faSetupActive) {
      setEmail2faSetupActive(false);
      setEmail2faCodeSent(false);
      setEmail2faError("");
      setEmail2faNeedsSmtp(false);
    } else {
      setEmail2faSetupActive(true);
      setEmail2faError("");
      setEmail2faSuccess("");
      setEmail2faNeedsSmtp(false);
    }
  };

  const handleCopySecret = () => {
    if (!totpSecret) return;
    navigator.clipboard?.writeText(totpSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername("");
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("admin");
    setIsActive(true);
    setSetup2faAfterCreate(false);
    setErrorMsg("");
    resetInline2faState();
    setShowFormModal(true);
  };

  const handleOpenEdit = (u, autoStart2fa = false) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role || "admin");
    setIsActive(u.is_active);
    setSetup2faAfterCreate(false);
    setErrorMsg("");
    resetInline2faState();
    setShowFormModal(true);
    if (autoStart2fa && !u.totp_enabled) {
      startInline2FASetup(u);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim() || !email.trim()) {
      setErrorMsg("Lütfen zorunlu alanları doldurunuz.");
      return;
    }

    try {
      setErrorMsg("");
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "İşlem başarısız.");
      }

      await fetchUsers();

      if (!editingUser && setup2faAfterCreate && data?.id) {
        const createdUser = {
          id: data.id,
          username: data.username || username.trim(),
          full_name: data.full_name || fullName.trim(),
          email: data.email || email.trim(),
          role: data.role || role,
          is_active: data.is_active ?? isActive,
          totp_enabled: false,
          email_2fa_enabled: false
        };
        setEditingUser(createdUser);
        setPassword("");
        setSetup2faAfterCreate(false);
        startInline2FASetup(createdUser);
        return;
      }

      setShowFormModal(false);
      resetInline2faState();
    } catch (err) {
      setErrorMsg(err.message || "Kaydederken bir hata oluştu.");
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

  const qrImgSrc =
    totpQrSvg ||
    (totpUri
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`
      : "");

  const any2faOnEditing = Boolean(editingUser?.totp_enabled || editingUser?.email_2fa_enabled);

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
                Kullanıcı hesapları, yetkiler ve kullanıcı bazlı 2FA (Authenticator &amp; E-Posta) ayarları
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
                const hasAny2fa = Boolean(u.totp_enabled || u.email_2fa_enabled);
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
                          {u.totp_enabled && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                              <Smartphone size={10} />
                              <span>Auth 2FA</span>
                            </span>
                          )}
                          {u.email_2fa_enabled && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 flex items-center gap-1">
                              <Mail size={10} />
                              <span>E-Posta 2FA</span>
                            </span>
                          )}
                          {!hasAny2fa && (
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
                      <div>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u, false)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer border ${
                            hasAny2fa
                              ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border-indigo-500/25"
                          }`}
                          title="Bu kullanıcının 2FA (Authenticator & E-Posta) ayarlarını aç/kapat"
                        >
                          {hasAny2fa ? <ShieldCheck size={12} /> : <Key size={12} />}
                          <span>{hasAny2fa ? "2FA Yönet" : "2FA Ayarları"}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u, false)}
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

      {/* ADD / EDIT USER FORM MODAL (WITH EMBEDDED PER-USER AUTHENTICATOR + E-MAIL 2FA CONTROLS) */}
      {showFormModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col shadow-2xl text-slate-900 dark:text-slate-100">
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
                  resetInline2faState();
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-semibold">
              <form id="master-user-form" onSubmit={handleSaveUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Ad Soyad</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">E-Posta Adresi</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Örn: ahmet@nornia.com.tr"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      {editingUser ? "Yeni Şifre (Opsiyonel)" : "Şifre"}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">Yetki / Rol</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-slate-900 dark:text-white font-bold"
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

              {/* EMBEDDED PER-USER 2FA SECTION (AUTHENTICATOR + E-MAIL OTP) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      size={16}
                      className={any2faOnEditing ? "text-emerald-500" : "text-indigo-500"}
                    />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      İki Aşamalı Doğrulama (2FA)
                    </span>
                  </div>
                  {editingUser && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        any2faOnEditing
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {any2faOnEditing ? "AKTİF" : "KAPALI"}
                    </span>
                  )}
                </div>

                {!editingUser ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {setup2faAfterCreate
                        ? "Kullanıcı kaydedilince 2FA (Authenticator / E-Posta) kurulum ekranı hemen açılacaktır."
                        : "Kullanıcıyı kaydettikten hemen sonra 2FA kurulumunu başlatmak için açın."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSetup2faAfterCreate((prev) => !prev)}
                      role="switch"
                      aria-checked={Boolean(setup2faAfterCreate)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        setup2faAfterCreate ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          setup2faAfterCreate ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* METHOD 1: AUTHENTICATOR (TOTP) */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              editingUser.totp_enabled
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                            }`}
                          >
                            <Smartphone size={17} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Authenticator Uygulaması</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                                  editingUser.totp_enabled
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}
                              >
                                {editingUser.totp_enabled ? "AÇIK" : "KAPALI"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              Google Authenticator / Microsoft Authenticator (TOTP)
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={totpLoading}
                          onClick={handleToggleTotpSwitch}
                          role="switch"
                          aria-checked={Boolean(editingUser.totp_enabled || totpSetupActive)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                            editingUser.totp_enabled || totpSetupActive
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={
                            editingUser.totp_enabled
                              ? "Authenticator 2FA Kapat"
                              : "Authenticator 2FA Aç & QR Kur"
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              editingUser.totp_enabled || totpSetupActive
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {totpSuccess && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold flex items-center gap-2">
                          <Check size={14} className="shrink-0" />
                          <span>{totpSuccess}</span>
                        </div>
                      )}

                      {totpError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[11px] font-extrabold flex items-center gap-2">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>{totpError}</span>
                        </div>
                      )}

                      {editingUser.totp_enabled && !totpSetupActive && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                            Authenticator koruması aktif.
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={totpLoading}
                              onClick={() => startInline2FASetup(editingUser)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={11} />
                              <span>Yeni QR Eşleştir</span>
                            </button>
                            <button
                              type="button"
                              disabled={totpLoading}
                              onClick={() => setDisable2faTarget({ user: editingUser, method: "totp" })}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/30 text-[10px] font-extrabold cursor-pointer transition-colors"
                            >
                              Kapat
                            </button>
                          </div>
                        </div>
                      )}

                      {totpSetupActive && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                          <div className="text-center space-y-2.5">
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                              <strong>Google Authenticator</strong> veya <strong>Microsoft Authenticator</strong> uygulaması ile QR kodu okutun:
                            </p>

                            {qrImgSrc && (
                              <div className="mx-auto w-44 h-44 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                                <img
                                  src={qrImgSrc}
                                  alt="2FA QR Code"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}

                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                              <div className="text-left min-w-0">
                                <div className="text-[10px] text-slate-400 font-bold">
                                  Manuel Kurulum Anahtarı (Secret Key)
                                </div>
                                <div className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 select-all tracking-wider truncate">
                                  {totpSecret}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopySecret}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                              >
                                {secretCopied ? <Check size={12} /> : <Copy size={12} />}
                                <span>{secretCopied ? "Kopyalandı" : "Kopyala"}</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              Uygulamada Üretilen 6 Haneli Kodu Girerek Aktifleştirin
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={totpVerifyCode}
                                onChange={(e) =>
                                  setTotpVerifyCode(e.target.value.replace(/[^0-9]/g, ""))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleConfirmEnable2FA();
                                  }
                                }}
                                placeholder="000000"
                                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono text-base tracking-[0.35em] font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                disabled={totpLoading || totpVerifyCode.length !== 6}
                                onClick={handleConfirmEnable2FA}
                                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-md shrink-0"
                              >
                                {totpLoading ? "Doğrulanıyor..." : "Doğrula & Aç"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* METHOD 2: E-MAIL 2FA (OTP) */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              editingUser.email_2fa_enabled
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <Mail size={17} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>E-Posta Doğrulama (E-Mail OTP)</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                                  editingUser.email_2fa_enabled
                                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}
                              >
                                {editingUser.email_2fa_enabled ? "AÇIK" : "KAPALI"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                              Girişte {email || editingUser.email || "e-posta"} adresine 6 haneli kod gönderir
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={email2faLoading}
                          onClick={handleToggleEmail2faSwitch}
                          role="switch"
                          aria-checked={Boolean(editingUser.email_2fa_enabled || email2faSetupActive)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                            editingUser.email_2fa_enabled || email2faSetupActive
                              ? "bg-sky-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={
                            editingUser.email_2fa_enabled
                              ? "E-Posta 2FA Kapat"
                              : "E-Posta 2FA Aç & Doğrula"
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              editingUser.email_2fa_enabled || email2faSetupActive
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {email2faSuccess && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold flex items-center gap-2">
                          <Check size={14} className="shrink-0" />
                          <span>{email2faSuccess}</span>
                        </div>
                      )}

                      {email2faError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[11px] font-extrabold space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{email2faError}</span>
                          </div>
                          {email2faNeedsSmtp && onOpenSecuritySmtp && (
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

                      {editingUser.email_2fa_enabled && !email2faSetupActive && (
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-sky-800 dark:text-sky-300 font-semibold">
                            E-Posta 2FA aktif ({editingUser.email}).
                          </span>
                          <button
                            type="button"
                            disabled={email2faLoading}
                            onClick={() => setDisable2faTarget({ user: editingUser, method: "email" })}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/30 text-[10px] font-extrabold cursor-pointer transition-colors"
                          >
                            Kapat
                          </button>
                        </div>
                      )}

                      {email2faSetupActive && !editingUser.email_2fa_enabled && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-sky-200 dark:border-sky-900/60 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              Kod gönderilecek adres:{" "}
                              <strong className="font-mono text-sky-700 dark:text-sky-400">
                                {email || editingUser.email}
                              </strong>
                            </div>
                            <button
                              type="button"
                              disabled={email2faLoading}
                              onClick={handleSendEmail2faSetupCode}
                              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Send size={12} />
                              <span>
                                {email2faLoading
                                  ? "Gönderiliyor..."
                                  : email2faCodeSent
                                    ? "Kodu Tekrar Gönder"
                                    : "Doğrulama Kodu Gönder"}
                              </span>
                            </button>
                          </div>

                          {email2faCodeSent && (
                            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                E-Postanıza Gelen 6 Haneli Kodu Girerek Aktifleştirin
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={email2faVerifyCode}
                                  onChange={(e) =>
                                    setEmail2faVerifyCode(e.target.value.replace(/[^0-9]/g, ""))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleConfirmEnableEmail2FA();
                                    }
                                  }}
                                  placeholder="000000"
                                  className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono text-base tracking-[0.35em] font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                />
                                <button
                                  type="button"
                                  disabled={email2faLoading || email2faVerifyCode.length !== 6}
                                  onClick={handleConfirmEnableEmail2FA}
                                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shadow-md shrink-0"
                                >
                                  {email2faLoading ? "Doğrulanıyor..." : "Doğrula & Aç"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                  resetInline2faState();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Kapat
              </button>
              <button
                type="submit"
                form="master-user-form"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Bilgileri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL FOR DISABLING 2FA */}
      {disable2faTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                {disable2faTarget.method === "email"
                  ? "E-Posta 2FA Korumasını Kapat?"
                  : "Authenticator 2FA Korumasını Kapat?"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="text-slate-900 dark:text-white font-bold">
                  {disable2faTarget.user.full_name}
                </span>{" "}
                (@{disable2faTarget.user.username}) kullanıcısının{" "}
                {disable2faTarget.method === "email"
                  ? "E-Posta OTP 2FA"
                  : "Authenticator 2FA"}{" "}
                korumasını devre dışı bırakmak istediğinize emin misiniz?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDisable2faTarget(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={totpLoading || email2faLoading}
                onClick={executeDisable2FA}
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
            {/* Soft Red Pulse Warning Icon */}
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
