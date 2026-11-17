import React, { useState, useEffect, useCallback } from "react";
import {
  Network,
  Server,
  Globe,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Lock,
  RotateCcw,
  Clock,
  Route,
  HardDrive,
  PhoneCall,
  X,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function ServerNetworkSettingsPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"],
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [activeTab, setActiveTab] = useState("interfaces"); // "interfaces" | "routes" | "dns_hosts" | "backups_console"
  const [loading, setLoading] = useState(true);
  const [osPlatform, setOsPlatform] = useState("Linux");
  const [interfaces, setInterfaces] = useState([]);
  const [selectedIfaceName, setSelectedIfaceName] = useState("");
  const [ifaceDraft, setIfaceDraft] = useState({
    interface: "",
    mode: "static",
    primary_cidr: "",
    gateway: "",
    secondary_cidrs: [],
    mtu: 1500,
    enable_rollback_guard: true,
  });
  const [newSecondaryCidr, setNewSecondaryCidr] = useState("");

  // DNS & Hostname & Hosts state
  const [hostname, setHostname] = useState("");
  const [dns1, setDns1] = useState("8.8.8.8");
  const [dns2, setDns2] = useState("1.1.1.1");
  const [dns3, setDns3] = useState("");
  const [searchDomain, setSearchDomain] = useState("");
  const [hostsList, setHostsList] = useState([]);
  const [newHostIp, setNewHostIp] = useState("");
  const [newHostNames, setNewHostNames] = useState("");
  const [newHostComment, setNewHostComment] = useState("");

  // Routes state
  const [routes, setRoutes] = useState([]);
  const [newRoute, setNewRoute] = useState({
    destination: "",
    gateway: "",
    interface: "",
    metric: 100,
    description: "",
  });
  const [routeToDelete, setRouteToDelete] = useState(null);

  // Backups & Rollback state
  const [backups, setBackups] = useState([]);
  const [pendingRollback, setPendingRollback] = useState(null);
  const [activeCallsCount, setActiveCallsCount] = useState(0);
  const [user2faEnabled, setUser2faEnabled] = useState(false);
  const [consoleCmds, setConsoleCmds] = useState({
    interactive_menu: "sudo python3 /opt/ai-project/backend/scripts/network_recovery.py",
    instant_rollback: "sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --rollback",
    set_static_ip: "sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --set-ip eth0 192.168.1.100/24 192.168.1.1",
  });
  const [copiedKey, setCopiedKey] = useState("");

  // Step-Up Security Confirmation Modal state
  const [securityModalAction, setSecurityModalAction] = useState(null); // { type: 'interface' | 'route' | 'dns_hosts', title: string }
  const [adminPassword, setAdminPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [forceActiveCalls, setForceActiveCalls] = useState(false);
  const [ignoreIpConflict, setIgnoreIpConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [feedback, setFeedback] = useState(null);

  const canWrite =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("server_network:write") ||
    userPermissions.includes("nat:write");
  const canDelete =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("server_network:delete") ||
    userPermissions.includes("nat:delete");

  const showToast = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback((prev) => (prev?.msg === msg ? null : prev));
    }, 5500);
  };

  const fetchNetworkStatus = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/network/status`);
      if (res.ok) {
        const data = await res.json();
        setOsPlatform(data.os_platform || "Linux");
        const ifList = Array.isArray(data.interfaces) ? data.interfaces : [];
        setInterfaces(ifList);
        if (ifList.length > 0) {
          setSelectedIfaceName((prev) => {
            const targetName = prev && ifList.some((x) => x.name === prev) ? prev : ifList[0].name;
            const found = ifList.find((x) => x.name === targetName) || ifList[0];
            if (!prev) {
              setIfaceDraft({
                interface: found.name,
                mode: found.mode || "static",
                primary_cidr: found.primary_cidr || "",
                gateway: found.gateway || "",
                secondary_cidrs: Array.isArray(found.secondary_cidrs) ? found.secondary_cidrs : [],
                mtu: found.mtu || 1500,
                enable_rollback_guard: true,
              });
            }
            return targetName;
          });
        }
        setHostname(data.hostname || "");
        const dList = Array.isArray(data.dns_servers) ? data.dns_servers : [];
        setDns1(dList[0] || "8.8.8.8");
        setDns2(dList[1] || "1.1.1.1");
        setDns3(dList[2] || "");
        setSearchDomain(data.search_domain || "");
        setHostsList(Array.isArray(data.hosts) ? data.hosts : []);
        setRoutes(Array.isArray(data.routes) ? data.routes : []);
        setBackups(Array.isArray(data.backups) ? data.backups : []);
        setPendingRollback(data.pending_rollback || null);
        setActiveCallsCount(Number(data.active_calls_count || 0));
        setUser2faEnabled(Boolean(data.user_2fa_enabled));
        if (data.console_rescue_commands) {
          setConsoleCmds(data.console_rescue_commands);
        }
      }
    } catch (e) {
      console.error("Server network status fetch error:", e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchNetworkStatus(true);
  }, [fetchNetworkStatus]);

  // Countdown timer when pending_rollback is active
  useEffect(() => {
    if (!pendingRollback?.active) return;
    const timer = setInterval(() => {
      setPendingRollback((prev) => {
        if (!prev || prev.remaining_seconds <= 1) {
          fetchNetworkStatus(false);
          return null;
        }
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRollback?.active, fetchNetworkStatus]);

  const handleSelectInterface = (ifaceObj) => {
    setSelectedIfaceName(ifaceObj.name);
    setIfaceDraft({
      interface: ifaceObj.name,
      mode: ifaceObj.mode || "static",
      primary_cidr: ifaceObj.primary_cidr || "",
      gateway: ifaceObj.gateway || "",
      secondary_cidrs: Array.isArray(ifaceObj.secondary_cidrs) ? [...ifaceObj.secondary_cidrs] : [],
      mtu: ifaceObj.mtu || 1500,
      enable_rollback_guard: true,
    });
  };

  const handleAddSecondaryCidr = () => {
    const val = newSecondaryCidr.trim();
    if (!val) return;
    if (!val.includes("/")) {
      showToast("error", "İkincil IP adresini CIDR maskesiyle giriniz (Örn: 10.20.30.2/24).");
      return;
    }
    if (ifaceDraft.secondary_cidrs.includes(val)) {
      showToast("error", "Bu ikincil IP adresi zaten listede mevcut.");
      return;
    }
    setIfaceDraft((prev) => ({
      ...prev,
      secondary_cidrs: [...prev.secondary_cidrs, val],
    }));
    setNewSecondaryCidr("");
  };

  const handleConfirmPendingChanges = async () => {
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/network/confirm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingRollback(null);
        showToast("success", data.message || "Ağ ayarları kalıcı olarak onaylandı.");
        fetchNetworkStatus(false);
      } else {
        showToast("error", data.detail || "Onaylama işlemi başarısız oldu.");
      }
    } catch (e) {
      showToast("error", "Sunucu bağlantı hatası.");
    }
  };

  const handleRevertNetwork = async (filename = "") => {
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/network/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingRollback(null);
        showToast("success", data.message || "Ağ ayarları önceki çalışan yedeğe geri döndürüldü.");
        fetchNetworkStatus(false);
      } else {
        showToast("error", data.detail || "Geri yükleme başarısız oldu.");
      }
    } catch (e) {
      showToast("error", "Geri yükleme sırasında hata oluştu.");
    }
  };

  const handleExecuteSecuredAction = async (e) => {
    e.preventDefault();
    if (!securityModalAction) return;
    setSubmitting(true);
    try {
      if (securityModalAction.type === "interface") {
        const dnsArr = [dns1, dns2, dns3].map((x) => x.trim()).filter(Boolean);
        const res = await tenantFetch(`${API_BASE}/api/settings/network/interface`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...ifaceDraft,
            dns_servers: dnsArr,
            admin_password: adminPassword,
            otp_code: otpCode,
            force_active_calls: forceActiveCalls,
            ignore_ip_conflict: ignoreIpConflict,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast("success", data.message || "Ağ arayüzü ayarları uygulandı.");
          setSecurityModalAction(null);
          setAdminPassword("");
          setOtpCode("");
          fetchNetworkStatus(false);
        } else {
          showToast("error", data.detail || "Ağ arayüzü güncellenemedi.");
        }
      } else if (securityModalAction.type === "route") {
        const res = await tenantFetch(`${API_BASE}/api/settings/network/routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newRoute,
            interface: newRoute.interface || selectedIfaceName || "eth0",
            admin_password: adminPassword,
            otp_code: otpCode,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast("success", data.message || "Statik rota başarıyla eklendi.");
          setNewRoute({ destination: "", gateway: "", interface: "", metric: 100, description: "" });
          setSecurityModalAction(null);
          setAdminPassword("");
          setOtpCode("");
          fetchNetworkStatus(false);
        } else {
          showToast("error", data.detail || "Statik rota eklenemedi.");
        }
      } else if (securityModalAction.type === "dns_hosts") {
        const customHosts = hostsList.filter((h) => !h.is_system);
        const dnsArr = [dns1, dns2, dns3].map((x) => x.trim()).filter(Boolean);
        const res = await tenantFetch(`${API_BASE}/api/settings/network/dns-hosts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostname,
            dns_servers: dnsArr,
            search_domain: searchDomain,
            custom_hosts: customHosts,
            admin_password: adminPassword,
            otp_code: otpCode,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast("success", data.message || "DNS, Hostname ve Hosts ayarları kaydedildi.");
          setSecurityModalAction(null);
          setAdminPassword("");
          setOtpCode("");
          fetchNetworkStatus(false);
        } else {
          showToast("error", data.detail || "DNS/Hosts güncellenemedi.");
        }
      }
    } catch (err) {
      showToast("error", "Sunucuya bağlanırken hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteRoute = async () => {
    if (!routeToDelete) return;
    const target = routeToDelete;
    setRouteToDelete(null);
    try {
      const q = `destination=${encodeURIComponent(target.destination || "")}&gateway=${encodeURIComponent(target.gateway || "")}`;
      const res = await tenantFetch(`${API_BASE}/api/settings/network/routes?${q}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", data.message || "Statik rota silindi.");
        fetchNetworkStatus(false);
      } else {
        showToast("error", data.detail || "Rota silinemedi.");
      }
    } catch (e) {
      showToast("error", "Rota silinirken hata oluştu.");
    }
  };

  const copyCmd = (key, textVal) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textVal);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2500);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 60-Second Auto-Rollback Safety Banner */}
      {pendingRollback?.active && (
        <div className="p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500 text-white shrink-0 animate-pulse">
              <Clock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-amber-900 dark:text-amber-200">
                  Erişim Kopması Koruması Aktif — Onay Bekleniyor ({pendingRollback.remaining_seconds} sn)
                </h4>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                <strong>{pendingRollback.interface}</strong> arayüzüne{" "}
                <code className="font-mono font-bold">{pendingRollback.applied_cidr}</code> uygulandı.{" "}
                <strong>{pendingRollback.remaining_seconds} saniye</strong> içinde onaylamazsanız işletim sistemi
                Watchdog servisi otomatik olarak eski çalışan IP ayarlarına geri dönecektir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleConfirmPendingChanges}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Yeni Ayarları Onayla (Kalıcı Yap)</span>
            </button>
            <button
              type="button"
              onClick={() => handleRevertNetwork("")}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Hemen Eski Ayara Dön</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl ${lightBg} ${text} border ${borderLight} shrink-0`}>
            <Network size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Sunucu Ağ (Network), IP & Rota Yönetimi
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                5 Katmanlı Kilit & Watchdog Korumalı
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Sunucu ethernet arayüzlerini (Statik IP / DHCP / İkincil IP), SIP MPLS/Metro statik rotalarını, DNS/Hostname kayıtlarını ve SSH/Konsol acil kurtarma yedeklerini yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeCallsCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1.5">
              <PhoneCall size={13} />
              <span>{activeCallsCount} Aktif Çağrı Var</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchNetworkStatus(true)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            title="Ağ Durumunu Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            feedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4 Sub-Tab Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "interfaces", label: "Ağ Arayüzleri (NIC) & IP", icon: Server },
          { id: "routes", label: "Statik Rotalar (SIP / MPLS)", icon: Route },
          { id: "dns_hosts", label: "DNS, Hostname & /etc/hosts", icon: Globe },
          { id: "backups_console", label: "Yedekler & Konsol/SSH Kurtarma Scripti", icon: Terminal },
        ].map((t) => {
          const IconComp = t.icon;
          const isAct = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-colors whitespace-nowrap cursor-pointer ${
                isAct
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
              }`}
            >
              <IconComp size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: NETWORK INTERFACES & IP */}
      {activeTab === "interfaces" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Live Interfaces List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Algılanan Ağ Kartları ({interfaces.length})
            </h4>
            {interfaces.map((ifc) => {
              const isSel = ifc.name === selectedIfaceName;
              return (
                <div
                  key={ifc.name}
                  onClick={() => handleSelectInterface(ifc)}
                  className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                    isSel
                      ? `bg-white dark:bg-slate-900 ${border} ring-2 ${ring}`
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          ifc.is_up ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {ifc.name}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        ifc.is_up
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {ifc.is_up ? "BAĞLI (UP)" : "KOPUK (DOWN)"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>
                      IPv4:{" "}
                      <strong className="font-mono text-slate-800 dark:text-slate-200">
                        {ifc.primary_cidr || "Atanmamış"}
                      </strong>{" "}
                      ({String(ifc.mode || "static").toUpperCase()})
                    </div>
                    <div>
                      Gateway:{" "}
                      <strong className="font-mono text-slate-700 dark:text-slate-300">
                        {ifc.gateway || "-"}
                      </strong>
                    </div>
                    {ifc.mac && (
                      <div>
                        MAC: <span className="font-mono">{ifc.mac}</span> • MTU: {ifc.mtu || 1500}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 2 Columns: Selected Interface Editor */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Arayüz Yapılandırması: <span className="font-mono">{ifaceDraft.interface}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Değişiklik uygulanmadan önce alt ağ (Subnet) uyumu ve IP çakışması otomatik kontrol edilir.
                </p>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIfaceDraft((p) => ({ ...p, mode: "static" }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                    ifaceDraft.mode === "static"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Statik IP
                </button>
                <button
                  type="button"
                  onClick={() => setIfaceDraft((p) => ({ ...p, mode: "dhcp" }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                    ifaceDraft.mode === "dhcp"
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  DHCP (Otomatik)
                </button>
              </div>
            </div>

            {ifaceDraft.mode === "static" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Birincil IPv4 Adresi & CIDR Maskesi
                  </label>
                  <input
                    type="text"
                    value={ifaceDraft.primary_cidr}
                    onChange={(e) =>
                      setIfaceDraft((p) => ({ ...p, primary_cidr: e.target.value }))
                    }
                    placeholder="Örn: 192.168.1.100/24"
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    /24 = 255.255.255.0 • /16 = 255.255.0.0 • /30 = 255.255.255.252
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Varsayılan Ağ Geçidi (Default Gateway)
                  </label>
                  <input
                    type="text"
                    value={ifaceDraft.gateway}
                    onChange={(e) =>
                      setIfaceDraft((p) => ({ ...p, gateway: e.target.value }))
                    }
                    placeholder="Örn: 192.168.1.1"
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Birincil IP ile aynı alt ağ (Subnet) içinde olmalıdır.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                DHCP modunda IP adresi, alt ağ maskesi ve varsayılan ağ geçidi yerel ağdaki DHCP sunucusundan otomatik olarak alınır.
              </div>
            )}

            {/* Secondary IPs (IP Alias) */}
            {ifaceDraft.mode === "static" && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  İkincil IP Adresleri (IP Alias / SIP Trunk VLAN IP)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSecondaryCidr}
                    onChange={(e) => setNewSecondaryCidr(e.target.value)}
                    placeholder="Örn: 10.20.30.2/24"
                    className={`flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                  <button
                    type="button"
                    onClick={handleAddSecondaryCidr}
                    title="İkincil IP Adresi Ekle"
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {ifaceDraft.secondary_cidrs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ifaceDraft.secondary_cidrs.map((sc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                      >
                        {sc}
                        <button
                          type="button"
                          onClick={() =>
                            setIfaceDraft((p) => ({
                              ...p,
                              secondary_cidrs: p.secondary_cidrs.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MTU & 60s Rollback Protection Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  MTU Boyutu
                </label>
                <input
                  type="number"
                  value={ifaceDraft.mtu}
                  onChange={(e) =>
                    setIfaceDraft((p) => ({ ...p, mtu: Number(e.target.value || 1500) }))
                  }
                  className="w-40 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <div>
                  <div className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                    60 Sn Otomatik Geri Alma (Watchdog)
                  </div>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                    Erişim koparsa 60 sn sonra eski IP'yi otomatik yükler
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={ifaceDraft.enable_rollback_guard}
                  onChange={(e) =>
                    setIfaceDraft((p) => ({
                      ...p,
                      enable_rollback_guard: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>

            {canWrite && (
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setSecurityModalAction({
                      type: "interface",
                      title: `${ifaceDraft.interface} Ağ Arayüzü Değişikliği Onayı`,
                    })
                  }
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 cursor-pointer`}
                >
                  <ShieldCheck size={15} />
                  <span>Güvenli Doğrulama ile Arayüze Uygula</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STATIC ROUTES (SIP / MPLS) */}
      {activeTab === "routes" && (
        <div className="space-y-6">
          {canWrite && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Yeni Statik Rota Ekle (SIP Operatör / MPLS / Metro Ethernet)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belirli bir operatör alt ağına (örn. 10.100.0.0/16) varsayılan gateway yerine özel bir router üzerinden çıkılmasını sağlar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newRoute.destination.trim() || !newRoute.gateway.trim()) {
                      showToast("error", "Hedef Ağ (CIDR) ve Ağ Geçidi (Gateway) alanları zorunludur.");
                      return;
                    }
                    setSecurityModalAction({
                      type: "route",
                      title: "Statik Rota Ekleme Güvenlik Onayı",
                    });
                  }}
                  title="Yeni Statik Rota Ekle"
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="text"
                  value={newRoute.destination}
                  onChange={(e) => setNewRoute((p) => ({ ...p, destination: e.target.value }))}
                  placeholder="Hedef CIDR (10.100.0.0/16)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="text"
                  value={newRoute.gateway}
                  onChange={(e) => setNewRoute((p) => ({ ...p, gateway: e.target.value }))}
                  placeholder="Gateway (192.168.2.1)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
                <select
                  value={newRoute.interface || selectedIfaceName}
                  onChange={(e) => setNewRoute((p) => ({ ...p, interface: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                >
                  {interfaces.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name} ({i.primary_cidr || "NIC"})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newRoute.metric}
                  onChange={(e) => setNewRoute((p) => ({ ...p, metric: Number(e.target.value || 100) }))}
                  placeholder="Metrik (100)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="text"
                  value={newRoute.description}
                  onChange={(e) => setNewRoute((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Açıklama (Örn: Telekom Ses Hattı)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Hedef Ağ (Destination)</th>
                  <th className="py-3 px-4">Ağ Geçidi (Gateway)</th>
                  <th className="py-3 px-4">Arayüz (NIC)</th>
                  <th className="py-3 px-4">Metrik / Tür</th>
                  <th className="py-3 px-4">Açıklama</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70 text-xs">
                {routes.map((rt, rIdx) => (
                  <tr key={rt.id || rIdx}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {rt.destination}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {rt.gateway || "Doğrudan Bağlı"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">{rt.interface || "-"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">
                        {rt.metric} • {rt.protocol}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{rt.description || "-"}</td>
                    <td className="py-3 px-4 text-right">
                      {canDelete && rt.destination !== "default" && (
                        <button
                          type="button"
                          onClick={() => setRouteToDelete(rt)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Rotayı Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DNS, HOSTNAME & /ETC/HOSTS */}
      {activeTab === "dns_hosts" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sunucu Adı (Hostname)
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Birincil DNS Sunucusu
              </label>
              <input
                type="text"
                value={dns1}
                onChange={(e) => setDns1(e.target.value)}
                placeholder="8.8.8.8"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                İkincil DNS Sunucusu
              </label>
              <input
                type="text"
                value={dns2}
                onChange={(e) => setDns2(e.target.value)}
                placeholder="1.1.1.1"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Üçüncül DNS / AD DNS
              </label>
              <input
                type="text"
                value={dns3}
                onChange={(e) => setDns3(e.target.value)}
                placeholder="Opsiyonel"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">
                  Yerel Alan Adı Eşleştirmeleri (/etc/hosts)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Operatör SIP domain veya iç ağ CRM sunucuları için sabit IP - Hostname tanımları
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newHostIp.trim() || !newHostNames.trim()) return;
                  setHostsList((prev) => [
                    ...prev,
                    {
                      id: `custom-${Date.now()}`,
                      ip: newHostIp.trim(),
                      hostnames: newHostNames.trim(),
                      comment: newHostComment.trim(),
                      is_system: false,
                    },
                  ]);
                  setNewHostIp("");
                  setNewHostNames("");
                  setNewHostComment("");
                }}
                title="Yeni Host Kaydı Ekle"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newHostIp}
                onChange={(e) => setNewHostIp(e.target.value)}
                placeholder="IP Adresi (Örn: 10.0.0.50)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
              <input
                type="text"
                value={newHostNames}
                onChange={(e) => setNewHostNames(e.target.value)}
                placeholder="Alan Adı (Örn: sip.operator.local)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
              <input
                type="text"
                value={newHostComment}
                onChange={(e) => setNewHostComment(e.target.value)}
                placeholder="Açıklama (Opsiyonel)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="space-y-1.5 pt-2">
              {hostsList.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <strong className="text-slate-900 dark:text-white">{h.ip}</strong>
                    <span className="text-slate-600 dark:text-slate-300">{h.hostnames}</span>
                    {h.comment && <span className="text-slate-400">#{h.comment}</span>}
                  </div>
                  {!h.is_system && canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        setHostsList((prev) => prev.filter((item) => item.id !== h.id))
                      }
                      className="text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() =>
                  setSecurityModalAction({
                    type: "dns_hosts",
                    title: "DNS, Hostname ve /etc/hosts Güncelleme Onayı",
                  })
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 cursor-pointer`}
              >
                <ShieldCheck size={15} />
                <span>DNS & Hosts Ayarlarını Kaydet</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BACKUPS & SSH / SERVER CONSOLE RESCUE SCRIPT */}
      {activeTab === "backups_console" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Console / SSH Rescue Script Box */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Terminal size={20} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  SSH & Sunucu Konsolu Acil Ağ Kurtarma Aracı
                </h4>
                <p className="text-[11px] text-slate-400">
                  Hatalı bir IP ayarı nedeniyle web arayüzüne erişemezseniz VMware / Proxmox / KVM konsolundan veya SSH üzerinden aşağıdaki komutlarla anında müdahale edebilirsiniz:
                </p>
              </div>
            </div>

            {[
              {
                key: "menu",
                title: "1. Etkileşimli Türkçe Konsol Menüsü (TUI)",
                desc: "Menüden IP değiştirme, DHCP'ye alma, Ping testi ve tek tuşla yedek geri yükleme:",
                cmd: consoleCmds.interactive_menu,
              },
              {
                key: "rollback",
                title: "2. Tek Komutla Son Çalışan Yedeğe Dönüş (Acil Rollback)",
                desc: "Hiçbir soru sormadan son çalışan ağ ve Netplan yedeğini anında geri yükler:",
                cmd: consoleCmds.instant_rollback,
              },
              {
                key: "setip",
                title: "3. Tek Satır Komutla Konsoldan Statik IP Atama",
                desc: "Belirtilen ağ kartına doğrudan yeni IP, CIDR ve Gateway tanımlar:",
                cmd: consoleCmds.set_static_ip,
              },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5"
              >
                <div className="text-xs font-extrabold text-emerald-400">{item.title}</div>
                <div className="text-[11px] text-slate-400">{item.desc}</div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <code className="text-[11px] font-mono text-slate-200 break-all">
                    {item.cmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCmd(item.key, item.cmd)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 cursor-pointer"
                    title="Komutu Kopyala"
                  >
                    {copiedKey === item.key ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Saved Network Backups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Otomatik Ağ Yedek Geçmişi ({backups.length})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Her ağ değişikliği öncesinde alınan tam Netplan, IP ve DNS yedekleri
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
              {backups.length === 0 ? (
                <div className="text-xs text-slate-400 py-8 text-center">
                  Henüz kayıtlı ağ yedeği bulunmuyor. İlk değişiklikte otomatik oluşturulur.
                </div>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                        {b.id} • <span className="text-slate-500">{b.label}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {b.summary || b.hostname}
                      </div>
                    </div>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleRevertNetwork(b.filename)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-extrabold shrink-0 cursor-pointer"
                      >
                        Bu Yedeğe Dön
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP-UP SECURITY RE-AUTHENTICATION MODAL */}
      {securityModalAction && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setSecurityModalAction(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleExecuteSecuredAction}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {securityModalAction.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kritik sunucu ağ değişikliği için yönetici kimlik doğrulaması gereklidir.
                </p>
              </div>
            </div>

            {activeCallsCount > 0 && securityModalAction.type === "interface" && (
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceActiveCalls}
                  onChange={(e) => setForceActiveCalls(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span>
                  Şu anda <strong>{activeCallsCount} aktif çağrı</strong> bulunuyor. Ağ değişikliğinin aktif görüşmeleri kesebileceğini onaylıyorum.
                </span>
              </label>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mevcut Yönetici Şifreniz
              </label>
              <input
                type="password"
                required
                autoFocus
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Hesap şifrenizi girin..."
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:ring-2 ${ring}`}
              />
            </div>

            {user2faEnabled && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  6 Haneli 2FA Doğrulama Kodu
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold tracking-widest focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSecurityModalAction(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submitting || !adminPassword.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Uygulanıyor..." : "Doğrula ve Uygula"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Delete Modal for Static Routes */}
      <ConfirmDeleteModal
        isOpen={Boolean(routeToDelete)}
        onClose={() => setRouteToDelete(null)}
        onConfirm={handleConfirmDeleteRoute}
        title="Statik Rotayı Sil"
        message={
          routeToDelete
            ? `${routeToDelete.destination} ➔ ${routeToDelete.gateway} statik rotasını silmek istediğinize emin misiniz?`
            : ""
        }
      />
    </div>
  );
}
