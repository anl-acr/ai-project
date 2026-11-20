import React, { useState, useEffect } from "react";
import {
  Info,
  X,
  Server,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Network,
  Cpu,
  Users,
  PhoneCall,
  Bot,
  AlertTriangle,
  Wifi,
  Shield
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

function formatDateTR(isoStr) {
  if (!isoStr || isoStr === "unlimited") return "Süresiz";
  const parts = String(isoStr).slice(0, 10).split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return isoStr;
}

function formatUptime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const d = Math.floor(s / 86400);
  const rem = s % 86400;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const sec = rem % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d} gün ${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function formatTRNow(dateObj) {
  const trMs = dateObj.getTime() + dateObj.getTimezoneOffset() * 60000 + 3 * 3600000;
  const d = new Date(trMs);
  const pad = (n) => String(n).padStart(2, "0");
  const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${days[d.getDay()]}`;
}

export default function SystemInfoModal({ isOpen, onClose, backendHost, onOpenLicenseModal }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [lanOpen, setLanOpen] = useState(true);
  const [wanOpen, setWanOpen] = useState(false);
  const [natOpen, setNatOpen] = useState(false);
  const [liveTickSec, setLiveTickSec] = useState(0);

  const API_BASE = getApiBaseUrl(backendHost);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/overview`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLiveTickSec(0);
      }
    } catch (e) {
      console.error("Failed to fetch system overview:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchOverview();
  }, [isOpen, backendHost]);

  useEffect(() => {
    if (!isOpen) return;
    const iv = setInterval(() => {
      setLiveTickSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleCopy = (val, key) => {
    if (!val || val === "-") return;
    navigator.clipboard.writeText(String(val));
    setCopiedField(key);
    setTimeout(() => setCopiedField(""), 1800);
  };

  if (!isOpen) return null;

  const dev = data?.device || {};
  const net = data?.network || {};
  const lan = net?.lan || {};
  const wan = net?.wan || {};
  const nat = net?.nat || {};
  const lic = data?.license || {};

  const liveUptime = data ? formatUptime((dev.uptime_seconds || 0) + liveTickSec) : "-";
  const liveTime = data
    ? formatTRNow(new Date((dev.server_timestamp_ms || Date.now()) + liveTickSec * 1000))
    : "-";

  const isHardExpired = Boolean(lic.hard_expired || (!lic.valid && !lic.in_grace_period && data));
  const isInGrace = Boolean(!isHardExpired && lic.in_grace_period);
  const isExpiringSoon =
    !isHardExpired &&
    !isInGrace &&
    !lic.is_unlimited &&
    lic.days_left !== null &&
    lic.days_left !== undefined &&
    Number(lic.days_left) <= 7;

  const Row = ({ label, value, mono = false, copyKey = "", valueClass = "" }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/70 last:border-b-0">
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`text-xs truncate text-right ${
            mono ? "font-mono font-bold" : "font-semibold"
          } ${valueClass || "text-slate-800 dark:text-slate-200"}`}
          title={value ? String(value) : ""}
        >
          {value || "-"}
        </span>
        {copyKey && value && value !== "-" && (
          <button
            type="button"
            onClick={() => handleCopy(value, copyKey)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Kopyala"
          >
            {copiedField === copyKey ? (
              <Check size={11} className="text-emerald-500" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        )}
      </div>
    </div>
  );

  const CapacityMiniBar = ({ icon: IconComp, label, used, max, extraText = "" }) => {
    const u = Number(used || 0);
    const m = Number(max || 0);
    const pct = m > 0 ? Math.min(100, Math.round((u / m) * 100)) : 0;
    const isHigh = pct >= 85;
    return (
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
            <IconComp size={11} className={text} />
            {label}
          </span>
          <span className="text-[10.5px] font-mono font-extrabold text-slate-800 dark:text-slate-100 shrink-0">
            {u}/{m >= 9999 ? "∞" : m}
            {extraText && <span className="text-amber-600 dark:text-amber-400 ml-0.5">{extraText}</span>}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isHigh ? "bg-rose-500" : bg}`}
            style={{ width: `${m >= 9999 ? 12 : Math.max(pct, u > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex justify-end bg-slate-950/50 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-[460px] h-full sm:h-[calc(100%-24px)] sm:m-3 bg-white dark:bg-slate-900 sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl ${lightBg} ${borderLight} border flex items-center justify-center shrink-0`}>
              <Info size={19} className={text} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                Sistem, Ağ & Lisans Bilgileri
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {dev.device_name || "Nornia Enterprise AI PBX"}
                {dev.firmware_version ? ` • ${dev.firmware_version}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {!data && loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw size={22} className="animate-spin" />
              <span className="text-xs font-bold">Sistem ve ağ bilgileri yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* 1. LİSANS BİLGİLERİ KARTI */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isHardExpired
                    ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/50"
                    : isInGrace || isExpiringSoon
                    ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : "bg-slate-50/80 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isHardExpired ? (
                      <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : isInGrace || isExpiringSoon ? (
                      <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Lisans Bilgileri
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                      isHardExpired
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        : isInGrace
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                        : isExpiringSoon
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {isHardExpired
                      ? "Süresi Doldu"
                      : isInGrace
                      ? `Ek Süre (${Number(lic.grace_days_left || 0) <= 0 ? "Son Gün" : `${lic.grace_days_left} gün`})`
                      : lic.is_unlimited
                      ? "Süresiz Aktif"
                      : isExpiringSoon
                      ? Number(lic.days_left || 0) <= 0
                        ? "Bugün Doluyor"
                        : `${lic.days_left} gün kaldı`
                      : `Aktif • ${lic.days_left ?? "-"} gün`}
                  </span>
                </div>

                <div>
                  <Row label="Lisans Paketi" value={lic.plan_label || lic.plan_tier || "-"} />
                  <Row
                    label="Lisans Bitiş Tarihi"
                    value={lic.is_unlimited ? "♾️ Limitsiz / Süresiz" : formatDateTR(lic.license_expires_at)}
                    mono={!lic.is_unlimited}
                    valueClass={
                      isHardExpired || isExpiringSoon
                        ? "text-rose-600 dark:text-rose-400 font-extrabold"
                        : undefined
                    }
                  />
                  {lic.license_grace_until && (
                    <Row
                      label="Ek Süre Bitiş Tarihi"
                      value={formatDateTR(lic.license_grace_until)}
                      mono
                      valueClass="text-amber-700 dark:text-amber-400 font-extrabold"
                    />
                  )}
                  <Row label="Donanım ID" value={dev.hardware_id} mono copyKey="hw_id" />
                  <Row label="Tenant Seri No" value={dev.tenant_serial_number} mono copyKey="tenant_sn" />
                </div>

                {/* Mini Capacity Bars */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <CapacityMiniBar
                    icon={Users}
                    label="İç Hat"
                    used={lic.used_users}
                    max={lic.max_users}
                  />
                  <CapacityMiniBar
                    icon={PhoneCall}
                    label="Çağrı"
                    used={lic.used_channels}
                    max={lic.max_concurrent_calls}
                    extraText={lic.tolerance_concurrent_calls > 0 ? `+${lic.tolerance_concurrent_calls}` : ""}
                  />
                  <CapacityMiniBar
                    icon={Bot}
                    label="AI Ajan"
                    used={lic.used_ai_agents}
                    max={lic.max_ai_agents}
                  />
                </div>

                {onOpenLicenseModal && (
                  <button
                    type="button"
                    onClick={onOpenLicenseModal}
                    className={`w-full py-2 px-3 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer`}
                  >
                    <Key size={13} />
                    <span>Lisans Yönetimi & Anahtar Yenile</span>
                  </button>
                )}
              </div>

              {/* 2. BİLGİ (SİSTEM BİLGİLERİ) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-2 pb-2 mb-1 border-b border-slate-200/70 dark:border-slate-800">
                  <Server size={14} className={text} />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bilgi
                  </span>
                </div>

                <Row label="Cihaz Adı" value={dev.device_name} />
                <Row label="Ürün Modeli" value={dev.product_model} />
                <Row label="Seri No" value={dev.serial_number} mono copyKey="sys_sn" />
                <Row label="İşletim Sistemi" value={dev.os_name} />
                <Row
                  label="Firmware"
                  value={
                    dev.commit_hash && dev.commit_hash !== "unknown"
                      ? `${dev.firmware_version} (${String(dev.commit_hash).slice(0, 7)})`
                      : dev.firmware_version
                  }
                  mono
                />
                <Row label="Sistem Zamanı" value={liveTime} mono />
                <Row label="Çalışma Süresi" value={liveUptime} mono />
                <Row
                  label="Maksimum İç Hatlar"
                  value={
                    dev.max_extensions >= 9999
                      ? `Limitsiz (Aktif: ${dev.used_extensions ?? 0})`
                      : `${dev.max_extensions ?? "-"} (Aktif: ${dev.used_extensions ?? 0})`
                  }
                  mono
                />
                <Row
                  label="Maksimum Eşzamanlı Çağrı"
                  value={
                    dev.tolerance_concurrent_calls > 0
                      ? `${dev.max_concurrent_calls} (+${dev.tolerance_concurrent_calls} Tolerans)`
                      : String(dev.max_concurrent_calls ?? "-")
                  }
                  mono
                />
              </div>

              {/* 3. AĞ (NORNIA FQDN, LAN, WAN, NAT) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                  <Globe size={14} className={text} />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ağ
                  </span>
                </div>

                {/* Nornia FQDN */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/70">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        net.ras_connected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-slate-400"
                      }`}
                    />
                    Nornia FQDN
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                      {net.nornia_fqdn || "-"}
                    </span>
                    {net.nornia_fqdn && net.nornia_fqdn !== "-" && (
                      <button
                        type="button"
                        onClick={() => handleCopy(net.nornia_fqdn, "fqdn")}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                        title="FQDN Kopyala"
                      >
                        {copiedField === "fqdn" ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* LAN Accordion */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLanOpen((v) => !v)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Network size={13} className={text} />
                      <span>LAN</span>
                      {lan.interface && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {lan.interface}
                        </span>
                      )}
                    </span>
                    {lanOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </button>

                  {lanOpen && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                      <div className="flex items-center gap-1.5 py-1.5 mb-0.5">
                        <span className={`w-1 h-3.5 rounded-full ${bg}`} />
                        <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">IPv4</span>
                      </div>
                      <Row label="Tür" value={lan.type} />
                      <Row label="MAC Adresi" value={lan.mac} mono copyKey="lan_mac" />
                      <Row label="IP Adresi" value={lan.ip} mono copyKey="lan_ip" />
                      <Row label="Alt Ağ Maskesi" value={lan.netmask} mono />
                      <Row label="Ağ Geçidi" value={lan.gateway} mono />
                      <Row label="1. DNS" value={lan.dns1} mono />
                      <Row label="2. DNS" value={lan.dns2} mono />
                      <Row label="IP Adresi 2" value={lan.ip2} mono />
                      <Row label="Alt Ağ Maskesi 2" value={lan.netmask2} mono />
                    </div>
                  )}
                </div>

                {/* WAN Accordion */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setWanOpen((v) => !v)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Wifi size={13} className={text} />
                      <span>WAN</span>
                    </span>
                    {wanOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </button>

                  {wanOpen && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                      <Row label="Harici / WAN IP" value={wan.ip} mono copyKey="wan_ip" />
                      <Row label="Arayüz" value={wan.interface} mono />
                      <Row label="Alt Ağ Maskesi" value={wan.netmask} mono />
                      <Row label="Ağ Geçidi" value={wan.gateway} mono />
                      <Row
                        label="Nornia Connect"
                        value={wan.tunnel_status}
                        valueClass={
                          net.ras_connected
                            ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                            : "text-slate-500"
                        }
                      />
                    </div>
                  )}
                </div>

                {/* NAT Accordion */}
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNatOpen((v) => !v)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Shield size={13} className={text} />
                      <span>NAT</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                          nat.enabled
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {nat.enabled ? "Aktif" : "Pasif"}
                      </span>
                    </span>
                    {natOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </button>

                  {natOpen && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                      <Row label="NAT Durumu" value={nat.enabled ? "Aktif" : "Pasif"} />
                      <Row label="Harici IP (External IP)" value={nat.extern_ip} mono copyKey="nat_ip" />
                      <Row
                        label="Yerel Ağlar"
                        value={
                          Array.isArray(nat.local_nets) && nat.local_nets.length > 0
                            ? nat.local_nets.join(", ")
                            : "-"
                        }
                        mono
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
