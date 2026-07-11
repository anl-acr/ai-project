agent_state = {
    "is_logged_in": False,
    "status": "offline",  # offline, online, break
    "current_break": None, # dict: {"id": 1, "name": "...", "color": "..."} or None
    "user_id": None
}

def get_agent_state():
    return agent_state

def update_agent_state(is_logged_in: bool, status: str, current_break: dict = None, user_id: int = None):
    agent_state["is_logged_in"] = is_logged_in
    agent_state["status"] = status
    agent_state["current_break"] = current_break
    agent_state["user_id"] = user_id
    return agent_state

def is_agent_available() -> bool:
    return agent_state["is_logged_in"] and agent_state["status"] == "online"
