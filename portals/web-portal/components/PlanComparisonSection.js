import React, { useMemo, useState } from "react";
import {
  Check,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Calculator,
  ExternalLink,
  Layers,
  ShieldCheck,
  Filter,
} from "lucide-react";
import {
  PLAN_TIERS,
  PLAN_COMPARISON_CATEGORIES,
  SITE_CONFIG,
} from "../data/siteContent";

function renderPlanCell(val, tierId) {
  if (val === true) {
    const badgeCls =
      tierId === "professional"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : tierId === "enterprise"
          ? "bg-violet-50 text-violet-700 ring-violet-200"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200";
    return (
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ${badgeCls}`}
        aria-label="Dahil"
      >
        <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
      </span>
    );
  }
  if (val === false) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100/80 text-slate-400"
        aria-label="Dahil değil"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  const textCls =
    tierId === "enterprise"
      ? "bg-violet-50 text-violet-800 border-violet-200"
      : tierId === "professional"
        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
        : "bg-sky-50 text-sky-800 border-sky-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${textCls}`}
    >
      {val}
    </span>
  );
}

export default function PlanComparisonSection({ onSelectPlan, onOpenSizingModal }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const visibleCategories = useMemo(() => {
    return PLAN_COMPARISON_CATEGORIES.filter(
      (cat) => selectedCategory === "all" || cat.id === selectedCategory
    )
      .map((cat) => {
        const filteredRows = onlyDifferences
          ? cat.rows.filter(
              (r) => !(r.starter === r.professional && r.professional === r.enterprise)
            )
          : cat.rows;
        return { ...cat, rows: filteredRows };
      })
      .filter((cat) => cat.rows.length > 0);
  }, [selectedCategory, onlyDifferences]);

  const allCollapsed =
    visibleCategories.length > 0 &&
    visibleCategories.every((cat) => Boolean(collapsedCategories[cat.id]));

  const toggleCategory = (catId) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleExpandAll = () => {
    if (allCollapsed) {
      setCollapsedCategories({});
    } else {
      const next = {};
      PLAN_COMPARISON_CATEGORIES.forEach((c) => {
        next[c.id] = true;
      });
      setCollapsedCategories(next);
    }
  };

  const totalFeatureCount = useMemo(
    () => PLAN_COMPARISON_CATEGORIES.reduce((acc, c) => acc + c.rows.length, 0),
    []
  );

  return (
    <section
      id="planlar"
      aria-labelledby="plan-comparison-heading"
      className="border-y border-slate-200/80 bg-slate-50/80 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-indigo-700 border border-slate-200 shadow-2xs">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Paketler &amp; Özellik Karşılaştırması
          </span>
          <h2
            id="plan-comparison-heading"
            className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
          >
            İhtiyacınıza Uygun Nornia Planını Karşılaştırın
          </h2>
          <p className="mt-3 text-base text-slate-600">
            İster tek ofisli yerel kurulum, ister yüzlerce temsilcili bulut santral — tüm
            planlar aynı yüksek performanslı Nornia çekirdeğinde çalışır ve büyüdükçe tek
            anahtarla yükseltilir.
          </p>
        </div>

        {/* 3 Main Tier Overview Cards (Yeastar Standard / Enterprise / Ultimate Style) */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLAN_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={`flex flex-col justify-between rounded-3xl p-7 transition ${
                tier.featured
                  ? "border-2 border-indigo-600 bg-white shadow-floating ring-4 ring-indigo-50"
                  : "border border-slate-200 bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      tier.featured
                        ? "bg-indigo-600 text-white"
                        : tier.accent === "violet"
                          ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                          : "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                    }`}
                  >
                    {tier.badge}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {tier.deploymentNote}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <h3 className="text-2xl font-extrabold tracking-tight text-slate-950">
                    {tier.name}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    • {tier.subtitle}
                  </span>
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  {tier.audience}
                </p>

                <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200/80">
                  {tier.moduleSummary}
                </div>

                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                  {tier.highlights.map((hl) => (
                    <li
                      key={hl}
                      className="flex items-start gap-2.5 text-sm text-slate-700"
                    >
                      <Check
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          tier.featured
                            ? "text-indigo-600"
                            : tier.accent === "violet"
                              ? "text-violet-600"
                              : "text-emerald-600"
                        }`}
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-7 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlan?.(tier.id, tier.name)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition min-h-[48px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    tier.featured
                      ? "bg-indigo-950 text-white hover:bg-indigo-900 shadow-sm"
                      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href="#plan-matrisi"
                  className="text-center text-xs font-semibold text-slate-500 hover:text-indigo-700 py-1"
                >
                  Tüm farkları tabloda gör ↓
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* 30-Day Full Trial & Unlimited Custom Strip */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-950">
                  30 Gün Tam Özellikli Trial Lisansı
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Enterprise paketindeki tüm AI, Omnichannel ve 44+ rapor modüllerini kendi
                  hatlarınızla 30 gün boyunca ücretsiz test edin.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan?.("trial", "30 Gün Trial")}
              className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Trial İste
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-950">
                  Limitsiz / Operatör Özel Paketi
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Sınırsız kullanıcı, eş zamanlı çağrı, tüm AI motorları, beyaz etiket
                  (White-Label) ve merkezi lisans yönetim paneli.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlan?.("unlimited", "Limitsiz / Operatör")}
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 transition"
            >
              Görüşme Planla
            </button>
          </div>
        </div>

        {/* ============================================================
            DETAILED YEASTAR-STYLE FEATURE COMPARISON MATRIX
           ============================================================ */}
        <div id="plan-matrisi" className="mt-14">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-950">
                Planlar Arasındaki Özellik Farkları
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Toplam <strong>{totalFeatureCount}</strong> temel ve gelişmiş yetenek
                kategorisinde Starter, Professional ve Enterprise karşılaştırması.
              </p>
            </div>

            {/* Difference Filter Toggle + Expand/Collapse */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-200 select-none">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={(e) => setOnlyDifferences(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Filter className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                <span>Yalnızca farkları göster</span>
              </label>

              <button
                type="button"
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                {allCollapsed ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Tüm Kategorileri Aç
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Tümünü Daralt
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Category Quick Filter Pills */}
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Özellik kategorisi filtresi"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              aria-pressed={selectedCategory === "all"}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-indigo-950 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              Tüm Kategoriler ({PLAN_COMPARISON_CATEGORIES.length})
            </button>
            {PLAN_COMPARISON_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setCollapsedCategories((prev) => ({ ...prev, [cat.id]: false }));
                  }}
                  aria-pressed={active}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-indigo-950 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {cat.title.split("&")[0].trim()}
                </button>
              );
            })}
          </div>

          {/* Responsive Semantic Comparison Table (modern-web-guidance: responsive-table) */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="plan-comparison-caption"
            className="nornia-plan-table-wrap mt-6 rounded-3xl border border-slate-200/90 bg-white shadow-card"
          >
            <table className="nornia-plan-table w-full text-left">
              <caption id="plan-comparison-caption" className="visually-hidden">
                Nornia Starter, Professional ve Enterprise planları arasındaki detaylı özellik
                karşılaştırma tablosu
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="min-w-[280px] bg-slate-50/95 px-6 py-5 text-left align-bottom border-b border-slate-200"
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Özellik / Modül
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">
                      Nornia Kurumsal Yetenek Matrisi
                    </div>
                  </th>
                  {PLAN_TIERS.map((tier) => (
                    <th
                      key={tier.id}
                      scope="col"
                      className={`w-[190px] px-4 py-5 text-center align-bottom border-b border-l border-slate-200 ${
                        tier.featured ? "bg-indigo-50/90" : "bg-slate-50/95"
                      }`}
                    >
                      {tier.featured && (
                        <div className="mb-1.5 inline-flex rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Önerilen
                        </div>
                      )}
                      <div className="text-base font-extrabold text-slate-950">
                        {tier.name}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {tier.subtitle}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectPlan?.(tier.id, tier.name)}
                        className={`mt-3 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          tier.featured
                            ? "bg-indigo-950 text-white hover:bg-indigo-900"
                            : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        Teklif Al
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleCategories.map((cat) => {
                  const isCollapsed = Boolean(collapsedCategories[cat.id]);
                  return (
                    <React.Fragment key={cat.id}>
                      {/* Category Group Divider Row */}
                      <tr className="nornia-cat-row bg-slate-100/80">
                        <th
                          colSpan={4}
                          scope="colgroup"
                          className="border-y border-slate-200 px-6 py-3.5 text-left"
                        >
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            onClick={() => toggleCategory(cat.id)}
                            className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded"
                          >
                            <div>
                              <div className="text-sm font-extrabold text-slate-950">
                                {cat.title}
                              </div>
                              <div className="text-xs font-normal text-slate-500 mt-0.5">
                                {cat.description}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shrink-0">
                              <span>{cat.rows.length} özellik</span>
                              {isCollapsed ? (
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </span>
                          </button>
                        </th>
                      </tr>

                      {!isCollapsed &&
                        cat.rows.map((row) => (
                          <tr
                            key={row.feature}
                            className="nornia-feat-row group hover:bg-slate-50/90 transition-colors"
                          >
                            <th
                              scope="row"
                              className="border-b border-slate-100 px-6 py-3.5 text-left align-middle font-normal"
                            >
                              <div className="text-sm font-semibold text-slate-900 leading-snug">
                                {row.feature}
                              </div>
                              {row.note && (
                                <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                                  {row.note}
                                </div>
                              )}
                            </th>
                            <td className="border-b border-l border-slate-100 px-4 py-3.5 text-center align-middle">
                              {renderPlanCell(row.starter, "starter")}
                            </td>
                            <td className="border-b border-l border-slate-100 bg-indigo-50/25 px-4 py-3.5 text-center align-middle">
                              {renderPlanCell(row.professional, "professional")}
                            </td>
                            <td className="border-b border-l border-slate-100 px-4 py-3.5 text-center align-middle">
                              {renderPlanCell(row.enterprise, "enterprise")}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-center text-xs text-slate-500">
            Not: Tüm planlarda yerel tek-tenant (On-Premise) veya Nornia Bulut kurulum
            desteklenir. Yapay zeka sesli asistan ve canlı çeviri için kendi API anahtarınızı
            (Gemini / OpenAI / ElevenLabs) veya kurum içi yerel GPU (Ollama + Whisper)
            sunucunuzu bağlayabilirsiniz.
          </p>
        </div>

        {/* Interactive Server Sizing Calculator Banner */}
        <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-indigo-200/80 bg-white p-6 sm:flex-row sm:items-center shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Calculator className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-950">
                On-Premise kurulum için ne kadar sunucu kaynağı gerekir?
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Kullanıcı adedini, eş zamanlı çağrı sayısını, yerel LLM ve ses kayıt süresini
                girin; ihtiyacınız olan vCPU, RAM, NVMe ve ağ bant genişliğini anında
                hesaplayın.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenSizingModal?.()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-950 hover:bg-indigo-100 transition min-h-[48px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Calculator className="h-4 w-4 text-indigo-700" aria-hidden="true" />
            Kapasite Hesaplayıcıyı Aç
          </button>
        </div>
      </div>
    </section>
  );
}
