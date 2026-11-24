import React, { useState, useMemo } from "react";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Sliders,
  Database,
  Layers
} from "lucide-react";

const PRESETS = [
  {
    id: "kobi",
    label: "KOBİ (50 / 20)",
    users: 50,
    concurrentCalls: 20,
    aiCalls: 5,
    webrtcPct: 70,
    recording: true,
    recordingFormat: "wav",
    retentionDays: 180,
    peakHoursPerDay: 3,
    localAiMode: "cloud",
    omnichannel: true,
    autoQa: true
  },
  {
    id: "kurumsal",
    label: "Kurumsal (250 / 80)",
    users: 250,
    concurrentCalls: 80,
    aiCalls: 20,
    webrtcPct: 70,
    recording: true,
    recordingFormat: "wav",
    retentionDays: 365,
    peakHoursPerDay: 4,
    localAiMode: "cloud",
    omnichannel: true,
    autoQa: true
  },
  {
    id: "cagri-merkezi",
    label: "Çağrı Merkezi (500 / 250)",
    users: 500,
    concurrentCalls: 250,
    aiCalls: 40,
    webrtcPct: 85,
    recording: true,
    recordingFormat: "opus",
    retentionDays: 365,
    peakHoursPerDay: 6,
    localAiMode: "external_gpu",
    omnichannel: true,
    autoQa: true
  },
  {
    id: "yogun-1000",
    label: "1.000 Abone / 1.000 Çağrı",
    users: 1000,
    concurrentCalls: 1000,
    aiCalls: 100,
    webrtcPct: 70,
    recording: true,
    recordingFormat: "opus",
    retentionDays: 365,
    peakHoursPerDay: 5,
    localAiMode: "external_gpu",
    omnichannel: true,
    autoQa: true
  },
  {
    id: "ai-agirlikli",
    label: "AI Odaklı (300 / 120 AI)",
    users: 300,
    concurrentCalls: 150,
    aiCalls: 120,
    webrtcPct: 60,
    recording: true,
    recordingFormat: "opus",
    retentionDays: 365,
    peakHoursPerDay: 5,
    localAiMode: "cloud",
    omnichannel: true,
    autoQa: true
  }
];

function snapTier(value, tiers) {
  for (const t of tiers) {
    if (value <= t) return t;
  }
  return Math.ceil(value / 16) * 16;
}

function formatStorage(gb) {
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(2)} TB`;
  }
  return `${Math.ceil(gb)} GB`;
}

export function calculateSizing(cfg) {
  const users = Math.max(1, Math.min(10000, Number(cfg.users) || 1));
  const concurrentCalls = Math.max(1, Math.min(5000, Number(cfg.concurrentCalls) || 1));
  const aiCalls = Math.max(0, Math.min(concurrentCalls, Number(cfg.aiCalls) || 0));
  const webrtcPct = Math.max(0, Math.min(100, Number(cfg.webrtcPct) || 0));
  const humanCalls = Math.max(0, concurrentCalls - aiCalls);
  const webrtcCalls = Math.round(humanCalls * (webrtcPct / 100));
  const plainSipCalls = Math.max(0, humanCalls - webrtcCalls);

  // vCPU calculation
  const baseCpu = 2.0;
  const userCpu = users * 0.0025;
  const sipCpu = plainSipCalls * 0.012;
  const webrtcCpu = webrtcCalls * 0.022;
  const aiCpu = aiCalls * 0.065;
  const recCpu = cfg.recording ? concurrentCalls * 0.005 : 0;
  const extraCpu =
    (cfg.omnichannel ? 0.5 : 0) +
    (cfg.autoQa ? Math.min(2.0, concurrentCalls * 0.003 + 0.5) : 0) +
    (cfg.localAiMode === "local_cpu" ? 4.0 : 0);

  const rawCpu = (baseCpu + userCpu + sipCpu + webrtcCpu + aiCpu + recCpu + extraCpu) * 1.25;
  const recommendedVcpu = snapTier(rawCpu, [4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128]);

  // RAM calculation (GB)
  const baseRam = 3.5;
  const userRam = users * 0.006;
  const callRam = concurrentCalls * 0.012;
  const aiRam = aiCalls * 0.04;
  const extraRam =
    (cfg.omnichannel ? 0.5 : 0) +
    (cfg.autoQa ? 0.5 : 0) +
    (cfg.localAiMode === "local_cpu" ? 8.0 : 0);

  const rawRam = (baseRam + userRam + callRam + aiRam + extraRam) * 1.25;
  const recommendedRam = snapTier(rawRam, [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256]);

  // System SSD + Recording Storage (GB)
  const systemSsdGb = snapTier(
    50 + users * 0.06 + concurrentCalls * 0.18 + (cfg.localAiMode === "local_cpu" ? 25 : 0),
    [80, 120, 160, 250, 320, 500, 1000]
  );

  let recordingStorageGb = 0;
  if (cfg.recording) {
    const dailyFullLoadMinutes = concurrentCalls * 60 * (Number(cfg.peakHoursPerDay) || 4);
    const mbPerMin = cfg.recordingFormat === "opus" ? 0.18 : 0.96;
    recordingStorageGb = (dailyFullLoadMinutes * (Number(cfg.retentionDays) || 365) * mbPerMin) / 1024;
  }

  // Network Bandwidth (Symmetric Mbps)
  const sipTrunkMbps = concurrentCalls * 0.11;
  const aiCloudMbps = aiCalls * 0.08;
  const recommendedMbps = Math.max(10, Math.ceil((sipTrunkMbps + aiCloudMbps) * 1.3));

  // Architecture Topology & Engineering Warnings
  const warnings = [];
  let topology = "Tek Sunucu (All-in-One NVMe)";
  let nodesRecommended = 1;

  if (concurrentCalls > 800 || users > 1200) {
    nodesRecommended = Math.max(2, Math.ceil(concurrentCalls / 600));
    topology = `Çok-Şubeli / Dağıtık Küme (${nodesRecommended} × Santral Düğümü + Harici PostgreSQL)`;
    warnings.push({
      level: "critical",
      title: "1.000+ Çağrı / 1.200+ Kullanıcı İçin Yatay Ölçekleme (Multi-Site) Önerilir",
      text: `Tek bir Asterisk düğümünde çekirdek koruma tavanı 1.000 eşzamanlı çağrıdır (asterisk.conf maxcalls). ${concurrentCalls} eşzamanlı çağrı ve ${users} abone için yükü ${nodesRecommended} adet Nornia düğümüne (Multi-Site Hub/Edge) dağıtmanız ve veritabanını Harici PostgreSQL sunucusuna ayırmanız önerilir.`
    });
  } else if (concurrentCalls > 350 || users > 500) {
    topology = "Yüksek Yoğunluk Tek Sunucu + Harici PostgreSQL Önerisi";
    warnings.push({
      level: "warning",
      title: "Yüksek Eşzamanlılık: Veritabanı Havuzu & Harici PostgreSQL",
      text: "500+ aktif kullanıcı veya 350+ eşzamanlı çağrıda PostgreSQL sunucusunun ayrı bir NVMe düğüme alınması (Sistem Ayarları → Sistem Yedekleme → Harici PostgreSQL) ve bağlantı havuzunun genişletilmesi önerilir."
    });
  }

  if (aiCalls > 100) {
    warnings.push({
      level: "warning",
      title: "Yüksek Eşzamanlı Canlı AI Ses Akışı (>100 Kanal)",
      text: `${aiCalls} eşzamanlı canlı AI sesli çağrı tek Python AudioSocket sürecini zorlayabilir ve Gemini/OpenAI eşzamanlı WebSocket API kotasını aşabilir. AI trafiğini birden fazla Nornia düğümüne dağıtın ve sağlayıcıdan kurumsal Tier kota artırımı talep edin.`
    });
  }

  if (recordingStorageGb > 250) {
    warnings.push({
      level: "info",
      title: `Harici NAS / SMB / SFTP Arşiv Önerisi (${formatStorage(recordingStorageGb)})`,
      text: `Seçtiğiniz ${cfg.retentionDays} günlük ses kaydı yaklaşık ${formatStorage(recordingStorageGb)} alan gerektiriyor. Yerel NVMe diski yalnızca işletim sistemi ve veritabanı için tutup, ses kayıtlarını 'Kayıt & Saklama Sistemi' üzerinden Harici NAS/SMB/SFTP deposuna 'Taşı (Move)' moduyla aktarmanız önerilir.`
    });
  }

  if (cfg.localAiMode === "local_cpu" && concurrentCalls > 120) {
    warnings.push({
      level: "warning",
      title: "120+ Çağrıda Yerel CPU LLM Yerine Harici GPU Sunucusu Önerilir",
      text: "Yüksek çağrı trafiğinde yerel CPU üzerinde Ollama/Whisper çalıştırmak işlemciyi yoğunlaştırabilir. Canlı ses kalitesi için 'AI Görev Yönlendirme' ekranından harici bir GPU sunucusuna (RTX 4060 Ti 16GB / NVIDIA L4 24GB) yönlendirmeniz önerilir."
    });
  }

  const gpuSpec =
    cfg.localAiMode === "external_gpu"
      ? concurrentCalls >= 400
        ? "NVIDIA L4 / RTX 4090 (24 GB VRAM) • 8 vCPU • 32 GB RAM"
        : "NVIDIA RTX 4060 Ti / A4000 (16 GB VRAM) • 8 vCPU • 32 GB RAM"
      : null;

  return {
    recommendedVcpu,
    recommendedRam,
    systemSsdGb,
    recordingStorageGb,
    totalDiskGb: systemSsdGb + recordingStorageGb,
    recommendedMbps,
    topology,
    nodesRecommended,
    gpuSpec,
    warnings,
    perNodeVcpu: nodesRecommended > 1 ? snapTier(recommendedVcpu / nodesRecommended, [8, 12, 16, 24, 32]) : recommendedVcpu,
    perNodeRam: nodesRecommended > 1 ? snapTier(recommendedRam / nodesRecommended, [16, 24, 32, 48, 64]) : recommendedRam
  };
}

export default function ServerSizingCalculator({ printMode = false }) {
  const [cfg, setCfg] = useState(PRESETS[1]);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => calculateSizing(cfg), [cfg]);

  const update = (key, val) => {
    setCfg((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "concurrentCalls" && next.aiCalls > val) {
        next.aiCalls = val;
      }
      return next;
    });
  };

  const handleCopySummary = () => {
    const lines = [
      "=== Nornia Sunucu Kaynak & Kapasite Önerisi ===",
      `Kayıtlı Kullanıcı / Dahili : ${cfg.users}`,
      `Eş Zamanlı Çağrı           : ${cfg.concurrentCalls} (Canlı AI: ${cfg.aiCalls}, WebRTC: %${cfg.webrtcPct})`,
      `Ses Kaydı                  : ${cfg.recording ? `Açık (${cfg.recordingFormat.toUpperCase()}, ${cfg.retentionDays} gün, günde ~${cfg.peakHoursPerDay} saat tam yük)` : "Kapalı"}`,
      `Yerel AI (Ollama/Whisper)  : ${cfg.localAiMode === "cloud" ? "Bulut API" : cfg.localAiMode === "local_cpu" ? "Yerel CPU" : "Harici GPU Sunucusu"}`,
      "--- Önerilen Altyapı ---",
      `Mimari Topoloji            : ${result.topology}`,
      `Toplam İşlemci             : ${result.recommendedVcpu} vCPU${result.nodesRecommended > 1 ? ` (${result.nodesRecommended} düğüm × ${result.perNodeVcpu} vCPU)` : ""}`,
      `Toplam Bellek (RAM)        : ${result.recommendedRam} GB${result.nodesRecommended > 1 ? ` (${result.nodesRecommended} düğüm × ${result.perNodeRam} GB)` : ""}`,
      `Sistem & DB Diski (NVMe)   : ${formatStorage(result.systemSsdGb)}`,
      `Ses Kayıt Depolama (NAS)   : ${cfg.recording ? formatStorage(result.recordingStorageGb) : "0 GB"}`,
      `Önerilen Bant Genişliği    : ${result.recommendedMbps} Mbps Simetrik (QoS)`
    ];
    if (result.gpuSpec) {
      lines.push(`Harici AI GPU Sunucusu     : ${result.gpuSpec}`);
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Clean Static Reference Matrix for Print/PDF Mode
  if (printMode) {
    return (
      <section className="print-avoid-break p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="print-keep-with-next flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Server size={16} className="text-indigo-600" />
            <span>Sunucu Kaynak &amp; Kapasite Boyutlandırma Rehberi (Örnek Senaryolar)</span>
          </h2>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
            Canlı Hesaplayıcı: dokuman.nornia.com.tr/kurulum-dokumani/
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Sunucu gereksinimleri kullanıcı sayısına, eşzamanlı normal/AI çağrı adedine, ses kaydı saklama süresine ve yerel LLM kullanımına göre dinamik hesaplanır. Web kılavuzundaki etkileşimli hesaplayıcıdan kendi senaryonuzu anlık hesaplayabilirsiniz.
        </p>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-extrabold">Senaryo</th>
                <th className="px-3 py-2 font-extrabold">Kullanıcı / Çağrı / AI</th>
                <th className="px-3 py-2 font-extrabold">Önerilen vCPU &amp; RAM</th>
                <th className="px-3 py-2 font-extrabold">Disk, Ağ &amp; Mimari Önerisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PRESETS.map((p) => {
                const r = calculateSizing(p);
                return (
                  <tr key={p.id} className="print-avoid-break align-top">
                    <td className="px-3 py-2 font-extrabold text-slate-900">{p.label}</td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-indigo-700">
                      {p.users} abone • {p.concurrentCalls} çağrı • {p.aiCalls} AI
                    </td>
                    <td className="px-3 py-2 font-mono text-[10.5px] font-bold text-slate-800">
                      {r.recommendedVcpu} vCPU / {r.recommendedRam} GB RAM
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-[11px]">
                      {formatStorage(r.systemSsdGb)} NVMe + {formatStorage(r.recordingStorageGb)} kayıt • {r.recommendedMbps} Mbps • {r.topology}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section
      id="kaynak-hesaplayici"
      className="rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-extrabold text-indigo-200">
            <Sliders size={11} />
            <span>Etkileşimli Kapasite &amp; Donanım Hesaplayıcı</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <Server size={20} className="text-indigo-300" />
            <span>Nornia Sunucu Kaynak Hesaplama Aracı</span>
          </h2>
          <p className="text-xs text-indigo-100/85 max-w-2xl">
            Abone adedinizi, eşzamanlı çağrı hedefinizi (1:1 yoğun senaryolar dahil), canlı AI ses akışını, ses kaydı süresini ve yerel LLM tercihinizi seçin; ihtiyacınız olan vCPU, RAM, NVMe/NAS disk, bant genişliği ve mimariyi anında hesaplayın.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopySummary}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-extrabold text-white cursor-pointer transition"
        >
          {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
          <span>{copied ? "Teknik Özet Kopyalandı" : "Teknik Özeti Kopyala"}</span>
        </button>
      </div>

      {/* Quick Presets */}
      <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
          Hazır Senaryolar:
        </span>
        {PRESETS.map((p) => {
          const active =
            cfg.users === p.users &&
            cfg.concurrentCalls === p.concurrentCalls &&
            cfg.aiCalls === p.aiCalls &&
            cfg.localAiMode === p.localAiMode;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setCfg({ ...p })}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer ${
                active
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Interactive Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: INPUT CONTROLS */}
        <div className="lg:col-span-7 space-y-5">
          {/* Users */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                Kayıtlı Kullanıcı / Dahili Sayısı
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={cfg.users}
                onChange={(e) => update("users", Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right font-mono text-xs font-black text-indigo-600 dark:text-indigo-400"
              />
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={10}
              value={Math.min(2000, cfg.users)}
              onChange={(e) => update("users", Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>10</span>
              <span>500</span>
              <span>1.000</span>
              <span>2.000+ (kutudan 10.000&apos;e kadar yazabilirsiniz)</span>
            </div>
          </div>

          {/* Concurrent Calls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                Eş Zamanlı Toplam Çağrı (SIP + WebRTC)
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={cfg.concurrentCalls}
                onChange={(e) => update("concurrentCalls", Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right font-mono text-xs font-black text-indigo-600 dark:text-indigo-400"
              />
            </div>
            <input
              type="range"
              min={5}
              max={1500}
              step={5}
              value={Math.min(1500, cfg.concurrentCalls)}
              onChange={(e) => update("concurrentCalls", Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5</span>
              <span>250</span>
              <span>500</span>
              <span>1.000</span>
              <span>1.500+</span>
            </div>
          </div>

          {/* Live AI Voice Calls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-500" />
                <span>Eş Zamanlı Canlı AI Sesli Çağrı (AudioSocket)</span>
              </label>
              <input
                type="number"
                min={0}
                max={cfg.concurrentCalls}
                value={cfg.aiCalls}
                onChange={(e) =>
                  update("aiCalls", Math.max(0, Math.min(cfg.concurrentCalls, Number(e.target.value) || 0)))
                }
                className="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right font-mono text-xs font-black text-purple-600 dark:text-purple-400"
              />
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(500, cfg.concurrentCalls)}
              step={1}
              value={Math.min(500, cfg.aiCalls)}
              onChange={(e) => update("aiCalls", Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* WebRTC Ratio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                Web Telefon (WebRTC) Kullanım Oranı
              </label>
              <span className="font-mono text-xs font-black text-sky-600 dark:text-sky-400">
                %{cfg.webrtcPct} WebRTC / %{100 - cfg.webrtcPct} IP Masa Tel
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cfg.webrtcPct}
              onChange={(e) => update("webrtcPct", Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>

          {/* Local LLM / Whisper Selector */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
              Yerel LLM (Ollama) &amp; Transkript (Whisper) Mimarisi
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "cloud", title: "Sadece Bulut API", sub: "Gemini / OpenAI / Groq" },
                { id: "local_cpu", title: "Yerel CPU (Aynı Sunucu)", sub: "+4 vCPU / +8 GB RAM" },
                { id: "external_gpu", title: "Harici GPU Sunucusu", sub: "Yüksek hız, sıfır token" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update("localAiMode", opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    cfg.localAiMode === opt.id
                      ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{opt.title}</div>
                  <div className="text-[10px] opacity-75">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Call Recording Options */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.recording}
                  onChange={(e) => update("recording", e.target.checked)}
                  className="rounded accent-indigo-600 h-4 w-4"
                />
                <span>Çağrı Ses Kaydı (MixMonitor) Aktif</span>
              </label>
              {cfg.recording && (
                <div className="flex items-center gap-1">
                  {[
                    { id: "wav", label: "WAV (Ham)" },
                    { id: "opus", label: "OPUS (~%80 Tasarruf)" }
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => update("recordingFormat", fmt.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        cfg.recordingFormat === fmt.id
                          ? "bg-indigo-600 text-white"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {cfg.recording && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Saklama Süresi (KVKK)
                  </label>
                  <select
                    value={cfg.retentionDays}
                    onChange={(e) => update("retentionDays", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value={30}>30 Gün (1 Ay)</option>
                    <option value={90}>90 Gün (3 Ay)</option>
                    <option value={180}>180 Gün (6 Ay)</option>
                    <option value={365}>365 Gün (1 Yıl)</option>
                    <option value={730}>730 Gün (2 Yıl)</option>
                    <option value={1095}>1.095 Gün (3 Yıl)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Günlük Eşdeğer Yoğun Saat ({cfg.peakHoursPerDay} saat/gün)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={cfg.peakHoursPerDay}
                    onChange={(e) => update("peakHoursPerDay", Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer mt-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Extra Modules */}
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.omnichannel}
                onChange={(e) => update("omnichannel", e.target.checked)}
                className="accent-indigo-600 h-3.5 w-3.5"
              />
              <span>Omnichannel (WhatsApp / E-Posta / Meta)</span>
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.autoQa}
                onChange={(e) => update("autoQa", e.target.checked)}
                className="accent-indigo-600 h-3.5 w-3.5"
              />
              <span>Otomatik QA &amp; Transkript Analizi</span>
            </label>
          </div>
        </div>

        {/* RIGHT: LIVE COMPUTED RECOMMENDATION */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-950 border border-indigo-200 dark:border-indigo-900/60 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Önerilen Sunucu Kaynağı
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                %25 Pik Payı Dahil
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Cpu size={12} className="text-indigo-500" />
                  <span>İŞLEMCİ (vCPU)</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {result.recommendedVcpu} <span className="text-xs font-bold text-slate-400">vCPU</span>
                </div>
                {result.nodesRecommended > 1 && (
                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {result.nodesRecommended} düğüm × {result.perNodeVcpu} vCPU
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <MemoryStick size={12} className="text-emerald-500" />
                  <span>BELLEK (RAM)</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {result.recommendedRam} <span className="text-xs font-bold text-slate-400">GB</span>
                </div>
                {result.nodesRecommended > 1 && (
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {result.nodesRecommended} düğüm × {result.perNodeRam} GB
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <HardDrive size={12} className="text-amber-500" />
                  <span>SİSTEM &amp; DB (NVMe)</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {formatStorage(result.systemSsdGb)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kayıt: {cfg.recording ? formatStorage(result.recordingStorageGb) : "Kapalı"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Network size={12} className="text-sky-500" />
                  <span>BANT GENİŞLİĞİ</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {result.recommendedMbps} <span className="text-xs font-bold text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Simetrik (SIP + AI QoS)
                </div>
              </div>
            </div>

            {/* Recommended Topology */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers size={12} className="text-indigo-500" />
                <span>Önerilen Mimari Topoloji</span>
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{result.topology}</span>
              </div>
              {result.gpuSpec && (
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-purple-700 dark:text-purple-300 font-bold flex items-start gap-1.5">
                  <Database size={13} className="shrink-0 mt-0.5" />
                  <span>Harici AI GPU Sunucusu: {result.gpuSpec}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Engineering Advisories */}
          {result.warnings.length > 0 && (
            <div className="space-y-2.5">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    w.level === "critical"
                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200"
                      : w.level === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                      : "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/60 text-sky-900 dark:text-sky-200"
                  }`}
                >
                  <div className="font-extrabold flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{w.title}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{w.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
