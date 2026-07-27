import React, { useState, useEffect } from "react";
import { Building2, Plus, Trash2, Edit3, Shield, CheckCircle, AlertTriangle, Calendar, Clock, Lock, ShieldAlert, Key, Bot, PhoneCall, Cpu, Network, GitMerge, PhoneOutgoing, Users, Volume2, BookOpen, Ban, MapPin, Briefcase, Zap } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiHost";

const DEFAULT_TENANTS = [
  { 
    id: "tenant-default", tenant_num_id: 100, name: "Ana Müşteri (Varsayılan)", code: "default", status: "active", license_expires_at: "", license_key: "AIDA-DEFAULT-ENTERPRISE-2026", plan_tier: "enterprise",
    max_agents: 50, max_rag_docs: 500, max_scenarios: 50,
    max_users: 100, max_announcements: 50, max_queues: 50, max_inbound_rules: 100, max_outbound_rules: 100, max_pickup_groups: 20, max_subscriber_groups: 20, max_phonebook_contacts: 2000, max_trunks: 20, max_conference_rooms: 20, max_speed_dials: 100, max_blacklist_entries: 500, max_locations: 20, max_departments: 30,
    max_call_flows: 50, max_dialers: 20
  },
  { 
    id: "tenant-test-teknoloji", tenant_num_id: 101, name: "Test Teknoloji", code: "test-teknoloji", status: "active", license_expires_at: "2026-12-31", license_key: "AIDA-78B1-99F4-2026", plan_tier: "professional",
    max_agents: 20, max_rag_docs: 100, max_scenarios: 20,
    max_users: 50, max_announcements: 20, max_queues: 10, max_inbound_rules: 25, max_outbound_rules: 25, max_pickup_groups: 10, max_subscriber_groups: 10, max_phonebook_contacts: 500, max_trunks: 5, max_conference_rooms: 5, max_speed_dials: 50, max_blacklist_entries: 100, max_locations: 5, max_departments: 10,
    max_call_flows: 10, max_dialers: 5
  }
];

const PLAN_TIERS = {
  trial: { name: "Trial / Deneme Süresi (30 Gün)", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50" },
  starter: { name: "Starter / Başlangıç Paket", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50" },
  professional: { name: "Professional Paket", color: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/50" },
  enterprise: { name: "Enterprise / Kurumsal Özel", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50" }
};

export default function TenantManagementPanel({ backendHost }) {
  const [tenants, setTenants] = useState(DEFAULT_TENANTS);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  const API_BASE = getApiBaseUrl(backendHost);

  // General Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("active");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(true);
  const [licenseKey, setLicenseKey] = useState("");
  const [planTier, setPlanTier] = useState("professional");

  // 1. Yapay Zeka Kotaları
  const [maxAgents, setMaxAgents] = useState(20);
  const [maxRagDocs, setMaxRagDocs] = useState(100);
  const [maxScenarios, setMaxScenarios] = useState(20);

  // 2. Santral Kotaları
  const [maxUsers, setMaxUsers] = useState(50);
  const [maxAnnouncements, setMaxAnnouncements] = useState(20);
  const [maxQueues, setMaxQueues] = useState(10);
  const [maxInboundRules, setMaxInboundRules] = useState(25);
  const [maxOutboundRules, setMaxOutboundRules] = useState(25);
  const [maxPickupGroups, setMaxPickupGroups] = useState(10);
  const [maxSubscriberGroups, setMaxSubscriberGroups] = useState(10);
  const [maxPhonebookContacts, setMaxPhonebookContacts] = useState(500);
  const [maxTrunks, setMaxTrunks] = useState(5);
  const [maxConferenceRooms, setMaxConferenceRooms] = useState(5);
  const [maxSpeedDials, setMaxSpeedDials] = useState(50);
  const [maxBlacklistEntries, setMaxBlacklistEntries] = useState(100);
  const [maxLocations, setMaxLocations] = useState(5);
  const [maxDepartments, setMaxDepartments] = useState(10);

  // 3. Çağrı Yönlendirme & Akış Kotaları
  const [maxCallFlows, setMaxCallFlows] = useState(10);
  const [maxDialers, setMaxDialers] = useState(5);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);

  useEffect(() => {
    fetchTenants();
  }, [backendHost]);

  const fetchTenants = async () => {
    try {
      let res = await fetch(`${API_BASE}/api/settings/tenants`);
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/tenants`);
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTenants(data);
        }
      }
    } catch (e) {
      console.error("Failed to load tenants", e);
    }
  };


  const handleOpenAddModal = () => {
    setEditingTenant(null);
    setName("");
    setCode("");
    setStatus("active");
    setLicenseExpiresAt("");
    setIsUnlimited(true);
    setLicenseKey("");
    setPlanTier("professional");
    
    // Reset 19 quota fields
    setMaxAgents(20);
    setMaxRagDocs(100);
    setMaxScenarios(20);

    setMaxUsers(50);
    setMaxAnnouncements(20);
    setMaxQueues(10);
    setMaxInboundRules(25);
    setMaxOutboundRules(25);
    setMaxPickupGroups(10);
    setMaxSubscriberGroups(10);
    setMaxPhonebookContacts(500);
    setMaxTrunks(5);
    setMaxConferenceRooms(5);
    setMaxSpeedDials(50);
    setMaxBlacklistEntries(100);
    setMaxLocations(5);
    setMaxDepartments(10);

    setMaxCallFlows(10);
    setMaxDialers(5);

    setErrorMsg("");
    setShowModal(true);
  };

  const handleOpenEditModal = (t) => {
    setEditingTenant(t);
    setName(t.name);
    setCode(t.code);
    setStatus(t.status || "active");
    const hasNoDate = !t.license_expires_at || t.license_expires_at === "" || t.license_expires_at.toLowerCase() === "unlimited";
    setIsUnlimited(hasNoDate);
    setLicenseExpiresAt(hasNoDate ? "" : t.license_expires_at.substring(0, 10));
    setLicenseKey(t.license_key || "");
    setPlanTier(t.plan_tier || "professional");

    // Load 19 quota fields
    setMaxAgents(t.max_agents || 20);
    setMaxRagDocs(t.max_rag_docs || 100);
    setMaxScenarios(t.max_scenarios || 20);

    setMaxUsers(t.max_users || 50);
    setMaxAnnouncements(t.max_announcements || 20);
    setMaxQueues(t.max_queues || 10);
    setMaxInboundRules(t.max_inbound_rules || 25);
    setMaxOutboundRules(t.max_outbound_rules || 25);
    setMaxPickupGroups(t.max_pickup_groups || 10);
    setMaxSubscriberGroups(t.max_subscriber_groups || 10);
    setMaxPhonebookContacts(t.max_phonebook_contacts || 500);
    setMaxTrunks(t.max_trunks || 5);
    setMaxConferenceRooms(t.max_conference_rooms || 5);
    setMaxSpeedDials(t.max_speed_dials || 50);
    setMaxBlacklistEntries(t.max_blacklist_entries || 100);
    setMaxLocations(t.max_locations || 5);
    setMaxDepartments(t.max_departments || 10);

    setMaxCallFlows(t.max_call_flows || 10);
    setMaxDialers(t.max_dialers || 5);

    setErrorMsg("");
    setShowModal(true);
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      setErrorMsg("Lütfen Müşteri / Firma Adı giriniz.");
      return;
    }

    const finalCode = (code.trim() || finalName.toLowerCase())
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    setLoading(true);
    setErrorMsg("");

    try {
      const url = editingTenant 
        ? `${API_BASE}/api/settings/tenants/${editingTenant.id}`
        : `${API_BASE}/api/settings/tenants`;
      const method = editingTenant ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          code: finalCode,
          status: status,
          license_expires_at: isUnlimited ? "" : licenseExpiresAt,
          license_key: licenseKey,
          plan_tier: planTier,
          
          max_agents: parseInt(maxAgents) || 20,
          max_rag_docs: parseInt(maxRagDocs) || 100,
          max_scenarios: parseInt(maxScenarios) || 20,

          max_users: parseInt(maxUsers) || 50,
          max_announcements: parseInt(maxAnnouncements) || 20,
          max_queues: parseInt(maxQueues) || 10,
          max_inbound_rules: parseInt(maxInboundRules) || 25,
          max_outbound_rules: parseInt(maxOutboundRules) || 25,
          max_pickup_groups: parseInt(maxPickupGroups) || 10,
          max_subscriber_groups: parseInt(maxSubscriberGroups) || 10,
          max_phonebook_contacts: parseInt(maxPhonebookContacts) || 500,
          max_trunks: parseInt(maxTrunks) || 5,
          max_conference_rooms: parseInt(maxConferenceRooms) || 5,
          max_speed_dials: parseInt(maxSpeedDials) || 50,
          max_blacklist_entries: parseInt(maxBlacklistEntries) || 100,
          max_locations: parseInt(maxLocations) || 5,
          max_departments: parseInt(maxDepartments) || 10,

          max_call_flows: parseInt(maxCallFlows) || 10,
          max_dialers: parseInt(maxDialers) || 5
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || "İşlem gerçekleştirilemedi.");
      } else {
        setShowModal(false);
        fetchTenants();
      }
    } catch (err) {
      setErrorMsg("Sunucuyla iletişim kurulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTenant = (tenant) => {
    if (tenant.id === "tenant-default") {
      alert("Varsayılan ana müşteri silinemez.");
      return;
    }
    setTenantToDelete(tenant);
    setDeleteModalOpen(true);
  };

  const executeDeleteTenant = async () => {
    if (!tenantToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/tenants/${tenantToDelete.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTenants();
      }
    } catch (e) {
      console.error("Failed to delete tenant", e);
    } finally {
      setDeleteModalOpen(false);
      setTenantToDelete(null);
    }
  };


  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm w-full animate-in fade-in duration-300">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl">
            <Key size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Müşteri (Tenant) Lisans & Kota Yönetim Motoru</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yapay Zeka, Santral ve Çağrı Yönlendirme kotalarını kategorize bölümler altında yönetin.
            </p>
          </div>
        </div>

        {/* Unified Red Plus Add Button Rule */}
        <button
          onClick={handleOpenAddModal}
          className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-md cursor-pointer"
          title="Yeni Müşteri Lisansı Ekle"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Separated Distinct Row List View */}
      <div className="space-y-4">
        
        {/* Table Column Headers Bar */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="col-span-3">Müşteri / Lisans Key</div>
          <div className="col-span-2">Paket & Durum</div>
          <div className="col-span-2">Lisans Bitiş Tarihi</div>
          <div className="col-span-4">Kategorize Kotalar Özeti</div>
          <div className="col-span-1 text-right">İşlemler</div>
        </div>

        {/* Separated Distinct Row Items */}
        {tenants.map((t) => {
          const isPassive = t.status === "passive";
          const isUnlimitedLicense = !t.license_expires_at || t.license_expires_at === "" || t.license_expires_at.toLowerCase() === "unlimited";
          const isExpired = !isUnlimitedLicense && new Date(t.license_expires_at) < new Date();
          const effectivePassive = isPassive || isExpired;
          const tier = PLAN_TIERS[t.plan_tier || "professional"] || PLAN_TIERS.professional;

          return (
            <div
              key={t.id}
              className={`p-5 rounded-2xl border transition-all shadow-sm flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center gap-4 ${
                effectivePassive
                  ? "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                  : "bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {/* Müşteri / Firma Adı & License Key & Tenant ID */}
              <div className="lg:col-span-3 flex flex-col justify-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">{t.name}</span>
                  <span className="text-[10px] font-mono font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50 px-2 py-0.5 rounded-md" title="Asterisk Dialplan Sayısal Tenant ID">
                    Tenant ID: {t.tenant_num_id || 100}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                    <Key size={10} className="text-rose-500" />
                    {t.license_key || `AIDA-${t.code.toUpperCase()}-2026`}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">({t.id})</span>
                </div>
              </div>


              {/* Paket & Durum Rozeti */}
              <div className="lg:col-span-2 flex flex-col items-start gap-1">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-extrabold uppercase border ${tier.color}`}>
                  {t.plan_tier ? t.plan_tier.toUpperCase() : "PROFESSIONAL"}
                </span>

                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ${
                  effectivePassive
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {effectivePassive ? <Lock size={10} /> : <CheckCircle size={10} />}
                  {effectivePassive ? (isExpired ? "Lisans Doldu" : "Pasif") : "Aktif"}
                </span>
              </div>

              {/* Lisans Bitiş Tarihi */}
              <div className="lg:col-span-2 flex items-center">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <Calendar size={14} className="text-rose-500 shrink-0" />
                  <strong className={effectivePassive ? "text-rose-600 dark:text-rose-400 font-mono" : "text-slate-800 dark:text-white font-mono"}>
                    {isUnlimitedLicense ? "♾️ Limitsiz" : t.license_expires_at.substring(0, 10)}
                  </strong>
                </div>
              </div>

              {/* Categorized Quotas View */}
              <div className="lg:col-span-4 flex items-center">
                <div className="flex flex-col gap-1.5 w-full">
                  
                  {/* 1. Yapay Zeka */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">AI</span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Temsilci: <strong className="text-purple-600 font-mono">{t.max_agents || 20}</strong>
                    </span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      RAG: <strong className="text-purple-600 font-mono">{t.max_rag_docs || 100}</strong>
                    </span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Senaryo: <strong className="text-purple-600 font-mono">{t.max_scenarios || 20}</strong>
                    </span>
                  </div>

                  {/* 2. Santral */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">PBX</span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Kullanıcı: <strong className="text-blue-600 font-mono">{t.max_users || 50}</strong>
                    </span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Trunk: <strong className="text-blue-600 font-mono">{t.max_trunks || 5}</strong>
                    </span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Kuyruk: <strong className="text-blue-600 font-mono">{t.max_queues || 10}</strong>
                    </span>
                  </div>

                  {/* 3. Yönlendirme */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">AKIS</span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Akış: <strong className="text-emerald-600 font-mono">{t.max_call_flows || 10}</strong>
                    </span>
                    <span className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-800 font-bold">
                      Dialer: <strong className="text-emerald-600 font-mono">{t.max_dialers || 5}</strong>
                    </span>
                  </div>

                </div>
              </div>

              {/* İşlemler Buttons */}
              <div className="lg:col-span-1 flex items-center justify-end w-full lg:w-auto">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="p-2 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition"
                    title="Lisans ve Kotaları Düzenle"
                  >
                    <Edit3 size={15} />
                  </button>
                  {t.id !== "tenant-default" && (
                    <button
                      onClick={() => confirmDeleteTenant(t)}
                      className="p-2 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400 transition"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Tenant & Categorized Quotas Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Shield size={18} className="text-rose-600" />
              <span>{editingTenant ? "Müşteri Lisansı ve Limitleri Düzenle" : "Yeni Müşteri Lisansı Oluştur"}</span>
            </h4>

            {errorMsg && (
              <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl">
                {errorMsg}
              </div>
            )}

            {editingTenant && (
              <div className="p-3 mb-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Asterisk Dialplan Sayısal Tenant ID:</span>
                <span className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-rose-200 dark:border-rose-900">
                  ID: {editingTenant.tenant_num_id || 100} ({editingTenant.id})
                </span>
              </div>
            )}

            <form onSubmit={handleSaveTenant} className="space-y-5">

              
              {/* Genel Bilgiler */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Müşteri / Firma Adı</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setName(val);
                      if (!editingTenant) {
                        const slug = val
                          .toLowerCase()
                          .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
                          .replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
                        setCode(slug);
                      }
                    }}
                    placeholder="Örn: Acme Holding A.Ş."
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-medium text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kod Adı (Slug Code)</label>
                  <input
                    type="text"
                    disabled={!!editingTenant}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Otomatik Oluşturulur (Örn: acme-corp)"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold text-slate-800 dark:text-white disabled:opacity-60"
                  />

                </div>
              </div>

              {/* Lisans Paketi & Key */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lisans Paketi / Planı</label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-slate-800 dark:text-white"
                  >
                    <option value="trial">Trial / Deneme Süresi (30 Gün)</option>
                    <option value="starter">Starter / Başlangıç Paket</option>
                    <option value="professional">Professional Paket</option>
                    <option value="enterprise">Enterprise / Kurumsal Özel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lisans Anahtarı (Key)</label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Otomatik Oluşturulur"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Status & Expiration */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Müşteri Durumu</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-slate-800 dark:text-white"
                  >
                    <option value="active">🟢 Aktif (Erişim & AI Açık)</option>
                    <option value="passive">🔴 Pasif (Erişim & AI Kapalı)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lisans Bitiş Tarihi</label>
                    <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-600 dark:text-rose-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUnlimited}
                        onChange={(e) => {
                          setIsUnlimited(e.target.checked);
                          if (e.target.checked) setLicenseExpiresAt("");
                        }}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>♾️ Limitsiz</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={isUnlimited}
                    value={isUnlimited ? "" : licenseExpiresAt}
                    onChange={(e) => setLicenseExpiresAt(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-mono font-bold text-slate-800 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                  />
                </div>
              </div>

              {/* SECTION 1: YAPAY ZEKA KOTALARI */}
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  <Bot size={16} />
                  <span>1. Yapay Zeka Kotaları</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">AI Temsilcileri</label>
                    <input
                      type="number"
                      min="1"
                      value={maxAgents}
                      onChange={(e) => setMaxAgents(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">Bilgi Bankası (RAG)</label>
                    <input
                      type="number"
                      min="1"
                      value={maxRagDocs}
                      onChange={(e) => setMaxRagDocs(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">Kural & Senaryo Editörü</label>
                    <input
                      type="number"
                      min="1"
                      value={maxScenarios}
                      onChange={(e) => setMaxScenarios(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: SANTRAL KOTALARI */}
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  <PhoneCall size={16} />
                  <span>2. Santral Kotaları</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Kullanıcılar</label>
                    <input
                      type="number"
                      min="1"
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Anonslar</label>
                    <input
                      type="number"
                      min="1"
                      value={maxAnnouncements}
                      onChange={(e) => setMaxAnnouncements(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Kuyruklar</label>
                    <input
                      type="number"
                      min="1"
                      value={maxQueues}
                      onChange={(e) => setMaxQueues(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Gelen Arama Kuralı</label>
                    <input
                      type="number"
                      min="1"
                      value={maxInboundRules}
                      onChange={(e) => setMaxInboundRules(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Giden Arama Kuralı</label>
                    <input
                      type="number"
                      min="1"
                      value={maxOutboundRules}
                      onChange={(e) => setMaxOutboundRules(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Çağrı Toplama Grubu</label>
                    <input
                      type="number"
                      min="1"
                      value={maxPickupGroups}
                      onChange={(e) => setMaxPickupGroups(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Abone Grubu</label>
                    <input
                      type="number"
                      min="1"
                      value={maxSubscriberGroups}
                      onChange={(e) => setMaxSubscriberGroups(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Rehber Kişileri</label>
                    <input
                      type="number"
                      min="1"
                      value={maxPhonebookContacts}
                      onChange={(e) => setMaxPhonebookContacts(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Dış Hat (SIP Trunk)</label>
                    <input
                      type="number"
                      min="1"
                      value={maxTrunks}
                      onChange={(e) => setMaxTrunks(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Konferans Odaları</label>
                    <input
                      type="number"
                      min="1"
                      value={maxConferenceRooms}
                      onChange={(e) => setMaxConferenceRooms(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Hızlı Arama</label>
                    <input
                      type="number"
                      min="1"
                      value={maxSpeedDials}
                      onChange={(e) => setMaxSpeedDials(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Numara Engelleme</label>
                    <input
                      type="number"
                      min="1"
                      value={maxBlacklistEntries}
                      onChange={(e) => setMaxBlacklistEntries(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Lokasyon</label>
                    <input
                      type="number"
                      min="1"
                      value={maxLocations}
                      onChange={(e) => setMaxLocations(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Departman</label>
                    <input
                      type="number"
                      min="1"
                      value={maxDepartments}
                      onChange={(e) => setMaxDepartments(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: ÇAĞRI YÖNLENDİRME & AKIŞ KOTALARI */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  <GitMerge size={16} />
                  <span>3. Çağrı Yönlendirme & Akış Kotaları</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">Arama Akış Yönetimi (Workflows)</label>
                    <input
                      type="number"
                      min="1"
                      value={maxCallFlows}
                      onChange={(e) => setMaxCallFlows(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:outline-none focus:border-emerald-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">Dış Arama Dialer Seçenekleri</label>
                    <input
                      type="number"
                      min="1"
                      value={maxDialers}
                      onChange={(e) => setMaxDialers(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:outline-none focus:border-emerald-500 font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md transition"
                >
                  {loading ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal Rule Compliance */}
      {deleteModalOpen && tenantToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center scale-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Müşteriyi Silmek İstediğinize Emin Misiniz?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              <strong className="text-slate-800 dark:text-white">{tenantToDelete.name}</strong> isimli kiracı ve ilişkili yapılandırma kaydı sistemden kaldırılacaktır.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Vazgeç
              </button>
              <button
                onClick={executeDeleteTenant}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition"
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
