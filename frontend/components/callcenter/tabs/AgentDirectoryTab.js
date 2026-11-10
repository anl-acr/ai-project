import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Users,
  Search,
  Phone,
  PhoneForwarded,
  GitBranch,
  CheckCircle2,
  Star,
  Clock,
  X,
  Building2
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { getApiBaseUrl } from "../../../utils/apiHost";
import { webphoneManager } from "../../../utils/webphoneManager";

const MAX_RECENT_ITEMS = 10;

export default function AgentDirectoryTab({ backendHost, currentUser, callPanelPerms }) {
  const { bg, text, ring, lightBg, borderLight } = useTheme();
  const canTransfer = callPanelPerms?.canTransfer !== false;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent"); // "recent" | "favorites"
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wpState, setWpState] = useState(webphoneManager.state);
  const [transferToast, setTransferToast] = useState(null);

  const [favoriteIds, setFavoriteIds] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);

  const tabRefs = useRef({});
  const searchInputRef = useRef(null);
  const didRecordCurrentQueryRef = useRef(false);

  const storageScopeKey = useMemo(() => {
    const uid = currentUser?.id || currentUser?.extension || "default";
    return String(uid);
  }, [currentUser?.id, currentUser?.extension]);

  // Load persisted favorites and last 10 searched contacts per agent
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedFavs = JSON.parse(localStorage.getItem(`agent_dir_favs_${storageScopeKey}`) || "[]");
      const savedRecents = JSON.parse(localStorage.getItem(`agent_dir_recents_${storageScopeKey}`) || "[]");
      if (Array.isArray(savedFavs)) setFavoriteIds(savedFavs);
      if (Array.isArray(savedRecents)) {
        const validRecents = savedRecents
          .filter((item) => item && item.id && item.number !== undefined)
          .slice(0, MAX_RECENT_ITEMS);
        setRecentContacts(validRecents);
      }
    } catch (e) {}
  }, [storageScopeKey]);

  const recordRecentContact = useCallback(
    (contact) => {
      if (!contact?.id) return;
      const snapshot = {
        id: contact.id,
        name: contact.name || "",
        number: contact.number ?? "",
        subtitle: contact.subtitle || "",
        type: contact.type || "internal",
        avatar: contact.avatar || null
      };
      setRecentContacts((prev) => {
        const next = [snapshot, ...prev.filter((item) => item.id !== snapshot.id)].slice(
          0,
          MAX_RECENT_ITEMS
        );
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`agent_dir_recents_${storageScopeKey}`, JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
    },
    [storageScopeKey]
  );

  const removeRecentContact = (contactId) => {
    setRecentContacts((prev) => {
      const next = prev.filter((item) => item.id !== contactId);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_recents_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const clearRecentHistory = () => {
    setRecentContacts([]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`agent_dir_recents_${storageScopeKey}`);
      } catch (e) {}
    }
  };

  const toggleFavorite = (contact) => {
    if (!contact?.id) return;
    if (searchQuery.trim().length >= 1) {
      recordRecentContact(contact);
      didRecordCurrentQueryRef.current = true;
    }
    setFavoriteIds((prev) => {
      const exists = prev.includes(contact.id);
      const next = exists ? prev.filter((id) => id !== contact.id) : [contact.id, ...prev];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`agent_dir_favs_${storageScopeKey}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
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
          is_registered: !!u.is_registered,
          omnichannel_busy: !!u.omnichannel_busy,
          omnichannel_label: u.omnichannel_label || null
        };
      });

      setDirectory((prev) =>
        prev.map((item) => {
          if (item.type === "internal" && stateMap[item.id]) {
            return {
              ...item,
              call_state: stateMap[item.id].call_state,
              is_registered: stateMap[item.id].is_registered,
              omnichannel_busy: stateMap[item.id].omnichannel_busy,
              omnichannel_label: stateMap[item.id].omnichannel_label
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
          omnichannel_busy: !!u.omnichannel_busy,
          omnichannel_label: u.omnichannel_label || null,
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

  const directoryById = useMemo(() => {
    const map = new Map();
    directory.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [directory]);

  // Live-hydrated recent searched contacts (up to 10, preserving chronological order)
  const resolvedRecentList = useMemo(() => {
    return recentContacts
      .map((saved) => {
        const live = directoryById.get(saved.id);
        if (live) return live;
        // Fallback icon if directory hasn't finished loading yet
        return {
          ...saved,
          icon:
            saved.type === "queue" ? (
              <Users size={19} className="text-purple-500" />
            ) : saved.type === "workflow" ? (
              <GitBranch size={19} className="text-cyan-500" />
            ) : null
        };
      })
      .slice(0, MAX_RECENT_ITEMS);
  }, [recentContacts, directoryById]);

  // Live-hydrated favorites list
  const resolvedFavoritesList = useMemo(() => {
    return directory
      .filter((item) => favoriteIds.includes(item.id))
      .sort((a, b) => {
        const rankDiff = getPriorityRank(a) - getPriorityRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.name || "").localeCompare(b.name || "", "tr");
      });
  }, [directory, favoriteIds, wpState.registered, wpState.callStatus, myExt]);

  // Search results across entire directory when searchQuery is non-empty
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!q) return [];

    const matched = directory.filter((item) => {
      const nameStr = (item.name || "").toLocaleLowerCase("tr-TR");
      const numStr = String(item.number || "").toLocaleLowerCase("tr-TR");
      const subStr = (item.subtitle || "").toLocaleLowerCase("tr-TR");
      return nameStr.includes(q) || numStr.includes(q) || subStr.includes(q);
    });

    return [...matched].sort((a, b) => {
      const aExact =
        (a.name || "").toLocaleLowerCase("tr-TR") === q ||
        String(a.number || "").toLocaleLowerCase("tr-TR") === q;
      const bExact =
        (b.name || "").toLocaleLowerCase("tr-TR") === q ||
        String(b.number || "").toLocaleLowerCase("tr-TR") === q;
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aStarts =
        (a.name || "").toLocaleLowerCase("tr-TR").startsWith(q) ||
        String(a.number || "").toLocaleLowerCase("tr-TR").startsWith(q);
      const bStarts =
        (b.name || "").toLocaleLowerCase("tr-TR").startsWith(q) ||
        String(b.number || "").toLocaleLowerCase("tr-TR").startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      const rankDiff = getPriorityRank(a) - getPriorityRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "tr");
    });
  }, [directory, searchQuery, favoriteIds, wpState.registered, wpState.callStatus, myExt]);

  const isSearching = searchQuery.trim().length > 0;

  const commitTopSearchMatchIfNeeded = useCallback(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || didRecordCurrentQueryRef.current) return;
    if (searchResults.length > 0) {
      recordRecentContact(searchResults[0]);
      didRecordCurrentQueryRef.current = true;
    }
  }, [searchQuery, searchResults, recordRecentContact]);

  const latestCommitRef = useRef(commitTopSearchMatchIfNeeded);
  useEffect(() => {
    latestCommitRef.current = commitTopSearchMatchIfNeeded;
  }, [commitTopSearchMatchIfNeeded]);

  useEffect(() => {
    return () => {
      latestCommitRef.current?.();
    };
  }, []);

  const visibleList = isSearching
    ? searchResults
    : activeTab === "favorites"
    ? resolvedFavoritesList
    : resolvedRecentList;

  const viewTabs = useMemo(
    () => [
      { id: "recent", label: "Son Aramalar", count: resolvedRecentList.length, icon: "clock" },
      { id: "favorites", label: "Favoriler", count: resolvedFavoritesList.length, icon: "star" }
    ],
    [resolvedRecentList.length, resolvedFavoritesList.length]
  );

  const isCallActive = wpState.callStatus && wpState.callStatus !== "Idle";

  const triggerCall = (contact) => {
    if (!contact?.number) return;
    recordRecentContact(contact);
    didRecordCurrentQueryRef.current = true;
    window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: String(contact.number) }));
  };

  const handleDirectTransfer = async (contact) => {
    if (!contact?.number || !isCallActive) return;
    recordRecentContact(contact);
    didRecordCurrentQueryRef.current = true;
    await webphoneManager.blindTransfer(contact.number, contact.name);
    setTransferToast(`Çağrı ${contact.name} (${contact.number}) hedefine transfer edildi.`);
    setTimeout(() => setTransferToast(null), 4000);
  };

  const handleTabKeyDown = (e, idx) => {
    const len = viewTabs.length;
    if (!len) return;
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % len;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + len) % len;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = len - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = viewTabs[nextIdx];
      setActiveTab(targetTab.id);
      tabRefs.current[targetTab.id]?.focus();
    }
  };

  const getUserLedMeta = (callState, contactItem = null) => {
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
          label: contactItem?.omnichannel_busy
            ? `Meşgul (${contactItem.omnichannel_label || "Yazışmada"})`
            : "Meşgul"
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

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-5 md:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">
              Şirket Rehberi
            </h2>
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
              commitTopSearchMatchIfNeeded();
            }}
            className="relative w-full md:w-80"
          >
            <label htmlFor="agent-directory-search" className="sr-only">
              Kişi, departman, kuyruk veya numara ara
            </label>
            <button
              type="submit"
              aria-label="Rehberde ara"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <Search size={16} />
            </button>
            <input
              ref={searchInputRef}
              id="agent-directory-search"
              type="search"
              placeholder="Kişi, kuyruk veya numara ara..."
              value={searchQuery}
              onChange={(e) => {
                didRecordCurrentQueryRef.current = false;
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                  e.preventDefault();
                  commitTopSearchMatchIfNeeded();
                }
              }}
              onBlur={() => {
                commitTopSearchMatchIfNeeded();
              }}
              className={`w-full pl-9 pr-8 py-2 rounded-xl border ${borderLight} bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 ${ring} shadow-sm transition-all text-slate-900 dark:text-white`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  commitTopSearchMatchIfNeeded();
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

        {/* View Tabs: Son Aramalar (Max 10) & Favoriler */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label="Rehber Görünümleri"
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
          >
            {viewTabs.map((tab, idx) => {
              const isSelected = !isSearching && activeTab === tab.id;
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
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => {
                    if (isSearching) {
                      commitTopSearchMatchIfNeeded();
                      setSearchQuery("");
                    }
                    setActiveTab(tab.id);
                  }}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                    isSelected
                      ? `${bg} text-white border-transparent shadow-sm`
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.icon === "star" ? (
                    <Star
                      size={12}
                      className={isSelected ? "fill-white text-white" : "text-amber-500 fill-amber-400"}
                    />
                  ) : (
                    <Clock
                      size={12}
                      className={isSelected ? "text-white" : "text-slate-400 dark:text-slate-500"}
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
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {!isSearching && activeTab === "recent" && resolvedRecentList.length > 0 && (
            <button
              type="button"
              onClick={clearRecentHistory}
              className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition cursor-pointer shrink-0"
            >
              Geçmişi Temizle
            </button>
          )}
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
          aria-labelledby={`dir-tab-${activeTab}`}
          className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}
        >
          {/* Context Banner inside Card Header */}
          {!loading && visibleList.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {isSearching ? (
                  <>
                    <strong className="text-slate-700 dark:text-slate-200">
                      &quot;{searchQuery.trim()}&quot;
                    </strong>{" "}
                    için {visibleList.length} sonuç bulundu
                  </>
                ) : activeTab === "favorites" ? (
                  <>Favorilere eklediğiniz {visibleList.length} kayıt listeleniyor</>
                ) : (
                  <>
                    Rehberde aradığınız{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      son {visibleList.length}
                    </strong>{" "}
                    kayıt gösteriliyor
                  </>
                )}
              </span>

              {!isSearching && activeTab === "recent" && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  En fazla {MAX_RECENT_ITEMS} kayıt
                </span>
              )}
            </div>
          )}

          {loading && visibleList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3" />
              <p className="text-slate-500 text-sm font-medium">Rehber yükleniyor...</p>
            </div>
          ) : visibleList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                {isSearching ? (
                  <Search size={24} className="text-slate-400" />
                ) : activeTab === "favorites" ? (
                  <Star size={24} className="text-amber-400" />
                ) : (
                  <Clock size={24} className="text-slate-400" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isSearching
                  ? "Eşleşen Kayıt Bulunamadı"
                  : activeTab === "favorites"
                  ? "Henüz Favori Kişi Eklenmedi"
                  : "Henüz Son Arama Kaydı Yok"}
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto text-xs leading-relaxed">
                {isSearching
                  ? `"${searchQuery}" aramasıyla eşleşen bir kişi, dahili, kuyruk veya akış bulunamadı.`
                  : activeTab === "favorites"
                  ? "Sık aradığınız veya çağrı aktardığınız kişilerin yanındaki yıldız ikonuna tıklayarak bu alana sabitleyebilirsiniz."
                  : "Sağ üstteki arama kutusundan kişi, dahili, kuyruk veya numara aradığınızda son 10 aramanız hızlı erişim için bu ekranda listelenir."}
              </p>
              {isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className={`mt-4 px-3.5 py-1.5 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight} cursor-pointer`}
                >
                  Aramayı Temizle
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {visibleList.map((contact, idx) => {
                const resolvedCallState = resolveContactCallState(contact);
                const ledMeta = contact.type === "internal" ? getUserLedMeta(resolvedCallState, contact) : null;
                const isFav = favoriteIds.includes(contact.id);

                return (
                  <div
                    key={contact.id}
                    onClick={() => {
                      if (isSearching) {
                        recordRecentContact(contact);
                        didRecordCurrentQueryRef.current = true;
                      }
                    }}
                    className={`px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors group ${
                      isSearching ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(contact);
                        }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectTransfer(contact);
                          }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerCall(contact);
                        }}
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
                      {!isSearching && activeTab === "recent" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentContact(contact.id);
                          }}
                          aria-label={`${contact.name} kaydını son aramalardan kaldır`}
                          title="Son aramalardan kaldır"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-slate-100 dark:text-slate-600 dark:hover:text-rose-400 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
