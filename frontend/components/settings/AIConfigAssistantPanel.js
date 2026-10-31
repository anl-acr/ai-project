import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  UserPlus,
  UserCheck,
  Users,
  PhoneCall,
  ShieldAlert,
  Calendar,
  Coffee,
  Shuffle,
  Lock,
  History,
  Check,
  Edit3,
  Trash2,
  Bot,
  Building2,
  MapPin,
  Cable,
  Volume2,
  GitBranch,
  BookOpen,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Contact2,
  ShieldCheck,
  DatabaseBackup,
  Hash,
  KeyRound,
  Activity
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import DictationButton from "../common/DictationButton";

const PRESET_COMMANDS = [
  {
    label: "Uçtan Uca Ekip + Kuyruk + DID",
    prompt: "Selin Kaya ve Burak Aydın için 2 yeni dahili aç, 'Kurumsal Satış' kuyruğu oluşturup ikisini kuyruğa ata ve 08503607390 numarasını bu kuyruğa yönlendir"
  },
  {
    label: "AI Sesli Anons (TTS) & IVR Akışı",
    prompt: "'Karşılama Anonsu' adıyla 'Şirketimize hoş geldiniz, satış için 1, teknik destek için 2 tuşlayınız' metnini seslendir; ardından 1'e basınca Satış, 2'ye basınca Destek kuyruğuna giden 'Ana IVR Akışı' oluştur"
  },
  {
    label: "Bilgi Bankası (RAG) & QA Kriteri",
    prompt: "Bilgi bankasına 'İade Politikası' başlığıyla 'Ürünlerimizde 14 gün koşulsuz ücretsiz iade hakkı bulunmaktadır' bilgisini öğret ve kalite kontrolüne 25 puanlık 'Temsilci KVKK aydınlatmasını eksiksiz yaptı mı?' sorusu ekle"
  },
  {
    label: "Rehber, Hızlı Cevap & WhatsApp",
    prompt: "Rehbere 'Zeynep Acar' kişisini +905324445566 numarasıyla VIP olarak ekle; /kargo kısayoluyla 'Siparişiniz bugün kargoya teslim edilmiştir' hızlı cevabı oluştur ve WhatsApp mesai saatlerini 09:00-18:30 yap"
  },
  {
    label: "Dış Arama Kampanyası & Mola",
    prompt: "15 dakikalık turuncu renkli 'Eğitim Molası' tanımla ve 'Yenileme Kampanyası' adında 3 eş zamanlı kanallı dış arama kampanyası oluştur"
  },
  {
    label: "Yedek Noktası & Güvenlik Kalkanı",
    prompt: "'Haftalık Santral Yedeği' başlıklı geri yükleme noktası oluştur ve 185.122.40.15 IP adresini güvenlik kalkanı güvenli listesine ekle"
  }
];

const ACTION_ICONS = {
  create_user: UserPlus,
  update_user: UserCheck,
  delete_user: Trash2,
  update_user_forwarding: Shuffle,
  create_queue: Users,
  update_queue: Edit3,
  add_queue_members: Users,
  remove_queue_members: Users,
  delete_queue: Trash2,
  create_ai_agent: Bot,
  update_ai_agent: Bot,
  generate_ai_agent_scenario: GitBranch,
  delete_ai_agent: Trash2,
  create_conference: PhoneCall,
  update_conference: Edit3,
  delete_conference: Trash2,
  create_break_type: Coffee,
  update_break_type: Coffee,
  delete_break_type: Trash2,
  create_department: Building2,
  update_department: Building2,
  delete_department: Trash2,
  create_location: MapPin,
  update_location: MapPin,
  delete_location: Trash2,
  create_subscriber_group: Users,
  update_subscriber_group: Edit3,
  delete_subscriber_group: Trash2,
  create_pickup_group: Users,
  update_pickup_group: Edit3,
  delete_pickup_group: Trash2,
  create_speed_dial: PhoneCall,
  update_speed_dial: Edit3,
  delete_speed_dial: Trash2,
  create_trunk: Cable,
  update_trunk: Cable,
  delete_trunk: Trash2,
  create_inbound_rule: PhoneCall,
  update_inbound_rule: Edit3,
  delete_inbound_rule: Trash2,
  create_outbound_rule: Shuffle,
  update_outbound_rule: Edit3,
  delete_outbound_rule: Trash2,
  create_call_flow: GitBranch,
  update_call_flow: GitBranch,
  delete_call_flow: Trash2,
  create_tts_announcement: Volume2,
  update_announcement: Volume2,
  delete_announcement: Trash2,
  update_numbering_plan: Hash,
  create_contact: Contact2,
  update_contact: Contact2,
  delete_contact: Trash2,
  create_canned_response: MessageSquare,
  update_canned_response: MessageSquare,
  delete_canned_response: Trash2,
  add_blacklist: ShieldAlert,
  remove_blacklist: Trash2,
  add_block_word: ShieldAlert,
  remove_block_word: Trash2,
  add_kb_text: BookOpen,
  crawl_kb_url: BookOpen,
  delete_kb_source: Trash2,
  create_ai_rule: Sparkles,
  update_ai_rule: Edit3,
  delete_ai_rule: Trash2,
  create_qa_question: ClipboardCheck,
  update_qa_question: ClipboardCheck,
  delete_qa_question: Trash2,
  create_dialer_campaign: Megaphone,
  update_dialer_campaign: Megaphone,
  delete_dialer_campaign: Trash2,
  create_appointment: Calendar,
  update_appointment: Calendar,
  cancel_appointment: Trash2,
  create_role: KeyRound,
  update_role: KeyRound,
  delete_role: Trash2,
  create_scheduled_report: Calendar,
  update_scheduled_report: Edit3,
  delete_scheduled_report: Trash2,
  update_whatsapp_settings: MessageSquare,
  update_pbx_ai_features: Sparkles,
  add_security_whitelist: ShieldCheck,
  remove_security_whitelist: Trash2,
  create_restore_point: DatabaseBackup,
  set_agent_live_status: Activity
};

export default function AIConfigAssistantPanel({ userPermissions = null, onNavigateTab = null }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl();

  const resolvedPerms = useMemo(() => {
    if (Array.isArray(userPermissions)) return userPermissions;
    if (typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("pbx_user") || "{}");
        if (u?.role === "admin") return ["*"];
        if (Array.isArray(u?.permissions)) return u.permissions;
      } catch (_) {}
    }
    return ["*"];
  }, [userPermissions]);

  const canRead =
    resolvedPerms.includes("*") ||
    resolvedPerms.includes("ai_config_assistant:read") ||
    resolvedPerms.includes("ai_config_assistant:write") ||
    resolvedPerms.includes("ai_config_assistant");

  const canWrite =
    resolvedPerms.includes("*") ||
    resolvedPerms.includes("ai_config_assistant:write");

  const [prompt, setPrompt] = useState("");
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [selectedActionIds, setSelectedActionIds] = useState([]);
  const [applyOutcome, setApplyOutcome] = useState(null);

  const [historyList, setHistoryList] = useState([]);
  const [undoTarget, setUndoTarget] = useState(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const formatErrDetail = (detail, fallback) => {
    if (!detail) return fallback;
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === "string" ? d : d?.msg || JSON.stringify(d))).join(" | ");
    }
    if (typeof detail === "object") return detail.msg || JSON.stringify(detail);
    return String(detail);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg: String(msg || ""), type });
    setTimeout(() => setToast(null), 4200);
  };

  const fetchAssistantMetaAndHistory = async () => {
    try {
      const histRes = await tenantFetch(`${API_BASE}/api/ai-config-assistant/history`).catch(() => null);
      if (histRes && histRes.ok) {
        const hJson = await histRes.json();
        setHistoryList(Array.isArray(hJson.history) ? hJson.history : []);
      }
    } catch (err) {
      console.error("AI Config Assistant load error:", err);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchAssistantMetaAndHistory();
    }
  }, [canRead]);

  const handleGeneratePlan = async (customPrompt = null) => {
    const finalPrompt = String(customPrompt !== null ? customPrompt : prompt).trim();
    if (!finalPrompt) {
      showToast("Lütfen uygulanmasını istediğiniz santral ayarını yazın veya mikrofonla dikte edin.", "error");
      return;
    }
    setPlanning(true);
    setApplyOutcome(null);
    try {
      const res = await tenantFetch(`${API_BASE}/api/ai-config-assistant/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatErrDetail(data?.detail, "Taslak plan oluşturulamadı."));

      setPlanResult(data);
      const allowedIds = (data.actions || []).filter((a) => a.allowed).map((a) => a.action_id);
      setSelectedActionIds(allowedIds);
      if (!data.actions || data.actions.length === 0) {
        showToast("Komutta uygulanabilir bir santral işlemi tespit edilemedi. Lütfen daha net tarif edin.", "error");
      }
    } catch (err) {
      showToast(err.message || "Plan oluşturma hatası.", "error");
    } finally {
      setPlanning(false);
    }
  };

  const toggleActionSelection = (actId) => {
    setSelectedActionIds((prev) =>
      prev.includes(actId) ? prev.filter((id) => id !== actId) : [...prev, actId]
    );
  };

  const handleApplyPlan = async () => {
    if (!planResult || !canWrite) return;
    const chosenActions = (planResult.actions || []).filter(
      (a) => a.allowed && selectedActionIds.includes(a.action_id)
    );
    if (chosenActions.length === 0) {
      showToast("Uygulamak için en az bir yetkili işlem adımı seçmelisiniz.", "error");
      return;
    }

    setApplying(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/ai-config-assistant/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: planResult.prompt,
          actions: chosenActions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatErrDetail(data?.detail, "İşlemler uygulanamadı."));

      setApplyOutcome(data);
      setPlanResult(null);
      await fetchAssistantMetaAndHistory();
      showToast(`${(data.applied || []).length} konfigürasyon adımı başarıyla santrale uygulandı!`);
    } catch (err) {
      showToast(err.message || "Uygulama hatası.", "error");
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmUndo = async () => {
    if (!undoTarget) return;
    setUndoLoading(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/ai-config-assistant/undo/${undoTarget.id}`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Geri alma işlemi başarısız oldu.");
      setUndoTarget(null);
      await fetchAssistantMetaAndHistory();
      showToast("AI Konfigürasyon paketi başarıyla geri alındı ve önceki duruma dönüldü.");
    } catch (err) {
      showToast(err.message || "Geri alma hatası.", "error");
    } finally {
      setUndoLoading(false);
    }
  };

  const handleReset = () => {
    setPrompt("");
    setPlanResult(null);
    setApplyOutcome(null);
    setSelectedActionIds([]);
  };

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Lock className="mx-auto mb-3 text-amber-500" size={32} />
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Yetki Gerekli</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          AI Konfigürasyon Asistanı ekranına erişim yetkiniz bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === "error"
              ? "bg-rose-600 text-white border-rose-500"
              : "bg-slate-900 dark:bg-slate-800 text-white border-slate-700"
          }`}
        >
          {toast.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Üst Başlık & Komut Giriş Alanı */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${lightBg} ${text} border ${borderLight}`}>
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Konfigürasyon Asistanı
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lightBg} ${lightText} border ${borderLight}`}>
                  26 Modül • 78 Eylem
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dahili, ACD kuyruk, IVR akışı, TTS sesli anons, giden/gelen arama, bilgi bankası (RAG), QA, kampanya ve tüm santral ayarlarını tek komutla yönetin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            title="Yeni Konfigürasyon Komutu Başlat"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="relative">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Yapmak istediğiniz santral işlemini yazın veya dikte edin..."
              className={`w-full p-3.5 pr-14 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
            />
            <div className="absolute right-3 top-3">
              <DictationButton
                value={prompt}
                onChange={setPrompt}
                disabled={planning || applying}
                size={18}
                onError={(msg) => showToast(msg, "error")}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_COMMANDS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(item.prompt);
                    handleGeneratePlan(item.prompt);
                  }}
                  title={item.prompt}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:border-slate-400 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleGeneratePlan()}
              disabled={planning || applying}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-sm transition-all ${bg} ${hover} disabled:opacity-50`}
            >
              {planning ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span>{planning ? "Hazırlanıyor..." : "Plan Oluştur"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TASLAK PLAN ÖNİZLEME KARTI (DRY-RUN) */}
      {planResult && (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border-2 ${border} p-4 shadow-md space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${lightBg} ${lightText}`}>
                Önizleme
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {planResult.explanation}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlanResult(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Vazgeç
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={handleApplyPlan}
                  disabled={applying || selectedActionIds.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {applying ? <RefreshCw size={14} className="animate-spin" /> : <Check size={15} />}
                  <span>
                    {applying
                      ? "Uygulanıyor..."
                      : `Onayla ve Uygula (${selectedActionIds.length})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Çakışma Uyarıları */}
          {Array.isArray(planResult.warnings) && planResult.warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              {planResult.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Yetki Engelleri */}
          {Array.isArray(planResult.permission_blocks) && planResult.permission_blocks.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {planResult.permission_blocks.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Lock size={14} className="shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Aksiyon Listesi */}
          <div className="space-y-2">
            {(planResult.actions || []).map((act) => {
              const ActIcon = ACTION_ICONS[act.type] || Sparkles;
              const checked = selectedActionIds.includes(act.action_id);
              return (
                <div
                  key={act.action_id}
                  onClick={() => act.allowed && toggleActionSelection(act.action_id)}
                  className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all ${
                    !act.allowed
                      ? "opacity-60 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                      : checked
                      ? `${lightBg} ${border} cursor-pointer`
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-pointer"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={!act.allowed}
                      checked={checked}
                      onChange={() => {}}
                      className="mt-1 rounded border-slate-300"
                    />
                    <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                      <ActIcon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {act.type_label}
                        </span>
                        {!act.allowed && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                            Yetki Eksik
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 font-medium">
                        {act.summary}
                      </p>
                      {act.conflict_note && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                          ⚡ {act.conflict_note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uygulama Sonuç Özeti */}
      {applyOutcome && (
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={18} />
              İşlem Uygulandı
            </div>
            <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-0.5 pl-6 list-disc">
              {(applyOutcome.applied || []).map((it, idx) => (
                <li key={idx}>{it.summary}</li>
              ))}
            </ul>
            {Array.isArray(applyOutcome.warnings) && applyOutcome.warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/60 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                {applyOutcome.warnings.map((w, wIdx) => (
                  <div key={wIdx} className="flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {applyOutcome.snapshot_id && historyList.length > 0 && !historyList[0]?.reverted && (
            <button
              type="button"
              onClick={() => setUndoTarget(historyList[0])}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-rose-600 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw size={14} />
              Geri Al
            </button>
          )}
        </div>
      )}

      {/* İŞLEM GEÇMİŞİ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History size={16} className={text} />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              İşlem Geçmişi
            </h3>
          </div>
          {historyList.length > 0 && (
            <span className="text-xs text-slate-400">{historyList.length} kayıt</span>
          )}
        </div>

        {historyList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            Henüz uygulanmış bir işlem bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {historyList.map((snap) => (
              <div
                key={snap.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      &ldquo;{snap.prompt}&rdquo;
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {snap.created_at} • {snap.created_by}
                    </span>
                    {snap.reverted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                        Geri Alındı ({snap.reverted_at})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {(snap.applied_summaries || []).join(" • ")}
                  </div>
                </div>

                {canWrite && !snap.reverted && (
                  <button
                    type="button"
                    onClick={() => setUndoTarget(snap)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw size={13} />
                    Geri Al
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geri Alma Onay Modalı (Portal + GPU İzole Arkaplan) */}
      {undoTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-none"
              style={{ transform: "translateZ(0)" }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Konfigürasyon Paketini Geri Al
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bu işlem oluşturulan kayıtları siler ve ayarları işlem öncesi yedek noktasına döndürür.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-bold">Komut: &ldquo;{undoTarget.prompt}&rdquo;</div>
                <div>{(undoTarget.applied_summaries || []).join(" • ")}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUndoTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={undoLoading}
                  onClick={handleConfirmUndo}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                >
                  {undoLoading ? "Geri Alınıyor..." : "Evet, Geri Al"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
