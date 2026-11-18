import React, { useState } from "react";
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, ArrowRight } from "lucide-react";

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

      if (data.user) {
        sessionStorage.setItem("master_user", JSON.stringify(data.user));
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMsg(err.message || "Giriş yapılırken bir hata oluştu.");
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
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Merkezi Lisans Otoritesi &amp; Bulut Filo Yönetimi</p>
          </div>
        </div>

        {/* Form */}
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

      </div>
    </div>
  );
}
