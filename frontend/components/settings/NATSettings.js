import React, { useState, useEffect } from "react";
import { 
  Network, 
  Globe, 
  Save, 
  CheckCircle, 
  Plus, 
  Trash2, 
  HelpCircle, 
  RefreshCw, 
  Shield, 
  Server, 
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function NATSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [settings, setSettings] = useState({
    enabled: false,
    extern_ip: "",
    local_nets: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "127.0.0.1/32"]
  });

  const [newNetInput, setNewNetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingIp, setDetectingIp] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  const apiBase = `${protocol}//${backendHost}`;

  useEffect(() => {
    fetchNatSettings();
  }, []);

  const fetchNatSettings = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/api/settings/nat?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setSettings({
          enabled: data.enabled ?? false,
          extern_ip: data.extern_ip || "",
          local_nets: Array.isArray(data.local_nets) && data.local_nets.length > 0 
            ? data.local_nets 
            : ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "127.0.0.1/32"]
        });
      } else {
        setErrorMsg("NAT ayarları sunucudan alınamadı.");
      }
    } catch (err) {
      console.error("NAT settings fetch error:", err);
      setErrorMsg("Bağlantı hatası: NAT ayarları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleDetectPublicIp = async () => {
    setDetectingIp(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/api/system/public-ip?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ip) {
          setSettings(prev => ({ ...prev, extern_ip: data.ip }));
          setSuccessMsg(`Dış IP adresi başarıyla algılandı: ${data.ip}`);
          setTimeout(() => setSuccessMsg(""), 4000);
        } else {
          setErrorMsg("Dış IP adresi otomatik tespit edilemedi.");
        }
      } else {
        // Client-side fallback to external ipify
        const extRes = await fetch("https://api.ipify.org?format=json");
        if (extRes.ok) {
          const extData = await extRes.json();
          if (extData.ip) {
            setSettings(prev => ({ ...prev, extern_ip: extData.ip }));
            setSuccessMsg(`Dış IP adresi başarıyla algılandı: ${extData.ip}`);
            setTimeout(() => setSuccessMsg(""), 4000);
          }
        } else {
          setErrorMsg("Dış IP adresi sorgulaması yanıt vermedi.");
        }
      }
    } catch (err) {
      console.error("Public IP detection error:", err);
      setErrorMsg("Dış IP adresi algılanamadı, lütfen manuel giriniz.");
    } finally {
      setDetectingIp(false);
    }
  };

  const handleAddLocalNet = () => {
    const trimmed = newNetInput.trim();
    if (!trimmed) return;

    if (settings.local_nets.includes(trimmed)) {
      setErrorMsg("Bu ağ bloğu zaten ekli.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    setSettings(prev => ({
      ...prev,
      local_nets: [...prev.local_nets, trimmed]
    }));
    setNewNetInput("");
  };

  const handleRemoveLocalNet = (indexToRemove) => {
    setSettings(prev => ({
      ...prev,
      local_nets: prev.local_nets.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleAddDefaultNets = () => {
    const defaultSubnets = ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "127.0.0.1/32"];
    setSettings(prev => {
      const merged = Array.from(new Set([...prev.local_nets, ...defaultSubnets]));
      return { ...prev, local_nets: merged };
    });
    setSuccessMsg("Varsayılan RFC 1918 özel ağ blokları eklendi.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${apiBase}/api/settings/nat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message || "NAT ayarları başarıyla kaydedildi ve Asterisk'e uygulandı.");
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || "Ayarlar kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("NAT settings save error:", err);
      setErrorMsg("Sunucuya bağlanırken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <RefreshCw size={28} className="animate-spin text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">NAT ayarları yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={"p-3 rounded-xl shrink-0 " + lightBg + " " + lightText}>
            <Network size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              NAT ve Dış IP (Extern IP) Yapılandırması
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Sunucunuz bir NAT / Router / Güvenlik Duvarı arkasında çalıştığında SIP dış hatlarının (Trunk) ve dahili kayıtlarının
              paket başlıklarında doğru Dış IP adresini (Extern IP) kullanmasını sağlar. Bu ayar çağrıların sessiz kalmasını veya boşta kalmasını engeller.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            settings.enabled 
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40" 
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${settings.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {settings.enabled ? "NAT Koruması Aktif" : "NAT Pasif (Devre Dışı)"}
          </span>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-6">
        
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70">
          <div className="space-y-0.5">
            <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer">
              <ShieldCheck size={16} className={settings.enabled ? text : "text-slate-400"} />
              NAT ve Dış IP Yönlendirmesini Etkinleştir
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Etkinleştirildiğinde, Asterisk dış SIP sunucularına gönderdiği pakette (Contact & SDP) yerel sunucu IP'si yerine tanımlanan Dış IP'yi kullanır.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.enabled ? bg : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Extern IP Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe size={14} className="text-slate-500" />
              Dış IP Adresi (Extern IP / Hostname)
            </label>
            <button
              type="button"
              onClick={handleDetectPublicIp}
              disabled={detectingIp}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${text} hover:underline disabled:opacity-50`}
            >
              <RefreshCw size={12} className={detectingIp ? "animate-spin" : ""} />
              {detectingIp ? "Algılanıyor..." : "Public IP Algıla"}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={settings.extern_ip}
              onChange={(e) => setSettings(prev => ({ ...prev, extern_ip: e.target.value }))}
              placeholder="Örn: 78.189.210.15 veya pbx.sirketiniz.com"
              className={"flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 " + ring}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Asterisk santralinizin internete çıkış yaptığı sabit kamuya açık IP adresidir (external_media_address ve external_signaling_address).
          </p>
        </div>

        {/* Local Networks Section */}
        <div className="space-y-3 border-t border-slate-200/80 dark:border-slate-800/80 pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Server size={14} className="text-slate-500" />
                Yerel Ağ Blokları (Local Networks / Localnet)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Bu IP bloklarındaki istemciler (iç ağ WebRTC / Dahili telefonlar) için Dış IP yerine yerel IP kullanılır.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleAddDefaultNets}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shrink-0"
            >
              + Standard RFC 1918 Blokları
            </button>
          </div>

          {/* Add Net Input Row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newNetInput}
              onChange={(e) => setNewNetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLocalNet();
                }
              }}
              placeholder="Örn: 192.168.1.0/24 veya 10.0.0.0/8"
              className={"flex-1 px-3.5 py-2 rounded-xl border text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 " + ring}
            />
            <button
              type="button"
              onClick={handleAddLocalNet}
              title="Yeni Ağ Bloğu Ekle"
              className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Local Nets Tag / List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {settings.local_nets.map((net, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono text-slate-800 dark:text-slate-200 group"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="truncate">{net}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLocalNet(idx)}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-lg transition-colors"
                  title="Bloğu Sil"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {settings.local_nets.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
              Henüz yerel ağ bloğu tanımlanmadı. En az 192.168.0.0/16 veya 10.0.0.0/8 eklemeniz önerilir.
            </p>
          )}
        </div>

        {/* Save Button Bar */}
        <div className="flex items-center justify-end border-t border-slate-200/80 dark:border-slate-800/80 pt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={"flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all " + bg + " " + hover + " disabled:opacity-50"}
          >
            {saving ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            <span>{saving ? "Kaydediliyor..." : "Ayarları Kaydet ve Asterisk'e Uygula"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
