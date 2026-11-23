import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import {
  Search,
  Copy,
  Check,
  Play,
  ShieldCheck,
  KeyRound,
  Webhook,
  Code2,
  BookOpen,
  Download,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  Terminal,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Layers,
  Lock,
  Menu,
  X,
  CheckCircle2,
  Cpu
} from "lucide-react";
import catalog from "../data/api-catalog.json";
import { generateCodeSnippet, resolveSamplePath, WEBHOOK_VERIFY_SNIPPETS } from "../utils/codeGenerators";

const METHOD_STYLES = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  POST: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  DELETE: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  PATCH: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
};

const LANG_TABS = [
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
  { id: "node", label: "Node.js" },
  { id: "php", label: "PHP" },
  { id: "csharp", label: "C# (.NET)" }
];

export default function ApiPortalPage() {
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState({ type: "intro", id: "quickstart" });
  const [expandedCats, setExpandedCats] = useState(() => {
    const init = {};
    (catalog.categories || []).forEach((c) => {
      init[c.id] = true;
    });
    return init;
  });

  // Developer Sandbox Settings (stored only in browser sessionStorage)
  const [pbxBaseUrl, setPbxBaseUrl] = useState(catalog.base_url_example || "https://musteri.nornia.com.tr");
  const [apiKey, setApiKey] = useState("");
  const [codeLang, setCodeLang] = useState("curl");
  const [webhookLang, setWebhookLang] = useState("python");
  const [copiedId, setCopiedId] = useState("");
  const [apiFilter, setApiFilter] = useState("all"); // "all" | "api_key" | "platform"

  // Try-It Live Playground state
  const [tryPath, setTryPath] = useState("");
  const [tryBody, setTryBody] = useState("");
  const [tryLoading, setTryLoading] = useState(false);
  const [tryResult, setTryResult] = useState(null);

  // Command-K Search Modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("nornia_portal_theme");
    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
    const savedUrl = sessionStorage.getItem("nornia_api_base_url");
    const savedKey = sessionStorage.getItem("nornia_api_key");
    if (savedUrl) setPbxBaseUrl(savedUrl);
    if (savedKey) setApiKey(savedKey);

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

  const allEndpoints = useMemo(() => {
    const list = [];
    (catalog.categories || []).forEach((cat) => {
      (cat.endpoints || []).forEach((ep) => {
        list.push({ ...ep, categoryTitle: cat.title, categoryId: cat.id });
      });
    });
    return list;
  }, []);

  const selectedEndpoint = useMemo(() => {
    if (activeView.type !== "endpoint") return null;
    return allEndpoints.find((e) => e.id === activeView.id) || allEndpoints[0] || null;
  }, [activeView, allEndpoints]);

  useEffect(() => {
    if (selectedEndpoint) {
      setTryPath(resolveSamplePath(selectedEndpoint.path));
      setTryBody(selectedEndpoint.sample_body ? JSON.stringify(selectedEndpoint.sample_body, null, 2) : "");
      setTryResult(null);
    }
  }, [selectedEndpoint?.id]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allEndpoints.slice(0, 12);
    return allEndpoints.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.scope.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q)
    );
  }, [searchQuery, allEndpoints]);

  const copyText = (text, id) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1800);
  };

  const handleRunPlayground = async () => {
    if (!selectedEndpoint) return;
    const base = pbxBaseUrl.trim().replace(/\/+$/, "");
    if (!base) {
      setTryResult({ ok: false, status: 0, text: "Lütfen geçerli bir Santral URL adresi girin (örn. https://musteri.nornia.com.tr)." });
      return;
    }
    setTryLoading(true);
    setTryResult(null);
    const started = performance.now();
    try {
      const targetUrl = `${base}${tryPath.startsWith("/") ? tryPath : `/${tryPath}`}`;
      const headers = { Accept: "application/json" };
      if (apiKey.trim()) headers["X-API-Key"] = apiKey.trim();
      const opts = { method: selectedEndpoint.method, headers };
      if (["POST", "PUT", "PATCH"].includes(selectedEndpoint.method) && tryBody.trim()) {
        headers["Content-Type"] = "application/json";
        opts.body = tryBody;
      }
      const res = await fetch(targetUrl, opts);
      const ms = Math.round(performance.now() - started);
      const contentType = res.headers.get("content-type") || "";
      let bodyText = "";
      if (contentType.includes("application/json")) {
        const j = await res.json();
        bodyText = JSON.stringify(j, null, 2);
      } else {
        bodyText = await res.text();
      }
      setTryResult({ ok: res.ok, status: res.status, ms, text: bodyText });
    } catch (err) {
      setTryResult({
        ok: false,
        status: 0,
        ms: Math.round(performance.now() - started),
        text: `İstek gönderilemedi (CORS veya ağ erişimi): ${err.message}\n\nİpucu: Santralinizin API CORS / IP Beyaz Liste ayarlarını kontrol edin veya sağdaki cURL komutunu terminalinizde çalıştırın.`
      });
    } finally {
      setTryLoading(false);
    }
  };

  const selectView = (type, id) => {
    setActiveView({ type, id });
    setMobileNavOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentCode = selectedEndpoint
    ? generateCodeSnippet(codeLang, selectedEndpoint, pbxBaseUrl, apiKey)
    : generateCodeSnippet(codeLang, allEndpoints[0], pbxBaseUrl, apiKey);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Head>
        <title>Nornia API — Geliştirici &amp; Kurumsal REST API Dokümantasyonu ({catalog.version})</title>
        <meta
          name="description"
          content="Nornia Enterprise AI PBX Kurumsal Dış REST API v1 ve Platform Entegrasyon API'leri: Click-to-Call, CDR, Webhook, CTI Screen Pop, Dialer, Omnichannel, RAG/AI ve SIP Hata Ayıklama."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

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
          <button
            type="button"
            onClick={() => selectView("intro", "quickstart")}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
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
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">API</span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold font-mono">
                  {catalog.total_endpoints} Uç • {catalog.version}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:block">
                Akıllı İletişim Platformu — Geliştirici &amp; Entegrasyon Portalı
              </p>
            </div>
          </button>
        </div>

        {/* Search Trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2.5 w-72 lg:w-80 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 transition cursor-pointer"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Endpoint, scope veya metod ara...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold">
            ⌘K
          </kbd>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://dokuman.nornia.com.tr"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <BookOpen size={14} className="text-indigo-500" />
            <span>Kullanım Kılavuzu</span>
            <ExternalLink size={11} className="opacity-60" />
          </a>
          <a
            href="/openapi.json"
            download="nornia-openapi-3.1.json"
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            title="OpenAPI 3.1 JSON Spesifikasyonunu İndir"
          >
            <Download size={13} />
            <span>OpenAPI</span>
          </a>
          <a
            href="/nornia-api.postman_collection.json"
            download="nornia-api.postman_collection.json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition"
            title="Postman Koleksiyonu İndir"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Postman</span>
          </a>
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
      <div className="flex-1 flex max-w-[1680px] w-full mx-auto">
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            mobileNavOpen ? "fixed inset-y-16 left-0 z-30 block w-72 shadow-2xl" : "hidden lg:block w-72 shrink-0"
          } bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16 p-4 space-y-5`}
        >
          {/* Quick Links */}
          <div className="space-y-1">
            <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Başlangıç &amp; Güvenlik
            </div>
            {[
              { id: "quickstart", label: "Hızlı Başlangıç & Mimari", icon: Sparkles },
              { id: "auth", label: "Kimlik Doğrulama & Scope'lar", icon: KeyRound },
              { id: "webhooks", label: "Webhook Olayları & HMAC", icon: Webhook },
              { id: "cti", label: "CTI Screen Pop & CRM", icon: Cpu },
              { id: "errors", label: "Hata Kodları & Rate Limit", icon: AlertTriangle }
            ].map((nav) => {
              const Icon = nav.icon;
              const active = activeView.type === "intro" && activeView.id === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => selectView("intro", nav.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    active
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <Icon size={14} className={active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                  <span className="truncate">{nav.label}</span>
                </button>
              );
            })}
          </div>

          {/* Endpoint Categories */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="px-2.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <span>REST API Uç Noktaları</span>
              <span className="font-mono text-indigo-500">{catalog.total_endpoints}</span>
            </div>

            {/* Auth Filter Pills */}
            <div className="grid grid-cols-3 gap-1 px-1">
              {[
                { id: "all", label: `Tümü (${catalog.total_endpoints})` },
                { id: "api_key", label: `v1 (${catalog.v1_endpoints_count || 46})` },
                { id: "platform", label: `Platform (${catalog.platform_endpoints_count || 71})` }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setApiFilter(f.id)}
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    apiFilter === f.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(catalog.categories || [])
              .filter((cat) => {
                if (apiFilter === "all") return true;
                if (apiFilter === "api_key") return cat.auth_type === "api_key";
                return cat.auth_type !== "api_key";
              })
              .map((cat) => {
              const open = expandedCats[cat.id] !== false;
              const shortTitle = cat.title.replace(/^\d+\.\s*/, "");
              return (
                <div key={cat.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setExpandedCats((prev) => ({ ...prev, [cat.id]: !open }))}
                    className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-left"
                  >
                    <span className="truncate">{shortTitle}</span>
                    {open ? <ChevronDown size={13} className="shrink-0 opacity-60" /> : <ChevronRight size={13} className="shrink-0 opacity-60" />}
                  </button>
                  {open && (
                    <div className="pl-1.5 space-y-0.5">
                      {(cat.endpoints || []).map((ep) => {
                        const active = activeView.type === "endpoint" && activeView.id === ep.id;
                        return (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => selectView("endpoint", ep.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer text-left ${
                              active
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black shrink-0 border ${
                                active ? "bg-white/20 text-white border-white/30" : METHOD_STYLES[ep.method] || METHOD_STYLES.GET
                              }`}
                            >
                              {ep.method}
                            </span>
                            <span className="truncate">{ep.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN CENTER CONTENT */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-8 max-w-4xl">
          {/* INTRO: QUICKSTART */}
          {activeView.type === "intro" && activeView.id === "quickstart" && (
            <div className="space-y-8">
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 text-white shadow-xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-bold">
                  <Sparkles size={13} />
                  <span>Nornia Enterprise AI PBX — Kurumsal Dış REST API v1</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Santralinizi CRM, ERP ve Özel Yazılımlarınıza Dakikalar İçinde Bağlayın
                </h1>
                <p className="text-sm text-indigo-100 leading-relaxed max-w-2xl">
                  Tıkla-Ara (Click-to-Call), canlı çağrı kontrolü (transfer, bekletme, KVKK ses kaydı duraklatma),
                  CDR &amp; ses kaydı indirme, ACD kuyruk/abone yönetimi, WhatsApp &amp; Yapay Zeka aramaları ve
                  HMAC-SHA256 imzalı gerçek zamanlı Webhook olayları tek standart REST API altında.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => selectView("endpoint", allEndpoints[0]?.id)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-xs font-extrabold shadow-md hover:bg-indigo-50 cursor-pointer"
                  >
                    <Play size={14} />
                    <span>İlk API İsteğini Dene (Click-to-Call)</span>
                  </button>
                  <a
                    href="/nornia-api.postman_collection.json"
                    download="nornia-api.postman_collection.json"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20"
                  >
                    <Download size={14} />
                    <span>Postman Koleksiyonunu İndir</span>
                  </a>
                  <a
                    href="/openapi.json"
                    download="nornia-openapi-3.1.json"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20"
                  >
                    <Code2 size={14} />
                    <span>OpenAPI 3.1 JSON</span>
                  </a>
                </div>
              </div>

              {/* Base URL & Live Environment Setup */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Terminal size={17} className="text-indigo-500" />
                  <span>1. Santral Temel Adresinizi (Base URL) &amp; Test Anahtarınızı Girin</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aşağıya kendi Nornia santral adresinizi yazdığınızda sağdaki tüm kod örnekleri ve "Canlı Test Et" konsolu otomatik olarak sizin adresinizle güncellenir. Bilgiler yalnızca tarayıcınızda (sessionStorage) tutulur.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      Santral Base URL (FQDN veya Yerel IP)
                    </label>
                    <input
                      type="text"
                      value={pbxBaseUrl}
                      onChange={(e) => {
                        setPbxBaseUrl(e.target.value);
                        if (typeof window !== "undefined") sessionStorage.setItem("nornia_api_base_url", e.target.value);
                      }}
                      placeholder="https://musteri.nornia.com.tr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      API Anahtarı (X-API-Key) — Opsiyonel
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        if (typeof window !== "undefined") sessionStorage.setItem("nornia_api_key", e.target.value);
                      }}
                      placeholder="aida_live_default_..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Category Grid */}
              <div className="space-y-3">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Layers size={17} className="text-indigo-500" />
                  <span>API Modül Kategorileri ({catalog.total_endpoints} Uç Nokta)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(catalog.categories || []).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectView("endpoint", cat.endpoints[0]?.id)}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 text-left transition shadow-xs cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {cat.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-mono font-bold shrink-0">
                          {cat.endpoints.length} uç nokta
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                        {cat.endpoints.map((e) => `${e.method} ${e.base_path}`).slice(0, 2).join(" • ")}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* INTRO: AUTH & SCOPES */}
          {activeView.type === "intro" && activeView.id === "auth" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black">Kimlik Doğrulama &amp; Yetki Kapsamları (Scopes)</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tüm Kurumsal Dış API (`/api/v1/...`) istekleri kriptografik API Anahtarı (`aida_live_...`) ile doğrulanır. Anahtarlar santralde <strong>Sistem Ayarları → Kanallar &amp; Entegrasyon → Kurumsal Dış API &amp; Anahtar Yönetimi</strong> ekranından oluşturulur.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-sm font-extrabold flex items-center gap-2">
                  <Lock size={15} className="text-indigo-500" />
                  <span>HTTP Başlığı (Header) Kullanımı</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Aşağıdaki iki başlık biçiminden herhangi birini kullanabilirsiniz:
                </p>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto">
{`# Seçenek 1 (Önerilen)
X-API-Key: aida_live_default_9f8e7d6c5b4a3210...

# Seçenek 2 (OAuth2 / Bearer uyumlu)
Authorization: Bearer aida_live_default_9f8e7d6c5b4a3210...`}
                </pre>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-slate-800 dark:text-white">SHA-256 Saklama</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Anahtar yalnızca üretildiği anda bir kez gösterilir; veritabanında SHA-256 özeti tutulur.</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-slate-800 dark:text-white">IP Beyaz Liste (CIDR)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Anahtar bazında yalnızca belirli CRM/ERP sunucu IP&apos;lerinden erişime izin verebilirsiniz.</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-slate-800 dark:text-white">Dakikalık Rate Limit</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Her anahtar için dakikalık istek kotası ve otomatik Brute-Force kalkanı uygulanır.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-extrabold">Granüler Yetki Kapsamları (Scopes)</h3>
                <div className="space-y-3">
                  {(catalog.permission_modules || []).map((mod) => (
                    <div key={mod.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">{mod.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{mod.description}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(mod.actions || []).map((act) => (
                          <div key={act.code} className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                            <code className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{act.code}</code>
                            <span className="text-slate-500 ml-1.5">— {act.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* INTRO: WEBHOOKS */}
          {activeView.type === "intro" && activeView.id === "webhooks" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black">Gerçek Zamanlı Webhook Olayları &amp; HMAC-SHA256</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Santralde çağrı çaldığında, cevaplandığında, aktarıldığında veya sonlandığında Nornia sunucusu tanımlı CRM/ERP adresinize anlık HTTP POST isteği gönderir. Her istek <code className="font-mono font-bold">X-AIDA-Signature: sha256=...</code> başlığıyla imzalanır.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>HMAC-SHA256 İmza Doğrulama Örnekleri</span>
                  </h3>
                  <div className="flex gap-1">
                    {["python", "node", "php", "csharp"].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setWebhookLang(l)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          webhookLang === l
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {l === "node" ? "Node.js" : l === "csharp" ? "C#" : l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {WEBHOOK_VERIFY_SNIPPETS[webhookLang]}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyText(WEBHOOK_VERIFY_SNIPPETS[webhookLang], "wh-code")}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === "wh-code" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedId === "wh-code" ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-extrabold">Desteklenen Olay Şemaları</h3>
                {(catalog.webhooks || []).map((wh) => (
                  <div key={wh.event} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono text-xs font-extrabold">
                        {wh.event}
                      </code>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">{wh.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{wh.description}</p>
                    <pre className="p-3.5 rounded-xl bg-slate-950 text-cyan-200 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(wh.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTRO: CTI & CRM */}
          {activeView.type === "intro" && activeView.id === "cti" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black">CTI Screen Pop &amp; Hazır CRM Entegrasyonu</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Nornia, temsilciye gelen çağrılarda harici CRM müşteri kartını otomatik açabilir (Screen Pop) ve çağrı öncesi/sonrası Evrensel API Sihirbazı ile ERP/CRM sisteminizden dinamik veri çekip gönderebilir.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">1. CTI Screen Pop URL Şablonu</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Çağrı geldiğinde temsilcinin ekranında otomatik açılacak URL şablonunda dinamik yer tutucular kullanabilirsiniz:
                  </p>
                  <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`https://crm.sirketiniz.com/musteri?tel={caller_number}&dahili={extension}&call_id={call_id}`}
                  </pre>
                </div>
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">2. Evrensel API Sihirbazı &amp; AI Araçları</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    AI Sesli Asistan konuşma sırasında sipariş sorgulama, kargo durumu veya randevu kaydı için dış REST API&apos;lerinizi canlı çağırabilir:
                  </p>
                  <pre className="p-3 rounded-xl bg-slate-950 text-amber-200 font-mono text-[11px] overflow-x-auto">
{`GET https://erp.sirketiniz.com/api/siparis?phone={caller}
→ JSON cevabı AI Asistan sesli yanıtına anında aktarılır.`}
                  </pre>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="text-sm font-extrabold">Hazır Desteklenen CRM Platformları</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kod yazmadan doğrudan santral arayüzünden (<strong>Sistem Ayarları → Kanallar &amp; Entegrasyon → Hazır CRM Marketi</strong>) bağlanabileceğiniz sistemler:
                  <strong> Zoho CRM, HubSpot, Salesforce, Bitrix24, Pipedrive, Logo / Mikro / Özel Webhook CRM</strong>.
                </p>
              </div>
            </div>
          )}

          {/* INTRO: ERROR CODES */}
          {activeView.type === "intro" && activeView.id === "errors" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black">HTTP Hata Kodları &amp; Hız Sınırları (Rate Limit)</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tüm hata yanıtları standart JSON <code className="font-mono font-bold">{`{"detail": "Açıklayıcı Türkçe hata mesajı"}`}</code> biçiminde döner.
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Kod</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(catalog.error_codes || []).map((err) => (
                      <tr key={err.code}>
                        <td className="px-4 py-3 font-mono font-black text-indigo-600 dark:text-indigo-400">{err.code}</td>
                        <td className="px-4 py-3 font-bold">{err.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{err.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ENDPOINT DETAIL VIEW */}
          {activeView.type === "endpoint" && selectedEndpoint && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedEndpoint.categoryTitle}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                      selectedEndpoint.auth_type === "api_key"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : selectedEndpoint.auth_type === "webhook"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {selectedEndpoint.auth_type === "api_key"
                      ? "Kurumsal Dış API v1 • X-API-Key"
                      : selectedEndpoint.auth_type === "webhook"
                      ? "Gelen Kanal Webhook"
                      : "Platform & Yönetim API • Oturum / X-User-ID"}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {selectedEndpoint.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedEndpoint.description}
                </p>
              </div>

              {/* Endpoint Path Bar */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border ${METHOD_STYLES[selectedEndpoint.method] || METHOD_STYLES.GET}`}>
                    {selectedEndpoint.method}
                  </span>
                  <code className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 break-all">
                    {selectedEndpoint.path}
                  </code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Lock size={11} className="text-indigo-500" />
                    {selectedEndpoint.scope}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(`${pbxBaseUrl.replace(/\/+$/, "")}${selectedEndpoint.path}`, "ep-url")}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="URL Kopyala"
                  >
                    {copiedId === "ep-url" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Parameters */}
              {(selectedEndpoint.path_params?.length > 0 || selectedEndpoint.query_params?.length > 0) && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Yol &amp; Sorgu Parametreleri
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[...(selectedEndpoint.path_params || []), ...(selectedEndpoint.query_params || [])].map((p) => (
                      <div key={p.name} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.name}</code>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">{p.in}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.type}</span>
                          {p.required && <span className="text-[10px] font-extrabold text-rose-500">Zorunlu</span>}
                        </div>
                        <span className="text-slate-600 dark:text-slate-300">{p.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Request Body */}
              {selectedEndpoint.sample_body !== null && selectedEndpoint.sample_body !== undefined && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Örnek İstek Gövdesi (JSON Body)
                    </h3>
                    <button
                      type="button"
                      onClick={() => copyText(JSON.stringify(selectedEndpoint.sample_body, null, 2), "req-body")}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === "req-body" ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedId === "req-body" ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 text-indigo-200 font-mono text-xs overflow-x-auto">
                    {JSON.stringify(selectedEndpoint.sample_body, null, 2)}
                  </pre>
                </div>
              )}

              {/* Interactive Live Playground */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-200/80 dark:border-indigo-900/60 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-black flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <Play size={15} />
                    <span>Canlı Test Et (API Playground)</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">İstek doğrudan tarayıcınızdan kendi santralinize gönderilir</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Santral URL</label>
                    <input
                      type="text"
                      value={pbxBaseUrl}
                      onChange={(e) => {
                        setPbxBaseUrl(e.target.value);
                        if (typeof window !== "undefined") sessionStorage.setItem("nornia_api_base_url", e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">X-API-Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        if (typeof window !== "undefined") sessionStorage.setItem("nornia_api_key", e.target.value);
                      }}
                      placeholder="aida_live_..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Uç Nokta Yolu</label>
                  <input
                    type="text"
                    value={tryPath}
                    onChange={(e) => setTryPath(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-bold"
                  />
                </div>

                {["POST", "PUT", "PATCH"].includes(selectedEndpoint.method) && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">JSON İstek Gövdesi</label>
                    <textarea
                      rows={5}
                      value={tryBody}
                      onChange={(e) => setTryBody(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-emerald-200 font-mono text-xs"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={tryLoading}
                    onClick={handleRunPlayground}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Play size={13} />
                    <span>{tryLoading ? "İstek Gönderiliyor..." : `${selectedEndpoint.method} İsteğini Çalıştır`}</span>
                  </button>
                </div>

                {tryResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {tryResult.ok ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : (
                        <AlertTriangle size={15} className="text-rose-500" />
                      )}
                      <span>HTTP {tryResult.status || "Ağ Hatası"}</span>
                      {tryResult.ms !== undefined && <span className="text-slate-400 font-mono">({tryResult.ms} ms)</span>}
                    </div>
                    <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] max-h-72 overflow-auto">
                      {tryResult.text}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT STICKY CODE EXAMPLES PANEL */}
        <aside className="hidden xl:flex flex-col w-[440px] shrink-0 border-l border-slate-200/80 dark:border-slate-800 bg-slate-900 text-slate-100 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-5 space-y-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Kod Örneği ({selectedEndpoint ? selectedEndpoint.method : "POST"})
              </span>
              <button
                type="button"
                onClick={() => copyText(currentCode, "right-code")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === "right-code" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedId === "right-code" ? "Kopyalandı" : "Kopyala"}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {LANG_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCodeLang(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    codeLang === t.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800/80 text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-200 overflow-x-auto leading-relaxed">
              {currentCode}
            </pre>
          </div>

          {/* Sample Response */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Örnek Yanıt (200 OK)
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                application/json
              </span>
            </div>
            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-200 overflow-x-auto leading-relaxed">
              {JSON.stringify(
                (selectedEndpoint || allEndpoints[0])?.sample_response || { status: "ok" },
                null,
                2
              )}
            </pre>
          </div>
        </aside>
      </div>

      {/* CMD+K SEARCH MODAL */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
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
                placeholder="Endpoint yolu, başlık veya scope ara (örn. originate, cdr, whatsapp)..."
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                ESC
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Eşleşen uç nokta bulunamadı.</div>
              ) : (
                searchResults.map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      selectView("endpoint", ep.id);
                      setSearchOpen(false);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black border ${METHOD_STYLES[ep.method] || METHOD_STYLES.GET}`}>
                          {ep.method}
                        </span>
                        <span className="text-xs font-bold truncate">{ep.title}</span>
                      </div>
                      <code className="text-[11px] font-mono text-slate-400 block truncate mt-0.5">{ep.path}</code>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-500 shrink-0">{ep.scope}</span>
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
