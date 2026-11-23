import React, { useState } from "react";
import {
  FileDown,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  Wrench,
  Clock,
  Image as ImageIcon,
  Maximize2,
  X,
  BookOpen
} from "lucide-react";
import { MANUAL_META } from "../data/manualChapters";

function ScreenshotCard({ shot, onZoom }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="print-avoid-break rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      {!failed ? (
        <div
          className="relative group cursor-zoom-in bg-slate-100 dark:bg-slate-950"
          onClick={() => onZoom && onZoom(shot)}
        >
          <img
            src={shot.src}
            alt={shot.caption}
            onError={() => setFailed(true)}
            className="w-full h-auto max-h-[460px] object-contain mx-auto"
          />
          <div className="no-print absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/75 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5">
            <Maximize2 size={12} />
            <span>Büyüt</span>
          </div>
        </div>
      ) : (
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-950 flex flex-col items-center justify-center text-center gap-2 border-b border-slate-200/70 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ImageIcon size={20} />
          </div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
            Santral Ekran Görünümü: {shot.routeHint}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md">
            Canlı ekran görüntüsü yakalama betiği (<code className="font-mono">capture_pbx_screenshots.mjs</code>) çalıştırıldığında bu alan otomatik olarak <code className="font-mono">app.nornia.com.tr</code> görseliyle dolar.
          </p>
        </div>
      )}
      <figcaption className="px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/50">
        <span className="font-semibold">{shot.caption}</span>
        {shot.routeHint && (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold shrink-0">
            {shot.routeHint}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export default function ChapterArticle({ chapter, printMode = false }) {
  const [copiedKey, setCopiedKey] = useState("");
  const [zoomShot, setZoomShot] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const copyCode = (txt, key) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(txt).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1600);
  };

  const handleDownloadModulePdf = async () => {
    const staticPdfUrl = `/pdfs/${chapter.id}.pdf`;
    setDownloadingPdf(true);
    try {
      const headRes = await fetch(staticPdfUrl, { method: "HEAD" });
      if (headRes.ok && (headRes.headers.get("content-type") || "").includes("pdf")) {
        const a = document.createElement("a");
        a.href = staticPdfUrl;
        a.download = `nornia-${chapter.number}-${chapter.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    } catch (_) {
      // Static pre-built PDF not yet generated; fall back to dedicated print view
    } finally {
      setDownloadingPdf(false);
    }
    if (typeof window !== "undefined") {
      window.open(`/print/${chapter.id}/?autoprint=1`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className="space-y-8">
      {/* Chapter Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-mono font-black">
              BÖLÜM {chapter.number}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
              {chapter.category}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
              {chapter.badge}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
              <Clock size={12} />
              ~{chapter.readMinutes} dk okuma
            </span>
          </div>

          {!printMode && (
            <div className="no-print flex items-center gap-2">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handleDownloadModulePdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50"
              >
                <FileDown size={14} />
                <span>{downloadingPdf ? "Hazırlanıyor..." : "Bu Modülü PDF İndir"}</span>
              </button>
              <a
                href={`/print/${chapter.id}/?autoprint=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
                title="Baskı Önizleme / Yazdır"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Yazdır</span>
              </a>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {chapter.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {chapter.summary}
        </p>

        {printMode && (
          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{MANUAL_META.productName} • Resmi Kullanım Kılavuzu ({MANUAL_META.version})</span>
            <span>{MANUAL_META.docsPortalUrl}</span>
          </div>
        )}
      </div>

      {/* Screenshots */}
      {Array.isArray(chapter.screenshots) && chapter.screenshots.length > 0 && (
        <section id="ekran-goruntuleri" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <BookOpen size={14} className="text-indigo-500" />
            <span>Santral Ekran Görünümleri</span>
          </h2>
          <div className={`grid grid-cols-1 ${chapter.screenshots.length > 1 && !printMode ? "md:grid-cols-2" : ""} gap-4`}>
            {chapter.screenshots.map((shot, idx) => (
              <ScreenshotCard
                key={idx}
                shot={shot}
                onZoom={printMode ? null : (s) => setZoomShot(s)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Detailed Sections */}
      <div className="space-y-6">
        {(chapter.sections || []).map((sec, idx) => (
          <section
            key={idx}
            id={`sec-${chapter.number}-${idx + 1}`}
            className="print-avoid-break p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {sec.heading}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {sec.body}
            </p>

            {/* Numbered Steps */}
            {Array.isArray(sec.steps) && sec.steps.length > 0 && (
              <ol className="space-y-2.5 pt-1">
                {sec.steps.map((st, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {sIdx + 1}
                    </span>
                    <span className="leading-relaxed">{st}</span>
                  </li>
                ))}
              </ol>
            )}

            {/* Config Table */}
            {sec.configTable && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                    <tr>
                      {sec.configTable.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-4 py-2.5 font-extrabold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sec.configTable.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-4 py-2.5 leading-relaxed ${
                              cIdx === 0 ? "font-extrabold text-slate-900 dark:text-white whitespace-nowrap" : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Code / Config Example */}
            {sec.codeExample && (
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">{sec.codeExample.title}</span>
                  {!printMode && (
                    <button
                      type="button"
                      onClick={() => copyCode(sec.codeExample.code, `code-${idx}`)}
                      className="no-print px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === `code-${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedKey === `code-${idx}` ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  )}
                </div>
                <pre className="p-4 font-mono text-[11px] text-emerald-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {sec.codeExample.code}
                </pre>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Troubleshooting Section */}
      {Array.isArray(chapter.troubleshooting) && chapter.troubleshooting.length > 0 && (
        <section id="sorun-giderme" className="print-avoid-break p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-4">
          <h2 className="text-base font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
            <Wrench size={16} />
            <span>Sık Karşılaşılan Durumlar &amp; Hızlı Çözümler</span>
          </h2>
          <div className="space-y-3">
            {chapter.troubleshooting.map((item, tIdx) => (
              <div key={tIdx} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/50 space-y-1.5">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Soru: {item.problem}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item.solution}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {zoomShot && !printMode && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomShot(null)}
        >
          <div className="relative max-w-6xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="text-xs font-bold">{zoomShot.caption}</span>
              <button type="button" onClick={() => setZoomShot(null)} className="p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 bg-slate-950 max-h-[82vh] overflow-auto">
              <img src={zoomShot.src} alt={zoomShot.caption} className="w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
