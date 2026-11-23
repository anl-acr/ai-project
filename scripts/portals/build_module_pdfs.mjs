#!/usr/bin/env node
/**
 * Nornia Docs — Modül Bazlı Kurumsal PDF Üretici
 * ==============================================
 * `portals/docs-portal/out/` içindeki her `/print/<slug>/` sayfasını yüksek kaliteli
 * vektörel A4 PDF olarak `portals/docs-portal/public/pdfs/<slug>.pdf` ve `out/pdfs/`
 * altına kaydeder. Önce Playwright varsa onu, yoksa yerel Chrome/Chromium ikilisini kullanır.
 */

import fs from "fs";
import http from "http";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_ROOT = path.resolve(__dirname, "../../portals/docs-portal");
const OUT_DIR = path.join(DOCS_ROOT, "out");
const PUBLIC_PDF_DIR = path.join(DOCS_ROOT, "public/pdfs");
const OUT_PDF_DIR = path.join(OUT_DIR, "pdfs");

const SLUGS = [
  "kurulum-ve-ilk-baslangic",
  "kullanicilar-ve-numara-plani",
  "dis-hatlar-ve-arama-kurallari",
  "arama-akisi-ve-ivr",
  "cagri-merkezi-ve-acd",
  "yapay-zeka-suite",
  "omnichannel-ve-crm",
  "oto-provizyon-ve-cihazlar",
  "raporlama-ve-analitik",
  "ag-guvenlik-ve-merkezi-panel",
  "all"
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || "/").split("?")[0];
      let filePath = path.join(rootDir, decodeURIComponent(cleanUrl));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      } else if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
        filePath = `${filePath}.html`;
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error("[HATA] Önce `cd portals/docs-portal && npm run build` çalıştırılmalıdır.");
    process.exit(1);
  }

  fs.mkdirSync(PUBLIC_PDF_DIR, { recursive: true });
  fs.mkdirSync(OUT_PDF_DIR, { recursive: true });

  const { server, port } = await startStaticServer(OUT_DIR);
  let playwright = null;
  try {
    playwright = await import("playwright");
  } catch (_) {}

  try {
    if (playwright) {
      const browser = await playwright.chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        for (const slug of SLUGS) {
          const targetUrl = `http://127.0.0.1:${port}/print/${slug}/`;
          const pdfName = slug === "all" ? "nornia-kullanim-kilavuzu-tam.pdf" : `${slug}.pdf`;
          const destPublic = path.join(PUBLIC_PDF_DIR, pdfName);
          const destOut = path.join(OUT_PDF_DIR, pdfName);

          console.log(`  → [Playwright] PDF üretiliyor: ${pdfName}`);
          await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(400);
          await page.pdf({
            path: destPublic,
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<div style="font-size:8px;color:#64748b;width:100%;padding:0 14mm;display:flex;justify-content:space-between;"><span>Nornia Enterprise AI PBX — Kullanım Kılavuzu</span><span>dokuman.nornia.com.tr</span></div>`,
            footerTemplate: `<div style="font-size:8px;color:#64748b;width:100%;padding:0 14mm;display:flex;justify-content:space-between;"><span>© Nornia Akıllı İletişim Platformu</span><span>Sayfa <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
            margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" }
          });
          fs.copyFileSync(destPublic, destOut);
        }
      } finally {
        await browser.close();
      }
    } else {
      const chromeBin = findChromeBinary();
      if (!chromeBin) {
        console.error("[HATA] Playwright veya Chrome/Chromium bulunamadı.");
        process.exit(1);
      }
      for (const slug of SLUGS) {
        const targetUrl = `http://127.0.0.1:${port}/print/${slug}/`;
        const pdfName = slug === "all" ? "nornia-kullanim-kilavuzu-tam.pdf" : `${slug}.pdf`;
        const destPublic = path.join(PUBLIC_PDF_DIR, pdfName);
        const destOut = path.join(OUT_PDF_DIR, pdfName);

        console.log(`  → [Chrome] PDF üretiliyor: ${pdfName}`);
        await execFileAsync(chromeBin, [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--user-data-dir=/tmp/nornia-chrome-pdf",
          "--print-to-pdf-no-header",
          `--print-to-pdf=${destPublic}`,
          targetUrl
        ], { timeout: 30000 });
        fs.copyFileSync(destPublic, destOut);
      }
    }
    console.log(`[OK] ${SLUGS.length} adet kurumsal PDF üretildi -> ${PUBLIC_PDF_DIR}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
