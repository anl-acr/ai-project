import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, X, Users, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const DualListBox = ({ 
  title, 
  availableItems, 
  selectedIds, 
  onChangeSelectedIds, 
  columns, 
  renderRow,
  bg, hover, text, border, lightBg
}) => {
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [checkedAvailable, setCheckedAvailable] = useState([]);
  const [checkedSelected, setCheckedSelected] = useState([]);

  const unselectedItems = availableItems.filter(i => !selectedIds.includes(i.id));
  const selectedItems = selectedIds.map(id => availableItems.find(i => i.id === id)).filter(Boolean);

  const filteredAvailable = unselectedItems.filter(i => 
    Object.values(i).some(v => String(v).toLowerCase().includes(availableSearch.toLowerCase()))
  );
  const filteredSelected = selectedItems.filter(i => 
    Object.values(i).some(v => String(v).toLowerCase().includes(selectedSearch.toLowerCase()))
  );

  const toggleAvailable = (id) => {
    setCheckedAvailable(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const toggleSelected = (id) => {
    setCheckedSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const moveRight = (e) => {
    e.preventDefault();
    onChangeSelectedIds([...selectedIds, ...checkedAvailable]);
    setCheckedAvailable([]);
  };

  const moveLeft = (e) => {
    e.preventDefault();
    onChangeSelectedIds(selectedIds.filter(id => !checkedSelected.includes(id)));
    setCheckedSelected([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h4>
      <div className="flex flex-col md:flex-row items-stretch gap-4 w-full">
        {/* Available List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[300px]">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
              <input 
                type="checkbox" 
                checked={checkedAvailable.length === filteredAvailable.length && filteredAvailable.length > 0}
                onChange={(e) => setCheckedAvailable(e.target.checked ? filteredAvailable.map(i => i.id) : [])}
                className="w-4 h-4 rounded border-slate-300"
              />
              {filteredAvailable.length} Öğe
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Müsait</span>
          </div>
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Arama..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900/50 z-10">
                <tr>
                  <th className="p-2 w-8"></th>
                  {columns.map((col, idx) => <th key={idx} className="p-2 font-semibold text-slate-500">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${checkedAvailable.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleAvailable(item.id)}
                  >
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={checkedAvailable.includes(item.id)} 
                        onChange={() => toggleAvailable(item.id)} 
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300" 
                      />
                    </td>
                    {renderRow(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer Buttons */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 px-2">
          <button onClick={moveRight} disabled={checkedAvailable.length === 0} className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${checkedAvailable.length > 0 ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors`}>
            <ChevronRight size={18} className="hidden md:block" />
            <ChevronRight size={18} className="block md:hidden rotate-90" />
          </button>
          <button onClick={moveLeft} disabled={checkedSelected.length === 0} className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${checkedSelected.length > 0 ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors`}>
            <ChevronLeft size={18} className="hidden md:block" />
            <ChevronLeft size={18} className="block md:hidden rotate-90" />
          </button>
        </div>

        {/* Selected List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[300px]">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
              <input 
                type="checkbox" 
                checked={checkedSelected.length === filteredSelected.length && filteredSelected.length > 0}
                onChange={(e) => setCheckedSelected(e.target.checked ? filteredSelected.map(i => i.id) : [])}
                className="w-4 h-4 rounded border-slate-300"
              />
              {filteredSelected.length} Öğe
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seçili</span>
          </div>
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Arama..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900/50 z-10">
                <tr>
                  <th className="p-2 w-8"></th>
                  {columns.map((col, idx) => <th key={idx} className="p-2 font-semibold text-slate-500">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredSelected.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${checkedSelected.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={checkedSelected.includes(item.id)} 
                        onChange={() => toggleSelected(item.id)} 
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300" 
                      />
                    </td>
                    {renderRow(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CallPickupGroupsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg } = useTheme();

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  
  const [formData, setFormData] = useState({
    name: "",
    extensions: []
  });

  const apiHost = backendHost;

  useEffect(() => {
    fetchData();
  }, [backendHost]);

  const fetchData = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const [resGroups, resUsers] = await Promise.all([
        fetch(`${protocol}//${apiHost}/api/settings/call_pickup_groups`),
        fetch(`${protocol}//${apiHost}/api/settings/users`)
      ]);

      if (resGroups.ok) setGroups(await resGroups.json());
      if (resUsers.ok) setUsers(await resUsers.json());

      setLoading(false);
    } catch (err) {
      console.error("Gruplar çekilemedi:", err);
      setLoading(false);
    }
  };

  const handleOpenModal = (group = null) => {
    if (group) {
      setSelectedGroup(group);
      setFormData({
        name: group.name || "",
        extensions: group.extensions || []
      });
    } else {
      setSelectedGroup(null);
      setFormData({
        name: "",
        extensions: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedGroup(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const payload = {
      id: selectedGroup ? selectedGroup.id : null,
      ...formData
    };

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/call_pickup_groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.call_pickup_groups);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        handleCloseModal();
      }
    } catch (err) {
      console.error("Grup kaydedilemedi:", err);
    }
  };

  const handleDelete = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/call_pickup_groups/${deleteConfirm.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.call_pickup_groups);
        setDeleteConfirm({ show: false, id: null });
      }
    } catch (err) {
      console.error("Grup silinemedi:", err);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name && g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-indigo-500" />
            Çağrı Toplama Grubu
          </h2>
          <p className="text-xs text-slate-500 mt-1">Aynı gruptaki abonelerin birbirlerinin çalan çağrılarını çekebilmesi için gruplar oluşturun.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Grup ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className={`rounded-xl h-8 w-8 flex items-center justify-center shrink-0 ${bg} ${hover} text-white transition-all shadow-sm`}
            title="Yeni Grup Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={14} /> Grup başarıyla kaydedildi.
        </div>
      )}

      {/* Rules Grid/List */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${border}`}></div>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="text-center p-12">
            <div className={`w-16 h-16 rounded-full ${lightBg} text-indigo-500 flex items-center justify-center mx-auto mb-4`}>
              <Users size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Henüz grup yok</h3>
            <p className="text-xs text-slate-500 mb-6">Çağrı toplama yapabilmek için yeni bir grup oluşturun.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Grup Adı</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Aboneler</th>
                  <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredGroups.map(group => {
                  return (
                    <tr key={group.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{group.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex -space-x-2 overflow-hidden">
                          {group.extensions && group.extensions.length > 0 ? (
                            group.extensions.slice(0, 5).map((uid) => {
                              const u = users.find(x => x.id === uid);
                              return (
                                <div key={uid} className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0" title={u ? u.full_name : uid}>
                                  {u?.avatar ? (
                                    <img src={u.avatar} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{u ? u.full_name.charAt(0) : '?'}</span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">Abone Yok</span>
                          )}
                          {group.extensions && group.extensions.length > 5 && (
                            <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">+{group.extensions.length - 5}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(group)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ show: true, id: group.id })}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users size={18} className={`text-indigo-500`} />
                {selectedGroup ? "Grubu Düzenle" : "Yeni Grup Ekle"}
              </h3>
              <button onClick={handleCloseModal} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/30 dark:bg-slate-950/20">
              
              {/* Genel Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Genel</h4>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span className="text-rose-500 mr-1">*</span>İsim
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Örn: Muhasebe Grubu"
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    />
                  </div>
                </div>
              </div>

              {/* Aboneler Section */}
              <div className="space-y-4">
                <DualListBox 
                  title="Aboneler"
                  availableItems={users}
                  selectedIds={formData.extensions}
                  onChangeSelectedIds={(newIds) => setFormData(prev => ({...prev, extensions: newIds}))}
                  columns={["İç Hat No", "Görünen İsim"]}
                  bg={bg} hover={hover} text={text} border={border} lightBg={lightBg}
                  renderRow={(item) => (
                    <>
                      <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.extension || "-"}</td>
                      <td className="p-2 text-slate-500">{item.full_name}</td>
                    </>
                  )}
                />
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 shrink-0">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${bg} hover:opacity-90`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        title="Grubu Sil"
        message="Bu grubu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
      />
    </div>
  );
}
