import React, { useState, useEffect } from "react";
import { LogIn, LogOut, Coffee, ShieldAlert, UserCheck, Play, ChevronDown, ChevronUp, User } from "lucide-react";

export default function AgentSessionCard({ backendHost = "localhost:8000" }) {
  const [agentState, setAgentState] = useState({
    is_logged_in: false,
    status: "offline",
    current_break: null,
    user_id: null
  });

  const [breaks, setBreaks] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchAgentStatus();
    fetchUsersAndRolesAndBreaks();
  }, []);

  const fetchAgentStatus = () => {
    fetch(`${API_BASE}/api/agent/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setAgentState(data);
        }
      })
      .catch((err) => console.error("Temsilci durumu alınamadı:", err));
  };

  const fetchUsersAndRolesAndBreaks = async () => {
    try {
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers) setUsers(dataUsers);

      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const dataRoles = await resRoles.json();
      if (dataRoles) setRoles(dataRoles);

      const resBreaks = await fetch(`${API_BASE}/api/settings/breaks`);
      const dataBreaks = await resBreaks.json();
      if (dataBreaks) setBreaks(dataBreaks);
    } catch (err) {
      console.error("Agent verileri yüklenemedi:", err);
    }
  };

  const updateStateOnBackend = async (newState) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/agent/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newState)
      });
      if (res.ok) {
        const data = await res.json();
        setAgentState(data.agent_state);
      }
    } catch (err) {
      console.error("Temsilci durumu güncellenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!selectedUser) return;
    const newState = {
      is_logged_in: true,
      status: "online",
      current_break: null,
      user_id: selectedUser.id
    };
    updateStateOnBackend(newState);
  };

  const handleLogout = () => {
    const newState = {
      is_logged_in: false,
      status: "offline",
      current_break: null,
      user_id: null
    };
    updateStateOnBackend(newState);
    setSelectedUser(null);
    setShowDropdown(false);
  };

  const handleSelectBreak = (breakItem) => {
    const newState = {
      is_logged_in: true,
      status: "break",
      current_break: breakItem,
      user_id: agentState.user_id
    };
    updateStateOnBackend(newState);
    setShowDropdown(false);
  };

  const handleEndBreak = () => {
    const newState = {
      is_logged_in: true,
      status: "online",
      current_break: null,
      user_id: agentState.user_id
    };
    updateStateOnBackend(newState);
  };

  // Find currently logged in user profile
  const loggedInUser = users.find(u => u.id === agentState.user_id);
  const loggedInUserRoleObj = loggedInUser ? roles.find(r => r.role_code === loggedInUser.role) : null;

  // Filter breaks allowed for this user's role
  const allowedBreakIds = loggedInUserRoleObj ? loggedInUserRoleObj.allowed_breaks || [] : [];
  const filteredBreaks = breaks.filter(b => allowedBreakIds.includes(b.id));

  // Status style helper
  const getStatusDisplay = () => {
    if (!agentState.is_logged_in) {
      return {
        text: "Çevrimdışı (Giriş Yapılmadı)",
        badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50",
        indicatorClass: "bg-slate-400"
      };
    }
    if (agentState.status === "online") {
      return {
        text: "Müsait (Çağrı Alabilir)",
        badgeClass: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30",
        indicatorClass: "bg-emerald-500 animate-pulse"
      };
    }
    if (agentState.status === "break" && agentState.current_break) {
      return {
        text: `Molada (${agentState.current_break.name})`,
        badgeClass: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
        indicatorClass: "bg-amber-500 animate-pulse",
        customColor: agentState.current_break.color
      };
    }
    return {
      text: "Bilinmeyen Durum",
      badgeClass: "bg-slate-100 text-slate-600",
      indicatorClass: "bg-slate-400"
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-all duration-300">
      <div className="pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Temsilci Oturumu
          </h4>
          
          {/* Status Indicator Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${statusDisplay.badgeClass}`}>
            <span 
              className={`h-1.5 w-1.5 rounded-full ${statusDisplay.customColor ? "" : statusDisplay.indicatorClass}`} 
              style={statusDisplay.customColor ? { backgroundColor: statusDisplay.customColor } : {}}
            />
            {statusDisplay.text}
          </span>
        </div>

        {/* Logged In User Profile Summary */}
        {agentState.is_logged_in && loggedInUser && (
          <div className="flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/60 rounded-xl mt-1">
            <img src={loggedInUser.avatar} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/20" alt="" />
            <div>
              <p className="text-[10px] font-bold text-slate-800 dark:text-white leading-tight">{loggedInUser.full_name}</p>
              <p className="text-[8px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                Dahili: {loggedInUser.extension} • {loggedInUserRoleObj ? loggedInUserRoleObj.name : loggedInUser.role}
              </p>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-slate-500">Güncelleniyor...</div>
      ) : (
        <div className="space-y-3 relative">
          
          {/* OFFLINE: User select and Login Button */}
          {!agentState.is_logged_in && (
            <div className="space-y-2.5">
              <div className="relative">
                <select
                  value={selectedUser ? selectedUser.id : ""}
                  onChange={(e) => {
                    const u = users.find(usr => usr.id === Number(e.target.value));
                    setSelectedUser(u);
                  }}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-semibold"
                >
                  <option value="">Giriş Yapacak Temsilciyi Seçin...</option>
                  {users.filter(u => u.is_active).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.extension})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleLogin}
                disabled={!selectedUser}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/10"
              >
                <LogIn size={15} />
                <span>Sistem Girişi Yap</span>
              </button>
            </div>
          )}

          {/* ONLINE/BREAK: Interactive Buttons */}
          {agentState.is_logged_in && (
            <div className="space-y-2">
              
              {agentState.status === "break" ? (
                /* IN BREAK: End Break Button */
                <button
                  onClick={handleEndBreak}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/10"
                >
                  <Play size={15} />
                  <span>Molayı Bitir (Çağrı Almaya Başla)</span>
                </button>
              ) : (
                /* ONLINE: Break Options Toggle */
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Coffee size={15} />
                    <span>Mola Durumları</span>
                  </div>
                  {showDropdown ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              )}

              {/* Mola Toggle Helper for break state */}
              {agentState.status === "break" && (
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 transition-all"
                >
                  <span>Mola Değiştir / Oturumu Kapat</span>
                  {showDropdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}

              {/* Dropdown Options List */}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 p-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl space-y-1 max-h-56 overflow-y-auto">
                  
                  {/* LOGOUT (Top Option) */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all text-left border border-transparent"
                  >
                    <LogOut size={14} />
                    <span>Oturumu Kapat (Logout)</span>
                  </button>

                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800/60 my-1.5" />

                  {/* BREAK TYPES LIST */}
                  {filteredBreaks.length === 0 ? (
                    <div className="text-[10px] text-slate-450 text-center py-3 italic">
                      Bu role izin verilen mola bulunmamaktadır.
                    </div>
                  ) : (
                    filteredBreaks.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelectBreak(b)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-all text-left border border-transparent"
                      >
                        <span 
                          className="h-2.5 w-2.5 rounded-full border border-slate-200/20" 
                          style={{ backgroundColor: b.color }} 
                        />
                        <span>{b.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}
