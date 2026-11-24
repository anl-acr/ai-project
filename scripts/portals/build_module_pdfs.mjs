#!/usr/bin/env node
/**
 * Nornia Docs — Modül Bazlı Kurumsal PDF Üretici (Otomatik Keşif + Paralel Chrome)
 * =================================================================================
 * `portals/docs-portal/out/print/<slug>/` altındaki TÜM menü sayfalarını ve `all`
 * tam kılavuzunu yüksek kaliteli vektörel A4 PDF olarak `public/pdfs/` ve `out/pdfs/`
 * altına paralel olarak üretir.
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
const OUT_DIR = process.env.DOCS_OUT_DIR
  ? path.resolve(process.env.DOCS_OUT_DIR)
  : path.join(DOCS_ROOT, "out");
const PRINT_DIR = path.join(OUT_DIR, "print");
const PUBLIC_PDF_DIR = path.join(DOCS_ROOT, "public/pdfs");
const OUT_PDF_DIR = path.join(OUT_DIR, "pdfs");
const CONCURRENCY = Number(process.env.PDF_WORKERS || 4);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
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

function discoverPrintSlugs() {
  if (!fs.existsSync(PRINT_DIR)) return [];
  return fs
    .readdirSync(PRINT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PRINT_DIR, d.name, "index.html")))
    .map((d) => d.name)
    .sort((a, b) => (a === "all" ? 1 : b === "all" ? -1 : a.localeCompare(b)));
}

async function main() {
  if (!fs.existsSync(PRINT_DIR)) {
    console.error("[HATA] Önce `cd portals/docs-portal && npm run build` çalıştırılmalıdır.");
    process.exit(1);
  }

  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlySet = onlyArg
    ? new Set(
        onlyArg
          .slice("--only=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;

  const discoveredSlugs = discoverPrintSlugs();
  const slugs = onlySet ? discoveredSlugs.filter((s) => onlySet.has(s)) : discoveredSlugs;
  if (slugs.length === 0) {
    console.error("[HATA] out/print altında eşleşen sayfa bulunamadı.");
    process.exit(1);
  }

  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    console.error("[HATA] Chrome/Chromium bulunamadı.");
    process.exit(1);
  }

  // Clean stale PDFs only when running full build (not --only partial rebuild)
  if (!onlySet) {
    if (fs.existsSync(PUBLIC_PDF_DIR)) fs.rmSync(PUBLIC_PDF_DIR, { recursive: true, force: true });
    if (fs.existsSync(OUT_PDF_DIR)) fs.rmSync(OUT_PDF_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_PDF_DIR, { recursive: true });
  fs.mkdirSync(OUT_PDF_DIR, { recursive: true });

  const { server, port } = await startStaticServer(OUT_DIR);
  let doneCount = 0;

  try {
    let cursor = 0;
    const worker = async (workerId) => {
      const profileDir = `/tmp/nornia-chrome-pdf-${Date.now()}-${workerId}`;
      try {
        while (cursor < slugs.length) {
          const slug = slugs[cursor++];
          const targetUrl = `http://127.0.0.1:${port}/print/${slug}/`;
          const pdfName = slug === "all" ? "nornia-kullanim-kilavuzu-tam.pdf" : `${slug}.pdf`;
          const destPublic = path.join(PUBLIC_PDF_DIR, pdfName);
          const destOut = path.join(OUT_PDF_DIR, pdfName);

          if (fs.existsSync(destPublic)) fs.rmSync(destPublic, { force: true });
          await execFileAsync(
            chromeBin,
            [
              "--headless=new",
              "--disable-gpu",
              "--no-sandbox",
              `--user-data-dir=${profileDir}`,
              "--no-pdf-header-footer",
              "--print-to-pdf-no-header",
              `--print-to-pdf=${destPublic}`,
              targetUrl
            ],
            { timeout: slug === "all" ? 90000 : 35000 }
          );
          if (!fs.existsSync(destPublic) || fs.statSync(destPublic).size < 1024) {
            throw new Error(`Chrome PDF çıktısı üretilemedi: ${destPublic}`);
          }
          fs.copyFileSync(destPublic, destOut);
          doneCount++;
          const kb = Math.round(fs.statSync(destPublic).size / 1024);
          console.log(`  [${String(doneCount).padStart(2, "0")}/${slugs.length}] ${pdfName} (${kb} KB)`);
        }
      } finally {
        try {
          fs.rmSync(profileDir, { recursive: true, force: true });
        } catch (_) {}
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, slugs.length) }, (_, idx) => worker(idx + 1));
    await Promise.all(workers);

    console.log(`[OK] ${doneCount} adet kurumsal PDF üretildi -> ${PUBLIC_PDF_DIR}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
