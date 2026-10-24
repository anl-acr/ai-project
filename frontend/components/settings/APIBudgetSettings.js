import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  DollarSign,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  CreditCard,
  Activity,
  Volume2,
  MessageSquare,
  Cpu,
  Mic,
  AlertTriangle,
  Sliders,
  RotateCcw,
  Clock,
  ShieldAlert,
  Bot,
  X,
  Check
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const PROVIDERS_META = [
  {
    key: "google",
    name: "Google Gemini (Live Ses, LLM, STT & TTS)",
    shortName: "Google Gemini",
    desc: "Gemini Multimodal Live sesli asistan, çağrı özetleme, duygu analizi, QA kalite kontrol ve RAG vektör indeksleme.",
    icon: Sparkles,
    category: "Ana Yapay Zeka & Ses Motoru",
    unitHint: "~$0.022 / dk ses + ~$0.35 / 1M token"
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs (Conversational AI & Premium TTS)",
    shortName: "ElevenLabs TTS",
    desc: "Ultra-gerçekçi Türkçe ses sentezi (Text-to-Speech), klonlanmış kurumsal sesler ve akıcı diyalog seslendirmesi.",
    icon: Volume2,
    category: "Premium Ses Sentezi (TTS)",
    unitHint: "~$0.18 / 1.000 karakter (~$0.09 / dk)"
  },
  {
    key: "whatsapp",
    name: "Meta WhatsApp Cloud API (0850 İşletme Hattı)",
    shortName: "WhatsApp Cloud API",
    desc: "WhatsApp kurumsal mesajlaşma, kaçan çağrı otomatik yanıtlayıcı, etkileşimli menüler ve toplu kampanya gönderimleri.",
    icon: MessageSquare,
    category: "Omnichannel Mesajlaşma",
    unitHint: "~$0.0085 / giden oturum mesajı"
  },
  {
    key: "openai",
    name: "OpenAI (GPT-4o, Whisper STT & TTS)",
    shortName: "OpenAI GPT-4o",
    desc: "GPT-4o dil modelleri, Whisper konuşma tanıma (STT) ve alternatif sesli asistan entegrasyonu.",
    icon: Bot,
    category: "Alternatif LLM & STT",
    unitHint: "~$0.03 / dk + ~$2.50 / 1M token"
  },
  {
    key: "anthropic",
    name: "Anthropic (Claude 3.5 Sonnet / Haiku)",
    shortName: "Anthropic Claude",
    desc: "İleri düzey mantıksal akıl yürütme, karmaşık senaryo yönetimi ve kurumsal metin analitiği.",
    icon: Cpu,
    category: "Alternatif LLM",
    unitHint: "~$3.00 / 1M token"
  },
  {
    key: "groq",
    name: "Groq (LPU Ultra-Hızlı Llama 3 Inference)",
    shortName: "Groq LPU",
    desc: "Milisaniye seviyesinde düşük gecikmeli açık kaynak LLM (Llama 3) gerçek zamanlı yanıt üretimi.",
    icon: Activity,
    category: "Hızlı Çıkarım (Inference)",
    unitHint: "~$0.59 / 1M token"
  },
  {
    key: "deepgram",
    name: "Deepgram (Nova-2 Gerçek Zamanlı STT)",
    shortName: "Deepgram STT",
    desc: "Yüksek doğruluklu ve düşük gecikmeli gerçek zamanlı Türkçe ses-metin (Speech-to-Text) dönüştürme servisi.",
    icon: Mic,
    category: "Konuşma Tanıma (STT)",
    unitHint: "~$0.0059 / dk ses"
  }
];

export default function APIBudgetSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [hasWritePermission, setHasWritePermission] = useState(true);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "active" | "critical"

  // Modal states
  const [addModalProvider, setAddModalProvider] = useState(null);
  const [addAmount, setAddAmount] = useState("25");

  const [editModalProvider, setEditModalProvider] = useState(null);
  const [editLoadedCredit, setEditLoadedCredit] = useState("0");
  const [editSpentCredit, setEditSpentCredit] = useState("0");
  const [editAlertThreshold, setEditAlertThreshold] = useState(80);

  const [resetConfirmProvider, setResetConfirmProvider] = useState(null);

  const getProtocol = () =>
    typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";

  const showToast = (type, message) => {
    setStatusMsg({ type, text: message });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const fetchBudgets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const protocol = getProtocol();
      const res = await fetch(`${protocol}//${backendHost}/api/settings/api-budgets?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setBudgets(data || {});
      }
    } catch (err) {
      console.error("API budgets fetch error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();

    const checkPermissions = async () => {
      try {
        const savedUserId =
          typeof window !== "undefined"
            ? localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id")
            : null;
        if (!savedUserId || savedUserId === "admin") {
          setHasWritePermission(true);
          return;
        }
        const protocol = getProtocol();
        const [usersRes, rolesRes] = await Promise.all([
          fetch(`${protocol}//${backendHost}/api/settings/users`),
          fetch(`${protocol}//${backendHost}/api/settings/roles`)
        ]);
        if (usersRes.ok && rolesRes.ok) {
          const usersData = await usersRes.json();
          const rolesData = await rolesRes.json();
          const currentUser = (usersData || []).find(
            (u) => String(u.id) === String(savedUserId) || String(u.extension) === String(savedUserId)
          );
          if (!currentUser || currentUser.role === "admin" || currentUser.role === "superadmin") {
            setHasWritePermission(true);
            return;
          }
          const userRole = (rolesData || []).find((r) => r.role_code === currentUser.role);
          const perms = userRole?.permissions || [];
          const canWrite =
            perms.includes("api_budgets:write") ||
            perms.includes("api_budgets:access") ||
            perms.includes("api_budgets:read");
          setHasWritePermission(canWrite);
        }
      } catch (err) {
        setHasWritePermission(true);
      }
    };

    checkPermissions();

    const interval = setInterval(() => {
      fetchBudgets(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [backendHost]);

  const enrichedProviders = useMemo(() => {
    return PROVIDERS_META.map((meta) => {
      const b = budgets[meta.key] || {};
      const loaded = Number(b.loaded_credit || 0);
      const spentExact = Number(b.spent_credit_exact ?? b.spent_credit ?? 0);
      const spent = Number(b.spent_credit ?? 0);
      const remaining = loaded > 0 ? Math.max(0, loaded - spentExact) : 0;
      const threshold = Number(b.alert_threshold || 80);
      const rawPct = loaded > 0 ? (spentExact / loaded) * 100 : spentExact > 0 ? 100 : 0;
      const usagePct = Math.min(100, Math.round(rawPct * 10) / 10);

      const isDepleted = loaded > 0 && remaining <= 0.001;
      const isCritical = loaded > 0 && !isDepleted && rawPct >= threshold;
      const isUnbudgetedUsage = loaded <= 0 && spentExact > 0;
      const isActive =
        Boolean(b.configured) ||
        Boolean(b.api_key_defined) ||
        loaded > 0 ||
        spentExact > 0 ||
        (b.active_agents && b.active_agents.length > 0);

      return {
        ...meta,
        loaded,
        spent,
        spentExact,
        remaining,
        threshold,
        rawPct,
        usagePct,
        isDepleted,
        isCritical,
        isUnbudgetedUsage,
        isActive,
        configured: Boolean(b.configured),
        apiKeyDefined: Boolean(b.api_key_defined),
        activeAgents: Array.isArray(b.active_agents) ? b.active_agents : [],
        dailyBurnRate: Number(b.daily_burn_rate || 0),
        estimatedDaysLeft: Number(b.estimated_days_left ?? 999),
        lastUpdated: b.last_updated || null,
        metrics: b.metrics || {},
        breakdown: Array.isArray(b.breakdown) ? b.breakdown : []
      };
    });
  }, [budgets]);

  const summary = useMemo(() => {
    let totalLoaded = 0;
    let totalSpent = 0;
    let totalRemaining = 0;
    let totalDailyBurn = 0;
    let totalCalls = 0;
    let totalAudioMinutes = 0;
    let totalTokens = 0;
    const criticalServices = [];
    const depletedServices = [];

    enrichedProviders.forEach((p) => {
      totalLoaded += p.loaded;
      totalSpent += p.spentExact;
      totalRemaining += p.remaining;
      totalDailyBurn += p.dailyBurnRate;
      if (p.key === "google") {
        totalCalls += Number(p.metrics.call_count || 0);
        totalAudioMinutes += Number(p.metrics.audio_minutes || 0);
      }
      totalTokens += Number(p.metrics.estimated_tokens || 0);

      if (p.isDepleted) {
        depletedServices.push(p);
      } else if (p.isCritical || p.isUnbudgetedUsage) {
        criticalServices.push(p);
      }
    });

    const overallPct =
      totalLoaded > 0 ? Math.min(100, Math.round((totalSpent / totalLoaded) * 1000) / 10) : 0;

    return {
      totalLoaded,
      totalSpent,
      totalRemaining,
      totalDailyBurn,
      totalCalls,
      totalAudioMinutes,
      totalTokens,
      overallPct,
      criticalServices,
      depletedServices,
      alertCount: depletedServices.length + criticalServices.length
    };
  }, [enrichedProviders]);

  const filteredProviders = useMemo(() => {
    if (filterMode === "active") {
      return enrichedProviders.filter((p) => p.isActive);
    }
    if (filterMode === "critical") {
      return enrichedProviders.filter((p) => p.isDepleted || p.isCritical || p.isUnbudgetedUsage);
    }
    return enrichedProviders;
  }, [enrichedProviders, filterMode]);

  const handleOpenAddModal = (prov) => {
    setAddModalProvider(prov);
    setAddAmount("25");
  };

  const handleConfirmAddCredit = async () => {
    if (!addModalProvider) return;
    const val = parseFloat(addAmount);
    if (isNaN(val) || val <= 0) {
      showToast("error", "Lütfen geçerli bir yükleme tutarı girin.");
      return;
    }
    setSaving(true);
    try {
      const protocol = getProtocol();
      const res = await fetch(`${protocol}//${backendHost}/api/settings/api-budgets/service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: addModalProvider.key,
          action: "add_credit",
          add_amount: val
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setBudgets(updated);
        showToast("success", `${addModalProvider.shortName} paketine +$${val.toFixed(2)} bakiye eklendi.`);
        setAddModalProvider(null);
      } else {
        showToast("error", "Bakiye eklenirken bir hata oluştu.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (prov) => {
    setEditModalProvider(prov);
    setEditLoadedCredit(String(prov.loaded.toFixed(2)));
    setEditSpentCredit(String(prov.spentExact.toFixed(2)));
    setEditAlertThreshold(prov.threshold || 80);
  };

  const handleConfirmEditBudget = async () => {
    if (!editModalProvider) return;
    const loadedVal = parseFloat(editLoadedCredit);
    const spentVal = parseFloat(editSpentCredit);
    if (isNaN(loadedVal) || loadedVal < 0 || isNaN(spentVal) || spentVal < 0) {
      showToast("error", "Lütfen geçerli bütçe ve tüketim değerleri girin.");
      return;
    }
    setSaving(true);
    try {
      const protocol = getProtocol();
      const res = await fetch(`${protocol}//${backendHost}/api/settings/api-budgets/service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: editModalProvider.key,
          action: "set_budget",
          loaded_credit: loadedVal,
          spent_credit: spentVal,
          alert_threshold: Number(editAlertThreshold)
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setBudgets(updated);
        showToast("success", `${editModalProvider.shortName} paket bütçesi ve alarm eşiği güncellendi.`);
        setEditModalProvider(null);
      } else {
        showToast("error", "Bütçe güncellenemedi.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmResetSpent = async () => {
    if (!resetConfirmProvider) return;
    setSaving(true);
    try {
      const protocol = getProtocol();
      const res = await fetch(`${protocol}//${backendHost}/api/settings/api-budgets/service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: resetConfirmProvider.key,
          action: "reset_spent"
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setBudgets(updated);
        showToast("success", `${resetConfirmProvider.shortName} dönem tüketimi $0.00 olarak sıfırlandı.`);
        setResetConfirmProvider(null);
      } else {
        showToast("error", "Tüketim sıfırlanamadı.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  };

  const formatSpendDisplay = (exactVal) => {
    const num = Number(exactVal || 0);
    if (num === 0) return "$0.00";
    if (num < 0.01) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className={`w-8 h-8 border-4 ${border} border-t-transparent rounded-full animate-spin`} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Servis Tüketim Verileri ve Paket Bakiyeleri Hesaplanıyor...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${lightBg} ${text} border ${borderLight} shadow-sm`}>
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                API Bütçe ve Servis Tüketim Panosu
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Canlı Takip
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hangi yapay zeka ve iletişim servisini ne kadar kullandığınızı, kalan paket bakiyelerinizi ve kritik tükenme uyarılarını anlık takip edin.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === "all"
                  ? `${bg} text-white shadow-sm`
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Tüm Servisler ({enrichedProviders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === "active"
                  ? `${bg} text-white shadow-sm`
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Aktif Kullanılanlar ({enrichedProviders.filter((p) => p.isActive).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("critical")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === "critical"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>Kritik / Uyarı</span>
              {summary.alertCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                  {summary.alertCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Toast Notification */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === "success"
              ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Critical Package Depletion Warning Banner */}
      {(summary.depletedServices.length > 0 || summary.criticalServices.length > 0) && (
        <div
          className={`p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            summary.depletedServices.length > 0
              ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80"
              : "bg-amber-50/90 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/80"
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                summary.depletedServices.length > 0
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-amber-500 text-white"
              }`}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4
                className={`text-sm font-extrabold uppercase tracking-wide ${
                  summary.depletedServices.length > 0
                    ? "text-rose-800 dark:text-rose-300"
                    : "text-amber-800 dark:text-amber-300"
                }`}
              >
                {summary.depletedServices.length > 0
                  ? "KRİTİK UYARI: Paket Bakiyesi Tükenen Servisler Var — Sistem Durmadan Önlem Alın!"
                  : "DİKKAT: Kritik Tüketim Eşiğine Ulaşan Servisleriniz Var"}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {summary.depletedServices.length > 0 && (
                  <span className="font-bold text-rose-700 dark:text-rose-400 mr-2">
                    Paketi Bitenler:{" "}
                    {summary.depletedServices.map((s) => `${s.shortName} (Kalan: $0.00)`).join(", ")}.
                  </span>
                )}
                {summary.criticalServices.length > 0 && (
                  <span>
                    Dikkat Gerektirenler:{" "}
                    {summary.criticalServices
                      .map((s) =>
                        s.isUnbudgetedUsage
                          ? `${s.shortName} (Paket Tanımsız - Harcanan: ${formatSpendDisplay(s.spentExact)})`
                          : `${s.shortName} (%${s.usagePct} kullanıldı)`
                      )
                      .join(", ")}
                    . Çağrı ve mesajlaşma trafiğinin kesintiye uğramaması için ilgili servislere bakiye yüklemesi yapabilirsiniz.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Toplam Yüklenen Paket Bütçesi */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Toplam Paket Bütçesi
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              ${summary.totalLoaded.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              {enrichedProviders.filter((p) => p.loaded > 0).length} serviste paket tanımlı
            </span>
          </div>
          <div className={`p-3.5 rounded-2xl ${lightBg} ${text} border ${borderLight}`}>
            <CreditCard size={22} />
          </div>
        </div>

        {/* Card 2: Toplam Harcanan Tutar */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Toplam Harcanan Tüketim
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {formatSpendDisplay(summary.totalSpent)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Günlük Ort. ~${summary.totalDailyBurn.toFixed(3)} / gün
            </span>
          </div>
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200/50 dark:border-rose-800/40">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Card 3: Kalan Toplam Bakiye */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Kalan Kullanılabilir Bakiye
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ${summary.totalRemaining.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Genel Bütçe Kullanımı: %{summary.overallPct}
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/40">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Card 4: Toplam İşlenen Ses & Token Hacmi */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Toplam İşlenen AI Trafiği
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {summary.totalCalls} Çağrı ({summary.totalAudioMinutes.toFixed(1)} dk)
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              ~{summary.totalTokens.toLocaleString("tr-TR")} Toplam Token
            </span>
          </div>
          <div className={`p-3.5 rounded-2xl ${lightBg} ${text} border ${borderLight}`}>
            <Sparkles size={22} />
          </div>
        </div>
      </div>

      {/* Per-Service Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProviders.map((prov) => {
          const IconComponent = prov.icon || Database;

          let statusBadge = {
            label: "Normal • Paket Aktif",
            cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          };
          if (prov.isDepleted) {
            statusBadge = {
              label: "PAKET BİTTİ! ACİL YÜKLEME GEREKLİ",
              cls: "bg-rose-600 text-white border-rose-600 animate-pulse"
            };
          } else if (prov.isCritical) {
            statusBadge = {
              label: `KRİTİK SEVİYE (%${prov.usagePct} DOLDU)`,
              cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
            };
          } else if (prov.isUnbudgetedUsage) {
            statusBadge = {
              label: "AÇIK TÜKETİM (PAKET LİMİTİ TANIMSIZ)",
              cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
            };
          } else if (prov.loaded === 0 && prov.spentExact === 0) {
            statusBadge = {
              label: "Henüz Tüketim Yok",
              cls: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            };
          }

          return (
            <div
              key={prov.key}
              className={`p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm flex flex-col justify-between gap-5 transition-all ${
                prov.isDepleted
                  ? "border-rose-400 dark:border-rose-700 ring-2 ring-rose-500/20"
                  : prov.isCritical
                  ? "border-amber-300 dark:border-amber-700/80"
                  : "border-slate-200/80 dark:border-slate-800"
              }`}
            >
              {/* Top Section: Service Header & Action Buttons */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`p-3 rounded-2xl shrink-0 border ${
                        prov.isDepleted
                          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                          : `${lightBg} ${text} ${borderLight}`
                      }`}
                    >
                      <IconComponent size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {prov.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {prov.desc}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            prov.apiKeyDefined
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {prov.apiKeyDefined ? "API Anahtarı Tanımlı" : "API Anahtarı Tanımsız"}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
                          {prov.unitHint}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions: Unified + Button, Edit Button, Reset Button */}
                  {hasWritePermission && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(prov)}
                        title="Paket Bütçesi ve Alarm Eşiğini Düzenle"
                        className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Sliders size={13} />
                        <span className="hidden sm:inline">Düzenle</span>
                      </button>

                      {prov.spentExact > 0 && (
                        <button
                          type="button"
                          onClick={() => setResetConfirmProvider(prov)}
                          title="Dönem Tüketimini Sıfırla ($0.00)"
                          className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center justify-center transition-all"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}

                      {/* Unified Add Button Rule: bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(prov)}
                        title={`${prov.shortName} İçin Bakiye / Paket Yükle`}
                        className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Financial Numbers Box */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50/90 dark:bg-slate-950/50 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Paket Bütçesi
                    </span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
                      ${prov.loaded.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Kullanılan Tutar
                    </span>
                    <span
                      className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 block"
                      title={`Tam Tüketim: $${prov.spentExact.toFixed(4)}`}
                    >
                      {formatSpendDisplay(prov.spentExact)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Kalan Bakiye
                    </span>
                    <span
                      className={`text-base font-black mt-0.5 block ${
                        prov.isDepleted
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      ${prov.remaining.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Depletion Forecast */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span
                      className={
                        prov.isDepleted || prov.isCritical
                          ? "text-rose-600 dark:text-rose-400 flex items-center gap-1"
                          : "text-slate-600 dark:text-slate-400"
                      }
                    >
                      {(prov.isDepleted || prov.isCritical) && <AlertCircle size={13} />}
                      {prov.loaded > 0
                        ? `Paket Tüketim Oranı: %${prov.usagePct} (Uyarı Eşiği: %${prov.threshold})`
                        : prov.spentExact > 0
                        ? `Paket Bütçesi Tanımlanmadı • Açık Tüketim: ${formatSpendDisplay(prov.spentExact)}`
                        : "Paket Bütçesi Tanımlanmadı"}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      {prov.loaded > 0 && prov.isDepleted
                        ? "Bakiye Tükendi (0 Gün)"
                        : prov.loaded > 0 && prov.estimatedDaysLeft < 999
                        ? `Tahmini ~${prov.estimatedDaysLeft} Gün Yeterli`
                        : prov.dailyBurnRate > 0
                        ? `Günlük ~${formatSpendDisplay(prov.dailyBurnRate)}/gün`
                        : "Tüketim Yok"}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        prov.isDepleted || prov.rawPct >= 90
                          ? "bg-gradient-to-r from-rose-500 to-red-600"
                          : prov.isCritical || prov.rawPct >= 75
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500"
                      }`}
                      style={{ width: `${prov.usagePct}%` }}
                    />
                  </div>
                </div>

                {/* Detailed Service Usage Breakdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Detaylı Servis Kullanım Dökümü
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {prov.breakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          {item.label}
                        </span>
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 shrink-0">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active AI Agents using this service */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                    Kullanan Birimler:
                  </span>
                  {prov.activeAgents.length > 0 ? (
                    prov.activeAgents.map((agName, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}
                      >
                        {agName}
                      </span>
                    ))
                  ) : prov.key === "whatsapp" ? (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
                      Ortak Gelen Kutusu & Otomatik Yanıtlayıcı
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">
                      Aktif AI temsilcisine atanmamış
                    </span>
                  )}
                </div>
                {prov.lastUpdated && (
                  <span className="text-[10px] text-slate-400">
                    Son işlem: {prov.lastUpdated}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Service Consumption Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Tüm Servislerin Karşılaştırmalı Tüketim ve Kapasite Özeti
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Servis bazında çağrı, ses dakikası, token/mesaj hacmi ve paket yeterlilik süreleri
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-5">Servis / Sağlayıcı</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4">Görüşme / Süre</th>
                <th className="py-3 px-4">Token / Karakter / Mesaj</th>
                <th className="py-3 px-4">Yüklenen Paket</th>
                <th className="py-3 px-4">Harcanan</th>
                <th className="py-3 px-4">Kalan Bakiye</th>
                <th className="py-3 px-5 text-right">Tahmini Süre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {enrichedProviders.map((p) => (
                <tr
                  key={p.key}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">
                    {p.shortName}
                    <span className="block text-[10px] font-normal text-slate-400">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {p.isDepleted ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                        Paket Bitti
                      </span>
                    ) : p.isCritical ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        Kritik (%{p.usagePct})
                      </span>
                    ) : p.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                    {p.key === "whatsapp"
                      ? `${p.metrics.chat_sessions || 0} Oturum`
                      : `${p.metrics.call_count || 0} Çağrı (${p.metrics.audio_minutes || 0} dk)`}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                    {p.key === "whatsapp"
                      ? `${p.metrics.chat_messages || 0} Mesaj`
                      : p.key === "elevenlabs"
                      ? `${(p.metrics.total_chars || 0).toLocaleString("tr-TR")} Karakter`
                      : `${(p.metrics.estimated_tokens || 0).toLocaleString("tr-TR")} Token`}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                    ${p.loaded.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                    {formatSpendDisplay(p.spentExact)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                    ${p.remaining.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5 text-right font-bold text-slate-600 dark:text-slate-300">
                    {p.loaded > 0 && p.isDepleted
                      ? "Tükendi (0 Gün)"
                      : p.loaded > 0 && p.estimatedDaysLeft < 999
                      ? `~${p.estimatedDaysLeft} Gün`
                      : p.loaded > 0
                      ? "Yeterli"
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Quick Add Credit (+ Bakiye Yükle) */}
      {addModalProvider && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Plus size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {addModalProvider.shortName} — Bakiye Yükle
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mevcut Paket Bütçesi: ${addModalProvider.loaded.toFixed(2)} (Kalan: $
                    {addModalProvider.remaining.toFixed(2)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalProvider(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Hızlı Paket Seçimi ($)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["10", "25", "50", "100"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAddAmount(preset)}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                      addAmount === preset
                        ? `${bg} text-white border-transparent shadow-sm`
                        : "bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    +${preset}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Eklenecek Tutar ($ USD)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddModalProvider(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmAddCredit}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={15} />
                <span>Pakete Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Budget, Spent Credit & Alert Threshold */}
      {editModalProvider && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                  <Sliders size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {editModalProvider.shortName} — Bütçe & Eşik Ayarları
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paket toplam limitini, mevcut harcamayı ve uyarı eşiğini yapılandırın.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalProvider(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Toplam Yüklenen Paket Bütçesi ($ USD)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editLoadedCredit}
                  onChange={(e) => setEditLoadedCredit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mevcut Harcanan Tutar ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editSpentCredit}
                  onChange={(e) => setEditSpentCredit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Yeni çağrı ve mesaj tüketimleri bu tutarın üzerine otomatik eklenmeye devam eder.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kritik Uyarı Alarm Eşiği (%)
                  </label>
                  <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                    %{editAlertThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={editAlertThreshold}
                  onChange={(e) => setEditAlertThreshold(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Paket tüketimi %{editAlertThreshold} seviyesine ulaştığında üstte kritik uyarı gösterilir.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditModalProvider(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmEditBudget}
                className={`px-5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 disabled:opacity-50`}
              >
                <Check size={15} />
                <span>Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Custom Reset Confirmation Modal (Per AGENTS.md Custom Modal Rule) */}
      {resetConfirmProvider && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 animate-pulse">
              <ShieldAlert size={28} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                Dönem Tüketimini Sıfırla
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-200">
                  {resetConfirmProvider.shortName}
                </strong>{" "}
                servisinin mevcut{" "}
                <strong className="text-rose-600 dark:text-rose-400">
                  {formatSpendDisplay(resetConfirmProvider.spentExact)}
                </strong>{" "}
                tutarındaki tüketim sayacını <strong>$0.00</strong> olarak sıfırlamak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmProvider(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmResetSpent}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-md transition-all disabled:opacity-50"
              >
                Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
