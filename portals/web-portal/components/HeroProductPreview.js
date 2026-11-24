import React, { useState } from "react";
import {
  Phone,
  PhoneCall,
  LayoutGrid,
  Users,
  MessageSquare,
  Settings,
  MoreHorizontal,
  Clock,
  Sparkles,
  Mic,
  CheckCircle2,
} from "lucide-react";

const CHART_DAYS = [
  { day: "Pzt", incoming: 82, ai: 60, solved: 74 },
  { day: "Sal", incoming: 96, ai: 68, solved: 86 },
  { day: "Çar", incoming: 90, ai: 56, solved: 76 },
  { day: "Per", incoming: 78, ai: 52, solved: 72 },
];

export default function HeroProductPreview() {
  const [aiAutoSummary, setAiAutoSummary] = useState(true);
  const [webrtcActive, setWebrtcActive] = useState(true);

  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
      {/* Subtle light prism ambient halo behind window */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-sky-100/70 via-indigo-100/60 to-rose-100/50 blur-2xl"
      />

      {/* Main Light SaaS Product Window (Seçenek 2 signature) */}
      <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-floating overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              className="h-6 w-6 rounded-md shadow-sm"
            />
            <span className="text-sm font-semibold text-slate-900">
              Nornia Temsilci Paneli
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Canlı
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="rounded-md bg-white px-2 py-0.5 border border-slate-200">
              Dahili 1001
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 font-semibold">
              WebRTC WSS
            </span>
          </div>
        </div>

        {/* Window body with compact left rail */}
        <div className="flex">
          {/* Compact Sidebar Rail */}
          <div
            aria-hidden="true"
            className="hidden sm:flex w-12 shrink-0 flex-col items-center gap-3 border-r border-slate-100 bg-slate-50/50 py-4 text-slate-400"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
              <Settings className="h-4 w-4" />
            </div>
          </div>

          {/* Main Grid inside Window */}
          <div className="grid flex-1 grid-cols-1 gap-3.5 p-4 pb-8 sm:grid-cols-12">
            {/* Active Customer + AI Toggle Column */}
            <div className="sm:col-span-5 flex flex-col gap-3">
              {/* Active Customer Card */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Aktif Müşteri
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-xs font-bold text-white shadow-sm">
                    MK
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      Mehmet Kaya
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      Kurumsal Müşteri
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Canlı Çağrı
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    02:34
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700">
                    <Phone className="h-3.5 w-3.5 text-indigo-600" />
                    Aktar
                  </span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* AI Voice Assistant Toggle Card */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    AI Sesli Asistan
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiAutoSummary}
                    aria-label="Otomatik AI özetleme önizleme anahtarı"
                    onClick={() => setAiAutoSummary((v) => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      aiAutoSummary ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        aiAutoSummary ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  {aiAutoSummary
                    ? "Canlı transkript, duygu skoru ve otomatik özetleme aktif."
                    : "AI özetleme beklemede — tek tıkla anında etkinleştirin."}
                </p>
              </div>
            </div>

            {/* Call Analytics Bar Chart Column */}
            <div className="sm:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-900">
                    Çağrı &amp; AI Analitiği
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    +18% SLA
                  </span>
                </div>

                {/* Legend */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    Gelen
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    AI Yanıt
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Çözülen
                  </span>
                </div>
              </div>

              {/* Clean CSS Bar Chart */}
              <div className="mt-4 grid grid-cols-4 items-end gap-3 h-32 px-1 border-b border-slate-100 pb-2">
                {CHART_DAYS.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="flex items-end gap-1 h-24 w-full justify-center">
                      <div
                        className="w-2.5 rounded-t-md bg-indigo-600/90 transition-all"
                        style={{ height: `${d.incoming}%` }}
                      />
                      <div
                        className="w-2.5 rounded-t-md bg-sky-400 transition-all"
                        style={{ height: `${d.ai}%` }}
                      />
                      <div
                        className="w-2.5 rounded-t-md bg-emerald-500 transition-all"
                        style={{ height: `${d.solved}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {d.day}
                    </span>
                  </div>
                ))}
              </div>

              {/* Metric pill footer */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                <span>
                  Ortalama Yanıt:{" "}
                  <strong className="font-semibold text-slate-900">1.2 sn</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Memnuniyet: %98
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlapping Floating Micro-Cards (WhatsApp Omnichannel + Runa Mobil) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:-mt-5 lg:px-4 relative z-10">
        {/* WhatsApp Omnichannel Card */}
        <div className="rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur p-3.5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900">
                WhatsApp Omnichannel
              </div>
              <div className="text-[10px] font-medium text-emerald-700">
                0850 Kurumsal Hat • AI Aktif
              </div>
            </div>
          </div>
          <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <div className="text-[11px] font-semibold text-slate-800">
              Ayşe Demir
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              &ldquo;Merhaba, kurumsal tarife ve randevu hakkında bilgi alabilir miyim?&rdquo;
            </p>
          </div>
        </div>

        {/* Runa Mobil WebRTC Card */}
        <div className="rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur p-3.5 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                <PhoneCall className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-xs font-bold text-slate-900">Runa Mobil</div>
                <div className="text-[10px] text-slate-500">
                  WebRTC &amp; SIP Softphone
                </div>
              </div>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              iOS &amp; Android
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50/80 border border-emerald-200/70 px-2.5 py-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <Mic className="h-3.5 w-3.5 text-emerald-600" />
              {webrtcActive ? "HD Ses Bağlı" : "Sessize Alındı"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={webrtcActive}
              aria-label="Runa Mobil ses önizleme anahtarı"
              onClick={() => setWebrtcActive((v) => !v)}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                webrtcActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                  webrtcActive ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
