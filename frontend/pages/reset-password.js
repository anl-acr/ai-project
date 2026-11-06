import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { useTheme, getSafeThemeColor } from "../utils/theme";
import { getApiBaseUrl } from "../utils/apiHost";
import {
  clearAuthenticatedSession,
  loadRememberedCredentials,
  saveRememberedCredentials
} from "../utils/authStorage";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { bg, hover, text, border, lightBg, lightText, borderLight } = useTheme();

  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState("");
  const [userInfo, setUserInfo] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouchedBlur, setConfirmTouchedBlur] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resetCompleted, setResetCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const urlToken = (qs.get("token") || "").trim();
    if (!urlToken) {
      setVerifyError("Şifre sıfırlama anahtarı (token) bulunamadı. Lütfen e-postanızdaki bağlantıyı eksiksiz açın.");
      setVerifying(false);
      return;
    }
    setToken(urlToken);

    let cancelled = false;
    const verifyToken = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(
          `${apiBase}/api/auth/password-reset/verify?token=${encodeURIComponent(urlToken)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.status === "success" && data.user) {
          setUserInfo(data.user);
          if (data.user.theme_color) {
            const safeColor = getSafeThemeColor(data.user.theme_color);
            document.documentElement.style.setProperty("--color-primary", safeColor);
          }
        } else {
          setVerifyError(
            data.detail ||
              data.message ||
              "Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş."
          );
        }
      } catch (err) {
        if (!cancelled) {
          setVerifyError("Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.");
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    verifyToken();
    return () => {
      cancelled = true;
    };
  }, []);

  const criteriaList = useMemo(() => {
    const pw = String(newPassword || "");
    return [
      {
        id: "minLen",
        label: "En az 8 karakter uzunluğunda",
        met: pw.length >= 8
      },
      {
        id: "upper",
        label: "En az 1 büyük harf (A–Z)",
        met: /[A-ZÇĞİÖŞÜ]/.test(pw)
      },
      {
        id: "lower",
        label: "En az 1 küçük harf (a–z)",
        met: /[a-zçğıöşü]/.test(pw)
      },
      {
        id: "digit",
        label: "En az 1 rakam (0–9)",
        met: /\d/.test(pw)
      },
      {
        id: "special",
        label: "En az 1 özel karakter (!@#$%^&*._-+ vb.)",
        met: /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]/.test(pw)
      }
    ];
  }, [newPassword]);

  const allCriteriaMet = useMemo(
    () => criteriaList.every((c) => c.met),
    [criteriaList]
  );

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const canCreatePassword = allCriteriaMet && passwordsMatch;

  const showMismatchWarning =
    confirmTouchedBlur &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreatePassword || submitting) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        clearAuthenticatedSession();
        const prevRem = loadRememberedCredentials();
        if (prevRem.rememberMe) {
          const loginHint = userInfo?.email || data.email || prevRem.username || "";
          if (loginHint) {
            saveRememberedCredentials(loginHint, newPassword, true);
          }
        }
        setResetCompleted(true);
      } else {
        setSubmitError(
          data.detail || data.message || "Şifre oluşturulurken bir hata oluştu."
        );
      }
    } catch (err) {
      setSubmitError("Sunucu ile iletişim kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans relative overflow-hidden">
      <Head>
        <title>Yeni Şifre Oluştur — AIDA PBX</title>
      </Head>

      {/* Ambient Theme Glows */}
      <div
        className={"absolute top-[-18%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-15 blur-[120px] pointer-events-none " + bg}
      />
      <div
        className={"absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full opacity-15 blur-[110px] pointer-events-none " + bg}
      />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
          {/* Logo & Header */}
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div
              className={
                "w-14 h-14 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4 " +
                bg
              }
            >
              <BrainCircuit size={28} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Yeni Şifre Oluştur
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              AIDA PBX hesap güvenliğiniz için güçlü bir şifre belirleyin
            </p>
          </div>

          {verifying ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <div
                className={
                  "w-8 h-8 border-4 border-t-transparent rounded-full animate-spin " +
                  border
                }
              />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Şifre sıfırlama bağlantısı doğrulanıyor...
              </p>
            </div>
          ) : verifyError ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center mx-auto " + lightBg + " " + text}>
                  <AlertCircle size={22} aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                  {verifyError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className={
                  "w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer " +
                  bg +
                  " " +
                  hover
                }
              >
                <span>Giriş Ekranına Dön</span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          ) : resetCompleted ? (
            <div className="space-y-5 text-center animate-in fade-in zoom-in-95 duration-300">
              <div
                className={
                  "p-5 rounded-2xl border space-y-2.5 " +
                  lightBg +
                  " " +
                  borderLight
                }
              >
                <div
                  className={
                    "w-12 h-12 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md " +
                    bg
                  }
                >
                  <ShieldCheck size={24} aria-hidden="true" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Şifreniz Başarıyla Güncellendi
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sayın <strong>{userInfo?.full_name}</strong>, yeni şifreniz hesabınıza tanımlandı. Artık oluşturduğunuz yeni şifre ile sistem arayüzüne giriş yapabilirsiniz.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className={
                  "w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer " +
                  bg +
                  " " +
                  hover
                }
              >
                <span>Giriş Ekranına Git</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User Identity Pre-Info Badge */}
              {userInfo && (
                <div
                  className={
                    "flex items-center gap-3 px-4 py-3 rounded-2xl border " +
                    lightBg +
                    " " +
                    borderLight
                  }
                >
                  <div
                    className={
                      "w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 " +
                      bg
                    }
                  >
                    <UserCheck size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {userInfo.full_name}
                    </div>
                    <div className={"text-[11px] font-semibold truncate " + lightText}>
                      {userInfo.masked_email || userInfo.email}
                      {userInfo.extension ? ` • Dahili ${userInfo.extension}` : ""}
                    </div>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-start gap-2">
                  <AlertCircle size={16} className={"shrink-0 mt-0.5 " + text} aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Password Criteria Checklist (Placed above inputs so keyboards/popovers never cover rules) */}
              <div
                id="reset-password-criteria"
                className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Şifre Kriterleri
                </div>
                <ul className="space-y-1.5">
                  {criteriaList.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        item.met
                          ? "font-bold text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {item.met ? (
                        <CheckCircle2 size={15} className={"shrink-0 " + text} aria-hidden="true" />
                      ) : (
                        <Circle size={15} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </li>
                  ))}
                  <li
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      passwordsMatch
                        ? "font-bold text-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {passwordsMatch ? (
                      <CheckCircle2 size={15} className={"shrink-0 " + text} aria-hidden="true" />
                    ) : (
                      <Circle size={15} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                    )}
                    <span>Yeni şifre ve şifre tekrarı birebir aynı olmalı</span>
                  </li>
                </ul>
              </div>

              {/* Field 1: New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-new-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 px-1"
                >
                  Yeni Şifre
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                    <Lock size={17} aria-hidden="true" />
                  </div>
                  <input
                    id="reset-new-password"
                    name="new-password"
                    type={showNewPassword ? "text" : "password"}
                    data-custom-password-toggle="true"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="reset-password-criteria"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="Yeni şifrenizi girin"
                    className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-pressed={showNewPassword}
                    aria-controls="reset-new-password"
                    aria-label={showNewPassword ? "Yeni şifreyi gizle" : "Yeni şifreyi göster"}
                    title={showNewPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                    className={"absolute inset-y-0 right-0 px-4 flex items-center justify-center text-slate-400 transition-colors cursor-pointer z-10 hover:" + text}
                  >
                    {showNewPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Field 2: Confirm Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-confirm-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 px-1"
                >
                  Yeni Şifre (Tekrar)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                    <Lock size={17} aria-hidden="true" />
                  </div>
                  <input
                    id="reset-confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    data-custom-password-toggle="true"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="reset-password-criteria"
                    aria-invalid={showMismatchWarning ? "true" : "false"}
                    value={confirmPassword}
                    onBlur={() => setConfirmTouchedBlur(true)}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="Yeni şifrenizi tekrar girin"
                    className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-pressed={showConfirmPassword}
                    aria-controls="reset-confirm-password"
                    aria-label={showConfirmPassword ? "Şifre tekrarını gizle" : "Şifre tekrarını göster"}
                    title={showConfirmPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                    className={"absolute inset-y-0 right-0 px-4 flex items-center justify-center text-slate-400 transition-colors cursor-pointer z-10 hover:" + text}
                  >
                    {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {showMismatchWarning && (
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 px-1">
                    Girilen iki şifre henüz birbiriyle eşleşmiyor.
                  </p>
                )}
              </div>

              {/* Conditional 'Şifre Oluştur' Button — appears ONLY when all criteria + both fields match */}
              {canCreatePassword ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className={
                    "w-full py-4 mt-2 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-60 animate-in fade-in slide-in-from-bottom-2 duration-200 " +
                    bg +
                    " " +
                    hover
                  }
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Şifre Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} aria-hidden="true" />
                      <span>Şifre Oluştur</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="pt-1 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  Tüm şifre kriterleri sağlandığında ve iki şifre eşleştiğinde <strong>Şifre Oluştur</strong> butonu görünecektir.
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
