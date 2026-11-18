import React, { useState } from "react";
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, ArrowRight, KeyRound, ArrowLeft } from "lucide-react";

export default function LoginModal({ onLoginSuccess, idleLogoutMessage = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 2FA Step States
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingUserLabel, setPendingUserLabel] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Lütfen kullanıcı adı ve şifre giriniz.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Giriş başarısız.");
      }

      if (data.requires_2fa && data.temp_token) {
        setRequires2FA(true);
        setTempToken(data.temp_token);
        setPendingUserLabel(data.full_name || data.username || username.trim());
        setTotpCode("");
        return;
      }

      if (data.user) {
        sessionStorage.setItem("master_user", JSON.stringify(data.user));
        if (data.auto_logout_minutes !== undefined) {
          sessionStorage.setItem("master_auto_logout_mins", String(data.auto_logout_minutes));
        }
        onLoginSuccess(data.user, data.auto_logout_minutes);
      }
    } catch (err) {
      setErrorMsg(err.message || "Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    const cleanCode = totpCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setErrorMsg("Lütfen Authenticator uygulamanızdaki 6 haneli kodu giriniz.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_token: tempToken,
          code: cleanCode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "2FA doğrulama kodu hatalı.");
      }

      if (data.user) {
        sessionStorage.setItem("master_user", JSON.stringify(data.user));
        if (data.auto_logout_minutes !== undefined) {
          sessionStorage.setItem("master_auto_logout_mins", String(data.auto_logout_minutes));
        }
        onLoginSuccess(data.user, data.auto_logout_minutes);
      }
    } catch (err) {
      setErrorMsg(err.message || "2FA doğrulaması başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6 relative text-slate-900 dark:text-slate-100">
        
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-rose-500" />

        {/* Header Branding */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-900 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-xl shadow-indigo-500/15 p-2.5">
            <img src="/favicon.svg" alt="Nornia Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nornia Cloud Center</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {requires2FA ? "2 Aşamalı Güvenlik Doğrulaması (2FA)" : "Merkezi Lisans Otoritesi & Bulut Filo Yönetimi"}
            </p>
          </div>
        </div>

        {idleLogoutMessage && !errorMsg && !requires2FA && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{idleLogoutMessage}</span>
          </div>
        )}

        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <ShieldCheck size={15} />
                <span>Merhaba, {pendingUserLabel}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lütfen cep telefonunuzdaki <strong>Google / Microsoft Authenticator</strong> uygulamasında üretilen 6 haneli doğrulama kodunu giriniz.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound size={14} className="text-indigo-500" />
                <span>6 Haneli Authenticator Kodu</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 text-center font-mono text-lg tracking-[0.4em] font-extrabold text-slate-900 dark:text-white"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Doğrulanıyor...</span>
              ) : (
                <>
                  <span>Doğrula &amp; Giriş Yap</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTempToken("");
                setTotpCode("");
                setErrorMsg("");
              }}
              className="w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Giriş Ekranına Dön</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                <span>Kullanıcı Adı</span>
              </label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı veya e-postanızı giriniz"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" />
                <span>Şifre</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi giriniz"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Giriş Yapılıyor...</span>
              ) : (
                <>
                  <span>Sisteme Giriş Yap</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
