active_agent_status = {}

agent_state = {
    "is_logged_in": False,
    "status": "offline",  # offline, online, break
    "current_break": None, # dict: {"id": 1, "name": "...", "color": "..."} or None
    "user_id": None
}

def get_agent_state(user_id=None):
    if user_id is not None:
        u_str = str(user_id)
        if u_str in active_agent_status:
            return active_agent_status[u_str]
        return {
            "is_logged_in": False,
            "status": "offline",
            "current_break": None,
            "user_id": user_id
        }
    return agent_state

def update_agent_state(is_logged_in: bool, status: str, current_break: dict = None, user_id=None):
    agent_state["is_logged_in"] = is_logged_in
    agent_state["status"] = status
    agent_state["current_break"] = current_break
    agent_state["user_id"] = user_id

    if user_id is not None:
        u_str = str(user_id)
        st_data = {
            "is_logged_in": is_logged_in,
            "status": status,
            "current_break": current_break,
            "user_id": user_id
        }
        active_agent_status[u_str] = st_data
        active_agent_status[user_id] = st_data
        return st_data

    return agent_state

def is_agent_available(user_id=None) -> bool:
    state = get_agent_state(user_id)
    return state.get("is_logged_in", False) and state.get("status") == "online"
