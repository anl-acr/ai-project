import React from "react";
import {
  QrCode,
  ArrowLeftRight,
  Zap,
  Mic,
  Headphones,
  Bell,
  Grid3X3,
  Phone,
  Users,
  MessageSquare,
  Laptop,
} from "lucide-react";

export function RunaMobileVisual() {
  return (
    <div className="relative flex flex-col sm:flex-row items-center justify-center gap-5 px-5 py-6 bg-gradient-to-br from-sky-50/70 via-slate-50 to-indigo-50/70 overflow-hidden min-h-[396px]">
      {/* Subtle studio ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 top-1/2 -translate-y-1/2 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 bottom-0 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl"
      />

      {/* Left: Realistic iPhone Bezel Wrapping REAL Runa Mobil Screen */}
      <div className="relative z-10 w-[184px] shrink-0 rounded-[28px] border-[5px] border-slate-900 bg-white shadow-floating overflow-hidden">
        {/* Dynamic Island & Status Bar */}
        <div className="flex items-center justify-between bg-white px-3 pt-2 pb-1">
          <span className="text-[9px] font-bold text-slate-800">09:41</span>
          <div className="h-3.5 w-14 rounded-full bg-slate-900" aria-hidden="true" />
          <span className="text-[8px] font-bold text-slate-700">5G</span>
        </div>

        {/* App Header Bar with Real Runa Logo */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src="/runa-logo.png"
              alt="Runa Mobil logosu"
              className="h-5 w-5 rounded-md shadow-2xs shrink-0"
            />
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] font-extrabold text-slate-950 truncate">
                Runa Mobil
              </div>
              <div className="flex items-center gap-1 text-[8px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Dahili 1000
              </div>
            </div>
          </div>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[7.5px] font-bold text-indigo-700">
            HD
          </span>
        </div>

        {/* REAL Runa Mobile Dialpad Screenshot (full dialpad + Çağrı Başlat visible) */}
        <div className="bg-white px-1.5 py-1">
          <img
            src="/screenshots/runa-mobile-real.jpg"
            alt="Runa Mobil gerçek Web Telefon tuş takımı ve canlı çağrı ekranı"
            loading="lazy"
            className="block w-full h-[268px] object-contain bg-white"
          />
        </div>

        {/* Native Mobile Bottom Tab Bar */}
        <div className="grid grid-cols-4 border-t border-slate-100 bg-white px-1 py-1.5 text-center">
          <div className="flex flex-col items-center gap-0.5 text-indigo-700">
            <Grid3X3 className="h-3 w-3" aria-hidden="true" />
            <span className="text-[7px] font-bold">Tuş</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400">
            <Phone className="h-3 w-3" aria-hidden="true" />
            <span className="text-[7px] font-medium">Çağrı</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400">
            <Users className="h-3 w-3" aria-hidden="true" />
            <span className="text-[7px] font-medium">Rehber</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            <span className="text-[7px] font-medium">Sohbet</span>
          </div>
        </div>
      </div>

      {/* Right: Exact 3 Crisp Floating Notification / Feature Cards */}
      <div className="relative z-10 flex w-full max-w-[270px] flex-col gap-2.5">
        {/* Card 1: QR Setup */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur p-3 shadow-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-950 leading-snug">
              QR ile Tek Taramada Kurulum
            </div>
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Şifresiz 3 sn Giriş
            </span>
          </div>
        </div>

        {/* Card 2: Call Flip */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur p-3 shadow-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
            <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-950 leading-snug">
              Call Flip
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-600 leading-snug">
              Görüşmeyi Kesmeden Cebe Aktar
            </div>
          </div>
        </div>

        {/* Card 3: PushKit & FCM */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur p-3 shadow-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-950 leading-snug">
              PushKit &amp; FCM
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-600 leading-snug">
              Uygulama Kapalıyken Bile Anında Çalar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunaDesktopVisual() {
  return (
    <div className="relative flex flex-col justify-between px-4 pt-6 pb-5 bg-gradient-to-br from-indigo-50/60 via-slate-50 to-emerald-50/60 overflow-hidden min-h-[396px]">
      {/* Subtle studio ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-6 h-48 w-48 rounded-full bg-indigo-200/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 bottom-4 h-48 w-48 rounded-full bg-emerald-200/35 blur-3xl"
      />

      {/* Native macOS/Windows Desktop Window Wrapping REAL Runa Desktop Screenshot */}
      <div className="relative z-10 mx-auto w-full rounded-2xl border border-slate-200/90 bg-white shadow-floating overflow-hidden">
        {/* Native Electron Titlebar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3 py-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex items-center gap-1.5">
            <img
              src="/runa-logo.png"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 rounded"
            />
            <span className="text-[11px] font-bold text-slate-800">
              Runa Masaüstü • Dahili 1000 • Müsait
            </span>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        </div>

        {/* REAL Runa Desktop UI Screenshot */}
        <img
          src="/screenshots/runa-desktop-real.jpg"
          alt="Runa Masaüstü gerçek macOS ve Windows temsilci uygulaması ekranı"
          loading="lazy"
          className="block w-full h-[256px] object-cover object-top"
        />
      </div>

      {/* Exact 2 Crisp Floating Bottom Cards Over/Under Desktop Frame */}
      <div className="relative z-20 -mt-10 grid grid-cols-1 gap-2.5 sm:grid-cols-2 px-1">
        {/* Bottom-left: 3 Independent Audio Devices */}
        <div className="rounded-2xl border border-slate-200/95 bg-white/95 backdrop-blur p-3 shadow-card">
          <div className="text-[11px] font-extrabold text-slate-950">
            3 Bağımsız Ses Donanımı
          </div>
          <ul className="mt-1.5 space-y-1 text-[10.5px] font-medium text-slate-600">
            <li className="flex items-center gap-1.5">
              <Mic className="h-3 w-3 shrink-0 text-indigo-600" aria-hidden="true" />
              <span>Mikrofon: Jabra USB</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Headphones className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
              <span>Kulaklık: Bluetooth Headset</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Bell className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>Çalma Zili: Masaüstü Hoparlör</span>
            </li>
          </ul>
        </div>

        {/* Bottom-right: macOS & Windows (.dmg / .exe) */}
        <div className="flex flex-col justify-center rounded-2xl border border-slate-200/95 bg-white/95 backdrop-blur p-3 shadow-card">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-950">
            <Laptop className="h-3.5 w-3.5 shrink-0 text-indigo-700" aria-hidden="true" />
            <span>macOS &amp; Windows (.dmg / .exe)</span>
          </div>
          <p className="mt-1 text-[10.5px] font-medium text-slate-600 leading-snug">
            Çağrıda Pencereyi Öne Getir • Sistem Tepsisi (Tray)
          </p>
          <span className="mt-1.5 inline-flex w-fit rounded-full bg-indigo-50 px-2 py-0.5 text-[9.5px] font-semibold text-indigo-700">
            Apple Silicon + Intel + Win11
          </span>
        </div>
      </div>
    </div>
  );
}
