import React, { useState } from "react";
import {
  Languages,
  Volume2,
  Keyboard,
  Radio,
  Sparkles,
  Headphones,
} from "lucide-react";

const TRANSLATE_SAMPLES = [
  {
    code: "EN",
    label: "İngilizce",
    customerOriginal: "Hello, I would like to schedule an appointment for tomorrow at 2 PM.",
    customerTr: "Merhaba, yarın saat 14:00 için randevu oluşturmak istiyorum.",
    agentTr: "Memnuniyetle, yarın 14:00 için randevunuzu onaylıyorum.",
    agentDub: "With pleasure, I am confirming your appointment for tomorrow at 2:00 PM.",
  },
  {
    code: "DE",
    label: "Almanca",
    customerOriginal: "Guten Tag, können Sie mir den Status meiner Bestellung nennen?",
    customerTr: "İyi günler, siparişimin durumunu paylaşabilir misiniz?",
    agentTr: "Siparişiniz kargoya verildi, takip kodunuzu WhatsApp'tan iletiyorum.",
    agentDub: "Ihre Bestellung wurde versandt, ich sende Ihnen den Tracking-Code per WhatsApp.",
  },
  {
    code: "RU",
    label: "Rusça",
    customerOriginal: "Здравствуйте, есть ли свободные номера на эти выходные?",
    customerTr: "Merhaba, bu hafta sonu için müsait odanız var mı?",
    agentTr: "Evet, deniz manzaralı 2 odamız müsait; hemen rezervasyon açabilirim.",
    agentDub: "Да, у нас свободны 2 номера с видом на море; могу сразу оформить бронь.",
  },
  {
    code: "AR",
    label: "Arapça",
    customerOriginal: "مرحباً، أريد الاستفسار عن باقات الشركات لديكم.",
    customerTr: "Merhaba, kurumsal paketleriniz hakkında bilgi almak istiyorum.",
    agentTr: "Kurumsal paket detaylarını şimdi paylaşıyorum, kaç kullanıcınız olacak?",
    agentDub: "سأشارك معك تفاصيل باقات الشركات الآن، كم عدد المستخدمين لديكم؟",
  },
  {
    code: "FR",
    label: "Fransızca",
    customerOriginal: "Bonjour, j'ai besoin d'une assistance technique urgente.",
    customerTr: "Merhaba, acil teknik desteğe ihtiyacım var.",
    agentTr: "Hemen yardımcı oluyorum, cihaz seri numaranızı paylaşır mısınız?",
    agentDub: "Je vous aide tout de suite, pouvez-vous partager votre numéro de série ?",
  },
  {
    code: "ES",
    label: "İspanyolca",
    customerOriginal: "Hola, ¿puedo cambiar la fecha de mi reserva?",
    customerTr: "Merhaba, rezervasyon tarihimi değiştirebilir miyim?",
    agentTr: "Elbette, hangi tarihe almak istediğinizi belirtmeniz yeterli.",
    agentDub: "Por supuesto, solo indíqueme a qué fecha desea cambiarla.",
  },
];

export default function HeroProductPreview() {
  const [langCode, setLangCode] = useState("EN");
  const [voiceDubOn, setVoiceDubOn] = useState(true);

  const sample =
    TRANSLATE_SAMPLES.find((item) => item.code === langCode) || TRANSLATE_SAMPLES[0];

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
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            <Languages className="h-3 w-3" aria-hidden="true" />
            AI Canlı Çeviri Dahili
          </span>
        </div>

        {/* Real Live Screenshot from Nornia PBX */}
        <div className="relative bg-slate-50">
          <img
            src="/screenshots/active-call-panel.jpg"
            alt="Nornia canlı Temsilci Çağrı Paneli, Web Telefon, aktif görüşme kontrolleri ve Canlı Konuşma & Çeviri arayüzü"
            className="block w-full h-auto"
          />
          {/* Subtle live highlight tag pointing to bottom-right Live Translator panel */}
          <div className="hidden sm:flex absolute bottom-2.5 right-2.5 items-center gap-1.5 rounded-full border border-indigo-200/90 bg-white/95 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-indigo-950 shadow-sm">
            <Radio className="h-3 w-3 text-emerald-600" aria-hidden="true" />
            <span>Canlı Konuşma &amp; Çeviri Aktif</span>
          </div>
        </div>
      </div>

      {/* Interactive AI Real-Time Call Translate Live Preview Card */}
      <div className="relative z-10 mt-3.5 rounded-2xl border border-indigo-200/80 bg-white/95 backdrop-blur p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950 text-white shadow-2xs">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
                <span>AI Real-Time Çağrı Çevirisi</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Simultane
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                6 dilde anlık altyazı, çift yönlü sesli dublaj &amp; yazarak seslendirme
              </div>
            </div>
          </div>

          {/* Interactive Voice Dubbing Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={voiceDubOn}
            onClick={() => setVoiceDubOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              voiceDubOn
                ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Oto. Sesli Çeviri: {voiceDubOn ? "Açık" : "Altyazı"}</span>
          </button>
        </div>

        {/* 6 Real Language Selector Pills */}
        <div
          role="tablist"
          aria-label="Canlı çağrı çeviri dili önizlemesi"
          className="mt-3 flex flex-wrap items-center gap-1.5"
        >
          {TRANSLATE_SAMPLES.map((item) => {
            const active = item.code === sample.code;
            return (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLangCode(item.code)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  active
                    ? "bg-indigo-950 text-white shadow-2xs"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                {item.code} • {item.label}
              </button>
            );
          })}
        </div>

        {/* Two-way Simultaneous Translation Preview Bubbles */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* Customer -> Agent (TR) */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <span>Müşteri ({sample.code})</span>
              <span className="text-indigo-700">→ Türkçe Anlık</span>
            </div>
            <p className="mt-1 text-[11px] italic text-slate-500 leading-snug">
              &ldquo;{sample.customerOriginal}&rdquo;
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 leading-snug">
              {sample.customerTr}
            </p>
          </div>

          {/* Agent (TR) -> Customer (Target Language Audio) */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-700">
              <span>Temsilci (TR)</span>
              <span className="inline-flex items-center gap-1">
                {voiceDubOn ? (
                  <>
                    <Headphones className="h-3 w-3" aria-hidden="true" />
                    {sample.code} Sesli Okunur
                  </>
                ) : (
                  <>
                    <Keyboard className="h-3 w-3" aria-hidden="true" />
                    Yazarak Seslendir
                  </>
                )}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              &ldquo;{sample.agentTr}&rdquo;
            </p>
            <p className="mt-1 text-xs font-semibold text-indigo-950 leading-snug">
              {sample.agentDub}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-600" aria-hidden="true" />
            Audio Ducking: Müşteri sesi kısılıp Türkçe dublaj kulaklığınıza verilir
          </span>
          <span className="font-semibold text-slate-700">
            Sadece Müşteri • Müşteri + Ben • Sadece Ben
          </span>
        </div>
      </div>
    </div>
  );
}
