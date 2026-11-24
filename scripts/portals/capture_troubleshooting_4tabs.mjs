#!/usr/bin/env node
/**
 * Nornia Docs — Sorun İnceleme 4 Sekme Canlı Görüntü Yakalayıcı
 * ==============================================================
 * Gerçek frontend (`/?tab=troubleshooting`) ekranını yerel mock API proxy ile
 * ayağa kaldırır; Chrome CDP üzerinden 4 sekmenin tamamını (Ping, Traceroute,
 * SIP Capture Yakalama, sngrep) gerçekçi VoIP/SIP verileriyle doldurarak
 * `portals/docs-portal/public/screenshots/tabs/troubleshooting/` altına kaydeder.
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
const OUT_DIR = path.join(
  REPO_ROOT,
  "portals/docs-portal/public/screenshots/tabs/troubleshooting"
);

const PROXY_PORT = 13102;
const NEXT_PORT = 13101;
const CDP_PORT = 9250;

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

const SAMPLE_INVITE_RAW = `INVITE sip:05324189022@sip.ikontelekom.com.tr:5060 SIP/2.0
Via: SIP/2.0/UDP 10.10.0.5:5060;rport;branch=z9hG4bKPj8f4a21c9-e73b-4a91-90a2-f8c1d4b92e11
From: "Ahmet Yılmaz (1001)" <sip:908503607390@10.10.0.5>;tag=as729b410e
To: <sip:05324189022@sip.ikontelekom.com.tr>
Contact: <sip:908503607390@185.122.201.44:5060>
Call-ID: 7f2c9a18-4b02-4e11-a89c-001b21c84410@10.10.0.5
CSeq: 102 INVITE
Allow: INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, SUBSCRIBE, NOTIFY, INFO, PUBLISH, MESSAGE
Supported: replaces, timer
P-Asserted-Identity: <sip:908503607390@sip.ikontelekom.com.tr>
User-Agent: Nornia-Enterprise-PBX/3.10.11
Content-Type: application/sdp
Content-Length: 284

v=0
o=NorniaPBX 1795542100 1795542100 IN IP4 185.122.201.44
s=Nornia Enterprise Voice
c=IN IP4 185.122.201.44
t=0 0
m=audio 16420 RTP/AVP 8 0 101
a=rtpmap:8 PCMA/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=sendrecv`;

const SAMPLE_200OK_RAW = `SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.10.0.5:5060;received=185.122.201.44;rport=5060;branch=z9hG4bKPj8f4a21c9-e73b-4a91-90a2-f8c1d4b92e11
From: "Ahmet Yılmaz (1001)" <sip:908503607390@10.10.0.5>;tag=as729b410e
To: <sip:05324189022@sip.ikontelekom.com.tr>;tag=SBC-44891a7c
Call-ID: 7f2c9a18-4b02-4e11-a89c-001b21c84410@10.10.0.5
CSeq: 102 INVITE
Server: Ikon-SBC-TR/6.4
Contact: <sip:05324189022@185.42.190.15:5060;transport=udp>
Content-Type: application/sdp
Content-Length: 248

v=0
o=IkonSBC 882104 882104 IN IP4 185.42.190.15
s=SBC Media
c=IN IP4 185.42.190.15
t=0 0
m=audio 28944 RTP/AVP 8 101
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=ptime:20
a=sendrecv`;

const SAMPLE_486_RAW = `SIP/2.0 486 Busy Here
Via: SIP/2.0/UDP 10.10.0.5:5060;received=185.122.201.44;rport=5060;branch=z9hG4bKPj4c81e0a2
From: "Elif Demir (1004)" <sip:908503607390@10.10.0.5>;tag=as91a420c1
To: <sip:05552104488@sip.ikontelekom.com.tr>;tag=SBC-9012f3b0
Call-ID: b81c4401-9a10-4c22-8f12-55a190bc3102@10.10.0.5
CSeq: 102 INVITE
Server: Ikon-SBC-TR/6.4
Reason: Q.850;cause=17;text="User busy"
Content-Length: 0`;

const SAMPLE_REGISTER_RAW = `REGISTER sip:10.10.0.5:5060 SIP/2.0
Via: SIP/2.0/WSS 192.168.1.42:54128;rport;branch=z9hG4bK8821041
From: "Ahmet Yılmaz" <sip:1001@app.nornia.com.tr>;tag=r91f8821
To: "Ahmet Yılmaz" <sip:1001@app.nornia.com.tr>
Call-ID: reg-1001-f92a8c10@192.168.1.42
CSeq: 41 REGISTER
Contact: <sip:1001@192.168.1.42:54128;transport=ws>;expires=300
User-Agent: RUNA-Desktop/2.8.4 (macOS)
Content-Length: 0`;

function buildMockData() {
  const mainCallId = "7f2c9a18-4b02-4e11-a89c-001b21c84410@10.10.0.5";
  const busyCallId = "b81c4401-9a10-4c22-8f12-55a190bc3102@10.10.0.5";
  const inboundCallId = "a419c70e-12f1-4d88-b410-88c92a4011ef@185.42.190.15";
  const regCallId = "reg-1001-f92a8c10@192.168.1.42";

  const mainCallMessages = [
    {
      id: 101,
      timestamp: "14:22:08.112",
      protocol: "UDP",
      src_ip: "192.168.1.42",
      src_port: 54128,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "INVITE",
      method: "INVITE",
      caller: "1001",
      callee: "05324189022",
      length: 948,
      call_id: mainCallId,
      raw: SAMPLE_INVITE_RAW,
    },
    {
      id: 102,
      timestamp: "14:22:08.118",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "192.168.1.42",
      dst_port: 54128,
      status: "100 Trying",
      method: "INVITE",
      caller: "1001",
      callee: "05324189022",
      length: 342,
      call_id: mainCallId,
      raw: `SIP/2.0 100 Trying\nVia: SIP/2.0/UDP 192.168.1.42:54128;branch=z9hG4bK9912\nFrom: "Ahmet Yılmaz" <sip:1001@10.10.0.5>;tag=w8812\nTo: <sip:05324189022@10.10.0.5>\nCall-ID: ${mainCallId}\nCSeq: 102 INVITE\nServer: Nornia-Enterprise-PBX/3.10.11\nContent-Length: 0`,
    },
    {
      id: 103,
      timestamp: "14:22:08.129",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "185.42.190.15",
      dst_port: 5060,
      status: "INVITE",
      method: "INVITE",
      caller: "908503607390",
      callee: "05324189022",
      length: 984,
      call_id: mainCallId,
      raw: SAMPLE_INVITE_RAW,
    },
    {
      id: 104,
      timestamp: "14:22:08.144",
      protocol: "UDP",
      src_ip: "185.42.190.15",
      src_port: 5060,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "100 Trying",
      method: "INVITE",
      caller: "908503607390",
      callee: "05324189022",
      length: 356,
      call_id: mainCallId,
      raw: `SIP/2.0 100 Trying\nVia: SIP/2.0/UDP 10.10.0.5:5060;received=185.122.201.44;rport=5060\nCall-ID: ${mainCallId}\nCSeq: 102 INVITE\nServer: Ikon-SBC-TR/6.4\nContent-Length: 0`,
    },
    {
      id: 105,
      timestamp: "14:22:08.812",
      protocol: "UDP",
      src_ip: "185.42.190.15",
      src_port: 5060,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "183 Session Progress",
      method: "INVITE",
      caller: "908503607390",
      callee: "05324189022",
      length: 712,
      call_id: mainCallId,
      raw: `SIP/2.0 183 Session Progress\nVia: SIP/2.0/UDP 10.10.0.5:5060\nCall-ID: ${mainCallId}\nCSeq: 102 INVITE\nServer: Ikon-SBC-TR/6.4\nContent-Type: application/sdp\nContent-Length: 220`,
    },
    {
      id: 106,
      timestamp: "14:22:08.820",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "192.168.1.42",
      dst_port: 54128,
      status: "180 Ringing",
      method: "INVITE",
      caller: "1001",
      callee: "05324189022",
      length: 418,
      call_id: mainCallId,
      raw: `SIP/2.0 180 Ringing\nVia: SIP/2.0/UDP 192.168.1.42:54128\nCall-ID: ${mainCallId}\nCSeq: 102 INVITE\nServer: Nornia-Enterprise-PBX/3.10.11\nContent-Length: 0`,
    },
    {
      id: 107,
      timestamp: "14:22:12.405",
      protocol: "UDP",
      src_ip: "185.42.190.15",
      src_port: 5060,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "200 OK",
      method: "INVITE",
      caller: "908503607390",
      callee: "05324189022",
      length: 842,
      call_id: mainCallId,
      raw: SAMPLE_200OK_RAW,
    },
    {
      id: 108,
      timestamp: "14:22:12.411",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "192.168.1.42",
      dst_port: 54128,
      status: "200 OK",
      method: "INVITE",
      caller: "1001",
      callee: "05324189022",
      length: 826,
      call_id: mainCallId,
      raw: SAMPLE_200OK_RAW,
    },
    {
      id: 109,
      timestamp: "14:22:12.422",
      protocol: "UDP",
      src_ip: "192.168.1.42",
      src_port: 54128,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "ACK",
      method: "ACK",
      caller: "1001",
      callee: "05324189022",
      length: 396,
      call_id: mainCallId,
      raw: `ACK sip:05324189022@10.10.0.5:5060 SIP/2.0\nVia: SIP/2.0/UDP 192.168.1.42:54128\nCall-ID: ${mainCallId}\nCSeq: 102 ACK\nContent-Length: 0`,
    },
    {
      id: 110,
      timestamp: "14:22:12.431",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "185.42.190.15",
      dst_port: 5060,
      status: "ACK",
      method: "ACK",
      caller: "908503607390",
      callee: "05324189022",
      length: 412,
      call_id: mainCallId,
      raw: `ACK sip:05324189022@185.42.190.15:5060 SIP/2.0\nVia: SIP/2.0/UDP 10.10.0.5:5060\nCall-ID: ${mainCallId}\nCSeq: 102 ACK\nContent-Length: 0`,
    },
    {
      id: 111,
      timestamp: "14:23:44.908",
      protocol: "UDP",
      src_ip: "192.168.1.42",
      src_port: 54128,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "BYE",
      method: "BYE",
      caller: "1001",
      callee: "05324189022",
      length: 410,
      call_id: mainCallId,
      raw: `BYE sip:05324189022@10.10.0.5:5060 SIP/2.0\nVia: SIP/2.0/UDP 192.168.1.42:54128\nCall-ID: ${mainCallId}\nCSeq: 103 BYE\nReason: Q.850;cause=16;text="Normal Clearing"\nContent-Length: 0`,
    },
    {
      id: 112,
      timestamp: "14:23:44.922",
      protocol: "UDP",
      src_ip: "185.42.190.15",
      src_port: 5060,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "200 OK",
      method: "BYE",
      caller: "908503607390",
      callee: "05324189022",
      length: 368,
      call_id: mainCallId,
      raw: SAMPLE_200OK_RAW,
    },
  ];

  const capturePackets = [
    ...mainCallMessages.slice().reverse(),
    {
      id: 100,
      timestamp: "14:21:54.402",
      protocol: "UDP",
      src_ip: "185.42.190.15",
      src_port: 5060,
      dst_ip: "10.10.0.5",
      dst_port: 5060,
      status: "486 Busy Here",
      method: "INVITE",
      caller: "1004",
      callee: "05552104488",
      length: 432,
      call_id: busyCallId,
      raw: SAMPLE_486_RAW,
    },
    {
      id: 99,
      timestamp: "14:21:40.018",
      protocol: "WSS",
      src_ip: "192.168.1.42",
      src_port: 54128,
      dst_ip: "10.10.0.5",
      dst_port: 8089,
      status: "REGISTER",
      method: "REGISTER",
      caller: "1001",
      callee: "1001",
      length: 518,
      call_id: regCallId,
      raw: SAMPLE_REGISTER_RAW,
    },
    {
      id: 98,
      timestamp: "14:21:39.885",
      protocol: "UDP",
      src_ip: "10.10.0.5",
      src_port: 5060,
      dst_ip: "185.42.190.15",
      dst_port: 5060,
      status: "OPTIONS",
      method: "OPTIONS",
      caller: "NorniaPBX",
      callee: "Ikon_Trunk",
      length: 468,
      call_id: "opt-keepalive-90812@10.10.0.5",
      raw: `OPTIONS sip:sip.ikontelekom.com.tr:5060 SIP/2.0\nVia: SIP/2.0/UDP 10.10.0.5:5060;rport\nFrom: <sip:asterisk@10.10.0.5>;tag=opt882\nTo: <sip:sip.ikontelekom.com.tr>\nCall-ID: opt-keepalive-90812@10.10.0.5\nCSeq: 120 OPTIONS\nContent-Length: 0`,
    },
  ];

  // Put packet #103 (INVITE with rich SDP) at top so raw SIP+SDP inspector displays immediately
  const orderedCapturePackets = [
    mainCallMessages[2], // #103 INVITE (full SIP + SDP)
    mainCallMessages[6], // #107 200 OK (full SDP)
    mainCallMessages[8], // #109 ACK
    mainCallMessages[10], // #111 BYE
    mainCallMessages[11], // #112 200 OK
    capturePackets[12], // #100 486 Busy Here
    mainCallMessages[5], // #106 180 Ringing
    mainCallMessages[4], // #105 183 Session Progress
    capturePackets[13], // #99 REGISTER (WSS 8089)
    capturePackets[14], // #98 OPTIONS (Keepalive)
  ];

  const sngrepCalls = [
    {
      call_id: mainCallId,
      initial_method: "INVITE",
      last_status: "200 OK",
      start_time: "14:22:08",
      last_time: "14:23:44",
      caller: "1001 (Ahmet Yılmaz)",
      callee: "0532 418 90 22",
      packet_count: mainCallMessages.length,
    },
    {
      call_id: inboundCallId,
      initial_method: "INVITE",
      last_status: "200 OK",
      start_time: "14:21:58",
      last_time: "14:23:12",
      caller: "0212 340 88 10",
      callee: "0850 360 73 90 (AI Santral)",
      packet_count: 9,
    },
    {
      call_id: busyCallId,
      initial_method: "INVITE",
      last_status: "486 Busy Here",
      start_time: "14:21:51",
      last_time: "14:21:54",
      caller: "1004 (Elif Demir)",
      callee: "0555 210 44 88",
      packet_count: 5,
    },
    {
      call_id: regCallId,
      initial_method: "REGISTER",
      last_status: "200 OK",
      start_time: "14:21:40",
      last_time: "14:21:40",
      caller: "1001@app.nornia.com.tr",
      callee: "RUNA-Desktop/2.8.4 (WSS)",
      packet_count: 4,
    },
    {
      call_id: "opt-keepalive-90812@10.10.0.5",
      initial_method: "OPTIONS",
      last_status: "200 OK",
      start_time: "14:21:39",
      last_time: "14:21:39",
      caller: "10.10.0.5:5060",
      callee: "sip.ikontelekom.com.tr",
      packet_count: 2,
    },
  ];

  const snapshots = [
    {
      filename: "sip_analiz_20261124_142015.pcap",
      label: "sip_analiz",
      created_at: "24.11.2026 14:20:15",
      size_bytes: 148240,
      packet_count: 214,
    },
    {
      filename: "ikon_trunk_486_analiz_20261124_110542.pcap",
      label: "ikon_trunk_486_analiz",
      created_at: "24.11.2026 11:05:42",
      size_bytes: 84610,
      packet_count: 118,
    },
  ];

  const targets = [
    { label: "Ikon Telekom SBC (Trunk)", host: "sip.ikontelekom.com.tr", category: "trunk" },
    { label: "Yedek Operatör (Netgsm)", host: "sip.netgsm.com.tr", category: "trunk" },
    { label: "Nornia Connect Hub", host: "connect.nornia.com.tr", category: "system" },
    { label: "Google DNS", host: "8.8.8.8", category: "dns" },
    { label: "Cloudflare DNS", host: "1.1.1.1", category: "dns" },
  ];

  const pingResult = {
    status: "success",
    host: "sip.ikontelekom.com.tr",
    return_code: 0,
    duration_ms: 3042,
    summary: {
      transmitted: 4,
      received: 4,
      loss_percent: 0,
      min_ms: 11.4,
      avg_ms: 12.6,
      max_ms: 14.1,
      jitter_ms: 0.9,
    },
    replies: [
      { bytes: 64, from: "185.42.190.15", seq: 1, ttl: 57, time_ms: 11.4 },
      { bytes: 64, from: "185.42.190.15", seq: 2, ttl: 57, time_ms: 12.2 },
      { bytes: 64, from: "185.42.190.15", seq: 3, ttl: 57, time_ms: 14.1 },
      { bytes: 64, from: "185.42.190.15", seq: 4, ttl: 57, time_ms: 12.7 },
    ],
    raw_output: `PING sip.ikontelekom.com.tr (185.42.190.15) 56(84) bytes of data.
64 bytes from sbc1.ikontelekom.com.tr (185.42.190.15): icmp_seq=1 ttl=57 time=11.4 ms
64 bytes from sbc1.ikontelekom.com.tr (185.42.190.15): icmp_seq=2 ttl=57 time=12.2 ms
64 bytes from sbc1.ikontelekom.com.tr (185.42.190.15): icmp_seq=3 ttl=57 time=14.1 ms
64 bytes from sbc1.ikontelekom.com.tr (185.42.190.15): icmp_seq=4 ttl=57 time=12.7 ms

--- sip.ikontelekom.com.tr ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 11.400/12.600/14.100/0.941 ms`,
  };

  const tracerouteResult = {
    status: "success",
    host: "sip.ikontelekom.com.tr",
    duration_ms: 1840,
    max_hops: 15,
    hops: [
      { hop: 1, host: "gw.acme.local", ip: "192.168.1.1", rtts_ms: [0.42, 0.39, 0.45], avg_ms: 0.42, is_timeout: false },
      { hop: 2, host: "core-ist-01.isp.net.tr", ip: "88.255.14.1", rtts_ms: [2.81, 2.74, 2.95], avg_ms: 2.83, is_timeout: false },
      { hop: 3, host: "ae4-ist-gayrettepe.turktelekom.com.tr", ip: "212.156.118.42", rtts_ms: [5.12, 5.44, 5.28], avg_ms: 5.28, is_timeout: false },
      { hop: 4, host: "ix-ist-peering.de-cix.net", ip: "185.1.94.12", rtts_ms: [8.64, 8.91, 8.50], avg_ms: 8.68, is_timeout: false },
      { hop: 5, host: "*", ip: "*", rtts_ms: [], avg_ms: null, is_timeout: true },
      { hop: 6, host: "edge-tr01.ikontelekom.com.tr", ip: "185.42.190.2", rtts_ms: [10.92, 11.15, 11.04], avg_ms: 11.04, is_timeout: false },
      { hop: 7, host: "sbc1.ikontelekom.com.tr", ip: "185.42.190.15", rtts_ms: [11.84, 12.12, 11.96], avg_ms: 11.97, is_timeout: false },
    ],
    raw_output: `traceroute to sip.ikontelekom.com.tr (185.42.190.15), 15 hops max, 60 byte packets
 1  gw.acme.local (192.168.1.1)  0.420 ms  0.390 ms  0.450 ms
 2  core-ist-01.isp.net.tr (88.255.14.1)  2.810 ms  2.740 ms  2.950 ms
 3  ae4-ist-gayrettepe.turktelekom.com.tr (212.156.118.42)  5.120 ms  5.440 ms  5.280 ms
 4  ix-ist-peering.de-cix.net (185.1.94.12)  8.640 ms  8.910 ms  8.500 ms
 5  * * *
 6  edge-tr01.ikontelekom.com.tr (185.42.190.2)  10.920 ms  11.150 ms  11.040 ms
 7  sbc1.ikontelekom.com.tr (185.42.190.15)  11.840 ms  12.120 ms  11.960 ms`,
  };

  return {
    mainCallId,
    mainCallMessages,
    orderedCapturePackets,
    sngrepCalls,
    snapshots,
    targets,
    pingResult,
    tracerouteResult,
  };
}

function startMockProxy() {
  const mock = buildMockData();

  return new Promise((resolve) => {
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

      // Consume request body if POST
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");

        // Auth, users, roles, license, version, setup status
        if (url.startsWith("/api/setup/status")) {
          res.writeHead(200);
          res.end(JSON.stringify({ setup_completed: true }));
          return;
        }
        if (url.startsWith("/api/settings/version")) {
          res.writeHead(200);
          res.end(JSON.stringify({ version: "v3.10.11", release_date: "2026-11-24" }));
          return;
        }
        if (url.startsWith("/api/system/update/check")) {
          res.writeHead(200);
          res.end(JSON.stringify({ update_available: false, current_version: "v3.10.11" }));
          return;
        }
        if (url.startsWith("/api/settings/users")) {
          res.writeHead(200);
          res.end(
            JSON.stringify([
              {
                id: "9999",
                username: "admin",
                full_name: "Sistem Yöneticisi",
                email: "admin@nornia.com.tr",
                role: "admin",
                extension: "1000",
                status: "active",
                is_registered: true,
              },
              {
                id: "1001",
                username: "ahmet.yilmaz",
                full_name: "Ahmet Yılmaz",
                role: "agent",
                extension: "1001",
                status: "active",
                is_registered: true,
              },
            ])
          );
          return;
        }
        if (url.startsWith("/api/settings/roles")) {
          res.writeHead(200);
          res.end(
            JSON.stringify([
              {
                id: 1,
                role_code: "admin",
                role_name: "Sistem Yöneticisi",
                permissions: ["*", "troubleshooting:access", "sip_debugger:access"],
              },
            ])
          );
          return;
        }
        if (url.startsWith("/api/settings/license/status")) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              status: "active",
              valid: true,
              tenant_code: "ACME",
              company_name: "Acme Teknoloji A.Ş.",
              max_users: 250,
              max_concurrent_calls: 80,
              allowed_features: ["*"],
              hide_provider_infra_from_customer_admin: false,
            })
          );
          return;
        }
        if (url.startsWith("/api/settings/tenants")) {
          res.writeHead(200);
          res.end(
            JSON.stringify([
              { id: "tenant-default", name: "Acme Teknoloji A.Ş.", status: "active" },
            ])
          );
          return;
        }

        // === SIP DEBUGGER & TROUBLESHOOTING MOCKS ===
        if (url.startsWith("/api/sip-debugger/diagnostics/targets")) {
          res.writeHead(200);
          res.end(JSON.stringify({ targets: mock.targets }));
          return;
        }
        if (url.startsWith("/api/sip-debugger/diagnostics/ping")) {
          res.writeHead(200);
          res.end(JSON.stringify(mock.pingResult));
          return;
        }
        if (url.startsWith("/api/sip-debugger/diagnostics/traceroute")) {
          res.writeHead(200);
          res.end(JSON.stringify(mock.tracerouteResult));
          return;
        }
        if (url.startsWith("/api/sip-debugger/capture/packets")) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              packets: mock.orderedCapturePackets,
              total_buffered: 342,
              is_running: true,
              snapshots: mock.snapshots,
            })
          );
          return;
        }
        if (url.match(/^\/api\/sip-debugger\/calls\/[^/?]+/)) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              call: {
                call_id: mock.mainCallId,
                initial_method: "INVITE",
                last_status: "200 OK",
                start_time: "14:22:08",
                last_time: "14:23:44",
                caller: "1001 (Ahmet Yılmaz)",
                callee: "0532 418 90 22",
                packet_count: mock.mainCallMessages.length,
                messages: mock.mainCallMessages,
              },
            })
          );
          return;
        }
        if (url.startsWith("/api/sip-debugger/calls")) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              calls: mock.sngrepCalls,
              is_running: true,
            })
          );
          return;
        }

        // Generic safe JSON fallback for other dashboard background polls
        if (url.includes("/stats") || url.includes("/overview")) {
          res.writeHead(200);
          res.end(JSON.stringify({ status: "ok", items: [], data: [] }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok" }));
      });
    });

    server.listen(PROXY_PORT, "127.0.0.1", () => resolve(server));
  });
}

function startNextServer() {
  const nextBin = path.join(FRONTEND_DIR, "node_modules/.bin/next");
  const child = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(NEXT_PORT)], {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child;
}

async function waitForHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (e) => reject(e));
      this.ws.addEventListener("message", (evt) => {
        const msg = JSON.parse(String(evt.data));
        if (msg.id && this.pending.has(msg.id)) {
          const { res, rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
      });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r?.exceptionDetails) {
      throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
    }
    return r?.result?.value;
  }
  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function capturePanel(cdp, outFilename, { clipHeight = 980 } = {}) {
  await sleep(400);
  // Ensure scroll top of main stage is 0 so header + tabs + results are cleanly framed
  await cdp.eval(`(() => {
    const stage = document.querySelector('.aida-stage-active') || document.querySelector('main');
    if (stage) stage.scrollTop = 0;
    window.scrollTo(0, 0);
  })()`);
  await sleep(250);

  // Measure actual height needed to show the entire TroubleshootingPanel without clipping
  const panelHeight = await cdp.eval(`(() => {
    const el = document.querySelector('[aria-labelledby="troubleshooting-tab-ping"], [aria-labelledby="troubleshooting-tab-traceroute"], [aria-labelledby="troubleshooting-tab-sip-capture"], [aria-labelledby="troubleshooting-tab-sngrep"]');
    if (!el) return ${clipHeight};
    const rect = el.getBoundingClientRect();
    return Math.min(1380, Math.max(880, Math.ceil(rect.bottom + 32)));
  })()`);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1560,
    height: panelHeight,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(300);

  const shot = await cdp.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 92,
    fromSurface: true,
  });
  const outPath = path.join(OUT_DIR, outFilename);
  fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  console.log(`  [OK] ${outFilename} (${panelHeight}px) -> ${outPath}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const chromeBin = findChromeBinary();
  if (!chromeBin) throw new Error("Google Chrome binary not found.");

  console.log("1) Yerel frontend & mock API proxy başlatılıyor...");
  const nextProc = startNextServer();
  const proxyServer = await startMockProxy();

  let chromeProc = null;
  let cdp = null;
  const userDataDir = `/tmp/nornia_troubleshoot_cdp_${Date.now()}`;

  try {
    await waitForHttp(`http://127.0.0.1:${NEXT_PORT}/`);
    await waitForHttp(`http://127.0.0.1:${PROXY_PORT}/api/sip-debugger/diagnostics/targets`);

    console.log("2) Headless Chrome (CDP) başlatılıyor...");
    chromeProc = spawn(
      chromeBin,
      [
        "--headless=new",
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        "--window-size=1440,1040",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "ignore"] }
    );

    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json`);
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1040,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // Inject authenticated admin session + light mode BEFORE app mounts
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", "admin");
        localStorage.setItem("active_tenant_id", "tenant-default");
        localStorage.setItem("active_tenant_name", "Acme Teknoloji A.Ş.");
        localStorage.setItem("aida_theme_mode", "light");
        localStorage.setItem("theme", "light");
        localStorage.setItem("aida_sidebar_collapsed", "false");
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", "admin");
        sessionStorage.setItem("is_nornia_root", "true");
      `,
    });

    console.log("3) Sorun İnceleme ekranı açılıyor...");
    await cdp.send("Page.navigate", {
      url: `http://127.0.0.1:${PROXY_PORT}/?tab=troubleshooting`,
    });

    // Wait for TroubleshootingPanel tabs to appear
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const ok = await cdp.eval(`Boolean(document.getElementById("troubleshooting-tab-ping"))`);
      if (ok) {
        ready = true;
        break;
      }
      await sleep(300);
    }
    if (!ready) {
      const bodySnippet = await cdp.eval(`document.body.innerText.slice(0, 600)`);
      throw new Error("TroubleshootingPanel did not mount. Page text: " + bodySnippet);
    }

    // Force light mode class cleanly on documentElement
    await cdp.eval(`document.documentElement.classList.remove("dark");`);
    await sleep(600);

    // === TAB 1: PING ===
    console.log("4) Sekme 1 (Ping) çalıştırılıyor ve yakalanıyor...");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ping Başlat'));
      if (btn) btn.click();
    })()`);
    await sleep(800);
    await capturePanel(cdp, "01-ping.jpg");

    // === TAB 2: TRACEROUTE ===
    console.log("5) Sekme 2 (Traceroute) çalıştırılıyor ve yakalanıyor...");
    await cdp.eval(`document.getElementById("troubleshooting-tab-traceroute")?.click()`);
    await sleep(450);
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Rota Analizi') || b.textContent.includes('Traceroute Başlat')));
      if (btn) btn.click();
    })()`);
    await sleep(900);
    await capturePanel(cdp, "02-traceroute.jpg");

    // === TAB 3: SIP CAPTURE ===
    console.log("6) Sekme 3 (SIP Capture Yakalama) yakalanıyor...");
    await cdp.eval(`document.getElementById("troubleshooting-tab-sip-capture")?.click()`);
    await sleep(900);
    await capturePanel(cdp, "03-sip-capture.jpg");

    // === TAB 4: SNGREP ===
    console.log("7) Sekme 4 (sngrep Ladder View) yakalanıyor...");
    await cdp.eval(`document.getElementById("troubleshooting-tab-sngrep")?.click()`);
    await sleep(1000);
    // Click packet #103 (INVITE with rich SDP) or #107 (200 OK) so raw SIP/SDP header inspector is full
    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('#troubleshooting-panel-sngrep [role="button"], #troubleshooting-panel-sngrep button, #troubleshooting-panel-sngrep tr'));
      const inviteRow = rows.find(r => r.textContent && r.textContent.includes('INVITE') && r.textContent.includes('185.42.190.15'));
      if (inviteRow) inviteRow.click();
    })()`);
    await sleep(400);
    await capturePanel(cdp, "04-sngrep.jpg");

    console.log("Tüm 4 sekme başarıyla yakalandı!");
  } finally {
    cdp?.close();
    try {
      chromeProc?.kill("SIGKILL");
    } catch {}
    try {
      nextProc?.kill("SIGKILL");
    } catch {}
    try {
      proxyServer?.close();
    } catch {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("HATA:", err);
  process.exit(1);
});
