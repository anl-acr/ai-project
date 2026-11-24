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
const EMAIL = "anl.acr@gmail.com";
const PASS = "test";
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
    await sleep(2400);
    await cdp.eval(`(() => {
      const s = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
      s(document.querySelector('input[type="text"], input[type="email"]'), ${JSON.stringify(EMAIL)});
      s(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
      document.querySelector('button[type="submit"]')?.click();
    })()`);
    await sleep(4000);

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

    let okCount = 0;
    for (const rep of REPORTS) {
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
      await sleep(1650);
      await cdp.eval(`document.querySelector('main')?.scrollTo(0, 0)`);
      await sleep(250);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      const outPath = path.join(OUT_DIR, `${rep.slug}.jpg`);
      fs.writeFileSync(outPath, Buffer.from(data, "base64"));
      okCount++;
      console.log(`  [${String(okCount).padStart(2, "0")}/44] ${rep.slug}.jpg (${Math.round(Buffer.from(data, "base64").length / 1024)} KB) <- ${clicked}`);
    }
    console.log(`\nDONE! Captured ${okCount}/44 reports.`);
  } finally {
    if (cdp) cdp.close();
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
