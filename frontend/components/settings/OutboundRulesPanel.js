import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Search, Edit2, Trash2, X, PhoneForwarded, Users, CheckCircle,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Download, Upload,
  Lock, Eye, EyeOff, RefreshCw, Clock, Calendar, ShieldCheck, AlertCircle, ChevronDown, Sliders
} from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import BulkConfigPanel from "./BulkConfigPanel";
import { useTheme } from "../../utils/theme";
import { getBackendHost } from "../../utils/apiHost";


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

  const unselectedItems = availableItems.filter(i => !selectedIds.some(sid => String(sid) === String(i.id)));
  const selectedItems = selectedIds.map(id => availableItems.find(i => String(i.id) === String(id))).filter(Boolean);

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
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
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
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
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

export default function OutboundRulesPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const apiHost = getBackendHost(backendHost);

  const [rules, setRules] = useState([]);
  const [trunks, setTrunks] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscriberGroups, setSubscriberGroups] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showExemptSelector, setShowExemptSelector] = useState(false);
  const [pinError, setPinError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const pinInputRef = useRef(null);
  const nameInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: "",
    caller_id: "",
    patterns: [{ pattern: "", strip: "", prepend: "" }],
    trunk_ids: [],
    allowed_users: [],
    pin_mode: "none",
    pin_code: "",
    pin_start_time: "18:00",
    pin_end_time: "09:00",
    pin_exempt_users: []
  });

  useEffect(() => {
    fetchData();
  }, [backendHost]);

  const fetchData = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const [resRules, resTrunks, resUsers, resGroups] = await Promise.all([
        fetch(`${protocol}//${apiHost}/api/settings/outbound_rules`),
        fetch(`${protocol}//${apiHost}/api/settings/trunks`),
        fetch(`${protocol}//${apiHost}/api/settings/users`),
        fetch(`${protocol}//${apiHost}/api/settings/subscriber_groups`)
      ]);

      if (resRules.ok) setRules(await resRules.json());
      if (resTrunks.ok) setTrunks(await resTrunks.json());
      if (resUsers.ok) setUsers(await resUsers.json());
      if (resGroups.ok) setSubscriberGroups(await resGroups.json());

      setLoading(false);
    } catch (err) {
      console.error("Outbound rules verileri çekilemedi:", err);
      setLoading(false);
    }
  };

  const getGroupMemberUserIds = (group, usersList = users) => {
    const rawExts = group?.extensions || group?.members || [];
    const matchedIds = [];
    rawExts.forEach(val => {
      const u = (usersList || []).find(
        usr => usr.id === val || String(usr.id) === String(val) || String(usr.extension) === String(val)
      );
      if (u && !matchedIds.includes(u.id)) {
        matchedIds.push(u.id);
      }
    });
    return matchedIds;
  };

  const userAndGroupItems = [
    ...(subscriberGroups || []).map(g => {
      const memberUserIds = getGroupMemberUserIds(g, users);
      return {
        id: `group_${g.id}`,
        groupId: g.id,
        isSubscriberGroup: true,
        extension: `Abone Grubu (${memberUserIds.length})`,
        full_name: g.name,
        memberUserIds
      };
    }),
    ...(users || []).map(u => ({
      ...u,
      isSubscriberGroup: false
    }))
  ];

  const handleAllowedUsersChange = (newSelectedIds) => {
    const prevIds = formData.allowed_users || [];
    const addedIds = newSelectedIds.filter(id => !prevIds.some(pid => String(pid) === String(id)));
    const removedIds = prevIds.filter(id => !newSelectedIds.some(nid => String(nid) === String(id)));

    if (addedIds.length === 0 && removedIds.length === 0) {
      setFormData(prev => ({ ...prev, allowed_users: newSelectedIds }));
      return;
    }

    let updatedIds = [...newSelectedIds];

    // Eklenen abone grubu varsa içindeki kullanıcıları da seçili listesine ekle
    addedIds.forEach(addedId => {
      if (String(addedId).startsWith("group_")) {
        const grpItem = userAndGroupItems.find(item => String(item.id) === String(addedId));
        if (grpItem && Array.isArray(grpItem.memberUserIds)) {
          grpItem.memberUserIds.forEach(uid => {
            if (!updatedIds.some(x => String(x) === String(uid))) {
              updatedIds.push(uid);
            }
          });
        }
      }
    });

    // Çıkarılan abone grubu varsa içindeki kullanıcıları da seçili listesinden çıkar
    removedIds.forEach(removedId => {
      if (String(removedId).startsWith("group_")) {
        const grpItem = userAndGroupItems.find(item => String(item.id) === String(removedId));
        if (grpItem && Array.isArray(grpItem.memberUserIds)) {
          const remainingGroupIds = updatedIds.filter(id => String(id).startsWith("group_"));
          const protectedUserIds = new Set();
          remainingGroupIds.forEach(gid => {
            const otherGrp = userAndGroupItems.find(item => String(item.id) === String(gid));
            (otherGrp?.memberUserIds || []).forEach(uid => protectedUserIds.add(String(uid)));
          });
          updatedIds = updatedIds.filter(
            id => !grpItem.memberUserIds.some(uid => String(uid) === String(id)) || protectedUserIds.has(String(id))
          );
        }
      }
    });

    setFormData(prev => ({ ...prev, allowed_users: updatedIds }));
  };

  const expandGroupSelections = (prevIds, newSelectedIds) => {
    const addedIds = newSelectedIds.filter(id => !prevIds.some(pid => String(pid) === String(id)));
    const removedIds = prevIds.filter(id => !newSelectedIds.some(nid => String(nid) === String(id)));
    if (addedIds.length === 0 && removedIds.length === 0) return newSelectedIds;

    let updatedIds = [...newSelectedIds];
    addedIds.forEach(addedId => {
      if (String(addedId).startsWith("group_")) {
        const grpItem = userAndGroupItems.find(item => String(item.id) === String(addedId));
        if (grpItem && Array.isArray(grpItem.memberUserIds)) {
          grpItem.memberUserIds.forEach(uid => {
            if (!updatedIds.some(x => String(x) === String(uid))) {
              updatedIds.push(uid);
            }
          });
        }
      }
    });

    removedIds.forEach(removedId => {
      if (String(removedId).startsWith("group_")) {
        const grpItem = userAndGroupItems.find(item => String(item.id) === String(removedId));
        if (grpItem && Array.isArray(grpItem.memberUserIds)) {
          const remainingGroupIds = updatedIds.filter(id => String(id).startsWith("group_"));
          const protectedUserIds = new Set();
          remainingGroupIds.forEach(gid => {
            const otherGrp = userAndGroupItems.find(item => String(item.id) === String(gid));
            (otherGrp?.memberUserIds || []).forEach(uid => protectedUserIds.add(String(uid)));
          });
          updatedIds = updatedIds.filter(
            id => !grpItem.memberUserIds.some(uid => String(uid) === String(id)) || protectedUserIds.has(String(id))
          );
        }
      }
    });

    return updatedIds;
  };

  const handlePinExemptUsersChange = (newSelectedIds) => {
    const updatedIds = expandGroupSelections(formData.pin_exempt_users || [], newSelectedIds);
    setFormData(prev => ({ ...prev, pin_exempt_users: updatedIds }));
  };

  const handleGenerateRandomPin = () => {
    let digits = "";
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(6);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < 6; i++) {
        digits += String(buf[i] % 10);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        digits += String(Math.floor(Math.random() * 10));
      }
    }
    setFormData(prev => ({ ...prev, pin_code: digits }));
    setPinError("");
    setFormError("");
    setShowPin(true);
  };

  const handlePinCodeChange = (e) => {
    const cleaned = String(e.target.value || "").replace(/\D/g, "").slice(0, 10);
    setFormData(prev => ({ ...prev, pin_code: cleaned }));
    if (pinError) setPinError("");
    if (formError) setFormError("");
  };

  const handlePinCodeBlur = () => {
    if (formData.pin_mode !== "none" && (formData.pin_code.length < 4 || formData.pin_code.length > 10)) {
      setPinError("Dış arama parolası 4 ile 10 hane arasında sayısal bir değer olmalıdır.");
    }
  };

  const hydrateGroupList = (rawList) => {
    let hydrated = [...(rawList || [])];
    hydrated.forEach(id => {
      if (String(id).startsWith("group_")) {
        const grpId = String(id).replace("group_", "");
        const grp = (subscriberGroups || []).find(g => String(g.id) === grpId);
        if (grp) {
          getGroupMemberUserIds(grp, users).forEach(uid => {
            if (!hydrated.some(x => String(x) === String(uid))) {
              hydrated.push(uid);
            }
          });
        }
      }
    });
    return hydrated.filter(id => {
      if (String(id).startsWith("group_")) {
        const grpId = String(id).replace("group_", "");
        return (subscriberGroups || []).some(g => String(g.id) === grpId);
      }
      return (users || []).some(u => String(u.id) === String(id) || String(u.extension) === String(id));
    });
  };

  const handleOpenModal = (rule = null) => {
    setShowPin(false);
    setPinError("");
    setFormError("");
    setSaving(false);
    if (rule) {
      setSelectedRule(rule);
      const initialAllowed = hydrateGroupList(rule.allowed_users);
      const initialExempt = hydrateGroupList(rule.pin_exempt_users);
      setShowExemptSelector(initialExempt.length > 0);
      setFormData({
        name: rule.name || "",
        caller_id: rule.caller_id || "",
        patterns: rule.patterns && rule.patterns.length > 0 ? rule.patterns : [{ pattern: rule.pattern || "", strip: "", prepend: "" }],
        trunk_ids: rule.trunk_ids || (rule.trunk_id ? [rule.trunk_id] : []),
        allowed_users: initialAllowed,
        pin_mode: rule.pin_mode || "none",
        pin_code: String(rule.pin_code || "").replace(/\D/g, "").slice(0, 10),
        pin_start_time: rule.pin_start_time || "18:00",
        pin_end_time: rule.pin_end_time || "09:00",
        pin_exempt_users: initialExempt
      });
    } else {
      setSelectedRule(null);
      setShowExemptSelector(false);
      setFormData({
        name: "",
        caller_id: "",
        patterns: [{ pattern: "", strip: "", prepend: "" }],
        trunk_ids: [],
        allowed_users: [],
        pin_mode: "none",
        pin_code: "",
        pin_start_time: "18:00",
        pin_end_time: "09:00",
        pin_exempt_users: []
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
    if (formError) setFormError("");
    if (name === "pin_mode" && value === "none") {
      setPinError("");
    }
  };

  const handlePatternChange = (index, field, value) => {
    const newPatterns = [...formData.patterns];
    newPatterns[index][field] = value;
    setFormData(prev => ({ ...prev, patterns: newPatterns }));
    if (formError) setFormError("");
  };

  const addPatternRow = () => {
    setFormData(prev => ({ ...prev, patterns: [...prev.patterns, { pattern: "", strip: "", prepend: "" }] }));
  };

  const removePatternRow = (index) => {
    const newPatterns = [...formData.patterns];
    newPatterns.splice(index, 1);
    setFormData(prev => ({ ...prev, patterns: newPatterns }));
  };

  const handleSave = async () => {
    if (!String(formData.name || "").trim()) {
      setFormError("Lütfen kural için bir isim giriniz.");
      nameInputRef.current?.focus();
      return;
    }
    if (formData.patterns.some(p => !String(p.pattern || "").trim())) {
      setFormError("Lütfen arama düzenindeki tüm model (desen) alanlarını doldurunuz.");
      return;
    }
    if (!formData.trunk_ids || formData.trunk_ids.length === 0) {
      setFormError("Lütfen en az bir dış hat (trunk) seçiniz.");
      return;
    }
    if (formData.pin_mode !== "none") {
      const cleanPin = String(formData.pin_code || "").replace(/\D/g, "");
      if (cleanPin.length < 4 || cleanPin.length > 10) {
        const msg = "Dış arama parolası 4 ile 10 hane arasında sayısal bir değer olmalıdır.";
        setPinError(msg);
        setFormError(msg);
        pinInputRef.current?.focus();
        return;
      }
    }

    const payload = {
      id: selectedRule ? selectedRule.id : null,
      ...formData,
      pin_code: String(formData.pin_code || "").replace(/\D/g, "").slice(0, 10)
    };

    setSaving(true);
    setFormError("");
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/outbound_rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.outbound_rules);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        handleCloseModal();
      } else {
        const errData = await res.json().catch(() => ({}));
        setFormError(errData.detail || errData.message || "Kural kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Kural kaydedilemedi:", err);
      setFormError("Sunucuya bağlanılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${apiHost}/api/settings/outbound_rules/${deleteConfirm.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.outbound_rules);
        setDeleteConfirm({ show: false, id: null });
      }
    } catch (err) {
      console.error("Kural silinemedi:", err);
    }
  };

  const handleExportExcel = () => {
    const data = rules.map(rule => {
      const patterns = rule.patterns && rule.patterns.length > 0 ? rule.patterns : [{ pattern: rule.pattern || "", strip: "", prepend: "" }];
      const trunkIds = rule.trunk_ids || (rule.trunk_id ? [rule.trunk_id] : []);
      const trunkNames = trunkIds.map(id => {
        const t = trunks.find(x => x.id === id);
        return t ? (t.trunk_name || t.host) : id;
      }).join(", ");
      const userNames = (rule.allowed_users || []).map(uid => {
        if (String(uid).startsWith("group_")) {
          const gid = String(uid).replace("group_", "");
          const grp = subscriberGroups.find(g => String(g.id) === gid);
          return grp ? `[Abone Grubu: ${grp.name}]` : uid;
        }
        const u = users.find(x => x.id === uid || String(x.id) === String(uid));
        return u ? u.full_name : uid;
      }).join(", ");

      const pinModeMap = {
        none: "Kapalı",
        always: "Her Zaman (7/24)",
        outside_work_hours: "Mesai Saatleri Dışında",
        custom_hours: `Özel Saat (${rule.pin_start_time || "18:00"}-${rule.pin_end_time || "09:00"})`
      };

      return {
        "Kural Adı": rule.name || "",
        "Arayan Numara (Caller ID)": rule.caller_id || "",
        "Desenler": patterns.map(p => p.pattern || "").filter(Boolean).join(", "),
        "Dış Hatlar": trunkNames,
        "İzin Verilen Aboneler": userNames,
        "Parola Politikası": pinModeMap[rule.pin_mode || "none"] || "Kapalı"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GidenAramaKurallari");
    XLSX.writeFile(workbook, "Giden_Arama_Kurallari.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";

        for (const row of data) {
          const name = String(row["Kural Adı"] || "").trim();
          if (!name) continue;
          const caller_id = String(row["Arayan Numara (Caller ID)"] || row["Caller ID"] || "").trim();
          const patternsRaw = String(row["Desenler"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const patterns = patternsRaw.length > 0
            ? patternsRaw.map(p => ({ pattern: p, strip: "", prepend: "" }))
            : [{ pattern: "X.", strip: "", prepend: "" }];

          const trunksRaw = String(row["Dış Hatlar"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const trunk_ids = trunksRaw.map(tName => {
            const found = trunks.find(t =>
              (t.trunk_name && t.trunk_name.toLowerCase() === tName.toLowerCase()) ||
              (t.host && t.host.toLowerCase() === tName.toLowerCase()) ||
              String(t.id) === tName
            );
            return found ? found.id : null;
          }).filter(Boolean);

          const usersRaw = String(row["İzin Verilen Aboneler"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const allowed_users = [];
          usersRaw.forEach(uName => {
            const cleanGrpName = uName.replace(/^\[Abone Grubu:\s*/i, "").replace(/\]$/, "").trim();
            const foundGroup = subscriberGroups.find(g => g.name && g.name.toLowerCase() === cleanGrpName.toLowerCase());
            if (foundGroup) {
              const gid = `group_${foundGroup.id}`;
              if (!allowed_users.includes(gid)) allowed_users.push(gid);
              getGroupMemberUserIds(foundGroup, users).forEach(uid => {
                if (!allowed_users.includes(uid)) allowed_users.push(uid);
              });
              return;
            }
            const found = users.find(u =>
              (u.full_name && u.full_name.toLowerCase() === uName.toLowerCase()) ||
              String(u.extension) === uName ||
              String(u.id) === uName
            );
            if (found && !allowed_users.includes(found.id)) {
              allowed_users.push(found.id);
            }
          });

          const existing = rules.find(r => r.name && r.name.toLowerCase() === name.toLowerCase());

          await fetch(`${protocol}//${apiHost}/api/settings/outbound_rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existing ? existing.id : null,
              name,
              caller_id,
              patterns,
              trunk_ids,
              allowed_users,
              pin_mode: existing?.pin_mode || "none",
              pin_code: existing?.pin_code || "",
              pin_start_time: existing?.pin_start_time || "18:00",
              pin_end_time: existing?.pin_end_time || "09:00",
              pin_exempt_users: existing?.pin_exempt_users || []
            })
          });
        }

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await fetchData();
      } catch (err) {
        console.error("Excel import error:", err);
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const filteredRules = rules.filter(r => 
    (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.patterns && r.patterns.some(p => p.pattern.includes(searchQuery))) ||
    (r.pattern && r.pattern.includes(searchQuery))
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <PhoneForwarded size={20} className={text} />
            Giden Arama Kuralları
          </h2>
          <p className="text-xs text-slate-500 mt-1">Dış aramalarda numara eşleşmelerine göre kullanılacak hatları ve parola güvenliğini yapılandırın.</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
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

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleImportExcel}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
            title="Excel'den İçe Aktar (Import)"
          >
            <Upload size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className={`p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 ${text} rounded-xl transition-all flex items-center justify-center h-8 w-8 shrink-0 border border-slate-200 dark:border-slate-700`}
            title="Toplu Konfigürasyon (Giden Arama Kurallarını Toplu Düzenle)"
          >
            <Sliders size={16} />
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white transition-all shadow-sm"
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
          <div className={`w-16 h-16 rounded-full ${lightBg} ${text} flex items-center justify-center mx-auto mb-4`}>
            <PhoneForwarded size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Henüz kural yok</h3>
          <p className="text-xs text-slate-500 mb-6">Giden aramaları yönlendirmek için yeni bir kural oluşturun.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {selectedRuleIds.length > 0 && (
            <div className={`p-3 border-b ${border} ${lightBg} flex items-center justify-between gap-3 flex-wrap`}>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold text-white ${bg}`}>
                  {selectedRuleIds.length} Kural Seçildi
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Seçili kuralların dış hat (trunk), CallerID ve parola ayarlarını tek seferde değiştirin:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} flex items-center gap-1.5`}
                >
                  <Sliders size={13} />
                  Seçili Kuralları Toplu Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRuleIds([])}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-800 text-slate-500"
                >
                  Seçimi Temizle
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                  <th scope="col" className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredRules.length > 0 &&
                        filteredRules.every((r) => selectedRuleIds.includes(String(r.id)))
                      }
                      onChange={(e) =>
                        setSelectedRuleIds(
                          e.target.checked ? filteredRules.map((r) => String(r.id)) : []
                        )
                      }
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Kural Adı & Desen</th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Dış Hat (Trunks)</th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">İzin Verilen Aboneler</th>
                  <th scope="col" className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Parola Koruması</th>
                  <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRules.map(rule => {
                  const patterns = rule.patterns || [{ pattern: rule.pattern || "Yok" }];
                  const trunkIds = rule.trunk_ids || (rule.trunk_id ? [rule.trunk_id] : []);
                  const assignedTrunks = trunkIds.map(id => trunks.find(t => t.id === id)).filter(Boolean);
                  const pinMode = rule.pin_mode || "none";
                  const isRuleChecked = selectedRuleIds.includes(String(rule.id));
                  
                  return (
                    <tr key={rule.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isRuleChecked ? lightBg : ""}`}>
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={isRuleChecked}
                          onChange={() =>
                            setSelectedRuleIds((prev) =>
                              prev.includes(String(rule.id))
                                ? prev.filter((x) => x !== String(rule.id))
                                : [...prev, String(rule.id)]
                            )
                          }
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{rule.name}</span>
                          <span className="text-[11px] font-mono text-slate-500 mt-0.5">{patterns.map(p => p.pattern).join(", ")}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {assignedTrunks.length > 0 ? assignedTrunks.map((t, idx) => (
                            <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${lightBg} ${text}`}>
                              <PhoneForwarded size={12} />
                              {t.trunk_name || t.host}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400 italic">Bulunamadı</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rule.allowed_users && rule.allowed_users.length > 0 ? (() => {
                            const validGroups = rule.allowed_users
                              .filter(uid => String(uid).startsWith("group_"))
                              .map(gid => {
                                const rawId = String(gid).replace("group_", "");
                                return subscriberGroups.find(g => String(g.id) === rawId);
                              })
                              .filter(Boolean);

                            const validUsers = [];
                            const seenIds = new Set();
                            rule.allowed_users
                              .filter(uid => !String(uid).startsWith("group_"))
                              .forEach(uid => {
                                const u = users.find(x => String(x.id) === String(uid) || String(x.extension) === String(uid));
                                if (u && !seenIds.has(String(u.id))) {
                                  seenIds.add(String(u.id));
                                  validUsers.push(u);
                                }
                              });

                            if (validGroups.length === 0 && validUsers.length === 0) {
                              return <span className="text-xs text-slate-400 italic">Tümü veya Yok</span>;
                            }

                            return (
                              <>
                                {validGroups.map(grp => (
                                  <span
                                    key={`group_${grp.id}`}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}
                                    title={`Abone Grubu: ${grp.name}`}
                                  >
                                    <Users size={11} />
                                    {grp.name}
                                  </span>
                                ))}
                                <div className="flex -space-x-2 overflow-hidden">
                                  {validUsers.slice(0, 5).map((u) => (
                                    <div key={u.id} className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0" title={`${u.full_name} (${u.extension})`}>
                                      {u?.avatar ? (
                                        <img src={u.avatar} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                                      ) : (
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{(u.full_name || "?").charAt(0)}</span>
                                      )}
                                    </div>
                                  ))}
                                  {validUsers.length > 5 && (
                                    <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-bold text-slate-500">+{validUsers.length - 5}</span>
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })() : (
                            <span className="text-xs text-slate-400 italic">Tümü veya Yok</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {pinMode === "always" ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                            <Lock size={11} aria-hidden="true" />
                            7/24 Parolalı
                          </span>
                        ) : pinMode === "outside_work_hours" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <Calendar size={11} aria-hidden="true" />
                            Mesai Dışı Parolalı
                          </span>
                        ) : pinMode === "custom_hours" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <Clock size={11} aria-hidden="true" />
                            Özel Saat ({rule.pin_start_time || "18:00"}–{rule.pin_end_time || "09:00"})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Kapalı</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(rule)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Düzenle"
                            aria-label={`${rule.name} kuralını düzenle`}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ show: true, id: rule.id })}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Sil"
                            aria-label={`${rule.name} kuralını sil`}
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
          <div role="dialog" aria-modal="true" aria-labelledby="outbound-rule-modal-title" className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 id="outbound-rule-modal-title" className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <PhoneForwarded size={18} className={text} />
                {selectedRule ? "Kuralı Düzenle" : "Yeni Kural Ekle"}
              </h3>
              <button type="button" onClick={handleCloseModal} aria-label="Pencereyi kapat" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/30 dark:bg-slate-950/20">
              
              {/* Genel Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Genel</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="outbound-rule-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span className="text-rose-500 mr-1">*</span>İsim
                    </label>
                    <input
                      id="outbound-rule-name"
                      ref={nameInputRef}
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Default_Outbound_Route"
                      autoCorrect="off"
                      spellCheck={false}
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    />
                  </div>
                  <div>
                    <label htmlFor="outbound-rule-callerid" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Görünür Numara</label>
                    <input
                      id="outbound-rule-callerid"
                      type="text"
                      name="caller_id"
                      value={formData.caller_id}
                      onChange={handleChange}
                      inputMode="tel"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Örn: 908503607390"
                      className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                    />
                  </div>
                </div>
              </div>

              {/* Arama Düzeni Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Arama Düzeni</h4>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Arama Eşleştirme Ayarları</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th scope="col" className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs w-[35%]"><span className="text-rose-500 mr-1">*</span>Model</th>
                        <th scope="col" className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs w-[25%]">Çıkar</th>
                        <th scope="col" className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs w-[25%]">Ekle</th>
                        <th scope="col" className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs w-[15%] text-center">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {formData.patterns.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3">
                            <input
                              type="text"
                              value={p.pattern}
                              onChange={(e) => handlePatternChange(idx, "pattern", e.target.value)}
                              placeholder="X."
                              aria-label={`Satır ${idx + 1} arama deseni`}
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              className={`w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring}`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={p.strip}
                              onChange={(e) => handlePatternChange(idx, "strip", e.target.value)}
                              placeholder=""
                              aria-label={`Satır ${idx + 1} baştan çıkarılacak hane`}
                              autoCorrect="off"
                              spellCheck={false}
                              className={`w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring}`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={p.prepend}
                              onChange={(e) => handlePatternChange(idx, "prepend", e.target.value)}
                              placeholder=""
                              aria-label={`Satır ${idx + 1} başa eklenecek önek`}
                              autoCorrect="off"
                              spellCheck={false}
                              className={`w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring}`}
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => removePatternRow(idx)}
                              aria-label={`Satır ${idx + 1} desenini sil`}
                              className="text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                              disabled={formData.patterns.length === 1}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-800/30">
                    <button
                      type="button"
                      onClick={addPatternRow}
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors"
                    >
                      <Plus size={14} /> Ekle
                    </button>
                  </div>
                </div>
              </div>

              {/* Dış Hat Section */}
              <div className="space-y-4">
                <DualListBox 
                  title="Dış Hat"
                  availableItems={trunks}
                  selectedIds={formData.trunk_ids}
                  onChangeSelectedIds={(newIds) => {
                    setFormData(prev => ({ ...prev, trunk_ids: newIds }));
                    if (formError) setFormError("");
                  }}
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

              {/* İç Hat / İç Hat Grubu Section */}
              <div className="space-y-4">
                <DualListBox 
                  title="İç Hat / İç Hat Grubu"
                  availableItems={userAndGroupItems}
                  selectedIds={formData.allowed_users}
                  onChangeSelectedIds={handleAllowedUsersChange}
                  columns={["İç Hat No / Grup", "Görünen İsim"]}
                  bg={bg} hover={hover} text={text} border={border} lightBg={lightBg}
                  renderRow={(item) => (
                    item.isSubscriberGroup ? (
                      <>
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                            <Users size={11} />
                            Abone Grubu
                          </span>
                        </td>
                        <td className="p-2 text-slate-800 dark:text-slate-200 font-bold">
                          {item.full_name}
                          <span className="ml-1.5 text-[10px] font-medium text-slate-400">
                            ({(item.memberUserIds || []).length} Abone)
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.extension || "-"}</td>
                        <td className="p-2 text-slate-500">{item.full_name}</td>
                      </>
                    )
                  )}
                />
              </div>

              {/* Giden Arama Parolası (PIN) & Güvenlik Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Lock size={16} className={text} aria-hidden="true" />
                    Giden Arama Parolası (PIN) & Güvenlik
                  </h4>
                  {formData.pin_mode !== "none" && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                      <ShieldCheck size={12} aria-hidden="true" />
                      PIN Koruması Aktif
                    </span>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
                  <div>
                    <span id="outbound-pin-mode-label" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Parola İsteme Politikası
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-labelledby="outbound-pin-mode-label">
                      {[
                        {
                          value: "none",
                          title: "Kapalı",
                          desc: "Parola sormadan doğrudan dış arama başlatılır.",
                          Icon: PhoneForwarded
                        },
                        {
                          value: "always",
                          title: "Her Zaman Parola İste",
                          desc: "7/24 tüm dış aramalarda sesli anons ile PIN sorulur.",
                          Icon: Lock
                        },
                        {
                          value: "outside_work_hours",
                          title: "Mesai Saatleri Dışında İste",
                          desc: "Mesai dışı, hafta sonu ve resmi tatillerde parola ister.",
                          Icon: Calendar
                        },
                        {
                          value: "custom_hours",
                          title: "Özel Saat Aralığında İste",
                          desc: "Belirlediğiniz saat aralığında dış aramalarda parola ister.",
                          Icon: Clock
                        }
                      ].map(opt => {
                        const isSelected = formData.pin_mode === opt.value;
                        const IconComp = opt.Icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, pin_mode: opt.value }));
                              if (opt.value === "none") setPinError("");
                              if (formError) setFormError("");
                            }}
                            className={`text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                              isSelected
                                ? `${lightBg} ${border} ring-1 ${ring}`
                                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`p-1.5 rounded-lg ${isSelected ? `${bg} text-white` : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                                <IconComp size={14} aria-hidden="true" />
                              </span>
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? border : "border-slate-300 dark:border-slate-600"}`}>
                                {isSelected && <span className={`w-2 h-2 rounded-full ${bg}`} />}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-white mt-1">{opt.title}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.pin_mode !== "none" && (
                    <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                      {formData.pin_mode === "outside_work_hours" && (
                        <div className={`p-3.5 rounded-xl border ${borderLight} ${lightBg} flex items-start gap-2.5`}>
                          <Calendar size={16} className={`${text} shrink-0 mt-0.5`} aria-hidden="true" />
                          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <span className="font-bold">Sistem Mesai Takvimi ile Tam Entegre:</span>{" "}
                            <span className="text-slate-600 dark:text-slate-400">
                              Sistem Ayarları &gt; Mesai Saatleri &amp; Resmi Tatiller ekranında tanımlı çalışma saatleri içinde aboneler doğrudan dış arama yapabilir; mesai bitiminde, hafta sonlarında, öğle aralarında ve resmi tatillerde otomatik olarak parola sorulur.
                            </span>
                          </div>
                        </div>
                      )}

                      {formData.pin_mode === "custom_hours" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                          <div>
                            <label htmlFor="outbound-pin-start-time" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Parola Başlangıç Saati
                            </label>
                            <input
                              id="outbound-pin-start-time"
                              type="time"
                              name="pin_start_time"
                              value={formData.pin_start_time}
                              onChange={handleChange}
                              className={`w-full text-sm px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white`}
                            />
                          </div>
                          <div>
                            <label htmlFor="outbound-pin-end-time" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Parola Bitiş Saati
                            </label>
                            <input
                              id="outbound-pin-end-time"
                              type="time"
                              name="pin_end_time"
                              value={formData.pin_end_time}
                              onChange={handleChange}
                              className={`w-full text-sm px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white`}
                            />
                          </div>
                          <p className="sm:col-span-2 text-[11px] text-slate-500">
                            Geceyi kapsayan aralıkları (ör. <span className="font-mono font-semibold">18:00</span> – <span className="font-mono font-semibold">09:00</span>) doğrudan seçebilirsiniz.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div>
                          <label htmlFor="outbound-pin-code" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            <span className="text-rose-500 mr-1">*</span>Dış Arama Parolası (4–10 Haneli Sayısal PIN)
                          </label>
                          <div className="flex items-stretch gap-2">
                            <div className="relative flex-1">
                              <input
                                id="outbound-pin-code"
                                ref={pinInputRef}
                                type={showPin ? "text" : "password"}
                                name="pin_code"
                                value={formData.pin_code}
                                onChange={handlePinCodeChange}
                                onBlur={handlePinCodeBlur}
                                inputMode="numeric"
                                pattern="[0-9]{4,10}"
                                minLength={4}
                                maxLength={10}
                                autoComplete="new-password"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="Örn: 2580"
                                aria-invalid={Boolean(pinError)}
                                aria-describedby={pinError ? "outbound-pin-help outbound-pin-error" : "outbound-pin-help"}
                                className={`w-full text-sm font-mono tracking-widest pl-4 pr-10 py-2 rounded-xl border ${
                                  pinError ? "border-rose-500 focus:ring-rose-500/30" : `border-slate-200 dark:border-slate-700 ${ring}`
                                } bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 text-slate-800 dark:text-white transition-all`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPin(prev => !prev)}
                                aria-pressed={showPin}
                                aria-label={showPin ? "Parolayı gizle" : "Parolayı göster"}
                                aria-describedby="outbound-pin-toggle-warn"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                {showPin ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                              </button>
                              <span id="outbound-pin-toggle-warn" className="sr-only">
                                Uyarı: bu düğme dış arama parolasını ekranda görünür hale getirir.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleGenerateRandomPin}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${borderLight} ${lightBg} ${text} hover:opacity-90 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer`}
                              title="6 haneli rastgele sayısal PIN üret"
                            >
                              <RefreshCw size={13} aria-hidden="true" />
                              Rastgele Üret
                            </button>
                          </div>
                          {pinError && (
                            <p id="outbound-pin-error" role="alert" className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertCircle size={13} aria-hidden="true" />
                              {pinError}
                            </p>
                          )}
                          <p id="outbound-pin-help" className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                            Masa telefonu veya WebPhone üzerinden arama yapıldığında sesli anons dinletilir; abone PIN kodunu tuşlayıp <span className="font-mono font-bold">#</span> tuşuna bastığında çağrı başlatılır. Ardışık 3 hatalı denemede çağrı reddedilerek güvenlik günlüğüne işlenir.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-xs font-bold text-slate-800 dark:text-white">Paroladan Muaf Aboneler</h5>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Yönetici veya VIP dahililer parola tuşlamadan doğrudan dış hat çıkışı yapabilir.
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-expanded={showExemptSelector}
                              aria-controls="outbound-pin-exempt-panel"
                              onClick={() => setShowExemptSelector(prev => !prev)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer`}
                            >
                              <span>{formData.pin_exempt_users.length > 0 ? `${formData.pin_exempt_users.length} Seçili` : "Seç"}</span>
                              <ChevronDown size={14} className={`transition-transform ${showExemptSelector ? "rotate-180" : ""}`} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {showExemptSelector && (
                        <div id="outbound-pin-exempt-panel" className="pt-2 animate-in fade-in duration-150">
                          <DualListBox
                            title="Paroladan Muaf İç Hat / İç Hat Grubu (Opsiyonel)"
                            availableItems={userAndGroupItems}
                            selectedIds={formData.pin_exempt_users}
                            onChangeSelectedIds={handlePinExemptUsersChange}
                            columns={["İç Hat No / Grup", "Görünen İsim"]}
                            bg={bg} hover={hover} text={text} border={border} lightBg={lightBg}
                            renderRow={(item) => (
                              item.isSubscriberGroup ? (
                                <>
                                  <td className="p-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                                      <Users size={11} />
                                      Abone Grubu
                                    </span>
                                  </td>
                                  <td className="p-2 text-slate-800 dark:text-slate-200 font-bold">
                                    {item.full_name}
                                    <span className="ml-1.5 text-[10px] font-medium text-slate-400">
                                      ({(item.memberUserIds || []).length} Abone)
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.extension || "-"}</td>
                                  <td className="p-2 text-slate-500">{item.full_name}</td>
                                </>
                              )
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div aria-live="polite" className="flex-1">
                {formError && (
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${bg} ${hover}`}
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        title="Kuralı Sil"
        message="Bu giden arama kuralını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
      />

      {showBulkModal && (
        <BulkConfigPanel
          backendHost={backendHost}
          isModal={true}
          initialModule="outbound_rules"
          initialTargetMode={selectedRuleIds.length > 0 ? "selected" : "all"}
          initialSelectedIds={selectedRuleIds}
          onClose={() => setShowBulkModal(false)}
          onApplied={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
