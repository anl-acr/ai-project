import React from "react";
import {
  Globe,
  Server,
  Cpu,
  Database,
  PhoneCall,
  Bot,
  ShieldCheck,
  Radio,
  ArrowDown,
  ArrowRight,
  Lock,
  Smartphone,
  Laptop,
} from "lucide-react";

export default function SystemArchitectureDiagram({ variant = "core" }) {
  if (variant === "tunnel") {
    return (
      <section className="print-avoid-break rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Mimari Akış Diyagramı
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Nornia Connect — Sıfır-Port Ters Tünel &amp; WireGuard SIP Edge Topolojisi
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            0 Gelen Port • Outbound Şifreli Köprü
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-stretch">
          {/* Box 1: On-Premise PBX */}
          <div className="lg:col-span-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
              <Server size={15} />
              <span>Kurum İçi Santral (LAN)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Firewall / NAT / CGNAT arkasında çalışır. Dışa açık gelen port yoktur.
            </p>
            <div className="flex flex-wrap gap-1 pt-1 font-mono text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                UI :3000
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                API :8000
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                WSS :8089
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                SIP :5060
              </span>
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="lg:col-span-1 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ArrowRight size={20} className="hidden lg:block" />
            <ArrowDown size={20} className="lg:hidden" />
          </div>

          {/* Box 2: Encrypted Outbound Tunnel */}
          <div className="lg:col-span-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
              <Lock size={15} />
              <span>Şifreli Outbound Tünel</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
              <li>• HTTPS / WSS Ters Vekil Köprüsü</li>
              <li>• WireGuard L3 SIP Edge (10.200.0.x)</li>
              <li>• WebRTC TURN / RTP Ses Rölesi</li>
              <li>• Yönetici Onaylı Web-SSH Kanalı</li>
            </ul>
          </div>

          {/* Arrow 2 */}
          <div className="lg:col-span-1 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ArrowRight size={20} className="hidden lg:block" />
            <ArrowDown size={20} className="lg:hidden" />
          </div>

          {/* Box 3: Central Hub + Clients */}
          <div className="lg:col-span-3 rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-extrabold text-xs">
              <Globe size={15} />
              <span>Connect Hub &amp; İstemciler</span>
            </div>
            <div className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
              https://&lt;firma&gt;.nornia.com.tr
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Nginx 443 + Otomatik Let&apos;s Encrypt SSL → Tarayıcı WebPhone, Runa Mobil, Runa Masaüstü ve Uzak IP Telefonlar.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="print-avoid-break rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Sistem Topolojisi &amp; Servis Bağlantıları
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            Nornia Enterprise AI PBX — Katmanlı Servis Mimarisi
          </h3>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
          Ubuntu 24.04 LTS • PM2 + Systemd
        </span>
      </div>

      {/* Layer 1: Clients & External Channels */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
          1. İstemciler, Telefonlar &amp; Dış Kanallar
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-semibold">
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200">
            <Laptop size={14} className="text-indigo-600 shrink-0" />
            <span>Web &amp; Runa Masaüstü</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200">
            <Smartphone size={14} className="text-sky-600 shrink-0" />
            <span>Runa Mobil (iOS/Android)</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200">
            <PhoneCall size={14} className="text-emerald-600 shrink-0" />
            <span>IP Telefon &amp; SIP Trunk</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200">
            <Globe size={14} className="text-rose-600 shrink-0" />
            <span>WhatsApp / Meta / Email</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center text-slate-400">
        <ArrowDown size={18} />
      </div>

      {/* Layer 2: Edge / Reverse Proxy & Security */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
              <Server size={14} />
              Nginx Reverse Proxy &amp; TLS Sonlandırıcı
            </span>
            <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              TCP 80 / 443
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-[10px] text-slate-700 dark:text-slate-300">
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
              / → 127.0.0.1:3000
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
              /api &amp; /ws → :8000
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
              /asterisk/ws → :8089
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-300">
            <ShieldCheck size={14} />
            <span>Güvenlik Kalkanı</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
            UFW + Fail2Ban + SIP IPS Guard + SipTrapper PCAP motoru gelen tüm trafiği gerçek zamanlı süzer.
          </p>
        </div>
      </div>

      <div className="flex justify-center text-slate-400">
        <ArrowDown size={18} />
      </div>

      {/* Layer 3: Core Application Services */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-sky-800 dark:text-sky-300">
              aida-app (Next.js)
            </span>
            <span className="font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300">
              PM2 • :3000
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Yönetim paneli, Temsilci Çağrı Paneli, WebRTC SIP.js telefonu, LiveTranslator ve 44+ rapor arayüzü.
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-purple-800 dark:text-purple-300 flex items-center gap-1">
              <Bot size={14} />
              aida-backend (FastAPI)
            </span>
            <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-300">
              PM2 • :8000 / :9092
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            REST API, WebSocket olay motoru, AMI istemcisi, Omnichannel işçileri, Lisans/Telemetri ve AudioSocket AI TCP (:9092).
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Radio size={14} />
              Asterisk PJSIP
            </span>
            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              systemd • :5060/:8089
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            SIP çağrı anahtarlama, ACD kuyruk, IVR, konferans, MixMonitor ses kaydı, AMI (:5038) ve RTP medya (10000–20000/UDP).
          </p>
        </div>
      </div>

      <div className="flex justify-center text-slate-400">
        <ArrowDown size={18} />
      </div>

      {/* Layer 4: Data, AI Providers & Central Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Database size={14} />
              PostgreSQL 16 + pgvector
            </span>
            <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
              127.0.0.1:5444
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            <code>ai_pbx</code> veritabanı: 15+ çoklu kiracı tablo, CDR, transkript, RAG vektörleri ve mola/oturum kayıtları.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <Cpu size={14} className="text-purple-600" />
            <span>AI Sağlayıcılar / Yerel LLM</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Gemini Live WSS, OpenAI Realtime veya kurum içi Ollama + Whisper GPU düğümü.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <Lock size={14} className="text-emerald-600" />
            <span>Merkez Hub &amp; Disk Depolama</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            <code>panel.nornia.com.tr</code> (Lisans &amp; Tünel) + <code>/var/spool/asterisk/monitor</code> (Ses Kayıtları / SMB-NAS).
          </p>
        </div>
      </div>
    </section>
  );
}
