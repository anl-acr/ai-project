import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function TablePagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, 250],
  itemLabel = "kayıt"
}) {
  const { bg, hover, text, border, lightBg } = useTheme();

  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 25);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);

  if (safeTotal === 0) return null;

  const startIdx = (safePage - 1) * safePageSize + 1;
  const endIdx = Math.min(safeTotal, safePage * safePageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);

    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) {
      pages.push(i);
    }
    if (right < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
      {/* Left: Summary & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Toplam <strong className="font-extrabold text-slate-800 dark:text-slate-100">{safeTotal.toLocaleString("tr-TR")}</strong> {itemLabel}tan{" "}
          <strong className="font-bold text-slate-700 dark:text-slate-200">
            {startIdx.toLocaleString("tr-TR")} - {endIdx.toLocaleString("tr-TR")}
          </strong>{" "}
          arası gösteriliyor
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">| Sayfa başı:</span>
            <select
              value={safePageSize}
              onChange={(e) => {
                const nextSize = parseInt(e.target.value, 10) || 25;
                onPageSizeChange(nextSize);
              }}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 select-none">
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="İlk Sayfa"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Önceki Sayfa"
          >
            <ChevronLeft size={14} />
          </button>

          {pageNumbers.map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="px-1.5 text-xs font-bold text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange && onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                  p === safePage
                    ? `${bg} text-white shadow-sm`
                    : `border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange && onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Sonraki Sayfa"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Son Sayfa"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
