import React, { useState, useEffect } from "react";
import {
  Cable,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
  Save,
  Settings,
  ExternalLink,
  PhoneIncoming,
  FileText,
  UserPlus,
  Sparkles,
  Check,
  X,
  Eye,
  EyeOff,
  Building2,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

export default function CrmIntegrationsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrm, setSelectedCrm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("+90 532 410 20 30");
  const [testResult, setTestResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  const safeFetch = async (path, options = {}) => {
    const apiBase = getApiBaseUrl(backendHost);
    return await tenantFetch(`${apiBase}${path}`, options);
  };

  const fetchCrmCatalog = async () => {
    setLoading(true);
    try {
      const res = await safeFetch("/api/settings/crm-integrations");
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.catalog) ? data.catalog : [];
        setCatalog(items);
        if (selectedCrm) {
          const updated = items.find((i) => i.id === selectedCrm.id);
          if (updated) setSelectedCrm(updated);
        }
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmCatalog();
  }, [backendHost]);

  const handleSaveCrm = async (crmDraft) => {
    const target = crmDraft || selectedCrm;
    if (!target) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/crm-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crm_id: target.id,
          config: target,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data?.catalog)) {
          setCatalog(data.catalog);
          const fresh = data.catalog.find((i) => i.id === target.id);
          if (fresh) setSelectedCrm(fresh);
        }
        setFeedback({ type: "success", message: `${target.name} ayarları kaydedildi.` });
      } else {
        setFeedback({ type: "error", message: data?.detail || "Kaydedilemedi." });
      }
    } catch (_) {
      setFeedback({ type: "error", message: "Sunucu bağlantı hatası." });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (item) => {
    const updated = { ...item, enabled: !item.enabled };
    setCatalog((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
    await handleSaveCrm(updated);
  };

  const handleTestCrm = async () => {
    if (!selectedCrm) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await safeFetch(`/api/settings/crm-integrations/${encodeURIComponent(selectedCrm.id)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedCrm,
          test_phone: testPhone,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (_) {
      setTestResult({ status: "error", message: "Test sırasında bağlantı hatası oluştu." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>Hazır CRM entegrasyon kataloğu yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Value Summary */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
              <Cable size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Hazır Kurumsal CRM Entegrasyon Marketi (Native Connectors)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dünyada ve Türkiye&apos;de en çok kullanılan CRM yazılımlarını kod yazmadan tek tıkla AIDA santraline bağlayın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
              {catalog.filter((c) => c.enabled).length} / {catalog.length} Bağlantı Aktif
            </span>
          </div>
        </div>

        {/* 4 Impact Pillars for Agents */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
          {[
            {
              icon: PhoneIncoming,
              title: "1. Çalarken Müşteriyi Tanıma",
              desc: "Telefon çaldığı anda arayan numara CRM'den sorgulanır; müşteri adı ve VIP/Şirket bilgisi ekranda yazar.",
            },
            {
              icon: ExternalLink,
              title: "2. Otomatik Müşteri Kartı (Screen Pop)",
              desc: "Temsilci çağrıyı açtığında müşterinin Zoho, HubSpot, Bitrix24 veya Salesforce kartı otomatik açılır.",
            },
            {
              icon: FileText,
              title: "3. Otomatik Çağrı & Ses Kaydı İşleme",
              desc: "Görüşme bittiğinde süre, ses kaydı linki ve AI konuşma özeti CRM müşteri geçmişine otomatik yazılır.",
            },
            {
              icon: UserPlus,
              title: "4. Cevapsız Çağrıda Görev / Lead",
              desc: "Kayıtsız arayanlar için otomatik Lead açılır; cevapsız çağrılar temsilciye Geri Arama Görevi olarak atanır.",
            },
          ].map((feat, idx) => {
            const IconComp = feat.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
                  <IconComp size={15} className={text} />
                  <span>{feat.title}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
          feedback.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* CRM Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {catalog.map((crm) => (
          <div
            key={crm.id}
            className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between gap-4 ${
              crm.enabled
                ? "border-emerald-300 dark:border-emerald-800 shadow-sm"
                : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight} mb-1.5`}>
                    {crm.badge}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {crm.name}
                  </h4>
                  <div className="text-[10px] font-semibold text-slate-400">
                    {crm.category}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickToggle(crm)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                    crm.enabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  }`}
                >
                  {crm.enabled ? "Aktif" : "Pasif"}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {crm.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {crm.api_key ? "🔑 Anahtar Tanımlı" : "⚙️ Yapılandırılmadı"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCrm({ ...crm });
                  setTestResult(null);
                  setShowSecret(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0`}
              >
                <Settings size={13} />
                <span>Yapılandır & Test Et</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration & Live Simulation Modal */}
      {selectedCrm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Cable size={16} className={text} />
                  <span>{selectedCrm.name} Entegrasyon Ayarları</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedCrm.category} • {selectedCrm.vendor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCrm(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Top Enable & Simulation Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <label className="flex items-center gap-2.5 text-xs font-extrabold text-slate-800 dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCrm.enabled)}
                    onChange={(e) => setSelectedCrm((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span>{selectedCrm.name} Entegrasyonunu Etkinleştir</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCrm.simulation_mode)}
                    onChange={(e) => setSelectedCrm((prev) => ({ ...prev, simulation_mode: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span>Demo / Simülasyon Test Modu</span>
                </label>
              </div>

              {/* Dynamic Connection Fields */}
              <div className="space-y-3">
                {(selectedCrm.fields || []).map((f) => {
                  const isSecret = f.key === "api_key";
                  return (
                    <div key={f.key}>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {f.label}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={isSecret && !showSecret ? "password" : "text"}
                          value={selectedCrm[f.key] || ""}
                          onChange={(e) => setSelectedCrm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="flex-1 text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => setShowSecret((v) => !v)}
                            className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Otomatik Müşteri Kartı Açma (Screen Pop) Şablonu
                  </label>
                  <input
                    type="text"
                    value={selectedCrm.screen_pop_url || ""}
                    onChange={(e) => setSelectedCrm((prev) => ({ ...prev, screen_pop_url: e.target.value }))}
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* 6 Automation Behaviors */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Çağrı & Temsilci Otomasyon Davranışları
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: "caller_id_lookup", label: "Gelen aramada müşteri adını CRM'den getir" },
                    { key: "screen_pop_enabled", label: "Çağrı geldiğinde CRM müşteri kartını aç" },
                    { key: "auto_log_calls", label: "Görüşme bitince süre ve ses kaydını CRM'e işle" },
                    { key: "sync_ai_transcript", label: "AI konuşma özetini ve duygu analizini ekle" },
                    { key: "create_lead_on_unknown", label: "Kayıtsız numaraları yeni Lead olarak oluştur" },
                    { key: "create_task_on_missed", label: "Cevapsız aramalarda geri arama görevi aç" },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedCrm[opt.key])}
                        onChange={(e) => setSelectedCrm((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Test Lookup & Simulation Box */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    Canlı Müşteri Sorgulama & Çağrı Kaydı Testi
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="text-xs font-mono px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleTestCrm}
                      disabled={testing}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      {testing ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} className={text} />}
                      <span>Simülasyon / Test Et</span>
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    testResult.status === "success"
                      ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                  }`}>
                    <div className="font-extrabold flex items-center gap-2">
                      <CheckCircle2 size={15} />
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.sample_payload?.matched_contact && (
                      <div className="p-3 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] space-y-1 font-mono">
                        <div>
                          <strong>CRM Kayıt No:</strong> {testResult.sample_payload.matched_contact.id}
                        </div>
                        <div>
                          <strong>Müşteri / Firma:</strong> {testResult.sample_payload.matched_contact.full_name} — {testResult.sample_payload.matched_contact.company} ({testResult.sample_payload.matched_contact.segment})
                        </div>
                        <div>
                          <strong>Müşteri Temsilcisi:</strong> {testResult.sample_payload.matched_contact.account_owner}
                        </div>
                        <div>
                          <strong>Son CRM Aktivitesi:</strong> {testResult.sample_payload.matched_contact.last_activity}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedCrm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={() => handleSaveCrm(selectedCrm)}
                disabled={saving}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 cursor-pointer`}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Ayarları Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
