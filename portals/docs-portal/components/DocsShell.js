import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Search,
  BookOpen,
  FileDown,
  Code2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Menu,
  X,
  List,
  Home
} from "lucide-react";
import { MANUAL_CHAPTERS, MANUAL_GROUPS, MANUAL_META } from "../data/manualChapters";

export default function DocsShell({ activeChapter = null, children }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {};
    MANUAL_GROUPS.forEach((g) => {
      init[g.id] = true;
    });
    return init;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("nornia_portal_theme");
    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
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

  const handleDownloadFullPdf = async () => {
    try {
      const headRes = await fetch(MANUAL_META.fullPdfPath, { method: "HEAD" });
      if (headRes.ok && (headRes.headers.get("content-type") || "").includes("pdf")) {
        const a = document.createElement("a");
        a.href = MANUAL_META.fullPdfPath;
        a.download = "nornia-kullanim-kilavuzu.pdf";
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

  const activeIndex = activeChapter
    ? MANUAL_CHAPTERS.findIndex((c) => c.id === activeChapter.id)
    : -1;
  const prevChapter = activeIndex > 0 ? MANUAL_CHAPTERS[activeIndex - 1] : null;
  const nextChapter =
    activeIndex >= 0 && activeIndex < MANUAL_CHAPTERS.length - 1
      ? MANUAL_CHAPTERS[activeIndex + 1]
      : null;

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MANUAL_CHAPTERS.map((c) => ({ chapter: c, match: c.summary }));
    const hits = [];
    MANUAL_CHAPTERS.forEach((c) => {
      const fieldsHay = (c.fieldTable || []).map((f) => `${f.field} ${f.description}`).join(" ");
      const editHay = (c.editFormSections || [])
        .map((s) => `${s.tabTitle} ${s.description || ""} ${(s.fields || []).map((f) => `${f.name} ${f.type} ${f.effect}`).join(" ")}`)
        .join(" ");
      const hay = [
        c.title,
        c.shortTitle,
        c.summary,
        c.category,
        c.menuPath,
        c.badge,
        fieldsHay,
        editHay,
        ...(c.sections || []).map((s) => `${s.heading} ${s.body}`),
        ...(c.troubleshooting || []).map((t) => `${t.problem} ${t.solution}`)
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) {
        const matchedEdit = (c.editFormSections || []).find((s) =>
          `${s.tabTitle} ${(s.fields || []).map((f) => `${f.name} ${f.effect}`).join(" ")}`.toLowerCase().includes(q)
        );
        const matchedField = (c.fieldTable || []).find((f) =>
          `${f.field} ${f.description}`.toLowerCase().includes(q)
        );
        const matchedSec = (c.sections || []).find((s) =>
          `${s.heading} ${s.body}`.toLowerCase().includes(q)
        );
        hits.push({
          chapter: c,
          match: matchedEdit
            ? `Düzenle / Alt Sekme: ${matchedEdit.tabTitle}`
            : matchedField
            ? `Parametre: ${matchedField.field}`
            : matchedSec
            ? matchedSec.heading
            : c.summary
        });
      }
    });
    return hits;
  }, [searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Menü"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/" className="flex items-center gap-2.5 text-left group">
            <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-md group-hover:scale-105 transition-transform">
              <img src="/favicon.svg" alt="Nornia Logo" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-extrabold text-base tracking-tight leading-tight bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  Nornia
                </span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  Doküman
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:block">
                Akıllı İletişim Platformu — Detaylı Kurulum &amp; Kullanım Kılavuzu
              </p>
            </div>
          </Link>
        </div>

        {/* Search Trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2.5 w-72 lg:w-80 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 transition cursor-pointer"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Menü, parametre, *kod veya hata ara...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold">
            ⌘K
          </kbd>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://api.nornia.com.tr"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <Code2 size={14} className="text-indigo-500" />
            <span>API Referansı</span>
            <ExternalLink size={11} className="opacity-60" />
          </a>
          <button
            type="button"
            onClick={handleDownloadFullPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer transition"
            title={`Tüm ${MANUAL_CHAPTERS.length} menü ve raporu tek kurumsal PDF kitap olarak indir`}
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

      {/* BODY 3-COLUMN LAYOUT */}
      <div className="flex-1 flex max-w-[1640px] w-full mx-auto">
        {/* LEFT SIDEBAR — EXACT 7 PBX MENU GROUPS */}
        <aside
          className={`${
            mobileNavOpen ? "fixed inset-y-16 left-0 z-30 block w-80 shadow-2xl" : "hidden lg:block w-80 shrink-0"
          } bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16 p-4 space-y-4`}
        >
          <Link
            href="/"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
              !activeChapter
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            }`}
          >
            <Home size={14} />
            <span>Tüm Kılavuz Dizini ({MANUAL_CHAPTERS.length} Sayfa)</span>
          </Link>

          <div className="space-y-3">
            {MANUAL_GROUPS.map((grp) => {
              const items = MANUAL_CHAPTERS.filter((c) => c.groupId === grp.id);
              const isOpen = openGroups[grp.id] !== false;
              return (
                <div key={grp.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [grp.id]: !isOpen }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <span className="truncate">
                      {grp.title} ({items.length})
                    </span>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5 pl-1">
                      {items.map((ch) => {
                        const isActive = activeChapter && activeChapter.id === ch.id;
                        return (
                          <Link
                            key={ch.id}
                            href={`/${ch.id}/`}
                            onClick={() => setMobileNavOpen(false)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition ${
                              isActive
                                ? "bg-indigo-600 text-white font-extrabold shadow-sm"
                                : "text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-mono font-black w-5 shrink-0 ${
                                isActive ? "text-indigo-200" : "text-indigo-500"
                              }`}
                            >
                              {ch.number}
                            </span>
                            <span className="truncate">{ch.shortTitle || ch.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar Info Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="font-extrabold text-slate-700 dark:text-slate-200">
              Her Menü İçin Ayrı Sayfa &amp; PDF
            </div>
            <p className="leading-relaxed">
              Soldaki her menü sayfası kendi URL adresine, canlı ekran görüntüsüne, parametre tablosuna ve tek tıkla indirilebilir kurumsal A4 PDF dosyasına sahiptir.
            </p>
          </div>
        </aside>

        {/* CENTER CONTENT */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-8 max-w-5xl">
          {children}

          {/* Prev / Next Navigation when on a chapter page */}
          {activeChapter && (
            <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {prevChapter ? (
                <Link
                  href={`/${prevChapter.id}/`}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-left transition flex items-center gap-3"
                >
                  <ChevronLeft size={18} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Önceki Sayfa</div>
                    <div className="text-xs font-extrabold truncate">
                      {prevChapter.number}. {prevChapter.shortTitle || prevChapter.title}
                    </div>
                  </div>
                </Link>
              ) : (
                <div />
              )}

              {nextChapter ? (
                <Link
                  href={`/${nextChapter.id}/`}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-right transition flex items-center justify-end gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Sonraki Sayfa</div>
                    <div className="text-xs font-extrabold truncate">
                      {nextChapter.number}. {nextChapter.shortTitle || nextChapter.title}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-indigo-500 shrink-0" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="Nornia" className="h-4 w-4 object-contain" />
              <span>
                © {new Date().getFullYear()} {MANUAL_META.product}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://api.nornia.com.tr" className="hover:text-indigo-500 font-semibold">
                api.nornia.com.tr
              </a>
              <a href="https://panel.nornia.com.tr" className="hover:text-indigo-500 font-semibold">
                panel.nornia.com.tr
              </a>
            </div>
          </footer>
        </main>

        {/* RIGHT TOC SIDEBAR (only on chapter pages) */}
        {activeChapter && (
          <aside className="hidden xl:block w-64 shrink-0 border-l border-slate-200/80 dark:border-slate-800 h-[calc(100vh-4rem)] sticky top-16 p-5 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <List size={12} />
              <span>Bu Sayfada</span>
            </div>
            <nav className="space-y-1.5 text-xs">
              {activeChapter.screenshots?.length > 0 && (
                <a
                  href="#ekran-goruntuleri"
                  className="block py-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                >
                  Canlı Ekran Görüntüsü
                </a>
              )}
              {activeChapter.fieldTable?.length > 0 && (
                <a
                  href="#alan-referansi"
                  className="block py-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                >
                  Genel Alan Tablosu ({activeChapter.fieldTable.length})
                </a>
              )}
              {activeChapter.editFormSections?.length > 0 && (
                <div className="space-y-1 pt-1">
                  <a
                    href="#duzenle-ve-alt-ayarlar"
                    className="block py-1 text-indigo-600 dark:text-indigo-400 font-extrabold"
                  >
                    Düzenle &amp; Alt Ayarlar ({activeChapter.editFormSections.length})
                  </a>
                  <div className="pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-1">
                    {activeChapter.editFormSections.map((sub, idx) => (
                      <a
                        key={idx}
                        href={`#edit-tab-${idx + 1}`}
                        className="block py-0.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 leading-snug"
                      >
                        {idx + 1}. {sub.tabTitle}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(activeChapter.sections || []).map((sec, idx) => (
                <a
                  key={idx}
                  href={`#sec-${idx + 1}`}
                  className="block py-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium leading-snug"
                >
                  {sec.heading}
                </a>
              ))}
              {activeChapter.troubleshooting?.length > 0 && (
                <a
                  href="#sorun-giderme"
                  className="block py-1 text-amber-700 dark:text-amber-400 hover:underline font-semibold"
                >
                  Sorun Giderme ({activeChapter.troubleshooting.length})
                </a>
              )}
            </nav>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Hızlı İndirme
              </div>
              <a
                href={`/pdfs/${activeChapter.id}.pdf`}
                download={`nornia-${activeChapter.number}-${activeChapter.id}.pdf`}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-extrabold transition"
              >
                <FileDown size={13} />
                <span>Bu Sayfa PDF</span>
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* CMD+K SEARCH MODAL */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search size={16} className="text-indigo-500" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`${MANUAL_CHAPTERS.length} kılavuz sayfasında ara (örn. RONA, *11, Netplan, VLAN, BLF, WhatsApp, MOS, Profil, KVKK)...`}
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchHits.map(({ chapter, match }) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                    router.push(`/${chapter.id}/`);
                  }}
                  className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left transition cursor-pointer space-y-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                      BÖLÜM {chapter.number}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                      {chapter.category}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {chapter.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{match}</p>
                </button>
              ))}
              {searchHits.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Aramanızla eşleşen kılavuz içeriği bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
