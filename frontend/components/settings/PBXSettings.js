import React, { useState, useEffect } from "react";
import { 
  PhoneCall, 
  Save, 
  CheckCircle, 
  Server, 
  HardDrive, 
  Network, 
  Cable, 
  Plus, 
  Trash2, 
  Edit2,
  X, 
  ArrowRight,
  HelpCircle,
  Fingerprint
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function PBXSettings({ viewMode = "pbx", backendHost = "localhost:8000" }) {
  // PBX & AMI Config States
  const [settings, setSettings] = useState({
    ami_host: "127.0.0.1",
    ami_port: 5038,
    ami_user: "",
    ami_secret: "",
    webrtc_wss_url: "wss://127.0.0.1:8089/ws",
    nas_mount_path: "/mnt/nas/ai-recordings",
    auto_whisper_enabled: true
  });

  const [trunks, setTrunks] = useState([]);
  const [trunkStatuses, setTrunkStatuses] = useState({});
  const [pbxSuccess, setPbxSuccess] = useState(false);
  const [loading, setLoading] = useState({ pbx: false, trunks: false });

  // Voice Biometric Settings States
  const [bioEnabled, setBioEnabled] = useState(true);
  const [bioThreshold, setBioThreshold] = useState(80);
  const [bioAutoBlacklist, setBioAutoBlacklist] = useState(false);
  const [savingBioSettings, setSavingBioSettings] = useState(false);

  // Popup Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Choose Type, 2: Fill Details
  const [newTrunk, setNewTrunk] = useState({
    trunk_type: "register", // register, peer
    trunk_name: "",
    host: "",
    username: "",
    password: "",
    port: 5060,
    did_number: "",
    protocol: "udp", // udp, tcp
    greeting_prompt: "",
    transfer_target_type: "extension", // extension, queue, custom
    transfer_target: "200",
    codec: "G711",
    is_active: true
  });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch configs on mount
  const fetchPbxSettings = () => {
    fetch(`${API_BASE}/api/settings/pbx`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => console.error("[PBX] Ayarlar yuklenemedi:", err));
  };

  const fetchTrunks = () => {
    fetch(`${API_BASE}/api/settings/trunks`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTrunks(data);
      })
      .catch((err) => console.error("[Trunks] Listelenemedi:", err));
  };

  const fetchTrunkStatuses = () => {
    fetch(`${API_BASE}/api/settings/trunks/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setTrunkStatuses(data);
      })
      .catch((err) => console.error("[Trunks] Durumlar alinamadi:", err));
  };

  useEffect(() => {
    fetchPbxSettings();
    fetchTrunks();
    fetchTrunkStatuses();
    fetchBioSettings();

    const interval = setInterval(fetchTrunkStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

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
      console.error("Biyometrik ayarlar yükleme hatası:", err);
    }
  };

  const saveBiometricsSettings = async () => {
    setSavingBioSettings(true);
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
        setPbxSuccess(true);
        setTimeout(() => setPbxSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar kaydedilemedi:", err);
    } finally {
      setSavingBioSettings(false);
    }
  };

  const handlePbxChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNewTrunkChange = (e) => {
    const { name, value } = e.target;
    setNewTrunk((prev) => ({ ...prev, [name]: value }));
  };

  const handlePbxSave = async (e) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, pbx: true }));
    setPbxSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/pbx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setPbxSuccess(true);
        setTimeout(() => setPbxSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[PBX] Kayit hatasi:", err);
    } finally {
      setLoading((prev) => ({ ...prev, pbx: false }));
    }
  };

  // Add Trunk Submit
  const handleAddTrunk = async (e) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, trunks: true }));

    try {
      const res = await fetch(`${API_BASE}/api/settings/trunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTrunk)
      });
      if (res.ok) {
        closeModal();
        fetchTrunks();
      }
    } catch (err) {
      console.error("[Trunks] Ekleme/Guncelleme hatasi:", err);
    } finally {
      setLoading((prev) => ({ ...prev, trunks: false }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalStep(1);
    setNewTrunk({
      trunk_type: "register",
      trunk_name: "",
      host: "",
      username: "",
      password: "",
      port: 5060,
      did_number: "",
      protocol: "udp",
      greeting_prompt: "",
      transfer_target_type: "extension",
      transfer_target: "200",
      codec: "G711",
      is_active: true
    });
  };

  const handleEditTrunk = (t) => {
    setNewTrunk({ ...t });
    setModalStep(2); // Skip Step 1 since type is chosen
    setShowModal(true);
  };

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });

  // Trigger Delete Confirmation Modal
  const handleDeleteTrunk = (id) => {
    setDeleteConfirm({ show: true, id: id });
  };

  // Actual Delete Execution
  const executeDeleteTrunk = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/trunks/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteConfirm({ show: false, id: null });
        fetchTrunks();
      }
    } catch (err) {
      console.error("[Trunks] Silme hatasi:", err);
    }
  };

  return (
    <div className="flex flex-col gap-8 text-slate-800 dark:text-slate-100 max-w-5xl w-full">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className={`p-3 border rounded-2xl ${
          viewMode === "pbx"
            ? "bg-rose-50 dark:bg-rose-600/20 text-rose-500 dark:text-rose-455 border-rose-100 dark:border-rose-900/40"
            : "bg-indigo-50 dark:bg-indigo-600/20 text-indigo-500 dark:text-indigo-455 border-indigo-100 dark:border-indigo-900/40"
        }`}>
          {viewMode === "pbx" ? <PhoneCall size={24} /> : <Cable size={24} />}
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            {viewMode === "pbx" ? "Asterisk Santral Entegrasyonu" : "Dış Hat Entegrasyonu (SIP Trunks)"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {viewMode === "pbx" 
              ? "Yapay zekanın çağrı alması için sunucu ve Asterisk Manager Interface (AMI) bağlantı yollarını yönetin."
              : "Operatör dış hat (SIP Trunk) tanımlarını, did numaralarını ve codec tercihlerini yapılandırın."
            }
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: PBX & AMI Configuration */}
        {viewMode === "pbx" && (
          <div className="lg:col-span-5 flex flex-col gap-6">
            <form onSubmit={handlePbxSave} className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-4 shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <Server size={16} className="text-rose-500 dark:text-rose-455" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Sunucu & AMI Ayarları</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Host</label>
                  <input
                    type="text"
                    name="ami_host"
                    value={settings.ami_host}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Port</label>
                  <input
                    type="number"
                    name="ami_port"
                    value={settings.ami_port}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Kullanıcı</label>
                  <input
                    type="text"
                    name="ami_user"
                    value={settings.ami_user}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Şifre</label>
                  <input
                    type="password"
                    name="ami_secret"
                    value={settings.ami_secret}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">WebRTC (WSS) URL</label>
                <input
                  type="text"
                  name="webrtc_wss_url"
                  value={settings.webrtc_wss_url}
                  onChange={handlePbxChange}
                  required
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">NAS Kayıt Dizin Yolu</label>
                <input
                  type="text"
                  name="nas_mount_path"
                  value={settings.nas_mount_path}
                  onChange={handlePbxChange}
                  required
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading.pbx}
                className="mt-2 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-455 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-rose-500/10 transition duration-205"
              >
                <Save size={14} /> {loading.pbx ? "Kaydediliyor..." : "AMI ve Santral Ayarlarını Kaydet"}
              </button>

              {pbxSuccess && (
                <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-350 text-[10px] flex items-center gap-1.5 font-semibold">
                  <CheckCircle size={12} />
                  <span>Santral bağlantı ayarları güncellendi.</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Right Side: SIP Trunks List & Add Action */}
        {viewMode === "trunks" && (
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
              
              {/* Header + Add button */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Cable size={18} className="text-blue-500 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Aktif Dış Hat Bağlantıları (Trunks)</h3>
                </div>
                <button
                  onClick={() => {
                    setModalStep(1);
                    setShowModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 transition rounded-xl font-bold text-xs text-white shadow-sm shadow-blue-500/10"
                >
                  <Plus size={14} /> Dış Hat Ekle
                </button>
              </div>

              {/* List Table */}
              {trunks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                  Kayıtlı dış hat bağlantısı bulunmuyor. "Dış Hat Ekle" butonuna basarak yeni bir SIP hattı bağlayabilirsiniz.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 w-16 text-center">Durum</th>
                        <th className="py-2.5">Hat Adı</th>
                        <th className="py-2.5">Tür</th>
                        <th className="py-2.5">Protokol</th>
                        <th className="py-2.5">Sunucu / Port</th>
                        <th className="py-2.5">Caller ID (DID)</th>
                        <th className="py-2.5">Codec</th>
                        <th className="py-2.5 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trunks.map((t) => {
                        const isActive = t.is_active !== false;
                        const status = isActive ? (trunkStatuses[t.id] || "inactive") : "passive";
                        return (
                          <tr key={t.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/40 dark:hover:bg-slate-950/20 transition-colors">
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center">
                                <span className="relative flex h-2 w-2">
                                  {status === "registered" && (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-lg shadow-emerald-500/50" title="Kayıtlı (Aktif)"></span>
                                    </>
                                  )}
                                  {status === "trying" && (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-lg shadow-amber-500/50" title="Deneniyor"></span>
                                    </>
                                  )}
                                  {status === "inactive" && (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-lg shadow-rose-500/50" title="Bağlantı Yok"></span>
                                  )}
                                  {status === "passive" && (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400 dark:bg-slate-655 shadow-lg shadow-slate-500/50" title="Pasif (Devre Dışı)"></span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 font-bold text-slate-800 dark:text-white">{t.trunk_name}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                t.trunk_type === "register" ? "bg-purple-50 dark:bg-purple-900/30 text-purple-650 dark:text-purple-450 border border-purple-100 dark:border-purple-800/30" : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30"
                              }`}>
                                {t.trunk_type === "register" ? "REGISTER" : "PEER"}
                              </span>
                            </td>
                            <td className="py-3 uppercase font-mono text-[10px]">{t.protocol || "udp"}</td>
                            <td className="py-3 font-mono text-[10px] text-slate-450 dark:text-slate-550">{t.host}:{t.port}</td>
                            <td className="py-3 font-mono text-slate-800 dark:text-slate-200">{t.did_number}</td>
                            <td className="py-3 font-bold text-slate-700 dark:text-slate-350">{t.codec || "G711"}</td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleEditTrunk(t)}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-450 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Düzenle"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTrunk(t.id)}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                                  title="Sil"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL: Add Trunk Step-by-Step */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full text-slate-850 dark:text-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-550/5 dark:bg-slate-950/20">
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-slate-800 dark:text-white">
                <Cable size={16} className="text-blue-500 dark:text-blue-400" />
                {newTrunk.id ? "Dış Hat Düzenle" : "Dış Hat (SIP Trunk) Ekle"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-550 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step 1: Choose Trunk Type */}
            {modalStep === 1 && (
              <div className="p-6 flex flex-col gap-5">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Hat bağlantı türünü seçin:</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Register Option */}
                  <label className={`flex flex-col p-4 border rounded-xl cursor-pointer hover:border-purple-500 transition-all ${
                    newTrunk.trunk_type === "register" ? "bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800" : "bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  }`}>
                    <input
                      type="radio"
                      name="trunk_type"
                      checked={newTrunk.trunk_type === "register"}
                      onChange={() => setNewTrunk((prev) => ({ ...prev, trunk_type: "register" }))}
                      className="hidden"
                    />
                    <span className="font-bold text-sm text-purple-600 dark:text-purple-400">Register Trunk</span>
                    <span className="text-[10px] text-slate-500 mt-2 leading-relaxed font-medium">Operatör tarafından verilen kullanıcı adı ve şifre ile kayıt olan hatlar.</span>
                  </label>

                  {/* Peer Option */}
                  <label className={`flex flex-col p-4 border rounded-xl cursor-pointer hover:border-blue-500 transition-all ${
                    newTrunk.trunk_type === "peer" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800" : "bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  }`}>
                    <input
                      type="radio"
                      name="trunk_type"
                      checked={newTrunk.trunk_type === "peer"}
                      onChange={() => setNewTrunk((prev) => ({ ...prev, trunk_type: "peer" }))}
                      className="hidden"
                    />
                    <span className="font-bold text-sm text-blue-600 dark:text-blue-400">Peer Trunk</span>
                    <span className="text-[10px] text-slate-500 mt-2 leading-relaxed font-medium">IP bazlı yetkilendirme ile çalışan, şifresiz direkt hat bağlantıları.</span>
                  </label>
                </div>

                <button
                  onClick={() => setModalStep(2)}
                  className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white transition rounded-xl font-bold text-xs self-end shadow-md shadow-blue-500/15"
                >
                  İleri <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Step 2: Fill Details Form */}
            {modalStep === 2 && (
              <form onSubmit={handleAddTrunk} className="p-5 flex flex-col gap-4">
                
                {/* Info Text */}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                  <span>Hat Türü:</span>
                  <span className={newTrunk.trunk_type === "register" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}>
                    {newTrunk.trunk_type.toUpperCase()} TRUNK
                  </span>
                </p>

                {/* Trunk Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Bağlantı (Trunk) Adı</label>
                  <input
                    type="text"
                    name="trunk_name"
                    value={newTrunk.trunk_name}
                    onChange={handleNewTrunkChange}
                    placeholder="Örn: Operator_Hatti"
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Server Host & Port */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SIP Sunucu IP / Host</label>
                    <input
                      type="text"
                      name="host"
                      value={newTrunk.host}
                      onChange={handleNewTrunkChange}
                      placeholder="sip.operator.com"
                      required
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SIP Port</label>
                    <input
                      type="number"
                      name="port"
                      value={newTrunk.port}
                      onChange={handleNewTrunkChange}
                      required
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Auth Username / Password (Only for register trunks) */}
                {newTrunk.trunk_type === "register" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SIP Kullanıcı Adı</label>
                      <input
                        type="text"
                        name="username"
                        value={newTrunk.username}
                        onChange={handleNewTrunkChange}
                        required
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SIP Şifre</label>
                      <input
                        type="password"
                        name="password"
                        value={newTrunk.password}
                        onChange={handleNewTrunkChange}
                        required
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Caller ID (DID Number) & Protocol Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Caller ID / DID</label>
                    <input
                      type="text"
                      name="did_number"
                      value={newTrunk.did_number}
                      onChange={handleNewTrunkChange}
                      placeholder="0850XXXXXXX"
                      required
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Protokol</label>
                    <select
                      name="protocol"
                      value={newTrunk.protocol}
                      onChange={handleNewTrunkChange}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-blue-500"
                    >
                      <option value="udp">UDP (Önerilen)</option>
                      <option value="tcp">TCP</option>
                    </select>
                  </div>
                </div>

                {/* AI GREETING PROMPT */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Karşılama Promptu / AI Görevi</label>
                  <textarea
                    name="greeting_prompt"
                    value={newTrunk.greeting_prompt || ""}
                    onChange={handleNewTrunkChange}
                    placeholder="Örn: Müşteri aradığında kendini Satış Temsilcisi olarak tanıt, kampanyalardan bahset..."
                    rows={3}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* TRANSFER CONFIGURATION */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Çağrı Aktarma Hedefi</label>
                    <select
                      name="transfer_target_type"
                      value={newTrunk.transfer_target_type || "extension"}
                      onChange={handleNewTrunkChange}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-blue-500"
                    >
                      <option value="extension">Dahili Numaraya Aktar</option>
                      <option value="queue">Çağrı Kuyruğuna (Queue) Aktar</option>
                      <option value="custom">Özel Numaraya Aktar</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Hedef Numara / Kuyruk</label>
                    <input
                      type="text"
                      name="transfer_target"
                      value={newTrunk.transfer_target || ""}
                      onChange={handleNewTrunkChange}
                      placeholder={newTrunk.transfer_target_type === "queue" ? "Örn: support_queue" : "Örn: 200"}
                      required
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* CODEC SELECTION */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Tercih Edilen Codec</label>
                  <select
                    name="codec"
                    value={newTrunk.codec || "G711"}
                    onChange={handleNewTrunkChange}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-blue-500"
                  >
                    <option value="G711">G.711 (alaw / ulaw)</option>
                    <option value="G729">G.729 (Sıkıştırılmış Düşük Bant)</option>
                    <option value="Opus">Opus (Yüksek Kaliteli Ses)</option>
                    <option value="G722">G.722 (Geniş Bant HD Ses)</option>
                  </select>
                </div>

                {/* HAT AKTİF / PASİF DURUMU */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Hat Durumu</label>
                  <select
                    name="is_active"
                    value={newTrunk.is_active === undefined ? "true" : String(newTrunk.is_active)}
                    onChange={(e) => setNewTrunk((prev) => ({ ...prev, is_active: e.target.value === "true" }))}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-blue-500"
                  >
                    <option value="true">Aktif (Kayıt İstekleri Gönderilir)</option>
                    <option value="false">Pasif (Bağlantı Devre Dışı Bırakılır)</option>
                  </select>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-855 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition rounded-xl font-bold text-xs"
                  >
                    Geri
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 transition rounded-xl font-bold text-xs text-white shadow-md shadow-blue-500/15"
                  >
                    <Save size={14} /> Kaydet ve Ekle
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={executeDeleteTrunk}
        title="Bağlantıyı Sil"
        message="Bu dış hat bağlantısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
