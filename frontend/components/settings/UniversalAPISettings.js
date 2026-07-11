import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, CheckCircle, Search, Cable, Check, X, ShieldAlert, Sparkles, Send, Play, Bot, User, HelpCircle, AlertCircle, Save, Database, History, Terminal, Fingerprint } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function UniversalAPISettings({ backendHost = "localhost:8000" }) {
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingApi, setEditingApi] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedApi, setSelectedApi] = useState(null);

  // Voice Biometric Settings States
  const [bioEnabled, setBioEnabled] = useState(true);
  const [bioThreshold, setBioThreshold] = useState(80);
  const [bioAutoBlacklist, setBioAutoBlacklist] = useState(false);
  const [savingBioSettings, setSavingBioSettings] = useState(false);

  // Form Fields (in Modal)
  const [apiId, setApiId] = useState("");
  const [apiName, setApiName] = useState("");
  const [apiDescription, setApiDescription] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiMethod, setApiMethod] = useState("GET");
  const [headers, setHeaders] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [isActive, setIsActive] = useState(true);

  // Test Sandbox States (for Middle Column)
  const [testArgs, setTestArgs] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Assistant Chat States (for Right Column)
  const [chatMessages, setChatMessages] = useState([
    { sender: "bot", text: "Merhaba! Ben Evrensel API Entegrasyon Asistanıyım.\n\nCRM veya 3. parti API sistemlerinizi (örn: kargo takip, borç sorgulama vb.) yapay zekaya nasıl entegre edeceğiniz konusunda size yardımcı olabilirim. Sorularınızı yazabilir veya bir cURL isteği yapıştırarak alanları doldurmamı isteyebilirsiniz." }
  ]);
  const [userInput, setUserInput] = useState("");
  const [botTyping, setBotTyping] = useState(false);
  const chatEndRef = useRef(null);

  // RBAC Permission States
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Mock Activity Logs
  const [activityLogs, setActivityLogs] = useState([
    { id: 1, time: "00:15:22", channel: "WhatsApp", api: "kargo_sorgu", param: 'tracking_no: "MNG8872"', status: 200, label: "OK" },
    { id: 2, time: "00:08:10", channel: "Telefon (Ses)", api: "borc_sorgula", param: 'tckn: "283******92"', status: 200, label: "OK" },
    { id: 3, time: "23:54:19", channel: "Instagram", api: "kargo_sorgu", param: 'tracking_no: "invalid_no"', status: 404, label: "NOT FOUND" }
  ]);

  useEffect(() => {
    fetchApis();
    checkPermissions();
    fetchBioSettings();
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
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar kaydedilemedi:", err);
    } finally {
      setSavingBioSettings(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, botTyping]);

  const checkPermissions = async () => {
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`);
      const statusData = await resStatus.json();
      if (!statusData.is_logged_in) {
        setHasWritePermission(true);
        setHasDeletePermission(true);
        return;
      }
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const usersData = await resUsers.json();
      const currentUser = usersData.find(u => u.id === statusData.user_id);
      if (!currentUser) {
        setHasWritePermission(true);
        setHasDeletePermission(true);
        return;
      }
      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const rolesData = await resRoles.json();
      const currentRole = rolesData.find(r => r.role_code === currentUser.role);
      if (!currentRole) {
        setHasWritePermission(true);
        setHasDeletePermission(true);
        return;
      }
      setHasWritePermission(currentRole.permissions.includes("universal_api:write"));
      setHasDeletePermission(currentRole.permissions.includes("universal_api:delete"));
    } catch (err) {
      console.error("Yetki kontrol hatası:", err);
      setHasWritePermission(true);
      setHasDeletePermission(true);
    }
  };

  const fetchApis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/custom-apis`);
      if (res.ok) {
        const data = await res.json();
        setApis(data);
        if (data.length > 0 && !selectedApi) {
          selectApiForTesting(data[0]);
        }
      }
    } catch (err) {
      console.error("Özel API'ler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectApiForTesting = (api) => {
    setSelectedApi(api);
    setTestResult(null);
    const args = {};
    (api.parameters || []).forEach(p => {
      args[p.name] = p.type === "number" ? 0 : p.type === "boolean" ? false : "";
    });
    setTestArgs(args);
  };

  const saveAllApis = async (updatedApis) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/custom-apis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_apis: updatedApis })
      });
      if (res.ok) {
        setApis(updatedApis);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("API'ler kaydedilemedi:", err);
    }
  };

  const openAddModal = () => {
    if (!hasWritePermission) return;
    setEditingApi(null);
    setApiId("");
    setApiName("");
    setApiDescription("");
    setApiUrl("");
    setApiMethod("GET");
    setHeaders([]);
    setParameters([]);
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (api, e) => {
    e.stopPropagation(); // Prevent changing selection
    setEditingApi(api);
    setApiId(api.id);
    setApiName(api.name);
    setApiDescription(api.description);
    setApiUrl(api.url);
    setApiMethod(api.method);
    setHeaders(api.headers || []);
    setParameters(api.parameters || []);
    setIsActive(api.is_active !== false);
    setShowModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!hasWritePermission) return;
    if (!apiId.trim() || !apiName.trim() || !apiUrl.trim()) return;

    // Validate API ID slug format
    const slugRegex = /^[a-z0-9_]+$/;
    if (!slugRegex.test(apiId.trim())) {
      alert("API Anahtarı yalnızca küçük harf, rakam ve alt çizgi (_) içerebilir!");
      return;
    }

    const payload = {
      id: apiId.trim(),
      name: apiName.trim(),
      description: apiDescription.trim(),
      url: apiUrl.trim(),
      method: apiMethod,
      headers: headers.filter(h => h.name.trim()),
      parameters: parameters.filter(p => p.name.trim()),
      is_active: isActive
    };

    let updated;
    if (editingApi) {
      updated = apis.map(a => a.id === editingApi.id ? payload : a);
    } else {
      if (apis.some(a => a.id === payload.id)) {
        alert("Bu API Anahtarı zaten kullanımda!");
        return;
      }
      updated = [...apis, payload];
    }

    saveAllApis(updated);
    setShowModal(false);
    
    // Auto select saved api
    setSelectedApi(payload);
    selectApiForTesting(payload);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (!hasDeletePermission) return;
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const updated = apis.filter(a => a.id !== deleteTargetId);
    saveAllApis(updated);
    setDeleteTargetId(null);
    if (selectedApi && selectedApi.id === deleteTargetId) {
      setSelectedApi(updated.length > 0 ? updated[0] : null);
    }
  };

  // Header helpers
  const addHeader = () => {
    setHeaders([...headers, { name: "", value: "" }]);
  };

  const updateHeader = (index, key, val) => {
    const updated = [...headers];
    updated[index][key] = val;
    setHeaders(updated);
  };

  const removeHeader = (index) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  // Parameter helpers
  const addParameter = () => {
    setParameters([...parameters, { name: "", type: "string", location: "query", description: "", required: false }]);
  };

  const updateParameter = (index, key, val) => {
    const updated = [...parameters];
    updated[index][key] = val;
    setParameters(updated);
  };

  const removeParameter = (index) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  // Test Sandbox execution (Middle Column)
  const runApiTest = async () => {
    if (!selectedApi) return;
    setTesting(true);
    setTestResult(null);
    try {
      const payload = {
        url: selectedApi.url,
        method: selectedApi.method,
        headers: selectedApi.headers || [],
        parameters: selectedApi.parameters || [],
        test_args: testArgs
      };
      
      const res = await fetch(`${API_BASE}/api/settings/custom-apis/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
        
        // Add a log to activity logs dynamically on successful run
        const newLog = {
          id: Date.now(),
          time: new Date().toTimeString().split(" ")[0],
          channel: "Sandbox Test",
          api: selectedApi.id,
          param: Object.entries(testArgs).map(([k, v]) => `${k}: "${v}"`).join(", ") || "none",
          status: data.http_status || 200,
          label: data.http_status === 200 ? "OK" : "ERROR"
        };
        setActivityLogs(prev => [newLog, ...prev.slice(0, 4)]);
      } else {
        setTestResult({ status: "error", message: `HTTP Error: ${res.status}` });
      }
    } catch (err) {
      setTestResult({ status: "error", message: err.message });
    } finally {
      setTesting(false);
    }
  };

  // AI Assistant chat logic
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setUserInput("");
    setBotTyping(true);

    try {
      const res = await fetch(`${API_BASE}/api/settings/custom-apis/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: chatMessages.slice(-10)
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: "bot", text: data.text }]);
      } else {
        setChatMessages(prev => [...prev, { sender: "bot", text: "Özür dilerim, şu an bağlantı kuramıyorum." }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: "bot", text: "Sunucu hatası oluştu." }]);
    } finally {
      setBotTyping(false);
    }
  };

  const filteredApis = apis.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic preview URL helper
  const getPreviewUrl = () => {
    if (!selectedApi) return "";
    let preview = selectedApi.url;
    
    // Replace path parameters
    Object.entries(testArgs).forEach(([key, val]) => {
      preview = preview.replace(`{${key}}`, val || `{${key}}`);
    });
    
    // Append query parameters
    const queryParams = [];
    (selectedApi.parameters || []).forEach(p => {
      if (p.location === "query" && testArgs[p.name]) {
        queryParams.push(`${p.name}=${encodeURIComponent(testArgs[p.name])}`);
      }
    });
    
    if (queryParams.length > 0) {
      preview += (preview.includes("?") ? "&" : "?") + queryParams.join("&");
    }
    
    return preview;
  };

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full max-w-7xl animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-650 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl">
            <Cable size={22} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Evrensel API ve Webhook Sihirbazı</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">CRM, kargo ve borç sorgulama servislerinizi low-code olarak yapay zekaya bağlayın.</p>
          </div>
        </div>
        {hasWritePermission && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-200"
          >
            <Plus size={14} /> Yeni API Ekle
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-305 text-xs flex items-center gap-2 font-semibold shadow-sm">
          <CheckCircle size={15} />
          <span>API entegrasyonları başarıyla kaydedildi! Yapay zeka bu servisleri kullanmaya başlayacaktır.</span>
        </div>
      )}

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: API List (col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-500" size={14} />
            <input
              type="text"
              placeholder="API adı veya anahtarı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold shadow-sm transition-all"
            />
          </div>

          {/* Scrollable API List */}
          <div className="flex-1 min-h-[480px] max-h-[580px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {filteredApis.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl text-center space-y-3 h-full">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-500 rounded-full">
                  <Cable size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">API Tanımı Bulunmamaktadır</h4>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 max-w-sm font-semibold">CRM entegrasyonunuz bulunmuyor. Yeni bir API eklemek için yukarıdaki butonu kullanın.</p>
                </div>
              </div>
            ) : (
              filteredApis.map((api) => (
                <div
                  key={api.id}
                  onClick={() => selectApiForTesting(api)}
                  className={`p-4 rounded-2xl border transition-all duration-250 cursor-pointer text-left space-y-2.5 shadow-sm relative group ${
                    selectedApi && selectedApi.id === api.id
                      ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-350 dark:border-indigo-800 ring-1 ring-indigo-300/20"
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/85 hover:border-slate-350 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded-md uppercase tracking-wider ${
                          api.method === "GET" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30" :
                          api.method === "POST" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30" :
                          "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450 border border-amber-100/50 dark:border-amber-900/30"
                        }`}>
                          {api.method}
                        </span>
                        <h3 className="font-bold text-xs text-slate-800 dark:text-white line-clamp-1">{api.name}</h3>
                      </div>
                      <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 break-all">{api.id}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => openEditModal(api, e)}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Edit2 size={12} />
                      </button>
                      {hasDeletePermission && (
                        <button
                          onClick={(e) => handleDelete(api.id, e)}
                          className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold line-clamp-2 leading-relaxed">
                    {api.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Column: Live Sandbox & Activity Logs (col-span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Test Sandbox card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4 text-left flex-1 flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-900/20 rounded-xl">
                  <Play size={14} className="fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">API Test Sandbox</h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
                    {selectedApi ? `custom_api_${selectedApi.id}` : "Seçili API Yok"}
                  </p>
                </div>
              </div>
              {selectedApi && (
                <button
                  onClick={runApiTest}
                  disabled={testing}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-550 text-white disabled:opacity-40 transition font-bold rounded-xl text-[10px] shadow-sm flex items-center gap-1 shrink-0"
                >
                  {testing ? "İstek Atılıyor..." : "Çalıştır"}
                </button>
              )}
            </div>

            {selectedApi ? (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1 scrollbar-thin text-[11px] font-semibold text-slate-700 dark:text-slate-350">
                {/* Endpoint URL Preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase">Endpoint URL</span>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all select-all">
                    <span className="font-extrabold text-indigo-600 mr-1.5">{selectedApi.method}</span>
                    {getPreviewUrl()}
                  </div>
                </div>

                {/* Parameters inputs */}
                {selectedApi.parameters && selectedApi.parameters.length > 0 ? (
                  <div className="space-y-3">
                    <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase">Parametre Değerleri</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedApi.parameters.map((p, index) => (
                        <div key={index} className="space-y-1">
                          <label className="block text-[9px] font-bold text-slate-500">
                            {p.name} {p.required && <span className="text-red-500">*</span>}
                            <span className="font-mono text-[8px] text-slate-400 dark:text-slate-500 ml-1">({p.location})</span>
                          </label>
                          <input
                            type="text"
                            placeholder={p.description || "Değer giriniz"}
                            value={testArgs[p.name] || ""}
                            onChange={(e) => setTestArgs({ ...testArgs, [p.name]: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-[10px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold italic">Bu API herhangi bir dinamik parametre gerektirmiyor.</p>
                )}

                {/* Result output */}
                {testResult && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/40">
                    <div className="flex items-center justify-between text-[9px] font-bold">
                      <span className="text-slate-450">HTTP Yanıt Kodu:</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono ${testResult.http_status === 200 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600" : "bg-rose-50 dark:bg-rose-950/40 text-rose-500"}`}>
                        {testResult.http_status || "HATA"}
                      </span>
                    </div>
                    <pre className="p-3 bg-slate-950 text-slate-350 font-mono text-[9px] rounded-xl overflow-x-auto max-h-[140px] border border-slate-850 scrollbar-thin">
                      {typeof testResult.data === "object" ? JSON.stringify(testResult.data, null, 2) : testResult.data}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 text-slate-400 rounded-full">
                  <Play size={20} />
                </div>
                <p className="text-[10px] text-slate-450 font-semibold max-w-xs">Test etmek ve istek simüle etmek için sol sütundan bir API seçin.</p>
              </div>
            )}
          </div>

          {/* Activity Logs card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-3.5 text-left h-[230px] shrink-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-600/15 text-indigo-650 dark:text-indigo-400 border border-indigo-100/40 dark:border-indigo-900/20 rounded-xl">
                  <Terminal size={14} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Canlı Entegrasyon Logları</h3>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[155px] pr-1 scrollbar-thin">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex gap-2.5 items-start text-[10px] font-semibold border-b border-slate-100/50 dark:border-slate-850 pb-2">
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[9px] mt-0.5">{log.time}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">custom_api_{log.api}</span>
                      <span className="text-slate-450 dark:text-slate-500">kanal: {log.channel}</span>
                    </div>
                    <p className="text-[9px] font-mono text-slate-500 dark:text-slate-400 break-all">{log.param}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-md font-mono text-[8px] font-bold ${
                    log.status === 200 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" : "bg-rose-50 dark:bg-rose-950/30 text-rose-500"
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Setup Copilot Chatbot (col-span-3) */}
        <div className="lg:col-span-3 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300 items-stretch min-h-[580px]">
          {/* Copilot Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 shrink-0">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-600/15 text-indigo-650 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl">
              <Sparkles size={16} className="animate-pulse" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Entegrasyon Asistanı</h3>
              <p className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold font-mono">LLM API Copilot</p>
            </div>
          </div>

          {/* Copilot Chat Window */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs mb-3 scrollbar-thin">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 max-w-[88%] ${
                  msg.sender === "bot" ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
                }`}
              >
                <div className={`h-6 w-6 rounded-xl flex items-center justify-center shrink-0 border ${
                  msg.sender === "bot" 
                    ? "bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-450 border-indigo-100/50 dark:border-indigo-900/30" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 border-slate-200/60 dark:border-slate-800"
                }`}>
                  {msg.sender === "bot" ? <Bot size={12} /> : <User size={12} />}
                </div>
                <div className={`p-2.5 rounded-2xl border leading-relaxed whitespace-pre-line text-[10px] font-semibold shadow-sm text-left ${
                  msg.sender === "bot" 
                    ? "bg-slate-50 dark:bg-slate-950/65 border-slate-200/60 dark:border-slate-850 text-slate-705 dark:text-slate-300 rounded-tl-none" 
                    : "bg-indigo-600 border-indigo-700 text-white rounded-tr-none"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {botTyping && (
              <div className="flex gap-2 mr-auto flex-row max-w-[85%]">
                <div className="h-6 w-6 rounded-xl flex items-center justify-center shrink-0 border bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-450 border-indigo-100/50 dark:border-indigo-900/30">
                  <Bot size={12} className="animate-spin" />
                </div>
                <div className="p-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-950/65 border-slate-200/60 dark:border-slate-850 text-slate-450 rounded-tl-none text-[10px] font-semibold text-left">
                  Cevap yazılıyor...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Copilot Chat Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3 shrink-0">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="API cURL isteğini yapıştırın veya soru sorun..."
              className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-[10px] focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold shadow-inner"
            />
            <button
              type="submit"
              className="flex items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-550 text-white transition rounded-xl shrink-0 shadow-md shadow-indigo-550/15"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* NEW/EDIT API MODAL (GLASSMORPHISM BACKDROP) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 transition-all duration-300">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-855 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Cable size={14} className="text-indigo-550" />
                {editingApi ? "API Düzenle" : "Yeni API Ekle"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-lg transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[11px] font-semibold text-slate-700 dark:text-slate-350 scrollbar-thin">
              <form id="api-form" onSubmit={handleFormSubmit} className="space-y-5">
                {/* ID, Name & Method */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase mb-1.5">API Anahtarı (ID) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      disabled={!!editingApi}
                      placeholder="kargo_sorgu"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono text-[11px] font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase mb-1.5">API Adı (Başlık) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="MNG Kargo Takip Servisi"
                      value={apiName}
                      onChange={(e) => setApiName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* LLM Description Instruction */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase mb-1.5">Yapay Zeka Açıklaması (LLM Instruction) <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Müşteri kargo durumunu sorduğunda bu fonksiyonu çağırın. Kargo takip numarası (kargo_no) parametresi gereklidir."
                    value={apiDescription}
                    onChange={(e) => setApiDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed font-semibold text-[10px]"
                  />
                  <p className="text-[9px] text-slate-455 dark:text-slate-500 font-semibold mt-1">Yapay zeka bu açıklamayı okuyarak fonksiyonu hangi senaryoda çağıracağına karar verir.</p>
                </div>

                {/* URL and HTTP Method */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase mb-1.5">Metot <span className="text-rose-500">*</span></label>
                    <select
                      value={apiMethod}
                      onChange={(e) => setApiMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 font-extrabold"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase mb-1.5">Endpoint URL <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="https://api.crm.com/v1/shipments/{kargo_no}"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-[11px] font-bold"
                    />
                  </div>
                </div>

                {/* Headers configuration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase">Headers (Başlıklar)</label>
                    <button
                      type="button"
                      onClick={addHeader}
                      className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-650 hover:text-indigo-505 transition"
                    >
                      <Plus size={12} /> Header Ekle
                    </button>
                  </div>
                  
                  {headers.length === 0 ? (
                    <p className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold italic">Header tanımlanmadı (varsayılan olarak Content-Type: application/json gönderilir).</p>
                  ) : (
                    <div className="space-y-2">
                      {headers.map((h, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Authorization"
                            value={h.name}
                            onChange={(e) => updateHeader(index, "name", e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Bearer token_12345"
                            value={h.value}
                            onChange={(e) => updateHeader(index, "value", e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeHeader(index)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parameters configuration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-455 uppercase">API Parametreleri</label>
                    <button
                      type="button"
                      onClick={addParameter}
                      className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-650 hover:text-indigo-505 transition"
                    >
                      <Plus size={12} /> Parametre Ekle
                    </button>
                  </div>

                  {parameters.length === 0 ? (
                    <p className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold italic">Dinamik parametre eklenmedi.</p>
                  ) : (
                    <div className="space-y-3">
                      {parameters.map((p, index) => (
                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col gap-2 relative">
                          <button
                            type="button"
                            onClick={() => removeParameter(index)}
                            className="absolute right-2 top-2 p-1 text-slate-450 hover:text-rose-500 transition"
                          >
                            <X size={12} />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              required
                              placeholder="Parametre Adı (örn: kargo_no)"
                              value={p.name}
                              onChange={(e) => updateParameter(index, "name", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono font-bold"
                            />
                            <select
                              value={p.type}
                              onChange={(e) => updateParameter(index, "type", e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none font-bold"
                            >
                              <option value="string">STRING</option>
                              <option value="number">NUMBER</option>
                              <option value="boolean">BOOLEAN</option>
                            </select>
                            <select
                              value={p.location}
                              onChange={(e) => updateParameter(index, "location", e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none font-bold"
                            >
                              <option value="query">Query Parameter</option>
                              <option value="body">Body JSON Field</option>
                              <option value="path">Path Parameter</option>
                            </select>
                            <div className="flex items-center gap-1.5 pl-2 mt-1 md:mt-0">
                              <input
                                type="checkbox"
                                id={`req-${index}`}
                                checked={p.required}
                                onChange={(e) => updateParameter(index, "required", e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                              <label htmlFor={`req-${index}`} className="text-[9px] font-extrabold text-slate-500 select-none">Zorunlu</label>
                            </div>
                          </div>
                          
                          <input
                            type="text"
                            placeholder="Parametre Açıklaması (LLM için örn: 12 haneli sipariş takip numarası)"
                            value={p.description}
                            onChange={(e) => updateParameter(index, "description", e.target.value)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* API Status Switch */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-[10px] uppercase text-slate-650 dark:text-slate-300">Entegrasyon Durumu</span>
                    <p className="text-[9px] text-slate-455 dark:text-slate-500 font-semibold">Aktif edildiğinde yapay zeka bu aracı aramada kullanabilir.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isActive ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850 transition font-bold"
              >
                Kapat
              </button>
              {hasWritePermission && (
                <button
                  type="submit"
                  form="api-form"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl shadow-md font-bold transition flex items-center gap-1.5"
                >
                  <Save size={13} /> Kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL (CUSTOM APPLICATION-NATIVE) */}
      <ConfirmDeleteModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="API Bağlantısını Sil"
        message="Bu özel API entegrasyon tanımını silmek istediğinize emin misiniz? Bu işlem silinen servisin yapay zeka tarafından sesli arama esnasında kullanılmasını engelleyecektir."
      />
    </div>
  );
}
