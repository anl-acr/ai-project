#!/usr/bin/env node
/**
 * Nornia Docs — İlk Kurulum Sihirbazı (/setup) 6 Adım Canlı Görüntü Yakalayıcı
 * ============================================================================
 * Gerçek frontend (/setup) sayfasını yerel mock prefill API'si ile ayağa kaldırır,
 * Chrome CDP üzerinden 6 adımın tamamını gerçekçi verilerle ilerleyerek yüksek
 * çözünürlüklü ekran görüntüleri olarak `portals/docs-portal/public/screenshots/`
 * altına kaydeder.
 */

import fs from "fs";
import http from "http";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");
const OUT_DIR = path.join(REPO_ROOT, "portals/docs-portal/public/screenshots");

const PROXY_PORT = 13100;
const NEXT_PORT = 13099;
const CDP_PORT = 9249;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function startMockApi() {
  return new Promise((resolve) => {
    const prefillPayload = {
      setup_completed: false,
      hardware_id: "HW-361B-F973",
      network: {
        detected_local_ip: "192.168.1.25",
        local_ip: "192.168.1.25/24",
        default_gateway: "192.168.1.1",
        dns_primary: "8.8.8.8",
        dns_secondary: "1.1.1.1",
        hostname: "nornia-pbx",
        nat_enabled: true,
        nat_extern_ip: "185.122.201.44",
        nat_local_nets: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
        primary_interface: { name: "enp0s3", primary_cidr: "192.168.1.25/24" },
        interfaces: [
          { name: "enp0s3", ip: "192.168.1.25", primary_cidr: "192.168.1.25/24" },
          { name: "wg0", ip: "10.200.0.2", primary_cidr: "10.200.0.2/24" },
        ],
      },
      license: {
        hardware_id: "HW-361B-F973",
        company_name: "Acme Teknoloji A.Ş.",
        tenant_code: "ACME",
        license_key: "AIDA-ACME-20271231-361BF973-8F2A91C4.eyJtYXhfdXNlcnMiOjI1MCwibWF4X2NvbmN1cnJlbnRfY2FsbHMiOjgwfQ",
      },
      fqdn: {
        mode: "nornia_cloud",
        subdomain: "acme",
        custom_domain: "",
        hub_url: "https://connect.nornia.com.tr",
      },
      numbering_plan: {
        current: {
          extension_range: { start: 1000, end: 1099 },
          queue_range: { start: 6000, end: 6099 },
          conference_range: { start: 8000, end: 8099 },
          call_pickup: { group: "*8", directed: "**8" },
          pbx_features: { voicemail_listen: "*97" },
        },
      },
      datetime: {
        config: {
          timezone: "Europe/Istanbul",
          ntp_enabled: true,
          ntp_server_primary: "pool.ntp.org",
          ntp_server_secondary: "tr.pool.ntp.org",
          date_format: "DD.MM.YYYY",
          time_format: "24",
          default_language: "Turkish",
        },
        timezones: [
          { id: "Europe/Istanbul", label: "İstanbul / Türkiye (TRT)", utc_offset: "UTC+03:00" },
          { id: "UTC", label: "Evrensel Zaman (UTC)", utc_offset: "UTC+00:00" },
          { id: "Europe/London", label: "Londra (GMT/BST)", utc_offset: "UTC+00:00" },
          { id: "Europe/Berlin", label: "Berlin / Orta Avrupa (CET)", utc_offset: "UTC+01:00" },
          { id: "Europe/Paris", label: "Paris (CET)", utc_offset: "UTC+01:00" },
          { id: "Asia/Dubai", label: "Dubai (GST)", utc_offset: "UTC+04:00" },
          { id: "America/New_York", label: "New York (EST)", utc_offset: "UTC-05:00" },
        ],
      },
    };

    const server = http.createServer((req, res) => {
      const url = req.url || "/";
      if (!url.startsWith("/api/")) {
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port: NEXT_PORT,
            path: url,
            method: req.method,
            headers: { ...req.headers, host: `127.0.0.1:${NEXT_PORT}` },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on("error", (err) => {
          res.writeHead(502);
          res.end(String(err));
        });
        req.pipe(proxyReq);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (url.startsWith("/api/setup/prefill")) {
        res.writeHead(200);
        res.end(JSON.stringify(prefillPayload));
        return;
      }
      if (url.startsWith("/api/setup/validate-license")) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            valid: true,
            tenant_code: "ACME",
            company_name: "Acme Teknoloji A.Ş.",
            expiry_date: "2027-12-31",
            expiry_display: "31.12.2027",
            is_demo: false,
            max_users: 250,
            max_concurrent_calls: 80,
            message: "Lisans anahtarı donanım kimliği (HW-361B-F973) ile doğrulandı — 250 kullanıcı / 80 eşzamanlı çağrı kotası aktif.",
          })
        );
        return;
      }
      if (url.startsWith("/api/setup/check-subdomain")) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            available: true,
            subdomain: "acme",
            fqdn: "acme.nornia.com.tr",
            message: "acme.nornia.com.tr alt alan adı müsait ve Nornia Connect Hub tesciline hazır!",
          })
        );
        return;
      }
      if (url.startsWith("/api/settings/theme") || url.startsWith("/api/theme")) {
        res.writeHead(200);
        res.end(JSON.stringify({ theme: "indigo", mode: "light" }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    });

    server.listen(PROXY_PORT, "127.0.0.1", () => resolve(server));
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }
  close() {
    try {
      this.ws?.close();
    } catch (_) {}
  }
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500) return true;
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function captureStep(cdp, filename) {
  await cdp.eval(`window.scrollTo(0, 0)`);
  await sleep(450);
  const metrics = await cdp.eval(`({
    w: 1440,
    h: Math.min(1250, Math.max(880, document.documentElement.scrollHeight))
  })`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: metrics.h,
    deviceScaleFactor: 1.5,
    mobile: false,
  });
  await sleep(300);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 90,
    clip: { x: 0, y: 0, width: 1440, height: metrics.h, scale: 1 },
  });
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  [OK] ${filename} (${1440}x${metrics.h}, ${kb} KB)`);
}

async function clickButtonByText(cdp, textList) {
  return await cdp.eval(`(() => {
    const targets = ${JSON.stringify(textList)};
    const btns = Array.from(document.querySelectorAll("button"));
    for (const t of targets) {
      const b = btns.find((el) => (el.innerText || "").trim().includes(t) && !el.disabled);
      if (b) { b.click(); return (b.innerText || "").trim(); }
    }
    return null;
  })()`);
}

async function main() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) throw new Error("Chrome bulunamadı.");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mockSrv = await startMockApi();
  const nextProc = spawn(
    path.join(FRONTEND_DIR, "node_modules/.bin/next"),
    ["start", "-p", String(NEXT_PORT), "-H", "127.0.0.1"],
    {
      cwd: FRONTEND_DIR,
      env: { ...process.env },
      stdio: "ignore",
    }
  );

  const profileDir = `/tmp/nornia-setup-capture-${Date.now()}`;
  let chromeProc = null;
  let cdp = null;

  try {
    await waitForHttp(`http://127.0.0.1:${PROXY_PORT}/setup`);

    chromeProc = spawn(
      chromeBin,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profileDir}`,
        "--window-size=1440,1050",
        "about:blank",
      ],
      { stdio: "ignore" }
    );

    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json`);
    const tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    const pageTab = tabs.find((t) => t.type === "page") || tabs[0];
    cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1.5,
      mobile: false,
    });

    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PROXY_PORT}/setup` });
    await sleep(2200);

    // Step 1: Network & NAT
    await captureStep(cdp, "setup-01-network.jpg");

    // Go to Step 2: License & validate
    await clickButtonByText(cdp, ["İleri"]);
    await sleep(800);
    await clickButtonByText(cdp, ["Lisansı Doğrula", "Doğrula"]);
    await sleep(900);
    await captureStep(cdp, "setup-02-license.jpg");

    // Go to Step 3: FQDN & check subdomain
    await clickButtonByText(cdp, ["İleri"]);
    await sleep(800);
    await clickButtonByText(cdp, ["Müsaitliği Kontrol Et", "Kontrol Et"]);
    await sleep(900);
    await captureStep(cdp, "setup-03-fqdn.jpg");

    // Go to Step 4: Numbering Plan
    await clickButtonByText(cdp, ["İleri"]);
    await sleep(800);
    await clickButtonByText(cdp, ["Toplu Oluştur", "Dahili Oluştur", "Otomatik Oluştur"]);
    await sleep(600);
    await captureStep(cdp, "setup-04-numbering.jpg");

    // Go to Step 5: Date, Timezone & Language
    await clickButtonByText(cdp, ["İleri"]);
    await sleep(800);
    await captureStep(cdp, "setup-05-datetime.jpg");

    // Go to Step 6: Summary & Admin Account
    await clickButtonByText(cdp, ["İleri"]);
    await sleep(800);
    // Fill realistic sample admin email & password preview
    await cdp.eval(`(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const setVal = (el, val) => {
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const emailInput = inputs.find((i) => i.type === "email" || (i.placeholder || "").includes("@"));
      setVal(emailInput, "admin@acmeteknoloji.com.tr");
      const pwdInputs = inputs.filter((i) => i.type === "password");
      pwdInputs.forEach((p) => setVal(p, "NorniaAdmin#2026"));
    })()`);
    await sleep(500);
    await captureStep(cdp, "setup-06-summary.jpg");

    console.log("ALL_6_SETUP_STEPS_CAPTURED");
  } finally {
    cdp?.close();
    try { chromeProc?.kill("SIGKILL"); } catch (_) {}
    try { nextProc?.kill("SIGKILL"); } catch (_) {}
    try { mockSrv.close(); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
