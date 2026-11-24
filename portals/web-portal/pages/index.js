import React, { useState } from "react";
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
  Calculator,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Menu,
  X,
  Building2,
  Check,
  Lock,
  Monitor,
  Radio,
} from "lucide-react";
import HeroProductPreview from "../components/HeroProductPreview";
import DemoRequestForm from "../components/DemoRequestForm";
import {
  SITE_CONFIG,
  HERO_METRICS,
  COMPATIBILITY_BADGES,
  PLATFORM_TABS,
  CLIENT_APPS,
  TUNNEL_FLOW_STEPS,
  TUNNEL_PILLARS,
  ARCHITECTURE_CARDS,
  SECTOR_SOLUTIONS,
  DEPLOYMENT_PLANS,
  FAQ_ITEMS,
} from "../data/siteContent";

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Uygulamalar", href: "#uygulamalar" },
  { label: "Sıfır-Port Tünel", href: "#tunel" },
  { label: "Çözümler", href: "#cozumler" },
  { label: "Modeller", href: "#modeller" },
  { label: "Doküman", href: SITE_CONFIG.docsUrl, external: true },
  { label: "API", href: SITE_CONFIG.apiUrl, external: true },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTab =
    PLATFORM_TABS.find((t) => t.id === activeTabId) || PLATFORM_TABS[0];
  const activeSector =
    SECTOR_SOLUTIONS.find((s) => s.id === activeSectorId) || SECTOR_SOLUTIONS[0];

  const handlePlanSelect = (planName) => {
    if (planName.toLowerCase().includes("on-premise")) {
      setSelectedDeployment("onprem");
    } else if (planName.toLowerCase().includes("bulut")) {
      setSelectedDeployment("cloud");
    } else {
      setSelectedDeployment("hybrid");
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
          content="Nornia ile yapay zeka destekli kurumsal IP santral, 7/24 sesli asistan, WhatsApp/Instagram Omnichannel gelen kutusu, Runa Mobil ve 44+ canlı raporu tek güvenli mimaride yönetin."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_CONFIG.domain} />
        <meta
          property="og:title"
          content="Nornia — Kurumsal Yapay Zeka Santral ve İletişim Platformu"
        />
        <meta
          property="og:description"
          content="7/24 AI Sesli Asistan, Temsilci Çağrı Paneli, Omnichannel WhatsApp/Instagram ve On-Premise & Bulut kurumsal santral altyapısı."
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
            STICKY CORPORATE NAVBAR (Seçenek 2 Pure Light)
           ============================================================ */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-[72px]">
            {/* Brand Logo */}
            <a
              href="#"
              className="flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 rounded-lg"
            >
              <img
                src="/favicon.svg"
                alt="Nornia logosu"
                className="h-9 w-9 rounded-xl shadow-sm"
              />
              <span className="text-xl font-extrabold tracking-tight text-slate-950">
                Nornia
              </span>
            </a>

            {/* Desktop Navigation */}
            <nav aria-label="Ana gezinme" className="hidden lg:flex items-center gap-7">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-indigo-950 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 rounded"
                >
                  {item.label}
                  {item.external && (
                    <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  )}
                </a>
              ))}
            </nav>

            {/* Right CTA & Mobile Menu Button */}
            <div className="flex items-center gap-3">
              <a
                href="#demo"
                className="hidden sm:inline-flex items-center justify-center rounded-xl bg-indigo-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Demo Talep Et
              </a>

              <button
                type="button"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="inline-flex lg:hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Nav Drawer */}
          {mobileMenuOpen && (
            <nav
              id="mobile-nav-drawer"
              aria-label="Mobil menü"
              className="lg:hidden border-t border-slate-200 bg-white px-4 pb-5 pt-3 shadow-lg"
            >
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>{item.label}</span>
                    {item.external && (
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    )}
                  </a>
                ))}
                <a
                  href="#demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  Demo Talep Et
                </a>
              </div>
            </nav>
          )}
        </header>

        <main id="main-content">
          {/* ============================================================
              SECTION 1 — ASYMMETRIC EDITORIAL HERO (Seçenek 2 Signature)
             ============================================================ */}
          <section className="hero-prism-bg relative overflow-hidden border-b border-slate-200/70">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 pt-12 sm:pt-16 lg:pb-24 lg:pt-20">
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
                {/* Left Column: Headline, CTAs & 4 KPI Cards */}
                <div className="lg:col-span-6">
                  <div className="prism-pill-border inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-indigo-950 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                    <span>Kurumsal AI Santral Platformu</span>
                  </div>

                  <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                    Tüm Kurumsal İletişiminiz Tek Akıllı Platformda
                  </h1>

                  <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                    Yapay zeka destekli kurumsal santral, 7/24 Türkçe sesli asistan,
                    WhatsApp/Instagram omnichannel gelen kutusu ve 44+ canlı analitik
                    raporunu yüksek güvenlikli tek bir mimaride yönetin.
                  </p>

                  {/* Primary & Secondary CTAs */}
                  <div className="mt-8 flex flex-wrap items-center gap-3.5">
                    <a
                      href="#demo"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 min-h-[48px]"
                    >
                      Demo Talep Et
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <a
                      href="#platform"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 min-h-[48px]"
                    >
                      Platformu İncele
                    </a>
                  </div>

                  {/* 4 Crisp KPI Metric Cards (Seçenek 2 Signature) */}
                  <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {HERO_METRICS.map((m) => (
                      <div
                        key={m.value}
                        className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-200 transition"
                      >
                        <div
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${MetricBadgeBg(
                            { tone: m.tone }
                          )}`}
                        >
                          <MetricIcon tone={m.tone} />
                        </div>
                        <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-950">
                          {m.value}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-slate-500 leading-snug">
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Interactive Light SaaS Product Window */}
                <div className="lg:col-span-6">
                  <HeroProductPreview />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 2 — COMPATIBILITY & ECOSYSTEM STRIP
             ============================================================ */}
          <section
            aria-label="Donanım ve protokol uyumluluğu"
            className="border-b border-slate-200/70 bg-slate-50/70 py-7"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
              SECTION 3 — INTERACTIVE PLATFORM SHOWCASE (REAL SCREENSHOTS)
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

              {/* Tab Switcher */}
              <div
                role="tablist"
                aria-label="Nornia platform modülleri"
                className="mt-8 flex flex-wrap gap-2"
              >
                {PLATFORM_TABS.map((tab) => {
                  const isActive = tab.id === activeTab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      id={`tab-${tab.id}`}
                      type="button"
                      aria-selected={isActive}
                      aria-controls={`panel-${tab.id}`}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        isActive
                          ? "bg-indigo-950 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Panel */}
              <div
                role="tabpanel"
                id={`panel-${activeTab.id}`}
                aria-labelledby={`tab-${activeTab.id}`}
                className="mt-8 grid grid-cols-1 items-center gap-8 rounded-3xl border border-slate-200/90 bg-slate-50/70 p-6 sm:p-8 lg:grid-cols-12 lg:p-10"
              >
                {/* Text & Bullets */}
                <div className="lg:col-span-5">
                  <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100 shadow-2xs">
                    {activeTab.badge}
                  </span>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                    {activeTab.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {activeTab.description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {activeTab.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
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
                      href={activeTab.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
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
                        sirketiniz.nornia.com.tr — {activeTab.label}
                      </span>
                      <span className="w-10" aria-hidden="true" />
                    </div>
                    <img
                      src={activeTab.screenshot}
                      alt={activeTab.screenshotAlt}
                      loading="lazy"
                      className="block w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 3B — RUNA MOBİL & RUNA MASAÜSTÜ UYGULAMALARI
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
                    {/* Crisp Product Showcase Visual */}
                    <div className="border-b border-slate-100 bg-slate-50">
                      <img
                        src={app.image}
                        alt={app.imageAlt}
                        loading="lazy"
                        className="block w-full h-auto object-cover"
                      />
                    </div>

                    {/* Content & Features */}
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
              SECTION 3C — NORNIA CONNECT (SIFIR-PORT GÜVENLİ TÜNEL MİMARİSİ)
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

              {/* 4-Step Visual Architecture Flow Bar */}
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

              {/* Split: 4 Technical Pillars + Real Nornia Connect Screenshot */}
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
              SECTION 4 — 6-CARD ARCHITECTURE & SECURITY PILLARS
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

          {/* ============================================================
              SECTION 5 — SECTORAL SOLUTIONS
             ============================================================ */}
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
                {/* Sector selector buttons */}
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

                {/* Active sector detail card */}
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
              SECTION 6 — DEPLOYMENT & LICENSING MODELS + SIZING CALCULATOR CTA
             ============================================================ */}
          <section
            id="modeller"
            className="border-y border-slate-200/80 bg-slate-50/70 py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 border border-slate-200">
                  Esnek Kurulum &amp; Lisanslama
                </span>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  Altyapınıza En Uygun Kurulum Modelini Seçin
                </h2>
                <p className="mt-3 text-base text-slate-600">
                  Kendi sunucunuzda tam bağımsız On-Premise, yönetilen Nornia Bulut veya
                  çoklu kiracılı Enterprise mimarisi — tüm modellerde aynı güçlü Nornia
                  çekirdeği.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {DEPLOYMENT_PLANS.map((plan) => (
                  <div
                    key={plan.name}
                    className={`flex flex-col justify-between rounded-3xl p-7 transition ${
                      plan.featured
                        ? "border-2 border-indigo-600 bg-white shadow-floating ring-4 ring-indigo-50"
                        : "border border-slate-200 bg-white shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            plan.featured
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {plan.badge}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-extrabold text-slate-950">
                        {plan.name}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {plan.description}
                      </p>

                      <ul className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                        {plan.features.map((feat) => (
                          <li
                            key={feat}
                            className="flex items-start gap-2.5 text-sm text-slate-700"
                          >
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 mt-0.5 ${
                                plan.featured ? "text-indigo-600" : "text-emerald-600"
                              }`}
                              aria-hidden="true"
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlanSelect(plan.name)}
                      className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition min-h-[48px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        plan.featured
                          ? "bg-indigo-950 text-white hover:bg-indigo-900 shadow-sm"
                          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {plan.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Interactive Server Sizing Calculator Banner */}
              <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-indigo-200/80 bg-white p-6 sm:flex-row sm:items-center shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Calculator className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      On-Premise için ne kadar sunucu kaynağı gerekir?
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Kullanıcı adedini, eş zamanlı çağrı sayısını, yerel LLM ve ses kayıt
                      süresini girin; ihtiyacınız olan vCPU, RAM, NVMe ve ağ bant genişliğini
                      anında hesaplayın.
                    </p>
                  </div>
                </div>
                <a
                  href={SITE_CONFIG.sizingCalcUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-950 hover:bg-indigo-100 transition min-h-[48px]"
                >
                  Kapasite Hesaplayıcıyı Aç
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* ============================================================
              SECTION 7 — NATIVE ACCESSIBLE FAQ ACCORDION
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
              SECTION 8 — DEMO & CONSULTATION FORM
             ============================================================ */}
          <section
            id="demo"
            className="border-t border-slate-200/80 bg-slate-50/80 py-20 sm:py-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
                {/* Left Column: Consultation Steps & Direct Contact */}
                <div className="lg:col-span-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                    Canlı Demo &amp; Mimari Danışmanlık
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    Nornia&apos;yı Kendi Senaryonuzla Canlı Test Edin
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    Formu doldurun; mühendislik ekibimiz aynı gün dönüş yaparak size özel
                    canlı demo ortamını ve kurulum planını paylaşsın.
                  </p>

                  <ol className="mt-7 space-y-4">
                    {[
                      {
                        step: "01",
                        title: "15 Dakikalık İhtiyaç Analizi",
                        desc: "Abone sayınız, çağrı hacminiz, mevcut IP telefonlarınız ve AI hedefleriniz netleştirilir.",
                      },
                      {
                        step: "02",
                        title: "Canlı Ürün Gösterimi",
                        desc: "AI Sesli Asistan, Temsilci Paneli, Omnichannel ve 44+ rapor gerçek çağrıyla canlı gösterilir.",
                      },
                      {
                        step: "03",
                        title: "Özel Mimari & Lisans Teklifi",
                        desc: "On-Premise veya Bulut seçeneğine göre donanım önerisi ve şeffaf teklif sunulur.",
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

                  {/* Direct Contact Box */}
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
                        <MessageSquare className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        WhatsApp Kurumsal Destek Hattı
                      </a>
                      <div className="inline-flex items-center gap-2.5 text-slate-500">
                        <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {SITE_CONFIG.location}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Accessible Demo Request Form */}
                <div className="lg:col-span-7">
                  <DemoRequestForm preselectedDeployment={selectedDeployment} />
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ============================================================
            SECTION 9 — CLEAN LIGHT CORPORATE FOOTER
           ============================================================ */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
              {/* Brand */}
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

              {/* Platform */}
              <div className="lg:col-span-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Platform
                </h3>
                <ul className="mt-3.5 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <a href="#platform" className="hover:text-indigo-700">
                      AI Sesli Asistan
                    </a>
                  </li>
                  <li>
                    <a href="#platform" className="hover:text-indigo-700">
                      Temsilci Çağrı Paneli
                    </a>
                  </li>
                  <li>
                    <a href="#platform" className="hover:text-indigo-700">
                      Omnichannel Gelen Kutusu
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
                    <a href="#modeller" className="hover:text-indigo-700">
                      On-Premise &amp; Bulut Modelleri
                    </a>
                  </li>
                </ul>
              </div>

              {/* Resources */}
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
                      href={SITE_CONFIG.sizingCalcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-indigo-700"
                    >
                      Sunucu Kapasite Hesaplayıcı
                      <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    </a>
                  </li>
                  <li>
                    <a href="#sss" className="hover:text-indigo-700">
                      Sık Sorulan Sorular
                    </a>
                  </li>
                </ul>
              </div>

              {/* Contact */}
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
                    <a href="#demo" className="font-semibold text-indigo-700 hover:text-indigo-900">
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
      </div>
    </>
  );
}
