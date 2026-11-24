import React, { useEffect } from "react";
import Head from "next/head";
import { MANUAL_CHAPTERS, MANUAL_GROUPS, MANUAL_META, getChapterById } from "../../data/manualChapters";
import ChapterArticle from "../../components/ChapterArticle";

export async function getStaticPaths() {
  const paths = [{ params: { slug: "all" } }, ...MANUAL_CHAPTERS.map((c) => ({ params: { slug: c.id } }))];
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const slug = params?.slug || "all";
  const isAll = slug === "all";
  if (isAll) {
    return {
      props: {
        slug,
        isAll: true,
        isComposite: false,
        compositeMeta: null,
        chapters: MANUAL_CHAPTERS.filter((c) => !c.isCompositeGuide)
      }
    };
  }
  const target = getChapterById(slug);
  if (target?.compositeChapterIds?.length > 0) {
    const bundle = target.compositeChapterIds.map((cid) => getChapterById(cid)).filter(Boolean);
    return {
      props: {
        slug,
        isAll: false,
        isComposite: true,
        compositeMeta: target,
        chapters: bundle
      }
    };
  }
  return {
    props: {
      slug,
      isAll: false,
      isComposite: false,
      compositeMeta: null,
      chapters: target ? [target] : []
    }
  };
}

function buildModuleTocItems(ch) {
  if (!ch) return [];
  const items = [];
  let seq = 1;
  items.push({ num: `${seq++}.`, label: "Genel Bakış, Menü Yolu & Rol Yetkileri", href: `#${ch.id}--genel`, level: 1 });
  if (ch.showSizingCalculator) {
    items.push({
      num: `${seq++}.`,
      label: "Sunucu Kaynak & Kapasite Boyutlandırma Rehberi",
      href: `#${ch.id}--hesaplayici`,
      level: 1
    });
  }
  if (ch.architectureDiagram) {
    items.push({
      num: `${seq++}.`,
      label: "Sistem Topolojisi & Servis Bağlantı Diyagramı",
      href: `#${ch.id}--mimari`,
      level: 1
    });
  }
  if (ch.screenshots && ch.screenshots.length > 0) {
    items.push({ num: `${seq++}.`, label: "Canlı Santral Arayüz Ekran Görüntüsü", href: `#${ch.id}--ekran`, level: 1 });
  }
  if (ch.fieldTable && ch.fieldTable.length > 0) {
    items.push({
      num: `${seq++}.`,
      label: `Tüm Alanlar, Parametreler & Teknik Etkileri (${ch.fieldTable.length} alan)`,
      href: `#${ch.id}--alanlar`,
      level: 1
    });
  }
  if (ch.editFormSections && ch.editFormSections.length > 0) {
    const parentNum = seq++;
    items.push({
      num: `${parentNum}.`,
      label: `Ekle / Düzenle & Alt Ekran Referansı (${ch.editFormSections.length} alt bölüm)`,
      href: `#${ch.id}--alt-ayarlar`,
      level: 1
    });
    ch.editFormSections.forEach((sub, idx) => {
      items.push({
        num: `${parentNum}.${idx + 1}`,
        label: sub.tabTitle,
        href: `#${ch.id}--edit-${idx + 1}`,
        level: 2
      });
    });
  }
  if (ch.sections && ch.sections.length > 0) {
    ch.sections.forEach((sec, idx) => {
      items.push({
        num: `${seq++}.`,
        label: sec.heading,
        href: `#${ch.id}--sec-${idx + 1}`,
        level: 1
      });
    });
  }
  if (ch.troubleshooting && ch.troubleshooting.length > 0) {
    items.push({
      num: `${seq++}.`,
      label: `Sık Karşılaşılan Hatalar & Sorun Giderme (${ch.troubleshooting.length} kayıt)`,
      href: `#${ch.id}--sorun`,
      level: 1
    });
  }
  return items;
}

export default function PrintManualPage({ isAll, isComposite = false, compositeMeta = null, chapters }) {
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

  const singleChapter = !isAll && !isComposite ? chapters[0] : null;
  const singleTocItems = singleChapter ? buildModuleTocItems(singleChapter) : [];

  const docTitle = isAll
    ? `${MANUAL_META.product} — Tam Kullanım Kılavuzu`
    : isComposite
    ? `${MANUAL_META.product} — ${compositeMeta?.title || "Eğitim Kılavuzu"}`
    : `${MANUAL_META.product} — Bölüm ${singleChapter?.number}: ${singleChapter?.title}`;

  const backHref = isAll ? "/" : isComposite ? `/${compositeMeta?.id}/` : `/${singleChapter?.id}/`;

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
            href={backHref}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
          >
            Kılavuza Dön
          </a>
        </div>
      </div>

      {/* Corporate PDF Cover + Clickable Table of Contents (Page 1) */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="print-avoid-break p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white space-y-4">
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
                  {isComposite
                    ? "Akıllı İletişim Platformu — Standart Kullanıcı & Temsilci Eğitim Kılavuzu"
                    : "Akıllı İletişim Platformu — Kurumsal Kullanım Kılavuzu"}
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight pt-1">
            {isAll
              ? `Nornia Enterprise AI PBX — Tam Kullanım Kılavuzu (${chapters.length} Bölüm)`
              : isComposite
              ? `${compositeMeta?.title} (${chapters.length} Bölüm)`
              : `Bölüm ${singleChapter?.number}: ${singleChapter?.title}`}
          </h1>
          <p className="text-xs text-indigo-100 leading-relaxed">
            {isAll
              ? `Tüm ${chapters.length} menü ve rapor sayfasının canlı ekran görüntülerini, parametre referans tablolarını, rol yetki kodlarını, adım adım uygulama rehberlerini ve sorun giderme çözümlerini içeren resmi kurumsal el kitabı.`
              : isComposite
              ? compositeMeta?.summary
              : singleChapter?.summary}
          </p>
        </div>

        {/* Clickable Table of Contents — Full Book PDF */}
        {isAll ? (
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">İçindekiler ({chapters.length} Bölüm)</h2>
                <p className="text-[11px] text-slate-500">
                  Herhangi bir bölüm başlığına tıklayarak doğrudan ilgili sayfaya gidebilirsiniz.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                Etkileşimli PDF Dizini
              </span>
            </div>

            <div className="space-y-4">
              {MANUAL_GROUPS.map((grp, gIdx) => {
                const grpChapters = chapters.filter((c) => c.groupId === grp.id);
                if (grpChapters.length === 0) return null;
                return (
                  <div key={grp.id} className="print-avoid-break space-y-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-100">
                      GRUP {gIdx + 1}: {grp.title} ({grpChapters.length} Bölüm)
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
                      {grpChapters.map((c) => (
                        <a
                          key={c.id}
                          href={`#chapter-${c.id}`}
                          className="flex items-center justify-between gap-2 py-1 border-b border-slate-200/70 text-[10.5px] text-slate-800 hover:text-indigo-700"
                        >
                          <span className="truncate font-semibold">
                            <span className="font-mono font-black text-indigo-600 mr-1.5">{c.number}.</span>
                            {c.shortTitle || c.title}
                          </span>
                          <span className="text-[9px] text-indigo-500 font-bold shrink-0">→</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isComposite ? (
          /* Clickable Table of Contents — Composite Training Bundle PDF */
          <div className="print-avoid-break p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Eğitim Kılavuzu İçindekiler ({chapters.length} Bölüm)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Profil &amp; Avatar Ayarları, Oturum/Mola Yönetimi ve Temsilci Çağrı Paneli&apos;nin 10 sekmesini tek kılavuzda toplar.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                Etkileşimli Eğitim PDF&apos;i
              </span>
            </div>

            <nav className="space-y-1.5">
              {chapters.map((c, idx) => (
                <a
                  key={c.id}
                  href={`#chapter-${c.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b border-slate-200/70 text-xs text-slate-900 font-bold hover:text-indigo-700"
                >
                  <span className="flex items-baseline gap-2.5 min-w-0">
                    <span className="font-mono font-black text-indigo-600 text-[11px] shrink-0">
                      {String(idx + 1).padStart(2, "0")}.
                    </span>
                    <span className="truncate">{c.title}</span>
                  </span>
                  <span className="text-[10px] text-indigo-500 font-bold shrink-0">Git →</span>
                </a>
              ))}
            </nav>
          </div>
        ) : (
          /* Clickable Table of Contents — Single Module PDF */
          <div className="print-avoid-break p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">İçindekiler</h2>
                <p className="text-[11px] text-slate-500">
                  İlgili başlığa tıklayarak PDF içinde doğrudan o bölüme atlayabilirsiniz.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
                {singleTocItems.length} Başlık
              </span>
            </div>

            <nav className="space-y-1">
              {singleTocItems.map((item, idx) => (
                <a
                  key={idx}
                  href={item.href}
                  className={`flex items-center justify-between gap-3 py-1.5 border-b border-slate-200/70 hover:text-indigo-700 ${
                    item.level === 2
                      ? "pl-6 text-[11px] text-slate-600 font-medium"
                      : "text-xs text-slate-900 font-bold"
                  }`}
                >
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span
                      className={`font-mono font-black shrink-0 ${
                        item.level === 2 ? "text-purple-600 text-[10px]" : "text-indigo-600 text-[11px]"
                      }`}
                    >
                      {item.num}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="text-[10px] text-indigo-500 font-bold shrink-0">Git →</span>
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* Chapters (Each starts cleanly on a new page after TOC) */}
        {chapters.map((ch) => (
          <div key={ch.id} id={`chapter-${ch.id}`} className="print-page-break pt-1">
            <ChapterArticle chapter={ch} printMode={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
