import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  GitBranch,
  Database,
  Terminal,
  Play,
  Square,
  Trash2,
  Download,
  Search,
  RefreshCw,
  Copy,
  Check,
  Code,
  Save,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  ChevronRight,
  HardDrive
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import SipDebuggerPanel from "./SipDebuggerPanel";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const TROUBLESHOOTING_TABS = [
  {
    id: "ping",
    label: "Ping",
    subtitle: "Gecikme (RTT), Jitter & Paket Kaybı",
    icon: Activity
  },
  {
    id: "traceroute",
    label: "Traceroute",
    subtitle: "Ağ Rotası & Hop Analizi",
    icon: GitBranch
  },
  {
    id: "sip-capture",
    label: "SIP Capture Yakalama",
    subtitle: "Canlı Paket Yakalama & PCAP Kayıt",
    icon: Database
  },
  {
    id: "sngrep",
    label: "sngrep",
    subtitle: "Çağrı Akış Diyagramı (Ladder View)",
    icon: Terminal
  }
];

export default function TroubleshootingPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const [activeTab, setActiveTab] = useState("ping");
  const tabRefs = useRef({});

  // Role Permission Enforcement
  const [hasPermission, setHasPermission] = useState(true);

  // Shared Preset Targets
  const [presetTargets, setPresetTargets] = useState([]);

  // 1. Ping State
  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [pingCount, setPingCount] = useState("4");
  const [pingPacketSize, setPingPacketSize] = useState("56");
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState("");
  const [pingResult, setPingResult] = useState(null);
  const [pingCopied, setPingCopied] = useState(false);

  // 2. Traceroute State
  const [traceHost, setTraceHost] = useState("8.8.8.8");
  const [traceMaxHops, setTraceMaxHops] = useState("15");
  const [traceResolveDns, setTraceResolveDns] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState("");
  const [traceResult, setTraceResult] = useState(null);
  const [traceCopied, setTraceCopied] = useState(false);

  // 3. SIP Capture State
  const [capturePackets, setCapturePackets] = useState([]);
  const [totalBuffered, setTotalBuffered] = useState(0);
  const [captureRunning, setCaptureRunning] = useState(true);
  const [filterIp, setFilterIp] = useState("");
  const [filterPort, setFilterPort] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [packetCopied, setPacketCopied] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotLabel, setSnapshotLabel] = useState("sip_analiz");
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isDownloadingCapture, setIsDownloadingCapture] = useState(false);
  const [captureFeedback, setCaptureFeedback] = useState("");
  const [showClearCaptureModal, setShowClearCaptureModal] = useState(false);
  const [deleteSnapshotTarget, setDeleteSnapshotTarget] = useState(null);

  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  const apiBase = `${protocol}//${backendHost}/api/sip-debugger`;

  // Listen for direct subtab jump events (e.g., from GlobalSearchBar)
  useEffect(() => {
    const handleSubTabSwitch = (e) => {
      const target = e?.detail?.subTab;
      if (target && TROUBLESHOOTING_TABS.some((t) => t.id === target)) {
        setActiveTab(target);
      }
    };
    window.addEventListener("SWITCH_TROUBLESHOOTING_SUBTAB", handleSubTabSwitch);
    return () => window.removeEventListener("SWITCH_TROUBLESHOOTING_SUBTAB", handleSubTabSwitch);
  }, []);

  // Verify role permissions
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const savedUserId =
          localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id");
        if (!savedUserId || savedUserId === "admin") {
          setHasPermission(true);
          return;
        }
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?t=${Date.now()}`);
        const usersData = await resUsers.json();
        const currentUser = (Array.isArray(usersData) ? usersData : []).find(
          (u) => String(u.id) === String(savedUserId) || u.extension === savedUserId
        );
        if (!currentUser || currentUser.role === "admin" || currentUser.id === "admin") {
          setHasPermission(true);
          return;
        }
        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles?t=${Date.now()}`);
        const rolesData = await resRoles.json();
        const currentRole = (Array.isArray(rolesData) ? rolesData : []).find(
          (r) => r.role_code === currentUser.role
        );
        if (!currentRole || ["admin", "superadmin"].includes(currentRole.role_code)) {
          setHasPermission(true);
          return;
        }
        const perms = Array.isArray(currentRole.permissions) ? currentRole.permissions : [];
        setHasPermission(
          perms.includes("troubleshooting:access") ||
            perms.includes("sip_debugger:access") ||
            perms.includes("*")
        );
      } catch (e) {
        setHasPermission(true);
      }
    };
    checkAccess();
  }, [backendHost, protocol]);

  // Load quick preset diagnostic targets (SIP Trunks, PBX IP, DNS)
  useEffect(() => {
    const loadTargets = async () => {
      try {
        const res = await fetch(`${apiBase}/diagnostics/targets`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.targets) ? data.targets : [];
          setPresetTargets(list);
          const trunkTarget = list.find((t) => t.category === "trunk");
          if (trunkTarget) {
            setPingHost(trunkTarget.host);
            setTraceHost(trunkTarget.host);
          }
        }
      } catch (e) {
        // ignore fallback
      }
    };
    loadTargets();
  }, [apiBase]);

  // Poll SIP Capture packets when SIP Capture tab is active
  const fetchCapturePackets = async () => {
    try {
      const params = new URLSearchParams();
      if (filterIp.trim()) params.set("ip", filterIp.trim());
      if (filterPort) params.set("port", filterPort);
      if (filterMethod) params.set("method", filterMethod);
      if (filterQuery.trim()) params.set("q", filterQuery.trim());
      params.set("limit", "250");

      const res = await fetch(`${apiBase}/capture/packets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.packets || [];
        setCapturePackets(list);
        setTotalBuffered(data.total_buffered || 0);
        setCaptureRunning(Boolean(data.is_running));
        setSnapshots(data.snapshots || []);
        if (!selectedPacket && list.length > 0) {
          setSelectedPacket(list[0]);
        }
      }
    } catch (e) {
      console.error("SIP capture fetch error:", e);
    }
  };

  useEffect(() => {
    if (activeTab !== "sip-capture") return;
    fetchCapturePackets();
    const timer = setInterval(fetchCapturePackets, 3000);

    let ws = null;
    let pingTimer = null;
    let disposed = false;
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${backendHost}/api/sip-debugger/ws`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 15000);
      };
      ws.onmessage = (evt) => {
        if (disposed || !evt.data || evt.data === "pong") return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "sip_packet" && msg.packet) {
            const pkt = msg.packet;
            setTotalBuffered(msg.total_buffered || 0);
            setCaptureRunning(Boolean(msg.is_running));

            const ipQ = filterIp.trim().toLowerCase();
            const portQ = String(filterPort || "").trim();
            const mQ = String(filterMethod || "").trim().toUpperCase();
            const textQ = filterQuery.trim().toLowerCase();

            if (ipQ && !pkt.src_ip.toLowerCase().includes(ipQ) && !pkt.dst_ip.toLowerCase().includes(ipQ)) {
              return;
            }
            if (portQ && portQ !== String(pkt.src_port) && portQ !== String(pkt.dst_port)) {
              return;
            }
            if (mQ) {
              if (mQ === "ERROR") {
                const st = String(pkt.status || "");
                if (!st.startsWith("4") && !st.startsWith("5") && !st.startsWith("6")) return;
              } else if (
                mQ !== String(pkt.method || "").toUpperCase() &&
                !String(pkt.status || "").toUpperCase().includes(mQ) &&
                !String(pkt.cseq || "").toUpperCase().includes(mQ)
              ) {
                return;
              }
            }
            if (textQ) {
              const hay = `${pkt.call_id} ${pkt.caller} ${pkt.callee} ${pkt.status} ${pkt.raw}`.toLowerCase();
              if (!hay.includes(textQ)) return;
            }

            setCapturePackets((prev) => {
              if (prev.some((p) => p.id === pkt.id)) return prev;
              return [pkt, ...prev].slice(0, 250);
            });
            setSelectedPacket((prev) => prev || pkt);
          }
        } catch (_e) {}
      };
    } catch (_err) {}

    return () => {
      disposed = true;
      clearInterval(timer);
      if (pingTimer) clearInterval(pingTimer);
      if (ws) {
        try {
          ws.close();
        } catch (_e) {}
      }
    };
  }, [activeTab, filterIp, filterPort, filterMethod, filterQuery, backendHost, protocol]);

  // WAI-ARIA Tabs roving tabindex keyboard navigation
  const handleTabKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % TROUBLESHOOTING_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + TROUBLESHOOTING_TABS.length) % TROUBLESHOOTING_TABS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = TROUBLESHOOTING_TABS.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = TROUBLESHOOTING_TABS[nextIdx];
      setActiveTab(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    }
  };

  // Run Ping
  const handleRunPing = async (e) => {
    e.preventDefault();
    const target = pingHost.trim();
    if (!target) {
      setPingError("Lütfen geçerli bir IP adresi veya alan adı girin.");
      return;
    }
    setPingError("");
    setIsPinging(true);
    try {
      const res = await fetch(`${apiBase}/diagnostics/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: target,
          count: parseInt(pingCount, 10) || 4,
          packet_size: parseInt(pingPacketSize, 10) || 56
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPingError(data.detail || "Ping testi başarısız oldu.");
      } else {
        setPingResult(data);
      }
    } catch (err) {
      setPingError("Sunucu ile bağlantı kurulamadı: " + err.message);
    } finally {
      setIsPinging(false);
    }
  };

  // Run Traceroute
  const handleRunTraceroute = async (e) => {
    e.preventDefault();
    const target = traceHost.trim();
    if (!target) {
      setTraceError("Lütfen geçerli bir IP adresi veya alan adı girin.");
      return;
    }
    setTraceError("");
    setIsTracing(true);
    try {
      const res = await fetch(`${apiBase}/diagnostics/traceroute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: target,
          max_hops: parseInt(traceMaxHops, 10) || 15,
          resolve_dns: traceResolveDns
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setTraceError(data.detail || "Traceroute analizi başarısız oldu.");
      } else {
        setTraceResult(data);
      }
    } catch (err) {
      setTraceError("Sunucu ile bağlantı kurulamadı: " + err.message);
    } finally {
      setIsTracing(false);
    }
  };

  // SIP Capture Actions
  const toggleSipCapture = async () => {
    const action = captureRunning ? "stop" : "start";
    try {
      const res = await fetch(`${apiBase}/${action}`, { method: "POST" });
      if (res.ok) {
        setCaptureRunning(!captureRunning);
      }
    } catch (e) {
      console.error("Toggle SIP capture error:", e);
    }
  };

  const handleDownloadFilteredPcap = async () => {
    setIsDownloadingCapture(true);
    setCaptureFeedback("");
    try {
      const params = new URLSearchParams();
      if (filterIp.trim()) params.set("ip", filterIp.trim());
      if (filterPort) params.set("port", filterPort);
      if (filterMethod) params.set("method", filterMethod);
      if (filterQuery.trim()) params.set("q", filterQuery.trim());

      const res = await fetch(`${apiBase}/capture/pcap?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "PCAP dosyası oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sip_capture_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_")}.pcap`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setCaptureFeedback(err.message);
    } finally {
      setIsDownloadingCapture(false);
    }
  };

  const handleSaveSnapshot = async () => {
    setIsSavingSnapshot(true);
    setCaptureFeedback("");
    try {
      const res = await fetch(`${apiBase}/capture/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: snapshotLabel.trim() || "sip_capture",
          ip: filterIp.trim(),
          port: filterPort,
          method: filterMethod,
          q: filterQuery.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Kayıt oluşturulamadı.");
      }
      setSnapshots(data.snapshots || []);
      setCaptureFeedback(`PCAP kaydı arşivlendi: ${data.snapshot?.filename}`);
      setTimeout(() => setCaptureFeedback(""), 4000);
    } catch (err) {
      setCaptureFeedback(err.message);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const handleConfirmClearCapture = async () => {
    try {
      const res = await fetch(`${apiBase}/clear`, { method: "DELETE" });
      if (res.ok) {
        setCapturePackets([]);
        setTotalBuffered(0);
        setSelectedPacket(null);
      }
    } catch (e) {
      console.error("Clear capture error:", e);
    } finally {
      setShowClearCaptureModal(false);
    }
  };

  const handleConfirmDeleteSnapshot = async () => {
    if (!deleteSnapshotTarget) return;
    try {
      const res = await fetch(
        `${apiBase}/capture/snapshots/${encodeURIComponent(deleteSnapshotTarget)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (e) {
      console.error("Delete snapshot error:", e);
    } finally {
      setDeleteSnapshotTarget(null);
    }
  };

  const getPacketBadgeClass = (status) => {
    const st = String(status || "");
    if (st.includes("200") || st === "ACK") {
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40";
    }
    if (st.includes("100") || st.includes("180") || st.includes("183")) {
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40";
    }
    if (st.startsWith("4") || st.startsWith("5") || st.startsWith("6")) {
      return "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40";
    }
    return `${lightBg} ${text} border border-primary/25`;
  };

  const getVoipQualityBadge = (avgMs, lossPercent) => {
    if (lossPercent >= 100 || avgMs == null) {
      return {
        label: "Erişilemiyor",
        cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
      };
    }
    if (lossPercent > 2 || avgMs > 150) {
      return {
        label: "VoIP Riskli (Yüksek Gecikme/Kayıp)",
        cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
      };
    }
    if (lossPercent > 0 || avgMs > 70) {
      return {
        label: "Kabul Edilebilir Ses Kalitesi",
        cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
      };
    }
    return {
      label: "Mükemmel VoIP Kalitesi (HD)",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
    };
  };

  if (!hasPermission) {
    return (
      <div className="w-full p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <ShieldAlert size={36} aria-hidden="true" className="mx-auto text-rose-500" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Erişim Yetkisi Gerekli</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sorun İnceleme araçlarını görüntülemek için rolünüzde bu modül yetkisinin tanımlı olması gerekir.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${lightBg} ${text} border border-primary/20 shadow-sm`}>
            <Activity size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sorun İnceleme
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ağ erişilebilirliği (Ping), yönlendirme rotası (Traceroute), ham SIP paket yakalama (PCAP) ve canlı sngrep diyagramı.
            </p>
          </div>
        </div>
      </div>

      {/* Top Accessible Tab Bar */}
      <div
        role="tablist"
        aria-label="Sorun inceleme araçları"
        className={
          "w-full p-1.5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 " +
          borderLight
        }
      >
        {TROUBLESHOOTING_TABS.map((tab, idx) => {
          const TabIcon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`troubleshooting-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`troubleshooting-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={
                "flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (isSelected
                  ? `${bg} text-white shadow-sm`
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60")
              }
            >
              <div
                className={
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " +
                  (isSelected
                    ? "bg-white/20 text-white"
                    : `${lightBg} ${text}`)
                }
              >
                <TabIcon size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{tab.label}</div>
                <div
                  className={
                    "text-[10px] truncate " +
                    (isSelected ? "text-white/80" : "text-slate-400 dark:text-slate-500")
                  }
                >
                  {tab.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PING */}
      {activeTab === "ping" && (
        <div
          role="tabpanel"
          id="troubleshooting-panel-ping"
          aria-labelledby="troubleshooting-tab-ping"
          className="space-y-5 animate-in fade-in duration-200"
        >
          <form
            method="POST"
            action={`${apiBase}/diagnostics/ping`}
            onSubmit={handleRunPing}
            className={
              "p-5 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-4 " +
              borderLight
            }
          >
            {presetTargets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Hızlı Hedefler:
                </span>
                {presetTargets.map((t) => (
                  <button
                    key={`${t.label}-${t.host}`}
                    type="button"
                    onClick={() => {
                      setPingHost(t.host);
                      setPingError("");
                    }}
                    className={
                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " +
                      (pingHost === t.host
                        ? `${lightBg} ${text} border-primary/30`
                        : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800")
                    }
                  >
                    {t.label} ({t.host})
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label
                  htmlFor="ping-target-host"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Hedef IP Adresi veya Alan Adı
                </label>
                <input
                  id="ping-target-host"
                  name="host"
                  type="text"
                  required
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Örn: 8.8.8.8 veya sip.operator.com"
                  value={pingHost}
                  onChange={(e) => {
                    setPingHost(e.target.value);
                    if (pingError) setPingError("");
                  }}
                  className={`w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>

              <fieldset className="md:col-span-3">
                <legend className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Paket Sayısı
                </legend>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {["4", "6", "10"].map((cnt) => (
                    <label
                      key={cnt}
                      htmlFor={`ping-cnt-${cnt}`}
                      className={
                        "cursor-pointer text-center py-1.5 rounded-lg text-xs font-bold transition " +
                        (pingCount === cnt
                          ? `${bg} text-white shadow-sm`
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")
                      }
                    >
                      <input
                        id={`ping-cnt-${cnt}`}
                        type="radio"
                        name="count"
                        value={cnt}
                        checked={pingCount === cnt}
                        onChange={(e) => setPingCount(e.target.value)}
                        className="sr-only"
                      />
                      {cnt} Pkt
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="md:col-span-2">
                <legend className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Boyut (Byte)
                </legend>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {["56", "512"].map((sz) => (
                    <label
                      key={sz}
                      htmlFor={`ping-sz-${sz}`}
                      className={
                        "cursor-pointer text-center py-1.5 rounded-lg text-xs font-bold transition " +
                        (pingPacketSize === sz
                          ? `${bg} text-white shadow-sm`
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")
                      }
                    >
                      <input
                        id={`ping-sz-${sz}`}
                        type="radio"
                        name="packet_size"
                        value={sz}
                        checked={pingPacketSize === sz}
                        onChange={(e) => setPingPacketSize(e.target.value)}
                        className="sr-only"
                      />
                      {sz}B
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isPinging}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition ${bg} ${hover} disabled:opacity-60`}
                >
                  {isPinging ? (
                    <RefreshCw size={14} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  <span>{isPinging ? "Ölçülüyor..." : "Ping Başlat"}</span>
                </button>
              </div>
            </div>

            <div aria-live="polite">
              {pingError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>{pingError}</span>
                </div>
              )}
            </div>
          </form>

          {pingResult && (
            <div className="space-y-5">
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  className={
                    "p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm " +
                    borderLight
                  }
                >
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Paket Kaybı & Durum
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      %{pingResult.summary?.loss_percent ?? 0}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {pingResult.summary?.received}/{pingResult.summary?.transmitted} yanıt
                    </span>
                  </div>
                  <div className="mt-2">
                    {(() => {
                      const q = getVoipQualityBadge(
                        pingResult.summary?.avg_ms,
                        pingResult.summary?.loss_percent
                      );
                      return (
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${q.cls}`}>
                          {q.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div
                  className={
                    "p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm " +
                    borderLight
                  }
                >
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Ortalama Gecikme (Avg RTT)
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {pingResult.summary?.avg_ms != null ? `${pingResult.summary.avg_ms} ms` : "—"}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Hedef: {pingResult.host}
                  </p>
                </div>

                <div
                  className={
                    "p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm " +
                    borderLight
                  }
                >
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    VoIP Jitter / Sapma (mdev)
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {pingResult.summary?.jitter_ms != null
                      ? `${pingResult.summary.jitter_ms} ms`
                      : "—"}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    RTP ses kararlılığı için &lt; 20 ms önerilir
                  </p>
                </div>

                <div
                  className={
                    "p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm " +
                    borderLight
                  }
                >
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Min / Max Gecikme
                  </div>
                  <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {pingResult.summary?.min_ms != null
                      ? `${pingResult.summary.min_ms} / ${pingResult.summary.max_ms} ms`
                      : "—"}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Toplam süre: {pingResult.duration_ms} ms
                  </p>
                </div>
              </div>

              {/* Per-Packet Sequence Breakdown + Raw Terminal Output */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div
                  className={
                    "lg:col-span-5 p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-3 " +
                    borderLight
                  }
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ICMP Paket Yanıt Dökümü
                  </h3>
                  {pingResult.replies?.length > 0 ? (
                    <div className="space-y-2">
                      {pingResult.replies.map((r) => {
                        const maxRef = Math.max(pingResult.summary?.max_ms || 1, 1);
                        const pct = Math.min(100, Math.max(8, Math.round((r.time_ms / maxRef) * 100)));
                        return (
                          <div
                            key={r.seq}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                #{r.seq} • {r.from}
                              </span>
                              <span className={`font-bold ${text}`}>{r.time_ms} ms</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${bg}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Boyut: {r.bytes} Byte • TTL: {r.ttl}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Hedeften ICMP yanıtı alınamadı (%100 kayıp veya güvenlik duvarı engeli).
                    </p>
                  )}
                </div>

                <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                    <span className="text-xs font-mono text-slate-300 flex items-center gap-2">
                      <Terminal size={14} aria-hidden="true" className={text} />
                      <span>Konsol Çıktısı (ping {pingResult.host})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pingResult.raw_output || "");
                        setPingCopied(true);
                        setTimeout(() => setPingCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                    >
                      {pingCopied ? (
                        <Check size={13} aria-hidden="true" className="text-emerald-400" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      <span>{pingCopied ? "Kopyalandı" : "Çıktıyı Kopyala"}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    {pingResult.raw_output}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRACEROUTE */}
      {activeTab === "traceroute" && (
        <div
          role="tabpanel"
          id="troubleshooting-panel-traceroute"
          aria-labelledby="troubleshooting-tab-traceroute"
          className="space-y-5 animate-in fade-in duration-200"
        >
          <form
            method="POST"
            action={`${apiBase}/diagnostics/traceroute`}
            onSubmit={handleRunTraceroute}
            className={
              "p-5 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-4 " +
              borderLight
            }
          >
            {presetTargets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Hızlı Hedefler:
                </span>
                {presetTargets.map((t) => (
                  <button
                    key={`tr-${t.label}-${t.host}`}
                    type="button"
                    onClick={() => {
                      setTraceHost(t.host);
                      setTraceError("");
                    }}
                    className={
                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " +
                      (traceHost === t.host
                        ? `${lightBg} ${text} border-primary/30`
                        : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800")
                    }
                  >
                    {t.label} ({t.host})
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label
                  htmlFor="trace-target-host"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Hedef IP Adresi veya Alan Adı
                </label>
                <input
                  id="trace-target-host"
                  name="host"
                  type="text"
                  required
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Örn: 8.8.8.8 veya sip.operator.com"
                  value={traceHost}
                  onChange={(e) => {
                    setTraceHost(e.target.value);
                    if (traceError) setTraceError("");
                  }}
                  className={`w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>

              <fieldset className="md:col-span-3">
                <legend className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Maksimum Hop (Sıçrama)
                </legend>
                <div className="grid grid-cols-4 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {["10", "15", "20", "30"].map((mh) => (
                    <label
                      key={mh}
                      htmlFor={`trace-mh-${mh}`}
                      className={
                        "cursor-pointer text-center py-1.5 rounded-lg text-xs font-bold transition " +
                        (traceMaxHops === mh
                          ? `${bg} text-white shadow-sm`
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white")
                      }
                    >
                      <input
                        id={`trace-mh-${mh}`}
                        type="radio"
                        name="max_hops"
                        value={mh}
                        checked={traceMaxHops === mh}
                        onChange={(e) => setTraceMaxHops(e.target.value)}
                        className="sr-only"
                      />
                      {mh}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="md:col-span-2 flex items-center h-[38px]">
                <label
                  htmlFor="trace-resolve-dns"
                  className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none"
                >
                  <input
                    id="trace-resolve-dns"
                    name="resolve_dns"
                    type="checkbox"
                    checked={traceResolveDns}
                    onChange={(e) => setTraceResolveDns(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700"
                  />
                  <span>DNS Çözümle</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isTracing}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition ${bg} ${hover} disabled:opacity-60`}
                >
                  {isTracing ? (
                    <RefreshCw size={14} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <GitBranch size={14} aria-hidden="true" />
                  )}
                  <span>{isTracing ? "İzleniyor..." : "Rota Analizi"}</span>
                </button>
              </div>
            </div>

            <div aria-live="polite">
              {traceError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>{traceError}</span>
                </div>
              )}
            </div>
          </form>

          {traceResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Visual Hop Table */}
              <div
                className={
                  "lg:col-span-7 p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-3 " +
                  borderLight
                }
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ağ Geçidi (Hop) Rotası ({traceResult.hops?.length || 0} Adım)
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Süre: {traceResult.duration_ms} ms
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <caption className="sr-only">
                      {traceResult.host} hedefi için traceroute sıçrama tablosu
                    </caption>
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                        <th scope="col" className="py-2 pr-3">Hop</th>
                        <th scope="col" className="py-2 px-3">Düğüm / IP</th>
                        <th scope="col" className="py-2 px-3">Ölçümler</th>
                        <th scope="col" className="py-2 pl-3 text-right">Ortalama</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs font-mono">
                      {traceResult.hops?.map((h) => (
                        <tr key={h.hop} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 pr-3 font-bold text-slate-500">#{h.hop}</td>
                          <td className="py-2.5 px-3">
                            {h.is_timeout ? (
                              <span className="text-slate-400 italic">
                                * * * (Yanıt Yok / ICMP Filtreli)
                              </span>
                            ) : (
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                  {h.host}
                                </span>
                                {h.ip && h.ip !== h.host && (
                                  <span className="ml-1.5 text-[11px] text-slate-400">
                                    ({h.ip})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500">
                            {h.rtts_ms?.length > 0
                              ? h.rtts_ms.map((v) => `${v} ms`).join(" / ")
                              : "—"}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {h.avg_ms != null ? (
                              <span
                                className={
                                  "px-2 py-0.5 rounded-md text-[11px] font-bold " +
                                  (h.avg_ms > 120
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                    : h.avg_ms > 50
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400")
                                }
                              >
                                {h.avg_ms} ms
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw Traceroute Console */}
              <div className="lg:col-span-5 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                  <span className="text-xs font-mono text-slate-300 flex items-center gap-2">
                    <Terminal size={14} aria-hidden="true" className={text} />
                    <span>Konsol Çıktısı (traceroute)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(traceResult.raw_output || "");
                      setTraceCopied(true);
                      setTimeout(() => setTraceCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                  >
                    {traceCopied ? (
                      <Check size={13} aria-hidden="true" className="text-emerald-400" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                    <span>{traceCopied ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {traceResult.raw_output}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SIP CAPTURE YAKALAMA */}
      {activeTab === "sip-capture" && (
        <div
          role="tabpanel"
          id="troubleshooting-panel-sip-capture"
          aria-labelledby="troubleshooting-tab-sip-capture"
          className="space-y-5 animate-in fade-in duration-200"
        >
          {/* Capture Control & Filter Card */}
          <div
            className={
              "p-5 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-4 " +
              borderLight
            }
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Canlı SIP Paket Yakalayıcı (Packet Sniffer & PCAP Kaydedici)
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    captureRunning
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      captureRunning ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  {captureRunning ? "Yakalama Aktif" : "Duraklatıldı"}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Tampon: {capturePackets.length} / {totalBuffered} paket
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSipCapture}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    captureRunning
                      ? "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      : `${bg} ${hover} text-white shadow-sm`
                  }`}
                >
                  {captureRunning ? (
                    <Square size={13} aria-hidden="true" />
                  ) : (
                    <Play size={13} aria-hidden="true" />
                  )}
                  <span>{captureRunning ? "Yakalamayı Durdur" : "Yakalamayı Başlat"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFilteredPcap}
                  disabled={isDownloadingCapture || capturePackets.length === 0}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition ${bg} ${hover} disabled:opacity-50`}
                >
                  <Download size={13} aria-hidden="true" />
                  <span>{isDownloadingCapture ? "Hazırlanıyor..." : "Tümünü .PCAP İndir"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearCaptureModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-bold transition border border-rose-200 dark:border-rose-900/40"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Temizle</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-3">
                <label
                  htmlFor="cap-filter-ip"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Kaynak / Hedef IP Filtresi
                </label>
                <input
                  id="cap-filter-ip"
                  name="ip"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Örn: 192.168.1.50 veya 185.88."
                  value={filterIp}
                  onChange={(e) => setFilterIp(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="cap-filter-port"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Port
                </label>
                <select
                  id="cap-filter-port"
                  name="port"
                  value={filterPort}
                  onChange={(e) => setFilterPort(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                >
                  <option value="">Tüm Portlar (5060/5061/8089)</option>
                  <option value="5060">5060 (UDP/TCP SIP)</option>
                  <option value="5061">5061 (TLS SIP)</option>
                  <option value="8089">8089 (WebRTC WSS)</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="cap-filter-method"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                >
                  SIP Metot / Durum
                </label>
                <select
                  id="cap-filter-method"
                  name="method"
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                >
                  <option value="">Tümü</option>
                  <option value="INVITE">INVITE</option>
                  <option value="REGISTER">REGISTER</option>
                  <option value="OPTIONS">OPTIONS (Keepalive)</option>
                  <option value="BYE">BYE</option>
                  <option value="CANCEL">CANCEL</option>
                  <option value="ERROR">4xx / 5xx / 6xx Hatalar</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label
                  htmlFor="cap-filter-query"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Paket İçeriği / Numara Ara
                </label>
                <input
                  id="cap-filter-query"
                  name="q"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Numara, User-Agent, SDP..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>

              <div className="lg:col-span-2 flex items-center gap-1.5">
                <input
                  id="cap-snapshot-label"
                  name="snapshot_label"
                  type="text"
                  aria-label="PCAP kayıt etiketi"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Kayıt adı"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  className="w-24 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={isSavingSnapshot || capturePackets.length === 0}
                  title="Yakalanan paketleri sunucuya PCAP dosyası olarak arşivle"
                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
                >
                  <Save size={13} aria-hidden="true" />
                  <span>Arşivle</span>
                </button>
              </div>
            </div>

            <div aria-live="polite">
              {captureFeedback && (
                <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${lightBg} ${text}`}>
                  {captureFeedback}
                </div>
              )}
            </div>
          </div>

          {/* Packet Stream Table + Raw Packet Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div
              className={
                "lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm flex flex-col h-[560px] " +
                borderLight
              }
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Kronolojik SIP Paket Akışı ({capturePackets.length})
                </h4>
                <button
                  type="button"
                  onClick={fetchCapturePackets}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span>Yenile</span>
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                {capturePackets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-12">
                    <Database size={34} aria-hidden="true" className="mb-2 opacity-40" />
                    <p className="text-xs font-medium">Eşleşen SIP paketi bulunamadı.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <caption className="sr-only">Yakalanan ham SIP paketleri listesi</caption>
                    <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                        <th scope="col" className="py-2 pr-2">#</th>
                        <th scope="col" className="py-2 px-2">Zaman</th>
                        <th scope="col" className="py-2 px-2">Kaynak → Hedef</th>
                        <th scope="col" className="py-2 px-2">Durum / Metot</th>
                        <th scope="col" className="py-2 px-2">Arayan → Aranan</th>
                        <th scope="col" className="py-2 pl-2 text-right">Boyut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[11px] font-mono">
                      {capturePackets.map((pkt) => {
                        const isSelected = selectedPacket?.id === pkt.id;
                        return (
                          <tr
                            key={pkt.id}
                            onClick={() => setSelectedPacket(pkt)}
                            className={
                              "cursor-pointer transition " +
                              (isSelected
                                ? `${lightBg}`
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50")
                            }
                          >
                            <td className="py-2 pr-2 text-slate-400">{pkt.id}</td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">
                              {pkt.timestamp}
                            </td>
                            <td className="py-2 px-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {pkt.src_ip}:{pkt.src_port} → {pkt.dst_ip}:{pkt.dst_port}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPacketBadgeClass(
                                  pkt.status
                                )}`}
                              >
                                {pkt.status}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                              {pkt.caller} → {pkt.callee}
                            </td>
                            <td className="py-2 pl-2 text-right text-slate-400 whitespace-nowrap">
                              {pkt.length} B
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right Column: Selected Packet Frame Inspector + Saved PCAP Snapshots */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col h-[360px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <Code size={14} aria-hidden="true" className={text} />
                    <span>
                      {selectedPacket
                        ? `Paket #${selectedPacket.id} (${selectedPacket.protocol} • ${selectedPacket.status})`
                        : "Ham SIP & SDP Paket İnceleyici"}
                    </span>
                  </div>
                  {selectedPacket && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedPacket.raw || "");
                        setPacketCopied(true);
                        setTimeout(() => setPacketCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                    >
                      {packetCopied ? (
                        <Check size={13} aria-hidden="true" className="text-emerald-400" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      <span>{packetCopied ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  )}
                </div>

                {selectedPacket ? (
                  <pre className="flex-1 overflow-auto text-[11px] font-mono text-emerald-400 bg-slate-900/80 p-3 rounded-xl custom-scrollbar whitespace-pre-wrap select-all">
                    {selectedPacket.raw}
                  </pre>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                    Detaylarını görmek için tablodan bir SIP paketi seçin.
                  </div>
                )}
              </div>

              {/* Saved PCAP Archives */}
              <div
                className={
                  "bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm flex-1 " +
                  borderLight
                }
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <HardDrive size={14} aria-hidden="true" className={text} />
                  <span>Arşivlenmiş PCAP Kayıtları ({snapshots.length})</span>
                </h4>

                {snapshots.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Henüz arşivlenmiş bir .pcap kaydı bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.filename}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
                            {snap.filename}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {snap.created_at} • {(snap.size_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`${apiBase}/capture/snapshots/${encodeURIComponent(snap.filename)}`}
                            download={snap.filename}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${lightBg} ${text} border border-primary/25 hover:opacity-90 flex items-center gap-1`}
                          >
                            <Download size={12} aria-hidden="true" />
                            <span>İndir</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setDeleteSnapshotTarget(snap.filename)}
                            aria-label={`${snap.filename} kaydını sil`}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Kaydı Sil"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SNGREP (Existing Feature) */}
      {activeTab === "sngrep" && (
        <div
          role="tabpanel"
          id="troubleshooting-panel-sngrep"
          aria-labelledby="troubleshooting-tab-sngrep"
          className="animate-in fade-in duration-200"
        >
          <SipDebuggerPanel backendHost={backendHost} embedded />
        </div>
      )}

      {/* Custom Delete Confirmation Modals */}
      {showClearCaptureModal && (
        <ConfirmDeleteModal
          isOpen={showClearCaptureModal}
          onClose={() => setShowClearCaptureModal(false)}
          onConfirm={handleConfirmClearCapture}
          title="Yakalanan SIP Paketlerini Temizle"
          description="Bellekte yakalanan tüm ham SIP paketleri ve çağrı izleri sıfırlanacaktır. Bu işlem geri alınamaz."
        />
      )}

      {deleteSnapshotTarget && (
        <ConfirmDeleteModal
          isOpen={Boolean(deleteSnapshotTarget)}
          onClose={() => setDeleteSnapshotTarget(null)}
          onConfirm={handleConfirmDeleteSnapshot}
          title="PCAP Kaydını Sil"
          description={`"${deleteSnapshotTarget}" adlı arşivlenmiş PCAP dosyası sunucudan kalıcı olarak silinecektir.`}
        />
      )}
    </div>
  );
}
