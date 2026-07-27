import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, X, PhoneIncoming, CheckCircle, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Inbox } from "lucide-react";
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

  const moveUp = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = selectedIds.indexOf(id);
    if (index > 0) {
      const newIds = [...selectedIds];
      [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
      onChangeSelectedIds(newIds);
    }
  };

  const moveDown = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = selectedIds.indexOf(id);
    if (index > -1 && index < selectedIds.length - 1) {
      const newIds = [...selectedIds];
      [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
      onChangeSelectedIds(newIds);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h4>
      <div className="flex flex-col md:flex-row items-stretch gap-4 w-full">
        {/* Available List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[250px]">
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
            <ArrowDown size={18} className="block md:hidden" />
          </button>
          <button onClick={moveLeft} disabled={checkedSelected.length === 0} className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${checkedSelected.length > 0 ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors`}>
            <ChevronLeft size={18} className="hidden md:block" />
            <ArrowUp size={18} className="block md:hidden" />
          </button>
        </div>

        {/* Selected List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[250px]">
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

        {/* Priority Buttons */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 px-2">
          <button onClick={moveUp} disabled={checkedSelected.length !== 1} className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${checkedSelected.length === 1 ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors`}>
            <ArrowUp size={16} />
          </button>
          <button onClick={moveDown} disabled={checkedSelected.length !== 1} className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${checkedSelected.length === 1 ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors`}>
            <ArrowDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

import { getBackendHost } from "../../utils/apiHost";

export default function InboundRulesPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const apiHost = getBackendHost(backendHost);

  const [rules, setRules] = useState([]);
  const [trunks, setTrunks] = useState([]);
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [callFlows, setCallFlows] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  
  const [formData, setFormData] = useState({
    name: "",
    trunk_ids: [],
    destination_type: "user",
    destination_id: "",
    did_match_mode: "all",
    did_patterns: []
  });

  useEffect(() => {
    fetchData();
  }, [backendHost]);

  const fetchData = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const [resRules, resTrunks, resUsers, resQueues, resCallFlows] = await Promise.all([
        fetch(`${protocol}//${apiHost}/api/settings/inbound_rules`),
        fetch(`${protocol}//${apiHost}/api/settings/trunks`),
        fetch(`${protocol}//${apiHost}/api/settings/users`),
        fetch(`${protocol}//${apiHost}/api/settings/queues`),
        fetch(`${protocol}//${apiHost}/api/settings/call-flow/workflows`)
      ]);

      if (resRules.ok) setRules(await resRules.json());
      if (resTrunks.ok) setTrunks(await resTrunks.json());
      if (resUsers.ok) setUsers(await resUsers.json());
      if (resQueues.ok) setQueues(await resQueues.json());
      if (resCallFlows.ok) setCallFlows(await resCallFlows.json());

      setLoading(false);
    } catch (err) {
      console.error("Inbound rules verileri çekilemedi:", err);
      setLoading(false);
    }
  };

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setSelectedRule(rule);
      setFormData({
        id: rule.id,
        name: rule.name || "",
        trunk_ids: rule.trunk_ids || [],
        destination_type: rule.destination_type || "user",
        destination_id: rule.destination_id || "",
        did_match_mode: rule.did_match_mode || "all",
        did_patterns: rule.did_patterns || []
      });
      setSelectedRule(rule);
    } else {
      setFormData({
        name: "",
        trunk_ids: [],
        destination_type: "user",
        destination_id: "",
        did_match_mode: "all",
        did_patterns: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRule(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const payload = {
      id: selectedRule ? selectedRule.id : null,
      ...formData
    };

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/inbound_rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.inbound_rules);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        handleCloseModal();
      }
    } catch (err) {
      console.error("Kural kaydedilemedi:", err);
    }
  };

  const handleDelete = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/inbound_rules/${deleteConfirm.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.inbound_rules);
        setDeleteConfirm({ show: false, id: null });
      }
    } catch (err) {
      console.error("Kural silinemedi:", err);
    }
  };

  const filteredRules = rules.filter(r => 
    (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <PhoneIncoming size={20} className="text-indigo-500" />
            Gelen Arama Kuralları
          </h2>
          <p className="text-xs text-slate-500 mt-1">Dış hatlardan gelen çağrıların hedeflerine yönlendirilme kuralları.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Kural ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className={`rounded-xl h-8 w-8 flex items-center justify-center shrink-0 ${bg} ${hover} text-white transition-all shadow-sm`}
            title="Yeni Kural Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={14} /> Kural başarıyla kaydedildi.
        </div>
      )}

      {/* Rules Grid/List */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${border}`}></div>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className={`w-16 h-16 rounded-full ${lightBg} text-indigo-500 flex items-center justify-center mx-auto mb-4`}>
            <PhoneIncoming size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Henüz kural yok</h3>
          <p className="text-xs text-slate-500 mb-6">Gelen aramaları yönlendirmek için yeni bir kural oluşturun.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Kural Adı</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Dış Hat (Trunks)</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Hedef</th>
                  <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRules.map(rule => {
                  const trunkIds = rule.trunk_ids || [];
                  const assignedTrunks = trunkIds.map(id => trunks.find(t => t.id === id)).filter(Boolean);
                  
                  let destName = "Bilinmeyen Hedef";
                  if (rule.destination_type === "user") {
                    const u = users.find(x => x.id === rule.destination_id);
                    destName = u ? `Kullanıcı: ${u.full_name}` : "Kullanıcı (Silinmiş)";
                  } else if (rule.destination_type === "queue") {
                    const q = queues.find(x => x.id === rule.destination_id);
                    destName = q ? `Kuyruk: ${q.name}` : "Kuyruk (Silinmiş)";
                  } else if (rule.destination_type === "call_flow") {
                    const cf = callFlows.find(x => x.id === rule.destination_id);
                    destName = cf ? `Akış: ${cf.name}` : "Akış (Silinmiş)";
                  }

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{rule.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {assignedTrunks.length > 0 ? assignedTrunks.map((t, idx) => (
                            <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${lightBg} ${text}`}>
                              <PhoneIncoming size={12} />
                              {t.trunk_name || t.host}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400 italic">Bulunamadı</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{destName}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(rule)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ show: true, id: rule.id })}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <PhoneIncoming size={18} className={`text-indigo-500`} />
                {selectedRule ? "Kuralı Düzenle" : "Yeni Kural Ekle"}
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
                      placeholder="Örn: TR_Merkez_Gelen"
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    />
                  </div>
                </div>
              </div>

              {/* Dış Hat Section */}
              <div className="space-y-4">
                <DualListBox 
                  title="Dış Hat"
                  availableItems={trunks}
                  selectedIds={formData.trunk_ids}
                  onChangeSelectedIds={(newIds) => setFormData(prev => ({...prev, trunk_ids: newIds}))}
                  columns={["İsim", "Trunk Tipi"]}
                  bg={bg} hover={hover} text={text} border={border} lightBg={lightBg}
                  renderRow={(item) => (
                    <>
                      <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.trunk_name || item.host}</td>
                      <td className="p-2 text-slate-500">{item.trunk_type === "register" ? "Register Trunk" : "Peer Trunk"}</td>
                    </>
                  )}
                />
              </div>

              {/* DID Modeli Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">DID Modeli</h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-xl text-[11px] mb-4 font-medium leading-relaxed">
                  Buraya girilen numara biçimi, Trunk sağlayıcısının numara biçimiyle tutarlı olmalıdır, aksi takdirde numara eşleşmediği için arama başarısız olur. (Gelen arama başarısız olursa DID numara desenini kaldırmayı deneyin.)
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span className="text-rose-500 mr-1">*</span>DID Eşleştirme Modu
                    </label>
                    <select
                      name="did_match_mode"
                      value={formData.did_match_mode}
                      onChange={handleChange}
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    >
                      <option value="all">Tüm DID'leri Al</option>
                      <option value="specific">DID Gir</option>
                    </select>
                  </div>
                </div>

                {formData.did_match_mode === "specific" && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Model</th>
                          <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-center w-24">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.did_patterns.length === 0 ? (
                          <tr>
                            <td colSpan="2" className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                              <div className="flex flex-col items-center justify-center opacity-60">
                                <Inbox size={32} className="mb-3 text-slate-300 dark:text-slate-600" />
                                <span className="font-medium text-sm">Veri Yok</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          formData.did_patterns.map((pattern, idx) => (
                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={pattern}
                                  onChange={(e) => {
                                    const newPatterns = [...formData.did_patterns];
                                    newPatterns[idx] = e.target.value;
                                    setFormData(prev => ({...prev, did_patterns: newPatterns}));
                                  }}
                                  placeholder="Örn: 908503607390"
                                  className={`w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const newPatterns = formData.did_patterns.filter((_, i) => i !== idx);
                                      setFormData(prev => ({...prev, did_patterns: newPatterns}));
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setFormData(prev => ({...prev, did_patterns: [...prev.did_patterns, ""]}));
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-1.5 px-3 rounded-lg hover:bg-white dark:hover:bg-slate-700 shadow-sm"
                      >
                        <Plus size={14} /> Ekle
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Varsayılan Hedef Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Varsayılan Hedef</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hedef Türü
                    </label>
                    <select
                      name="destination_type"
                      value={formData.destination_type}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, destination_type: e.target.value, destination_id: "" }));
                      }}
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    >
                      <option value="user">Kullanıcı</option>
                      <option value="queue">Kuyruk</option>
                      <option value="call_flow">Arama Akış Yönetimi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hedef Seçimi
                    </label>
                    {formData.destination_type === "user" && (
                      <select
                        name="destination_id"
                        value={formData.destination_id}
                        onChange={handleChange}
                        className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Kullanıcı Seçiniz...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.extension})</option>
                        ))}
                      </select>
                    )}
                    {formData.destination_type === "queue" && (
                      <select
                        name="destination_id"
                        value={formData.destination_id}
                        onChange={handleChange}
                        className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Kuyruk Seçiniz...</option>
                        {queues.map(q => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                    )}
                    {formData.destination_type === "call_flow" && (
                      <select
                        name="destination_id"
                        value={formData.destination_id}
                        onChange={handleChange}
                        className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Akış Seçiniz...</option>
                        {callFlows.map(cf => (
                          <option key={cf.id} value={cf.id}>{cf.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
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
                disabled={!formData.name || formData.trunk_ids.length === 0 || !formData.destination_id}
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
        title="Kuralı Sil"
        message="Bu gelen arama kuralını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
      />
    </div>
  );
}
