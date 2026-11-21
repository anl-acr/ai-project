import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  FileText,
  Users,
  Search,
  Download,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Save,
  RotateCcw,
  Lock,
  Globe,
  Monitor,
  Smartphone,
  History,
  Check,
  Shield
} from "lucide-react";
import { useTheme } from "../../utils/theme";

function formatDateTR(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (e) {
    return isoStr;
  }
}

function platformLabel(code) {
  if (code === "pc_app") return "Masaüstü Uygulaması";
  if (code === "mobile_app") return "Mobil Uygulama";
  return "Web Tarayıcı";
}

function PlatformIcon({ code }) {
  if (code === "pc_app") return <Monitor size={13} className="shrink-0" />;
  if (code === "mobile_app") return <Smartphone size={13} className="shrink-0" />;
  return <Globe size={13} className="shrink-0" />;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(val) {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

export default function KvkkConsentSettingsPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"]
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const canWrite = useMemo(() => {
    if (!Array.isArray(userPermissions)) return true;
    return (
      userPermissions.includes("*") ||
      userPermissions.includes("kvkk_consent:write")
    );
  }, [userPermissions]);

  const [activeTab, setActiveTab] = useState("consents"); // consents | policy
  const [viewMode, setViewMode] = useState("users"); // users | history
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [policy, setPolicy] = useState({
    enabled: true,
    version: "v1.0",
    require_reconsent_version: "v1.0",
    kvkk_title: "",
    kvkk_text: "",
    privacy_title: "",
    privacy_text: "",
    kvkk_sha256: "",
    privacy_sha256: "",
    updated_at: null,
    updated_by: ""
  });
  const [forceReconsent, setForceReconsent] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const [summary, setSummary] = useState({
    total_users: 0,
    accepted_count: 0,
    outdated_count: 0,
    pending_count: 0,
    total_logs: 0
  });
  const [usersList, setUsersList] = useState([]);
  const [logsList, setLogsList] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | accepted | pending | outdated

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(
        `${protocol}//${backendHost}/api/settings/kvkk-consents?t=${Date.now()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.policy) setPolicy(data.policy);
        if (data.summary) setSummary(data.summary);
        setUsersList(Array.isArray(data.users) ? data.users : []);
        setLogsList(Array.isArray(data.logs) ? data.logs : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast("error", errData?.detail || "KVKK verileri yüklenemedi.");
      }
    } catch (err) {
      showToast("error", "Sunucuya erişilemedi.");
    } finally {
      setLoading(false);
    }
  }, [backendHost]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSavePolicy = async (resetDefaults = false) => {
    if (!canWrite || saving) return;
    setSaving(true);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/kvkk-policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: policy.enabled,
          kvkk_title: policy.kvkk_title,
          kvkk_text: policy.kvkk_text,
          privacy_title: policy.privacy_title,
          privacy_text: policy.privacy_text,
          force_reconsent: resetDefaults ? false : forceReconsent,
          reset_defaults: resetDefaults
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data?.detail || "Ayarlar kaydedilemedi.");
        return;
      }
      if (data.policy) setPolicy(data.policy);
      setForceReconsent(false);
      setConfirmResetOpen(false);
      showToast(
        "success",
        resetDefaults
          ? "Varsayılan KVKK ve Gizlilik metinleri geri yüklendi."
          : data.version_bumped
          ? `Politika kaydedildi ve sürüm ${data.policy?.version} olarak güncellendi.`
          : "KVKK & Gizlilik ayarları başarıyla kaydedildi."
      );
      fetchAll();
    } catch (err) {
      showToast("error", "Kayıt sırasında bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersList.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(u.full_name || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.extension || "").toLowerCase().includes(q) ||
        String(u.ip_address || "").toLowerCase().includes(q)
      );
    });
  }, [usersList, searchQuery, statusFilter]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logsList.filter((l) => {
      if (!q) return true;
      return (
        String(l.full_name || "").toLowerCase().includes(q) ||
        String(l.email || "").toLowerCase().includes(q) ||
        String(l.extension || "").toLowerCase().includes(q) ||
        String(l.ip_address || "").toLowerCase().includes(q) ||
        String(l.policy_version || "").toLowerCase().includes(q)
      );
    });
  }, [logsList, searchQuery]);

  const handleExportCsv = () => {
    const isHistory = viewMode === "history";
    let headers;
    let rows;
    if (isHistory) {
      headers = [
        "Kayıt ID",
        "Ad Soyad",
        "E-Posta",
        "Dahili",
        "Sürüm",
        "Onay Tarihi (TR)",
        "Onay Tarihi (UTC)",
        "IP Adresi",
        "Platform",
        "KVKK SHA-256",
        "Gizlilik SHA-256",
        "HMAC Doğrulama",
        "HMAC İmza"
      ];
      rows = filteredLogs.map((l) => [
        l.id,
        l.full_name,
        l.email,
        l.extension,
        l.policy_version,
        formatDateTR(l.accepted_at),
        l.accepted_at || "",
        l.ip_address,
        platformLabel(l.client_platform),
        l.kvkk_sha256,
        l.privacy_sha256,
        l.hmac_valid ? "DOĞRULANDI" : "UYARI",
        l.record_hmac
      ]);
    } else {
      headers = [
        "Ad Soyad",
        "E-Posta",
        "Dahili",
        "Rol",
        "Onay Durumu",
        "Onaylanan Sürüm",
        "Onay Tarihi (TR)",
        "IP Adresi",
        "Platform",
        "KVKK SHA-256",
        "HMAC Doğrulama"
      ];
      rows = filteredUsers.map((u) => [
        u.full_name,
        u.email,
        u.extension,
        u.role,
        u.status === "accepted"
          ? "Onayladı"
          : u.status === "outdated"
          ? "Yeniden Onay Bekliyor"
          : "Onay Bekliyor",
        u.accepted_version || "—",
        formatDateTR(u.accepted_at),
        u.ip_address || "—",
        u.client_platform ? platformLabel(u.client_platform) : "—",
        u.kvkk_sha256 || "—",
        u.hmac_valid === true ? "DOĞRULANDI" : u.hmac_valid === false ? "UYARI" : "—"
      ]);
    }

    const csvContent =
      "\uFEFF" +
      [headers.map(csvCell).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kvkk_onay_${isHistory ? "log_gecmisi" : "kullanici_durumlari"}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintProofCertificate = (logRecord) => {
    if (!logRecord || typeof window === "undefined") return;
    const win = window.open("", "_blank", "width=860,height=820");
    if (!win) return;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>KVKK & Gizlilik Onay İspat Belgesi - ${escapeHtml(logRecord.full_name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 32px; max-width: 800px; margin: 0 auto; line-height: 1.55; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; margin: 0 0 4px 0; }
    .header p { font-size: 12px; color: #475569; margin: 0; }
    .badge { padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; background: ${
      logRecord.hmac_valid ? "#ecfdf5" : "#fff1f2"
    }; color: ${logRecord.hmac_valid ? "#047857" : "#be123c"}; border: 1px solid ${
      logRecord.hmac_valid ? "#a7f3d0" : "#fecdd3"
    }; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; width: 32%; font-weight: 700; color: #334155; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; word-break: break-all; }
    h2 { font-size: 14px; margin: 20px 0 8px 0; padding-left: 10px; border-left: 3px solid #0f172a; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>KVKK & GİZLİLİK POLİTİKASI ONAY İSPAT BELGESİ</h1>
      <p>6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında Elektronik Denetim Kaydı</p>
    </div>
    <div class="badge">${
      logRecord.hmac_valid ? "HMAC-SHA256 BÜTÜNLÜK DOĞRULANDI" : "BÜTÜNLÜK UYARISI"
    }</div>
  </div>

  <table>
    <tr><th>Kayıt No (Audit ID)</th><td>#${escapeHtml(logRecord.id)}</td></tr>
    <tr><th>Kullanıcı Adı Soyadı</th><td><strong>${escapeHtml(logRecord.full_name)}</strong></td></tr>
    <tr><th>E-Posta / Dahili</th><td>${escapeHtml(logRecord.email || "—")} / ${escapeHtml(logRecord.extension || "—")}</td></tr>
    <tr><th>Onaylanan Politika Sürümü</th><td><strong>${escapeHtml(logRecord.policy_version)}</strong></td></tr>
    <tr><th>Onay Zamanı (Türkiye UTC+3)</th><td><strong>${escapeHtml(formatDateTR(logRecord.accepted_at))}</strong></td></tr>
    <tr><th>Onay Zamanı (UTC ISO-8601)</th><td class="mono">${escapeHtml(logRecord.accepted_at)}</td></tr>
    <tr><th>İstemci IP Adresi</th><td class="mono">${escapeHtml(logRecord.ip_address || "—")}</td></tr>
    <tr><th>Erişim Platformu</th><td>${escapeHtml(platformLabel(logRecord.client_platform))}</td></tr>
    <tr><th>Tarayıcı / Cihaz Bilgisi (User-Agent)</th><td class="mono">${escapeHtml(logRecord.user_agent || "—")}</td></tr>
    <tr><th>KVKK Metni Bütünlük Özeti (SHA-256)</th><td class="mono">${escapeHtml(logRecord.kvkk_sha256)}</td></tr>
    <tr><th>Gizlilik Metni Bütünlük Özeti (SHA-256)</th><td class="mono">${escapeHtml(logRecord.privacy_sha256)}</td></tr>
    <tr><th>Kayıt Kriptografik Mührü (HMAC-SHA256)</th><td class="mono">${escapeHtml(logRecord.record_hmac)}</td></tr>
  </table>

  <h2>Onay Anındaki KVKK Aydınlatma Metni (Snapshot)</h2>
  <pre>${escapeHtml(logRecord.kvkk_snapshot_text)}</pre>

  <h2>Onay Anındaki Gizlilik ve Kullanım Politikası (Snapshot)</h2>
  <pre>${escapeHtml(logRecord.privacy_snapshot_text)}</pre>

  <div class="footer">
    Bu belge elektronik denetim veritabanından (<code>user_consent_logs</code>) ${new Date().toLocaleString(
      "tr-TR"
    )} tarihinde oluşturulmuştur. Kayıt, kullanıcının iki ayrı onay kutusunu açık rızasıyla işaretlemesi sonucu kriptografik HMAC-SHA256 imzasıyla mühürlenmiştir.
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const openProofForUser = (userRow) => {
    const matched = logsList.find((l) => l.id === userRow.latest_log_id);
    if (matched) {
      handlePrintProofCertificate(matched);
    } else {
      showToast("error", "Bu kullanıcıya ait onay kaydı bulunamadı.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl ${lightBg} border ${borderLight} flex items-center justify-center shrink-0`}
            >
              <ShieldCheck size={22} className={text} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  KVKK & Gizlilik Politikası Onay Yönetimi
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}
                >
                  Aktif Sürüm: {policy.version}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                    policy.enabled
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {policy.enabled ? "İlk Giriş Popup Aktif" : "Pasif"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                6698 sayılı KVKK kapsamında tüm kullanıcıların ilk girişte onaylaması gereken metinleri yönetin, onay durumlarını takip edin ve hukuki ispat belgesi üretin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Yenile</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("consents")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "consents"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            }`}
          >
            <Users size={14} />
            <span>Onay Durumları & Hukuki Loglar</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                activeTab === "consents"
                  ? "bg-white/20 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
              }`}
            >
              {summary.accepted_count}/{summary.total_users}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("policy")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "policy"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            }`}
          >
            <FileText size={14} />
            <span>Politika Metinleri & Ayarlar</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-sm ${
            toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TAB 1: CONSENTS & AUDIT LOGS */}
      {activeTab === "consents" && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Toplam Kullanıcı
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.total_users}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Onayladı (Güncel)
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                {summary.accepted_count}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 shadow-sm">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                Onay Bekleyen
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                {summary.pending_count + summary.outdated_count}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Toplam Hukuki Log
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.total_logs}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("users")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "users"
                        ? `${bg} text-white shadow-sm`
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Users size={13} />
                    <span>Kullanıcı Durumları</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("history")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "history"
                        ? `${bg} text-white shadow-sm`
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <History size={13} />
                    <span>Değiştirilemez Log Geçmişi ({logsList.length})</span>
                  </button>
                </div>

                {viewMode === "users" && (
                  <div className="inline-flex items-center gap-1 text-xs">
                    {[
                      { id: "all", label: "Tümü" },
                      { id: "accepted", label: "Onayladı" },
                      { id: "pending", label: "Bekliyor" },
                      { id: "outdated", label: "Eski Sürüm" }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id)}
                        className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                          statusFilter === f.id
                            ? `${lightBg} ${text} border ${borderLight}`
                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="İsim, dahili, e-posta veya IP ara..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
                >
                  <Download size={13} />
                  <span>CSV İndir</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {viewMode === "users" ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Kullanıcı</th>
                      <th className="py-2.5 px-3">Durum</th>
                      <th className="py-2.5 px-3">Sürüm</th>
                      <th className="py-2.5 px-3">Onay Tarihi</th>
                      <th className="py-2.5 px-3">IP & Platform</th>
                      <th className="py-2.5 px-3">Bütünlük (HMAC)</th>
                      <th className="py-2.5 px-3 text-right">Belge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-400 dark:text-slate-500"
                        >
                          Eşleşen kullanıcı kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr
                          key={u.user_id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {u.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.extension ? `Dahili ${u.extension}` : ""}
                              {u.extension && u.email ? " · " : ""}
                              {u.email || ""}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {u.status === "accepted" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px]">
                                <CheckCircle2 size={12} />
                                Onayladı
                              </span>
                            ) : u.status === "outdated" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[11px]">
                                <AlertTriangle size={12} />
                                Yeni Sürüm Bekliyor
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold text-[11px]">
                                <Clock size={12} />
                                İlk Giriş Bekleniyor
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {u.accepted_version || "—"}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {formatDateTR(u.accepted_at)}
                          </td>
                          <td className="py-3 px-3">
                            {u.ip_address ? (
                              <div className="space-y-0.5">
                                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                                  {u.ip_address}
                                </div>
                                <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                  <PlatformIcon code={u.client_platform} />
                                  <span>{platformLabel(u.client_platform)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {u.record_hmac ? (
                              <div className="space-y-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold ${
                                    u.hmac_valid
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  <Shield size={11} />
                                  {u.hmac_valid ? "Doğrulandı" : "Bütünlük Uyarısı"}
                                </span>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {u.record_hmac.slice(0, 14)}...
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {u.latest_log_id ? (
                              <button
                                type="button"
                                onClick={() => openProofForUser(u)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${lightBg} ${text} border ${borderLight} text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer`}
                              >
                                <Printer size={12} />
                                <span>İspat Belgesi</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Kayıt #</th>
                      <th className="py-2.5 px-3">Kullanıcı</th>
                      <th className="py-2.5 px-3">Sürüm</th>
                      <th className="py-2.5 px-3">Onay Tarihi (TR)</th>
                      <th className="py-2.5 px-3">IP & Platform</th>
                      <th className="py-2.5 px-3">SHA-256 / HMAC</th>
                      <th className="py-2.5 px-3 text-right">İspat Belgesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-400 dark:text-slate-500"
                        >
                          Henüz kaydedilmiş KVKK onay logu bulunmuyor.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((l) => (
                        <tr
                          key={l.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-slate-500">
                            #{l.id}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {l.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {l.extension ? `Dahili ${l.extension}` : ""}{" "}
                              {l.email ? `· ${l.email}` : ""}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {l.policy_version}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatDateTR(l.accepted_at)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                              {l.ip_address || "—"}
                            </div>
                            <div className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                              <PlatformIcon code={l.client_platform} />
                              <span>{platformLabel(l.client_platform)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              KVKK: {(l.kvkk_sha256 || "").slice(0, 12)}...
                            </div>
                            <div
                              className={`text-[10px] font-bold ${
                                l.hmac_valid
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {l.hmac_valid ? "HMAC Doğrulandı" : "Bütünlük Uyarısı"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePrintProofCertificate(l)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${lightBg} ${text} border ${borderLight} text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer`}
                            >
                              <Printer size={12} />
                              <span>Yazdır / PDF</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POLICY TEXTS & SETTINGS */}
      {activeTab === "policy" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          {/* Enable Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                İlk Girişte KVKK & Gizlilik Onay Popup&apos;ını Zorunlu Tut
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Açık olduğunda, tüm kullanıcılar (Admin dahil) sisteme ilk girişlerinde metinleri onaylamadan panele geçemez. Onaylayanlara bir daha sorulmaz.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={policy.enabled}
              disabled={!canWrite}
              onClick={() => setPolicy((p) => ({ ...p, enabled: !p.enabled }))}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
                policy.enabled ? bg : "bg-slate-300 dark:bg-slate-700"
              } ${canWrite ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-1 ${
                  policy.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* KVKK Document Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText size={14} className={text} />
                <span>KVKK Aydınlatma Metni (6698 Sayılı Kanun)</span>
              </label>
              {policy.kvkk_sha256 && (
                <span className="font-mono text-[10px] text-slate-400">
                  SHA-256: {policy.kvkk_sha256.slice(0, 16)}...
                </span>
              )}
            </div>
            <input
              type="text"
              disabled={!canWrite}
              value={policy.kvkk_title}
              onChange={(e) => setPolicy((p) => ({ ...p, kvkk_title: e.target.value }))}
              placeholder="KVKK Aydınlatma Metni Başlığı"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <textarea
              rows={9}
              disabled={!canWrite}
              value={policy.kvkk_text}
              onChange={(e) => setPolicy((p) => ({ ...p, kvkk_text: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          </div>

          {/* Privacy Policy Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock size={14} className={text} />
                <span>Gizlilik, Bilgi Güvenliği ve Ses Kaydı Kullanım Politikası</span>
              </label>
              {policy.privacy_sha256 && (
                <span className="font-mono text-[10px] text-slate-400">
                  SHA-256: {policy.privacy_sha256.slice(0, 16)}...
                </span>
              )}
            </div>
            <input
              type="text"
              disabled={!canWrite}
              value={policy.privacy_title}
              onChange={(e) => setPolicy((p) => ({ ...p, privacy_title: e.target.value }))}
              placeholder="Gizlilik Politikası Başlığı"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <textarea
              rows={9}
              disabled={!canWrite}
              value={policy.privacy_text}
              onChange={(e) => setPolicy((p) => ({ ...p, privacy_text: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          </div>

          {/* Force Re-Consent Option */}
          {canWrite && (
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={forceReconsent}
                onClick={() => setForceReconsent((v) => !v)}
                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  forceReconsent
                    ? `${bg} ${border} text-white`
                    : "bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-700"
                }`}
              >
                {forceReconsent && <Check size={13} strokeWidth={3} />}
              </button>
              <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong className="font-extrabold">
                  Tüm kullanıcılardan yeni sürüm için tekrar onay iste
                </strong>
                <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Bu kutu işaretlenmezse, daha önce onay vermiş kullanıcılara popup tekrar gösterilmez (yalnızca yeni giriş yapanlar güncel metni görür). İşaretlerseniz sürüm artar ve tüm kullanıcıların bir sonraki girişte güncel metni yeniden onaylaması gerekir.
                </div>
              </div>
            </label>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              {policy.updated_at
                ? `Son güncelleme: ${formatDateTR(policy.updated_at)} (${policy.updated_by || "Admin"}) · Zorunlu minimum sürüm: ${policy.require_reconsent_version}`
                : `Zorunlu minimum sürüm: ${policy.require_reconsent_version}`}
            </div>

            {canWrite && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Varsayılan Metne Sıfırla</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePolicy(false)}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50`}
                >
                  <Save size={14} />
                  <span>{saving ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom App-Native Reset Confirmation Modal (No browser confirm()) */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Varsayılan KVKK Metinlerine Dönülsün mü?
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Özelleştirdiğiniz KVKK Aydınlatma Metni ve Gizlilik Politikası sistemin hazır Türkçe kurumsal şablonlarıyla değiştirilecektir. Geçmiş onay logları etkilenmez.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => handleSavePolicy(true)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Sıfırlanıyor..." : "Varsayılana Sıfırla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
