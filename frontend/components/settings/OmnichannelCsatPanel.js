import React, { useState, useEffect, useCallback } from "react";
import {
  Star,
  MessageSquare,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Bot,
  User,
  BellRing,
  BarChart3,
  Clock,
  Sliders
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const CHANNEL_META = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "instagram", label: "Instagram DM" },
  { id: "facebook", label: "Facebook Messenger" },
  { id: "mail", label: "E-Posta" }
];

export default function OmnichannelCsatPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"]
}) {
  const { bg, hover, text, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const canWrite =
    userPermissions.includes("*") ||
    userPermissions.includes("omnichannel_csat:write") ||
    userPermissions.includes("channels:write");

  const [activeTab, setActiveTab] = useState("stats"); // stats | config
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [config, setConfig] = useState({
    enabled: true,
    trigger_on_close: true,
    cooldown_hours: 24,
    channels: ["whatsapp", "telegram", "instagram", "facebook", "mail"],
    question_text:
      "Görüşmemizi nasıl değerlendirirsiniz? Geri bildiriminiz hizmet kalitemizi artırmamıza yardımcı olur.",
    low_score_followup_enabled: true,
    low_score_followup_text:
      "Yaşadığınız aksaklık için üzgünüz. İyileştirebilmemiz için kısaca nedenini yazar mısınız?",
    thank_you_text:
      "Değerlendirmeniz için çok teşekkür ederiz! Size tekrar yardımcı olmaktan mutluluk duyarız.",
    supervisor_alert_threshold: 2,
    public_base_url: ""
  });

  const [stats, setStats] = useState({
    summary: {
      total_sent: 0,
      total_responded: 0,
      response_rate: 0,
      avg_score: 0,
      positive_pct: 0,
      low_score_count: 0
    },
    ai_vs_human: { ai_count: 0, ai_avg: 0, human_count: 0, human_avg: 0 },
    channel_breakdown: [],
    agent_breakdown: [],
    recent: []
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, stRes] = await Promise.all([
        tenantFetch(`${API_BASE}/api/settings/omnichannel-csat`),
        tenantFetch(`${API_BASE}/api/omnichannel/csat/stats?days=${days}`)
      ]);
      if (cfgRes.ok) {
        const c = await cfgRes.json();
        setConfig((prev) => ({ ...prev, ...c }));
      }
      if (stRes.ok) {
        const s = await stRes.json();
        setStats(s);
      }
    } catch (err) {
      console.error("[Omnichannel CSAT] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setFeedback({ type: "", message: "" });
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/omnichannel-csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: "success", message: data.message || "CSAT ayarları kaydedildi." });
        setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
      } else {
        setFeedback({ type: "error", message: data.detail || "Kaydedilemedi." });
      }
    } catch {
      setFeedback({ type: "error", message: "Sunucuya bağlanılamadı." });
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (chId) => {
    if (!canWrite) return;
    setConfig((prev) => {
      const curr = Array.isArray(prev.channels) ? prev.channels : [];
      const next = curr.includes(chId) ? curr.filter((x) => x !== chId) : [...curr, chId];
      return { ...prev, channels: next };
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-xl shrink-0 ${lightBg} ${lightText} border ${borderLight}`}>
            <Star size={22} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Omnichannel Memnuniyet Anketi (CSAT)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${lightText} border ${borderLight}`}>
                {config.enabled ? "Aktif" : "Pasif"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              WhatsApp etkileşimli butonları, Telegram InlineKeyboard, Instagram/Facebook Quick Reply ve E-Posta tek tık puanlama ile görüşme kapandığında otomatik memnuniyet ölçümü ve düşük puan süpervizör alarmı.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === "stats"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <BarChart3 size={14} />
            <span>Rapor & Skorlar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === "config"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Sliders size={14} />
            <span>Anket Ayarları</span>
          </button>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-5">
          {/* Period Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    days === d
                      ? `${lightBg} ${lightText} ${borderLight}`
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  Son {d} Gün
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Yenile</span>
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Ortalama CSAT</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black ${text}`}>{stats.summary.avg_score || "0.0"}</span>
                <span className="text-xs font-bold text-slate-400">/ 5.0</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Olumlu Oran: %{stats.summary.positive_pct}</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Katılım Oranı</div>
              <div className="mt-1.5 text-2xl font-black text-slate-900 dark:text-white">
                %{stats.summary.response_rate}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {stats.summary.total_responded} / {stats.summary.total_sent} anket yanıtlandı
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase">AI vs İnsan Temsilci</div>
              <div className="mt-1.5 flex items-center gap-4 text-sm font-black text-slate-900 dark:text-white">
                <span className="flex items-center gap-1">
                  <Bot size={14} className={text} /> {stats.ai_vs_human.ai_avg}
                </span>
                <span className="flex items-center gap-1">
                  <User size={14} className="text-slate-500" /> {stats.ai_vs_human.human_avg}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                AI: {stats.ai_vs_human.ai_count} • İnsan: {stats.ai_vs_human.human_count}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <BellRing size={12} className="text-rose-500" /> Düşük Puan Alarmı
              </div>
              <div className="mt-1.5 text-2xl font-black text-rose-600 dark:text-rose-400">
                {stats.summary.low_score_count}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">≤ {config.supervisor_alert_threshold} puan değerlendirme</div>
            </div>
          </div>

          {/* Channel & Agent Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">
                Kanal Bazlı CSAT Dağılımı
              </h4>
              {stats.channel_breakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Henüz anket verisi oluşmadı.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.channel_breakdown.map((ch) => (
                    <div
                      key={ch.channel}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <span className="font-bold uppercase text-slate-700 dark:text-slate-200">{ch.channel}</span>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-slate-500">
                          {ch.responded}/{ch.sent} (%{ch.response_rate})
                        </span>
                        <span className={`font-black ${text}`}>{ch.avg_score} ★</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">
                Temsilci & AI Memnuniyet Karnesi
              </h4>
              {stats.agent_breakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Henüz yanıtlanmış anket yok.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.agent_breakdown.map((ag) => (
                    <div
                      key={ag.agent}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        {ag.is_ai ? <Bot size={13} className={text} /> : <User size={13} className="text-slate-500" />}
                        {ag.agent}
                      </span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-slate-500">{ag.count} oy</span>
                        <span className={`font-black ${text}`}>{ag.avg_score} ★</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Feedback Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">
              Son Değerlendirmeler & Müşteri Yorumları
            </h4>
            {stats.recent.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Sohbetler çözüldü olarak kapatıldığında gönderilen CSAT anketleri burada listelenir.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500">
                      <th className="py-2 pr-3">Kanal</th>
                      <th className="py-2 pr-3">Müşteri</th>
                      <th className="py-2 pr-3">Temsilci</th>
                      <th className="py-2 pr-3">Puan</th>
                      <th className="py-2 pr-3">Yorum</th>
                      <th className="py-2">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {stats.recent.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-3 font-bold uppercase text-[10px]">{item.channel}</td>
                        <td className="py-2.5 pr-3 font-mono">{item.sender_info}</td>
                        <td className="py-2.5 pr-3">{item.assigned_user}</td>
                        <td className="py-2.5 pr-3">
                          {item.score ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                item.score >= 4
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : item.score === 3
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                              }`}
                            >
                              {item.score}/5 • {item.rating_label}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Bekliyor</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {item.feedback_text || "—"}
                        </td>
                        <td className="py-2.5 text-[10px] text-slate-400 font-mono">
                          {item.sent_at ? new Date(item.sent_at).toLocaleString("tr-TR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <form
          onSubmit={handleSaveConfig}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-white">Omnichannel CSAT Motorunu Etkinleştir</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Kapatılan sohbetlerde müşteri memnuniyeti ölçülür.</div>
              </div>
              <input
                type="checkbox"
                checked={!!config.enabled}
                disabled={!canWrite}
                onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-white">Düşük Puanda Neden Sorusu & Süpervizör Alarmı</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Eşik altı puanlarda geri bildirim ister ve anlık alarm üretir.</div>
              </div>
              <input
                type="checkbox"
                checked={!!config.low_score_followup_enabled}
                disabled={!canWrite}
                onChange={(e) => setConfig((p) => ({ ...p, low_score_followup_enabled: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
            </label>
          </div>

          {/* Active Channels */}
          <div>
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">Aktif Anket Kanalları</div>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_META.map((ch) => {
                const active = (config.channels || []).includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={!canWrite}
                    onClick={() => toggleChannel(ch.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      active
                        ? `${bg} text-white border-transparent`
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock size={13} /> Soğuma Süresi — Cooldown (Saat)
              </label>
              <input
                type="number"
                min={0}
                max={720}
                disabled={!canWrite}
                value={config.cooldown_hours}
                onChange={(e) => setConfig((p) => ({ ...p, cooldown_hours: Number(e.target.value) || 0 }))}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono focus:outline-none focus:ring-2 ${ring}`}
              />
              <p className="text-[10px] text-slate-400 mt-1">Aynı müşteriye bu süre içinde ikinci anket gönderilmez (0 = her kapatmada).</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <BellRing size={13} /> Süpervizör Alarm Puan Eşiği (≤)
              </label>
              <select
                disabled={!canWrite}
                value={config.supervisor_alert_threshold}
                onChange={(e) => setConfig((p) => ({ ...p, supervisor_alert_threshold: Number(e.target.value) }))}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold focus:outline-none focus:ring-2 ${ring}`}
              >
                <option value={1}>1 Puan (Sadece Memnun Değilim)</option>
                <option value={2}>2 ve Altı (Önerilen)</option>
                <option value={3}>3 ve Altı (Orta + Kötü)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MessageSquare size={13} /> Anket Soru Metni
              </label>
              <textarea
                rows={2}
                disabled={!canWrite}
                value={config.question_text}
                onChange={(e) => setConfig((p) => ({ ...p, question_text: e.target.value }))}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 ${ring}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Düşük Puan Takip Sorusu
                </label>
                <textarea
                  rows={2}
                  disabled={!canWrite}
                  value={config.low_score_followup_text}
                  onChange={(e) => setConfig((p) => ({ ...p, low_score_followup_text: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Teşekkür Mesajı
                </label>
                <textarea
                  rows={2}
                  disabled={!canWrite}
                  value={config.thank_you_text}
                  onChange={(e) => setConfig((p) => ({ ...p, thank_you_text: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-sm transition ${bg} ${hover} disabled:opacity-50`}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? "Kaydediliyor..." : "CSAT Ayarlarını Kaydet"}</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
