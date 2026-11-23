import React, { useEffect } from "react";
import Head from "next/head";
import { MANUAL_CHAPTERS, MANUAL_META } from "../../data/manualChapters";
import ChapterArticle from "../../components/ChapterArticle";

export async function getStaticPaths() {
  const paths = [{ params: { slug: "all" } }, ...MANUAL_CHAPTERS.map((c) => ({ params: { slug: c.id } }))];
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const slug = params?.slug || "all";
  const isAll = slug === "all";
  const chapters = isAll ? MANUAL_CHAPTERS : MANUAL_CHAPTERS.filter((c) => c.id === slug);
  return {
    props: {
      slug,
      isAll,
      chapters
    }
  };
}

export default function PrintManualPage({ isAll, chapters }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoprint") === "1") {
      const t = setTimeout(() => {
        window.print();
      }, 650);
      return () => clearTimeout(t);
    }
  }, []);

  const docTitle = isAll
    ? `${MANUAL_META.product} — Tam Kullanım Kılavuzu (${MANUAL_META.version})`
    : `${MANUAL_META.product} — Bölüm ${chapters[0]?.number}: ${chapters[0]?.title}`;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Head>
        <title>{docTitle}</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
      </Head>

      {/* Top Print Controls (Hidden in PDF) */}
      <div className="no-print sticky top-0 z-20 bg-slate-900 text-white px-6 py-3 flex items-center justify-between gap-3">
        <div className="text-xs font-bold flex items-center gap-2">
          <img src="/favicon.svg" alt="Nornia" className="h-5 w-5 object-contain" />
          <span>{docTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold cursor-pointer"
          >
            PDF Olarak Kaydet / Yazdır
          </button>
          <a
            href={isAll ? "/" : `/${chapters[0]?.id}/`}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
          >
            Kılavuza Dön
          </a>
        </div>
      </div>

      {/* Corporate PDF Cover Header — EXACT NORNIA LOGO */}
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 space-y-10">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 p-1.5 border border-white/15 flex items-center justify-center">
                <img src="/favicon.svg" alt="Nornia Logo" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <div
                  className="text-lg font-black tracking-tight bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #4ADE80 0%, #38BDF8 28%, #C084FC 58%, #F472B6 80%, #FB923C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  Nornia
                </div>
                <div className="text-[11px] text-indigo-200 font-semibold">
                  Akıllı İletişim Platformu — Kurumsal Kullanım Kılavuzu
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-indigo-200">
              <div>{MANUAL_META.version}</div>
              <div>{MANUAL_META.updatedAt}</div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight pt-2">
            {isAll
              ? `Nornia Enterprise AI PBX — Tam Kullanım Kılavuzu (${MANUAL_CHAPTERS.length} Menü)`
              : `Bölüm ${chapters[0]?.number}: ${chapters[0]?.title}`}
          </h1>
          <p className="text-xs text-indigo-100 leading-relaxed">
            {isAll
              ? `Tüm ${MANUAL_CHAPTERS.length} menü sayfasının canlı ekran görüntülerini, parametre referans tablolarını, rol yetki kodlarını, yapılandırma örneklerini ve sorun giderme rehberlerini içeren resmi kurumsal el kitabı.`
              : chapters[0]?.summary}
          </p>
        </div>

        {/* Table of Contents for Full Manual */}
        {isAll && (
          <div className="p-6 rounded-2xl border border-slate-200 space-y-3 print-page-break">
            <h2 className="text-base font-black text-slate-900">İçindekiler ({chapters.length} Bölüm)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              {chapters.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-slate-100"
                >
                  <span className="font-bold text-slate-800 truncate">
                    {c.number}. {c.shortTitle || c.title}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">{c.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chapters */}
        {chapters.map((ch, idx) => (
          <div key={ch.id} className={isAll && idx > 0 ? "print-page-break pt-4" : ""}>
            <ChapterArticle chapter={ch} printMode={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
