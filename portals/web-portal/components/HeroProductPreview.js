import React from "react";
import {
  MessageSquare,
  PhoneCall,
  Mic,
  Languages,
} from "lucide-react";

export default function HeroProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
      {/* Subtle light prism ambient halo behind window */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-sky-100/75 via-indigo-100/60 to-rose-100/50 blur-2xl"
      />

      {/* REAL Live Nornia Agent Call Panel Screenshot inside Light SaaS Frame */}
      <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-floating overflow-hidden">
        {/* Crisp Window Chrome */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              className="h-5 w-5 rounded-md shadow-2xs"
            />
            <span className="text-xs sm:text-sm font-semibold text-slate-900">
              Nornia Temsilci Çağrı Paneli
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Canlı Ekran
            </span>
          </div>
          <a
            href="#canli-ceviri"
            className="hidden sm:inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition"
          >
            <Languages className="h-3 w-3" aria-hidden="true" />
            AI Canlı Çeviri →
          </a>
        </div>

        {/* Real Live Screenshot from Nornia PBX */}
        <div className="relative bg-slate-50 pb-2">
          <img
            src="/screenshots/active-call-panel.jpg"
            alt="Nornia canlı Temsilci Çağrı Paneli, Web Telefon, aktif görüşme kontrolleri ve Canlı Konuşma & Çeviri arayüzü"
            className="block w-full h-auto"
          />
        </div>
      </div>

      {/* Clean Compact Bottom Micro-Cards (Seçenek 2 Balanced Proportions) */}
      <div className="relative z-10 mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="#platform"
          className="group rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur p-3.5 shadow-card hover:border-indigo-200 transition"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-2xs">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-900">
                WhatsApp &amp; Omnichannel
              </div>
              <div className="truncate text-[11px] text-slate-500">
                0850 WhatsApp, Instagram, Telegram &amp; E-posta
              </div>
            </div>
          </div>
        </a>

        <a
          href="#uygulamalar"
          className="group rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur p-3.5 shadow-card hover:border-indigo-200 transition"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-900">
                  Runa Mobil &amp; Masaüstü
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  iOS, Android, macOS &amp; Windows HD Ses
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Mic className="h-3 w-3" aria-hidden="true" />
              HD
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}
