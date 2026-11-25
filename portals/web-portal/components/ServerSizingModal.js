import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Layers,
  X,
  ArrowRight,
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
    autoQa: true,
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
    autoQa: true,
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
    autoQa: true,
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
    autoQa: true,
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
    autoQa: true,
  },
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

  const systemSsdGb = snapTier(
    50 + users * 0.06 + concurrentCalls * 0.18 + (cfg.localAiMode === "local_cpu" ? 25 : 0),
    [80, 120, 160, 250, 320, 500, 1000]
  );

  let recordingStorageGb = 0;
  if (cfg.recording) {
    const dailyFullLoadMinutes = concurrentCalls * 60 * (Number(cfg.peakHoursPerDay) || 4);
    const mbPerMin = cfg.recordingFormat === "opus" ? 0.18 : 0.96;
    recordingStorageGb =
      (dailyFullLoadMinutes * (Number(cfg.retentionDays) || 365) * mbPerMin) / 1024;
  }

  const sipTrunkMbps = concurrentCalls * 0.11;
  const aiCloudMbps = aiCalls * 0.08;
  const recommendedMbps = Math.max(10, Math.ceil((sipTrunkMbps + aiCloudMbps) * 1.3));

  const warnings = [];
  let topology = "Tek Sunucu (All-in-One NVMe)";
  let nodesRecommended = 1;

  if (concurrentCalls > 800 || users > 1200) {
    nodesRecommended = Math.max(2, Math.ceil(concurrentCalls / 600));
    topology = `Çok-Şubeli / Dağıtık Küme (${nodesRecommended} × Santral Düğümü + Harici PostgreSQL)`;
    warnings.push({
      level: "critical",
      title: "1.000+ Çağrı / 1.200+ Kullanıcı İçin Yatay Ölçekleme (Multi-Site) Önerilir",
      text: `Tek bir Asterisk düğümünde çekirdek koruma tavanı 1.000 eşzamanlı çağrıdır. ${concurrentCalls} eşzamanlı çağrı ve ${users} abone için yükü ${nodesRecommended} adet Nornia düğümüne dağıtmanız ve veritabanını Harici PostgreSQL sunucusuna ayırmanız önerilir.`,
    });
  } else if (concurrentCalls > 350 || users > 500) {
    topology = "Yüksek Yoğunluk Tek Sunucu + Harici PostgreSQL Önerisi";
    warnings.push({
      level: "warning",
      title: "Yüksek Eşzamanlılık: Harici PostgreSQL Önerisi",
      text: "500+ aktif kullanıcı veya 350+ eşzamanlı çağrıda PostgreSQL sunucusunun ayrı bir NVMe düğüme alınması önerilir.",
    });
  }

  if (aiCalls > 100) {
    warnings.push({
      level: "warning",
      title: "Yüksek Eşzamanlı Canlı AI Ses Akışı (>100 Kanal)",
      text: `${aiCalls} eşzamanlı canlı AI çağrısı için trafiği birden fazla Nornia düğümüne dağıtmanız ve sağlayıcıdan kurumsal kota artırımı talep etmeniz önerilir.`,
    });
  }

  if (recordingStorageGb > 250) {
    warnings.push({
      level: "info",
      title: `Harici NAS / SMB / SFTP Arşiv Önerisi (${formatStorage(recordingStorageGb)})`,
      text: `Seçtiğiniz ${cfg.retentionDays} günlük ses kaydı yaklaşık ${formatStorage(
        recordingStorageGb
      )} alan gerektiriyor. Yerel NVMe diski işletim sistemi ve veritabanı için tutup kayıtları harici NAS/SFTP deposuna taşımanız önerilir.`,
    });
  }

  if (cfg.localAiMode === "local_cpu" && concurrentCalls > 120) {
    warnings.push({
      level: "warning",
      title: "120+ Çağrıda Yerel CPU LLM Yerine Harici GPU Sunucusu Önerilir",
      text: "Yüksek çağrı trafiğinde canlı ses kalitesi için harici bir GPU sunucusu (RTX 4060 Ti 16GB / NVIDIA L4 24GB) önerilir.",
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
    perNodeVcpu:
      nodesRecommended > 1
        ? snapTier(recommendedVcpu / nodesRecommended, [8, 12, 16, 24, 32])
        : recommendedVcpu,
    perNodeRam:
      nodesRecommended > 1
        ? snapTier(recommendedRam / nodesRecommended, [16, 24, 32, 48, 64])
        : recommendedRam,
  };
}

function SliderTicks({ min, max, ticks, value, onSelect }) {
  return (
    <div className="relative h-5 select-none">
      {ticks.map((t) => {
        const pct = Math.max(0, Math.min(1, (t.v - min) / (max - min)));
        const isFirst = t.v === min;
        const isLast = t.v === max;
        const active = value === t.v;
        const posStyle = isFirst
          ? { left: "0%" }
          : isLast
            ? { right: "0%" }
            : { left: `calc(8px + (100% - 16px) * ${pct})`, transform: "translateX(-50%)" };
        return (
          <button
            key={t.v}
            type="button"
            onClick={() => onSelect(t.v)}
            style={posStyle}
            className={`absolute top-0 flex-col items-center cursor-pointer transition font-mono text-[10px] leading-none ${
              isFirst
                ? "flex items-start"
                : isLast
                  ? "flex items-end"
                  : "hidden sm:flex items-center"
            } ${active ? "text-indigo-600 font-black" : "text-slate-400 hover:text-indigo-600"}`}
            title={`${t.label} değerine ayarla`}
          >
            <span
              className={`block w-px h-1.5 mb-0.5 ${
                active ? "bg-indigo-600" : "bg-slate-300"
              }`}
            />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ServerSizingModal({ open, onClose, onApplyToDemo }) {
  const dialogRef = useRef(null);
  const [cfg, setCfg] = useState(PRESETS[1]);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => calculateSizing(cfg), [cfg]);

  // Synchronize React `open` state with native <dialog>.showModal() / .close()
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) {
        try {
          dlg.showModal();
        } catch {}
      }
    } else if (dlg.open) {
      try {
        dlg.close();
      } catch {}
    }
  }, [open]);

  // Native close event sync + closedby="any" light-dismiss fallback for browsers without closedBy (Safari)
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg || typeof window === "undefined") return undefined;

    const handleClose = () => {
      dlg.returnValue = "";
      onClose?.();
    };
    dlg.addEventListener("close", handleClose);

    let cleanupFallback = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e) => {
        const r = dlg.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e) => {
        pressedOutside = outside(e);
      };
      const onPointerUp = (e) => {
        if (pressedOutside && outside(e) && dlg.open) {
          dlg.close();
        }
        pressedOutside = false;
      };
      dlg.addEventListener("pointerdown", onPointerDown);
      dlg.addEventListener("pointerup", onPointerUp);
      cleanupFallback = () => {
        dlg.removeEventListener("pointerdown", onPointerDown);
        dlg.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dlg.removeEventListener("close", handleClose);
      if (cleanupFallback) cleanupFallback();
    };
  }, [onClose]);

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
      `Ses Kaydı                  : ${
        cfg.recording
          ? `Açık (${cfg.recordingFormat.toUpperCase()}, ${cfg.retentionDays} gün, günde ~${cfg.peakHoursPerDay} saat tam yük)`
          : "Kapalı"
      }`,
      `Yerel AI (Ollama/Whisper)  : ${
        cfg.localAiMode === "cloud"
          ? "Bulut API"
          : cfg.localAiMode === "local_cpu"
            ? "Yerel CPU"
            : "Harici GPU Sunucusu"
      }`,
      "--- Önerilen Altyapı ---",
      `Mimari Topoloji            : ${result.topology}`,
      `Toplam İşlemci             : ${result.recommendedVcpu} vCPU${
        result.nodesRecommended > 1
          ? ` (${result.nodesRecommended} düğüm × ${result.perNodeVcpu} vCPU)`
          : ""
      }`,
      `Toplam Bellek (RAM)        : ${result.recommendedRam} GB${
        result.nodesRecommended > 1
          ? ` (${result.nodesRecommended} düğüm × ${result.perNodeRam} GB)`
          : ""
      }`,
      `Sistem & DB Diski (NVMe)   : ${formatStorage(result.systemSsdGb)}`,
      `Ses Kayıt Depolama (NAS)   : ${
        cfg.recording ? formatStorage(result.recordingStorageGb) : "0 GB"
      }`,
      `Önerilen Bant Genişliği    : ${result.recommendedMbps} Mbps Simetrik (QoS)`,
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

  const handleRequestQuoteWithSizing = () => {
    const label = `On-Premise (${cfg.users} Abone / ${cfg.concurrentCalls} Çağrı • ${result.recommendedVcpu} vCPU / ${result.recommendedRam} GB RAM)`;
    dialogRef.current?.close();
    onApplyToDemo?.(label);
  };

  return (
    <dialog
      ref={dialogRef}
      id="nornia-sizing-modal"
      aria-labelledby="sizing-modal-title"
      {...{ closedby: "any" }}
      className="nornia-sizing-dialog m-auto w-[min(96dvw,1080px)] max-h-[92dvh] rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-floating"
    >
      <div className="flex max-h-[92dvh] flex-col overflow-hidden rounded-3xl">
        {/* Sticky Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-100/70 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
              <Sliders className="h-3 w-3" aria-hidden="true" />
              <span>Etkileşimli Kapasite &amp; Donanım Hesaplayıcı</span>
            </div>
            <h1
              id="sizing-modal-title"
              className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl"
            >
              <Server className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <span>Nornia On-Premise Sunucu Kaynak Hesaplayıcı</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-indigo-50 transition"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
              )}
              <span>{copied ? "Kopyalandı" : "Özeti Kopyala"}</span>
            </button>

            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="Kapasite hesaplayıcıyı kapat"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto overscroll-contain">
          {/* Quick Presets */}
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-wrap sm:px-6">
            <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">
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
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? "bg-indigo-950 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-400"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Main 2-Column Calculator Grid */}
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-12">
            {/* LEFT: INPUT CONTROLS */}
            <div className="space-y-5 lg:col-span-7">
              {/* Users */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <label
                      htmlFor="sizing-users-input"
                      className="text-xs font-extrabold text-slate-800"
                    >
                      Kayıtlı Kullanıcı / Dahili Sayısı
                    </label>
                    <span className="text-[10px] text-slate-400">(10.000&apos;e kadar)</span>
                  </div>
                  <input
                    id="sizing-users-input"
                    type="number"
                    min={1}
                    max={10000}
                    value={cfg.users}
                    onChange={(e) =>
                      update("users", Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right font-mono text-xs font-black text-indigo-700"
                  />
                </div>
                <input
                  type="range"
                  aria-label="Kayıtlı Kullanıcı Sayısı"
                  min={10}
                  max={2000}
                  step={10}
                  value={Math.min(2000, cfg.users)}
                  onChange={(e) => update("users", Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <SliderTicks
                  min={10}
                  max={2000}
                  value={cfg.users}
                  onSelect={(v) => update("users", v)}
                  ticks={[
                    { v: 10, label: "10" },
                    { v: 500, label: "500" },
                    { v: 1000, label: "1.000" },
                    { v: 1500, label: "1.500" },
                    { v: 2000, label: "2.000+" },
                  ]}
                />
              </div>

              {/* Concurrent Calls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <label
                      htmlFor="sizing-calls-input"
                      className="text-xs font-extrabold text-slate-800"
                    >
                      Eş Zamanlı Toplam Çağrı (SIP + WebRTC)
                    </label>
                    <span className="text-[10px] text-slate-400">(5.000&apos;e kadar)</span>
                  </div>
                  <input
                    id="sizing-calls-input"
                    type="number"
                    min={1}
                    max={5000}
                    value={cfg.concurrentCalls}
                    onChange={(e) =>
                      update("concurrentCalls", Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right font-mono text-xs font-black text-indigo-700"
                  />
                </div>
                <input
                  type="range"
                  aria-label="Eş Zamanlı Toplam Çağrı"
                  min={5}
                  max={1500}
                  step={5}
                  value={Math.min(1500, cfg.concurrentCalls)}
                  onChange={(e) => update("concurrentCalls", Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <SliderTicks
                  min={5}
                  max={1500}
                  value={cfg.concurrentCalls}
                  onSelect={(v) => update("concurrentCalls", v)}
                  ticks={[
                    { v: 5, label: "5" },
                    { v: 250, label: "250" },
                    { v: 500, label: "500" },
                    { v: 1000, label: "1.000" },
                    { v: 1500, label: "1.500+" },
                  ]}
                />
              </div>

              {/* Live AI Voice Calls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="sizing-ai-input"
                    className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />
                    <span>Eş Zamanlı Canlı AI Sesli Çağrı (AudioSocket)</span>
                  </label>
                  <input
                    id="sizing-ai-input"
                    type="number"
                    min={0}
                    max={cfg.concurrentCalls}
                    value={cfg.aiCalls}
                    onChange={(e) =>
                      update(
                        "aiCalls",
                        Math.max(0, Math.min(cfg.concurrentCalls, Number(e.target.value) || 0))
                      )
                    }
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-right font-mono text-xs font-black text-purple-700"
                  />
                </div>
                <input
                  type="range"
                  aria-label="Eş Zamanlı Canlı AI Çağrı"
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
                  <label
                    htmlFor="sizing-webrtc-range"
                    className="text-xs font-extrabold text-slate-800"
                  >
                    Web Telefon (WebRTC) Kullanım Oranı
                  </label>
                  <span className="font-mono text-xs font-black text-sky-700">
                    %{cfg.webrtcPct} WebRTC / %{100 - cfg.webrtcPct} IP Masa Tel
                  </span>
                </div>
                <input
                  id="sizing-webrtc-range"
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
                <div className="text-xs font-extrabold text-slate-800">
                  Yerel LLM (Ollama) &amp; Transkript (Whisper) Mimarisi
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { id: "cloud", title: "Sadece Bulut API", sub: "Gemini / OpenAI / Groq" },
                    {
                      id: "local_cpu",
                      title: "Yerel CPU (Aynı Sunucu)",
                      sub: "+4 vCPU / +8 GB RAM",
                    },
                    {
                      id: "external_gpu",
                      title: "Harici GPU Sunucusu",
                      sub: "Yüksek hız, sıfır token",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update("localAiMode", opt.id)}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        cfg.localAiMode === opt.id
                          ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                          : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-[11px] font-extrabold">{opt.title}</div>
                      <div className="text-[10px] opacity-75">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Recording Options */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-extrabold text-slate-800">
                    <input
                      type="checkbox"
                      checked={cfg.recording}
                      onChange={(e) => update("recording", e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>Çağrı Ses Kaydı (MixMonitor) Aktif</span>
                  </label>
                  {cfg.recording && (
                    <div className="flex items-center gap-1">
                      {[
                        { id: "wav", label: "WAV (Ham)" },
                        { id: "opus", label: "OPUS (~%80 Tasarruf)" },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => update("recordingFormat", fmt.id)}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                            cfg.recordingFormat === fmt.id
                              ? "bg-indigo-950 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {cfg.recording && (
                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="sizing-retention-select"
                        className="mb-1 block text-[11px] font-bold text-slate-600"
                      >
                        Saklama Süresi (KVKK)
                      </label>
                      <select
                        id="sizing-retention-select"
                        value={cfg.retentionDays}
                        onChange={(e) => update("retentionDays", Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
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
                      <label
                        htmlFor="sizing-peak-hours"
                        className="mb-1 block text-[11px] font-bold text-slate-600"
                      >
                        Günlük Eşdeğer Yoğun Saat ({cfg.peakHoursPerDay} saat/gün)
                      </label>
                      <input
                        id="sizing-peak-hours"
                        type="range"
                        min={1}
                        max={12}
                        value={cfg.peakHoursPerDay}
                        onChange={(e) => update("peakHoursPerDay", Number(e.target.value))}
                        className="mt-1.5 w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Extra Modules */}
              <div className="flex flex-wrap gap-2.5">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={cfg.omnichannel}
                    onChange={(e) => update("omnichannel", e.target.checked)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  <span>Omnichannel (WhatsApp / E-Posta / Meta)</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={cfg.autoQa}
                    onChange={(e) => update("autoQa", e.target.checked)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  <span>Otomatik QA &amp; Transkript Analizi</span>
                </label>
              </div>
            </div>

            {/* RIGHT: LIVE COMPUTED RECOMMENDATION */}
            <div className="space-y-4 lg:col-span-5">
              <div className="space-y-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                    Önerilen Sunucu Kaynağı
                  </span>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                    %25 Pik Payı Dahil
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <Cpu className="h-3 w-3 text-indigo-500" aria-hidden="true" />
                      <span>İŞLEMCİ (vCPU)</span>
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-950">
                      {result.recommendedVcpu}{" "}
                      <span className="text-xs font-bold text-slate-400">vCPU</span>
                    </div>
                    {result.nodesRecommended > 1 && (
                      <div className="mt-0.5 text-[10px] font-bold text-indigo-600">
                        {result.nodesRecommended} düğüm × {result.perNodeVcpu} vCPU
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <MemoryStick className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      <span>BELLEK (RAM)</span>
                    </div>
                    <div className="mt-1 text-2xl font-black text-slate-950">
                      {result.recommendedRam}{" "}
                      <span className="text-xs font-bold text-slate-400">GB</span>
                    </div>
                    {result.nodesRecommended > 1 && (
                      <div className="mt-0.5 text-[10px] font-bold text-emerald-600">
                        {result.nodesRecommended} düğüm × {result.perNodeRam} GB
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <HardDrive className="h-3 w-3 text-amber-500" aria-hidden="true" />
                      <span>SİSTEM &amp; DB (NVMe)</span>
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-950">
                      {formatStorage(result.systemSsdGb)}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Kayıt:{" "}
                      {cfg.recording ? formatStorage(result.recordingStorageGb) : "Kapalı"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <Network className="h-3 w-3 text-sky-500" aria-hidden="true" />
                      <span>BANT GENİŞLİĞİ</span>
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-950">
                      {result.recommendedMbps}{" "}
                      <span className="text-xs font-bold text-slate-400">Mbps</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Simetrik (SIP + AI QoS)
                    </div>
                  </div>
                </div>

                {/* Topology */}
                <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <Layers className="h-3 w-3 text-indigo-500" aria-hidden="true" />
                    <span>Önerilen Mimari Topoloji</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span>{result.topology}</span>
                  </div>
                  {result.gpuSpec && (
                    <div className="mt-1.5 flex items-start gap-1.5 border-t border-slate-100 pt-1.5 text-[11px] font-bold text-purple-700">
                      <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Harici AI GPU Sunucusu: {result.gpuSpec}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRequestQuoteWithSizing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-950 px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 transition"
                >
                  Bu Kapasiteyle Demo &amp; Teklif İste
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Dynamic Engineering Advisories */}
              {result.warnings.length > 0 && (
                <div className="space-y-2.5">
                  {result.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`space-y-1 rounded-xl border p-3.5 text-xs ${
                        w.level === "critical"
                          ? "border-rose-200 bg-rose-50 text-rose-900"
                          : w.level === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-sky-200 bg-sky-50 text-sky-900"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-extrabold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{w.title}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{w.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
