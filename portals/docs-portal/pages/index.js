import React from "react";
import Head from "next/head";
import Link from "next/link";
import { ArrowRight, FileDown, Code2, Sparkles, BookOpen, Shield, Cpu } from "lucide-react";
import DocsShell from "../components/DocsShell";
import { MANUAL_CHAPTERS, MANUAL_GROUPS, MANUAL_META } from "../data/manualChapters";

export default function DocsIndexPage() {
  return (
    <DocsShell activeChapter={null}>
      <Head>
        <title>Nornia Doküman — Detaylı Kurulum &amp; Kullanım Kılavuzu ({MANUAL_META.version})</title>
        <meta
          name="description"
          content="Nornia Enterprise AI PBX 50 sayfalık menü bazlı kapsamlı kullanım kılavuzu: canlı ekran görüntüleri, tüm parametre tabloları, yapılandırma örnekleri ve modül bazlı PDF indirme."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <div className="space-y-10">
        {/* Hero Banner */}
        <section className="p-6 sm:p-9 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl space-y-5 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm border border-white/15 flex items-center justify-center shrink-0">
              <img src="/favicon.svg" alt="Nornia Logo" className="h-9 w-9 object-contain" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold">
              <Sparkles size={13} className="text-amber-300" />
              <span>
                {MANUAL_META.product} • {MANUAL_META.version} • {MANUAL_CHAPTERS.length} Ayrı Menü Sayfası
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-3xl">
            Santralinizin Her Menüsü İçin En İnce Ayrıntısına Kadar Kullanım Kılavuzu
          </h1>

          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-3xl">
            Nornia santral arayüzündeki 7 ana menü grubu ve {MANUAL_CHAPTERS.length} ayrı modülün tamamı için gerçek canlı ekran görüntüleri, her form alanının teknik açıklaması, rol yetki kodları (RBAC), adım adım uygulama örnekleri, sorun giderme matrisleri ve tek tıkla indirilebilir kurumsal A4 PDF kılavuzları.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/ilk-kurulum-sihirbazi/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-extrabold shadow-md transition"
            >
              <BookOpen size={14} />
              <span>İlk Kurulumdan Başla</span>
              <ArrowRight size={14} />
            </Link>
            <a
              href={MANUAL_META.fullPdfPath}
              download={`nornia-kullanim-kilavuzu-${MANUAL_META.version}.pdf`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/45 border border-white/20 text-white text-xs font-extrabold transition"
            >
              <FileDown size={14} />
              <span>Tüm 50 Sayfayı Tek PDF İndir</span>
            </a>
            <a
              href="https://api.nornia.com.tr"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition"
            >
              <Code2 size={14} />
              <span>Geliştirici API Portalı</span>
            </a>
          </div>
        </section>

        {/* Quick Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="text-xs font-black">{MANUAL_CHAPTERS.length} Özel Menü Sayfası</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Santral sol menüsüyle birebir aynı 7 grup altında her ekrana özel URL ve alan referans tablosu.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileDown size={18} />
            </div>
            <div>
              <div className="text-xs font-black">51 Hazır Kurumsal PDF</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                İster sadece tek bir menünün PDF&apos;ini, ister tüm santralin tam kullanım kitabını anında indirin.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Shield size={18} />
            </div>
            <div>
              <div className="text-xs font-black">RBAC &amp; Canlı Görseller</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Her sayfada gerekli rol yetki kodları, canlı santral ekran görüntüsü ve sorun giderme çözümleri.
              </p>
            </div>
          </div>
        </div>

        {/* All 7 Menu Groups Directory */}
        <div className="space-y-8">
          {MANUAL_GROUPS.map((grp, gIdx) => {
            const items = MANUAL_CHAPTERS.filter((c) => c.groupId === grp.id);
            return (
              <section key={grp.id} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      GRUP {gIdx + 1} • {items.length} MENÜ SAYFASI
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {grp.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{grp.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {items.map((ch) => (
                    <div
                      key={ch.id}
                      className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition shadow-xs flex flex-col justify-between gap-3"
                    >
                      <Link href={`/${ch.id}/`} className="block space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black shrink-0">
                              {ch.number}
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                              {ch.shortTitle || ch.title}
                            </h3>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {ch.summary}
                        </p>
                      </Link>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[10px] font-bold text-slate-400 truncate">
                          {ch.fieldTable?.length || 0} parametre • {ch.badge}
                        </span>
                        <a
                          href={`/pdfs/${ch.id}.pdf`}
                          download={`nornia-${ch.number}-${ch.id}.pdf`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition shrink-0"
                          title={`${ch.shortTitle || ch.title} PDF indir`}
                        >
                          <FileDown size={11} />
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </DocsShell>
  );
}
