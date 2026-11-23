import React, { useEffect } from "react";
import Head from "next/head";
import { Printer, ArrowLeft } from "lucide-react";
import { MANUAL_CHAPTERS, MANUAL_META } from "../../data/manualChapters";
import ChapterArticle from "../../components/ChapterArticle";

export async function getStaticPaths() {
  const paths = MANUAL_CHAPTERS.map((c) => ({ params: { slug: c.id } }));
  paths.push({ params: { slug: "all" } });
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  return { props: { slug: params.slug } };
}

export default function PrintableModulePage({ slug }) {
  const isAll = slug === "all";
  const chaptersToRender = isAll
    ? MANUAL_CHAPTERS
    : MANUAL_CHAPTERS.filter((c) => c.id === slug);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qp = new URLSearchParams(window.location.search);
    if (qp.get("autoprint") === "1") {
      const t = setTimeout(() => {
        window.print();
      }, 450);
      return () => clearTimeout(t);
    }
  }, []);

  const title = isAll
    ? `${MANUAL_META.productName} — Tam Kullanım Kılavuzu (${MANUAL_META.version})`
    : `${chaptersToRender[0]?.number}. ${chaptersToRender[0]?.title} — Nornia Kullanım Kılavuzu`;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Head>
        <title>{title}</title>
      </Head>

      {/* Top Print Toolbar (hidden inside actual PDF) */}
      <div className="no-print sticky top-0 z-30 bg-slate-900 text-white px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <a
            href={isAll ? "/" : `/#${slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
          >
            <ArrowLeft size={14} />
            <span>Kılavuza Dön</span>
          </a>
          <span className="text-xs font-bold text-slate-300 hidden sm:inline">{title}</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer"
        >
          <Printer size={14} />
          <span>PDF Olarak Kaydet / Yazdır</span>
        </button>
      </div>

      {/* Print Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {isAll && (
          <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-slate-900 text-white space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
              RESMİ KULLANIM KILAVUZU • {MANUAL_META.version}
            </div>
            <h1 className="text-3xl font-black tracking-tight">{MANUAL_META.productName}</h1>
            <p className="text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Kurulum, Santral Temelleri, Görsel Arama Akışı, Çağrı Merkezi (ACD), Yapay Zeka Suite,
              Omnichannel, Oto Provizyon, Raporlama, Güvenlik ve Merkezi Yönetim için tam kapsamlı rehber.
            </p>
            <div className="pt-4 border-t border-white/20 text-xs text-indigo-200 flex items-center justify-between">
              <span>{MANUAL_META.docsPortalUrl} • {MANUAL_META.apiPortalUrl}</span>
              <span>Güncelleme: {MANUAL_META.updatedAt}</span>
            </div>
          </div>
        )}

        {chaptersToRender.map((ch, idx) => (
          <div key={ch.id} className={isAll && idx > 0 ? "print-page-break" : ""}>
            <ChapterArticle chapter={ch} printMode={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
