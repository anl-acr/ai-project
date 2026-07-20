import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X, MapPin, Save, CheckCircle, Map, Building2 } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function LocationsDepartmentsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [newLocationName, setNewLocationName] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [selectedLocationForDept, setSelectedLocationForDept] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteTargetType, setDeleteTargetType] = useState(null); // 'location' or 'department'

  const [editingLocId, setEditingLocId] = useState(null);
  const [editLocName, setEditLocName] = useState("");

  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptLocId, setEditDeptLocId] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (locations.length > 0 && !selectedLocationForDept) {
      setSelectedLocationForDept(locations[0].id);
    }
  }, [locations, selectedLocationForDept]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/settings/locations`).then(r => r.json()),
      fetch(`${API_BASE}/api/settings/departments`).then(r => r.json())
    ]).then(([locData, deptData]) => {
      setLocations(locData || []);
      setDepartments(deptData || []);
      if (locData && locData.length > 0) {
        setSelectedLocationForDept(locData[0].id);
      }
    }).catch(err => {
      console.error("Veriler yüklenemedi:", err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleSaveLocations = async (updatedList) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedList)
      });
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations);
        showSuccess();
      }
    } catch (err) {
      console.error("Lokasyon kaydedilemedi:", err);
    }
  };

  const handleSaveDepartments = async (updatedList) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedList)
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments);
        showSuccess();
      }
    } catch (err) {
      console.error("Departman kaydedilemedi:", err);
    }
  };

  const showSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleAddLocation = (e) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    const newList = [...locations, { name: newLocationName.trim() }];
    handleSaveLocations(newList);
    setNewLocationName("");
  };

  const handleAddDepartment = (e) => {
    e.preventDefault();
    if (!newDepartmentName.trim() || !selectedLocationForDept) return;
    const newList = [...departments, { name: newDepartmentName.trim(), location_id: selectedLocationForDept }];
    handleSaveDepartments(newList);
    setNewDepartmentName("");
  };

  const startEditLocation = (loc) => {
    setEditingLocId(loc.id);
    setEditLocName(loc.name);
  };

  const saveEditLocation = () => {
    const newList = locations.map(l => l.id === editingLocId ? { ...l, name: editLocName } : l);
    handleSaveLocations(newList);
    setEditingLocId(null);
  };

  const startEditDepartment = (dept) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptLocId(dept.location_id);
  };

  const saveEditDepartment = () => {
    const newList = departments.map(d => d.id === editingDeptId ? { ...d, name: editDeptName, location_id: editDeptLocId } : d);
    handleSaveDepartments(newList);
    setEditingDeptId(null);
  };

  const handleDelete = (id, type) => {
    setDeleteTargetId(id);
    setDeleteTargetType(type);
  };

  const confirmDelete = () => {
    if (deleteTargetType === "location") {
      const newList = locations.filter(l => l.id !== deleteTargetId);
      handleSaveLocations(newList);
    } else {
      const newList = departments.filter(d => d.id !== deleteTargetId);
      handleSaveDepartments(newList);
    }
    setDeleteTargetId(null);
    setDeleteTargetType(null);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            Lokasyon ve Departmanlar
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sisteme tanımlı fiziki lokasyonlar ve bunlara bağlı departmanları yönetin.</p>
        </div>
        {success && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold animate-in fade-in duration-200">
            <CheckCircle size={14} /> Kaydedildi
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LOKASYONLAR */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <Map size={16} className="text-slate-500" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Lokasyonlar</h4>
          </div>
          
          <form onSubmit={handleAddLocation} className="flex items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="Yeni Lokasyon Adı"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className={`flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <button
              type="submit"
              disabled={!newLocationName.trim()}
              className={`h-8 w-8 flex items-center justify-center rounded-xl text-white font-bold transition-all shadow-sm shrink-0 ${!newLocationName.trim() ? "bg-slate-300 dark:bg-slate-700" : `${bg} ${hover}`}`}
              title="Yeni Ekle"
            >
              <Plus size={16} />
            </button>
          </form>

          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 max-h-[400px]">
            {locations.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">Henüz lokasyon eklenmemiş.</div>
            ) : (
              locations.map(loc => (
                <div key={loc.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {editingLocId === loc.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editLocName}
                        onChange={(e) => setEditLocName(e.target.value)}
                        className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                      />
                      <button onClick={saveEditLocation} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Check size={14} /></button>
                      <button onClick={() => setEditingLocId(null)} className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-xs text-slate-700 dark:text-slate-300">{loc.name}</div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => startEditLocation(loc)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"><Edit2 size={12} /></button>
                        <button onClick={() => handleDelete(loc.id, 'location')} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={12} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* DEPARTMANLAR */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-slate-500" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Departmanlar</h4>
          </div>

          <form onSubmit={handleAddDepartment} className="flex items-center gap-2 mb-4">
            <select
              value={selectedLocationForDept}
              onChange={(e) => setSelectedLocationForDept(e.target.value)}
              className="text-xs px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none w-1/3"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
              {locations.length === 0 && <option value="">Önce Lokasyon Ekle</option>}
            </select>
            <input
              type="text"
              placeholder="Yeni Departman"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              className={`flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <button
              type="submit"
              disabled={!newDepartmentName.trim() || !selectedLocationForDept}
              className={`h-8 w-8 flex items-center justify-center rounded-xl text-white font-bold transition-all shadow-sm shrink-0 ${(!newDepartmentName.trim() || !selectedLocationForDept) ? "bg-slate-300 dark:bg-slate-700" : `${bg} ${hover}`}`}
              title="Yeni Ekle"
            >
              <Plus size={16} />
            </button>
          </form>

          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 max-h-[400px]">
            {departments.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">Henüz departman eklenmemiş.</div>
            ) : (
              departments.map(dept => {
                const locName = locations.find(l => String(l.id) === String(dept.location_id))?.name || "Bilinmiyor";
                return (
                  <div key={dept.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {editingDeptId === dept.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <select
                          value={editDeptLocId}
                          onChange={(e) => setEditDeptLocId(e.target.value)}
                          className="w-1/3 text-[10px] px-1 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                        >
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editDeptName}
                          onChange={(e) => setEditDeptName(e.target.value)}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                        />
                        <button onClick={saveEditDepartment} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Check size={14} /></button>
                        <button onClick={() => setEditingDeptId(null)} className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100"><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-slate-700 dark:text-slate-300">{dept.name}</span>
                          <span className="text-[9px] text-slate-400">{locName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEditDepartment(dept)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"><Edit2 size={12} /></button>
                          <button onClick={() => handleDelete(dept.id, 'department')} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={12} /></button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      <ConfirmDeleteModal 
        isOpen={!!deleteTargetId}
        onClose={() => { setDeleteTargetId(null); setDeleteTargetType(null); }}
        onConfirm={confirmDelete}
        title={deleteTargetType === "location" ? "Lokasyonu Sil" : "Departmanı Sil"}
        message={deleteTargetType === "location" ? "Bu lokasyonu silmek istediğinize emin misiniz? (Bağlı departmanları da manuel silmeniz gerekebilir)" : "Bu departmanı silmek istediğinize emin misiniz?"}
      />
    </div>
  );
}
