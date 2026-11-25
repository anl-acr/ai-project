import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Headphones,
  Cloud,
  ShieldCheck,
  Smartphone,
  Server,
  Shield,
  Network,
  Cpu,
  Code2,
  ExternalLink,
  BookOpen,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Menu,
  Building2,
  Check,
  Lock,
  Monitor,
  Radio,
  FileDown,
  Layers,
} from "lucide-react";
import {
  HeroPanoramicStage,
  HeroIsometricShowcase,
} from "../components/HeroYeastarVisuals";
import LiveTranslateShowcase from "../components/LiveTranslateShowcase";
import { RunaMobileVisual, RunaDesktopVisual } from "../components/RunaAppVisuals";
import PlanComparisonSection from "../components/PlanComparisonSection";
import ServerSizingModal from "../components/ServerSizingModal";
import DemoRequestForm from "../components/DemoRequestForm";
import {
  SITE_CONFIG,
  HERO_METRICS,
  DEPLOYMENT_EDITIONS,
  COMPATIBILITY_BADGES,
  PLATFORM_TABS,
  CLIENT_APPS,
  TUNNEL_FLOW_STEPS,
  TUNNEL_PILLARS,
  ARCHITECTURE_CARDS,
  SECTOR_SOLUTIONS,
  FAQ_ITEMS,
} from "../data/siteContent";

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Uygulamalar", href: "#uygulamalar" },
  { label: "Tünel", href: "#tunel" },
  { label: "Çözümler", href: "#cozumler" },
  { label: "Planlar & Farklar", href: "#planlar", highlight: true },
  { label: "Doküman", href: SITE_CONFIG.docsUrl, external: true },
];

function MetricIcon({ tone }) {
  if (tone === "indigo") return <BarChart3 className="h-4 w-4 text-indigo-600" />;
  if (tone === "sky") return <Headphones className="h-4 w-4 text-sky-600" />;
  if (tone === "emerald") return <Cloud className="h-4 w-4 text-emerald-600" />;
  return <ShieldCheck className="h-4 w-4 text-rose-600" />;
}

function MetricBadgeBg({ tone }) {
  if (tone === "indigo") return "bg-indigo-50 ring-indigo-100";
  if (tone === "sky") return "bg-sky-50 ring-sky-100";
  if (tone === "emerald") return "bg-emerald-50 ring-emerald-100";
  return "bg-rose-50 ring-rose-100";
}

function ArchIcon({ name }) {
  switch (name) {
    case "smartphone":
      return <Smartphone className="h-5 w-5 text-indigo-600" />;
    case "server":
      return <Server className="h-5 w-5 text-sky-600" />;
    case "shield":
      return <Shield className="h-5 w-5 text-emerald-600" />;
    case "network":
      return <Network className="h-5 w-5 text-violet-600" />;
    case "cpu":
      return <Cpu className="h-5 w-5 text-amber-600" />;
    default:
      return <Code2 className="h-5 w-5 text-rose-600" />;
  }
}

export default function NorniaHomePage() {
  const [activeTabId, setActiveTabId] = useState(PLATFORM_TABS[0].id);
  const [activeSectorId, setActiveSectorId] = useState(SECTOR_SOLUTIONS[0].id);
  const [selectedDeployment, setSelectedDeployment] = useState("cloud");
  const [selectedPlanLabel, setSelectedPlanLabel] = useState("");
  const [sizingModalOpen, setSizingModalOpen] = useState(false);
  const [fallbackMenuOpen, setFallbackMenuOpen] = useState(false);

  const headerRef = useRef(null);
  const headerInnerRef = useRef(null);
  const siteMenuRef = useRef(null);
  const tablistRef = useRef(null);
  const tabPanelRefs = useRef({});

  const activeTab =
    PLATFORM_TABS.find((t) => t.id === activeTabId) || PLATFORM_TABS[0];
  const activeSector =
    SECTOR_SOLUTIONS.find((s) => s.id === activeSectorId) || SECTOR_SOLUTIONS[0];

  // Single-<nav> responsive layout measurement & popover synchronization (modern-web-guidance: navbar)
  useEffect(() => {
    const header = headerRef.current;
    const inner = headerInnerRef.current;
    const menu = siteMenuRef.current;
    if (!header || !inner || !menu || typeof window === "undefined") return undefined;

    const supportsPopover = Object.hasOwn(HTMLElement.prototype, "popover");
    let lastMeasuredWidth = 0;

    const syncNavbarLayout = () => {
      const currentlyWide = header.classList.contains("is-wide");
      const currentW = header.clientWidth;
      if (!currentlyWide && lastMeasuredWidth > 0 && currentW <= lastMeasuredWidth) {
        return;
      }

      const wasOpen =
        supportsPopover && typeof menu.matches === "function"
          ? menu.matches(":popover-open")
          : fallbackMenuOpen;

      header.classList.add("is-measuring");
      header.classList.add("is-wide");
      menu.removeAttribute("popover");

      const fitsInline = inner.scrollWidth <= inner.clientWidth + 1;
      lastMeasuredWidth = currentW;

      if (!fitsInline) {
        header.classList.remove("is-wide");
        menu.setAttribute("popover", "auto");
        if (wasOpen && supportsPopover && typeof menu.showPopover === "function") {
          try {
            menu.showPopover();
          } catch {}
        }
      } else {
        setFallbackMenuOpen(false);
      }

      window.requestAnimationFrame(() => {
        header.classList.remove("is-measuring");
      });
    };

    syncNavbarLayout();
    const ro = new ResizeObserver(syncNavbarLayout);
    ro.observe(header);
    ro.observe(menu);

    return () => ro.disconnect();
  }, []);

  // Scrollability fade fallback for horizontal tablist (modern-web-guidance: tabs)
  useEffect(() => {
    const scroller = tablistRef.current;
    if (!scroller || typeof window === "undefined") return undefined;
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline", "scroll()")) {
      return undefined;
    }
    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          scroller.classList.toggle(
            target === first ? "more-start" : "more-end",
            intersectionRatio < 1
          );
        }
      },
      { root: scroller, threshold: 1, rootMargin: "1px" }
    );
    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, []);

  // Sync hidden="until-found" attribute (React 18 coerces JSX hidden to boolean) & beforematch find-in-page sync
  useEffect(() => {
    PLATFORM_TABS.forEach((tab) => {
      const panelEl = tabPanelRefs.current[tab.id];
      if (!panelEl) return;
      if (tab.id === activeTabId) {
        panelEl.removeAttribute("hidden");
      } else {
        panelEl.setAttribute("hidden", "until-found");
      }
    });
  }, [activeTabId]);

  useEffect(() => {
    const cleanups = [];
    PLATFORM_TABS.forEach((tab) => {
      const panelEl = tabPanelRefs.current[tab.id];
      if (!panelEl) return;
      const onBeforeMatch = () => {
        setActiveTabId(tab.id);
      };
      panelEl.addEventListener("beforematch", onBeforeMatch);
      cleanups.push(() => panelEl.removeEventListener("beforematch", onBeforeMatch));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const selectPlatformTab = (tabId, buttonEl) => {
    setActiveTabId(tabId);
    if (buttonEl && typeof buttonEl.scrollIntoView === "function") {
      try {
        buttonEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch {}
    }
  };

  const handlePlatformTabKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % PLATFORM_TABS.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (idx - 1 + PLATFORM_TABS.length) % PLATFORM_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = PLATFORM_TABS.length - 1;
    if (nextIdx === null) return;

    e.preventDefault();
    const nextTab = PLATFORM_TABS[nextIdx];
    setActiveTabId(nextTab.id);
    const nextBtn = document.getElementById(`tab-${nextTab.id}`);
    if (nextBtn) {
      nextBtn.focus();
      try {
        nextBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch {}
    }
  };

  const closeMobileMenu = () => {
    setFallbackMenuOpen(false);
    const menu = siteMenuRef.current;
    if (menu && typeof menu.hidePopover === "function") {
      try {
        menu.hidePopover();
      } catch {}
    }
  };

  const handleMenuBtnClick = () => {
    if (typeof window !== "undefined" && !Object.hasOwn(HTMLElement.prototype, "popover")) {
      setFallbackMenuOpen((v) => !v);
    }
  };

  const handleDeploymentSelect = (editionId) => {
    if (editionId === "onprem") {
      setSelectedDeployment("onprem");
      setSelectedPlanLabel("Kurumsal On-Premise");
    } else if (editionId === "cloud") {
      setSelectedDeployment("cloud");
      setSelectedPlanLabel("Nornia Bulut (Yönetilen)");
    } else {
      setSelectedDeployment("hybrid");
      setSelectedPlanLabel("Enterprise & Multi-Tenant");
    }
    if (typeof document !== "undefined") {
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePlanSelect = (tierId, tierLabel) => {
    setSelectedPlanLabel(tierLabel);
    if (tierId === "enterprise" || tierId === "unlimited") {
      setSelectedDeployment("hybrid");
    } else {
      setSelectedDeployment("cloud");
    }
    if (typeof document !== "undefined") {
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <Head>
        <title>Nornia — Kurumsal Yapay Zeka Santral ve İletişim Platformu</title>
        <meta
          name="description"
          content="Nornia ile yapay zeka destekli kurumsal IP santral, 7/24 sesli asistan, 6 dil canlı çağrı çevirisi, WhatsApp/Instagram Omnichannel, Runa Mobil ve 44+ canlı raporu On-Premise veya Bulut'ta yönetin."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_CONFIG.domain} />
        <meta
          property="og:title"
          content="Nornia — IP Santralden Fazlası: Kurumsal AI Santral & Çağrı Merkezi"
        />
        <meta
          property="og:description"
          content="Starter, Professional ve Enterprise planları: 7/24 AI Sesli Asistan, 6 Dil Canlı Çeviri, Omnichannel, Runa Mobil/Masaüstü ve Tam İzole Bulut Multi-Tenant."
        />
        <meta property="og:image" content={`${SITE_CONFIG.domain}/apple-touch-icon.png`} />
        <link rel="canonical" href={`${SITE_CONFIG.domain}/`} />
      </Head>

      <div className="min-h-screen bg-white text-slate-900">
        {/* Skip link for keyboard accessibility */}
        <a
          href="#main-content"
          className="visually-hidden focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-indigo-950 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Ana içeriğe geç
        </a>

        {/* ============================================================
            STICKY SINGLE-<nav> CORPORATE HEADER (modern-web-guidance: navbar)
           ============================================================ */}
        <header
          ref={headerRef}
          className="nornia-site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md"
        >
          <div
            ref={headerInnerRef}
            className="nornia-header-inner mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-5 px-4 sm:px-6 lg:px-8 h-[68px] sm:h-[72px]"
          >
            {/* Brand Logo */}
            <a
              href="#"
              aria-current="page"
              className="flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 rounded-lg"
            >
              <img
                src="/favicon.svg"
                alt="Nornia logosu"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-sm"
              />
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-950">
                Nornia
              </span>
            </a>

            {/* Single semantic <nav> (right-most on mobile via CSS order, centered inline on desktop) */}
            <nav aria-label="Ana gezinme" className="nornia-nav-slot flex items-center gap-2">
              <button
                type="button"
                className="nornia-menu-btn inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                popovertarget="site-menu"
                popovertargetaction="toggle"
                aria-controls="site-menu"
                aria-label="Menüyü aç"
                onClick={handleMenuBtnClick}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">Menü</span>
              </button>

              <ul
                ref={siteMenuRef}
                id="site-menu"
                popover="auto"
                className={`nornia-site-menu list-none ${
                  fallbackMenuOpen ? "popover-open-fallback" : ""
                }`}
              >
                {NAV_LINKS.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={closeMobileMenu}
                      className={`inline-flex w-full items-center justify-between gap-1 rounded-lg px-2.5 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        item.highlight
                          ? "font-bold text-indigo-700 hover:text-indigo-950"
                          : "font-medium text-slate-600 hover:text-indigo-950"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.external && (
                        <ExternalLink
                          className="h-3 w-3 text-slate-400"
                          aria-hidden="true"
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Right CTA */}
            <div className="nornia-cta-slot flex items-center gap-2 ml-auto sm:ml-0">
              <a
                href="#demo"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-950 px-3.5 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Ücretsiz Demo
              </a>
            </div>
          </div>
        </header>

        <main id="main-content">
          {/* ============================================================
              SECTION 1 — YEASTAR-STYLE CENTERED HERO + PANORAMIC VISUAL STAGE
             ============================================================ */}
          <section className="hero-prism-bg relative overflow-hidden border-b border-slate-200/70">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 pt-10 sm:pt-14 lg:pb-20 lg:pt-16">
              {/* Centered Editorial Headline & CTAs */}
              <div className="mx-auto max-w-3xl text-center">
                <div className="prism-pill-border inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-indigo-950 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span>Yapay Zeka Doğuşlu Kurumsal Santral • On-Premise &amp; Bulut</span>
                </div>

                <h1 className="mt-4 sm:mt-5 text-[1.95rem] leading-[1.15] font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
                  IP Santralden Fazlası: Ses, Yapay Zeka ve Omnichannel Tek Platformda
                </h1>

                <p className="mx-auto mt-4 sm:mt-5 max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-600">
                  Asterisk PJSIP gücü, 7/24 Türkçe AI Sesli Asistan, 6 dilde canlı çağrı
                  çevirisi, Runa Mobil/Masaüstü, WhatsApp/Instagram gelen kutusu ve 44+
                  canlı raporu tek güvenli mimaride birleştirin.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 min-h-[48px]"
                  >
                    30 Gün Ücretsiz Dene
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <a
                    href="#planlar"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-5 py-3.5 text-sm font-semibold text-indigo-950 hover:bg-indigo-100/80 transition min-h-[48px]"
                  >
                    <Layers className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    Planları Karşılaştır
                  </a>
                  <a
                    href={SITE_CONFIG.catalogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition min-h-[48px]"
                  >
                    <FileDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Katalog (PDF)
                  </a>
                </div>
              </div>

              {/* Signature Wide Panoramic Visual Banner */}
              <HeroPanoramicStage />

              {/* 4 Crisp KPI Metric Strip under Panoramic Stage */}
              <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
                {HERO_METRICS.map((m) => (
                  <div
                    key={m.value}
                    className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm hover:border-indigo-200 transition"
                  >
                    <div
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${MetricBadgeBg(
                        { tone: m.tone }
                      )}`}
                    >
                      <MetricIcon tone={m.tone} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold tracking-tight text-slate-950 leading-tight">
                        {m.value}
                      </div>
                      <div className="text-xs font-medium text-slate-500 truncate">
                        {m.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 1B — YEASTAR 2-COL 3D ISOMETRIC SOFTWARE SHOWCASE
             ============================================================ */}
          <HeroIsometricShowcase />

          {/* ============================================================
              SECTION 2 — COMPACT DEPLOYMENT STRIP & ECOSYSTEM COMPATIBILITY
             ============================================================ */}
          <section
            id="kurulum"
            aria-label="Kurulum modelleri ve ekosistem uyumluluğu"
            className="border-b border-slate-200/80 bg-slate-50/70 py-10"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {/* Compact 3-column horizontal deployment highlights (not pricing cards) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {DEPLOYMENT_EDITIONS.map((ed) => (
                  <div
                    key={ed.id}
                    className="flex items-start gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {ed.id === "onprem" ? (
                        <Server className="h-5 w-5" aria-hidden="true" />
                      ) : ed.id === "cloud" ? (
                        <Cloud className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Network className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-950">
                        {ed.title}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {ed.subtitle} — {ed.highlights[0]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ecosystem & Compatibility Strip */}
              <div className="mt-7 flex flex-col items-center gap-4 border-t border-slate-200/80 pt-6 lg:flex-row lg:justify-between">
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tam Uyumlu Ekosistem
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                  {COMPATIBILITY_BADGES.map((item) => (
                    <span
                      key={item}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 3 — INTERACTIVE PLATFORM SHOWCASE (modern-web-guidance: tabs)
             ============================================================ */}
          <section id="platform" className="py-20 sm:py-24 bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                  Canlı Ürün Ekranları
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  Santral, Çağrı Merkezi ve Yapay Zeka Tek Arayüzde
                </h2>
                <p className="mt-3 text-base text-slate-600 sm:text-lg">
                  Ayrı lisanslar ve kopuk yazılımlar yerine tüm kurumsal iletişim
                  süreçlerinizi Nornia&apos;nın bütünleşik modüllerinden yönetin.
                </p>
              </div>

              {/* Single-row horizontally scrollable tablist with fade edges & underline */}
              <div
                ref={tablistRef}
                role="tablist"
                aria-label="Nornia platform modülleri"
                className="nornia-tablist mt-8"
              >
                {PLATFORM_TABS.map((tab, idx) => {
                  const isActive = tab.id === activeTab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      id={`tab-${tab.id}`}
                      type="button"
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      onClick={(e) => selectPlatformTab(tab.id, e.currentTarget)}
                      onKeyDown={(e) => handlePlatformTabKeyDown(e, idx)}
                      className="nornia-tab-btn"
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Panels: hidden="until-found", zero styles on panel element itself */}
              <div className="nornia-tabpanels-grid mt-8">
                {PLATFORM_TABS.map((tab) => {
                  const isSelected = tab.id === activeTab.id;
                  return (
                    <div
                      key={tab.id}
                      ref={(el) => {
                        tabPanelRefs.current[tab.id] = el;
                      }}
                      role="tabpanel"
                      id={`panel-${tab.id}`}
                      aria-labelledby={`tab-${tab.id}`}
                      hidden={isSelected ? undefined : "until-found"}
                    >
                      <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-slate-200/90 bg-slate-50/70 p-6 sm:p-8 lg:grid-cols-12 lg:p-10">
                        {/* Text & Bullets */}
                        <div className="lg:col-span-5">
                          <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100 shadow-2xs">
                            {tab.badge}
                          </span>
                          <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                            {tab.title}
                          </h3>
                          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                            {tab.description}
                          </p>

                          <ul className="mt-6 space-y-3">
                            {tab.bullets.map((b) => (
                              <li
                                key={b}
                                className="flex items-start gap-2.5 text-sm text-slate-700"
                              >
                                <CheckCircle2
                                  className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-7 flex flex-wrap items-center gap-3">
                            <a
                              href="#demo"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-900 transition"
                            >
                              Canlı Demo İste
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                            <a
                              href={tab.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition"
                            >
                              <BookOpen
                                className="h-3.5 w-3.5 text-indigo-600"
                                aria-hidden="true"
                              />
                              Kullanım Kılavuzunu Aç
                            </a>
                          </div>
                        </div>

                        {/* Real Nornia Product Screenshot Frame */}
                        <div className="lg:col-span-7">
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                              <div className="flex items-center gap-1.5" aria-hidden="true">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                              </div>
                              <span className="font-mono text-[11px] text-slate-500">
                                sirketiniz.nornia.com.tr — {tab.label}
                              </span>
                              <span className="w-10" aria-hidden="true" />
                            </div>
                            <img
                              src={tab.screenshot}
                              alt={tab.screenshotAlt}
                              loading="lazy"
                              className="block w-full h-auto object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 4 — AI REAL-TIME ÇAĞRI ÇEVİRİSİ
             ============================================================ */}
          <LiveTranslateShowcase />

          {/* ============================================================
              SECTION 5 — RUNA MOBİL & MASAÜSTÜ (Linkus UC Clients Equivalent)
             ============================================================ */}
          <section
            id="uygulamalar"
            className="border-t border-slate-200/80 bg-slate-50/70 py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 border border-slate-200">
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    Runa Mobil &amp; Masaüstü Uygulamaları
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Ofiste, Evde ve Sahada Tek Kurumsal Dahili Deneyimi
                  </h2>
                  <p className="mt-3 text-base text-slate-600">
                    Tarayıcı Web Telefonuna ek olarak yerel iOS, Android, macOS ve Windows
                    uygulamalarıyla her cihazda HD ses kalitesi ve kesintisiz çağrı akışı.
                  </p>
                </div>
                <a
                  href="https://dokuman.nornia.com.tr/masaustu-mobil-ve-webphone/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                >
                  <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  Uygulama Kurulum Kılavuzu
                </a>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
                {CLIENT_APPS.map((app) => (
                  <article
                    key={app.id}
                    className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-card hover:border-indigo-200 transition"
                  >
                    <div className="border-b border-slate-100">
                      {app.id === "runa-mobile" ? (
                        <RunaMobileVisual />
                      ) : (
                        <RunaDesktopVisual />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                          {app.id === "runa-mobile" ? (
                            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {app.badge}
                        </span>

                        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">
                          {app.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {app.summary}
                        </p>

                        <ul className="mt-6 space-y-4">
                          {app.highlights.map((hl) => (
                            <li key={hl.title} className="flex items-start gap-3">
                              <CheckCircle2
                                className="h-4 w-4 shrink-0 text-emerald-600 mt-1"
                                aria-hidden="true"
                              />
                              <div>
                                <div className="text-sm font-bold text-slate-900">
                                  {hl.title}
                                </div>
                                <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                                  {hl.desc}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                        <a
                          href="#demo"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-950"
                        >
                          Canlı Test Et
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <a
                          href={app.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-700"
                        >
                          Detaylı İncele
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 6 — NORNIA CONNECT (Yeastar RAS Equivalent)
             ============================================================ */}
          <section
            id="tunel"
            className="border-t border-slate-200/80 bg-white py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Nornia Connect — Sıfır-Port Bulut Köprüsü
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  Firewall&apos;da Tek Port Açmadan Güvenli Tünel ile Dünyaya Bağlanın
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  Klasik IP santrallerde uzaktan erişim için statik IP, karmaşık NAT/port
                  yönlendirmeleri ve açık SIP portları gerekir. Nornia Connect, kurum içi
                  santralinizden dışarı doğru kurulan şifreli tünelle tüm bu riskleri ve
                  kurulum zahmetini ortadan kaldırır.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TUNNEL_FLOW_STEPS.map((node, idx) => (
                  <div
                    key={node.step}
                    className="relative rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950 font-mono text-xs font-bold text-white">
                        {node.step}
                      </span>
                      {idx < TUNNEL_FLOW_STEPS.length - 1 && (
                        <ArrowRight
                          className="hidden lg:block h-4 w-4 text-indigo-400"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <h3 className="mt-3.5 text-sm font-extrabold text-slate-950">
                      {node.title}
                    </h3>
                    <div className="mt-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                      {node.subtitle}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {node.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5 space-y-4">
                  {TUNNEL_PILLARS.map((pillar) => (
                    <div
                      key={pillar.title}
                      className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5"
                    >
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
                        <ShieldCheck
                          className="h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                        {pillar.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                        {pillar.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-7">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-semibold text-slate-800">
                          Nornia Connect — Sıfır-Port Bulut Köprüsü
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        WireGuard + WSS + TURN Aktif
                      </span>
                    </div>
                    <img
                      src="/screenshots/nornia-connect-tunnel.jpg"
                      alt="Nornia Connect Sıfır-Port Bulut Köprüsü, WireGuard SIP Edge ve WebRTC TURN Ses Rölesi ayar ekranı"
                      loading="lazy"
                      className="block w-full h-auto"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
                    <span>
                      On-Premise santralinizde tek anahtarla etkinleştirilir — ek donanım
                      gerekmez.
                    </span>
                    <a
                      href="https://dokuman.nornia.com.tr/sunucu-ag-ve-nornia-connect/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      Tünel Dokümantasyonu
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 7 — 6-CARD ARCHITECTURE + SECTOR SOLUTIONS
             ============================================================ */}
          <section
            id="mimari"
            className="border-y border-slate-200/80 bg-slate-50/70 py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 border border-slate-200">
                    Kurumsal Altyapı &amp; Güvenlik
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    BT Ekiplerinin Güveneceği Modern Telekom Mimarisi
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={SITE_CONFIG.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                  >
                    <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    Teknik Dokümantasyon
                  </a>
                  <a
                    href={SITE_CONFIG.apiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                  >
                    <Code2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    REST API Portalı
                  </a>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {ARCHITECTURE_CARDS.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-card transition"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80">
                      <ArchIcon name={card.icon} />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {card.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="cozumler" className="py-20 sm:py-24 bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Sektörel Çözümler
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  Her Sektörün Çağrı ve Müşteri Dinamiğine Hazır
                </h2>
                <p className="mt-3 text-base text-slate-600">
                  Sektörünüzü seçin, Nornia&apos;nın hangi modüllerle nasıl fark yarattığını
                  inceleyin.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div
                  role="tablist"
                  aria-label="Sektörel çözümler"
                  className="lg:col-span-4 flex flex-col gap-2.5"
                >
                  {SECTOR_SOLUTIONS.map((s) => {
                    const active = s.id === activeSector.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveSectorId(s.id)}
                        className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition min-h-[56px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                          active
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3 text-sm font-bold">
                          <Building2
                            className={`h-4 w-4 ${
                              active ? "text-indigo-600" : "text-slate-400"
                            }`}
                            aria-hidden="true"
                          />
                          {s.name}
                        </span>
                        <ArrowRight
                          className={`h-4 w-4 transition-transform ${
                            active ? "text-indigo-600 translate-x-0.5" : "text-slate-300"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-8 rounded-3xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                      {activeSector.name}
                    </div>
                    <h3 className="mt-2 text-2xl font-bold text-slate-950">
                      {activeSector.headline}
                    </h3>
                    <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
                      {activeSector.summary}
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {activeSector.stats.map((st) => (
                        <div
                          key={st.label}
                          className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
                        >
                          <div className="text-2xl font-extrabold text-indigo-950">
                            {st.value}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {st.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500 mb-2.5">
                      Öne Çıkan Nornia Modülleri
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeSector.modules.map((mod) => (
                        <span
                          key={mod}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 8 — YEASTAR-STYLE PLAN OVERVIEW & FEATURE COMPARISON MATRIX
             ============================================================ */}
          <PlanComparisonSection
            onSelectPlan={handlePlanSelect}
            onOpenSizingModal={() => setSizingModalOpen(true)}
          />

          {/* ============================================================
              SECTION 9 — NATIVE ACCESSIBLE FAQ ACCORDION
             ============================================================ */}
          <section
            id="sss"
            aria-labelledby="faq-heading"
            className="nornia-faq py-20 sm:py-24 bg-white"
          >
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Sık Sorulan Sorular
                </span>
                <h2
                  id="faq-heading"
                  className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
                >
                  Karar Vermeden Önce Merak Edilenler
                </h2>
              </div>

              <div className="mt-10 space-y-3">
                {FAQ_ITEMS.map((item, idx) => (
                  <details key={item.q} open={idx === 0}>
                    <summary>{item.q}</summary>
                    <div className="px-6 pb-5 pt-1 text-sm leading-relaxed text-slate-600">
                      <p>{item.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 10 — DEMO & CONSULTATION FORM
             ============================================================ */}
          <section
            id="demo"
            className="border-t border-slate-200/80 bg-slate-50/80 py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                    Canlı Demo &amp; 30 Gün Trial
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Nornia&apos;yı Kendi Senaryonuzla Canlı Test Edin
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    Formu doldurun; mühendislik ekibimiz aynı gün dönüş yaparak size özel
                    canlı demo ortamını, 30 günlük Trial lisansını ve paket teklifini paylaşsın.
                  </p>

                  <ol className="mt-7 space-y-4">
                    {[
                      {
                        step: "01",
                        title: "15 Dakikalık İhtiyaç & Plan Analizi",
                        desc: "Abone sayınız, çağrı hacminiz, mevcut IP telefonlarınız ve Starter / Professional / Enterprise ihtiyacınız netleştirilir.",
                      },
                      {
                        step: "02",
                        title: "Canlı Ürün & AI Gösterimi",
                        desc: "AI Sesli Asistan, 6 Dil Canlı Çeviri, Temsilci Paneli, Omnichannel ve 44+ rapor gerçek çağrıyla gösterilir.",
                      },
                      {
                        step: "03",
                        title: "Özel Mimari & Şeffaf Teklif",
                        desc: "On-Premise, Nornia Bulut veya Multi-Tenant seçiminize göre donanım önerisi ve lisans teklifi sunulur.",
                      },
                    ].map((s) => (
                      <li key={s.step} className="flex items-start gap-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-950 font-mono text-xs font-bold text-white">
                          {s.step}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{s.title}</div>
                          <p className="mt-0.5 text-sm text-slate-600">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Doğrudan İletişim
                    </div>
                    <div className="flex flex-col gap-2.5 text-sm">
                      <a
                        href={SITE_CONFIG.phoneHref}
                        className="inline-flex items-center gap-2.5 font-semibold text-slate-800 hover:text-indigo-700"
                      >
                        <Phone className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                        {SITE_CONFIG.phoneDisplay}
                      </a>
                      <a
                        href={`mailto:${SITE_CONFIG.email}`}
                        className="inline-flex items-center gap-2.5 font-semibold text-slate-800 hover:text-indigo-700"
                      >
                        <Mail className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                        {SITE_CONFIG.email}
                      </a>
                      <a
                        href={SITE_CONFIG.whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 font-semibold text-emerald-700 hover:text-emerald-800"
                      >
                        <MessageSquare
                          className="h-4 w-4 text-emerald-600"
                          aria-hidden="true"
                        />
                        WhatsApp Kurumsal Destek Hattı
                      </a>
                      <div className="inline-flex items-center gap-2.5 text-slate-500">
                        <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {SITE_CONFIG.location}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <DemoRequestForm
                    preselectedDeployment={selectedDeployment}
                    preselectedPlan={selectedPlanLabel}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ============================================================
            SECTION 11 — CLEAN LIGHT CORPORATE FOOTER
           ============================================================ */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <a href="#" className="inline-flex items-center gap-2.5">
                  <img
                    src="/favicon.svg"
                    alt="Nornia logosu"
                    className="h-9 w-9 rounded-xl shadow-sm"
                  />
                  <span className="text-xl font-extrabold tracking-tight text-slate-950">
                    Nornia
                  </span>
                </a>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
                  Yapay zeka destekli kurumsal IP santral, çağrı merkezi, omnichannel ve
                  analitik iletişim platformu.
                </p>
              </div>

              <div className="lg:col-span-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Platform &amp; Paketler
                </h3>
                <ul className="mt-3.5 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <a href="#kurulum" className="hover:text-indigo-700">
                      On-Premise, Bulut &amp; Multi-Tenant
                    </a>
                  </li>
                  <li>
                    <a href="#platform" className="hover:text-indigo-700">
                      AI Sesli Asistan &amp; Canlı Çeviri
                    </a>
                  </li>
                  <li>
                    <a href="#uygulamalar" className="hover:text-indigo-700">
                      Runa Mobil &amp; Masaüstü
                    </a>
                  </li>
                  <li>
                    <a href="#tunel" className="hover:text-indigo-700">
                      Nornia Connect Sıfır-Port Tünel
                    </a>
                  </li>
                  <li>
                    <a href="#planlar" className="font-semibold text-indigo-700 hover:text-indigo-950">
                      Plan Karşılaştırma Matrisi
                    </a>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Kaynaklar &amp; Geliştiriciler
                </h3>
                <ul className="mt-3.5 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <a
                      href={SITE_CONFIG.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-indigo-700"
                    >
                      Kullanım Kılavuzu
                      <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-indigo-700"
                    >
                      REST API Dokümantasyonu
                      <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.catalogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-indigo-700"
                    >
                      Kurumsal Tanıtım Kataloğu (PDF)
                      <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setSizingModalOpen(true)}
                      className="inline-flex items-center gap-1 hover:text-indigo-700 text-left"
                    >
                      Sunucu Kapasite Hesaplayıcı
                    </button>
                  </li>
                  <li>
                    <a href="#sss" className="hover:text-indigo-700">
                      Sık Sorulan Sorular
                    </a>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  İletişim
                </h3>
                <ul className="mt-3.5 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <a href={SITE_CONFIG.phoneHref} className="hover:text-indigo-700">
                      {SITE_CONFIG.phoneDisplay}
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${SITE_CONFIG.email}`} className="hover:text-indigo-700">
                      {SITE_CONFIG.email}
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-700"
                    >
                      WhatsApp Destek
                    </a>
                  </li>
                  <li>
                    <a
                      href="#demo"
                      className="font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      Demo Talep Et →
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 pt-6 text-xs text-slate-500 sm:flex-row">
              <p>© {new Date().getFullYear()} Nornia. Tüm hakları saklıdır.</p>
              <p>KVKK Uyumlu Kurumsal İletişim Altyapısı • www.nornia.com.tr</p>
            </div>
          </div>
        </footer>
        {/* Native Modal Popup: On-Premise Server Sizing Calculator */}
        <ServerSizingModal
          open={sizingModalOpen}
          onClose={() => setSizingModalOpen(false)}
          onApplyToDemo={(sizingLabel) => {
            setSizingModalOpen(false);
            setSelectedDeployment("onprem");
            setSelectedPlanLabel(sizingLabel);
            if (typeof document !== "undefined") {
              document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />
      </div>
    </>
  );
}
