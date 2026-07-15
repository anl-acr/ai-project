import React, { useState, useEffect } from "react";
import { Fingerprint, Save, CheckCircle, ShieldAlert, Trash2, User, BookOpen, AlertTriangle, ShieldCheck } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function VoiceBiometricsSettings({ backendHost = "localhost:8000" }) {
  const [bioEnabled, setBioEnabled] = useState(true);
  const [bioThreshold, setBioThreshold] = useState(80);
  const [bioAutoBlacklist, setBioAutoBlacklist] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [success, setSuccess] = useState(false);

  // List of contacts with voiceprints
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, phone: null, name: "" });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // RBAC Permission States
  const [hasWritePermission, setHasWritePermission] = useState(false);

  useEffect(() => {
    fetchBioSettings();
    fetchContacts();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`);
      const statusData = await resStatus.json();
      if (!statusData.is_logged_in) {
        setHasWritePermission(true);
        return;
      }
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const usersData = await resUsers.json();
      const currentUser = usersData.find(u => u.id === statusData.user_id);
      if (!currentUser) {
        setHasWritePermission(true);
        return;
      }
      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const rolesData = await resRoles.json();
      const currentRole = rolesData.find(r => r.role_code === currentUser.role);
      if (!currentRole) {
        setHasWritePermission(true);
        return;
      }
      setHasWritePermission(currentRole.permissions.includes("voice_biometrics:write"));
    } catch (err) {
      console.error("Yetki kontrolü hatası:", err);
      setHasWritePermission(true);
    }
  };

  const fetchBioSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/voice-biometrics`);
      if (res.ok) {
        const data = await res.json();
        setBioEnabled(data.enabled);
        setBioThreshold(data.deepfake_threshold);
        setBioAutoBlacklist(data.auto_blacklist);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar yüklenemedi:", err);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`${API_BASE}/api/contacts`);
      if (res.ok) {
        const data = await res.json();
        // Filter contacts that have a registered voiceprint
        const biometricContacts = data.filter(c => c.voiceprint);
        setContacts(biometricContacts);
      }
    } catch (err) {
      console.error("Rehber kişileri yüklenemedi:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const saveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/settings/voice-biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: bioEnabled,
          deepfake_threshold: bioThreshold,
          auto_blacklist: bioAutoBlacklist
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar kaydedilemedi:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const triggerDeleteVoiceprint = (phone, firstName, lastName) => {
    setDeleteConfirm({
      show: true,
      phone: phone,
      name: `${firstName} ${lastName}`
    });
  };

  const executeDeleteVoiceprint = async () => {
    const phone = deleteConfirm.phone;
    if (!phone) return;
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${phone}/voiceprint`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteConfirm({ show: false, phone: null, name: "" });
        fetchContacts();
      }
    } catch (err) {
      console.error("Ses izi silinemedi:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200/85 dark:border-slate-800/80 pb-4">
        <div className="p-2.5 bg-indigo-50 dark:bg-primary/20 text-primary dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl">
          <Fingerprint size={22} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Canlı Biyometrik Doğrulama (Voice Bio-Verification)</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Müşteri ses imzalarını şifreleyerek kimlik doğrulaması gerçekleştirin ve Deepfake aramaları engelleyin.</p>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-355 text-xs flex items-center gap-2 font-semibold shadow-sm">
          <CheckCircle size={15} />
          <span>Biyometrik doğrulama ve deepfake koruma ayarları kaydedildi.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* Left Card: Core System Config */}
        <form onSubmit={saveSettings} className="lg:col-span-2 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-5 shadow-sm text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <Fingerprint size={16} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Güvenlik Yapılandırması</h3>
          </div>

          <div className="space-y-5 text-xs font-semibold text-slate-650 dark:text-slate-400">
            {/* Enable Switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[70%]">
                <span className="font-extrabold text-[10px] uppercase text-slate-750 dark:text-slate-300">Biyometrik Koruma</span>
                <p className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold leading-relaxed">Gelen çağrılarda ses izi karşılaştırmasını ve deepfake denetimini aktif hale getirir.</p>
              </div>
              <button
                type="button"
                disabled={!hasWritePermission}
                onClick={() => setBioEnabled(!bioEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  bioEnabled ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    bioEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between font-extrabold text-[10px] uppercase text-slate-750 dark:text-slate-300">
                <span>Deepfake Risk Alarm Eşiği</span>
                <span className="text-primary font-bold">%{bioThreshold}</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={bioThreshold}
                disabled={!hasWritePermission}
                onChange={(e) => setBioThreshold(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-widest pt-0.5">
                <span>Düşük Hassasiyet</span>
                <span>Yüksek Hassasiyet</span>
              </div>
            </div>

            {/* Auto Blacklist Switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-[70%]">
                <span className="font-extrabold text-[10px] uppercase text-slate-750 dark:text-slate-300">Otomatik Engelleme (Kara Liste)</span>
                <p className="text-[9px] text-slate-455 dark:text-slate-500 font-semibold leading-relaxed">Deepfake risk oranı eşiği aştığında arayan numarayı doğrudan Abuse Shield kara listesine yazar.</p>
              </div>
              <button
                type="button"
                disabled={!hasWritePermission}
                onClick={() => setBioAutoBlacklist(!bioAutoBlacklist)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  bioAutoBlacklist ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    bioAutoBlacklist ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {hasWritePermission && (
            <button
              type="submit"
              disabled={savingSettings}
              className="mt-2 py-2.5 bg-primary hover:bg-primary disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/10 transition duration-200"
            >
              <Save size={14} /> {savingSettings ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
          )}
        </form>

        {/* Right Card: Registered Voiceprints Table */}
        <div className="lg:col-span-3 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-4 shadow-sm text-left">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Kayıtlı Ses İmzaları</h3>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-full text-[9px] font-black font-mono">
              {contacts.length} Kişi
            </span>
          </div>

          {loadingContacts ? (
            <div className="text-center py-12 text-xs font-semibold text-slate-450 dark:text-slate-500 animate-pulse">
              Ses imzaları yükleniyor...
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-500 rounded-full border border-slate-100 dark:border-slate-850">
                <Fingerprint size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-slate-750 dark:text-white">Ses İzi Kaydı Bulunmuyor</h4>
                <p className="text-[9px] text-slate-450 dark:text-slate-500 max-w-[240px] font-semibold leading-relaxed">Görüşmeler esnasında WebPhone üzerindeki "Ses İzini Şifreli Kaydet" butonuna tıklayarak ilk kaydı oluşturabilirsiniz.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 dark:border-slate-850 rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Ad Soyad</th>
                      <th className="py-2.5 px-3">Telefon</th>
                      <th className="py-2.5 px-3">Ses İzi (Hash)</th>
                      {hasWritePermission && <th className="py-2.5 px-3 text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 dark:border-slate-850/60 hover:bg-slate-50/40 dark:hover:bg-slate-950/20 transition-colors text-[10px]">
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          {c.first_name} {c.last_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[9px] text-slate-500">{c.phone_number}</td>
                        <td className="py-2.5 px-3 font-mono text-[9px] text-primary dark:text-emerald-450 font-bold flex items-center gap-1">
                          <ShieldCheck size={11} className="text-primary shrink-0" />
                          {c.voiceprint.replace("AES256:", "").slice(0, 10)}...
                        </td>
                        {hasWritePermission && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => triggerDeleteVoiceprint(c.phone_number, c.first_name, c.last_name)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition"
                              title="Ses İzini Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, phone: null, name: "" })}
        onConfirm={executeDeleteVoiceprint}
        title="Ses İzini Sil"
        message={`${deleteConfirm.name} adlı müşteriye ait şifreli biyometrik ses izi verisini kalıcı olarak silmek istediğinize emin misiniz? Gelecekteki aramalarda kimlik teyidi yapılamayacaktır.`}
      />
    </div>
  );
}
