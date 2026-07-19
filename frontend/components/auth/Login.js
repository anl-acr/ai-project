import React, { useState } from "react";
import { Lock, Mail, ArrowRight, ShieldCheck, User } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function Login({ onLogin, error }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
      onLogin(username, password, rememberMe);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 font-sans relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full ${bg} opacity-20 dark:opacity-10 blur-[120px]`} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500 opacity-20 dark:opacity-10 blur-[120px]" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-8 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center justify-center text-center mb-8">
            <div className={`w-16 h-16 ${bg} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-5`}>
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Nexus Omnichannel AI</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Lütfen yetkili bilgilerinizi giriniz</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1 uppercase tracking-wider">Kullanıcı Adı veya E-posta</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-inner`}
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Parola</label>
                <a href="#" className={`text-xs font-bold ${text} hover:underline`}>Şifremi Unuttum?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-inner`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between ml-1 pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-5 h-5 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center transition-colors ${rememberMe ? bg + ' border-transparent' : 'bg-white dark:bg-slate-900 group-hover:border-primary/50'}`}>
                  {rememberMe && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 select-none">Beni Hatırla</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 mt-2 ${bg} hover:opacity-90 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  Giriş Yap <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

        </div>
        
        {/* Footer info */}
        <div className="text-center mt-8">
          <p className="text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} Antigravity Systems. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
