import React, { useState } from "react";
import Head from "next/head";
import { FileDown, Printer, BookOpen, CheckCircle2, Layers } from "lucide-react";
import DocsShell from "../components/DocsShell";
import ChapterArticle from "../components/ChapterArticle";
import { MANUAL_CHAPTERS, getChapterById } from "../data/manualChapters";

export async function getStaticPaths() {
  return {
    paths: MANUAL_CHAPTERS.map((c) => ({ params: { slug: c.id } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const chapter = getChapterById(params.slug);
  const bundleChapters = Array.isArray(chapter?.compositeChapterIds)
    ? chapter.compositeChapterIds.map((cid) => getChapterById(cid)).filter(Boolean)
    : [];
  return {
    props: {
      chapter,
      bundleChapters
    }
  };
}

export default function ManualChapterPage({ chapter, bundleChapters = [] }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!chapter) return null;

  const isComposite = bundleChapters.length > 0;

  const handleDownloadCompositePdf = async () => {
    const pdfPath = `/pdfs/${chapter.id}.pdf`;
    const downloadName = chapter.compositePdfFilename || `nornia-${chapter.id}.pdf`;
    setDownloadingPdf(true);
    try {
      const head = await fetch(pdfPath, { method: "HEAD" });
      if (head.ok) {
        const a = document.createElement("a");
        a.href = pdfPath;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setDownloadingPdf(false);
        return;
      }
    } catch (_) {}
    setDownloadingPdf(false);
    window.open(`/print/${chapter.id}/?autoprint=1`, "_blank", "noopener,noreferrer");
  };

  return (
    <DocsShell activeChapter={chapter}>
      <Head>
        <title>
          {chapter.number}. {chapter.title} — Nornia Doküman
        </title>
        <meta name="description" content={chapter.summary} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      {isComposite ? (
        <div className="space-y-10">
          {/* Composite Training Guide Hero */}
          <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-indigo-50/75 to-cyan-50/50 dark:from-slate-900 dark:via-indigo-950/60 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-500/30 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono text-[11px] font-black">
                  BÖLÜM {chapter.number}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-400/30 text-cyan-800 dark:text-cyan-200 text-[11px] font-extrabold">
                  {chapter.badge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCompositePdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer transition disabled:opacity-60"
                >
                  <FileDown size={15} />
                  <span>{downloadingPdf ? "PDF Hazırlanıyor..." : "Tek PDF İndir (Eğitim Kılavuzu)"}</span>
                </button>
                <a
                  href={`/print/${chapter.id}/?autoprint=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition"
                >
                  <Printer size={14} />
                  <span>Yazdır</span>
                </a>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {chapter.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {chapter.summary}
              </p>
            </div>

            {/* Included 12 Chapters Jump Grid */}
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                  <Layers size={14} />
                  <span>Bu Eğitim Kılavuzunda Yer Alan Tüm Bölümler ({bundleChapters.length} Bölüm)</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  Profil &amp; Avatar + Oturum/Mola + 10 Çağrı Paneli Sekmesi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {bundleChapters.map((sub, idx) => (
                  <a
                    key={sub.id}
                    href={`#bundle-${sub.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 text-xs transition"
                  >
                    <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {sub.shortTitle || sub.title}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {chapter.prerequisites?.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {chapter.prerequisites.map((pre, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{pre}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* All 12 Bundled Chapters in Full Detail */}
          <div className="space-y-14">
            {bundleChapters.map((sub, idx) => (
              <div
                key={sub.id}
                id={`bundle-${sub.id}`}
                className="scroll-mt-24 pt-8 border-t-2 border-indigo-200/70 dark:border-indigo-900/50 space-y-4"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold">
                  <BookOpen size={12} />
                  <span>
                    Eğitim Kılavuzu — Kısım {idx + 1}/{bundleChapters.length}: {sub.shortTitle || sub.title}
                  </span>
                </div>
                <ChapterArticle key={`${chapter.id}-${sub.id}`} chapter={sub} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ChapterArticle key={chapter.id} chapter={chapter} />
      )}
    </DocsShell>
  );
}
