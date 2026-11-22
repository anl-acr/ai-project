import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Network,
  KeyRound,
  Globe,
  Hash,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Server,
  Users,
  Plus,
  Trash2,
  Sparkles,
  Search,
  Languages,
  Calendar,
  ArrowRight,
  Edit2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTheme } from "../utils/theme";
import { getBackendHost } from "../utils/apiHost";
import { persistAuthenticatedSession } from "../utils/authStorage";

function readActiveUserSession() {
  if (typeof window === "undefined") return { uid: "", role: "" };
  try {
    const uid =
      localStorage.getItem("current_user_id") ||
      sessionStorage.getItem("current_user_id") ||
      "";
    const rawProf =
      localStorage.getItem("aida_cached_user_profile") ||
      sessionStorage.getItem("aida_cached_user_profile") ||
      "";
    const prof = rawProf ? JSON.parse(rawProf) : null;
    const role = prof?.role || (uid === "admin" ? "admin" : "");
    return { uid: String(uid || ""), role: String(role || "") };
  } catch (e) {
    return { uid: "", role: "" };
  }
}

const WIZARD_STEPS = [
  { id: 1, key: "network", title: "Ağ Ayarları", shortTitle: "Ağ", icon: Network },
  { id: 2, key: "license", title: "Lisans", shortTitle: "Lisans", icon: KeyRound },
  { id: 3, key: "fqdn", title: "FQDN Yapısı", shortTitle: "FQDN", icon: Globe },
  { id: 4, key: "numbering", title: "Dahili & Numara Planı", shortTitle: "Numara Planı", icon: Hash },
  { id: 5, key: "datetime", title: "Saat, Tarih & Dil", shortTitle: "Tarih & Dil", icon: Clock },
  { id: 6, key: "summary", title: "Özet & Uygula", shortTitle: "Özet", icon: CheckCircle2 },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const backendHost = getBackendHost();
  const apiBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [prefill, setPrefill] = useState(null);
  const [completedResult, setCompletedResult] = useState(null);

  // Step 1: Network & NAT
  const [localIp, setLocalIp] = useState("");
  const [defaultGateway, setDefaultGateway] = useState("");
  const [dnsPrimary, setDnsPrimary] = useState("8.8.8.8");
  const [dnsSecondary, setDnsSecondary] = useState("1.1.1.1");
  const [hostname, setHostname] = useState("nornia-pbx");
  const [natEnabled, setNatEnabled] = useState(true);
  const [natExternIp, setNatExternIp] = useState("");
  const [natLocalNets, setNatLocalNets] = useState("192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12");

  // Step 2: License
  const [companyName, setCompanyName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseCheck, setLicenseCheck] = useState(null);
  const [checkingLicense, setCheckingLicense] = useState(false);

  // Step 3: FQDN & Remote Access
  const [fqdnMode, setFqdnMode] = useState("nornia_cloud"); // nornia_cloud | custom_fqdn | lan_only
  const [subdomain, setSubdomain] = useState("");
  const [hubUrl, setHubUrl] = useState("https://connect.nornia.com.tr");
  const [hubSecret, setHubSecret] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [subCheck, setSubCheck] = useState(null);
  const [checkingSub, setCheckingSub] = useState(false);

  // Step 4: Numbering Plan & Optional Initial Extensions
  const [planPreset, setPlanPreset] = useState("4_digit");
  const [extStart, setExtStart] = useState(1000);
  const [extEnd, setExtEnd] = useState(5999);
  const [queueStart, setQueueStart] = useState(6000);
  const [queueEnd, setQueueEnd] = useState(6999);
  const [confStart, setConfStart] = useState(8000);
  const [confEnd, setConfEnd] = useState(8999);
  const [pickupGroup, setPickupGroup] = useState("*8");
  const [pickupDirected, setPickupDirected] = useState("**");
  const [voicemailCode, setVoicemailCode] = useState("*97");
  const [initialExtensions, setInitialExtensions] = useState([]);
  const [batchStartExt, setBatchStartExt] = useState("1000");
  const [batchCount, setBatchCount] = useState(5);

  // Step 5: Date, Timezone, Format & Language
  const [timezones, setTimezones] = useState([]);
  const [tzSearch, setTzSearch] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [ntpEnabled, setNtpEnabled] = useState(true);
  const [ntpPrimary, setNtpPrimary] = useState("pool.ntp.org");
  const [ntpSecondary, setNtpSecondary] = useState("tr.pool.ntp.org");
  const [manualDatetime, setManualDatetime] = useState("");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY");
  const [timeFormat, setTimeFormat] = useState("24");
  const [defaultLanguage, setDefaultLanguage] = useState("Turkish");

  // Step 6: Admin Account & Password Setup (required on fresh install)
  const [adminFullName, setAdminFullName] = useState("Sistem Yöneticisi");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  const buildAuthHeaders = () => {
    const hdrs = { "Content-Type": "application/json" };
    try {
      const { uid, role } = readActiveUserSession();
      if (uid) hdrs["X-User-ID"] = uid;
      if (role) hdrs["X-User-Role"] = role;
    } catch (e) {}
    return hdrs;
  };

  const copyText = (val, key) => {
    if (!val || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(String(val)).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  useEffect(() => {
    let active = true;
    const loadPrefill = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(`${apiBase}/api/setup/prefill`, {
          headers: buildAuthHeaders(),
        });
        if (res.status === 403) {
          // Setup already completed and user is not logged in as admin
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("Kurulum bilgileri sunucudan alınamadı.");
        const data = await res.json();
        if (!active) return;
        setPrefill(data);

        // Populate Step 1
        const net = data.network || {};
        setLocalIp(net.local_ip || net.detected_local_ip || "");
        setDefaultGateway(net.default_gateway || "");
        setDnsPrimary(net.dns_primary || "8.8.8.8");
        setDnsSecondary(net.dns_secondary || "1.1.1.1");
        setHostname(net.hostname || "nornia-pbx");
        setNatEnabled(net.nat_enabled !== false);
        setNatExternIp(net.nat_extern_ip || "");
        if (Array.isArray(net.nat_local_nets) && net.nat_local_nets.length) {
          setNatLocalNets(net.nat_local_nets.join(", "));
        }

        // Populate Step 2
        const lic = data.license || {};
        setCompanyName(lic.company_name || "");
        setTenantCode(lic.tenant_code || "");
        setLicenseKey(lic.license_key || "");

        // Populate Step 3
        const fq = data.fqdn || {};
        setFqdnMode(fq.mode || "nornia_cloud");
        setSubdomain(fq.subdomain || "");
        setCustomDomain(fq.custom_domain || "");
        setHubUrl(fq.hub_url || "https://connect.nornia.com.tr");

        // Populate Step 4
        const curNp = data.numbering_plan?.current || {};
        if (curNp.extension_range) {
          setExtStart(Number(curNp.extension_range.start || 1000));
          setExtEnd(Number(curNp.extension_range.end || 5999));
          setBatchStartExt(String(curNp.extension_range.start || 1000));
          if (Number(curNp.extension_range.start || 1000) < 1000) {
            setPlanPreset("3_digit");
          }
        }
        if (curNp.queue_range) {
          setQueueStart(Number(curNp.queue_range.start || 6000));
          setQueueEnd(Number(curNp.queue_range.end || 6999));
        }
        if (curNp.conference_range) {
          setConfStart(Number(curNp.conference_range.start || 8000));
          setConfEnd(Number(curNp.conference_range.end || 8999));
        }
        if (curNp.call_pickup) {
          setPickupGroup(curNp.call_pickup.group || "*8");
          setPickupDirected(curNp.call_pickup.directed || "**");
        }
        if (curNp.pbx_features?.voicemail_listen) {
          setVoicemailCode(curNp.pbx_features.voicemail_listen);
        }

        // Populate Step 5
        const dtCfg = data.datetime?.config || {};
        if (Array.isArray(data.datetime?.timezones)) {
          setTimezones(data.datetime.timezones);
        }
        setTimezone(dtCfg.timezone || "Europe/Istanbul");
        setNtpEnabled(dtCfg.ntp_enabled !== false);
        setNtpPrimary(dtCfg.ntp_server_primary || "pool.ntp.org");
        setNtpSecondary(dtCfg.ntp_server_secondary || "tr.pool.ntp.org");
        setDateFormat(dtCfg.date_format || "DD.MM.YYYY");
        setTimeFormat(dtCfg.time_format || "24");
        setDefaultLanguage(dtCfg.default_language || "Turkish");
      } catch (err) {
        if (active) setErrorMsg(err.message || "Kurulum sihirbazı başlatılamadı.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPrefill();
    return () => {
      active = false;
    };
  }, []);

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return timezones;
    return timezones.filter(
      (z) =>
        z.id.toLowerCase().includes(q) ||
        z.label.toLowerCase().includes(q) ||
        z.utc_offset.toLowerCase().includes(q)
    );
  }, [timezones, tzSearch]);

  const handleValidateLicense = async () => {
    if (!licenseKey.trim()) return;
    setCheckingLicense(true);
    setLicenseCheck(null);
    try {
      const res = await fetch(`${apiBase}/api/setup/validate-license`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ license_key: licenseKey.trim(), tenant_code: tenantCode.trim() }),
      });
      const data = await res.json();
      setLicenseCheck(data);
      if (data.tenant_code && !tenantCode.trim()) {
        setTenantCode(data.tenant_code);
      }
    } catch (err) {
      setLicenseCheck({ valid: false, message: "Lisans doğrulama isteği başarısız oldu." });
    } finally {
      setCheckingLicense(false);
    }
  };

  const handleCheckSubdomain = async () => {
    const clean = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSubdomain(clean);
    if (clean.length < 2) {
      setSubCheck({ available: false, message: "En az 2 karakter giriniz." });
      return;
    }
    setCheckingSub(true);
    setSubCheck(null);
    try {
      const res = await fetch(
        `${apiBase}/api/setup/check-subdomain?subdomain=${encodeURIComponent(clean)}&hub_url=${encodeURIComponent(hubUrl)}`,
        { headers: buildAuthHeaders() }
      );
      const data = await res.json();
      setSubCheck(data);
    } catch (err) {
      setSubCheck({ available: false, message: "Alt alan adı kontrol edilemedi." });
    } finally {
      setCheckingSub(false);
    }
  };

  const applyNumberingPreset = (presetId) => {
    setPlanPreset(presetId);
    if (presetId === "3_digit") {
      setExtStart(100);
      setExtEnd(599);
      setQueueStart(600);
      setQueueEnd(699);
      setConfStart(800);
      setConfEnd(899);
      setBatchStartExt("100");
    } else if (presetId === "4_digit") {
      setExtStart(1000);
      setExtEnd(5999);
      setQueueStart(6000);
      setQueueEnd(6999);
      setConfStart(8000);
      setConfEnd(8999);
      setBatchStartExt("1000");
    }
  };

  const handleGenerateBatchExtensions = () => {
    const startNum = parseInt(batchStartExt, 10) || extStart;
    const cnt = Math.max(1, Math.min(30, parseInt(batchCount, 10) || 5));
    const existingSet = new Set(initialExtensions.map((x) => String(x.extension)));
    const next = [...initialExtensions];
    for (let i = 0; i < cnt; i++) {
      const eStr = String(startNum + i);
      if (!existingSet.has(eStr)) {
        next.push({ extension: eStr, full_name: `Dahili ${eStr}`, email: "" });
        existingSet.add(eStr);
      }
    }
    setInitialExtensions(next);
  };

  const effectiveFqdnDisplay =
    fqdnMode === "nornia_cloud"
      ? subdomain
        ? `${subdomain}.nornia.com.tr`
        : "Belirlenmedi (.nornia.com.tr)"
      : fqdnMode === "custom_fqdn"
      ? customDomain || "Belirlenmedi"
      : `${localIp || "Yerel IP"} (Sadece LAN)`;

  const isFreshInstall = !prefill?.setup_completed;

  const passwordStrength = useMemo(() => {
    const p = adminPassword || "";
    if (!p) return { level: 0, label: "", bar: "w-0 bg-slate-300" };
    let score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    if (score <= 2) return { level: 1, label: "Zayıf", bar: "w-1/3 bg-rose-500" };
    if (score <= 3) return { level: 2, label: "Orta", bar: "w-2/3 bg-amber-500" };
    return { level: 3, label: "Güçlü", bar: "w-full bg-emerald-500" };
  }, [adminPassword]);

  const handleCompleteSetup = async () => {
    setErrorMsg("");
    if (isFreshInstall && !adminPassword.trim()) {
      setErrorMsg("İlk kurulumda 'admin' yönetici hesabı için şifre belirlemeniz zorunludur.");
      return;
    }
    if (adminPassword && adminPassword.length < 6) {
      setErrorMsg("Yönetici parolası en az 6 karakter olmalıdır.");
      return;
    }
    if (adminPassword && adminPassword !== adminPasswordConfirm) {
      setErrorMsg("Yönetici parolası tekrarı eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/setup/complete`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          company_name: companyName.trim(),
          network: {
            local_ip: localIp.trim(),
            default_gateway: defaultGateway.trim(),
            dns_primary: dnsPrimary.trim(),
            dns_secondary: dnsSecondary.trim(),
            hostname: hostname.trim(),
            nat_enabled: natEnabled,
            nat_extern_ip: natExternIp.trim(),
            nat_local_nets: natLocalNets,
          },
          license: {
            company_name: companyName.trim(),
            tenant_code: tenantCode.trim(),
            license_key: licenseKey.trim(),
          },
          fqdn: {
            mode: fqdnMode,
            subdomain: subdomain.trim().toLowerCase(),
            custom_domain: customDomain.trim(),
            hub_url: hubUrl.trim(),
            secret_token: hubSecret.trim(),
          },
          numbering_plan: {
            extension_range: { start: Number(extStart), end: Number(extEnd) },
            queue_range: { start: Number(queueStart), end: Number(queueEnd) },
            conference_range: { start: Number(confStart), end: Number(confEnd) },
            call_pickup: { group: pickupGroup.trim() || "*8", directed: pickupDirected.trim() || "**" },
            voicemail_listen: voicemailCode.trim() || "*97",
          },
          initial_extensions: initialExtensions,
          datetime: {
            timezone,
            ntp_enabled: ntpEnabled,
            ntp_server_primary: ntpPrimary.trim() || "pool.ntp.org",
            ntp_server_secondary: ntpSecondary.trim(),
            manual_datetime: ntpEnabled ? "" : manualDatetime,
            date_format: dateFormat,
            time_format: timeFormat,
            default_language: defaultLanguage,
          },
          admin: {
            full_name: adminFullName.trim() || "Sistem Yöneticisi",
            email: adminEmail.trim(),
            password: adminPassword,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Kurulum uygulanamadı.");
      setCompletedResult(data);
    } catch (err) {
      setErrorMsg(err.message || "Kurulum tamamlanırken bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTzObj = timezones.find((z) => z.id === timezone);
  const resolvedHardwareId = useMemo(() => {
    const raw = prefill?.hardware_id ?? prefill?.license?.hardware_id;
    if (!raw) return "HW-YÜKLENİYOR";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") return String(raw.hardware_id || raw.clean_hw_id || "HW-UNKNOWN");
    return String(raw);
  }, [prefill]);

  return (
    <>
      <Head>
        <title>Nornia PBX — İlk Kurulum Sihirbazı</title>
      </Head>

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Top Brand Bar */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} text-white flex items-center justify-center shadow-sm`}>
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                  Nornia PBX — İlk Kurulum Sihirbazı
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {completedResult ? "Kurulum Tamamlandı" : `Adım ${step} / ${WIZARD_STEPS.length} • ${WIZARD_STEPS[step - 1]?.title}`}
                </div>
              </div>
            </div>

            {prefill?.setup_completed && !completedResult && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Panele Dön
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-7 space-y-6">
          {/* 6-Step Progress Stepper */}
          {!completedResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm overflow-x-auto">
              <div className="grid grid-cols-6 gap-2 min-w-[600px]">
                {WIZARD_STEPS.map((s) => {
                  const Icon = s.icon;
                  const isActive = step === s.id;
                  const isDone = step > s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStep(s.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? `${lightBg} ${border} ${text} ring-1 ${ring} shadow-xs`
                          : isDone
                          ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? `${bg} text-white`
                            : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                        }`}
                      >
                        {isDone ? <Check size={14} /> : <Icon size={14} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase opacity-70">Adım {s.id}</div>
                        <div className="text-[11px] font-extrabold truncate">{s.shortTitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2.5">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className={`animate-spin ${text}`} />
              <p className="text-xs font-bold text-slate-500">Sunucu donanım, ağ ve sistem bilgileri okunuyor...</p>
            </div>
          ) : completedResult ? (
            /* ============================================================
               SUCCESS / COMPLETED VIEW
               ============================================================ */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 shadow-lg p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white">
                    Santral Kurulumu Başarıyla Tamamlandı!
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Tüm ağ, lisans, FQDN, numara planı ve saat dilimi ayarları uygulandı ve Asterisk servisi senkronize edildi.
                  </p>
                </div>
              </div>

              {/* Execution Steps Report */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(completedResult.steps || []).map((st) => (
                  <div
                    key={st.step}
                    className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={14} />
                      <span>{st.step}. {st.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{st.detail}</p>
                  </div>
                ))}
              </div>

              {/* Zero-Touch DHCP Option 66 Provisioning URLs */}
              {completedResult.provisioning && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Server size={14} className={text} />
                    Hazır Zero-Touch DHCP Option 66 Provizyon Adresleri
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        Aynı Ofis (LAN — {completedResult.provisioning.sip_local_host}:5060)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={completedResult.provisioning.lan_prov_url || ""}
                          className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => copyText(completedResult.provisioning.lan_prov_url, "done-lan")}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          {copiedKey === "done-lan" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        Uzak Şube (WAN — {completedResult.provisioning.sip_wan_host}:5060)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={completedResult.provisioning.wan_prov_url || ""}
                          className="flex-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => copyText(completedResult.provisioning.wan_prov_url, "done-wan")}
                          className={`px-2.5 py-1.5 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold cursor-pointer`}
                        >
                          {copiedKey === "done-wan" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Login Info Box */}
              <div className={`p-4 rounded-2xl border ${borderLight} ${lightBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="space-y-1">
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={15} className={text} />
                    Sistem Yöneticisi Hesabı Hazır
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Kullanıcı Adı: <strong className="font-mono text-slate-900 dark:text-white">admin</strong>
                    {completedResult.admin_account?.email ? ` • E-Posta: ${completedResult.admin_account.email}` : ""}
                    {" • "}Az önce belirlediğiniz yönetici şifresiyle giriş yapabilirsiniz.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => router.replace("/login")}
                  className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Giriş Ekranına Git (/login)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (completedResult.admin_account) {
                      persistAuthenticatedSession("admin", true, completedResult.admin_account);
                      try {
                        sessionStorage.setItem("aida_just_logged_in", "1");
                      } catch (e) {}
                    }
                    router.replace("/");
                  }}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl ${bg} ${hover} text-white text-xs font-extrabold shadow-md transition cursor-pointer`}
                >
                  <span>admin ile Yönetim Paneline Geç</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================
               ACTIVE WIZARD STEP CARD
               ============================================================ */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Step Content */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* -------------------------------------------------------- */}
                {/* STEP 1: NETWORK & NAT                                    */}
                {/* -------------------------------------------------------- */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Network size={20} className={text} />
                        1. Ağ &amp; NAT Ayarları
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Santralin yerel IP adresi, DNS, ağ geçidi ve dış NAT yapılandırmasını doğrulayın. Bu bilgiler SIP transportları ve LAN oto-provizyon adresleri için kullanılır.
                      </p>
                    </div>

                    {/* Detected NICs Preview */}
                    {Array.isArray(prefill?.network?.interfaces) && prefill.network.interfaces.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          Algılanan Ağ Arayüzleri
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {prefill.network.interfaces.slice(0, 6).map((ifc, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono flex items-center gap-2"
                            >
                              <span className="font-bold text-slate-800 dark:text-slate-100">{ifc.name}</span>
                              <span className={text}>{ifc.primary_cidr || ifc.ip || "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          Santral Yerel LAN IP Adresi <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={localIp}
                          onChange={(e) => setLocalIp(e.target.value)}
                          placeholder="172.20.5.252"
                          className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          Varsayılan Ağ Geçidi (Gateway)
                        </label>
                        <input
                          type="text"
                          value={defaultGateway}
                          onChange={(e) => setDefaultGateway(e.target.value)}
                          placeholder="172.20.5.1"
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          Birincil DNS Sunucusu
                        </label>
                        <input
                          type="text"
                          value={dnsPrimary}
                          onChange={(e) => setDnsPrimary(e.target.value)}
                          placeholder="8.8.8.8"
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          İkincil DNS Sunucusu
                        </label>
                        <input
                          type="text"
                          value={dnsSecondary}
                          onChange={(e) => setDnsSecondary(e.target.value)}
                          placeholder="1.1.1.1"
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* NAT Block */}
                    <div className={`p-4 rounded-2xl border ${borderLight} ${lightBg} space-y-3`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                            PJSIP Dinamik NAT &amp; Dış IP
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Santral firewall/router arkasındaysa SIP trunk ses ve sinyalizasyonu için aktif tutun.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNatEnabled((v) => !v)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                            natEnabled
                              ? `${bg} text-white`
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {natEnabled ? "NAT Aktif" : "NAT Kapalı"}
                        </button>
                      </div>

                      {natEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Dış IP Adresi (External IP)
                            </label>
                            <input
                              type="text"
                              value={natExternIp}
                              onChange={(e) => setNatExternIp(e.target.value)}
                              placeholder="Örn: 92.45.85.186"
                              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Yerel Ağ Aralıkları (Local Nets)
                            </label>
                            <input
                              type="text"
                              value={natLocalNets}
                              onChange={(e) => setNatLocalNets(e.target.value)}
                              placeholder="192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STEP 2: LICENSE                                          */}
                {/* -------------------------------------------------------- */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <KeyRound size={20} className={text} />
                        2. Lisans Aktivasyonu &amp; Donanım Kimliği
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Aşağıdaki Donanım Kimliği için üretilmiş Nornia lisans anahtarınızı girip doğrulayın (isterseniz daha sonra Sistem Ayarları → Lisans alanından da aktive edebilirsiniz).
                      </p>
                    </div>

                    {/* Hardware Fingerprint Card */}
                    <div className={`p-4 rounded-2xl border ${borderLight} ${lightBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Bu Sunucunun Donanım Kimliği (Machine ID)
                        </span>
                        <div className={`text-lg font-black font-mono mt-0.5 ${text}`}>
                          {resolvedHardwareId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(resolvedHardwareId, "hw-id")}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer shrink-0`}
                      >
                        {copiedKey === "hw-id" ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedKey === "hw-id" ? "Kopyalandı" : "Donanım ID Kopyala"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          Firma / Kurum Adı
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Örn: Nolto Teknoloji A.Ş."
                          className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          Müşteri Kodu <span className="font-normal text-slate-400">(Anahtardan otomatik okunur)</span>
                        </label>
                        <input
                          type="text"
                          value={tenantCode}
                          onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                          placeholder="Örn: NOLTO"
                          className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        Lisans Anahtarı (AIDA-...)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={licenseKey}
                          onChange={(e) => {
                            setLicenseKey(e.target.value.toUpperCase());
                            setLicenseCheck(null);
                          }}
                          placeholder="AIDA-FIRMA-20271231-XXXXXXXX-XXXXXXXX"
                          className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleValidateLicense}
                          disabled={checkingLicense || !licenseKey.trim()}
                          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-45 shrink-0`}
                        >
                          <ShieldCheck size={14} />
                          <span>{checkingLicense ? "Doğrulanıyor..." : "Anahtarı Doğrula"}</span>
                        </button>
                      </div>
                    </div>

                    {licenseCheck && (
                      <div
                        className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 ${
                          licenseCheck.valid
                            ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {licenseCheck.valid ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                        <div>
                          <div>{licenseCheck.message}</div>
                          {licenseCheck.valid && (
                            <div className="text-[11px] font-mono opacity-80 mt-0.5">
                              Kod: {licenseCheck.tenant_code} • Geçerlilik: {licenseCheck.expiry_date || "-"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STEP 3: FQDN & REMOTE ACCESS                             */}
                {/* -------------------------------------------------------- */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Globe size={20} className={text} />
                        3. FQDN Yapısı &amp; Uzak Erişim
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Santralinize dışarıdan hangi alan adı (FQDN) üzerinden erişileceğini seçin. Nornia Bulut FQDN ile port açmadan Web, WebRTC, Mobil ve Uzak Masa Telefonu (SIP Edge) anında çalışır.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          id: "nornia_cloud",
                          title: "Nornia Bulut FQDN",
                          badge: "Önerilen",
                          desc: "musteri.nornia.com.tr • Sıfır Port + SSL + SIP Edge (5060 TCP)",
                        },
                        {
                          id: "custom_fqdn",
                          title: "Özel Kurumsal FQDN",
                          badge: "Kendi Domain",
                          desc: "pbx.sirketim.com • Kendi DNS ve statik dış IP yönlendirmeniz",
                        },
                        {
                          id: "lan_only",
                          title: "Sadece Yerel Ağ (LAN)",
                          badge: "Kapalı Ağ",
                          desc: "Dış alan adı yok • Sadece yerel IP üzerinden erişim",
                        },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setFqdnMode(m.id)}
                          className={`p-4 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                            fqdnMode === m.id
                              ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                              : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black">{m.title}</span>
                            <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 text-[9px] font-extrabold uppercase">
                              {m.badge}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 leading-relaxed">{m.desc}</p>
                        </button>
                      ))}
                    </div>

                    {fqdnMode === "nornia_cloud" && (
                      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                            Nornia Alt Alan Adı (Subdomain)
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1 flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                              <input
                                type="text"
                                value={subdomain}
                                onChange={(e) => {
                                  setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                                  setSubCheck(null);
                                }}
                                placeholder="firmaadiniz"
                                className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                              />
                              <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-500 border-l border-slate-200 dark:border-slate-700">
                                .nornia.com.tr
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleCheckSubdomain}
                              disabled={checkingSub || subdomain.trim().length < 2}
                              className={`px-4 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold cursor-pointer disabled:opacity-45 shrink-0`}
                            >
                              {checkingSub ? "Sorgulanıyor..." : "Müsaitlik Kontrol Et"}
                            </button>
                          </div>
                          {subCheck && (
                            <p
                              className={`text-xs font-bold mt-2 ${
                                subCheck.available ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {subCheck.message || (subCheck.available ? "Alt alan adı müsait!" : "Bu alt alan adı kullanımda.")}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                              Nornia Hub Adresi
                            </label>
                            <input
                              type="text"
                              value={hubUrl}
                              onChange={(e) => setHubUrl(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                              Hub Bağlantı Anahtarı (Secret Token) <span className="font-normal text-slate-400">(Opsiyonel)</span>
                            </label>
                            <input
                              type="password"
                              value={hubSecret}
                              onChange={(e) => setHubSecret(e.target.value)}
                              placeholder="Merkez panelden alınan tünel anahtarı"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {fqdnMode === "custom_fqdn" && (
                      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                          Özel FQDN Alan Adı
                        </label>
                        <input
                          type="text"
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="Örn: pbx.sirketim.com"
                          className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        <p className="text-[11px] text-slate-500">
                          DNS A kaydınızın santral dış IP adresine ({natExternIp || "Dış IP"}) işaret ettiğinden emin olun. Uzak masa telefonları bu alan adı üzerinden SIP kaydı alacaktır.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STEP 4: NUMBERING PLAN & INITIAL EXTENSIONS              */}
                {/* -------------------------------------------------------- */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Hash size={20} className={text} />
                        4. Dahili Yapısı ve Numara Planı
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Santralinizin dahili uzunluğunu, kuyruk/konferans aralıklarını ve servis kodlarını belirleyin. İsterseniz ilk dahili numaralarını da şimdi toplu oluşturabilirsiniz.
                      </p>
                    </div>

                    {/* Preset Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          id: "4_digit",
                          title: "4 Haneli Kurumsal Plan (Önerilen)",
                          desc: "Dahililer: 1000–5999 • Kuyruk: 6000–6999 • Konferans: 8000–8999",
                        },
                        {
                          id: "3_digit",
                          title: "3 Haneli Kompakt Plan",
                          desc: "Dahililer: 100–599 • Kuyruk: 600–699 • Konferans: 800–899",
                        },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyNumberingPreset(p.id)}
                          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                            planPreset === p.id
                              ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                              : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="text-xs font-black">{p.title}</div>
                          <div className="text-[11px] opacity-80 mt-1">{p.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Ranges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Dahili (Abone) Aralığı</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" value={extStart} onChange={(e) => setExtStart(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                          <input type="number" value={extEnd} onChange={(e) => setExtEnd(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">ACD Kuyruk Aralığı</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" value={queueStart} onChange={(e) => setQueueStart(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                          <input type="number" value={queueEnd} onChange={(e) => setQueueEnd(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Konferans Odası Aralığı</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" value={confStart} onChange={(e) => setConfStart(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                          <input type="number" value={confEnd} onChange={(e) => setConfEnd(e.target.value)} className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                        </div>
                      </div>
                    </div>

                    {/* Feature Codes */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Grup Çağrı Çekme</label>
                        <input type="text" value={pickupGroup} onChange={(e) => setPickupGroup(e.target.value)} className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Doğrudan Çağrı Çekme</label>
                        <input type="text" value={pickupDirected} onChange={(e) => setPickupDirected(e.target.value)} className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Sesli Posta Dinleme</label>
                        <input type="text" value={voicemailCode} onChange={(e) => setVoicemailCode(e.target.value)} className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                    </div>

                    {/* Optional Initial Batch Extension Builder */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Users size={14} className={text} />
                            Hızlı İlk Dahili Oluşturucu <span className="font-normal text-slate-400">(Opsiyonel)</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Kurulumla birlikte ilk dahilileri otomatik oluşturmak için seri ekleyin.
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={batchStartExt}
                            onChange={(e) => setBatchStartExt(e.target.value.replace(/\D/g, ""))}
                            className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            placeholder="1000"
                          />
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={batchCount}
                            onChange={(e) => setBatchCount(e.target.value)}
                            className="w-16 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={handleGenerateBatchExtensions}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${bg} ${hover} text-white text-xs font-extrabold cursor-pointer shrink-0`}
                          >
                            <Plus size={13} />
                            <span>Seri Ekle</span>
                          </button>
                        </div>
                      </div>

                      {initialExtensions.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {initialExtensions.map((item, idx) => (
                            <div
                              key={`${item.extension}-${idx}`}
                              className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                            >
                              <input
                                type="text"
                                value={item.extension}
                                onChange={(e) => {
                                  const cp = [...initialExtensions];
                                  cp[idx] = { ...cp[idx], extension: e.target.value.replace(/\D/g, "") };
                                  setInitialExtensions(cp);
                                }}
                                className="col-span-3 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              />
                              <input
                                type="text"
                                value={item.full_name}
                                onChange={(e) => {
                                  const cp = [...initialExtensions];
                                  cp[idx] = { ...cp[idx], full_name: e.target.value };
                                  setInitialExtensions(cp);
                                }}
                                placeholder="Ad Soyad"
                                className="col-span-5 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              />
                              <input
                                type="email"
                                value={item.email}
                                onChange={(e) => {
                                  const cp = [...initialExtensions];
                                  cp[idx] = { ...cp[idx], email: e.target.value };
                                  setInitialExtensions(cp);
                                }}
                                placeholder="E-posta (opsiyonel)"
                                className="col-span-3 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => setInitialExtensions((prev) => prev.filter((_, i) => i !== idx))}
                                className="col-span-1 flex justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STEP 5: TIMEZONE, DATE/TIME FORMAT & DEFAULT LANGUAGE    */}
                {/* -------------------------------------------------------- */}
                {step === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock size={20} className={text} />
                        5. Sistem Saat Dilimi, Tarih Formatı &amp; Varsayılan Dil
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Santral sunucu saati, NTP zaman sunucusu, tarih/saat gösterim biçimi ve sistem varsayılan dilini belirleyin. Bu ayarlar tüm IP telefonlara da otomatik uygulanır.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                            Sistem Saat Dilimi
                          </label>
                          <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={tzSearch}
                              onChange={(e) => setTzSearch(e.target.value)}
                              placeholder="Saat dilimi ara (örn: Istanbul, UTC+3)..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </div>
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          >
                            {filteredTimezones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setNtpEnabled(true)}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                              ntpEnabled
                                ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                                : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40"
                            }`}
                          >
                            <div className="text-xs font-extrabold">Otomatik NTP</div>
                            <div className="text-[10px] opacity-75">Önerilen senkronizasyon</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNtpEnabled(false)}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                              !ntpEnabled
                                ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                                : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40"
                            }`}
                          >
                            <div className="text-xs font-extrabold">Manuel Tarih / Saat</div>
                            <div className="text-[10px] opacity-75">Kapalı ağlar için</div>
                          </button>
                        </div>

                        {ntpEnabled ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                Birincil NTP Sunucusu
                              </label>
                              <input
                                type="text"
                                value={ntpPrimary}
                                onChange={(e) => setNtpPrimary(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                Yedek NTP Sunucusu
                              </label>
                              <input
                                type="text"
                                value={ntpSecondary}
                                onChange={(e) => setNtpSecondary(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Manuel Sunucu Tarih ve Saati
                            </label>
                            <input
                              type="datetime-local"
                              value={manualDatetime}
                              onChange={(e) => setManualDatetime(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Calendar size={13} className={text} />
                            Tarih Formatı
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "DD.MM.YYYY", ex: "22.11.2026" },
                              { id: "DD/MM/YYYY", ex: "22/11/2026" },
                              { id: "YYYY-MM-DD", ex: "2026-11-22" },
                              { id: "MM/DD/YYYY", ex: "11/22/2026" },
                            ].map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setDateFormat(f.id)}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                  dateFormat === f.id
                                    ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                                    : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40"
                                }`}
                              >
                                <div className="text-xs font-extrabold font-mono">{f.id}</div>
                                <div className="text-[10px] opacity-75">{f.ex}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "24", label: "24 Saat (14:30)" },
                            { id: "12", label: "12 Saat (02:30 PM)" },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setTimeFormat(t.id)}
                              className={`p-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                                timeFormat === t.id
                                  ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Languages size={13} className={text} />
                            Sistem Varsayılan Dili
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {[
                              { id: "Turkish", title: "Türkçe", desc: "Varsayılan Dil" },
                              { id: "English", title: "English", desc: "Default Language" },
                            ].map((l) => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => setDefaultLanguage(l.id)}
                                className={`p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                                  defaultLanguage === l.id
                                    ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                                    : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40"
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-extrabold">{l.title}</div>
                                  <div className="text-[10px] opacity-75">{l.desc}</div>
                                </div>
                                {defaultLanguage === l.id && <Check size={14} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STEP 6: SUMMARY & APPLY                                  */}
                {/* -------------------------------------------------------- */}
                {step === 6 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle2 size={20} className={text} />
                        6. Tüm Ayarların Özeti &amp; Kurulumu Tamamla
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Aşağıdaki tüm yapılandırmayı gözden geçirin. Herhangi bir bölümü değiştirmek için sağ üstündeki <strong>Düzenle</strong> butonuna tıklayabilirsiniz.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Summary 1: Network */}
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Network size={14} className={text} /> 1. Ağ &amp; NAT
                          </span>
                          <button type="button" onClick={() => setStep(1)} className={`text-[11px] font-bold ${text} hover:underline flex items-center gap-1 cursor-pointer`}>
                            <Edit2 size={11} /> Düzenle
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                          <div>LAN IP: <strong>{localIp || "Otomatik"}</strong></div>
                          <div>Gateway: <strong>{defaultGateway || "-"}</strong> • DNS: <strong>{dnsPrimary}</strong></div>
                          <div>NAT: <strong>{natEnabled ? `Aktif (${natExternIp || "Otomatik"})` : "Kapalı"}</strong></div>
                        </div>
                      </div>

                      {/* Summary 2: License */}
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <KeyRound size={14} className={text} /> 2. Lisans
                          </span>
                          <button type="button" onClick={() => setStep(2)} className={`text-[11px] font-bold ${text} hover:underline flex items-center gap-1 cursor-pointer`}>
                            <Edit2 size={11} /> Düzenle
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                          <div>Firma: <strong>{companyName || "Belirtilmedi"}</strong></div>
                          <div className="font-mono">Donanım ID: <strong>{resolvedHardwareId}</strong></div>
                          <div className="font-mono truncate">
                            Anahtar: <strong>{licenseKey ? licenseKey : "Sonra girilecek"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Summary 3: FQDN */}
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Globe size={14} className={text} /> 3. FQDN &amp; Uzak Erişim
                          </span>
                          <button type="button" onClick={() => setStep(3)} className={`text-[11px] font-bold ${text} hover:underline flex items-center gap-1 cursor-pointer`}>
                            <Edit2 size={11} /> Düzenle
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                          <div>
                            Mod:{" "}
                            <strong>
                              {fqdnMode === "nornia_cloud"
                                ? "Nornia Bulut FQDN (SIP Edge)"
                                : fqdnMode === "custom_fqdn"
                                ? "Özel Kurumsal FQDN"
                                : "Sadece Yerel Ağ (LAN)"}
                            </strong>
                          </div>
                          <div className="font-mono">Adres: <strong>{effectiveFqdnDisplay}</strong></div>
                        </div>
                      </div>

                      {/* Summary 4: Numbering Plan */}
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Hash size={14} className={text} /> 4. Dahili &amp; Numara Planı
                          </span>
                          <button type="button" onClick={() => setStep(4)} className={`text-[11px] font-bold ${text} hover:underline flex items-center gap-1 cursor-pointer`}>
                            <Edit2 size={11} /> Düzenle
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                          <div>Dahililer: <strong>{extStart}–{extEnd}</strong> • Kuyruk: <strong>{queueStart}–{queueEnd}</strong></div>
                          <div>Çekme: <strong>{pickupGroup} / {pickupDirected}</strong> • Sesli Posta: <strong>{voicemailCode}</strong></div>
                          <div>Oluşturulacak Yeni Dahili: <strong>{initialExtensions.length} adet</strong></div>
                        </div>
                      </div>

                      {/* Summary 5: Date, Timezone & Language */}
                      <div className="md:col-span-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Clock size={14} className={text} /> 5. Saat Dilimi, Tarih Formatı &amp; Dil
                          </span>
                          <button type="button" onClick={() => setStep(5)} className={`text-[11px] font-bold ${text} hover:underline flex items-center gap-1 cursor-pointer`}>
                            <Edit2 size={11} /> Düzenle
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-6 gap-y-1">
                          <span>Saat Dilimi: <strong>{selectedTzObj?.label || timezone}</strong></span>
                          <span>Senkron: <strong>{ntpEnabled ? `NTP (${ntpPrimary})` : `Manuel (${manualDatetime || "-"})`}</strong></span>
                          <span>Format: <strong className="font-mono">{dateFormat} • {timeFormat}s</strong></span>
                          <span>Varsayılan Dil: <strong>{defaultLanguage === "English" ? "English" : "Türkçe"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Account & Password Setup (Required on Fresh Install) */}
                    <div className={`p-5 rounded-2xl border-2 ${isFreshInstall ? border : borderLight} ${lightBg} space-y-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Lock size={15} className={text} />
                            Sistem Yöneticisi (admin) Hesabı &amp; İlk Giriş Şifresi
                            {isFreshInstall ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold">
                                Zorunlu
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                                Opsiyonel
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            {isFreshInstall
                              ? "Kurulum tamamlandığında sisteme ilk kez 'admin' kullanıcı adı ve aşağıda belirleyeceğiniz şifre ile giriş yapacaksınız."
                              : "Mevcut admin şifresini değiştirmek istemiyorsanız şifre alanlarını boş bırakabilirsiniz."}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-black text-slate-800 dark:text-white shrink-0">
                          Kullanıcı Adı: <span className={text}>admin</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Yönetici Ad Soyad
                          </label>
                          <input
                            type="text"
                            value={adminFullName}
                            onChange={(e) => setAdminFullName(e.target.value)}
                            placeholder="Sistem Yöneticisi"
                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Yönetici E-Posta <span className="font-normal text-slate-400">(Şifre kurtarma &amp; bildirimler)</span>
                          </label>
                          <input
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@sirketiniz.com"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Yönetici Şifresi {isFreshInstall && <span className="text-rose-500">*</span>}
                          </label>
                          <div className="relative">
                            <input
                              type={showAdminPwd ? "text" : "password"}
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              placeholder={isFreshInstall ? "En az 6 karakter güçlü şifre belirleyin" : "Değiştirmek için yeni şifre girin"}
                              className="w-full pl-3 pr-9 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPwd((v) => !v)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title={showAdminPwd ? "Gizle" : "Göster"}
                            >
                              {showAdminPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          {adminPassword && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div className={`h-full transition-all ${passwordStrength.bar}`} />
                              </div>
                              <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                                {passwordStrength.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Yönetici Şifresi (Tekrar) {isFreshInstall && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type={showAdminPwd ? "text" : "password"}
                            value={adminPasswordConfirm}
                            onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                            placeholder="Şifreyi tekrar giriniz"
                            className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          {adminPasswordConfirm && adminPassword !== adminPasswordConfirm && (
                            <p className="text-[10px] font-bold text-rose-500 mt-1">Şifreler eşleşmiyor.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Navigation */}
              <div className="px-6 sm:px-8 py-4 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={step === 1 || submitting}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft size={15} />
                  <span>Geri</span>
                </button>

                <div className="flex items-center gap-2.5">
                  {step < 6 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.min(6, s + 1))}
                      className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer`}
                    >
                      <span>İleri</span>
                      <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleCompleteSetup}
                      className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50`}
                    >
                      {submitting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      <span>{submitting ? "Kurulum Uygulanıyor..." : "Ayarları Uygula ve Kurulumu Tamamla"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
