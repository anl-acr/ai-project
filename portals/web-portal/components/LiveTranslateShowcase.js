import React, { useState } from "react";
import {
  Languages,
  Volume2,
  Keyboard,
  Sparkles,
  Headphones,
  CheckCircle2,
  ArrowRight,
  BookOpen,
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

export default function LiveTranslateShowcase() {
  const [langCode, setLangCode] = useState("EN");
  const [voiceDubOn, setVoiceDubOn] = useState(true);

  const sample =
    TRANSLATE_SAMPLES.find((item) => item.code === langCode) || TRANSLATE_SAMPLES[0];

  return (
    <section
      id="canli-ceviri"
      className="border-t border-slate-200/80 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Explanation Column */}
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              AI Real-Time Çağrı Çevirisi • 6 Dil
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Dil Bariyerini Kaldıran Simultane Sesli Tercüman
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Yabancı dil bilmeyen temsilcileriniz bile aktif telefon görüşmesi sırasında
              İngilizce, Almanca, Rusça, Arapça, Fransızca ve İspanyolca konuşan
              müşterilerle anlık altyazı ve çift yönlü sesli dublajla akıcı iletişim kurar.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                "Çift yönlü Oto. Sesli Çeviri: Temsilci Türkçe konuşur, müşteri kendi dilinde doğal sesle dinler",
                "Simultaneous Audio Ducking: Müşteri konuşurken orijinal ses kısılıp Türkçe dublaj kulaklığınıza verilir",
                "Yazarak Seslendir: Temsilcinin yazdığı Türkçe yanıt anında hedef dile çevrilip aktif hatta sesli okunur",
                "3 ses çıkış modu (Sadece Müşteri • Müşteri + Ben • Sadece Ben) ve rol bazlı yetkilendirme",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#demo"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-950 px-5 py-3 text-xs font-semibold text-white hover:bg-indigo-900 transition min-h-[44px]"
              >
                Canlı Çeviriyi Test Et
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href="https://dokuman.nornia.com.tr/cagri-paneli-web-telefon-aktif-cagri/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition min-h-[44px]"
              >
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                Aktif Çağrı Kılavuzu
              </a>
            </div>
          </div>

          {/* Right Interactive Live Translator Card */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/40 p-5 sm:p-7 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950 text-white shadow-sm">
                    <Languages className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                      <span>Canlı Konuşma &amp; Çeviri</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Canlı Dinleniyor
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Dil seçerek gerçek zamanlı 2 yönlü çeviri akışını önizleyin
                    </div>
                  </div>
                </div>

                {/* Interactive Voice Dubbing Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={voiceDubOn}
                  onClick={() => setVoiceDubOn((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    voiceDubOn
                      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <Volume2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  <span>Oto. Sesli Çeviri: {voiceDubOn ? "Açık" : "Sadece Altyazı"}</span>
                </button>
              </div>

              {/* 6 Real Nornia Language Pills */}
              <div
                role="tablist"
                aria-label="Canlı çağrı çeviri dili önizlemesi"
                className="mt-5 flex flex-wrap items-center gap-2"
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
                      className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition min-h-[40px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        active
                          ? "bg-indigo-950 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {item.code} • {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Two-way Simultaneous Translation Bubbles */}
              <div className="mt-5 space-y-3">
                {/* Customer -> Agent (TR) */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Hattaki Müşteri ({sample.code} • {sample.label})</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      → Anlık Türkçe Altyazı &amp; Ses
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm italic text-slate-500 leading-relaxed">
                    &ldquo;{sample.customerOriginal}&rdquo;
                  </p>
                  <p className="mt-1.5 text-sm sm:text-base font-bold text-slate-950 leading-relaxed">
                    {sample.customerTr}
                  </p>
                </div>

                {/* Agent (TR) -> Customer (Target Language Audio) */}
                <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-800">
                    <span>Temsilci (Türkçe)</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
                      {voiceDubOn ? (
                        <>
                          <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                          Hatta {sample.code} Sesli Dublaj
                        </>
                      ) : (
                        <>
                          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                          Yazarak {sample.code} Seslendir
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    &ldquo;{sample.agentTr}&rdquo;
                  </p>
                  <p className="mt-1.5 text-sm sm:text-base font-bold text-indigo-950 leading-relaxed">
                    {sample.agentDub}
                  </p>
                </div>
              </div>

              {/* Footer strip */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/90 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span>Audio Ducking &amp; Yazarak Seslendir dahili</span>
                </span>
                <span className="font-semibold text-slate-800">
                  Sadece Müşteri • Müşteri + Ben • Sadece Ben
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
