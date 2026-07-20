import React, { useState } from "react";
import { Lock, Mail, ArrowRight, BrainCircuit, User } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function Login({ onLogin, error }) {
  const { bg, text } = useTheme();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setTimeout(() => {
      onLogin(username, password, rememberMe);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* Animated Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 dark:bg-indigo-600/20 blur-[120px] dark:blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-400/10 dark:bg-violet-600/20 blur-[100px] dark:blur-[130px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[40%] rounded-full bg-blue-400/10 dark:bg-blue-600/20 blur-[100px] dark:blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
      
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-[0.98] duration-1000 ease-out">
        {/* The Glassmorphism Panel */}
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_0_50px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_80px_-20px_rgba(79,70,229,0.3)] relative overflow-hidden group">
          
          {/* Top border shine effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-500/50 to-transparent"></div>

          {/* Logo & Title */}
          <div className="flex flex-col items-center justify-center text-center mb-10 mt-2">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-400 dark:bg-indigo-500 blur-xl opacity-30 dark:opacity-40 rounded-full animate-pulse"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl flex items-center justify-center relative shadow-xl shadow-indigo-500/20 border border-white/20 dark:border-white/10">
                <BrainCircuit size={32} className="drop-shadow-lg" />
              </div>
            </div>
            
            {/* AİDA highlighted text */}
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-br dark:from-white dark:via-slate-100 dark:to-slate-400">
              <span className="text-rose-600 dark:text-rose-500 drop-shadow-sm">Aİ</span>DA
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-indigo-200/60 uppercase tracking-[0.3em] font-bold mt-2">
              AI Dijital Asistan
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5 relative">
              <div className="absolute inset-y-0 left-0 pl-4 pt-1 flex items-center pointer-events-none text-slate-400 dark:text-slate-400/70 z-10">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-white/50 dark:bg-black/20 border border-slate-200/80 dark:border-white/5 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all hover:bg-white/80 dark:hover:bg-black/30 shadow-inner dark:shadow-none"
                placeholder="Kullanıcı Adı veya E-posta"
              />
            </div>

            <div className="space-y-1.5 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-400/70 z-10">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-white/50 dark:bg-black/20 border border-slate-200/80 dark:border-white/5 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all hover:bg-white/80 dark:hover:bg-black/30 shadow-inner dark:shadow-none"
                placeholder="Parola"
              />
            </div>

            <div className="flex items-center justify-between px-1 pt-2 pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer group/cb">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-slate-100 dark:bg-black/20 border-slate-300 dark:border-white/10 group-hover/cb:border-slate-400 dark:group-hover/cb:border-white/20'}`}>
                  {rememberMe && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 select-none transition-colors group-hover/cb:text-slate-700 dark:group-hover/cb:text-slate-300">Beni Hatırla</span>
              </label>
              
              <a href="#" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
                Şifremi Unuttum?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  Giriş Yap <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer info */}
        <div className="text-center mt-8 opacity-60">
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">
            &copy; {new Date().getFullYear()} ANTIGRAVITY SYSTEMS.
          </p>
        </div>
      </div>
    </div>
  );
}
