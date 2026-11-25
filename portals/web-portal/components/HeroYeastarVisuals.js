import React from "react";
import {
  PhoneCall,
  MessageSquare,
  Sparkles,
  Languages,
  CheckCircle2,
  Mic,
  Pause,
  PhoneForwarded,
  Volume2,
  Settings,
  ShieldCheck,
} from "lucide-react";

/**
 * Top Panoramic Yeastar-style Hero Visual Stage:
 * Soft rounded studio stage + Real Nornia Web/Desktop Panel (LCP image with fetchPriority="high")
 * + Overlapping Runa Mobil device + Floating Glass Active-Call / AI / Live-Translate cards & glossy orbs.
 */
export function HeroPanoramicStage() {
  return (
    <div className="relative mx-auto mt-10 sm:mt-12 max-w-6xl">
      {/* Soft wide rounded studio stage (Yeastar top banner proportions) */}
      <div className="nornia-hero-stage relative overflow-visible rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-slate-100/95 via-white to-indigo-50/75 px-4 pt-6 pb-7 sm:px-8 sm:pt-10 sm:pb-10 lg:px-12 lg:pt-12 lg:pb-12 shadow-soft">
        {/* Ambient architectural light blobs (pure CSS, zero layout cost) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
        >
          <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute -right-16 top-8 h-80 w-80 rounded-full bg-indigo-200/45 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-48 w-96 rounded-full bg-emerald-100/40 blur-3xl" />
        </div>

        {/* Floating Top-Center Glossy Chat Orb (Yeastar signature floating icon) */}
        <div
          aria-hidden="true"
          className="nornia-float-slow hidden md:flex absolute -top-5 left-[28%] z-30 h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-floating ring-1 ring-slate-200/80"
        >
          <MessageSquare className="h-5 w-5" />
        </div>

        {/* Floating Top-Right Active Call Pill (exact Yeastar "00:01:18" floating call card) */}
        <div className="nornia-float-delayed hidden sm:flex absolute -top-4 right-4 lg:-right-4 z-30 items-center gap-3 rounded-2xl border border-white/90 bg-white/95 px-4 py-3 shadow-floating backdrop-blur-md">
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-xs font-extrabold text-white shadow-sm">
              SD
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
              <PhoneCall className="h-2.5 w-2.5 text-white" aria-hidden="true" />
            </span>
          </div>
          <div className="pr-1">
            <div className="text-xs font-extrabold text-slate-900 leading-tight">
              Selin Demir
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              00:01:42 • HD WebRTC
            </div>
          </div>
        </div>

        {/* Floating Right Glossy Green Phone Orb */}
        <div
          aria-hidden="true"
          className="nornia-float-slow hidden lg:flex absolute top-1/2 -right-5 z-30 h-13 w-13 p-3 items-center justify-center rounded-full bg-white text-emerald-600 shadow-floating ring-1 ring-emerald-100"
        >
          <PhoneCall className="h-5 w-5" />
        </div>

        {/* Floating Bottom-Center Amber Settings / Automation Orb */}
        <div
          aria-hidden="true"
          className="nornia-float-delayed hidden lg:flex absolute -bottom-5 left-[44%] z-30 h-11 w-11 items-center justify-center rounded-full bg-white text-amber-500 shadow-floating ring-1 ring-amber-100"
        >
          <Settings className="h-5 w-5" />
        </div>

        {/* Main Layered Product Composition */}
        <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Center-Left Primary Real Nornia Desktop/Web Panel Window (LCP Candidate) */}
          <div className="relative lg:col-span-9 lg:col-start-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-floating">
              {/* Sleek Window Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <img
                    src="/favicon.svg"
                    alt=""
                    aria-hidden="true"
                    width={18}
                    height={18}
                    className="ml-2 h-[18px] w-[18px] rounded"
                  />
                  <span className="text-xs font-bold text-slate-900">
                    Nornia Kurumsal AI Santral
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Canlı Panel
                  </span>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  sirketiniz.nornia.com.tr
                </span>
              </div>

              {/* Real Nornia Screenshot — LCP Priority Elevated (modern-web-guidance: optimize-image-priority) */}
              <img
                src="/screenshots/active-call-panel.jpg"
                alt="Nornia Kurumsal Yapay Zeka Santral Temsilci Çağrı Paneli, WebRTC Web Telefon ve AI Canlı Çağrı Çevirisi ekranı"
                width={1944}
                height={1215}
                decoding="async"
                {...{ fetchpriority: "high" }}
                className="block w-full h-auto"
              />
            </div>

            {/* Overlapping Left Floating AI / Omnichannel Chat Bubble */}
            <div className="hidden md:flex absolute -left-8 lg:-left-16 top-[22%] z-20 max-w-[270px] items-start gap-2.5 rounded-2xl border border-white/95 bg-white/95 p-3.5 shadow-floating backdrop-blur-md">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-slate-900">
                    AI Sesli &amp; WhatsApp Asistan
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">0.8 sn</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                  &ldquo;Merhaba, yarın 14:30 için randevunuz oluşturuldu.&rdquo;
                </p>
              </div>
            </div>

            {/* Overlapping Bottom-Left Real Runa Mobil Frame */}
            <div className="hidden md:block absolute -left-10 lg:-left-14 -bottom-6 z-20 w-[132px] lg:w-[152px] overflow-hidden rounded-[1.5rem] border-[4px] border-slate-900 bg-slate-900 shadow-floating">
              <div className="mx-auto my-1 h-1 w-10 rounded-full bg-slate-700" aria-hidden="true" />
              <div className="overflow-hidden rounded-[1.1rem] bg-white max-h-[215px]">
                <img
                  src="/screenshots/runa-mobile-real.jpg"
                  alt="Runa Mobil iOS ve Android kurumsal softphone ekranı"
                  width={375}
                  height={1030}
                  className="block w-full h-auto object-cover object-top"
                />
              </div>
            </div>

            {/* Overlapping Bottom-Right Live AI Translation Pill */}
            <div className="hidden sm:flex absolute -bottom-4 right-2 lg:-right-12 z-20 items-center gap-3 rounded-2xl border border-indigo-200/80 bg-slate-950/95 px-4 py-3 text-white shadow-floating backdrop-blur-md">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/25 text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                <Languages className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-white">
                    AI Canlı Çeviri • 6 Dil
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    EN ↔ TR
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">
                  Simultane çift yönlü sesli dublaj aktif
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Second Half of Yeastar Reference Visual:
 * Left: Pastel-blue rounded 3D-angled multi-device composition (Runa Mobil + Nornia Desktop + Dark Active Call card + 3D Phone Orb)
 * Right: Clean Editorial Heading + 2x2 Green Checkmark Feature Grid ("Kolay, Hızlı ve Ölçeklenebilir Santral Yazılımı")
 */
export function HeroIsometricShowcase() {
  return (
    <section
      aria-labelledby="scalable-pbx-heading"
      className="border-b border-slate-200/80 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
          {/* LEFT: Yeastar-style Pastel Sky-Indigo 3D Perspective Product Stage */}
          <div className="lg:col-span-6">
            <div className="nornia-iso-stage relative overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-indigo-50/70 to-sky-100/90 p-6 sm:p-8 lg:p-10 shadow-soft">
              {/* Soft radial glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/80 blur-2xl"
              />

              {/* 3D Angled Multi-Device Composition */}
              <div className="nornia-iso-group relative mx-auto max-w-[520px] py-3">
                {/* Back-Right Angled Nornia Desktop Window */}
                <div className="nornia-iso-desktop ml-auto w-[86%] overflow-hidden rounded-2xl border border-white bg-white shadow-floating">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <img
                      src="/favicon.svg"
                      alt=""
                      aria-hidden="true"
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 rounded"
                    />
                    <span className="text-[10px] font-bold text-slate-700">
                      Nornia Masaüstü &amp; Web Panel
                    </span>
                  </div>
                  <img
                    src="/screenshots/runa-desktop-real.jpg"
                    alt="Nornia Runa Masaüstü uygulaması çağrı ve rehber ekranı"
                    width={1595}
                    height={1120}
                    loading="lazy"
                    className="block w-full h-auto"
                  />
                </div>

                {/* Front-Left Angled Runa Mobil Phone */}
                <div className="nornia-iso-mobile absolute left-0 top-6 z-10 w-[29%] overflow-hidden rounded-2xl border-2 border-white bg-white shadow-floating">
                  <div className="max-h-[210px] overflow-hidden">
                    <img
                      src="/screenshots/runa-mobile-real.jpg"
                      alt="Runa Mobil dahili telefon ekranı"
                      width={375}
                      height={1030}
                      loading="lazy"
                      className="block w-full h-auto object-cover object-top"
                    />
                  </div>
                </div>

                {/* Center-Front Dark Floating Active Call Card (matches Yeastar's dark call window) */}
                <div className="nornia-iso-callcard relative z-20 -mt-20 ml-[20%] w-[56%] rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 text-white shadow-floating backdrop-blur-md">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      HD Görüşme Aktif
                    </span>
                    <span className="font-mono">00:02:14</span>
                  </div>
                  <div className="mt-3 flex flex-col items-center text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-extrabold text-white ring-4 ring-indigo-500/20">
                      MY
                    </span>
                    <div className="mt-2 text-xs font-bold text-white">Mert Yılmaz</div>
                    <div className="text-[10px] text-slate-400">
                      0850 360 73 90 • Dahili 1000
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-3.5 flex items-center justify-center gap-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-200">
                      <Mic className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-200">
                      <Pause className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-200">
                      <PhoneForwarded className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/30 text-indigo-200">
                      <Volume2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white">
                      <PhoneCall className="h-3.5 w-3.5 rotate-[135deg]" />
                    </span>
                  </div>
                </div>

                {/* Glossy Blue/Indigo 3D Phone Call Orb (Bottom-Left foreground) */}
                <div
                  aria-hidden="true"
                  className="absolute bottom-2 left-3 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-indigo-600 to-indigo-700 text-white shadow-floating ring-4 ring-white/90"
                >
                  <PhoneCall className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Clean Editorial Copy + 2x2 Emerald Checkmark Grid */}
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Tek Yazılım, Eksiksiz Kurumsal İletişim
            </span>

            <h2
              id="scalable-pbx-heading"
              className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:leading-[1.15]"
            >
              Kolay, Hızlı ve Ölçeklenebilir Santral Yazılımı
            </h2>

            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Tüm kurumsal iletişim ihtiyaçlarınızı tek sistemde karşılayın. Nornia yazılım
              tabanlı santral mimarisi, ekstra lisans karmaşası olmadan kurulduğu ilk andan
              itibaren tüm temel ve ileri yetenekleri sunar.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {[
                {
                  text: "Web, Runa Mobil (iOS/Android) ve Runa Masaüstü istemcileriyle her yerden kesintisiz kurumsal iletişim.",
                },
                {
                  text: "Sezgisel yönetim arayüzü; sürükle-bırak IVR, 44+ canlı rapor, merkezi firmware ve arayüzden sunucu yönetimi.",
                },
                {
                  text: "Mevcut 0850 / 0212 SIP Trunk hatlarınız ve Yealink, Grandstream, Fanvil, Cisco telefonlarla tam oto-provizyon.",
                },
                {
                  text: "Kendi sunucunuzda (On-Premise) tam veri hakimiyeti veya Nornia Bulut & Multi-Tenant ile anında ölçeklenme.",
                },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
