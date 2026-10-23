import datetime

active_agent_status = {}

agent_state = {
    "is_logged_in": False,
    "status": "offline",  # offline, online, break
    "current_break": None, # dict: {"id": 1, "name": "...", "color": "..."} or None
    "user_id": None,
    "extension": None,
    "status_since_utc": None
}

def get_agent_state(user_id=None, extension=None):
    for key in (user_id, extension):
        if key is not None and str(key).strip() != "":
            k_str = str(key).strip()
            if k_str in active_agent_status:
                return active_agent_status[k_str]
    if user_id is not None or extension is not None:
        return {
            "is_logged_in": False,
            "status": "offline",
            "current_break": None,
            "user_id": user_id,
            "extension": extension,
            "status_since_utc": None
        }
    return agent_state

def update_agent_state(is_logged_in: bool, status: str, current_break: dict = None, user_id=None, extension=None):
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    agent_state["is_logged_in"] = is_logged_in
    agent_state["status"] = status
    agent_state["current_break"] = current_break
    agent_state["user_id"] = user_id
    agent_state["extension"] = extension
    agent_state["status_since_utc"] = now_iso

    st_data = {
        "is_logged_in": is_logged_in,
        "status": status,
        "current_break": current_break,
        "user_id": user_id,
        "extension": extension,
        "status_since_utc": now_iso
    }

    for key in (user_id, extension):
        if key is not None and str(key).strip() != "":
            k_str = str(key).strip()
            active_agent_status[k_str] = st_data
            active_agent_status[key] = st_data

    return st_data

def is_agent_available(user_id=None, extension=None) -> bool:
    state = get_agent_state(user_id=user_id, extension=extension)
    return state.get("is_logged_in", False) and state.get("status") == "online"

