import React, { useState, useEffect } from "react";
import { Building2, ChevronDown, Check, ShieldCheck } from "lucide-react";

const DEFAULT_TENANTS = [
  { id: "tenant-default", name: "Ana Müşteri (Varsayılan)", code: "default", status: "active" },
  { id: "tenant-test-teknoloji", name: "Test Teknoloji", code: "test-teknoloji", status: "active", max_agents: 20, max_trunks: 20 }
];

export default function TenantSwitcher({ backendHost }) {
  const [tenants, setTenants] = useState(DEFAULT_TENANTS);
  const [activeTenant, setActiveTenant] = useState(DEFAULT_TENANTS[0]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const savedTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    const matched = DEFAULT_TENANTS.find(t => t.id === savedTenantId) || DEFAULT_TENANTS[0];
    setActiveTenant(matched);
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:3000");
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";

      
      let res = await fetch(`${protocol}//${host}/api/settings/tenants`);
      if (!res.ok) {
        res = await fetch(`${protocol}//${host}/api/tenants`);
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTenants(data);
          const savedTenantId = localStorage.getItem("active_tenant_id") || "tenant-default";
          const matched = data.find(t => t.id === savedTenantId) || data[0];
          setActiveTenant(matched);
          localStorage.setItem("active_tenant_id", matched.id);
        }
      }
    } catch (e) {
      console.error("Failed to load tenants", e);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchTenants();
    }
    setIsOpen(!isOpen);
  };

  const handleSelectTenant = (tenant) => {
    setActiveTenant(tenant);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_tenant_id", tenant.id);
      window.dispatchEvent(new CustomEvent("tenantChanged", { detail: tenant }));
    }
    setIsOpen(false);
  };

  if (!activeTenant) return null;

  return (
    <div className="relative z-30">
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-all shadow-sm cursor-pointer"
        title="Aktif Müşteri / Tenant Değiştir"
      >
        <Building2 size={15} className="text-rose-600 dark:text-rose-500" />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[9px] text-slate-400 dark:text-slate-400 font-extrabold uppercase tracking-wider">Aktif Sistem</span>
          <span className="font-bold text-slate-800 dark:text-white max-w-[120px] truncate">{activeTenant.name}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <ShieldCheck size={14} className="text-rose-500" />
              <span>Müşteri Seçici (Superadmin)</span>
            </div>
            <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md font-extrabold">
              {tenants.length} Tenant
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleSelectTenant(tenant)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  activeTenant.id === tenant.id
                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white border border-transparent"
                }`}
              >
                <div className="flex flex-col leading-tight">
                  <span className="font-bold">{tenant.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tenant ID: {tenant.tenant_num_id || 100} ({tenant.id})</span>
                </div>

                {activeTenant.id === tenant.id && (
                  <Check size={16} className="text-rose-600 dark:text-rose-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
