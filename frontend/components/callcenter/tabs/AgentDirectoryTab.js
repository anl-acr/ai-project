import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Search,
  Phone,
  PhoneForwarded,
  GitBranch,
  LayoutGrid,
  CheckCircle2,
  Star,
  Clock,
  X,
  ChevronDown,
  Building2,
  UserCheck
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { getApiBaseUrl } from "../../../utils/apiHost";
import { webphoneManager } from "../../../utils/webphoneManager";

const DEFAULT_VISIBLE_LIMIT = 12;
const MAX_RECENT_CONTACTS = 5;
const MAX_RECENT_SEARCHES = 5;

export default function AgentDirectoryTab({ backendHost, currentUser, callPanelPerms }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const canTransfer = callPanelPerms?.canTransfer !== false;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAllDefault, setShowAllDefault] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wpState, setWpState] = useState(webphoneManager.state);
  const [transferToast, setTransferToast] = useState(null);

  const [favoriteIds, setFavoriteIds] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  const tabRefs = useRef({});
  const searchInputRef = useRef(null);

  const storageScopeKey = useMemo(() => {
    const uid = currentUser?.id || currentUser?.extension || "default";
    return String(uid);
  }, [currentUser?.id, currentUser?.extension]);

  // Load persisted favorites, recent contacts, and recent searches per agent
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedFavs = JSON.parse(localStorage.getItem(`agent_dir_favs_${storageScopeKey}`) || "[]");
      const savedRecents = JSON.parse(localStorage.getItem(`agent_dir_recents_${storageScopeKey}`) || "[]");
      const savedSearches = JSON.parse(localStorage.getItem(`agent_dir_searches_${storageScopeKey}`) || "[]");
      if (Array.isArray(savedFavs)) setFavoriteIds(savedFavs);
      if (Array.isArray(savedRecents)) setRecentContacts(savedRecents.slice(0, MAX_RECENT_CONTACTS));
      if (Array.isArray(savedSearches)) setRecentSearches(savedSearches.slice(0, MAX_RECENT_SEARCHES));
    } catch (e) {}
  }, [storageScopeKey]);

  const toggleFavorite = (contactId) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(contactId);
      const next = exists ? prev.filter((id) => id !== contactId) : [contactId, ...prev];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_favs_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const recordRecentContact = (contact) => {
    if (!contact?.id || !contact?.number) return;
    const entry = {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      type: contact.type
    };
    setRecentContacts((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, MAX_RECENT_CONTACTS);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_recents_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const recordRecentSearch = (term) => {
    const clean = String(term || "").trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const lower = clean.toLocaleLowerCase("tr-TR");
      const next = [clean, ...prev.filter((s) => s.toLocaleLowerCase("tr-TR") !== lower)].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_searches_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const removeRecentSearch = (term) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== term);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_searches_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const clearRecentHistory = () => {
    setRecentContacts([]);
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`agent_dir_recents_${storageScopeKey}`);
        localStorage.removeItem(`agent_dir_searches_${storageScopeKey}`);
      } catch (e) {}
    }
  };

  useEffect(() => {
    const unsub = webphoneManager.subscribe((st) => {
      setWpState({ ...st });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchDirectory(true);
    const interval = setInterval(() => {
      refreshUserStates();
    }, 2000);
    return () => clearInterval(interval);
  }, [backendHost]);

  useEffect(() => {
    refreshUserStates();
  }, [wpState.registered, wpState.callStatus]);

  // Reset showAllDefault when category or search changes
  useEffect(() => {
    setShowAllDefault(false);
  }, [activeCategory, searchQuery]);

  const refreshUserStates = async () => {
    try {
      const apiBase = getApiBaseUrl(backendHost);
      const usersRes = await fetch(`${apiBase}/api/settings/users?t=${Date.now()}`);
      if (!usersRes.ok) return;
      const usersData = await usersRes.json();
      const rawUsers = Array.isArray(usersData) ? usersData : usersData?.users || [];
      const stateMap = {};
      rawUsers.forEach((u) => {
        const key = `user_${u.id}`;
        const cState = u.call_state || (u.is_registered ? "online" : "offline");
        stateMap[key] = {
          call_state: cState,
          is_registered: !!u.is_registered
        };
      });

      setDirectory((prev) =>
        prev.map((item) => {
          if (item.type === "internal" && stateMap[item.id]) {
            return {
              ...item,
              call_state: stateMap[item.id].call_state,
              is_registered: stateMap[item.id].is_registered
            };
          }
          return item;
        })
      );
    } catch (e) {}
  };

  const fetchDirectory = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const apiBase = getApiBaseUrl(backendHost);

      const [usersRes, contactsRes, queuesRes, workflowsRes] = await Promise.all([
        fetch(`${apiBase}/api/settings/users`),
        fetch(`${apiBase}/api/contacts`),
        fetch(`${apiBase}/api/settings/queues`),
        fetch(`${apiBase}/api/settings/call-flow/workflows`)
      ]);

      const usersData = usersRes.ok ? await usersRes.json() : [];
      const contactsData = contactsRes.ok ? await contactsRes.json() : [];
      const queuesData = queuesRes.ok ? await queuesRes.json() : [];
      const workflowsData = workflowsRes.ok ? await workflowsRes.json() : [];

      const formattedUsers = (Array.isArray(usersData) ? usersData : usersData?.users || []).map((u) => {
        const cState = u.call_state || (u.is_registered ? "online" : "offline");
        const displayName = u.full_name || u.name || u.username || `Dahili ${u.extension}`;
        return {
          id: `user_${u.id}`,
          name: displayName,
          number: u.extension,
          subtitle: u.role === "admin" ? "Yönetici" : "Dahili Temsilci",
          type: "internal",
          call_state: cState,
          is_registered: !!u.is_registered,
          avatar:
            u.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
        };
      });

      const formattedContacts = (Array.isArray(contactsData) ? contactsData : []).map((c) => {
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone_number || "Kişi";
        return {
          id: `contact_${c.id}`,
          name: fullName,
          number: c.phone_number,
          subtitle: c.company || c.group || "Dış Rehber",
          type: "external",
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
        };
      });

      const formattedQueues = (Array.isArray(queuesData) ? queuesData : queuesData?.queues || []).map((q) => ({
        id: `queue_${q.id}`,
        name: q.name,
        number: q.extension,
        subtitle: "Çağrı Kuyruğu",
        type: "queue",
        icon: <Users size={19} className="text-purple-500" />
      }));

      const formattedWorkflows = (Array.isArray(workflowsData) ? workflowsData : workflowsData?.workflows || []).map(
        (w) => ({
          id: `wf_${w.id}`,
          name: w.name,
          number: w.id,
          subtitle: "Çağrı Akışı (IVR)",
          type: "workflow",
          icon: <GitBranch size={19} className="text-cyan-500" />
        })
      );

      setDirectory([...formattedUsers, ...formattedQueues, ...formattedContacts, ...formattedWorkflows]);
    } catch (error) {
      console.error("Rehber yüklenirken hata oluştu:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const myExt = String(wpState.webrtcConfig?.agentExtension || currentUser?.extension || "").trim();

  const resolveContactCallState = (contact) => {
    if (!contact || contact.type !== "internal") return null;
    const extStr = String(contact.number || "").trim();
    if (myExt && extStr === myExt) {
      const allLines = Array.isArray(wpState.lines) ? wpState.lines : [];
      if (wpState.callStatus === "Ringing" || allLines.some((l) => l.callStatus === "Ringing")) {
        return "ringing";
      }
      if (
        wpState.callStatus === "InCall" ||
        wpState.callStatus === "Calling" ||
        allLines.some((l) => l.callStatus === "InCall" || l.callStatus === "Calling")
      ) {
        return "busy";
      }
      if (contact.call_state === "ringing" || contact.call_state === "busy") {
        return contact.call_state;
      }
      if (wpState.registered || contact.is_registered || contact.call_state === "online") {
        return "online";
      }
      return "offline";
    }
    return contact.call_state || (contact.is_registered ? "online" : "offline");
  };

  // Smart priority rank when browsing or filtering
  const getPriorityRank = (item) => {
    if (favoriteIds.includes(item.id)) return 0;
    if (item.type === "internal") {
      const st = resolveContactCallState(item);
      if (st === "online") return 1;
      if (st === "busy" || st === "ringing") return 2;
      return 4;
    }
    if (item.type === "queue") return 3;
    if (item.type === "external") return 5;
    return 6;
  };

  const categoryCounts = useMemo(() => {
    let internalTotal = 0;
    let internalOnline = 0;
    let queueTotal = 0;
    let externalTotal = 0;
    let workflowTotal = 0;
    let favTotal = 0;

    directory.forEach((item) => {
      if (favoriteIds.includes(item.id)) favTotal += 1;
      if (item.type === "internal") {
        internalTotal += 1;
        const st = resolveContactCallState(item);
        if (st === "online") internalOnline += 1;
      } else if (item.type === "queue") {
        queueTotal += 1;
      } else if (item.type === "external") {
        externalTotal += 1;
      } else if (item.type === "workflow") {
        workflowTotal += 1;
      }
    });

    return {
      all: directory.length,
      favorites: favTotal,
      internal: internalTotal,
      internalOnline,
      queue: queueTotal,
      external: externalTotal,
      workflow: workflowTotal
    };
  }, [directory, favoriteIds, wpState.registered, wpState.callStatus, myExt]);

  const categoryTabs = useMemo(() => {
    const base = [
      { id: "all", label: "Öne Çıkanlar", count: categoryCounts.all },
      { id: "internal", label: "Dahililer", count: categoryCounts.internal, onlineCount: categoryCounts.internalOnline },
      { id: "queue", label: "Kuyruklar", count: categoryCounts.queue },
      { id: "external", label: "Dış Rehber", count: categoryCounts.external },
      { id: "favorites", label: "Favoriler", count: categoryCounts.favorites, isStar: true }
    ];
    if (categoryCounts.workflow > 0) {
      base.push({ id: "workflow", label: "Akışlar", count: categoryCounts.workflow });
    }
    return base;
  }, [categoryCounts]);

  const sortedAndFiltered = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");

    const baseList = directory.filter((item) => {
      // Category filter (when searching, search inside selected category unless "all")
      if (activeCategory === "favorites" && !favoriteIds.includes(item.id)) return false;
      if (
        activeCategory !== "all" &&
        activeCategory !== "favorites" &&
        item.type !== activeCategory
      ) {
        return false;
      }

      if (!q) return true;
      const nameStr = (item.name || "").toLocaleLowerCase("tr-TR");
      const numStr = String(item.number || "").toLocaleLowerCase("tr-TR");
      const subStr = (item.subtitle || "").toLocaleLowerCase("tr-TR");
      return nameStr.includes(q) || numStr.includes(q) || subStr.includes(q);
    });

    return [...baseList].sort((a, b) => {
      if (q) {
        const aStarts =
          (a.name || "").toLocaleLowerCase("tr-TR").startsWith(q) ||
          String(a.number || "").toLocaleLowerCase("tr-TR").startsWith(q);
        const bStarts =
          (b.name || "").toLocaleLowerCase("tr-TR").startsWith(q) ||
          String(b.number || "").toLocaleLowerCase("tr-TR").startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
      }
      const rankDiff = getPriorityRank(a) - getPriorityRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "tr");
    });
  }, [directory, searchQuery, activeCategory, favoriteIds, wpState.registered, wpState.callStatus, myExt]);

  const isSearching = searchQuery.trim().length > 0;
  const visibleDirectory = useMemo(() => {
    if (isSearching || showAllDefault) {
      return sortedAndFiltered;
    }
    return sortedAndFiltered.slice(0, DEFAULT_VISIBLE_LIMIT);
  }, [sortedAndFiltered, isSearching, showAllDefault]);

  const hiddenCount = Math.max(0, sortedAndFiltered.length - visibleDirectory.length);
  const isCallActive = wpState.callStatus && wpState.callStatus !== "Idle";

  const triggerCall = (contact) => {
    if (!contact?.number) return;
    if (searchQuery.trim().length >= 2) {
      recordRecentSearch(searchQuery.trim());
    }
    recordRecentContact(contact);
    window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: String(contact.number) }));
  };

  const handleDirectTransfer = async (contact) => {
    if (!contact?.number || !isCallActive) return;
    if (searchQuery.trim().length >= 2) {
      recordRecentSearch(searchQuery.trim());
    }
    recordRecentContact(contact);
    await webphoneManager.blindTransfer(contact.number, contact.name);
    setTransferToast(`Çağrı ${contact.name} (${contact.number}) hedefine transfer edildi.`);
    setTimeout(() => setTransferToast(null), 4000);
  };

  const handleCategoryKeyDown = (e, idx) => {
    const len = categoryTabs.length;
    if (!len) return;
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % len;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + len) % len;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = len - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = categoryTabs[nextIdx];
      setActiveCategory(targetTab.id);
      tabRefs.current[targetTab.id]?.focus();
    }
  };

  const getUserLedMeta = (callState) => {
    switch (callState) {
      case "ringing":
        return {
          dotClass: "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]",
          badgeClass:
            "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          label: "Çalıyor"
        };
      case "busy":
        return {
          dotClass: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
          badgeClass:
            "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
          label: "Meşgul"
        };
      case "online":
        return {
          dotClass: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
          badgeClass:
            "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          label: "Müsait"
        };
      default:
        return {
          dotClass: "bg-slate-400 dark:bg-slate-500",
          badgeClass:
            "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
          label: "Çevrimdışı"
        };
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "internal":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 uppercase tracking-wider">
            Dahili
          </span>
        );
      case "external":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 uppercase tracking-wider">
            Harici
          </span>
        );
      case "queue":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 uppercase tracking-wider">
            Kuyruk
          </span>
        );
      case "workflow":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/20 uppercase tracking-wider">
            Akış
          </span>
        );
      default:
        return null;
    }
  };

  const hasRecentActivity = recentContacts.length > 0 || recentSearches.length > 0;

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-5 md:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
              Şirket Rehberi
            </h2>
            {categoryCounts.internalOnline > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                <UserCheck size={12} />
                {categoryCounts.internalOnline} Temsilci Müsait
              </span>
            )}
            {isCallActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Aktif Çağrı (Tek Tıkla Transfer Açık)
              </span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              recordRecentSearch(searchQuery);
            }}
            className="relative w-full md:w-80"
          >
            <label htmlFor="agent-directory-search" className="sr-only">
              Kişi, departman, kuyruk veya numara ara
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={16}
            />
            <input
              ref={searchInputRef}
              id="agent-directory-search"
              type="search"
              placeholder="Kişi, kuyruk veya numara ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (searchQuery.trim().length >= 2) {
                  recordRecentSearch(searchQuery.trim());
                }
              }}
              className={`w-full pl-9 pr-8 py-2 rounded-xl border ${borderLight} bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 ${ring} shadow-sm transition-all text-slate-900 dark:text-white`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Aramayı temizle"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        {/* Recent Contacts & Recent Searches Strip (visible when search input is empty) */}
        {!isSearching && hasRecentActivity && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/75 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1">
                <Clock size={12} />
                Son İşlemler:
              </span>

              {recentContacts.map((rc) => (
                <button
                  key={`rc_${rc.id}`}
                  type="button"
                  onClick={() =>
                    isCallActive && canTransfer ? handleDirectTransfer(rc) : triggerCall(rc)
                  }
                  title={
                    isCallActive && canTransfer
                      ? `${rc.name} (${rc.number}) hedefine transfer et`
                      : `${rc.name} (${rc.number}) numarasını ara`
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${lightBg} ${text} ${borderLight} hover:opacity-90`}
                >
                  {isCallActive && canTransfer ? <PhoneForwarded size={11} /> : <Phone size={11} />}
                  <span className="truncate max-w-[130px]">{rc.name}</span>
                  <span className="font-mono text-[10px] opacity-75">({rc.number})</span>
                </button>
              ))}

              {recentSearches.map((term) => (
                <span
                  key={`rs_${term}`}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70"
                >
                  <button
                    type="button"
                    onClick={() => setSearchQuery(term)}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <Search size={11} className="text-slate-400" />
                    <span className="truncate max-w-[110px]">{term}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecentSearch(term)}
                    aria-label={`${term} son aramasını sil`}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={clearRecentHistory}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition cursor-pointer shrink-0"
            >
              Geçmişi Temizle
            </button>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Rehber Kategorileri"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
        >
          {categoryTabs.map((tab, idx) => {
            const isSelected = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`dir-tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls="dir-tabpanel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveCategory(tab.id)}
                onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                  isSelected
                    ? `${bg} text-white border-transparent shadow-sm`
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.isStar && (
                  <Star
                    size={12}
                    className={isSelected ? "fill-white text-white" : "text-amber-500 fill-amber-400"}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab.onlineCount !== undefined && tab.count > 0
                    ? `${tab.onlineCount}/${tab.count}`
                    : tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {transferToast && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{transferToast}</span>
          </div>
        )}

        {/* Directory List Card */}
        <div
          id="dir-tabpanel"
          role="tabpanel"
          aria-labelledby={`dir-tab-${activeCategory}`}
          className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}
        >
          {/* Context Banner inside Card Header */}
          {!loading && sortedAndFiltered.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {isSearching ? (
                  <>
                    <strong className="text-slate-700 dark:text-slate-200">
                      "{searchQuery.trim()}"
                    </strong>{" "}
                    için {sortedAndFiltered.length} sonuç bulundu
                  </>
                ) : activeCategory === "favorites" ? (
                  <>Favorilere eklediğiniz {sortedAndFiltered.length} kayıt listeleniyor</>
                ) : (
                  <>
                    Öncelikli{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      ilk {visibleDirectory.length}
                    </strong>{" "}
                    kayıt gösteriliyor{" "}
                    <span className="hidden sm:inline">
                      (Favoriler, müsait dahililer ve kuyruklar üstte)
                    </span>
                  </>
                )}
              </span>

              {!isSearching && directory.length > DEFAULT_VISIBLE_LIMIT && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Toplam {sortedAndFiltered.length} kayıt
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center p-16">
              <div className={`w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3`} />
              <p className="text-slate-500 text-sm font-medium">Rehber yükleniyor...</p>
            </div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                {activeCategory === "favorites" && !isSearching ? (
                  <Star size={24} className="text-amber-400" />
                ) : (
                  <LayoutGrid size={24} className="text-slate-400" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {activeCategory === "favorites" && !isSearching
                  ? "Henüz Favori Kişi Eklenmedi"
                  : isSearching
                  ? "Eşleşen Kayıt Bulunamadı"
                  : "Rehberde Kayıt Yok"}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto text-xs leading-relaxed">
                {activeCategory === "favorites" && !isSearching
                  ? "Sık aradığınız veya çağrı aktardığınız kişilerin yanındaki yıldız ikonuna tıklayarak bu alana sabitleyebilirsiniz."
                  : isSearching
                  ? `"${searchQuery}" aramasıyla eşleşen bir kişi, dahili, kuyruk veya akış bulunamadı.`
                  : "Henüz tanımlı dahili temsilci, kuyruk veya dış rehber kaydı bulunmuyor."}
              </p>
              {(isSearching || activeCategory !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className={`mt-4 px-3.5 py-1.5 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight} cursor-pointer`}
                >
                  Tüm Rehberi Göster
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {visibleDirectory.map((contact, idx) => {
                  const resolvedCallState = resolveContactCallState(contact);
                  const ledMeta = contact.type === "internal" ? getUserLedMeta(resolvedCallState) : null;
                  const isFav = favoriteIds.includes(contact.id);

                  return (
                    <div
                      key={contact.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(contact.id)}
                          aria-pressed={isFav}
                          aria-label={
                            isFav
                              ? `${contact.name} kaydını favorilerden çıkar`
                              : `${contact.name} kaydını favorilere ekle`
                          }
                          title={isFav ? "Favorilerden Çıkar" : "Favorilere Sabitle"}
                          className={`p-1 rounded-lg transition cursor-pointer shrink-0 ${
                            isFav
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-slate-300 dark:text-slate-600 hover:text-amber-400"
                          }`}
                        >
                          <Star size={16} className={isFav ? "fill-amber-400" : ""} />
                        </button>

                        <div className="relative shrink-0">
                          {contact.avatar ? (
                            <img
                              src={contact.avatar}
                              alt=""
                              width={40}
                              height={40}
                              loading={idx >= 8 ? "lazy" : undefined}
                              decoding="async"
                              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm flex items-center justify-center">
                              {contact.icon || <Building2 size={18} className="text-slate-400" />}
                            </div>
                          )}
                          {ledMeta && (
                            <span
                              title={ledMeta.label}
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${ledMeta.dotClass}`}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm text-slate-800 dark:text-white leading-tight truncate">
                              {contact.name}
                            </h3>
                            {ledMeta && (
                              <span
                                title={`Durum: ${ledMeta.label}`}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${ledMeta.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${ledMeta.dotClass}`} />
                                {ledMeta.label}
                              </span>
                            )}
                            {getTypeBadge(contact.type)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {contact.number}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:inline-block">
                              • {contact.subtitle}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCallActive && canTransfer && (
                          <button
                            type="button"
                            onClick={() => handleDirectTransfer(contact)}
                            aria-label={`${contact.name} (${contact.number}) numarasına çağrıyı transfer et`}
                            className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold ${lightBg} ${text} hover:opacity-90 transition-all shadow-sm border ${borderLight} cursor-pointer`}
                            title={`Aktif çağrıyı doğrudan ${contact.name} (${contact.number}) hedefine transfer et`}
                          >
                            <PhoneForwarded size={15} />
                            <span className="hidden sm:inline">Transfer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerCall(contact)}
                          aria-label={`${contact.name} (${contact.number}) numarasını ara`}
                          className="h-9 w-9 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-950/40 dark:hover:bg-emerald-500 dark:text-emerald-400 dark:hover:text-white transition-all shadow-sm cursor-pointer"
                          title={`${contact.name} (${contact.number}) Ara`}
                        >
                          <Phone
                            size={16}
                            className={
                              contact.type === "internal" || contact.type === "external"
                                ? ""
                                : "fill-current"
                            }
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer: Expand Remaining or Collapse */}
              {!isSearching && sortedAndFiltered.length > DEFAULT_VISIBLE_LIMIT && (
                <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800/70 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {hiddenCount > 0
                      ? `Diğer ${hiddenCount} kaydı bulmak için yukarıdan arama yapabilir veya listeyi genişletebilirsiniz.`
                      : `Tüm ${sortedAndFiltered.length} kayıt listeleniyor.`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllDefault((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 transition cursor-pointer shrink-0`}
                  >
                    <span>
                      {hiddenCount > 0
                        ? `Tümünü Göster (+${hiddenCount})`
                        : `İlk ${DEFAULT_VISIBLE_LIMIT} Kayda Daralt`}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${hiddenCount === 0 ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
