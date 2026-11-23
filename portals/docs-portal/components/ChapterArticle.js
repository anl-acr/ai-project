import React, { useState } from "react";
import Link from "next/link";
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
  BookOpen,
  Shield,
  Navigation,
  Table2,
  AlertTriangle,
  Info,
  Code2,
  ArrowRight,
  ListChecks,
  Sliders,
  ChevronDown,
  ChevronRight,
  Lightbulb
} from "lucide-react";
import { MANUAL_META, getChapterById } from "../data/manualChapters";

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
            className="w-full h-auto max-h-[500px] object-contain mx-auto"
          />
          <div className="no-print absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/75 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5">
            <Maximize2 size={12} />
            <span>Tam Boyut İncele</span>
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
  const [openEditTabs, setOpenEditTabs] = useState(() => {
    const init = {};
    (chapter.editFormSections || []).forEach((_, idx) => {
      init[idx] = true;
    });
    return init;
  });

  const toggleAllEditTabs = (expand) => {
    const next = {};
    (chapter.editFormSections || []).forEach((_, idx) => {
      next[idx] = expand;
    });
    setOpenEditTabs(next);
  };

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
      // Fall back to print view
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
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
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
                onClick={handleDownloadModulePdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-60 transition"
                title="Bu menünün kurumsal A4 PDF kılavuzunu indir"
              >
                <FileDown size={14} />
                <span>{downloadingPdf ? "Hazırlanıyor..." : "Bu Sayfayı PDF İndir"}</span>
              </button>
              <a
                href={`/print/${chapter.id}/?autoprint=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                title="Yazdırılabilir A4 sayfa görünümü"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Yazdır</span>
              </a>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          {chapter.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {chapter.summary}
        </p>

        {/* Technical Metadata Strip: Menu Path, Route & RBAC Permissions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {chapter.menuPath && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Navigation size={11} className="text-indigo-500" />
                <span>Santral Menü Yolu &amp; URL</span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{chapter.menuPath}</div>
              {chapter.pbxRoute && (
                <code className="inline-block text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                  {chapter.pbxRoute}
                </code>
              )}
            </div>
          )}
          {chapter.permissions && chapter.permissions.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield size={11} className="text-emerald-500" />
                <span>Gerekli Rol Yetki Kodları (RBAC)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chapter.permissions.map((perm) => (
                  <code
                    key={perm}
                    className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    {perm}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prerequisites */}
        {chapter.prerequisites && chapter.prerequisites.length > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <ListChecks size={13} />
              <span>Başlamadan Önce Ön Koşullar</span>
            </div>
            <ul className="space-y-1.5">
              {chapter.prerequisites.map((pre, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  <CheckCircle2 size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>{pre}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Live Screenshots */}
      {chapter.screenshots && chapter.screenshots.length > 0 && (
        <section id="ekran-goruntuleri" className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ImageIcon size={15} className="text-indigo-500" />
            <span>Canlı Santral Arayüz Ekran Görüntüsü</span>
          </h2>
          <div className="grid grid-cols-1 gap-5">
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

      {/* Field-by-Field Reference Table */}
      {chapter.fieldTable && chapter.fieldTable.length > 0 && (
        <section
          id="alan-referansi"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Table2 size={18} className="text-indigo-500" />
              <span>Tüm Alanlar, Parametreler &amp; Teknik Etkileri</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {chapter.fieldTable.length} parametre
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-3 font-extrabold">Alan / Sekme Adı</th>
                  <th className="px-3.5 py-3 font-extrabold">Tip / Seçenekler</th>
                  <th className="px-3.5 py-3 font-extrabold">Varsayılan</th>
                  <th className="px-3.5 py-3 font-extrabold">Detaylı Açıklama &amp; Santral Etkisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {chapter.fieldTable.map((row, idx) => (
                  <tr key={idx} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3.5 py-3 font-extrabold text-slate-900 dark:text-white whitespace-normal min-w-[160px]">
                      <div>{row.field}</div>
                      {row.required && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase">
                          Zorunlu
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[11px] text-indigo-700 dark:text-indigo-300 min-w-[130px]">
                      {row.type}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 min-w-[110px]">
                      {row.defaultVal || "—"}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300 leading-relaxed min-w-[240px]">
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Deep Edit / Sub-Screen Tabs Reference (En İnce Ayrıntısına Kadar) */}
      {chapter.editFormSections && chapter.editFormSections.length > 0 && (
        <section
          id="duzenle-ve-alt-ayarlar"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={18} className="text-indigo-500" />
                <span>Ekle / Düzenle &amp; Alt Sekme Ayarları (Detaylı Referans)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bu modülün içindeki her sekme, form alanı, anahtar (toggle) ve gizli davranışın tam teknik dökümü ({chapter.editFormSections.length} alt bölüm).
              </p>
            </div>
            {!printMode && (
              <div className="no-print flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleAllEditTabs(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Tümünü Aç
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllEditTabs(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Tümünü Daralt
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3.5">
            {chapter.editFormSections.map((sub, sIdx) => {
              const isOpen = printMode || openEditTabs[sIdx] !== false;
              return (
                <div
                  key={sIdx}
                  id={`edit-tab-${sIdx + 1}`}
                  className="print-avoid-break rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      !printMode && setOpenEditTabs((prev) => ({ ...prev, [sIdx]: !isOpen }))
                    }
                    className="w-full px-5 py-4 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-mono text-[10px] font-black shrink-0">
                        {sIdx + 1}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {sub.tabTitle}
                      </span>
                      {sub.badge && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                          {sub.badge}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-400">
                        ({(sub.fields || []).length} ayar)
                      </span>
                    </div>
                    {!printMode && (
                      <span className="text-slate-400 shrink-0">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="p-5 space-y-4">
                      {sub.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {sub.description}
                        </p>
                      )}

                      {sub.fields && sub.fields.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                              <tr>
                                <th className="px-3 py-2.5 font-extrabold">Ayar / Alan</th>
                                <th className="px-3 py-2.5 font-extrabold">Seçenekler / Tip</th>
                                <th className="px-3 py-2.5 font-extrabold">Varsayılan</th>
                                <th className="px-3 py-2.5 font-extrabold">Ne İşe Yarar &amp; Teknik Davranışı</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {sub.fields.map((f, fIdx) => (
                                <tr key={fIdx} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                                  <td className="px-3 py-2.5 font-extrabold text-slate-900 dark:text-white min-w-[165px]">
                                    <div>{f.name}</div>
                                    {f.required && (
                                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase">
                                        Zorunlu
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-700 dark:text-indigo-300 min-w-[130px]">
                                    {f.type}
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 min-w-[100px]">
                                    {f.defaultVal || "—"}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 leading-relaxed min-w-[250px]">
                                    {f.effect}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {sub.tips && sub.tips.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-1.5">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <Lightbulb size={12} />
                            <span>Pratik İpuçları &amp; Dikkat Edilecekler</span>
                          </div>
                          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                            {sub.tips.map((tip, tIdx) => (
                              <li key={tIdx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Detailed Sections */}
      <div className="space-y-6">
        {(chapter.sections || []).map((sec, idx) => {
          const secId = `sec-${idx + 1}`;
          return (
            <section
              key={idx}
              id={secId}
              className="print-avoid-break p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
            >
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {sec.heading}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {sec.body}
              </p>

              {sec.steps && sec.steps.length > 0 && (
                <ol className="space-y-2.5 pt-1">
                  {sec.steps.map((step, sIdx) => (
                    <li
                      key={sIdx}
                      className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                    >
                      <span className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {sec.callout && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                    sec.callout.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                      : "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200"
                  }`}
                >
                  {sec.callout.type === "warning" ? (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Info size={16} className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  )}
                  <div className="space-y-1">
                    <div className="font-extrabold">{sec.callout.title}</div>
                    <div>{sec.callout.text}</div>
                  </div>
                </div>
              )}

              {sec.codeBlock && (
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-300 font-mono">
                      {sec.codeBlock.title}
                    </span>
                    {!printMode && (
                      <button
                        type="button"
                        onClick={() => copyCode(sec.codeBlock.code, `${chapter.id}-${idx}`)}
                        className="no-print inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        {copiedKey === `${chapter.id}-${idx}` ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedKey === `${chapter.id}-${idx}` ? "Kopyalandı" : "Kopyala"}</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-4 text-[11px] sm:text-xs font-mono text-emerald-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {sec.codeBlock.code}
                  </pre>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Troubleshooting Matrix */}
      {chapter.troubleshooting && chapter.troubleshooting.length > 0 && (
        <section
          id="sorun-giderme"
          className="print-avoid-break p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-4"
        >
          <h2 className="text-base font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Wrench size={16} />
            <span>Sık Karşılaşılan Hatalar &amp; Sorun Giderme</span>
          </h2>
          <div className="space-y-3">
            {chapter.troubleshooting.map((tr, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 space-y-1.5"
              >
                <div className="text-xs font-extrabold text-rose-700 dark:text-rose-400">
                  Belirti: {tr.problem}
                </div>
                {tr.cause && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Kök Neden:</strong> {tr.cause}
                  </div>
                )}
                <div className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2 pt-0.5">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Çözüm:</strong> {tr.solution}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Manual Pages & API Endpoints */}
      {!printMode && ((chapter.relatedPages && chapter.relatedPages.length > 0) || (chapter.relatedApis && chapter.relatedApis.length > 0)) && (
        <section className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
          {chapter.relatedPages && chapter.relatedPages.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen size={13} className="text-indigo-500" />
                <span>İlgili Kılavuz Sayfaları</span>
              </div>
              <div className="space-y-1.5">
                {chapter.relatedPages.map((slug) => {
                  const target = getChapterById(slug);
                  if (!target) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/${slug}/`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      <span className="truncate">
                        {target.number}. {target.shortTitle || target.title}
                      </span>
                      <ArrowRight size={13} className="text-indigo-500 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {chapter.relatedApis && chapter.relatedApis.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Code2 size={13} className="text-emerald-500" />
                <span>İlgili REST API Uç Noktaları</span>
              </div>
              <div className="space-y-1.5">
                {chapter.relatedApis.map((apiStr, i) => (
                  <a
                    key={i}
                    href="https://api.nornia.com.tr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 transition"
                  >
                    <span className="truncate">{apiStr}</span>
                    <ArrowRight size={12} className="text-emerald-500 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Print footer stamp */}
      {printMode && (
        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            {MANUAL_META.product} ({MANUAL_META.version}) — Bölüm {chapter.number}: {chapter.title}
          </span>
          <span>dokuman.nornia.com.tr/{chapter.id}/ • api.nornia.com.tr</span>
        </div>
      )}

      {/* Lightbox Modal for Screenshot Zoom */}
      {zoomShot && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm p-4 sm:p-8 flex items-center justify-center"
          onClick={() => setZoomShot(null)}
        >
          <div
            className="max-w-6xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen size={14} className="text-indigo-500" />
                <span>{zoomShot.caption}</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomShot(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-950 max-h-[82vh] overflow-auto flex justify-center">
              <img src={zoomShot.src} alt={zoomShot.caption} className="max-w-full h-auto rounded-lg shadow" />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
