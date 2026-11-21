import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  FileText,
  Lock,
  CheckCircle2,
  LogOut,
  Printer,
  AlertCircle,
  Loader2,
  Check
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { isDesktopApp } from "../../utils/desktopBridge";

function detectClientPlatform() {
  if (typeof window === "undefined") return "web_phone";
  try {
    if (isDesktopApp()) return "pc_app";
  } catch (e) {}
  const ua = (navigator.userAgent || "").toLowerCase();
  if (
    ua.includes("capacitor") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("mobile")
  ) {
    return "mobile_app";
  }
  return "web_phone";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function KvkkConsentModal({
  backendHost = "localhost:8000",
  currentUser = null,
  activeTenantId = "tenant-default",
  onLogout = null
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [statusData, setStatusData] = useState(null);
  const [visible, setVisible] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState("kvkk");
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const userKey = currentUser?.id ? String(currentUser.id) : "";

  const checkConsentStatus = useCallback(async () => {
    if (!userKey || typeof window === "undefined") return;
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(
        `${protocol}//${backendHost}/api/kvkk/my-status?t=${Date.now()}`,
        {
          headers: {
            "X-User-ID": userKey,
            "X-Tenant-ID": activeTenantId || "tenant-default"
          }
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStatusData(data);
      if (data?.enabled && data?.required) {
        setAcceptedKvkk(false);
        setAcceptedPrivacy(false);
        setErrorMsg("");
        setActiveDocTab("kvkk");
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch (err) {
      // Fail open on transient network glitch; will re-check on next session
      console.error("KVKK consent status check failed:", err);
    }
  }, [backendHost, userKey, activeTenantId]);

  useEffect(() => {
    checkConsentStatus();
  }, [checkConsentStatus]);

  const handlePrintPolicy = () => {
    if (!statusData || typeof window === "undefined") return;
    const win = window.open("", "_blank", "width=820,height=760");
    if (!win) return;
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>KVKK Aydınlatma Metni & Gizlilik Politikası (${escapeHtml(statusData.policy_version)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 32px; line-height: 1.65; max-width: 780px; margin: 0 auto; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
    h2 { font-size: 15px; margin-top: 24px; margin-bottom: 10px; color: #1e293b; border-left: 3px solid #334155; padding-left: 10px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .hash { font-family: monospace; font-size: 11px; color: #64748b; margin-top: 6px; }
  </style>
</head>
<body>
  <h1>KVKK Aydınlatma Metni ve Gizlilik Politikası</h1>
  <div class="meta">Politika Sürümü: <strong>${escapeHtml(statusData.policy_version)}</strong> · Yazdırma Tarihi: ${new Date().toLocaleString("tr-TR")}</div>
  <h2>${escapeHtml(statusData.kvkk_title)}</h2>
  <pre>${escapeHtml(statusData.kvkk_text)}</pre>
  <div class="hash">SHA-256: ${escapeHtml(statusData.kvkk_sha256)}</div>
  <h2>${escapeHtml(statusData.privacy_title)}</h2>
  <pre>${escapeHtml(statusData.privacy_text)}</pre>
  <div class="hash">SHA-256: ${escapeHtml(statusData.privacy_sha256)}</div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleAccept = async () => {
    if (!acceptedKvkk || !acceptedPrivacy || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/kvkk/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userKey,
          "X-Tenant-ID": activeTenantId || "tenant-default"
        },
        body: JSON.stringify({
          accepted_kvkk: true,
          accepted_privacy: true,
          client_platform: detectClientPlatform()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.detail || "Onay kaydedilemedi. Lütfen tekrar deneyin.");
        setSubmitting(false);
        return;
      }
      setVisible(false);
    } catch (err) {
      setErrorMsg("Sunucuyla bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible || !statusData) return null;

  const canContinue = acceptedKvkk && acceptedPrivacy && !submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kvkk-consent-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl ${lightBg} ${borderLight} border flex items-center justify-center shrink-0`}
            >
              <ShieldCheck size={22} className={text} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="kvkk-consent-modal-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight"
                >
                  KVKK Aydınlatma & Gizlilik Onayı
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}
                >
                  Sürüm {statusData.policy_version || "v1.0"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {statusData.is_reconsent
                  ? "Kurumunuzun KVKK veya Gizlilik Politikası güncellenmiştir. Devam edebilmek için güncel metinleri inceleyip onaylamanız gerekmektedir."
                  : "Sisteme ilk girişinizde 6698 sayılı KVKK ve Kurumsal Gizlilik Politikamızı inceleyip onaylamanız gerekmektedir. Onayınız sonrası tekrar sorulmayacaktır."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrintPolicy}
            title="Metinleri Yazdır veya PDF Olarak Kaydet"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Yazdır</span>
          </button>
        </div>

        {/* Document Tabs */}
        <div className="px-5 sm:px-6 pt-3.5 pb-2 bg-white dark:bg-slate-900 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveDocTab("kvkk")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDocTab === "kvkk"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            }`}
          >
            <FileText size={14} />
            <span>KVKK Aydınlatma Metni</span>
            {acceptedKvkk && <CheckCircle2 size={13} className="shrink-0 opacity-90" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveDocTab("privacy")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeDocTab === "privacy"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            }`}
          >
            <Lock size={14} />
            <span>Gizlilik & Ses Kaydı Politikası</span>
            {acceptedPrivacy && <CheckCircle2 size={13} className="shrink-0 opacity-90" />}
          </button>
        </div>

        {/* Scrollable Legal Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 bg-white dark:bg-slate-900">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 sm:p-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              {activeDocTab === "kvkk" ? statusData.kvkk_title : statusData.privacy_title}
            </h3>
            <div className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-normal">
              {activeDocTab === "kvkk" ? statusData.kvkk_text : statusData.privacy_text}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              <span>
                Bütünlük Özeti (SHA-256):{" "}
                {(activeDocTab === "kvkk" ? statusData.kvkk_sha256 : statusData.privacy_sha256 || "").slice(0, 24)}...
              </span>
              <span>Sürüm: {statusData.policy_version || "v1.0"}</span>
            </div>
          </div>
        </div>

        {/* Consent Checkboxes & Actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 dark:bg-slate-950/70 border-t border-slate-200/80 dark:border-slate-800 space-y-3.5">
          {errorMsg && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                acceptedKvkk
                  ? `${lightBg} ${borderLight}`
                  : "bg-slate-50/90 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <input
                type="checkbox"
                checked={acceptedKvkk}
                onChange={(e) => setAcceptedKvkk(e.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                style={
                  acceptedKvkk
                    ? { border: "2px solid transparent" }
                    : { border: "2px solid #64748b", backgroundColor: "rgba(148, 163, 184, 0.12)" }
                }
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  acceptedKvkk ? `${bg} text-white shadow-sm` : ""
                }`}
              >
                {acceptedKvkk && <Check size={13} strokeWidth={3.2} />}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveDocTab("kvkk");
                  }}
                  className={`font-extrabold underline underline-offset-2 ${text} cursor-pointer`}
                >
                  6698 Sayılı KVKK Aydınlatma Metnini
                </button>{" "}
                okudum, kişisel verilerimin ve iletişim/çağrı kayıtlarımın işlenme kapsamı hakkında bilgilendirildim.
              </span>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                acceptedPrivacy
                  ? `${lightBg} ${borderLight}`
                  : "bg-slate-50/90 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                style={
                  acceptedPrivacy
                    ? { border: "2px solid transparent" }
                    : { border: "2px solid #64748b", backgroundColor: "rgba(148, 163, 184, 0.12)" }
                }
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  acceptedPrivacy ? `${bg} text-white shadow-sm` : ""
                }`}
              >
                {acceptedPrivacy && <Check size={13} strokeWidth={3.2} />}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveDocTab("privacy");
                  }}
                  className={`font-extrabold underline underline-offset-2 ${text} cursor-pointer`}
                >
                  Gizlilik, Bilgi Güvenliği ve Ses Kaydı Kullanım Politikasını
                </button>{" "}
                okudum ve kabul ediyorum.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Onayınız; tarih, saat, IP adresi ve metin bütünlük özeti (SHA-256) ile hukuki denetim kaydına işlenir.
            </p>
            <div className="flex items-center justify-end gap-2.5 shrink-0">
              {typeof onLogout === "function" && (
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LogOut size={14} />
                  <span>Çıkış Yap</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAccept}
                disabled={!canContinue}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-sm transition-all ${
                  canContinue
                    ? `${bg} ${hover} cursor-pointer`
                    : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    <span>Onayla ve Devam Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
