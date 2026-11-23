import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import {
  Search,
  BookOpen,
  FileDown,
  Code2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Menu,
  X,
  List,
  Sparkles
} from "lucide-react";
import { MANUAL_CHAPTERS, MANUAL_META } from "../data/manualChapters";
import ChapterArticle from "../components/ChapterArticle";

export default function DocsPortalPage() {
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeId, setActiveId] = useState(MANUAL_CHAPTERS[0].id);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("nornia_portal_theme");
    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && MANUAL_CHAPTERS.some((c) => c.id === hash)) {
      setActiveId(hash);
    }
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("nornia_portal_theme", next ? "dark" : "light");
    }
  };

  const activeIndex = useMemo(
    () => Math.max(0, MANUAL_CHAPTERS.findIndex((c) => c.id === activeId)),
    [activeId]
  );
  const activeChapter = MANUAL_CHAPTERS[activeIndex] || MANUAL_CHAPTERS[0];
  const prevChapter = activeIndex > 0 ? MANUAL_CHAPTERS[activeIndex - 1] : null;
  const nextChapter = activeIndex < MANUAL_CHAPTERS.length - 1 ? MANUAL_CHAPTERS[activeIndex + 1] : null;

  const selectChapter = (id) => {
    setActiveId(id);
    setMobileNavOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDownloadFullPdf = async () => {
    try {
      const headRes = await fetch(MANUAL_META.fullPdfPath, { method: "HEAD" });
      if (headRes.ok && (headRes.headers.get("content-type") || "").includes("pdf")) {
        const a = document.createElement("a");
        a.href = MANUAL_META.fullPdfPath;
        a.download = `nornia-kullanim-kilavuzu-${MANUAL_META.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    } catch (_) {}
    if (typeof window !== "undefined") {
      window.open("/print/all/?autoprint=1", "_blank", "noopener,noreferrer");
    }
  };

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MANUAL_CHAPTERS.map((c) => ({ chapter: c, match: c.summary }));
    const hits = [];
    MANUAL_CHAPTERS.forEach((c) => {
      const hay = [
        c.title,
        c.summary,
        c.category,
        c.badge,
        ...(c.sections || []).map((s) => `${s.heading} ${s.body}`),
        ...(c.troubleshooting || []).map((t) => `${t.problem} ${t.solution}`)
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) {
        const matchedSec = (c.sections || []).find((s) => `${s.heading} ${s.body}`.toLowerCase().includes(q));
        hits.push({ chapter: c, match: matchedSec ? matchedSec.heading : c.summary });
      }
    });
    return hits;
  }, [searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Head>
        <title>{activeChapter.title} — Nornia Kullanım Kılavuzu ({MANUAL_META.version})</title>
        <meta
          name="description"
          content="Nornia Enterprise AI PBX resmi modül bazlı Türkçe kullanım kılavuzu, ekran görüntüleri, konfigürasyon örnekleri ve PDF dokümanları."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* TOP BAR */}
      <header className="no-print sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Menü"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            type="button"
            onClick={() => selectChapter(MANUAL_CHAPTERS[0].id)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-indigo-600 to-cyan-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
                  Nornia Doküman
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold font-mono">
                  {MANUAL_META.version}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:block">
                Resmi Santral &amp; Yapay Zeka Kullanım Kılavuzu
              </p>
            </div>
          </button>
        </div>

        {/* Search */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2.5 w-72 lg:w-80 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 transition cursor-pointer"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Modül, ayar veya sorun ara...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold">
            ⌘K
          </kbd>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={MANUAL_META.apiPortalUrl}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <Code2 size={14} className="text-indigo-500" />
            <span>API Portalı</span>
            <ExternalLink size={11} className="opacity-60" />
          </a>
          <button
            type="button"
            onClick={handleDownloadFullPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer"
            title="Tüm 10 Bölümü Tek PDF Olarak İndir"
          >
            <FileDown size={14} />
            <span className="hidden sm:inline">Tam Kılavuz PDF</span>
          </button>
          <button
            type="button"
            onClick={toggleDark}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Tema Değiştir"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* LEFT MODULE SIDEBAR */}
        <aside
          className={`no-print ${
            mobileNavOpen ? "fixed inset-y-16 left-0 z-30 block w-72 shadow-2xl" : "hidden lg:block w-72 shrink-0"
          } bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16 p-4 space-y-4`}
        >
          <div className="px-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Kullanım Kılavuzu Modülleri
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-500">{MANUAL_CHAPTERS.length} Bölüm</span>
          </div>

          <nav className="space-y-1">
            {MANUAL_CHAPTERS.map((ch) => {
              const active = ch.id === activeChapter.id;
              return (
                <div
                  key={ch.id}
                  className={`flex items-center gap-1 rounded-xl transition ${
                    active ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectChapter(ch.id)}
                    className="flex-1 flex items-center gap-2.5 px-2.5 py-2.5 text-left min-w-0 cursor-pointer"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {ch.number}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${active ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
                        {ch.shortTitle}
                      </div>
                      <div className={`text-[10px] truncate ${active ? "text-indigo-100" : "text-slate-400"}`}>
                        {ch.badge}
                      </div>
                    </div>
                  </button>
                  <a
                    href={`/print/${ch.id}/?autoprint=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${ch.shortTitle} PDF İndir / Yazdır`}
                    className={`p-2 mr-1 rounded-lg transition shrink-0 ${
                      active ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-slate-400 hover:text-rose-500"
                    }`}
                  >
                    <FileDown size={13} />
                  </a>
                </div>
              );
            })}
          </nav>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-500" />
              <span>Geliştirici misiniz?</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              REST API, Click-to-Call, Webhook ve Postman koleksiyonları için API Portalını ziyaret edin.
            </p>
            <a
              href={MANUAL_META.apiPortalUrl}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span>api.nornia.com.tr</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </aside>

        {/* CENTER CONTENT */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-8 max-w-4xl">
          <ChapterArticle chapter={activeChapter} />

          {/* Prev / Next Navigation */}
          <div className="no-print mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {prevChapter ? (
              <button
                type="button"
                onClick={() => selectChapter(prevChapter.id)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-left cursor-pointer transition"
              >
                <ChevronLeft size={16} className="text-slate-400" />
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Önceki Modül</div>
                  <div className="text-xs font-extrabold">{prevChapter.number}. {prevChapter.shortTitle}</div>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextChapter && (
              <button
                type="button"
                onClick={() => selectChapter(nextChapter.id)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-right cursor-pointer transition"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Sonraki Modül</div>
                  <div className="text-xs font-extrabold">{nextChapter.number}. {nextChapter.shortTitle}</div>
                </div>
                <ChevronRight size={16} className="text-indigo-500" />
              </button>
            )}
          </div>
        </main>

        {/* RIGHT TABLE OF CONTENTS */}
        <aside className="no-print hidden xl:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-6">
          <div className="space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <List size={12} />
              <span>Bu Sayfada</span>
            </div>
            <ul className="space-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-l-2 border-slate-200 dark:border-slate-800 pl-3">
              {activeChapter.screenshots?.length > 0 && (
                <li>
                  <a href="#ekran-goruntuleri" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                    Ekran Görünümleri
                  </a>
                </li>
              )}
              {(activeChapter.sections || []).map((sec, idx) => (
                <li key={idx}>
                  <a
                    href={`#sec-${activeChapter.number}-${idx + 1}`}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition block leading-snug"
                  >
                    {sec.heading}
                  </a>
                </li>
              ))}
              {activeChapter.troubleshooting?.length > 0 && (
                <li>
                  <a href="#sorun-giderme" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                    Sorun Giderme &amp; SSS
                  </a>
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* CMD+K SEARCH MODAL */}
      {searchOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Modül, ayar, kod veya sorun ara (örn. trunk, whatsapp, *8, sngrep)..."
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="text-xs text-slate-400 cursor-pointer">
                ESC
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchHits.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Eşleşen kılavuz bölümü bulunamadı.</div>
              ) : (
                searchHits.map(({ chapter, match }) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => {
                      selectChapter(chapter.id);
                      setSearchOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-left cursor-pointer"
                  >
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono text-[10px] font-black mt-0.5">
                      {chapter.number}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">{chapter.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{match}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
