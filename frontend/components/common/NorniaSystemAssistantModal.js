import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Sparkles,
  BookOpen,
  BarChart3,
  X,
  Send,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Compass,
  RotateCcw,
  UserPlus,
  GitBranch,
  Cable,
  Users,
  PhoneForwarded,
  Bot,
  Radio,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import DictationButton from "./DictationButton";
import AIConfigAssistantPanel from "../settings/AIConfigAssistantPanel";
import CustomReportBuilderPanel from "../reports/CustomReportBuilderPanel";

const QUICK_GUIDE_TOPICS = [
  {
    id: "users",
    icon: UserPlus,
    label: "Kullanıcı & Masa Telefonu Ekleme",
    question: "Yeni kullanıcı / dahili nasıl eklenir ve masa telefonu (SIP cihazı) nasıl tanımlanır?",
  },
  {
    id: "ivr",
    icon: GitBranch,
    label: "Gelen Arama & IVR Karşılama Menüsü",
    question: "Gelen aramalar için IVR karşılama menüsü ve mesai saati akışı nasıl kurulur?",
  },
  {
    id: "trunks",
    icon: Cable,
    label: "SIP Trunk & Gelen/Giden Kuralları",
    question: "Operatör SIP Trunk (0850 dış hat) nasıl tanımlanır ve gelen/giden arama kuralları nasıl ayarlanır?",
  },
  {
    id: "queues",
    icon: Users,
    label: "ACD Kuyruk & Çağrı Sonu Anketi",
    question: "Çağrı kuyruğu (ACD) nasıl oluşturulur, temsilci nasıl atanır ve çağrı sonu memnuniyet anketi nasıl açılır?",
  },
  {
    id: "forwarding",
    icon: PhoneForwarded,
    label: "Yönlendirme, Beni Takip Et & Kodlar (*8, *97)",
    question: "Abone çağrı yönlendirme (Her Zaman / Meşgulde / Cevapsızda), Beni Takip Et ve santral özellik kodları (*8, *97) nasıl kullanılır?",
  },
  {
    id: "ai_rag",
    icon: Bot,
    label: "Sesli AI Asistan & Bilgi Bankası (RAG)",
    question: "Sesli AI Temsilcisi senaryosu nasıl tasarlanır ve Bilgi Bankası (RAG) döküman/web sitesi ile nasıl eğitilir?",
  },
  {
    id: "realtime",
    icon: Radio,
    label: "Canlı Çağrı İzleme, Dinleme & Sufle",
    question: "Gerçek zamanlı çağrı izleme ekranından aktif çağrılar nasıl takip edilir ve gizli dinleme (Spy) / sufle (Whisper) nasıl yapılır?",
  },
  {
    id: "omnichannel",
    icon: MessageSquare,
    label: "WhatsApp, Instagram & Omnichannel",
    question: "WhatsApp, Instagram, Telegram ve E-Posta kanalları Ortak Gelen Kutusuna nasıl bağlanır?",
  },
];

const INITIAL_WELCOME_CARD = {
  id: "welcome-guide",
  role: "assistant",
  title: "Nornia Akıllı Sistem Rehberi'ne Hoş Geldiniz",
  summary:
    "Nornia içerisindeki tüm modüller hakkında soru sorabilir, bir işlemin adım adım nasıl yapılacağını öğrenebilir ya da üst sekmelerden doğrudan AI Konfigürasyon Asistanı ve Özel Rapor Tasarımcısı'nı kullanabilirsiniz.",
  menu_path: "Nornia Akıllı Merkez • 3'ü 1 Arada Yönetim & Rehber",
  steps: [
    "Aşağıdaki hızlı konu başlıklarından birine tıklayın veya merak ettiğiniz işlemi doğal dille yazın (Örn: 'Masa telefonu nasıl eklenir?', 'Kuyruk anketi nasıl açılır?', 'Kaç dahili tanımlı?').",
    "Adım adım rehberin altındaki 'İlgili Ekrana Git' butonuyla doğrudan o ayar sayfasına geçiş yapın.",
    "İşlemi kendiniz yapmak yerine yapay zekaya yaptırmak için 'AI Konfigürasyon Asistanı' sekmesini, özel grafik/tablo rapor üretmek için 'Özel Rapor Tasarımcısı' sekmesini kullanın.",
  ],
  tips: [
    "Sol üstteki Nornia logosuna veya yazısına istediğiniz ekrandayken tıklayarak bu pencereye her an ulaşabilirsiniz.",
  ],
  target_tab: "",
  target_label: "",
  suggested_config_prompt: "",
  suggested_report_prompt: "",
};

export default function NorniaSystemAssistantModal({
  isOpen,
  onClose,
  userPermissions = ["*"],
  onNavigateTab,
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [activeMode, setActiveMode] = useState("guide"); // "guide" | "config" | "reports"
  const [questionInput, setQuestionInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState([INITIAL_WELCOME_CARD]);
  const [transferredConfigPrompt, setTransferredConfigPrompt] = useState("");
  const [transferredReportPrompt, setTransferredReportPrompt] = useState("");

  const chatEndRef = useRef(null);

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

  const canUseConfigAssistant = useMemo(() => {
    return (
      resolvedPerms.includes("*") ||
      resolvedPerms.some((p) => String(p).startsWith("ai_config_assistant"))
    );
  }, [resolvedPerms]);

  const canUseReportBuilder = useMemo(() => {
    return (
      resolvedPerms.includes("*") ||
      resolvedPerms.includes("reports:access") ||
      resolvedPerms.some((p) => String(p).startsWith("reports_custom_builder"))
    );
  }, [resolvedPerms]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (activeMode === "guide" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, asking, activeMode]);

  if (!isOpen) return null;

  const askQuestion = async (rawQ) => {
    const q = String(rawQ || questionInput || "").trim();
    if (!q || asking) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      text: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestionInput("");
    setAsking(true);

    try {
      const res = await tenantFetch(`${API_BASE}/api/system-assistant/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.answer) {
        const ans = data.answer;
        setMessages((prev) => [
          ...prev,
          {
            id: `ans-${Date.now()}`,
            role: "assistant",
            title: ans.title || "Nornia Sistem Rehberi",
            summary: ans.summary || "",
            menu_path: ans.menu_path || "",
            steps: Array.isArray(ans.steps) ? ans.steps : [],
            tips: Array.isArray(ans.tips) ? ans.tips : [],
            target_tab: ans.target_tab || "",
            target_label: ans.target_label || "İlgili Ekrana Git",
            suggested_config_prompt: ans.suggested_config_prompt || "",
            suggested_report_prompt: ans.suggested_report_prompt || "",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            title: "Yanıt Alınamadı",
            summary:
              data?.detail ||
              "Sorunuz işlenirken geçici bir bağlantı sorunu oluştu. Lütfen tekrar deneyin.",
            menu_path: "",
            steps: [],
            tips: [],
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          title: "Sunucu Bağlantı Hatası",
          summary: "Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.",
          menu_path: "",
          steps: [],
          tips: [],
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleResetGuide = () => {
    setMessages([INITIAL_WELCOME_CARD]);
    setQuestionInput("");
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Top Header & 3-Tab Segmented Switcher */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-center shrink-0">
              <img src="/favicon.svg" alt="Nornia" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-base font-black tracking-tight bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Nornia Akıllı Merkez
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}
                >
                  AI Copilot & Rehber
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sistem kullanım rehberi, doğal dille otomatik santral yapılandırma ve özel rapor tasarım merkezi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Mode Tabs */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/90 border border-slate-300/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveMode("guide")}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeMode === "guide"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <BookOpen size={14} />
                <span>Sistem Rehberi & Soru Sor</span>
              </button>

              {canUseConfigAssistant && (
                <button
                  type="button"
                  onClick={() => setActiveMode("config")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeMode === "config"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Sparkles size={14} />
                  <span>AI Konfigürasyon Asistanı</span>
                </button>
              )}

              {canUseReportBuilder && (
                <button
                  type="button"
                  onClick={() => setActiveMode("reports")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeMode === "reports"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>Özel Rapor Tasarımcısı</span>
                </button>
              )}
            </div>

            {activeMode === "guide" && messages.length > 1 && (
              <button
                type="button"
                onClick={handleResetGuide}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sohbeti Temizle"
              >
                <RotateCcw size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Kapat (ESC)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body Content by Mode */}
        {activeMode === "guide" ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Quick Topic Chips Bar */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Compass size={12} className={text} />
                <span>Hızlı Rehber Konuları (Tek Tıkla Öğrenin)</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {QUICK_GUIDE_TOPICS.map((topic) => {
                  const TopicIcon = topic.icon;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      disabled={asking}
                      onClick={() => askQuestion(topic.question)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <TopicIcon size={13} className={text} />
                      <span>{topic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Messages / Guide Cards Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
              {messages.map((m) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className={`max-w-2xl px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs font-bold text-white shadow-sm ${bg}`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${lightBg} ${text} border ${borderLight} shrink-0`}
                        >
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {m.title}
                          </h3>
                          {m.menu_path && (
                            <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <Compass size={11} className={text} />
                              <span>Menü Yolu: {m.menu_path}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    {m.summary && (
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                        {m.summary}
                      </p>
                    )}

                    {/* Numbered Steps */}
                    {Array.isArray(m.steps) && m.steps.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Adım Adım Uygulama Rehberi
                        </div>
                        <div className="space-y-2">
                          {m.steps.map((stepText, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/60 dark:border-slate-800/80"
                            >
                              <span
                                className={`w-5 h-5 rounded-lg ${bg} text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5`}
                              >
                                {sIdx + 1}
                              </span>
                              <span className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                                {stepText}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    {Array.isArray(m.tips) && m.tips.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                          <Lightbulb size={13} />
                          <span>Pratik İpucu</span>
                        </div>
                        {m.tips.map((tipText, tIdx) => (
                          <p
                            key={tIdx}
                            className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed"
                          >
                            • {tipText}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Action Shortcuts */}
                    {(m.target_tab ||
                      (m.suggested_config_prompt && canUseConfigAssistant) ||
                      (m.suggested_report_prompt && canUseReportBuilder)) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                        {m.target_tab && onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => {
                              onNavigateTab(m.target_tab);
                              onClose?.();
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer`}
                          >
                            <span>{m.target_label || "İlgili Ekrana Git"}</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {m.suggested_config_prompt && canUseConfigAssistant && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferredConfigPrompt(m.suggested_config_prompt);
                              setActiveMode("config");
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border ${borderLight} ${lightBg} ${text} flex items-center gap-1.5 transition-colors cursor-pointer`}
                          >
                            <Sparkles size={13} />
                            <span>AI Konfigürasyon Asistanı ile Otomatik Yap</span>
                          </button>
                        )}

                        {m.suggested_report_prompt && canUseReportBuilder && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferredReportPrompt(m.suggested_report_prompt);
                              setActiveMode("reports");
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-extrabold border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <BarChart3 size={13} />
                            <span>Özel Rapor Tasarımcısında Aç</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {asking && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <div className={`w-2.5 h-2.5 rounded-full ${bg} animate-ping`} />
                  <span>Nornia Sistem Asistanı yanıtınızı hazırlıyor...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Bottom Question Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                askQuestion(questionInput);
              }}
              className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5 shrink-0"
            >
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Sistem hakkında bir soru sorun veya nasıl yapılacağını yazın (Örn: Masa telefonu nasıl tanımlanır, Kuyruk nasıl kurulur?)..."
                className={`flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
              />
              <DictationButton
                onTranscript={(txt) =>
                  setQuestionInput((prev) => (prev ? `${prev} ${txt}` : txt))
                }
              />
              <button
                type="submit"
                disabled={asking || !questionInput.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50`}
              >
                <Send size={14} />
                <span>Sor</span>
              </button>
            </form>
          </div>
        ) : activeMode === "config" ? (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-950/40">
            <AIConfigAssistantPanel
              userPermissions={userPermissions}
              initialPrompt={transferredConfigPrompt}
              onNavigateTab={(tab) => {
                onNavigateTab?.(tab);
                onClose?.();
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-950/40">
            <CustomReportBuilderPanel
              userPermissions={userPermissions}
              initialAiPrompt={transferredReportPrompt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
