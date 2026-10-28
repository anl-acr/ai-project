import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit2, Trash2, X, PhoneIncoming, Users, CheckCircle, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Inbox, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
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

import { getBackendHost } from "../../utils/apiHost";

export default function InboundRulesPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const apiHost = getBackendHost(backendHost);

  const [rules, setRules] = useState([]);
  const [trunks, setTrunks] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscriberGroups, setSubscriberGroups] = useState([]);
  const [queues, setQueues] = useState([]);
  const [callFlows, setCallFlows] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  
  const [formData, setFormData] = useState({
    name: "",
    trunk_ids: [],
    allowed_users: [],
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
      const [resRules, resTrunks, resUsers, resQueues, resCallFlows, resGroups] = await Promise.all([
        fetch(`${protocol}//${apiHost}/api/settings/inbound_rules`),
        fetch(`${protocol}//${apiHost}/api/settings/trunks`),
        fetch(`${protocol}//${apiHost}/api/settings/users`),
        fetch(`${protocol}//${apiHost}/api/settings/queues`),
        fetch(`${protocol}//${apiHost}/api/settings/call-flow/workflows`),
        fetch(`${protocol}//${apiHost}/api/settings/subscriber_groups`)
      ]);

      if (resRules.ok) setRules(await resRules.json());
      if (resTrunks.ok) setTrunks(await resTrunks.json());
      if (resUsers.ok) setUsers(await resUsers.json());
      if (resQueues.ok) setQueues(await resQueues.json());
      if (resCallFlows.ok) setCallFlows(await resCallFlows.json());
      if (resGroups.ok) setSubscriberGroups(await resGroups.json());

      setLoading(false);
    } catch (err) {
      console.error("Inbound rules verileri çekilemedi:", err);
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

    setFormData(prev => {
      let nextDestId = prev.destination_id;
      if (prev.destination_type === "user") {
        const firstUserId = updatedIds.find(id => !String(id).startsWith("group_")) || updatedIds[0] || "";
        if (!nextDestId || !updatedIds.some(id => String(id) === String(nextDestId))) {
          nextDestId = firstUserId;
        }
      }
      return {
        ...prev,
        allowed_users: updatedIds,
        destination_id: nextDestId
      };
    });
  };

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setSelectedRule(rule);
      let initialAllowed = [...(rule.allowed_users || [])];
      if (rule.destination_type === "user" && rule.destination_id && !initialAllowed.some(x => String(x) === String(rule.destination_id))) {
        initialAllowed.push(rule.destination_id);
      }
      initialAllowed.forEach(id => {
        if (String(id).startsWith("group_")) {
          const grpId = String(id).replace("group_", "");
          const grp = (subscriberGroups || []).find(g => String(g.id) === grpId);
          if (grp) {
            getGroupMemberUserIds(grp, users).forEach(uid => {
              if (!initialAllowed.some(x => String(x) === String(uid))) {
                initialAllowed.push(uid);
              }
            });
          }
        }
      });
      setFormData({
        id: rule.id,
        name: rule.name || "",
        trunk_ids: rule.trunk_ids || [],
        allowed_users: initialAllowed,
        destination_type: rule.destination_type || "user",
        destination_id: rule.destination_id || "",
        did_match_mode: rule.did_match_mode || "all",
        did_patterns: rule.did_patterns || []
      });
    } else {
      setFormData({
        name: "",
        trunk_ids: [],
        allowed_users: [],
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
    if (name === "destination_id" && formData.destination_type === "user" && value) {
      let nextAllowed = [...(formData.allowed_users || [])];
      if (String(value).startsWith("group_")) {
        if (!nextAllowed.some(x => String(x) === String(value))) {
          nextAllowed.push(value);
        }
        const grpId = String(value).replace("group_", "");
        const grp = (subscriberGroups || []).find(g => String(g.id) === grpId);
        if (grp) {
          getGroupMemberUserIds(grp, users).forEach(uid => {
            if (!nextAllowed.some(x => String(x) === String(uid))) {
              nextAllowed.push(uid);
            }
          });
        }
      } else {
        const matchedUser = users.find(u => String(u.id) === String(value));
        const uidToAdd = matchedUser ? matchedUser.id : value;
        if (!nextAllowed.some(x => String(x) === String(uidToAdd))) {
          nextAllowed.push(uidToAdd);
        }
      }
      setFormData(prev => ({ ...prev, destination_id: value, allowed_users: nextAllowed }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    let resolvedDestId = formData.destination_id;
    if (formData.destination_type === "user" && !resolvedDestId && formData.allowed_users && formData.allowed_users.length > 0) {
      resolvedDestId = formData.allowed_users.find(id => !String(id).startsWith("group_")) || formData.allowed_users[0];
    }
    const payload = {
      id: selectedRule ? selectedRule.id : null,
      ...formData,
      destination_id: resolvedDestId
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

  const handleExportExcel = () => {
    const data = rules.map(rule => {
      const trunkIds = rule.trunk_ids || [];
      const trunkNames = trunkIds.map(id => {
        const t = trunks.find(x => x.id === id);
        return t ? (t.trunk_name || t.host) : id;
      }).join(", ");

      let destName = "";
      let destTypeLabel = "Kullanıcı";
      if (rule.destination_type === "user") {
        destTypeLabel = "Kullanıcı / Abone Grubu";
        if (String(rule.destination_id || "").startsWith("group_")) {
          const gid = String(rule.destination_id).replace("group_", "");
          const grp = subscriberGroups.find(g => String(g.id) === gid);
          destName = grp ? `[Abone Grubu: ${grp.name}]` : String(rule.destination_id || "");
        } else {
          const u = users.find(x => String(x.id) === String(rule.destination_id));
          destName = u ? u.full_name : String(rule.destination_id || "");
        }
      } else if (rule.destination_type === "queue") {
        destTypeLabel = "Kuyruk";
        const q = queues.find(x => x.id === rule.destination_id);
        destName = q ? q.name : String(rule.destination_id || "");
      } else if (rule.destination_type === "call_flow") {
        destTypeLabel = "Çağrı Akışı";
        const cf = callFlows.find(x => x.id === rule.destination_id);
        destName = cf ? cf.name : String(rule.destination_id || "");
      }

      const allowedUserNames = (rule.allowed_users || []).map(uid => {
        if (String(uid).startsWith("group_")) {
          const gid = String(uid).replace("group_", "");
          const grp = subscriberGroups.find(g => String(g.id) === gid);
          return grp ? `[Abone Grubu: ${grp.name}]` : uid;
        }
        const u = users.find(x => String(x.id) === String(uid));
        return u ? u.full_name : uid;
      }).join(", ");

      return {
        "Kural Adı": rule.name || "",
        "Dış Hatlar": trunkNames,
        "Hedef Türü": destTypeLabel,
        "Hedef": destName,
        "Dahililer / Abone Grupları": allowedUserNames,
        "DID Eşleşme Modu": rule.did_match_mode || "all",
        "DID Desenleri": Array.isArray(rule.did_patterns) ? rule.did_patterns.join(", ") : ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GelenAramaKurallari");
    XLSX.writeFile(workbook, "Gelen_Arama_Kurallari.xlsx");
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

          const trunksRaw = String(row["Dış Hatlar"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const trunk_ids = trunksRaw.map(tName => {
            const found = trunks.find(t =>
              (t.trunk_name && t.trunk_name.toLowerCase() === tName.toLowerCase()) ||
              (t.host && t.host.toLowerCase() === tName.toLowerCase()) ||
              String(t.id) === tName
            );
            return found ? found.id : null;
          }).filter(Boolean);

          const typeRaw = String(row["Hedef Türü"] || "").trim().toLowerCase();
          let destination_type = "user";
          if (typeRaw.includes("kuyruk") || typeRaw === "queue") destination_type = "queue";
          else if (typeRaw.includes("akış") || typeRaw.includes("akis") || typeRaw === "call_flow") destination_type = "call_flow";

          const destRaw = String(row["Hedef"] || "").trim();
          let destination_id = destRaw;
          if (destination_type === "user") {
            const cleanGrp = destRaw.replace(/^\[Abone Grubu:\s*/i, "").replace(/\]$/, "").trim();
            const foundGrp = subscriberGroups.find(g => g.name && g.name.toLowerCase() === cleanGrp.toLowerCase());
            if (foundGrp) {
              destination_id = `group_${foundGrp.id}`;
            } else {
              const u = users.find(x => (x.full_name && x.full_name.toLowerCase() === destRaw.toLowerCase()) || String(x.extension) === destRaw || String(x.id) === destRaw);
              if (u) destination_id = u.id;
            }
          } else if (destination_type === "queue") {
            const q = queues.find(x => (x.name && x.name.toLowerCase() === destRaw.toLowerCase()) || String(x.extension) === destRaw || String(x.id) === destRaw);
            if (q) destination_id = q.id;
          } else if (destination_type === "call_flow") {
            const cf = callFlows.find(x => (x.name && x.name.toLowerCase() === destRaw.toLowerCase()) || String(x.id) === destRaw);
            if (cf) destination_id = cf.id;
          }

          const did_match_mode = String(row["DID Eşleşme Modu"] || "all").trim();
          const did_patterns = String(row["DID Desenleri"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const existing = rules.find(r => r.name && r.name.toLowerCase() === name.toLowerCase());

          await fetch(`${protocol}//${apiHost}/api/settings/inbound_rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existing ? existing.id : null,
              name,
              trunk_ids,
              destination_type,
              destination_id,
              did_match_mode,
              did_patterns
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
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Hedef / Dahililer</th>
                  <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRules.map(rule => {
                  const trunkIds = rule.trunk_ids || [];
                  const assignedTrunks = trunkIds.map(id => trunks.find(t => t.id === id)).filter(Boolean);
                  
                  let destName = "Bilinmeyen Hedef";
                  if (rule.destination_type === "user") {
                    if (String(rule.destination_id || "").startsWith("group_")) {
                      const gid = String(rule.destination_id).replace("group_", "");
                      const grp = subscriberGroups.find(g => String(g.id) === gid);
                      destName = grp ? `Abone Grubu: ${grp.name}` : "Abone Grubu";
                    } else {
                      const u = users.find(x => String(x.id) === String(rule.destination_id));
                      destName = u ? `Kullanıcı: ${u.full_name} (${u.extension})` : "Kullanıcı";
                    }
                  } else if (rule.destination_type === "queue") {
                    const q = queues.find(x => x.id === rule.destination_id);
                    destName = q ? `Kuyruk: ${q.name}` : "Kuyruk (Silinmiş)";
                  } else if (rule.destination_type === "call_flow") {
                    const cf = callFlows.find(x => x.id === rule.destination_id);
                    destName = cf ? `Akış: ${cf.name}` : "Akış (Silinmiş)";
                  }

                  const ruleAllowed = rule.allowed_users || [];
                  const groupIds = ruleAllowed.filter(uid => String(uid).startsWith("group_"));
                  const userIds = ruleAllowed.filter(uid => !String(uid).startsWith("group_"));

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
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{destName}</span>
                          {ruleAllowed.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {groupIds.map(gid => {
                                const rawId = String(gid).replace("group_", "");
                                const grp = subscriberGroups.find(g => String(g.id) === rawId);
                                return (
                                  <span
                                    key={gid}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}
                                    title={grp ? `Abone Grubu: ${grp.name}` : gid}
                                  >
                                    <Users size={11} />
                                    {grp ? grp.name : gid}
                                  </span>
                                );
                              })}
                              <div className="flex -space-x-2 overflow-hidden">
                                {userIds.slice(0, 5).map((uid) => {
                                  const u = users.find(x => String(x.id) === String(uid));
                                  return (
                                    <div key={uid} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0" title={u ? `${u.full_name} (${u.extension})` : uid}>
                                      {u?.avatar ? (
                                        <img src={u.avatar} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                                      ) : (
                                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">{u ? u.full_name.charAt(0) : '?'}</span>
                                      )}
                                    </div>
                                  );
                                })}
                                {userIds.length > 5 && (
                                  <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-bold text-slate-500">+{userIds.length - 5}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
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
                      <option value="user">Kullanıcı / Abone Grubu</option>
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
                        <option value="">Kullanıcı veya Abone Grubu Seçiniz...</option>
                        {subscriberGroups.length > 0 && (
                          <optgroup label="Abone Grupları">
                            {subscriberGroups.map(g => (
                              <option key={`group_${g.id}`} value={`group_${g.id}`}>
                                [Abone Grubu] {g.name} ({getGroupMemberUserIds(g, users).length} Abone)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Kullanıcılar (Dahililer)">
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name} ({u.extension})</option>
                          ))}
                        </optgroup>
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
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || formData.trunk_ids.length === 0 || (!formData.destination_id && (!formData.allowed_users || formData.allowed_users.length === 0))}
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
