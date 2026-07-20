import re

with open("frontend/components/dashboard/ReportsPanel.js", "r") as f:
    content = f.read()

# 1. Add users state and fetch logic
users_state_code = """  const [calls, setCalls] = useState([]);
  const [users, setUsers] = useState([]);"""
content = content.replace("  const [calls, setCalls] = useState([]);", users_state_code)

fetch_logic_old = """  useEffect(() => {
    if (autoRefresh) {"""
fetch_logic_new = """  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const protocol = window.location.protocol;
        const res = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {}
    };
    fetchUsers();
    if (autoRefresh) {"""
content = content.replace(fetch_logic_old, fetch_logic_new)

# 2. Modify getConversant to use the users list
old_conversant = """  const getConversant = (call) => {
    if (!call) return "";
    const safeId = String(call.id || "");
    if (call.status === "transferred") {
      return "Temsilci";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Giden (Temsilci)") {
      return call.caller_number; // Agent extension
    } else if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Temsilci";
  };"""

new_conversant = """  const getConversant = (call) => {
    if (!call) return "";
    const safeId = String(call.id || "");
    if (call.status === "transferred") {
      return "Temsilci";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Giden (Temsilci)") {
      const ext = call.caller_number;
      const user = users.find(u => u.extension === ext || u.username === ext || u.id.toString() === ext);
      return user ? user.full_name || user.username : ext;
    } else if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Temsilci";
  };"""
content = content.replace(old_conversant, new_conversant)

# 3. Modify getCallDurations to clear IVR/Queue for Outbound
old_durations = """    // Deterministic split based on call.id hash for mock effect on successful calls
    const safeId = String(call.id || "");
    let ivrSeconds = safeId.length > 0 ? (safeId.charCodeAt(0) % 20) + 10 : 15; // 10 to 29 seconds
    let queueSeconds = safeId.length > 1 ? ((safeId.charCodeAt(1) % 2 === 0) ? 0 : (safeId.charCodeAt(1) % 35) + 5) : 0; // 0 or 5 to 39 seconds"""

new_durations = """    // Deterministic split based on call.id hash for mock effect on successful calls
    const safeId = String(call.id || "");
    const direction = getCallDirection(call);
    
    let ivrSeconds = safeId.length > 0 ? (safeId.charCodeAt(0) % 20) + 10 : 15; // 10 to 29 seconds
    let queueSeconds = safeId.length > 1 ? ((safeId.charCodeAt(1) % 2 === 0) ? 0 : (safeId.charCodeAt(1) % 35) + 5) : 0; // 0 or 5 to 39 seconds
    
    // Outbound calls don't have IVR or Queue
    if (direction.includes("Giden")) {
      ivrSeconds = 0;
      queueSeconds = 0;
    }"""
content = content.replace(old_durations, new_durations)

with open("frontend/components/dashboard/ReportsPanel.js", "w") as f:
    f.write(content)

print("Patch applied.")
