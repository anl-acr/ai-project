import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Clock, Lock, Unlock, Plus, Trash2, X, Check, AlertTriangle, Globe, Smartphone, Key } from "lucide-react";

export default function SecuritySettingsModal({ isOpen, onClose, currentUser, onPolicyUpdated, onOpenUser2FA }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientIp, setClientIp] = useState("");
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(5);
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(60);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(15);
  const [whitelistedIps, setWhitelistedIps] = useState([]);
  const [newWhitelistIp, setNewWhitelistIp] = useState("");
  const [blockedIps, setBlockedIps] = useState([]);
  const [totpSummary, setTotpSummary] = useState({ total_users: 0, enabled_users: 0, users: [] });
  const [statusMsg, setStatusMsg] = useState("");

  // Manual IP Ban Modal
  const [showBanModal, setShowBanModal] = useState(false);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("Manuel Yönetici Engeli");
  const [banIsPermanent, setBanIsPermanent] = useState(true);

  // Custom Unban Delete Confirmation Modal
  const [unbanTarget, setUnbanTarget] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchSecurityData();
    }
  }, [isOpen]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/security/settings");
      if (res.ok) {
        const data = await res.json();
        setClientIp(data.client_ip || "");
        if (data.policy) {
          setMaxFailedAttempts(data.policy.max_failed_attempts ?? 5);
          setBlockDurationMinutes(data.policy.block_duration_minutes ?? 60);
          setAutoLogoutMinutes(data.policy.auto_logout_minutes ?? 15);
          setWhitelistedIps(Array.isArray(data.policy.whitelisted_ips) ? data.policy.whitelisted_ips : []);
        }
        setBlockedIps(Array.isArray(data.blocked_ips) ? data.blocked_ips : []);
        if (data.totp_summary) {
          setTotpSummary(data.totp_summary);
        }
      }
    } catch (e) {
      console.error("Security settings fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (customWl = null) => {
    setSaving(true);
    setStatusMsg("");
    const wlToSave = customWl !== null ? customWl : whitelistedIps;
    try {
      const res = await fetch("/api/v1/security/policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          max_failed_attempts: Number(maxFailedAttempts) || 5,
          block_duration_minutes: Number(blockDurationMinutes) || 60,
          auto_logout_minutes: Number(autoLogoutMinutes) || 0,
          whitelisted_ips: wlToSave
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMsg("Güvenlik politikası başarıyla kaydedildi.");
        sessionStorage.setItem("master_auto_logout_mins", String(data.policy.auto_logout_minutes));
        if (onPolicyUpdated) {
          onPolicyUpdated(data.policy);
        }
        setTimeout(() => setStatusMsg(""), 3500);
      }
    } catch (e) {
      console.error("Save policy error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddWhitelistIp = (ipVal) => {
    const clean = (ipVal || newWhitelistIp).trim();
    if (!clean) return;
    if (!whitelistedIps.includes(clean)) {
      const next = [...whitelistedIps, clean];
      setWhitelistedIps(next);
      setNewWhitelistIp("");
      handleSavePolicy(next);
    }
  };

  const handleRemoveWhitelistIp = (ipVal) => {
    const next = whitelistedIps.filter((x) => x !== ipVal);
    setWhitelistedIps(next);
    handleSavePolicy(next);
  };

  const handleManualBan = async (e) => {
    e.preventDefault();
    if (!banIpInput.trim()) return;
    try {
      const res = await fetch("/api/v1/security/blocked-ips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          ip_address: banIpInput.trim(),
          reason: banReasonInput.trim() || "Manuel Yönetici Engeli",
          is_permanent: banIsPermanent
        })
      });
      if (res.ok) {
        setShowBanModal(false);
        setBanIpInput("");
        fetchSecurityData();
      }
    } catch (e) {
      console.error("Manual ban error:", e);
    }
  };

  const confirmUnbanIp = async () => {
    if (!unbanTarget) return;
    try {
      const res = await fetch(`/api/v1/security/blocked-ips/${unbanTarget.id}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        setUnbanTarget(null);
        fetchSecurityData();
      }
    } catch (e) {
      console.error("Unban error:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Nornia Cloud Center — Güvenlik Kalkanı</span>
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Brute-Force IP Engelleme, Otomatik Oturum Kapatma (Auto-Logout) &amp; Beyaz Liste
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {statusMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-2">
              <Check size={15} />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* 0. Per-User 2FA (Google / Microsoft Authenticator) Overview */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Smartphone size={15} className="text-indigo-500" />
                  <span>
                    İki Aşamalı Doğrulama (2FA — Kullanıcı Bazlı){" "}
                    <span className="text-indigo-600 dark:text-indigo-400">
                      ({totpSummary.enabled_users}/{totpSummary.total_users} Aktif)
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Her kullanıcı için ayrı ayrı Google / Microsoft Authenticator 2FA açıp kapatabilirsiniz.
                </p>
              </div>
              {onOpenUser2FA && (
                <button
                  type="button"
                  onClick={() => onOpenUser2FA(null)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Key size={13} />
                  <span>Kullanıcılar &amp; 2FA Ayarları</span>
                </button>
              )}
            </div>

            {Array.isArray(totpSummary.users) && totpSummary.users.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {totpSummary.users.map((u) => (
                  <div
                    key={u.id}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {u.full_name}{" "}
                        <span className="font-mono text-[10px] text-slate-400">@{u.username}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenUser2FA && onOpenUser2FA(u.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                        u.totp_enabled
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25 hover:bg-indigo-600 hover:text-white"
                      }`}
                    >
                      {u.totp_enabled ? <ShieldCheck size={11} /> : <Key size={11} />}
                      <span>{u.totp_enabled ? "2FA Açık (Yönet)" : "2FA Aç / Kur"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 1. Brute-Force & Auto-Logout Policy Controls */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Lock size={15} className="text-rose-500" />
                <span>1. Brute-Force Koruması &amp; Otomatik Oturum Kapatma (Auto-Logout)</span>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSavePolicy(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold cursor-pointer shadow-sm"
              >
                {saving ? "Kaydediliyor..." : "Politikayı Kaydet"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <label className="block font-extrabold text-slate-700 dark:text-slate-200">
                  Maksimum Hatalı Giriş Hakkı
                </label>
                <select
                  value={maxFailedAttempts}
                  onChange={(e) => setMaxFailedAttempts(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value={3}>3 Hatalı Denemede Engelle (Sıkı)</option>
                  <option value={5}>5 Hatalı Denemede Engelle (Önerilen)</option>
                  <option value={10}>10 Hatalı Denemede Engelle</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Şifre veya 2FA kodu üst üste hatalı girildiğinde IP otomatik bloklanır.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <label className="block font-extrabold text-slate-700 dark:text-slate-200">
                  Otomatik IP Bloklama Süresi
                </label>
                <select
                  value={blockDurationMinutes}
                  onChange={(e) => setBlockDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value={15}>15 Dakika</option>
                  <option value={30}>30 Dakika</option>
                  <option value={60}>1 Saat (60 Dakika)</option>
                  <option value={360}>6 Saat (360 Dakika)</option>
                  <option value={1440}>24 Saat (1440 Dakika)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Süre dolduğunda IP engeli otomatik kalkar veya aşağıdan manuel açılabilir.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <label className="block font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500" />
                  <span>Hareketsizlikte Auto-Logout</span>
                </label>
                <select
                  value={autoLogoutMinutes}
                  onChange={(e) => setAutoLogoutMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value={5}>5 Dakika Hareketsizlikte Kapat</option>
                  <option value={15}>15 Dakika Hareketsizlikte Kapat (Önerilen)</option>
                  <option value={30}>30 Dakika Hareketsizlikte Kapat</option>
                  <option value={60}>1 Saat Hareketsizlikte Kapat</option>
                  <option value={0}>Kapalı (Otomatik Çıkış Yapma)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Fare veya klavye hareketi olmazsa oturumu otomatik sonlandırır.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Whitelisted IPs */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  <span>2. Güvenilir IP Beyaz Listesi (Whitelist)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Beyaz listedeki IP adresleri hiçbir zaman Brute-Force engeline takılmaz.
                </p>
              </div>

              {clientIp && !whitelistedIps.includes(clientIp) && (
                <button
                  type="button"
                  onClick={() => handleAddWhitelistIp(clientIp)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  + Kendi IP Adresimi Ekle ({clientIp})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWhitelistIp}
                onChange={(e) => setNewWhitelistIp(e.target.value)}
                placeholder="Güvenilir IP adresi ekle (Örn: 213.74.216.246)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleAddWhitelistIp(newWhitelistIp)}
                className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white cursor-pointer"
                title="Beyaz Listeye IP Ekle"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {whitelistedIps.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Henüz beyaz listeye eklenmiş IP yok.</span>
              ) : (
                whitelistedIps.map((ip) => (
                  <span
                    key={ip}
                    className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-extrabold flex items-center gap-2"
                  >
                    <span>{ip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWhitelistIp(ip)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Beyaz Listeden Kaldır"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 3. Blocked IPs List */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={15} className="text-rose-500" />
                  <span>3. Engellenen IP Adresleri ({blockedIps.length})</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Brute-Force koruması tarafından otomatik engellenen veya manuel bloklanan IP adresleri
                </p>
              </div>

              {/* Unified Red Plus (+) Add Button Rule */}
              <button
                type="button"
                onClick={() => setShowBanModal(true)}
                className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white shadow-md shadow-rose-600/20 cursor-pointer"
                title="Manuel IP Engelle"
              >
                <Plus size={16} />
              </button>
            </div>

            {blockedIps.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                Şu anda engellenmiş herhangi bir IP adresi bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2">
                {blockedIps.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-rose-600 dark:text-rose-400">
                          {b.ip_address}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {b.is_permanent ? "Kalıcı Engel" : `${b.minutes_remaining || 1} dk kaldı`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">{b.reason}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUnbanTarget(b)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-700 dark:text-slate-300 hover:text-white font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="IP Engelini Kaldır"
                    >
                      <Unlock size={13} />
                      <span>Engeli Kaldır</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MANUEL IP BAN MODAL */}
      {showBanModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100">
            <h4 className="text-sm font-extrabold flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-600" />
              <span>Manuel IP Adresi Engelle</span>
            </h4>
            <form onSubmit={handleManualBan} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">IP Adresi</label>
                <input
                  type="text"
                  required
                  value={banIpInput}
                  onChange={(e) => setBanIpInput(e.target.value)}
                  placeholder="Örn: 185.220.101.45"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Engelleme Nedeni</label>
                <input
                  type="text"
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={banIsPermanent}
                  onChange={(e) => setBanIsPermanent(e.target.checked)}
                  className="rounded accent-rose-600"
                />
                <span>Kalıcı Olarak Engelle</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold cursor-pointer"
                >
                  IP Engelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL FOR UNBAN */}
      {unbanTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center text-slate-900 dark:text-slate-100">
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">IP Engelini Kaldır?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="font-mono font-bold text-slate-900 dark:text-white">{unbanTarget.ip_address}</span> adresinin erişim engelini kaldırmak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnbanTarget(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmUnbanIp}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
