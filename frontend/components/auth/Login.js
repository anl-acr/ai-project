import React, { useState, useEffect } from "react";
import { Lock, Mail, ArrowRight, BrainCircuit, User, Smartphone, KeyRound, RefreshCw, Copy, Check, PhoneCall } from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function Login({ onLogin, onComplete2FA, error, backendHost }) {
  const { bg, text } = useTheme();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA States
  const [is2FA, setIs2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorUserId, setTwoFactorUserId] = useState(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState("google_auth");
  const [twoFactorEnrolled, setTwoFactorEnrolled] = useState(true);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorPhone, setTwoFactorPhone] = useState("");
  const [twoFactorMaskedEmail, setTwoFactorMaskedEmail] = useState("");
  const [twoFactorQrSvg, setTwoFactorQrSvg] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [showQrSetup, setShowQrSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorInfo, setTwoFactorInfo] = useState("");

  const resolveApiUrl = (path) => {
    const base = getApiBaseUrl(backendHost);
    return path.startsWith("http") ? path : `${base}${path}`;
  };

  useEffect(() => {
    if (!is2FA || emailCountdown <= 0) return;
    const timer = setInterval(() => {
      setEmailCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [is2FA, emailCountdown]);

  const triggerSendEmailOtp = async (uid, emailAddr) => {
    setEmailSending(true);
    setTwoFactorError("");
    setTwoFactorInfo("");
    try {
      const res = await fetch(resolveApiUrl("/api/auth/2fa/send-email-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(uid),
          email: emailAddr || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorMaskedEmail(data.masked_email || emailAddr || "");
        setEmailCountdown(Number(data.expires_in) || 180);
        setTwoFactorInfo(data.message || "6 haneli doğrulama kodu e-posta adresinize gönderildi.");
      } else {
        setTwoFactorError(data.detail || data.message || "Doğrulama e-postası gönderilemedi.");
      }
    } catch (err) {
      setTwoFactorError("E-posta gönderilirken sunucu ile iletişim kurulamadı.");
    } finally {
      setEmailSending(false);
    }
  };

  const triggerSendWhatsAppOtp = async (uid, phoneStr) => {
    setEmailSending(true);
    setTwoFactorError("");
    setTwoFactorInfo("");
    try {
      const res = await fetch(resolveApiUrl("/api/auth/2fa/send-whatsapp-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(uid),
          phone: phoneStr || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setEmailCountdown(Number(data.expires_in) || 300);
        setTwoFactorInfo(data.message || "5 dakika geçerli 6 haneli doğrulama kodu WhatsApp hattınıza gönderildi.");
      } else {
        setTwoFactorError(data.detail || data.message || "WhatsApp doğrulama kodu gönderilemedi.");
      }
    } catch (err) {
      setTwoFactorError("WhatsApp servisi ile iletişim kurulamadı.");
    } finally {
      setEmailSending(false);
    }
  };

  const fetchAuthenticatorSetup = async (uid, methodType) => {
    setSetupLoading(true);
    try {
      const qs = new URLSearchParams({
        reset: "false",
        method: methodType || "google_auth"
      });
      const res = await fetch(resolveApiUrl(`/api/auth/setup_2fa/${encodeURIComponent(String(uid))}?${qs.toString()}`));
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setTwoFactorSecret(data.secret || "");
        setTwoFactorQrSvg(data.qr_svg || "");
        if (data.masked_email) setTwoFactorMaskedEmail(data.masked_email);
      } else {
        setTwoFactorError(data.detail || "2FA kurulum bilgileri alınamadı.");
      }
    } catch (err) {
      setTwoFactorError("2FA kurulum bilgileri alınırken hata oluştu.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (is2FA) {
      const cleanCode = (twoFactorCode || "").replace(/\D/g, "");
      if (cleanCode.length < 6) return;
      setIsLoading(true);
      setTwoFactorError("");
      try {
        const res = await fetch(resolveApiUrl("/api/auth/verify_2fa"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: String(twoFactorUserId),
            code: cleanCode,
            method: twoFactorMethod,
            secret: twoFactorSecret || undefined,
            phone: twoFactorPhone || undefined
          })
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          onComplete2FA(twoFactorUserId, rememberMe);
        } else {
          setTwoFactorError(data.detail || "Geçersiz veya süresi dolmuş 2FA doğrulama kodu.");
        }
      } catch (err) {
        setTwoFactorError("Sunucu ile iletişim kurulamadı.");
      }
      setIsLoading(false);
      return;
    }

    if (!username || !password) return;
    
    setIsLoading(true);
    setTimeout(async () => {
      const result = await Promise.resolve(onLogin(username, password, rememberMe));
      if (result && result.requires2fa) {
        const rawMethod = result.method || "google_auth";
        const normMethod = rawMethod === "app" ? "google_auth" : rawMethod;
        const isEnrolled = Boolean(result.enrolled);
        setIs2FA(true);
        setTwoFactorCode("");
        setTwoFactorError("");
        setTwoFactorInfo("");
        setTwoFactorUserId(result.user_id);
        setTwoFactorMethod(normMethod);
        setTwoFactorEnrolled(isEnrolled);
        setTwoFactorEmail(result.email || "");
        setTwoFactorPhone(result.phone || "");

        if (normMethod === "email") {
          setShowQrSetup(false);
          triggerSendEmailOtp(result.user_id, result.email);
        } else if (normMethod === "whatsapp") {
          // Do not overwrite pre-generated WhatsApp 'Giriş Kodu' automatically!
          setShowQrSetup(false);
          setEmailCountdown(0);
        } else {
          if (!isEnrolled) {
            setShowQrSetup(true);
            fetchAuthenticatorSetup(result.user_id, normMethod);
          } else {
            setShowQrSetup(false);
          }
        }
      }
      setIsLoading(false);
    }, 400);
  };

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const methodTitle =
    twoFactorMethod === "email"
      ? "E-Posta İki Aşamalı Doğrulama"
      : twoFactorMethod === "whatsapp"
      ? "WhatsApp İki Aşamalı Doğrulama"
      : twoFactorMethod === "microsoft_auth"
      ? "Microsoft Authenticator Doğrulaması"
      : "Google Authenticator Doğrulaması";

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
          <div className="flex flex-col items-center justify-center text-center mb-8 mt-1">
            <div className="relative mb-5">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {!is2FA ? (
              <>
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
              </>
            ) : (
              <div className="animate-in fade-in zoom-in duration-300 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-2.5 text-indigo-600 dark:text-indigo-400">
                    {twoFactorMethod === "email" ? (
                      <Mail size={26} />
                    ) : twoFactorMethod === "whatsapp" ? (
                      <PhoneCall size={26} />
                    ) : twoFactorMethod === "microsoft_auth" ? (
                      <KeyRound size={26} />
                    ) : (
                      <Smartphone size={26} />
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-white">{methodTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {twoFactorMethod === "email"
                      ? `${twoFactorMaskedEmail || "E-posta"} adresinize gönderilen 6 haneli doğrulama kodunu girin.`
                      : twoFactorMethod === "whatsapp"
                      ? "WhatsApp hattımıza 'Giriş Kodu' yazarak aldığınız (5 dakika geçerli) 6 haneli doğrulama kodunu girin."
                      : showQrSetup
                      ? `İlk girişiniz için ${twoFactorMethod === "microsoft_auth" ? "Microsoft Authenticator" : "Google Authenticator"} uygulamasından QR kodu okutup 6 haneli kodu girin.`
                      : `Lütfen ${twoFactorMethod === "microsoft_auth" ? "Microsoft Authenticator" : "Google Authenticator"} uygulamasındaki 6 haneli kodu girin.`}
                  </p>
                </div>

                {twoFactorError && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl text-center">
                    {twoFactorError}
                  </div>
                )}

                {twoFactorInfo && !twoFactorError && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl text-center">
                    {twoFactorInfo}
                  </div>
                )}

                {/* WHATSAPP "GİRİŞ KODU" HELPER BOX */}
                {twoFactorMethod === "whatsapp" && (
                  <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-200 text-center leading-relaxed">
                      Henüz kod almadıysanız WhatsApp üzerinden <strong>0850 360 7390</strong> hattımıza <strong>"Giriş Kodu"</strong> mesajı gönderin:
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="https://wa.me/908503607390?text=Giri%C5%9F%20Kodu"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all shadow-sm"
                      >
                        WhatsApp'ta "Giriş Kodu" Gönder
                      </a>
                      <button
                        type="button"
                        disabled={emailSending}
                        onClick={() => triggerSendWhatsAppOtp(twoFactorUserId, twoFactorPhone)}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={emailSending ? "animate-spin" : ""} />
                        {emailSending ? "..." : "Kodu İste"}
                      </button>
                    </div>
                    {emailCountdown > 0 && (
                      <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 text-center">
                        Kod Geçerlilik Süresi: {formatCountdown(emailCountdown)}
                      </div>
                    )}
                  </div>
                )}

                {/* FIRST-LOGIN QR CODE SETUP CARD FOR GOOGLE / MICROSOFT AUTHENTICATOR */}
                {twoFactorMethod !== "email" && twoFactorMethod !== "whatsapp" && showQrSetup && (
                  <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-36 h-36 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white p-2 flex items-center justify-center shadow-sm">
                        {setupLoading ? (
                          <RefreshCw size={24} className="animate-spin text-indigo-500" />
                        ) : twoFactorQrSvg ? (
                          <img src={twoFactorQrSvg} alt="2FA QR Code" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-400 text-center">QR Yükleniyor...</span>
                        )}
                      </div>
                      {twoFactorSecret && (
                        <div className="w-full">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-1">
                            Manuel Kurulum Anahtarı
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={twoFactorSecret}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold text-center text-slate-700 dark:text-slate-200 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(twoFactorSecret);
                                setSecretCopied(true);
                                setTimeout(() => setSecretCopied(false), 2000);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 shrink-0"
                            >
                              {secretCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              {secretCopied ? "Kopyalandı" : "Kopyala"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3.5 bg-white/50 dark:bg-black/20 border border-slate-200/80 dark:border-white/5 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all hover:bg-white/80 dark:hover:bg-black/30 shadow-inner dark:shadow-none"
                  placeholder="••••••"
                />

                {/* E-Mail Countdown & Resend Controls */}
                {twoFactorMethod === "email" && (
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {emailCountdown > 0 ? `Kalan Süre: ${formatCountdown(emailCountdown)}` : "Kodun süresi doldu"}
                    </span>
                    <button
                      type="button"
                      disabled={emailSending}
                      onClick={() => triggerSendEmailOtp(twoFactorUserId, twoFactorEmail)}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={emailSending ? "animate-spin" : ""} />
                      {emailSending ? "Gönderiliyor..." : "Kodu Tekrar Gönder"}
                    </button>
                  </div>
                )}

                {/* Authenticator Helper Links (Show QR or Switch to WhatsApp/Email Fallback) */}
                {twoFactorMethod !== "email" && twoFactorMethod !== "whatsapp" && (
                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    {!showQrSetup && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowQrSetup(true);
                          if (!twoFactorQrSvg) fetchAuthenticatorSetup(twoFactorUserId, twoFactorMethod);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Henüz eşleştirmediniz mi? QR Kurulum Kodunu Göster
                      </button>
                    )}
                    {twoFactorPhone && twoFactorPhone.replace(/\D/g, "").length >= 10 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTwoFactorMethod("whatsapp");
                          setShowQrSetup(false);
                          setTwoFactorCode("");
                          setTwoFactorError("");
                          setTwoFactorInfo("");
                        }}
                        className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition-colors"
                      >
                        WhatsApp "Giriş Kodu" ile Doğrula
                      </button>
                    )}
                    {twoFactorEmail && twoFactorEmail.includes("@") && !twoFactorEmail.endsWith("@localhost") && (
                      <button
                        type="button"
                        onClick={() => {
                          setTwoFactorMethod("email");
                          setShowQrSetup(false);
                          setTwoFactorCode("");
                          triggerSendEmailOtp(twoFactorUserId, twoFactorEmail);
                        }}
                        className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                      >
                        Uygulamaya erişemiyor musunuz? Kodu E-Posta ile Gönder
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIs2FA(false);
                      setTwoFactorCode("");
                      setTwoFactorError("");
                      setTwoFactorInfo("");
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    ← Giriş Ekranına Geri Dön
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (is2FA && twoFactorCode.length < 6)}
              className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  {is2FA ? "Doğrula ve Giriş Yap" : "Giriş Yap"} <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer info */}
        <div className="text-center mt-8 opacity-60">
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">
            &copy; {new Date().getFullYear()} AİDA. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
