import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  X,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import TablePagination from "../ui/TablePagination";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

const PhonebookDualListBox = ({
  title,
  availableItems,
  selectedIds,
  onChangeSelectedIds,
  bg,
  text,
  borderLight,
  lightBg,
}) => {
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all"); // "all" | "internal" | "external"
  const [checkedAvailable, setCheckedAvailable] = useState([]);
  const [checkedSelected, setCheckedSelected] = useState([]);

  const unselectedItems = availableItems.filter(
    (i) => !selectedIds.some((sid) => String(sid) === String(i.id))
  );
  const selectedItems = selectedIds
    .map((id) => availableItems.find((i) => String(i.id) === String(id)))
    .filter(Boolean);

  const filteredAvailable = unselectedItems.filter((i) => {
    if (sourceFilter === "internal" && i.itemType !== "internal" && i.itemType !== "group") return false;
    if (sourceFilter === "external" && i.itemType !== "external") return false;
    if (!availableSearch.trim()) return true;
    const q = availableSearch.toLowerCase().trim();
    return (
      String(i.number || "").toLowerCase().includes(q) ||
      String(i.name || "").toLowerCase().includes(q) ||
      String(i.badgeLabel || "").toLowerCase().includes(q)
    );
  });

  const filteredSelected = selectedItems.filter((i) => {
    if (!selectedSearch.trim()) return true;
    const q = selectedSearch.toLowerCase().trim();
    return (
      String(i.number || "").toLowerCase().includes(q) ||
      String(i.name || "").toLowerCase().includes(q) ||
      String(i.badgeLabel || "").toLowerCase().includes(q)
    );
  });

  const toggleAvailable = (id) => {
    setCheckedAvailable((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelected = (id) => {
    setCheckedSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const moveRight = (e) => {
    e.preventDefault();
    if (checkedAvailable.length === 0) return;
    onChangeSelectedIds([...selectedIds, ...checkedAvailable]);
    setCheckedAvailable([]);
  };

  const moveAllRight = (e) => {
    e.preventDefault();
    if (filteredAvailable.length === 0) return;
    const idsToAdd = filteredAvailable.map((i) => i.id);
    const merged = Array.from(new Set([...selectedIds, ...idsToAdd]));
    onChangeSelectedIds(merged);
    setCheckedAvailable([]);
  };

  const moveLeft = (e) => {
    e.preventDefault();
    if (checkedSelected.length === 0) return;
    onChangeSelectedIds(selectedIds.filter((id) => !checkedSelected.includes(id)));
    setCheckedSelected([]);
  };

  const moveAllLeft = (e) => {
    e.preventDefault();
    if (filteredSelected.length === 0) return;
    const removeSet = new Set(filteredSelected.map((i) => String(i.id)));
    onChangeSelectedIds(selectedIds.filter((id) => !removeSet.has(String(id))));
    setCheckedSelected([]);
  };

  const renderItemCells = (item) => {
    if (item.itemType === "group") {
      return (
        <>
          <td className="p-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}
            >
              <Users size={11} />
              Abone Grubu
            </span>
          </td>
          <td className="p-2 text-slate-800 dark:text-slate-200 font-bold">
            {item.name}
            <span className="ml-1.5 text-[10px] font-medium text-slate-400">
              ({(item.memberUserTokens || []).length} Dahili)
            </span>
          </td>
        </>
      );
    }
    if (item.itemType === "internal") {
      return (
        <>
          <td className="p-2">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                Dahili
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {item.number}
              </span>
            </div>
          </td>
          <td className="p-2 text-slate-600 dark:text-slate-300 font-medium">{item.name}</td>
        </>
      );
    }
    return (
      <>
        <td className="p-2">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
              Rehber
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {item.number}
            </span>
          </div>
        </td>
        <td className="p-2 text-slate-600 dark:text-slate-300 font-medium">{item.name}</td>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={moveAllRight}
            disabled={filteredAvailable.length === 0}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${lightBg} ${text} ${borderLight}`}
            title=" Sol listedeki tüm kayıtları telefon rehberine ekle"
          >
            <ChevronsRight size={13} />
            <span>Tümünü Seç ({filteredAvailable.length})</span>
          </button>
          <button
            type="button"
            onClick={moveAllLeft}
            disabled={filteredSelected.length === 0}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Sağ listedeki tüm kayıtları telefon rehberinden çıkart"
          >
            <ChevronsLeft size={13} />
            <span>Tümünü Çıkart ({filteredSelected.length})</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-3 w-full">
        {/* Left: Available List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[350px]">
          <div className="flex items-center justify-between p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  checkedAvailable.length === filteredAvailable.length &&
                  filteredAvailable.length > 0
                }
                onChange={(e) =>
                  setCheckedAvailable(
                    e.target.checked ? filteredAvailable.map((i) => i.id) : []
                  )
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              {filteredAvailable.length} Öğe
            </label>
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "Tümü" },
                { id: "internal", label: "Dahililer" },
                { id: "external", label: "Rehber" },
              ].map((ft) => (
                <button
                  key={ft.id}
                  type="button"
                  onClick={() => setSourceFilter(ft.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                    sourceFilter === ft.id
                      ? `${bg} text-white`
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Dahili no, telefon veya isim ara..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 font-semibold text-slate-500">Dahili / Telefon No</th>
                  <th className="p-2 font-semibold text-slate-500">Görünen İsim</th>
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-xs text-slate-400 italic">
                      Eklenecek kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredAvailable.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        checkedAvailable.includes(item.id) ? lightBg : ""
                      }`}
                      onClick={() => toggleAvailable(item.id)}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checkedAvailable.includes(item.id)}
                          onChange={() => toggleAvailable(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </td>
                      {renderItemCells(item)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Center Transfer Buttons */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 px-1">
          <button
            type="button"
            onClick={moveAllRight}
            disabled={filteredAvailable.length === 0}
            title="Tümünü Seç (Ekle)"
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${
              filteredAvailable.length > 0
                ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white cursor-pointer"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            } transition-colors`}
          >
            <ChevronsRight size={17} className="hidden md:block" />
            <ChevronsRight size={17} className="block md:hidden rotate-90" />
          </button>
          <button
            type="button"
            onClick={moveRight}
            disabled={checkedAvailable.length === 0}
            title="Seçilenleri Ekle"
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${
              checkedAvailable.length > 0
                ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white cursor-pointer"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            } transition-colors`}
          >
            <ChevronRight size={17} className="hidden md:block" />
            <ChevronRight size={17} className="block md:hidden rotate-90" />
          </button>
          <button
            type="button"
            onClick={moveLeft}
            disabled={checkedSelected.length === 0}
            title="Seçilenleri Çıkart"
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${
              checkedSelected.length > 0
                ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white cursor-pointer"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            } transition-colors`}
          >
            <ChevronLeft size={17} className="hidden md:block" />
            <ChevronLeft size={17} className="block md:hidden rotate-90" />
          </button>
          <button
            type="button"
            onClick={moveAllLeft}
            disabled={filteredSelected.length === 0}
            title="Tümünü Çıkart"
            className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${
              filteredSelected.length > 0
                ? "hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 cursor-pointer"
                : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
            } transition-colors`}
          >
            <ChevronsLeft size={17} className="hidden md:block" />
            <ChevronsLeft size={17} className="block md:hidden rotate-90" />
          </button>
        </div>

        {/* Right: Selected List */}
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 flex flex-col overflow-hidden h-[350px]">
          <div className="flex items-center justify-between p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  checkedSelected.length === filteredSelected.length &&
                  filteredSelected.length > 0
                }
                onChange={(e) =>
                  setCheckedSelected(
                    e.target.checked ? filteredSelected.map((i) => i.id) : []
                  )
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              {filteredSelected.length} Öğe
            </label>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Rehberde Görünür (Seçili)
            </span>
          </div>

          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Seçililerde ara..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 font-semibold text-slate-500">Dahili / Telefon No</th>
                  <th className="p-2 font-semibold text-slate-500">Görünen İsim</th>
                </tr>
              </thead>
              <tbody>
                {filteredSelected.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-xs text-slate-400 italic">
                      Henüz kişi seçilmedi. Soldan kişi veya dahili ekleyin.
                    </td>
                  </tr>
                ) : (
                  filteredSelected.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        checkedSelected.includes(item.id) ? lightBg : ""
                      }`}
                      onClick={() => toggleSelected(item.id)}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checkedSelected.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </td>
                      {renderItemCells(item)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ContactsPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState("contacts"); // "contacts" | "phonebooks"

  const [contacts, setContacts] = useState([]);
  const [allContactsForBook, setAllContactsForBook] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscriberGroups, setSubscriberGroups] = useState([]);
  const [phonebooks, setPhonebooks] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [pbSearchQuery, setPbSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  // Role Permissions State
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);

  // Contact Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Phonebook Group Modal States
  const [showPbModal, setShowPbModal] = useState(false);
  const [editingPb, setEditingPb] = useState(null);
  const [pbForm, setPbForm] = useState({ name: "", entries: [] });
  const [pbError, setPbError] = useState("");
  const [deletePbTargetId, setDeletePbTargetId] = useState(null);
  const [copiedPbId, setCopiedPbId] = useState(null);

  const API_BASE = getApiBaseUrl(backendHost);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (pbError) {
      const timer = setTimeout(() => setPbError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [pbError]);

  const fetchContacts = async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `${API_BASE}/api/contacts?q=${encodeURIComponent(q)}` : `${API_BASE}/api/contacts`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
        if (!q) setAllContactsForBook(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("[Contacts] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhonebookDependencies = async () => {
    try {
      const [resPbs, resUsers, resSubGroups, resAllContacts] = await Promise.all([
        fetch(`${API_BASE}/api/settings/phonebooks`).catch(() => null),
        fetch(`${API_BASE}/api/settings/users`).catch(() => null),
        fetch(`${API_BASE}/api/settings/subscriber_groups`).catch(() => null),
        fetch(`${API_BASE}/api/contacts`).catch(() => null),
      ]);
      if (resPbs && resPbs.ok) {
        const pbData = await resPbs.json();
        setPhonebooks(Array.isArray(pbData) ? pbData : []);
      }
      if (resUsers && resUsers.ok) {
        const uData = await resUsers.json();
        setUsers(Array.isArray(uData) ? uData.filter((u) => u && u.is_active !== false && u.extension) : []);
      }
      if (resSubGroups && resSubGroups.ok) {
        const sgData = await resSubGroups.json();
        setSubscriberGroups(Array.isArray(sgData) ? sgData : []);
      }
      if (resAllContacts && resAllContacts.ok) {
        const cData = await resAllContacts.json();
        setAllContactsForBook(Array.isArray(cData) ? cData : []);
      }
    } catch (err) {
      console.error("[Phonebooks] Fetch dependencies error:", err);
    }
  };

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        let currentUserId =
          typeof window !== "undefined"
            ? localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id")
            : null;
        if (!currentUserId) {
          const resStatus = await fetch(`${API_BASE}/api/agent/status`);
          const statusData = await resStatus.json();
          if (!statusData.is_logged_in) {
            setHasWritePermission(true);
            setHasDeletePermission(true);
            return;
          }
          currentUserId = statusData.user_id;
        }

        const resUsers = await fetch(`${API_BASE}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = (Array.isArray(usersData) ? usersData : []).find((u) => u.id === currentUserId);
        if (!currentUser || currentUser.role === "admin") {
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = (Array.isArray(rolesData) ? rolesData : []).find((r) => r.role_code === currentUser.role);
        if (!currentRole) {
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        setHasWritePermission(currentRole.permissions.includes("contacts:write"));
        setHasDeletePermission(currentRole.permissions.includes("contacts:delete"));
      } catch (err) {
        setHasWritePermission(true);
        setHasDeletePermission(true);
      }
    };

    checkPermissions();
    fetchContacts();
    fetchPhonebookDependencies();
  }, [backendHost]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setContactsPage(1);
    fetchContacts(val);
  };

  const openFormModal = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFirstName(contact.first_name);
      setLastName(contact.last_name);
      setPhone(contact.phone_number);
      setEmail(contact.email || "");
    } else {
      setEditingContact(null);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
    }
    setErrorMsg("");
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingContact(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg("Ad, Soyad ve Telefon alanları zorunludur.");
      return;
    }

    const phoneClean = phone.trim();
    const dupPhoneContact = (contacts || []).find(
      (c) =>
        String(c.phone_number || "").trim() === phoneClean &&
        (!editingContact || String(c.id) !== String(editingContact.id))
    );
    if (dupPhoneContact) {
      const cName = `${dupPhoneContact.first_name || ""} ${dupPhoneContact.last_name || ""}`.trim() || "Kayıtlı Kişi";
      setErrorMsg(`Bu telefon numarasına (${phoneClean}) ait '${cName}' isimli bir kayıt zaten mevcut.`);
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: phoneClean,
      email: email.trim() || null,
    };

    setLoading(true);
    try {
      const res = await fetch(
        editingContact ? `${API_BASE}/api/contacts/${editingContact.id}` : `${API_BASE}/api/contacts`,
        {
          method: editingContact ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        setSuccessMsg(editingContact ? "Kişi bilgileri güncellendi." : "Yeni kişi rehbere eklendi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        closeFormModal();
        fetchContacts(searchQuery);
        fetchPhonebookDependencies();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "İşlem başarısız oldu.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg("Kişi rehberden başarıyla silindi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchContacts(searchQuery);
        fetchPhonebookDependencies();
      }
    } catch (err) {
      console.error("[Contacts] Delete error:", err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleExportExcel = () => {
    const data = contacts.map((c) => ({
      Ad: c.first_name || "",
      Soyad: c.last_name || "",
      "Telefon Numarası": c.phone_number || "",
      "E-posta": c.email || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rehber");
    XLSX.writeFile(workbook, "Rehber.xlsx");
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

        for (const row of data) {
          let first_name = String(row["Ad"] || row["İsim"] || "").trim();
          let last_name = String(row["Soyad"] || row["Soyisim"] || "").trim();
          const fullName = String(row["Ad Soyad"] || row["İsim Soyisim"] || "").trim();
          if (!first_name && fullName) {
            const parts = fullName.split(" ");
            first_name = parts[0] || "";
            last_name = parts.slice(1).join(" ") || "-";
          }
          if (first_name && !last_name) last_name = "-";
          const phone_number = String(row["Telefon Numarası"] || row["Telefon"] || "").trim();
          const emailVal = String(row["E-posta"] || row["Email"] || "").trim() || null;

          if (!first_name || !phone_number) continue;

          const existing = contacts.find((c) => String(c.phone_number || "").trim() === phone_number);
          const payload = { first_name, last_name, phone_number, email: emailVal };

          if (existing) {
            await fetch(`${API_BASE}/api/contacts/${existing.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          } else {
            await fetch(`${API_BASE}/api/contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        }

        setSuccessMsg("Rehber kayıtları başarıyla içe aktarıldı.");
        setTimeout(() => setSuccessMsg(""), 3000);
        await fetchContacts(searchQuery);
        await fetchPhonebookDependencies();
      } catch (err) {
        setErrorMsg("Excel dosyası okunurken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  // --- Telefon Rehberi (Desk Phone Directory Groups) Logic ---
  const getGroupMemberUserTokens = (grp) => {
    const rawExts = grp?.extensions || grp?.members || [];
    const tokens = [];
    rawExts.forEach((val) => {
      const u = (users || []).find(
        (usr) => String(usr.id) === String(val) || String(usr.extension) === String(val)
      );
      if (u) {
        const tok = `user_${u.id}`;
        if (!tokens.includes(tok)) tokens.push(tok);
      }
    });
    return tokens;
  };

  const availableDirectoryItems = [
    ...(subscriberGroups || []).map((g) => {
      const memberUserTokens = getGroupMemberUserTokens(g);
      return {
        id: `group_${g.id}`,
        itemType: "group",
        number: `Abone Grubu`,
        name: g.name,
        badgeLabel: "Abone Grubu",
        memberUserTokens,
      };
    }),
    ...(users || []).map((u) => ({
      id: `user_${u.id}`,
      userId: u.id,
      itemType: "internal",
      number: String(u.extension || ""),
      name: u.full_name || `Dahili ${u.extension}`,
      avatar: u.avatar,
      badgeLabel: "Dahili",
    })),
    ...(allContactsForBook || []).map((c) => {
      const fn = String(c.first_name || "").trim();
      const ln = String(c.last_name || "").trim() === "-" ? "" : String(c.last_name || "").trim();
      return {
        id: `contact_${c.id}`,
        contactId: c.id,
        itemType: "external",
        number: String(c.phone_number || ""),
        name: `${fn} ${ln}`.trim() || String(c.phone_number || ""),
        badgeLabel: "Rehber",
      };
    }),
  ];

  const handlePbEntriesChange = (newSelectedIds) => {
    const prevIds = pbForm.entries || [];
    const addedIds = newSelectedIds.filter((id) => !prevIds.some((pid) => String(pid) === String(id)));
    const removedIds = prevIds.filter((id) => !newSelectedIds.some((nid) => String(nid) === String(id)));

    let updatedIds = [...newSelectedIds];

    addedIds.forEach((addedId) => {
      if (String(addedId).startsWith("group_")) {
        const grpItem = availableDirectoryItems.find((item) => String(item.id) === String(addedId));
        if (grpItem && Array.isArray(grpItem.memberUserTokens)) {
          grpItem.memberUserTokens.forEach((tok) => {
            if (!updatedIds.includes(tok)) updatedIds.push(tok);
          });
        }
      }
    });

    removedIds.forEach((removedId) => {
      if (String(removedId).startsWith("group_")) {
        const grpItem = availableDirectoryItems.find((item) => String(item.id) === String(removedId));
        if (grpItem && Array.isArray(grpItem.memberUserTokens)) {
          updatedIds = updatedIds.filter((id) => !grpItem.memberUserTokens.includes(String(id)));
        }
      }
    });

    setPbForm((prev) => ({ ...prev, entries: updatedIds }));
  };

  const handleOpenPbModal = (pb = null) => {
    setPbError("");
    if (pb) {
      setEditingPb(pb);
      const validIds = (pb.entries || []).filter((id) =>
        availableDirectoryItems.some((item) => String(item.id) === String(id))
      );
      setPbForm({
        name: pb.name || "",
        entries: validIds,
      });
    } else {
      setEditingPb(null);
      setPbForm({
        name: "",
        entries: [],
      });
    }
    setShowPbModal(true);
  };

  const handleSavePb = async () => {
    setPbError("");
    const nameTrim = String(pbForm.name || "").trim();
    if (!nameTrim) {
      setPbError("Lütfen telefon rehberi adını giriniz.");
      return;
    }

    const dup = (phonebooks || []).find(
      (p) =>
        String(p.name || "").trim().toLowerCase() === nameTrim.toLowerCase() &&
        (!editingPb || String(p.id) !== String(editingPb.id))
    );
    if (dup) {
      setPbError(`'${nameTrim}' isimli bir telefon rehberi zaten mevcut.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/settings/phonebooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPb ? editingPb.id : null,
          name: nameTrim,
          entries: pbForm.entries,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPhonebooks(data.phonebooks || []);
        setShowPbModal(false);
        setEditingPb(null);
        setSuccessMsg(editingPb ? "Telefon rehberi güncellendi." : "Yeni telefon rehberi oluşturuldu.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setPbError(data.detail || "Telefon rehberi kaydedilemedi.");
      }
    } catch (err) {
      setPbError("Sunucu ile bağlantı kurulamadı.");
    }
  };

  const handleDeletePbConfirm = async () => {
    if (!deletePbTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/phonebooks/${deletePbTargetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setPhonebooks(data.phonebooks || []);
        setSuccessMsg("Telefon rehberi silindi.");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("[Phonebooks] Delete error:", err);
    } finally {
      setDeletePbTargetId(null);
    }
  };

  const handleCopyXmlUrl = (pbId) => {
    const url = `${window.location.origin}/api/phonebook/${pbId}/yealink.xml`;
    navigator.clipboard?.writeText(url);
    setCopiedPbId(pbId);
    setTimeout(() => setCopiedPbId(null), 2000);
  };

  const filteredPhonebooks = (phonebooks || []).filter((pb) =>
    !pbSearchQuery.trim()
      ? true
      : String(pb.name || "").toLowerCase().includes(pbSearchQuery.toLowerCase().trim())
  );

  const [contactsPage, setContactsPage] = useState(1);
  const [contactsPageSize, setContactsPageSize] = useState(25);
  const paginatedContacts = contacts.slice(
    (contactsPage - 1) * contactsPageSize,
    contactsPage * contactsPageSize
  );

  const [pbPage, setPbPage] = useState(1);
  const [pbPageSize, setPbPageSize] = useState(25);
  const paginatedPhonebooks = filteredPhonebooks.slice(
    (pbPage - 1) * pbPageSize,
    pbPage * pbPageSize
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Standalone Header Card with Top Sub-Tabs */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                Rehber &amp; Masa Telefonu Rehberi
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Dış rehber kişilerini yönetin ve masa telefonlarında görünecek dahili/rehber gruplarını oluşturun.
              </p>
            </div>
          </div>

          {/* Search Bar + Action Buttons depending on Active SubTab */}
          {activeSubTab === "contacts" ? (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Rehberde arayın..."
                  className={`w-56 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImportExcel}
              />

              {hasWritePermission && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50 cursor-pointer"
                  title="Excel'den İçe Aktar (Import)"
                >
                  <Upload size={16} />
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50 cursor-pointer"
                title="Excel'e Dışa Aktar (Export)"
              >
                <Download size={16} />
              </button>

              {hasWritePermission && (
                <button
                  onClick={() => openFormModal()}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
                  title="Yeni Kişi Ekle"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={pbSearchQuery}
                  onChange={(e) => setPbSearchQuery(e.target.value)}
                  placeholder="Telefon rehberi ara..."
                  className={`w-56 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {hasWritePermission && (
                <button
                  onClick={() => handleOpenPbModal()}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
                  title="Yeni Telefon Rehberi Oluştur"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sub-Tabs Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveSubTab("contacts")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === "contacts"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen size={14} />
            <span>Kişi Listesi ({contacts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("phonebooks")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === "phonebooks"
                ? `${bg} text-white shadow-sm`
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Smartphone size={14} />
            <span>Telefon Rehberi ({phonebooks.length})</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 text-left">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {activeSubTab === "contacts" ? (
        /* TAB 1: External Contacts List Table */
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-850">
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  İsim Soyisim
                </th>
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  Telefon Numarası
                </th>
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  E-posta
                </th>
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-right">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-slate-400 font-bold animate-pulse">
                    Kişiler yükleniyor...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-slate-400 dark:text-slate-550 font-bold">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition">
                    <td className="p-4 text-xs font-bold text-slate-850 dark:text-slate-200">
                      {contact.first_name} {contact.last_name}
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-550 dark:text-slate-400">
                      {contact.phone_number}
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-550 dark:text-slate-400">
                      {contact.email || <span className="text-slate-300 dark:text-slate-700">-</span>}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: {
                                phone: contact.phone_number,
                                name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
                              },
                            })
                          )
                        }
                        title="Müşteri 360° Tüm Kanal Geçmişini Aç"
                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${lightBg} ${text} ${borderLight} hover:opacity-90 transition cursor-pointer`}
                      >
                        360° Kart
                      </button>
                      {hasWritePermission && (
                        <button
                          onClick={() => openFormModal(contact)}
                          className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-blue-400 transition cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {hasDeletePermission && (
                        <button
                          onClick={() => setDeleteTargetId(contact.id)}
                          className="p-1.5 text-slate-450 hover:text-rose-500 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {contacts.length > 0 && (
            <div className="mt-4">
              <TablePagination
                currentPage={contactsPage}
                totalItems={contacts.length}
                pageSize={contactsPageSize}
                onPageChange={setContactsPage}
                onPageSizeChange={(sz) => {
                  setContactsPageSize(sz);
                  setContactsPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="rehber kaydın"
              />
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: Telefon Rehberi (Desk Phone Directories) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {filteredPhonebooks.length === 0 ? (
            <div className="text-center p-12">
              <div className={`w-16 h-16 rounded-full ${lightBg} ${text} flex items-center justify-center mx-auto mb-4`}>
                <Smartphone size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
                Henüz Telefon Rehberi Oluşturulmadı
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Masa telefonlarında (Yealink, Fanvil, Grandstream, Snom) görünecek dahili numaraları ve dış rehber kişilerini seçmek için sağ üstteki <strong>+</strong> butonuna tıklayın.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                      Telefon Rehberi Adı
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                      Seçili Dahililer &amp; Rehber Kişileri
                    </th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                      Masa Telefonu XML Bağlantısı
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedPhonebooks.map((pb) => {
                    const entries = pb.entries || [];
                    const validInternalUsers = entries
                      .filter((e) => String(e).startsWith("user_"))
                      .map((e) => {
                        const uid = String(e).replace("user_", "");
                        return users.find((u) => String(u.id) === uid);
                      })
                      .filter(Boolean);

                    const validExternalContacts = entries
                      .filter((e) => String(e).startsWith("contact_"))
                      .map((e) => {
                        const cid = String(e).replace("contact_", "");
                        return allContactsForBook.find((c) => String(c.id) === cid);
                      })
                      .filter(Boolean);

                    const combinedPreview = [
                      ...validInternalUsers.map((u) => ({
                        key: `u_${u.id}`,
                        label: `${u.full_name} (${u.extension})`,
                        initial: (u.full_name || "?").charAt(0),
                        avatar: u.avatar,
                        isInternal: true,
                      })),
                      ...validExternalContacts.map((c) => {
                        const nm = `${c.first_name || ""} ${c.last_name === "-" ? "" : c.last_name || ""}`.trim();
                        return {
                          key: `c_${c.id}`,
                          label: `${nm} (${c.phone_number})`,
                          initial: (nm || "#").charAt(0),
                          avatar: null,
                          isInternal: false,
                        };
                      }),
                    ];

                    return (
                      <tr
                        key={pb.id}
                        onClick={() => handleOpenPbModal(pb)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              {pb.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {combinedPreview.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Kişi Seçilmedi</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                {validInternalUsers.length} Dahili
                              </span>
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {validExternalContacts.length} Rehber Kişisi
                              </span>
                              <div className="flex -space-x-2 overflow-hidden ml-1">
                                {combinedPreview.slice(0, 5).map((item) => (
                                  <div
                                    key={item.key}
                                    className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0"
                                    title={item.label}
                                  >
                                    {item.avatar ? (
                                      <img
                                        src={item.avatar}
                                        alt={item.label}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                        {item.initial}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {combinedPreview.length > 5 && (
                                  <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-slate-500">
                                      +{combinedPreview.length - 5}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleCopyXmlUrl(pb.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                            title="Masa telefonu Remote XML Rehber bağlantısını kopyala"
                          >
                            {copiedPbId === pb.id ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">XML URL Kopyalandı</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>XML Rehber URL Kopyala</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {hasWritePermission && (
                              <button
                                onClick={() => handleOpenPbModal(pb)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Rehberi Düzenle"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {hasDeletePermission && (
                              <button
                                onClick={() => setDeletePbTargetId(pb.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
                <TablePagination
                  currentPage={pbPage}
                  totalItems={filteredPhonebooks.length}
                  pageSize={pbPageSize}
                  onPageChange={setPbPage}
                  onPageSizeChange={(sz) => {
                    setPbPageSize(sz);
                    setPbPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                  itemLabel="telefon rehberin"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Create / Edit Contact Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-xs font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">
                {editingContact ? "Kişi Detaylarını Düzenle" : "Yeni Kişi Kaydı"}
              </h3>
              <button
                onClick={closeFormModal}
                className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg("")}
                    className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
                    title="Kapat"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                    Ad *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                    Soyad *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  Telefon Numarası *
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+905551112233"
                    className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  E-posta
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@posta.com"
                    className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-500/20 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer`}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create / Edit Telefon Rehberi (Queue-style DualListBox Modal) */}
      {showPbModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Smartphone size={18} className={text} />
                {editingPb ? "Telefon Rehberini Düzenle" : "Yeni Telefon Rehberi Oluştur"}
              </h3>
              <button
                onClick={() => setShowPbModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {pbError && (
              <div className="mx-6 mt-3 p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{pbError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPbError("")}
                  className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/30 dark:bg-slate-950/20">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  Genel
                </h4>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="text-rose-500 mr-1">*</span>Telefon Rehberi Adı
                  </label>
                  <input
                    type="text"
                    value={pbForm.name}
                    onChange={(e) => setPbForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Örn: Genel Şirket Rehberi, Satış Rehberi, Yönetim Rehberi"
                    className={`w-full text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                  />
                </div>
              </div>

              <PhonebookDualListBox
                title="Dahili Numaralar ve Dış Rehber Kayıtları"
                availableItems={availableDirectoryItems}
                selectedIds={pbForm.entries}
                onChangeSelectedIds={handlePbEntriesChange}
                bg={bg}
                text={text}
                borderLight={borderLight}
                lightBg={lightBg}
              />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPbModal(false)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSavePb}
                disabled={!pbForm.name.trim()}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${bg} hover:opacity-90 cursor-pointer`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Contact Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Kişiyi Rehberden Sil"
        message="Bu rehber kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />

      {/* Confirm Delete Phonebook Modal */}
      <ConfirmDeleteModal
        isOpen={deletePbTargetId !== null}
        onClose={() => setDeletePbTargetId(null)}
        onConfirm={handleDeletePbConfirm}
        title="Telefon Rehberini Sil"
        message="Bu telefon rehberi grubunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
