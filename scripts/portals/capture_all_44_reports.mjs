#!/usr/bin/env node
/**
 * Captures ALL 44 individual reports under "ÇAĞRI RAPORLARI & ANALİZ"
 * on https://app.nornia.com.tr -> portals/docs-portal/public/screenshots/reports/<slug>.jpg
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "https://app.nornia.com.tr";
const OUT_DIR = "/Users/anilacar/ai-project/portals/docs-portal/public/screenshots/reports";
const CDP_PORT = 9340;
const EMAIL = process.env.PBX_USER || "anl.acr@gmail.com";
const PASS = process.env.PBX_PASS || "";
if (!PASS) {
  console.error("[HATA] PBX_PASS ortam değişkeni gerekli (örn: PBX_USER='...' PBX_PASS='...' node scripts/portals/capture_all_44_reports.mjs)");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORTS = [
  { slug: "ozel-rapor-tasarimcisi", sidebar: "Özel Rapor Tasarımcısı" },
  { slug: "rapor-pano", sidebar: "Pano", exact: true },
  { slug: "rapor-cdr", sidebar: "CDR", exact: true },
  { slug: "rapor-ses-kayitlari", sidebar: "Ses Kayıtları" },
  { slug: "rapor-cagri-transkripti", sidebar: "Çağrı Transkripti" },
  { slug: "rapor-duygu-analizi", sidebar: "Duygu Analizi" },
  { slug: "rapor-niyet-raporu", sidebar: "Niyet Raporu" },
  { slug: "rapor-kalite-degerlendirmeleri", sidebar: "Kalite Değerlendirmeleri" },
  { slug: "rapor-temsilci-notlari", sidebar: "Temsilci Notları" },
  { slug: "rapor-temsilci-performans", sidebar: "Temsilci Performans" },
  { slug: "rapor-kuyruk-bekleme", sidebar: "Kuyruk / Bekleme" },
  { slug: "rapor-anket-csat", sidebar: "Anket Raporları" },
  { slug: "rapor-duygu-isi-haritasi", sidebar: "Duygu Durumu Isı Haritası" },
  { slug: "rapor-kelime-bulutu", sidebar: "Kelime Bulutu" },
  { slug: "rapor-fcr", sidebar: "İlk Aramada Çözüm" },
  { slug: "rapor-ai-insan-roi", sidebar: "ROI Paneli" },
  { slug: "rapor-kacan-cagri", sidebar: "Kaçan Çağrı Analizi" },
  { slug: "rapor-temsilci-kronolojisi", sidebar: "Temsilci Kronolojisi" },
  { slug: "rapor-yogunluk", sidebar: "Yoğunluk Raporu" },
  { slug: "rapor-hat-kapasite", sidebar: "Hat Kapasite" },
  { slug: "rapor-did", sidebar: "DID Raporu" },
  { slug: "rapor-operator-dakika", sidebar: "Operatör Dakika" },
  { slug: "rapor-hatali-cagri", sidebar: "Hatalı & Eşleşmeyen" },
  { slug: "rapor-ivr-terk", sidebar: "IVR Terk Oranı" },
  { slug: "rapor-aktarma-bekletme", sidebar: "Aktarma & Bekletme" },
  { slug: "rapor-verimlilik-ab", sidebar: "Verimlilik Karşılaştırması" },
  { slug: "rapor-musteri-cile-noktalari", sidebar: "Çile Noktaları" },
  { slug: "rapor-senaryo-sadakati", sidebar: "Senaryo Sadakati" },
  { slug: "rapor-sessizlik-soz-kesme", sidebar: "Sessizlik & Söz Kesme" },
  { slug: "rapor-ceo-ozeti", sidebar: "CEO Özet Raporu" },
  { slug: "rapor-mola-puantaj", sidebar: "Mola & Puantaj" },
  { slug: "rapor-omnichannel-sla", sidebar: "Omnichannel" },
  { slug: "rapor-sonuc-kodlari", sidebar: "Sonuç Kodları" },
  { slug: "rapor-kampanya-geri-arama", sidebar: "Kampanya & Geri Arama" },
  { slug: "rapor-kuyruk-sla", sidebar: "Kuyruk SLA" },
  { slug: "rapor-tekrar-arayanlar", sidebar: "Tekrar" },
  { slug: "rapor-departman-toplama", sidebar: "Departman" },
  { slug: "rapor-voip-kalite-mos", sidebar: "VoIP" },
  { slug: "rapor-yonlendirme-gsm", sidebar: "Yönlendirme" },
  { slug: "rapor-supervizor-denetim", sidebar: "Süpervizör" },
  { slug: "rapor-engellenen-ihlal", sidebar: "Engellenen" },
  { slug: "rapor-ai-randevu-rag", sidebar: "AI Randevu" },
  { slug: "rapor-sesli-posta", sidebar: "Sesli Posta" },
  { slug: "rapor-konferans-kullanim", sidebar: "Konferans" },
];

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const res = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result?.value;
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function waitForChrome() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome CDP timeout");
}

async function main() {
  const userDataDir = `/tmp/nornia_cdp_rep44_${Date.now()}`;
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    cdp = new CDP(await waitForChrome());
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.3, mobile: false });

    await cdp.send("Page.navigate", { url: `${BASE_URL}/login` });
    await sleep(2800);

    // Set "Son 30 Gün" (Last 1 Month) in localStorage BEFORE logging in so ReportsPanel mounts directly on 30 days
    const dateRange = await cdp.eval(`(() => {
      const fmt = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const startStr = fmt(start);
      const endStr = fmt(now);
      localStorage.setItem("reports_filter_start_date", startStr);
      localStorage.setItem("reports_filter_end_date", endStr);
      localStorage.setItem("reports_filter_start_time", "00:00");
      localStorage.setItem("reports_filter_end_time", "23:59");
      localStorage.setItem("theme", "light");
      localStorage.setItem("aida_theme_mode", "light");
      return { startStr, endStr };
    })()`);
    console.log(`Applied 30-day window in localStorage: ${dateRange.startStr} -> ${dateRange.endStr}`);

    await cdp.eval(`(() => {
      const s = (e, v) => {
        if (!e) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      };
      s(document.querySelector('input[type="text"], input[type="email"]'), ${JSON.stringify(EMAIL)});
      s(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
      document.querySelector('button[type="submit"]')?.click();
    })()`);

    // Wait up to 25s for sidebar to appear after login
    let sidebarReady = false;
    for (let w = 0; w < 50; w++) {
      await sleep(500);
      const st = await cdp.eval(`(() => {
        const aside = document.querySelector('aside, nav');
        const hasRep = aside ? Array.from(aside.querySelectorAll('button')).some(b => (b.innerText || '').includes('Özel Rapor Tasarımcısı')) : false;
        return { url: location.href, hasRep };
      })()`);
      if (st?.hasRep) {
        sidebarReady = true;
        console.log(`Logged in & sidebar ready at ${st.url}`);
        break;
      }
      if (w === 10 || w === 49) {
        const bodyTxt = await cdp.eval(`(document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 400)`);
        console.log(`Login wait check (w=${w}) URL=${st?.url} | text=${bodyTxt}`);
      }
    }
    if (!sidebarReady) throw new Error("Sidebar did not load after login");

    // Ensure ALL sidebar report buttons are listed (check what buttons exist under ÇAĞRI RAPORLARI & ANALİZ)
    const sidebarReportBtns = await cdp.eval(`(() => {
      const aside = document.querySelector('aside, nav');
      const btns = Array.from(aside.querySelectorAll('button'));
      // Find index of "Özel Rapor Tasarımcısı"
      const start = btns.findIndex(b => (b.innerText || '').includes('Özel Rapor Tasarımcısı'));
      if (start < 0) return [];
      const out = [];
      for (let i = start; i < btns.length; i++) {
        const t = (btns[i].innerText || '').replace(/\\s+/g, ' ').trim();
        if (t.includes('YÖNETİM') || t.includes('Sistem Panosu')) break;
        out.push({ idx: i, text: t });
      }
      return out;
    })()`);
    console.log(`Found ${sidebarReportBtns.length} report buttons in sidebar!`);

    // Helper: wait until dynamic chunk & API skeleton loaders finish rendering real data
    const waitForContentReady = async (maxWaitMs = 15000) => {
      const started = Date.now();
      await sleep(600);
      while (Date.now() - started < maxWaitMs) {
        const state = await cdp.eval(`(() => {
          const main = document.querySelector("main") || document.body;
          const pulses = main.querySelectorAll(".animate-pulse").length;
          const spins = main.querySelectorAll(".animate-spin").length;
          const txt = (main.innerText || "").trim();
          const hasLoadingTxt = /yükleniyor|hazırlanıyor|hesaplanıyor/i.test(txt.slice(0, 300));
          return { pulses, spins, len: txt.length, hasLoadingTxt };
        })()`);
        if (state && state.pulses === 0 && state.spins === 0 && !state.hasLoadingTxt && state.len > 40) {
          await sleep(450);
          return `READY(${Date.now() - started}ms)`;
        }
        await sleep(350);
      }
      return "TIMEOUT_WAIT";
    };

    // Helper: if EnterpriseReportsPanel or CustomReportBuilder is active and not yet on 30 days, switch it to "Son 30 Gün"
    const ensureLast30Days = async (slug) => {
      if (slug === "ozel-rapor-tasarimcisi") {
        // Wait up to 10s for CustomReportBuilder dynamic chunk to mount its "Son 30 Gün" button
        for (let t = 0; t < 25; t++) {
          const hasBtn = await cdp.eval(`Array.from(document.querySelectorAll("button")).some((b) => (b.innerText || "").includes("Son 30 Gün") || (b.innerText || "").includes("Raporu Çalıştır"))`);
          if (hasBtn) break;
          await sleep(400);
        }
        const res = await cdp.eval(`(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const b30 = btns.find((b) => (b.innerText || "").trim() === "Son 30 Gün");
          if (b30) b30.click();
          const runBtn = btns.find((b) => (b.innerText || "").includes("Raporu Çalıştır"));
          if (runBtn) runBtn.click();
          return b30 ? "CUSTOM_30D" : (runBtn ? "CUSTOM_RUN" : "CUSTOM_NO_BTN");
        })()`);
        await sleep(3000);
        return res;
      }

      // Check if EnterpriseReportsPanel ("Dönem:" indicator + "Filtrele" button) is showing < 25 days
      const periodCheck = await cdp.eval(`(() => {
        const mainText = document.querySelector("main")?.innerText || "";
        const m = mainText.match(/Dönem:\\s*(\\d{4}-\\d{2}-\\d{2})/);
        if (!m) return { isEnterprise: false };
        return { isEnterprise: true, currentStart: m[1] };
      })()`);

      if (periodCheck.isEnterprise) {
        const diffDays = Math.round((new Date(dateRange.endStr) - new Date(periodCheck.currentStart)) / 86400000);
        if (diffDays < 25) {
          const opened = await cdp.eval(`(() => {
            const main = document.querySelector("main") || document.body;
            const fBtn = Array.from(main.querySelectorAll("button")).find((b) => (b.innerText || "").trim() === "Filtrele");
            if (!fBtn) return false;
            fBtn.click();
            return true;
          })()`);
          if (opened) {
            await sleep(450);
            await cdp.eval(`(() => {
              const modal = document.querySelector(".fixed.inset-0");
              if (!modal) return false;
              const trigger = Array.from(modal.querySelectorAll("button")).find((b) => /\\d{2}\\.\\d{2}\\.\\d{4}|\\d{4}-\\d{2}-\\d{2}/.test(b.innerText || ""));
              if (trigger) { trigger.click(); return true; }
              return false;
            })()`);
            await sleep(450);
            const picked = await cdp.eval(`(() => {
              const b30 = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").trim() === "Son 30 Gün");
              if (b30) { b30.click(); return true; }
              return false;
            })()`);
            await sleep(350);
            await cdp.eval(`(() => {
              const applyBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").trim() === "Uygula");
              if (applyBtn) { applyBtn.click(); return true; }
              return false;
            })()`);
            await waitForContentReady(15000);
            return picked ? "ENT_30D_APPLIED" : "ENT_MODAL_NO_30D";
          }
        }
      }
      return periodCheck.isEnterprise ? `ENT_OK(${periodCheck.currentStart})` : "REPORTS_PANEL_30D";
    };

    const onlyArg = process.argv.find((a) => a.startsWith("--only="));
    const onlySet = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)) : null;
    const targetReports = onlySet ? REPORTS.filter((r) => onlySet.has(r.slug)) : REPORTS;

    let okCount = 0;
    for (const rep of targetReports) {
      const clicked = await cdp.eval(`(() => {
        const aside = document.querySelector('aside, nav');
        const btns = Array.from(aside.querySelectorAll('button'));
        const start = btns.findIndex(b => (b.innerText || '').includes('Özel Rapor Tasarımcısı'));
        const end = btns.findIndex((b, idx) => idx > start && ((b.innerText || '').includes('YÖNETİM') || (b.innerText || '').includes('Sistem Panosu')));
        const slice = btns.slice(Math.max(0, start), end > start ? end : btns.length);
        const q = ${JSON.stringify(rep.sidebar)}.toLocaleLowerCase('tr-TR');
        const exact = ${Boolean(rep.exact)};
        const target = slice.find(b => {
          const t = (b.innerText || '').replace(/\\s+/g, ' ').replace(/YENİ/gi, '').trim().toLocaleLowerCase('tr-TR');
          return exact ? t === q : t.includes(q);
        });
        if (!target) return 'MISS';
        target.scrollIntoView({ block: 'center' });
        target.click();
        return 'OK:' + (target.innerText || '').replace(/\\s+/g, ' ').trim();
      })()`);

      if (!clicked.startsWith("OK")) {
        console.log(`  [MISS] ${rep.slug} (${rep.sidebar})`);
        continue;
      }
      const readyState = await waitForContentReady(15000);
      const rangeInfo = await ensureLast30Days(rep.slug);
      await cdp.eval(`document.querySelector('main')?.scrollTo(0, 0)`);
      await sleep(300);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 86 });
      const outPath = path.join(OUT_DIR, `${rep.slug}.jpg`);
      fs.writeFileSync(outPath, Buffer.from(data, "base64"));
      okCount++;
      console.log(`  [${String(okCount).padStart(2, "0")}/44] ${rep.slug}.jpg (${Math.round(Buffer.from(data, "base64").length / 1024)} KB) [${readyState} | ${rangeInfo}] <- ${clicked}`);
    }
    console.log(`\nDONE! Captured ${okCount}/44 reports.`);
  } finally {
    if (cdp) cdp.close();
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
