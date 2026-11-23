export function resolveSamplePath(path) {
  return String(path || "")
    .replace(/\{call_id\}/g, "aida-1763890123-4918")
    .replace(/\{extension\}/g, "1000")
    .replace(/\{extension_or_id\}/g, "1000")
    .replace(/\{queue_id\}/g, "6000")
    .replace(/\{rule_id\}/g, "1")
    .replace(/\{contact_id\}/g, "512")
    .replace(/\{campaign_id\}/g, "1")
    .replace(/\{session_id\}/g, "sess_101")
    .replace(/\{task_id\}/g, "42")
    .replace(/\{req_id\}/g, "12")
    .replace(/\{session_key\}/g, "1000@192.168.1.50")
    .replace(/\{site_code\}/g, "ANKARA-01")
    .replace(/\{snapshot_id\}/g, "snap_20261123")
    .replace(/\{crm_id\}/g, "hubspot");
}

function getAuthHeaders(endpoint, apiKey) {
  const authType = endpoint?.auth_type || "api_key";
  const key = apiKey || "aida_live_default_ORNEK_ANAHTAR";
  if (authType === "session") {
    return [
      ["X-User-ID", "admin"],
      ["X-Tenant-ID", "tenant-default"],
      ["Authorization", `Bearer ${key}`]
    ];
  }
  if (authType === "webhook") {
    return [["X-Tenant-ID", "tenant-default"]];
  }
  return [["X-API-Key", key]];
}

export function generateCodeSnippet(lang, endpoint, baseUrl, apiKey) {
  const cleanBase = (baseUrl || "https://musteri.nornia.com.tr").replace(/\/+$/, "");
  const method = (endpoint?.method || "GET").toUpperCase();
  const fullUrl = `${cleanBase}${resolveSamplePath(endpoint?.path || "/api/v1/system/capacity")}`;
  const hasBody =
    endpoint?.sample_body !== null &&
    endpoint?.sample_body !== undefined &&
    ["POST", "PUT", "PATCH"].includes(method);
  const jsonPretty = hasBody ? JSON.stringify(endpoint.sample_body, null, 2) : "";
  const jsonCompact = hasBody ? JSON.stringify(endpoint.sample_body) : "";
  const authHeaders = getAuthHeaders(endpoint, apiKey);

  if (lang === "curl") {
    const lines = [`curl -X ${method} "${fullUrl}" \\`];
    authHeaders.forEach(([k, v]) => {
      lines.push(`  -H "${k}: ${v}" \\`);
    });
    lines.push(`  -H "Accept: application/json"`);
    if (hasBody) {
      lines[lines.length - 1] += " \\";
      lines.push(`  -H "Content-Type: application/json" \\`);
      lines.push(`  -d '${jsonPretty}'`);
    }
    return lines.join("\n");
  }

  if (lang === "python") {
    const lines = ["import requests", "", `url = "${fullUrl}"`, "headers = {"];
    authHeaders.forEach(([k, v]) => {
      lines.push(`    "${k}": "${v}",`);
    });
    lines.push(`    "Content-Type": "application/json"`, "}");
    if (hasBody) {
      const pyBody = jsonPretty
        .replace(/: true/g, ": True")
        .replace(/: false/g, ": False")
        .replace(/: null/g, ": None");
      lines.push(
        "",
        `payload = ${pyBody}`,
        "",
        `response = requests.${method.toLowerCase()}(url, headers=headers, json=payload, timeout=15)`
      );
    } else {
      lines.push("", `response = requests.${method.toLowerCase()}(url, headers=headers, timeout=15)`);
    }
    lines.push("response.raise_for_status()", "print(response.json())");
    return lines.join("\n");
  }

  if (lang === "node") {
    const lines = [`const response = await fetch("${fullUrl}", {`, `  method: "${method}",`, "  headers: {"];
    authHeaders.forEach(([k, v]) => {
      lines.push(`    "${k}": "${v}",`);
    });
    lines.push(`    "Content-Type": "application/json"`, "  },");
    if (hasBody) {
      lines.push(`  body: JSON.stringify(${jsonPretty.replace(/\n/g, "\n  ")})`);
    }
    lines.push("});", "", "const data = await response.json();", "console.log(data);");
    return lines.join("\n");
  }

  if (lang === "php") {
    const lines = [
      "<?php",
      `$ch = curl_init("${fullUrl}");`,
      "curl_setopt_array($ch, [",
      "    CURLOPT_RETURNTRANSFER => true,",
      `    CURLOPT_CUSTOMREQUEST => "${method}",`,
      "    CURLOPT_HTTPHEADER => ["
    ];
    authHeaders.forEach(([k, v]) => {
      lines.push(`        "${k}: ${v}",`);
    });
    lines.push('        "Content-Type: application/json"', "    ],");
    if (hasBody) {
      lines.push(`    CURLOPT_POSTFIELDS => '${jsonCompact}',`);
    }
    lines.push("]);", "$result = curl_exec($ch);", "curl_close($ch);", "print_r(json_decode($result, true));");
    return lines.join("\n");
  }

  // csharp
  const lines = ["using System.Net.Http;", "using System.Text;", "", "var client = new HttpClient();"];
  authHeaders.forEach(([k, v]) => {
    lines.push(`client.DefaultRequestHeaders.Add("${k}", "${v}");`);
  });
  lines.push("");
  if (hasBody) {
    const escaped = jsonCompact.replace(/"/g, '\\"');
    lines.push(`var content = new StringContent("${escaped}", Encoding.UTF8, "application/json");`);
    if (method === "POST") {
      lines.push(`var response = await client.PostAsync("${fullUrl}", content);`);
    } else if (method === "PUT") {
      lines.push(`var response = await client.PutAsync("${fullUrl}", content);`);
    } else {
      lines.push(`var req = new HttpRequestMessage(new HttpMethod("${method}"), "${fullUrl}") { Content = content };`);
      lines.push("var response = await client.SendAsync(req);");
    }
  } else {
    if (method === "GET") {
      lines.push(`var response = await client.GetAsync("${fullUrl}");`);
    } else if (method === "DELETE") {
      lines.push(`var response = await client.DeleteAsync("${fullUrl}");`);
    } else {
      lines.push(`var req = new HttpRequestMessage(new HttpMethod("${method}"), "${fullUrl}");`);
      lines.push("var response = await client.SendAsync(req);");
    }
  }
  lines.push("Console.WriteLine(await response.Content.ReadAsStringAsync());");
  return lines.join("\n");
}

export const WEBHOOK_VERIFY_SNIPPETS = {
  python: `import hashlib, hmac
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "gizli_imza_anahtari_123"

@app.post("/api/pbx-events")
async def receive_pbx_event(request: Request):
    raw_body = await request.body()
    received_sig = request.headers.get("X-AIDA-Signature", "")
    expected_sig = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(received_sig, expected_sig):
        raise HTTPException(status_code=401, detail="Geçersiz webhook imzası")

    event = await request.json()
    print("Doğrulanan Nornia Olayı:", event["event"], event["data"])
    return {"ok": True}`,
  node: `import crypto from "crypto";
import express from "express";

const app = express();
const WEBHOOK_SECRET = "gizli_imza_anahtari_123";

app.post("/api/pbx-events", express.raw({ type: "application/json" }), (req, res) => {
  const receivedSig = req.header("X-AIDA-Signature") || "";
  const expectedSig = "sha256=" + crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
    return res.status(401).json({ detail: "Geçersiz webhook imzası" });
  }

  const event = JSON.parse(req.body.toString("utf8"));
  console.log("Doğrulanan Nornia Olayı:", event.event, event.data);
  res.json({ ok: true });
});`,
  php: `<?php
$secret = "gizli_imza_anahtari_123";
$rawBody = file_get_contents("php://input");
$receivedSig = $_SERVER["HTTP_X_AIDA_SIGNATURE"] ?? "";
$expectedSig = "sha256=" . hash_hmac("sha256", $rawBody, $secret);

if (!hash_equals($expectedSig, $receivedSig)) {
    http_response_code(401);
    exit("Geçersiz webhook imzası");
}

$event = json_decode($rawBody, true);
error_log("Nornia Olayı: " . $event["event"]);
echo json_encode(["ok" => true]);`,
  csharp: `using System.Security.Cryptography;
using System.Text;

bool VerifySignature(string rawBody, string receivedSig, string secret) {
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
    var expected = "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(expected),
        Encoding.UTF8.GetBytes(receivedSig ?? "")
    );
}`
};
