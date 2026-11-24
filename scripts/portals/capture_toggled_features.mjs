#!/usr/bin/env node
/**
 * Captures ALL currently-disabled / toggled-OFF features in their EXPANDED state
 * (strictly read-only: toggles switches in React client state ONLY, NEVER clicks Save,
 * always closes with Vazgeç or navigates away!) + all multi-tab Settings/Security/Channel screens.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "https://app.nornia.com.tr";
const OUT_DIR = "/Users/anilacar/ai-project/portals/docs-portal/public/screenshots/tabs/toggled";
const CDP_PORT = 9342;
const EMAIL = "anl.acr@gmail.com";
const PASS = "test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT_DIR, { recursive: true });

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

async function nav(cdp, urlPath) {
  await cdp.send("Page.navigate", { url: `${BASE_URL}${urlPath}` });
  await sleep(2200);
}

async function shot(cdp, filename) {
  await cdp.eval(`document.querySelectorAll('input[type="password"]').forEach(i => { try { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); } catch {} });`);
  await sleep(350);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 83 });
  const out = path.join(OUT_DIR, filename);
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`  [SHOT] toggled/${filename} (${Math.round(Buffer.from(data, "base64").length / 1024)} KB)`);
}

async function clickBtn(cdp, textOrTitle, scope = "body", exact = false) {
  return await cdp.eval(`(() => {
    const q = ${JSON.stringify(textOrTitle)}.toLocaleLowerCase('tr-TR');
    const exactMode = ${Boolean(exact)};
    const root = document.querySelector(${JSON.stringify(scope)}) || document.body;
    const els = Array.from(root.querySelectorAll('button, [role="tab"]'));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
      const ti = (el.getAttribute('title') || '').toLocaleLowerCase('tr-TR');
      if (exactMode ? (t === q || ti === q) : (t.includes(q) || ti.includes(q))) {
        el.scrollIntoView({ block: 'center' });
        el.click();
        return 'OK:' + (el.innerText || el.title || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
      }
    }
    return 'MISS:' + q;
  })()`);
}

// Helper: turn ON all unchecked switches/toggles inside a container (in client draft only!)
async function enableOffToggles(cdp, scopeSelector = "div.fixed", maxCount = 6) {
  return await cdp.eval(`(() => {
    const containers = Array.from(document.querySelectorAll(${JSON.stringify(scopeSelector)})).filter(el => el.offsetWidth > 350);
    const root = containers.length ? containers[containers.length - 1] : document.querySelector('main') || document.body;
    let clicked = 0;
    // Checkboxes styled as switches (peer sr-only) or role=switch
    const checkboxes = Array.from(root.querySelectorAll('input[type="checkbox"]')).filter(cb => {
      const lbl = cb.closest('label');
      const r = (lbl || cb).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !cb.checked && !cb.disabled;
    });
    for (const cb of checkboxes) {
      if (clicked >= ${maxCount}) break;
      (cb.closest('label') || cb).click();
      clicked++;
    }
    const switches = Array.from(root.querySelectorAll('button[role="switch"][aria-checked="false"]')).filter(b => b.offsetParent !== null);
    for (const sw of switches) {
      if (clicked >= ${maxCount}) break;
      sw.click();
      clicked++;
    }
    // Also custom toggle buttons (w-11 h-6 / ToggleLeft icon)
    const toggleBtns = Array.from(root.querySelectorAll('button')).filter(b => {
      if (!b.offsetParent) return false;
      const cls = b.className || '';
      const hasToggleOff = (cls.includes('bg-slate-200') || cls.includes('bg-slate-300') || cls.includes('bg-slate-700')) && cls.includes('rounded-full') && (cls.includes('w-10') || cls.includes('w-11') || cls.includes('w-9'));
      const hasToggleIcon = Boolean(b.querySelector('svg.lucide-toggle-left'));
      return hasToggleOff || hasToggleIcon;
    });
    for (const tb of toggleBtns) {
      if (clicked >= ${maxCount}) break;
      tb.click();
      clicked++;
    }
    return clicked;
  })()`);
}

async function main() {
  const userDataDir = `/tmp/nornia_cdp_tog_${Date.now()}`;
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

    // 1. KULLANICI DÜZENLE — Toggled-ON Expanded Draft States (NEVER SAVED!)
    console.log("\n=== [1] Kullanıcı Düzenle — Kapalı Özellikleri Önizleme ===");
    await nav(cdp, "/?tab=kullanicilar");
    await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLocaleLowerCase('tr-TR')==='düzenle' || x.querySelector('svg.lucide-edit-2, svg.lucide-pencil'));
      if (b) b.click();
    })()`);
    await sleep(1100);

    // 1a. Özellikler (Voicemail + Hot-Desking + Boss-Secretary ON)
    await clickBtn(cdp, "Özellikler", "div.fixed", true);
    await sleep(600);
    console.log("  Özellikler toggled ON:", await enableOffToggles(cdp, "div.fixed", 6));
    await sleep(600);
    await shot(cdp, "user-ozellikler-expanded.jpg");

    // 1b. Profiller & Yönlendirme (Her Zaman / Meşgul / Cevapsız + Follow Me ON)
    await clickBtn(cdp, "Profiller & Yönlendirme", "div.fixed");
    await sleep(600);
    console.log("  Profiller toggled ON:", await enableOffToggles(cdp, "div.fixed", 5));
    await sleep(600);
    // Scroll down slightly inside modal body to show forwarding & Follow Me
    await cdp.eval(`(() => {
      const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 500);
      const scrollPane = modals[modals.length - 1]?.querySelector('.overflow-y-auto');
      if (scrollPane) scrollPane.scrollTop = 360;
    })()`);
    await sleep(400);
    await shot(cdp, "user-profiller-expanded.jpg");

    // 1c. Güvenlik (2FA ON)
    await clickBtn(cdp, "Güvenlik", "div.fixed", true);
    await sleep(600);
    console.log("  Güvenlik 2FA toggled ON:", await enableOffToggles(cdp, "div.fixed", 3));
    await sleep(600);
    await shot(cdp, "user-guvenlik-2fa-expanded.jpg");

    // 1d. CTI (Screen Pop + CRM API ON)
    await clickBtn(cdp, "CTI", "div.fixed", true);
    await sleep(600);
    console.log("  CTI toggled ON:", await enableOffToggles(cdp, "div.fixed", 4));
    await sleep(600);
    await shot(cdp, "user-cti-expanded.jpg");

    // Close with Vazgeç (NEVER SAVE!)
    await clickBtn(cdp, "Vazgeç", "div.fixed", true);
    await sleep(500);

    // 2. ACD KUYRUK DÜZENLE — Toggled-ON Expanded Draft States (NEVER SAVED!)
    console.log("\n=== [2] ACD Kuyruk Düzenle — Kapalı Özellikleri Önizleme ===");
    await nav(cdp, "/?tab=kuyruklar");
    await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLocaleLowerCase('tr-TR').includes('düzenle') || x.querySelector('svg.lucide-edit-2, svg.lucide-pencil'));
      if (b) b.click();
    })()`);
    await sleep(1100);

    for (const qt of [
      { label: "Otomatik Mola", file: "queue-rona-expanded.jpg" },
      { label: "Otomatik Logout", file: "queue-logout-expanded.jpg" },
      { label: "Periyodik Anons", file: "queue-periodic-ivr-expanded.jpg" },
      { label: "Otomatik Geri Arama", file: "queue-callback-expanded.jpg" },
      { label: "Memnuniyet Anketi", file: "queue-survey-expanded.jpg" },
    ]) {
      const r = await clickBtn(cdp, qt.label, "div.fixed");
      await sleep(550);
      const cnt = await enableOffToggles(cdp, "div.fixed", 4);
      console.log(`  Queue [${qt.label}]: ${r} | toggled=${cnt}`);
      await sleep(550);
      if (r.startsWith("OK")) await shot(cdp, qt.file);
    }
    await clickBtn(cdp, "Vazgeç", "div.fixed", true);
    await sleep(400);

    // 3. DIŞ HAT (SIP TRUNK) DÜZENLE — /30 VLAN Policy Routing & Transit Trunk ON (NEVER SAVED!)
    console.log("\n=== [3] Dış Hat Düzenle — /30 VLAN Policy Routing & Transit Trunk ===");
    await nav(cdp, "/?tab=dis-hatlar");
    await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLocaleLowerCase('tr-TR').includes('düzenle') || x.querySelector('svg.lucide-edit-2, svg.lucide-pencil'));
      if (b) b.click();
    })()`);
    await sleep(1100);
    console.log("  Trunk toggled ON:", await enableOffToggles(cdp, "div.fixed", 5));
    await sleep(600);
    await cdp.eval(`(() => {
      const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 500);
      const sc = modals[modals.length - 1]?.querySelector('.overflow-y-auto');
      if (sc) sc.scrollTop = 420;
    })()`);
    await sleep(450);
    await shot(cdp, "trunk-vlan-transit-expanded.jpg");
    await clickBtn(cdp, "Vazgeç", "div.fixed", true);

    // 4. SUNUCU AĞ YÖNETİMİ — 3 Diğer Sekme (Statik Rotalar, DNS & Hosts, Yedekler)
    console.log("\n=== [4] Sunucu Ağ Yönetimi — Alt Sekmeler ===");
    await nav(cdp, "/?tab=ayarlar&subtab=sunucu-ag");
    for (const nt of [
      { label: "Statik Rotalar", file: "net-static-routes.jpg" },
      { label: "DNS", file: "net-dns-hosts.jpg" },
      { label: "Yedek", file: "net-backups.jpg" },
    ]) {
      const r = await clickBtn(cdp, nt.label, "main");
      console.log(`  Network [${nt.label}]:`, r);
      await sleep(750);
      if (r.startsWith("OK")) await shot(cdp, nt.file);
    }

    // 5. KANAL ENTEGRASYONLARI — WhatsApp Expanded + Telegram + Meta + E-Posta
    console.log("\n=== [5] Kanal Entegrasyonları — Tüm 4 Kanal & WhatsApp Expanded ===");
    await nav(cdp, "/?tab=ayarlar&subtab=kanal-ayarlari");
    console.log("  WhatsApp toggles ON:", await enableOffToggles(cdp, "main", 4));
    await sleep(600);
    await shot(cdp, "channels-whatsapp-expanded.jpg");
    for (const ct of [
      { label: "Telegram", file: "channels-telegram.jpg" },
      { label: "Instagram", file: "channels-meta.jpg" },
      { label: "E-Posta", file: "channels-email.jpg" },
    ]) {
      const r = await clickBtn(cdp, ct.label, "main");
      console.log(`  Channel [${ct.label}]:`, r);
      await sleep(750);
      if (r.startsWith("OK")) await shot(cdp, ct.file);
    }

    // 6. KAYIT & SAKLAMA SİSTEMİ — Harici Depolama SMB/SFTP & Dinamik Kayıt ON (NEVER SAVED!)
    console.log("\n=== [6] Kayıt & Saklama Sistemi — Harici Depolama & Dinamik Kayıt ===");
    await nav(cdp, "/?tab=ayarlar&subtab=kayit-saklama");
    console.log("  Storage toggles ON:", await enableOffToggles(cdp, "main", 5));
    await sleep(600);
    await cdp.eval(`document.querySelector('main')?.scrollTo(0, 340)`);
    await sleep(400);
    await shot(cdp, "storage-external-smb-expanded.jpg");

    // 7. AI GÖREV & MODEL YÖNLENDİRME — Yerel Ollama ON + 12 Görev Matrisi
    console.log("\n=== [7] AI Görev Yönlendirme — Yerel Ollama & 12 Görev ===");
    await nav(cdp, "/?tab=ayarlar&subtab=ai-gorev-yonlendirme");
    console.log("  Ollama toggles ON:", await enableOffToggles(cdp, "main", 3));
    await sleep(600);
    await cdp.eval(`document.querySelector('main')?.scrollTo(0, 340)`);
    await sleep(400);
    await shot(cdp, "ai-routing-ollama-expanded.jpg");

    // 8. GÜVENLİK KALKANI — Güvenli IP, Bölgesel Erişim (GeoIP), Anti-DDoS
    console.log("\n=== [8] Güvenlik Kalkanı — 3 Diğer Sekme ===");
    await nav(cdp, "/?tab=security");
    for (const st of [
      { label: "Güvenli IP", file: "security-tab-whitelist.jpg" },
      { label: "Bölgesel Erişim", file: "security-tab-geoip.jpg" },
      { label: "Anti-DDoS", file: "security-tab-antiddos.jpg" },
    ]) {
      const r = await clickBtn(cdp, st.label, "main");
      console.log(`  Security [${st.label}]:`, r);
      await sleep(800);
      if (r.startsWith("OK")) await shot(cdp, st.file);
    }

    // 9. OTOPROVİZYON ŞABLONLARI — Şablon Önizleme / Düzenleme Modalı
    console.log("\n=== [9] Otoprovizyon Şablonları — Şablon Önizle/Düzenle ===");
    await nav(cdp, "/?tab=ayarlar&subtab=otoprovizyon-sablonlari");
    const tplRes = await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && (x.querySelector('svg.lucide-eye, svg.lucide-edit-2, svg.lucide-copy') || (x.title||'').includes('Görüntüle') || (x.title||'').includes('Düzenle')));
      if (b) { b.click(); return 'OK:' + (b.title || 'btn'); }
      return 'MISS';
    })()`);
    console.log("  Template view/edit:", tplRes);
    await sleep(900);
    if (tplRes.startsWith("OK")) await shot(cdp, "autoprov-template-edit.jpg");

    // 10. EVRENSEL API SİHİRBAZI — Yeni Araç Ekle Modalı
    console.log("\n=== [10] Evrensel API Sihirbazı — Yeni AI Aracı Modalı ===");
    await nav(cdp, "/?tab=ayarlar&subtab=evrensel-api-sihirbazi");
    const apiWizRes = await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && x.querySelector('svg.lucide-plus'));
      if (b) { b.click(); return 'OK:' + (b.title || 'plus'); }
      return 'MISS';
    })()`);
    console.log("  Universal API Add:", apiWizRes);
    await sleep(900);
    if (apiWizRes.startsWith("OK")) await shot(cdp, "universal-api-create-modal.jpg");

    // 11. ÇAĞRI KALİTE KONTROL (QA) — Yeni Kriter Ekle Modalı
    console.log("\n=== [11] Çağrı Kalite Kontrol — Yeni Kriter Ekle ===");
    await nav(cdp, "/?tab=ayarlar&subtab=kalite-kontrol");
    const qaRes = await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && x.querySelector('svg.lucide-plus'));
      if (b) { b.click(); return 'OK:' + (b.title || 'plus'); }
      return 'MISS';
    })()`);
    console.log("  QA Add:", qaRes);
    await sleep(800);
    if (qaRes.startsWith("OK")) await shot(cdp, "qa-add-criterion-modal.jpg");

    console.log("\nDONE Toggled Features & Multi-Tab Capture (ZERO changes saved)!");
  } finally {
    if (cdp) cdp.close();
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
