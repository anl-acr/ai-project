import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  DownloadCloud,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Server,
  Lock,
  Unlock,
  Clock,
  ArrowUpCircle,
  Eye,
  EyeOff,
  GitCommit,
  Radio
} from "lucide-react";

export default function ReleaseCenterModal({
  isOpen,
  onClose,
  apiBase = "",
  currentUser,
  clients = [],
  onRefreshClients
}) {
  const [activeTab, setActiveTab] = useState("releases"); // "releases" | "fleet"
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importChannel, setImportChannel] = useState("beta");
  const [feedback, setFeedback] = useState(null); // { type: "success"|"error", text: string }

  // Manual Add Release Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRel, setNewRel] = useState({
    version: "",
    commit_hash: "",
    channel: "beta",
    title: "",
    summary: "",
    featuresText: "",
    fixesText: "",
    is_published: true
  });
  const [savingNew, setSavingNew] = useState(false);

  // Per-client policy & OTA busy states
  const [policyBusyId, setPolicyBusyId] = useState(null);
  const [otaBusyId, setOtaBusyId] = useState(null);

  // Custom Delete Confirmation Modal (never browser confirm())
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = useCallback(() => {
    const h = {
      "Content-Type": "application/json",
      "X-User-Name": currentUser?.username || currentUser?.full_name || "admin"
    };
    if (typeof window !== "undefined") {
      const tok = localStorage.getItem("nornia_master_token") || sessionStorage.getItem("nornia_master_token");
      if (tok) h["Authorization"] = `Bearer ${tok}`;
    }
    return h;
  }, [currentUser]);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/releases`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReleases(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
    setLoading(false);
  }, [apiBase, authHeaders]);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      fetchReleases();
      if (onRefreshClients) onRefreshClients();
    }
  }, [isOpen, fetchReleases]);

  if (!isOpen) return null;

  const handleImportFromRepo = async () => {
    setImporting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/releases/import-from-repo`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ channel: importChannel, is_published: true, limit: 5, git_fetch: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: "success", text: data.message || "Sürümler repodan içeri aktarıldı." });
        fetchReleases();
      } else {
        setFeedback({ type: "error", text: data.detail || "Repodan içe aktarma başarısız." });
      }
    } catch (e) {
      setFeedback({ type: "error", text: "Sunucuya bağlanılamadı." });
    }
    setImporting(false);
  };

  const handleCreateManualRelease = async (e) => {
    e.preventDefault();
    if (!newRel.version.trim()) return;
    setSavingNew(true);
    setFeedback(null);
    try {
      const features = newRel.featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const fixes = newRel.fixesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`${apiBase}/api/v1/releases`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          version: newRel.version.trim(),
          commit_hash: newRel.commit_hash.trim(),
          channel: newRel.channel,
          title: newRel.title.trim(),
          summary: newRel.summary.trim(),
          features,
          fixes,
          is_published: newRel.is_published
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: "success", text: `${data.version} sürümü başarıyla kaydedildi.` });
        setShowAddForm(false);
        setNewRel({
          version: "",
          commit_hash: "",
          channel: "beta",
          title: "",
          summary: "",
          featuresText: "",
          fixesText: "",
          is_published: true
        });
        fetchReleases();
      } else {
        setFeedback({ type: "error", text: data.detail || "Sürüm kaydedilemedi." });
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Bağlantı hatası." });
    }
    setSavingNew(false);
  };

  const handleUpdateReleaseField = async (rel, patch) => {
    setFeedback(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/releases/${rel.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(patch)
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `${rel.version} güncellendi.`
        });
        fetchReleases();
      }
    } catch (e) {}
  };

  const handleConfirmDeleteRelease = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/releases/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      if (res.ok) {
        setFeedback({ type: "success", text: `${deleteTarget.version} sürüm kaydı silindi.` });
        setDeleteTarget(null);
        fetchReleases();
      }
    } catch (e) {}
    setDeleting(false);
  };

  const handleUpdateClientPolicy = async (client, patch) => {
    setPolicyBusyId(client.id);
    setFeedback(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/clients/${client.id}/update-policy`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `${client.company_name} güncelleme politikası kaydedildi.`
        });
        if (onRefreshClients) onRefreshClients();
      } else {
        setFeedback({ type: "error", text: data.detail || "Politika güncellenemedi." });
      }
    } catch (e) {
      setFeedback({ type: "error", text: "Bağlantı hatası." });
    }
    setPolicyBusyId(null);
  };

  const handleTriggerClientOta = async (client, mode) => {
    setOtaBusyId(`${client.id}_${mode}`);
    setFeedback(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/clients/${client.id}/ota-update`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ mode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: "success", text: data.message || "OTA güncelleme başlatıldı." });
        if (onRefreshClients) onRefreshClients();
      } else {
        setFeedback({ type: "error", text: data.detail || "OTA başlatılamadı." });
      }
    } catch (e) {
      setFeedback({ type: "error", text: "Bağlantı hatası." });
    }
    setOtaBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-[9994] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <DownloadCloud size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Merkez Sürüm & Filo Güncelleme Yönetimi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Santraller yalnızca burada yayınladığınız onaylı sürümleri görür. Makine bazlı kanal ve Self-Update iznini buradan yönetin.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "releases" && (
              <button
                type="button"
                onClick={() => setShowAddForm((v) => !v)}
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition"
                title="Yeni Sürüm Kaydı Ekle"
              >
                <Plus size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("releases")}
              className={`px-4 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "releases"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <GitCommit size={14} />
              <span>Yayınlanan Sürümler ({releases.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("fleet");
                if (onRefreshClients) onRefreshClients();
              }}
              className={`px-4 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "fleet"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Server size={14} />
              <span>Makine Politikaları & Filo ({clients.length})</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchReleases();
              if (onRefreshClients) onRefreshClients();
            }}
            className="mb-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                feedback.type === "error"
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer opacity-70 hover:opacity-100">
                <X size={13} />
              </button>
            </div>
          )}

          {activeTab === "releases" ? (
            <div className="space-y-4">
              {/* Auto-Import From Repo Bar */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-500" />
                    Repodan Otomatik Sürüm İçe Aktar
                  </div>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 font-medium">
                    En son commit ve Türkçe sürüm notlarını (changelog) tek tıkla Sürüm Kayıt Merkezine alır. Önce Beta (Pilot) kanalına alıp test edebilir, sonra Kararlı kanala yükseltebilirsiniz.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={importChannel}
                    onChange={(e) => setImportChannel(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="beta">Beta / Pilot Kanalına Al</option>
                    <option value="stable">Doğrudan Kararlı (Stable) Yayınla</option>
                  </select>
                  <button
                    type="button"
                    disabled={importing}
                    onClick={handleImportFromRepo}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition"
                  >
                    <DownloadCloud size={14} className={importing ? "animate-bounce" : ""} />
                    <span>{importing ? "Çekiliyor..." : "Repodan Çek"}</span>
                  </button>
                </div>
              </div>

              {/* Manual Add Release Form */}
              {showAddForm && (
                <form
                  onSubmit={handleCreateManualRelease}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3"
                >
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Yeni Sürüm Kaydı Oluştur</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Sürüm (ör: v3.6.3)"
                      value={newRel.version}
                      onChange={(e) => setNewRel({ ...newRel, version: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Commit Hash (ör: 1f6895c)"
                      value={newRel.commit_hash}
                      onChange={(e) => setNewRel({ ...newRel, commit_hash: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                    <select
                      value={newRel.channel}
                      onChange={(e) => setNewRel({ ...newRel, channel: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      <option value="beta">Beta / Pilot</option>
                      <option value="stable">Kararlı (Stable)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Başlık"
                    value={newRel.title}
                    onChange={(e) => setNewRel({ ...newRel, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                  <textarea
                    rows={2}
                    placeholder="Kısa Özet"
                    value={newRel.summary}
                    onChange={(e) => setNewRel({ ...newRel, summary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <textarea
                      rows={3}
                      placeholder="Yeni Özellikler (her satıra bir madde)"
                      value={newRel.featuresText}
                      onChange={(e) => setNewRel({ ...newRel, featuresText: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                    />
                    <textarea
                      rows={3}
                      placeholder="Düzeltilen Sorunlar (her satıra bir madde)"
                      value={newRel.fixesText}
                      onChange={(e) => setNewRel({ ...newRel, fixesText: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={savingNew}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      {savingNew ? "Kaydediliyor..." : "Sürümü Kaydet"}
                    </button>
                  </div>
                </form>
              )}

              {/* Release Cards */}
              {releases.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                  Henüz kayıtlı sürüm yok. Yukarıdaki <strong>"Repodan Çek"</strong> butonuyla mevcut sürüm günlüğünü tek tıkla içeri aktarabilirsiniz.
                </div>
              ) : (
                <div className="space-y-3">
                  {releases.map((rel) => (
                    <div
                      key={rel.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {rel.version}
                          </span>
                          {rel.commit_hash && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              #{rel.commit_hash}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${
                              rel.channel === "beta"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            }`}
                          >
                            {rel.channel === "beta" ? "Beta / Pilot" : "Kararlı (Stable)"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              rel.is_published
                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {rel.is_published ? "Yayında" : "Taslak (Gizli)"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            • {(rel.features || []).length} özellik, {(rel.fixes || []).length} düzeltme
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rel.channel === "beta" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReleaseField(rel, { channel: "stable", is_published: true })}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                              title="Bu Beta sürümünü tüm Kararlı (Stable) santrallere aç"
                            >
                              <ArrowUpCircle size={12} />
                              Kararlıya Yükselt
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdateReleaseField(rel, { is_published: !rel.is_published })}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {rel.is_published ? <EyeOff size={11} /> : <Eye size={11} />}
                            {rel.is_published ? "Gizle" : "Yayınla"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rel)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition"
                            title="Sürümü Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {rel.title && <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{rel.title}</div>}
                      {rel.summary && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{rel.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: Per-Machine Update Policy & Live Fleet Status */
            <div className="space-y-3">
              {clients.map((c) => {
                const isUpdating = ["starting", "waiting_calls", "updating", "rolling_back"].includes(
                  String(c.update_status || "")
                );
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">{c.company_name}</span>
                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          {c.software_version || "-"}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            c.tunnel_connected
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          {c.tunnel_connected ? "Tünel Aktif" : "Çevrimdışı"}
                        </span>
                        {c.active_calls_count > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                            {c.active_calls_count} Aktif Çağrı
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {c.connect_subdomain ? `${c.connect_subdomain}.nornia.com.tr` : c.tenant_code} • HW: {c.hardware_id || "-"}
                      </div>

                      {c.update_status && c.update_status !== "idle" && (
                        <div className="pt-1 space-y-1">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <span
                              className={
                                c.update_status === "success"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : c.update_status === "failed" || c.update_status === "rolled_back"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-indigo-600 dark:text-indigo-400"
                              }
                            >
                              {c.update_step || c.update_status} ({c.update_progress || 0}%)
                            </span>
                          </div>
                          {isUpdating && (
                            <div className="w-64 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(5, Number(c.update_progress || 0))}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Controls: Channel + Self-Update Toggle + Safe OTA */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        disabled={policyBusyId === c.id}
                        value={c.update_channel || "stable"}
                        onChange={(e) => handleUpdateClientPolicy(c, { update_channel: e.target.value })}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] font-bold cursor-pointer"
                        title="Santral Güncelleme Kanalı"
                      >
                        <option value="stable">Kararlı (Stable)</option>
                        <option value="beta">Beta / Pilot</option>
                        <option value="pinned">Sabit (Dondurulmuş)</option>
                      </select>

                      <button
                        type="button"
                        disabled={policyBusyId === c.id}
                        onClick={() => handleUpdateClientPolicy(c, { self_update_allowed: !c.self_update_allowed })}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition ${
                          c.self_update_allowed
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-rose-500/15"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300/70 dark:border-slate-700 hover:bg-emerald-500/10"
                        }`}
                        title="Müşterinin kendi santral panelinden güncelleme başlatma izni"
                      >
                        {c.self_update_allowed ? <Unlock size={12} /> : <Lock size={12} />}
                        <span>{c.self_update_allowed ? "Self-Update Açık" : "Self-Update Kilitli"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={!c.tunnel_connected || otaBusyId === `${c.id}_after_calls` || isUpdating}
                        onClick={() => handleTriggerClientOta(c, "after_calls")}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition disabled:opacity-40"
                        title="Aktif çağrılar biter bitmez onaylı son sürüme güvenle güncelle"
                      >
                        <Clock size={12} />
                        <span>Çağrılar Bitince OTA</span>
                      </button>

                      <button
                        type="button"
                        disabled={!c.tunnel_connected || otaBusyId === `${c.id}_now` || isUpdating}
                        onClick={() => handleTriggerClientOta(c, "now")}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition disabled:opacity-40"
                        title="Onaylı son sürüme hemen OTA güncelleme gönder"
                      >
                        <RefreshCw size={12} className={otaBusyId === `${c.id}_now` ? "animate-spin" : ""} />
                        <span>Hemen OTA</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal (per AGENTS.md rule) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 animate-pulse">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Sürüm Kaydını Sil ({deleteTarget.version})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Bu sürüm kaydı Merkez Sürüm Listesinden kaldırılacaktır. Devam etmek istiyor musunuz?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteRelease}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
