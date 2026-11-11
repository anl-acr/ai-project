import datetime

active_agent_status = {}

agent_state = {
    "is_logged_in": False,
    "status": "offline",  # offline, online, break, acw
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

def update_agent_state(is_logged_in: bool, status: str, current_break: dict = None, user_id=None, extension=None, status_since_utc: str = None):
    now_iso = status_since_utc or (datetime.datetime.utcnow().isoformat() + "Z")
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
            if k_str.isdigit():
                active_agent_status[int(k_str)] = st_data

    return st_data

def is_agent_available(user_id=None, extension=None) -> bool:
    state = get_agent_state(user_id=user_id, extension=extension)
    if not (state.get("is_logged_in", False) and state.get("status") == "online"):
        return False
    omni = get_agent_omnichannel_busy_info(extension=extension, user_id=user_id)
    if omni.get("is_busy"):
        return False
    return True


# ============================================================================
# OMNICHANNEL CHANNEL BLENDING & ACTIVE CHAT BUSY ENGINE
# ============================================================================
import re as _re

# { extension_str: { session_id: {"session_id": str, "channel": str, "sender_info": str, "last_activity_utc": datetime, "direction": str, "agent_name": str} } }
active_omnichannel_engagements = {}
# Track which extensions are currently queue-paused specifically due to omnichannel chat
_omnichannel_paused_extensions = set()
# Round-robin / Least-recent & Fewest-calls tracking for Omnichannel ACD Queue distribution
_last_omnichannel_assigned_at = {}   # { ext_str: datetime }
_omnichannel_assigned_count = {}     # { ext_str: int }
# SLA First-Reply Watchdog: { session_id: {"extension": str, "assigned_user": str, "queue_ext": str, "queue_name": str, "assigned_at_utc": datetime, "channel": str, "sender_info": str} }
_pending_first_reply_sla = {}
# Waiting Pool when all queue members are busy: { session_id: {"session_id": str, "queue_ext": str, "queue_name": str, "channel": str, "sender_info": str, "enqueued_at_utc": datetime} }
_waiting_omnichannel_queue = {}

CHANNEL_BUSY_LABELS_TR = {
    "whatsapp": "WhatsApp Yazışmasında",
    "email": "E-Posta Yanıtlıyor",
    "mail": "E-Posta Yanıtlıyor",
    "instagram": "Instagram DM Yazışmasında",
    "facebook": "Facebook Messenger Yazışmasında",
    "telegram": "Telegram Yazışmasında",
}


def format_omnichannel_busy_label(channel: str) -> str:
    ch_l = str(channel or "whatsapp").strip().lower()
    return CHANNEL_BUSY_LABELS_TR.get(ch_l, f"{ch_l.capitalize()} Yazışmasında")


def _get_omnichannel_blending_config() -> tuple[int, int]:
    """Returns (max_concurrent_chats, idle_timeout_sec) from settings_db['channels']."""
    max_chats = 1
    idle_sec = 180  # 3 minutes default auto-release when customer stops replying
    try:
        from backend.main import settings_db
        ch_cfg = (settings_db.get("channels") or {}) if isinstance(settings_db, dict) else {}
        if ch_cfg.get("omnichannel_max_concurrent_chats") is not None:
            max_chats = max(1, int(ch_cfg.get("omnichannel_max_concurrent_chats") or 1))
        if ch_cfg.get("omnichannel_idle_timeout_sec") is not None:
            idle_sec = max(30, int(ch_cfg.get("omnichannel_idle_timeout_sec") or 180))
    except Exception:
        pass
    return max_chats, idle_sec


def resolve_agent_identity_for_omnichannel(identifier: str = "", user_id: str = "", extension: str = "") -> tuple[str, str, str]:
    """
    Resolves (extension, user_id, full_name) from any agent identifier such as:
    - '1000'
    - 'Anıl ACAR'
    - 'Anıl ACAR (1000)'
    - email or user_id
    """
    ext_in = str(extension or "").strip()
    uid_in = str(user_id or "").strip()
    ident_in = str(identifier or "").strip()

    # Check if identifier contains parenthesized extension e.g. "Anıl ACAR (1000)"
    if not ext_in and ident_in:
        m_paren = _re.search(r"\((\d{2,6})\)", ident_in)
        if m_paren:
            ext_in = m_paren.group(1)
        elif ident_in.isdigit() and len(ident_in) <= 6:
            ext_in = ident_in

    clean_ident_name = _re.sub(r"\s*\(\d{2,6}\)\s*", "", ident_in).strip().lower()

    try:
        from backend.main import settings_db, load_settings
        settings = settings_db if isinstance(settings_db, dict) and settings_db.get("users") else load_settings()
        for u in settings.get("users", []) or []:
            if not isinstance(u, dict):
                continue
            u_ext = str(u.get("extension") or "").strip()
            u_id = str(u.get("id") or "").strip()
            u_name = str(u.get("full_name") or u.get("name") or "").strip()
            u_email = str(u.get("email") or "").strip()
            u_uname = str(u.get("username") or "").strip()

            if ext_in and u_ext == ext_in:
                return (u_ext, u_id or u_ext, u_name or f"Dahili {u_ext}")
            if uid_in and (u_id == uid_in or u_ext == uid_in):
                return (u_ext, u_id or u_ext, u_name or f"Dahili {u_ext}")
            if clean_ident_name:
                if clean_ident_name in (
                    u_name.lower(),
                    u_email.lower(),
                    u_uname.lower(),
                    u_ext.lower(),
                    u_id.lower(),
                ):
                    return (u_ext, u_id or u_ext, u_name or ident_in)
    except Exception:
        pass

    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser
        with SyncSessionLocal() as session:
            for su in session.query(SystemUser).all():
                u_ext = str(getattr(su, "extension", "") or "").strip()
                u_id = str(getattr(su, "id", "") or "").strip()
                u_name = str(getattr(su, "full_name", "") or "").strip()
                u_email = str(getattr(su, "email", "") or "").strip()
                if ext_in and u_ext == ext_in:
                    return (u_ext, u_id or u_ext, u_name or f"Dahili {u_ext}")
                if uid_in and (u_id == uid_in or u_ext == uid_in):
                    return (u_ext, u_id or u_ext, u_name or f"Dahili {u_ext}")
                if clean_ident_name and clean_ident_name in (u_name.lower(), u_email.lower(), u_ext.lower(), u_id.lower()):
                    return (u_ext, u_id or u_ext, u_name or ident_in)
    except Exception:
        pass

    return (ext_in, uid_in or ext_in, ident_in or ext_in)


def get_agent_omnichannel_busy_info(extension: str = None, user_id: str = None, agent_name: str = None) -> dict:
    """
    Evaluates whether the agent is currently busy in an active Omnichannel session (WhatsApp, Email, Instagram, Telegram, etc.).
    Automatically prunes sessions that have been idle for longer than `idle_timeout_sec` (default 180s)
    so an abandoned customer chat never locks the agent out of voice calls forever.
    """
    max_chats, idle_timeout_sec = _get_omnichannel_blending_config()
    ext_s = str(extension or "").strip()
    if not ext_s and (user_id or agent_name):
        ext_s, _, _ = resolve_agent_identity_for_omnichannel(
            identifier=str(agent_name or ""),
            user_id=str(user_id or ""),
            extension="",
        )

    if not ext_s:
        return {
            "is_busy": False,
            "active_count": 0,
            "channel": None,
            "label": None,
            "sender_info": None,
            "sessions": [],
        }

    now_utc = datetime.datetime.utcnow()
    sess_map = active_omnichannel_engagements.get(ext_s)
    if not sess_map:
        return {
            "is_busy": False,
            "active_count": 0,
            "channel": None,
            "label": None,
            "sender_info": None,
            "sessions": [],
        }

    expired_sids = []
    valid_sessions = []
    for sid, s_info in list(sess_map.items()):
        last_dt = s_info.get("last_activity_utc") or now_utc
        direction = str(s_info.get("direction") or "outbound").lower()
        # Allow slightly longer window (300s) when customer just messaged and agent is reading/typing,
        # and `idle_timeout_sec` (180s) after agent replied and is waiting for customer
        eff_timeout = max(idle_timeout_sec, 300) if direction == "inbound" else idle_timeout_sec
        age_sec = (now_utc - last_dt).total_seconds()
        if age_sec > eff_timeout:
            expired_sids.append(sid)
        else:
            valid_sessions.append({
                "session_id": sid,
                "channel": s_info.get("channel") or "whatsapp",
                "sender_info": s_info.get("sender_info") or "",
                "direction": direction,
                "elapsed_seconds": max(0, int(age_sec)),
                "last_activity_utc": last_dt.isoformat() + "Z",
            })

    for sid in expired_sids:
        sess_map.pop(sid, None)

    if not sess_map:
        active_omnichannel_engagements.pop(ext_s, None)
        if ext_s in _omnichannel_paused_extensions:
            _omnichannel_paused_extensions.discard(ext_s)
            try:
                loop = asyncio.get_running_loop()
                st = get_agent_state(extension=ext_s)
                if not (st and st.get("status") in ("break", "acw")):
                    loop.create_task(sync_asterisk_queue_pause(ext_s, False, reason="OmnichannelIdleTimeout"))
            except Exception:
                pass
        return {
            "is_busy": False,
            "active_count": 0,
            "channel": None,
            "label": None,
            "sender_info": None,
            "sessions": [],
        }

    valid_sessions.sort(key=lambda x: x["last_activity_utc"], reverse=True)
    primary = valid_sessions[0]
    ch_name = str(primary.get("channel") or "whatsapp").lower()
    is_busy = len(valid_sessions) >= max_chats
    return {
        "is_busy": is_busy,
        "active_count": len(valid_sessions),
        "channel": ch_name,
        "label": format_omnichannel_busy_label(ch_name),
        "sender_info": primary.get("sender_info") or "",
        "sessions": valid_sessions,
    }


async def mark_agent_omnichannel_activity(
    agent_identifier: str = "",
    session_id: str = "",
    channel: str = "whatsapp",
    sender_info: str = "",
    direction: str = "outbound",
    user_id: str = "",
    extension: str = "",
) -> dict:
    """
    Marks an agent as actively engaged in an Omnichannel conversation (WhatsApp, Email, Instagram, Telegram, etc.),
    pauses their Asterisk Queue membership so no voice call interrupts them, and updates their live busy state.
    """
    sid_s = str(session_id or "").strip()
    if not sid_s:
        return {"is_busy": False}

    ext_s, uid_s, full_name = await asyncio.to_thread(
        resolve_agent_identity_for_omnichannel,
        str(agent_identifier or ""),
        str(user_id or ""),
        str(extension or ""),
    )
    if not ext_s:
        return {"is_busy": False}

    # Remove this session_id from any other agent if it was transferred/reassigned
    for other_ext, other_map in list(active_omnichannel_engagements.items()):
        if other_ext != ext_s and sid_s in other_map:
            other_map.pop(sid_s, None)
            if not other_map:
                active_omnichannel_engagements.pop(other_ext, None)
                if other_ext in _omnichannel_paused_extensions:
                    _omnichannel_paused_extensions.discard(other_ext)
                    st_other = get_agent_state(extension=other_ext)
                    if not (st_other and st_other.get("status") in ("break", "acw")):
                        await sync_asterisk_queue_pause(other_ext, False, reason="OmnichannelReassigned")

    now_utc = datetime.datetime.utcnow()
    ch_clean = str(channel or "whatsapp").strip().lower()
    dir_clean = str(direction or "outbound").strip().lower()
    # If representative replied or manually took over, clear the 2-minute first-reply SLA timer and waiting pool
    if dir_clean in ("outbound", "takeover"):
        _pending_first_reply_sla.pop(sid_s, None)
        _waiting_omnichannel_queue.pop(sid_s, None)

    ext_map = active_omnichannel_engagements.setdefault(ext_s, {})
    ext_map[sid_s] = {
        "session_id": sid_s,
        "channel": ch_clean,
        "sender_info": str(sender_info or "").strip(),
        "last_activity_utc": now_utc,
        "direction": dir_clean,
        "agent_name": full_name,
    }

    info = get_agent_omnichannel_busy_info(extension=ext_s)
    if info.get("is_busy"):
        _omnichannel_paused_extensions.add(ext_s)
        await sync_asterisk_queue_pause(ext_s, True, reason=f"Omnichannel:{ch_clean}")
    return info


async def release_agent_omnichannel_session(session_id: str, agent_identifier: str = "") -> None:
    """
    Immediately releases an Omnichannel session when the conversation is closed, resolved, deleted,
    or transferred back to AI, restoring the agent's voice availability if no other hot chat remains.
    """
    sid_s = str(session_id or "").strip()
    affected_exts = set()

    if sid_s:
        _pending_first_reply_sla.pop(sid_s, None)
        _waiting_omnichannel_queue.pop(sid_s, None)
        for ext_k, sess_map in list(active_omnichannel_engagements.items()):
            if sid_s in sess_map:
                sess_map.pop(sid_s, None)
                affected_exts.add(ext_k)
                if not sess_map:
                    active_omnichannel_engagements.pop(ext_k, None)

    if agent_identifier and not affected_exts:
        ext_s, _, _ = await asyncio.to_thread(
            resolve_agent_identity_for_omnichannel,
            str(agent_identifier or ""),
            "",
            "",
        )
        if ext_s:
            affected_exts.add(ext_s)

    freed_any = False
    for ext_k in affected_exts:
        info = get_agent_omnichannel_busy_info(extension=ext_k)
        if not info.get("is_busy"):
            freed_any = True
            _omnichannel_paused_extensions.discard(ext_k)
            st = get_agent_state(extension=ext_k)
            if not (st and st.get("status") in ("break", "acw")):
                await sync_asterisk_queue_pause(ext_k, False, reason="OmnichannelCompleted")

    if freed_any and _waiting_omnichannel_queue:
        try:
            asyncio.create_task(process_omnichannel_acd_queue_and_sla())
        except Exception:
            pass


def _load_queues_and_candidates_sync(
    channel: str = "whatsapp",
    target_queue: str = "",
    target_agent: str = "",
    matched_account: dict = None,
):
    """
    Synchronously loads existing PBXQueue definitions, users, and today's active break logs
    to resolve the target Call Queue and its candidate member extensions.
    """
    from backend.database.config import SyncSessionLocal
    from backend.database.models import PBXQueue, SystemUser, AgentBreakLog
    from backend.main import settings_db, load_settings

    settings = settings_db if isinstance(settings_db, dict) and settings_db.get("users") else load_settings()
    ch_cfg = (settings.get("channels") or {}) if isinstance(settings, dict) else {}
    all_groups = settings.get("subscriber_groups", []) or []

    db_users_list = []
    queues_list = []
    active_break_exts = set()

    now_utc = datetime.datetime.utcnow()
    today_start_utc = (now_utc + datetime.timedelta(hours=3)).replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(hours=3)

    try:
        with SyncSessionLocal() as session:
            for u in session.query(SystemUser).all():
                db_users_list.append({col.name: getattr(u, col.name) for col in SystemUser.__table__.columns})
            for q in session.query(PBXQueue).all():
                queues_list.append({col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns})
            open_brks = (
                session.query(AgentBreakLog)
                .filter(AgentBreakLog.start_time >= today_start_utc, AgentBreakLog.end_time.is_(None))
                .all()
            )
            for b in open_brks:
                b_nm = str(b.break_name or "")
                if not b_nm.startswith("__"):
                    if b.extension:
                        active_break_exts.add(str(b.extension).strip())
                    if b.user_id:
                        active_break_exts.add(str(b.user_id).strip())
    except Exception as e_sync:
        print(f"[Omnichannel ACD Sync Load Warning]: {e_sync}")

    if not queues_list:
        queues_list = list(settings.get("queues", []) or [])

    # Merge users by extension
    users_by_ext = {}
    for u_d in (settings.get("users", []) or []) + db_users_list:
        if not isinstance(u_d, dict):
            continue
        if u_d.get("is_active") is False:
            continue
        ext_v = str(u_d.get("extension") or "").strip()
        if not ext_v:
            continue
        if ext_v not in users_by_ext:
            users_by_ext[ext_v] = dict(u_d)
        else:
            for k, v in u_d.items():
                if v not in (None, "", []):
                    users_by_ext[ext_v][k] = v

    # Resolve target queue from existing Call Queues (PBXQueue)
    active_queues = [q for q in queues_list if isinstance(q, dict) and q.get("is_active", True) is not False]
    chosen_queue = None

    tq_candidates = []
    if target_queue and str(target_queue).strip():
        tq_candidates.append(str(target_queue).strip())
    if isinstance(matched_account, dict):
        acc_q = matched_account.get("target_queue") or matched_account.get("queue") or matched_account.get("default_queue")
        if acc_q and str(acc_q).strip():
            tq_candidates.append(str(acc_q).strip())
    ch_low = str(channel or "whatsapp").strip().lower()
    ch_q = ch_cfg.get(f"{ch_low}_target_queue") or ch_cfg.get("omnichannel_target_queue") or ch_cfg.get("default_omnichannel_queue")
    if ch_q and str(ch_q).strip():
        tq_candidates.append(str(ch_q).strip())

    for cand_q in tq_candidates:
        cq_l = cand_q.lower()
        # 1. Exact extension or name match
        for q in active_queues:
            q_ext = str(q.get("extension") or "").strip().lower()
            q_nm = str(q.get("name") or "").strip().lower()
            if cq_l in (q_ext, q_nm):
                chosen_queue = q
                break
        if chosen_queue:
            break
        # 2. Substring match (e.g. "satış" -> "Satış Kuyruğu")
        for q in active_queues:
            q_nm = str(q.get("name") or "").strip().lower()
            if cq_l and (cq_l in q_nm or q_nm in cq_l):
                chosen_queue = q
                break
        if chosen_queue:
            break

    if not chosen_queue and active_queues:
        chosen_queue = active_queues[0]

    queue_ext = str((chosen_queue or {}).get("extension") or "2000").strip()
    queue_name = str((chosen_queue or {}).get("name") or "Temsilci Kuyruğu").strip()
    queue_strategy = str((chosen_queue or {}).get("strategy") or "rrmemory").strip().lower()

    # Extract member extensions of chosen_queue
    member_exts = []
    if chosen_queue:
        raw_members = chosen_queue.get("queueMembers") if chosen_queue.get("queueMembers") is not None else chosen_queue.get("members")
        if isinstance(raw_members, str):
            try:
                raw_members = json.loads(raw_members)
            except Exception:
                raw_members = []
        if isinstance(raw_members, list):
            for m in raw_members:
                m_val = (m.get("extension") or m.get("user_id") or m.get("id")) if isinstance(m, dict) else m
                s_val = str(m_val or "").strip()
                if not s_val:
                    continue
                if s_val.startswith("group_"):
                    gid = s_val.replace("group_", "", 1)
                    grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                    if grp:
                        for gx in (grp.get("extensions") or grp.get("members") or []):
                            gx_s = str(gx or "").strip()
                            if gx_s and gx_s not in member_exts:
                                member_exts.append(gx_s)
                else:
                    # Map user_id to extension if needed
                    if s_val in users_by_ext:
                        if s_val not in member_exts:
                            member_exts.append(s_val)
                    else:
                        for u_ext_k, u_obj in users_by_ext.items():
                            if str(u_obj.get("id") or "").strip() == s_val:
                                if u_ext_k not in member_exts:
                                    member_exts.append(u_ext_k)
                                break

    if not member_exts:
        member_exts = list(users_by_ext.keys())

    return {
        "queue_ext": queue_ext,
        "queue_name": queue_name,
        "queue_strategy": queue_strategy,
        "member_exts": member_exts,
        "users_by_ext": users_by_ext,
        "active_break_exts": active_break_exts,
    }


def _select_best_available_agent_from_queue_data(
    q_data: dict,
    target_agent: str = "",
    exclude_extensions: set = None,
) -> dict:
    """
    Filters and ranks queue members to pick the best available agent:
    - Not on Break / ACW
    - Not in an active or ringing Voice Call
    - Not already Omnichannel Busy
    - Online (logged into queue OR SIP/WebPhone registered OR Web panel active)
    """
    from backend.services.ami_manager import registered_endpoints, get_extension_call_state
    from backend.main import get_live_user_call_state, _is_internal_chat_online

    users_by_ext = q_data.get("users_by_ext") or {}
    member_exts = q_data.get("member_exts") or []
    active_break_exts = q_data.get("active_break_exts") or set()
    strategy = q_data.get("queue_strategy") or "rrmemory"
    excl = {str(x).strip() for x in (exclude_extensions or set()) if x}

    def _is_ext_eligible(ext_s: str, require_online: bool = True) -> tuple[bool, int]:
        if not ext_s or ext_s in excl:
            return (False, 0)
        u_obj = users_by_ext.get(ext_s) or {}
        uid_s = str(u_obj.get("id") or "").strip()

        # 1. Check break / ACW state
        if ext_s in active_break_exts or (uid_s and uid_s in active_break_exts):
            return (False, 0)
        st = get_agent_state(user_id=uid_s, extension=ext_s)
        if st and st.get("status") in ("break", "acw"):
            return (False, 0)

        # 2. Check active profile (skip if DND / Offline / Out of office with 0 devices)
        act_prof_id = str(u_obj.get("active_profile") or "available").strip().lower()
        if act_prof_id in ("dnd", "offline", "out_of_office"):
            return (False, 0)

        # 3. Check voice call state (must not be talking or ringing on phone)
        if get_extension_call_state(ext_s) in ("busy", "ringing"):
            return (False, 0)
        is_sip_reg = bool(ext_s in registered_endpoints or (uid_s and uid_s in registered_endpoints))
        if get_live_user_call_state(ext_s, is_sip_reg) in ("busy", "ringing"):
            return (False, 0)

        # 4. Check Omnichannel busy capacity
        om_info = get_agent_omnichannel_busy_info(extension=ext_s, user_id=uid_s)
        if om_info.get("is_busy"):
            return (False, 0)

        # 5. Check Online / Logged-in presence
        is_q_logged_in = bool(st and st.get("is_logged_in") and st.get("status") == "online")
        is_web_on = bool(_is_internal_chat_online(uid_s, ext_s))
        if require_online and not (is_q_logged_in or is_sip_reg or is_web_on):
            return (False, 0)

        # Priority tier: 0 if explicitly queue-logged-in, 1 if SIP/Web online
        tier = 0 if is_q_logged_in else 1
        return (True, tier)

    # A) If customer/AI requested a specific target_agent by name or extension, check them first
    if target_agent and str(target_agent).strip():
        t_ext, t_uid, t_name = resolve_agent_identity_for_omnichannel(str(target_agent).strip())
        if t_ext:
            ok, _ = _is_ext_eligible(t_ext, require_online=False)
            if ok:
                u_obj = users_by_ext.get(t_ext) or {}
                f_name = str(u_obj.get("full_name") or u_obj.get("name") or t_name or f"Dahili {t_ext}").strip()
                return {
                    "extension": t_ext,
                    "user_id": str(u_obj.get("id") or t_uid or t_ext),
                    "full_name": f_name,
                    "assigned_label": f"{f_name} ({t_ext})",
                }

    # B) Filter eligible members in the target queue
    candidates = []
    for m_ext in member_exts:
        ok, tier = _is_ext_eligible(m_ext, require_online=True)
        if ok:
            u_obj = users_by_ext.get(m_ext) or {}
            f_name = str(u_obj.get("full_name") or u_obj.get("name") or f"Dahili {m_ext}").strip()
            om_cnt = int(get_agent_omnichannel_busy_info(extension=m_ext).get("active_count") or 0)
            last_dt = _last_omnichannel_assigned_at.get(m_ext, datetime.datetime.min)
            tot_cnt = _omnichannel_assigned_count.get(m_ext, 0)
            candidates.append({
                "extension": m_ext,
                "user_id": str(u_obj.get("id") or m_ext),
                "full_name": f_name,
                "assigned_label": f"{f_name} ({m_ext})",
                "tier": tier,
                "active_chats": om_cnt,
                "last_assigned": last_dt,
                "total_assigned": tot_cnt,
            })

    if not candidates:
        return None

    # Sort according to queue strategy:
    # Primary: tier (logged-in queue agents first), then active_chats ascending
    if strategy == "fewestcalls":
        candidates.sort(key=lambda c: (c["tier"], c["active_chats"], c["total_assigned"], c["last_assigned"]))
    else:
        # rrmemory / leastrecent / ringall -> longest idle (round-robin)
        candidates.sort(key=lambda c: (c["tier"], c["active_chats"], c["last_assigned"], c["total_assigned"]))

    return candidates[0]


async def auto_assign_chat_session_from_queue(
    session_id: str,
    channel: str = "whatsapp",
    sender_info: str = "",
    target_queue: str = "",
    target_agent: str = "",
    matched_account: dict = None,
    exclude_extensions: set = None,
    is_sla_reroute: bool = False,
    prev_agent_label: str = "",
) -> dict:
    """
    Automatically routes an Omnichannel chat session (WhatsApp, Email, Instagram, Telegram, etc.)
    through the existing Call Queues (`PBXQueue`):
    - If an eligible agent is available in the queue, assigns immediately, marks them Omnichannel Busy,
      pauses their Asterisk voice queue member, and starts the 2-minute first-reply SLA timer.
    - If all queue agents are currently busy (in voice calls, other chats, or on break), places the session
      into the Queue Waiting Pool so it is automatically assigned the second an agent becomes free.
    """
    from backend.database.config import AsyncSessionLocal
    from backend.database.models import ChatSession, ChatMessage
    from backend.services.websocket_manager import ws_manager

    sid_s = str(session_id or "").strip()
    if not sid_s:
        return {"status": "error", "assigned_user": None}

    q_data = await asyncio.to_thread(
        _load_queues_and_candidates_sync,
        channel,
        target_queue,
        target_agent,
        matched_account,
    )
    queue_ext = q_data["queue_ext"]
    queue_name = q_data["queue_name"]

    chosen = _select_best_available_agent_from_queue_data(
        q_data=q_data,
        target_agent=target_agent,
        exclude_extensions=exclude_extensions,
    )

    now_utc = datetime.datetime.utcnow()

    async with AsyncSessionLocal() as db_sess:
        chat = await db_sess.get(ChatSession, sid_s)
        if not chat or chat.status == "closed":
            _waiting_omnichannel_queue.pop(sid_s, None)
            _pending_first_reply_sla.pop(sid_s, None)
            return {"status": "closed", "assigned_user": None}

        ch_val = str(chat.channel or channel or "whatsapp").strip().lower()
        snd_val = str(chat.sender_info or sender_info or "").strip()

        if chosen:
            ext_s = chosen["extension"]
            uid_s = chosen["user_id"]
            assigned_label = chosen["assigned_label"]

            chat.assigned_agent = "human"
            chat.assigned_user = assigned_label
            chat.last_message_time = now_utc

            if is_sla_reroute and prev_agent_label:
                sys_text = (
                    f"⏱️ Yanıt süresi (2 dk) aşıldığı için görüşme '{queue_name}' kuyruğundaki "
                    f"sıradaki müsait temsilciye ({assigned_label}) otomatik devredildi."
                )
            else:
                sys_text = f"Görüşme '{queue_name}' kuyruğundan otomatik olarak {assigned_label} temsilcisine atandı."

            sys_msg = ChatMessage(
                session_id=sid_s,
                direction="outbound",
                sender="system",
                text=sys_text,
            )
            db_sess.add(sys_msg)
            await db_sess.commit()
            await db_sess.refresh(sys_msg)

            _last_omnichannel_assigned_at[ext_s] = now_utc
            _omnichannel_assigned_count[ext_s] = _omnichannel_assigned_count.get(ext_s, 0) + 1
            _waiting_omnichannel_queue.pop(sid_s, None)
            _pending_first_reply_sla[sid_s] = {
                "session_id": sid_s,
                "extension": ext_s,
                "assigned_user": assigned_label,
                "queue_ext": queue_ext,
                "queue_name": queue_name,
                "assigned_at_utc": now_utc,
                "channel": ch_val,
                "sender_info": snd_val,
            }

            await mark_agent_omnichannel_activity(
                agent_identifier=assigned_label,
                session_id=sid_s,
                channel=ch_val,
                sender_info=snd_val,
                direction="inbound",
                user_id=uid_s,
                extension=ext_s,
            )

            await ws_manager.broadcast_omnichannel_event({
                "type": "message",
                "message": {
                    "id": sys_msg.id,
                    "session_id": sid_s,
                    "direction": sys_msg.direction,
                    "sender": sys_msg.sender,
                    "text": sys_msg.text,
                    "timestamp": sys_msg.timestamp.isoformat() + "Z",
                },
            })
            await ws_manager.broadcast_omnichannel_event({
                "type": "takeover_changed",
                "session_id": sid_s,
                "assigned_agent": "human",
                "assigned_user": assigned_label,
            })
            await ws_manager.broadcast_omnichannel_event({
                "type": "session_update",
                "session": {
                    "id": sid_s,
                    "channel": chat.channel,
                    "sender_info": chat.sender_info,
                    "recipient_info": chat.recipient_info,
                    "status": chat.status,
                    "assigned_agent": "human",
                    "assigned_user": assigned_label,
                    "last_message_time": chat.last_message_time.isoformat() + "Z",
                    "last_message_text": sys_msg.text,
                    "last_message_direction": "outbound",
                    "last_message_sender": "system",
                },
            })
            print(f"🎯 [Omnichannel ACD] Session {sid_s} ({ch_val}) -> Queue '{queue_name}' -> Assigned to {assigned_label}")
            return {
                "status": "assigned",
                "assigned_user": assigned_label,
                "extension": ext_s,
                "queue_ext": queue_ext,
                "queue_name": queue_name,
            }

        # No available agent right now -> Place in Queue Waiting Pool
        already_waiting = sid_s in _waiting_omnichannel_queue
        waiting_label = f"⏳ Kuyrukta Bekliyor ({queue_name})"
        chat.assigned_agent = "human"
        if not chat.assigned_user or str(chat.assigned_user).startswith("⏳"):
            chat.assigned_user = waiting_label
        chat.last_message_time = now_utc

        if not already_waiting:
            _waiting_omnichannel_queue[sid_s] = {
                "session_id": sid_s,
                "queue_ext": queue_ext,
                "queue_name": queue_name,
                "channel": ch_val,
                "sender_info": snd_val,
                "enqueued_at_utc": now_utc,
            }
            wait_text = (
                f"⏳ '{queue_name}' kuyruğundaki tüm temsilcilerimiz şu an görüşmede olduğu için "
                f"yazışma sıraya alındı. İlk müsait temsilcimize otomatik olarak atanacaktır."
            )
            sys_msg = ChatMessage(
                session_id=sid_s,
                direction="outbound",
                sender="system",
                text=wait_text,
            )
            db_sess.add(sys_msg)
            await db_sess.commit()
            await db_sess.refresh(sys_msg)

            await ws_manager.broadcast_omnichannel_event({
                "type": "message",
                "message": {
                    "id": sys_msg.id,
                    "session_id": sid_s,
                    "direction": sys_msg.direction,
                    "sender": sys_msg.sender,
                    "text": sys_msg.text,
                    "timestamp": sys_msg.timestamp.isoformat() + "Z",
                },
            })
            await ws_manager.broadcast_omnichannel_event({
                "type": "takeover_changed",
                "session_id": sid_s,
                "assigned_agent": "human",
                "assigned_user": waiting_label,
            })
            await ws_manager.broadcast_omnichannel_event({
                "type": "session_update",
                "session": {
                    "id": sid_s,
                    "channel": chat.channel,
                    "sender_info": chat.sender_info,
                    "recipient_info": chat.recipient_info,
                    "status": chat.status,
                    "assigned_agent": "human",
                    "assigned_user": waiting_label,
                    "last_message_time": chat.last_message_time.isoformat() + "Z",
                    "last_message_text": sys_msg.text,
                    "last_message_direction": "outbound",
                    "last_message_sender": "system",
                },
            })
            print(f"⏳ [Omnichannel ACD] Session {sid_s} ({ch_val}) queued in '{queue_name}' (all agents currently busy).")
        else:
            await db_sess.commit()

        return {
            "status": "queued",
            "assigned_user": waiting_label,
            "queue_ext": queue_ext,
            "queue_name": queue_name,
        }


async def process_omnichannel_acd_queue_and_sla() -> None:
    """
    1. Dispatches any waiting sessions in `_waiting_omnichannel_queue` (or unassigned `human` sessions in DB)
       to newly available queue agents in FIFO order.
    2. Checks `_pending_first_reply_sla` for sessions where the assigned agent hasn't replied within 120 seconds (2 min)
       and re-routes them to the next available agent in the same Call Queue.
    """
    now_utc = datetime.datetime.utcnow()

    # 1. Also recover any active DB sessions with assigned_agent='human' and empty/waiting assigned_user
    try:
        from backend.database.config import AsyncSessionLocal
        from backend.database.models import ChatSession
        from sqlalchemy import select
        async with AsyncSessionLocal() as db_sess:
            stmt = select(ChatSession).where(
                ChatSession.status == "active",
                ChatSession.assigned_agent == "human",
            )
            res = await db_sess.execute(stmt)
            for cs in res.scalars().all():
                au = str(cs.assigned_user or "").strip()
                if (not au or au.startswith("⏳")) and cs.id not in _waiting_omnichannel_queue:
                    _waiting_omnichannel_queue[cs.id] = {
                        "session_id": cs.id,
                        "queue_ext": "",
                        "queue_name": "",
                        "channel": cs.channel or "whatsapp",
                        "sender_info": cs.sender_info or "",
                        "enqueued_at_utc": cs.last_message_time or now_utc,
                    }
    except Exception:
        pass

    # 2. Dispatch waiting queue in FIFO order
    waiting_items = sorted(
        list(_waiting_omnichannel_queue.values()),
        key=lambda x: x.get("enqueued_at_utc") or now_utc,
    )
    for w_item in waiting_items:
        sid = w_item.get("session_id")
        if not sid:
            continue
        try:
            await auto_assign_chat_session_from_queue(
                session_id=sid,
                channel=w_item.get("channel") or "whatsapp",
                sender_info=w_item.get("sender_info") or "",
                target_queue=w_item.get("queue_ext") or w_item.get("queue_name") or "",
            )
        except Exception as e_wq:
            print(f"[Omnichannel ACD Waiting Dispatch Warning]: {e_wq}")

    # 3. Check 2-Minute (120s) First-Reply SLA Timeout for assigned chats
    sla_timeout_sec = 120
    try:
        from backend.main import settings_db
        ch_cfg = (settings_db.get("channels") or {}) if isinstance(settings_db, dict) else {}
        if ch_cfg.get("omnichannel_sla_timeout_sec") is not None:
            sla_timeout_sec = max(30, int(ch_cfg.get("omnichannel_sla_timeout_sec") or 120))
    except Exception:
        pass

    for sid, sla_info in list(_pending_first_reply_sla.items()):
        asg_dt = sla_info.get("assigned_at_utc") or now_utc
        if (now_utc - asg_dt).total_seconds() < sla_timeout_sec:
            continue

        cur_ext = str(sla_info.get("extension") or "").strip()
        prev_label = str(sla_info.get("assigned_user") or cur_ext).strip()
        q_target = str(sla_info.get("queue_ext") or sla_info.get("queue_name") or "").strip()

        # Check if there is ANOTHER available agent in the queue before releasing
        q_data = await asyncio.to_thread(
            _load_queues_and_candidates_sync,
            sla_info.get("channel") or "whatsapp",
            q_target,
            "",
            None,
        )
        alt_agent = _select_best_available_agent_from_queue_data(
            q_data=q_data,
            target_agent="",
            exclude_extensions={cur_ext} if cur_ext else set(),
        )
        if alt_agent:
            await release_agent_omnichannel_session(sid, agent_identifier=prev_label)
            await auto_assign_chat_session_from_queue(
                session_id=sid,
                channel=sla_info.get("channel") or "whatsapp",
                sender_info=sla_info.get("sender_info") or "",
                target_queue=q_target,
                exclude_extensions={cur_ext} if cur_ext else set(),
                is_sla_reroute=True,
                prev_agent_label=prev_label,
            )
        else:
            # Reset timer so we check again in another 120s if another agent logs in
            sla_info["assigned_at_utc"] = now_utc


async def sweep_expired_omnichannel_engagements() -> None:
    """Periodic sweeper to unpause agents whose omnichannel chats became idle (> 3 min without reply)."""
    for ext_k in list(active_omnichannel_engagements.keys()):
        get_agent_omnichannel_busy_info(extension=ext_k)



# ============================================================================
# AUTO-PAUSE (OTOMATİK MOLA) ENGINE — RONA (Çağrı Kaçırma) & Bağlantı Kopması
# ============================================================================
import asyncio
import json

AUTO_BREAK_DEFAULT_COLOR = "#334155"  # Antrasit / Siyah
consecutive_missed_calls = {}  # { extension_str: int }
pending_disconnect_tasks = {}  # { extension_str: asyncio.Task }


def is_auto_break_name(break_name: str) -> bool:
    s = str(break_name or "").strip().lower()
    return s.startswith("otomatik mola") or "auto pause" in s or "autopause" in s


def reset_agent_missed_calls(extension: str):
    ext_s = str(extension or "").strip()
    if ext_s:
        consecutive_missed_calls[ext_s] = 0


async def sync_asterisk_queue_pause(extension: str, paused: bool, reason: str = "AutoPause"):
    """Pauses or unpauses Local/{extension}@queue_agent_ring/n and PJSIP/{extension} across Asterisk queues via AMI and CLI fallback."""
    ext_s = str(extension or "").strip()
    if not ext_s or not ext_s.isdigit():
        return
    interfaces = [
        f"Local/{ext_s}@queue_agent_ring/n",
        f"PJSIP/{ext_s}",
    ]
    pause_val = "true" if paused else "false"
    try:
        from backend.services.ami_manager import get_ami_manager
        manager = await get_ami_manager()
        if manager:
            for iface in interfaces:
                await manager.send_action({
                    "Action": "QueuePause",
                    "Interface": iface,
                    "Paused": pause_val,
                    "Reason": reason
                })
    except Exception as e_ami:
        print(f"[AutoPause AMI QueuePause Warning]: {e_ami}")

    try:
        import subprocess
        cmd_verb = "pause" if paused else "unpause"
        for iface in interfaces:
            await asyncio.to_thread(
                subprocess.run,
                ["asterisk", "-rx", f"queue {cmd_verb} member {iface}"],
                check=False,
                timeout=1.5
            )
    except Exception:
        pass


def _resolve_user_and_queues_sync(extension_or_uid: str):
    """Synchronously resolves user profile dict and list of queues the user is a member of."""
    from backend.database.config import SyncSessionLocal
    from backend.database.models import PBXQueue, SystemUser, AgentBreakLog
    from backend.main import settings_db, load_settings

    key_s = str(extension_or_uid or "").strip()
    if not key_s:
        return None, [], None

    settings = settings_db if isinstance(settings_db, dict) and settings_db.get("users") else load_settings()
    all_groups = settings.get("subscriber_groups", [])

    user_dict = {}
    queues_list = []
    active_break_row = None
    has_login_today = False
    is_logged_out = False

    now_utc = datetime.datetime.utcnow()
    today_start_utc = (now_utc + datetime.timedelta(hours=3)).replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(hours=3)

    try:
        with SyncSessionLocal() as session:
            db_users = session.query(SystemUser).all()
            for u in db_users:
                if str(u.extension or "").strip() == key_s or str(u.id) == key_s:
                    user_dict = {col.name: getattr(u, col.name) for col in SystemUser.__table__.columns}
                    break

            db_queues = session.query(PBXQueue).all()
            for q in db_queues:
                queues_list.append({col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns})

            u_id_val = str(user_dict.get("id") or key_s).strip()
            u_ext_val = str(user_dict.get("extension") or key_s).strip()

            today_logs = (
                session.query(AgentBreakLog)
                .filter(
                    AgentBreakLog.start_time >= today_start_utc,
                    (AgentBreakLog.extension == u_ext_val) | (AgentBreakLog.user_id == u_id_val) | (AgentBreakLog.user_id == u_ext_val)
                )
                .order_by(AgentBreakLog.start_time.desc(), AgentBreakLog.id.desc())
                .all()
            )
            if today_logs:
                has_login_today = True
                if str(today_logs[0].break_name or "") == "__LOGOUT__":
                    is_logged_out = True
                for b in today_logs:
                    if b.end_time is None and not str(b.break_name or "").startswith("__"):
                        active_break_row = {
                            "id": b.id,
                            "break_name": b.break_name,
                            "start_time": b.start_time
                        }
                        break
    except Exception as e_db:
        print(f"[AutoPause DB Resolve Warning]: {e_db}")

    for u_disk in settings.get("users", []):
        if str(u_disk.get("extension") or "").strip() == key_s or str(u_disk.get("id") or "").strip() == key_s:
            for k, v in u_disk.items():
                if v not in (None, "") and not user_dict.get(k):
                    user_dict[k] = v
            break

    if not user_dict:
        return None, [], None

    if not queues_list:
        queues_list = settings.get("queues", [])

    u_id_s = str(user_dict.get("id") or "").strip()
    u_ext_s = str(user_dict.get("extension") or "").strip()
    my_keys = {k for k in (u_id_s, u_ext_s, key_s) if k}

    member_queues = []
    for q in queues_list:
        raw_members = q.get("queueMembers") or q.get("members") or []
        if isinstance(raw_members, str):
            try:
                raw_members = json.loads(raw_members)
            except Exception:
                raw_members = []
        matched = False
        for m in raw_members:
            m_val = m.get("user_id") or m.get("extension") or m.get("id") if isinstance(m, dict) else m
            s_val = str(m_val or "").strip()
            if not s_val:
                continue
            if s_val in my_keys:
                matched = True
                break
            if s_val.startswith("group_"):
                gid = s_val.replace("group_", "", 1)
                grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                if grp:
                    grp_exts = {str(x).strip() for x in (grp.get("extensions") or grp.get("members") or []) if x}
                    if my_keys & grp_exts:
                        matched = True
                        break
        if matched:
            member_queues.append(q)

    user_dict["_has_login_today"] = has_login_today
    user_dict["_is_logged_out"] = is_logged_out
    return user_dict, member_queues, active_break_row


async def _send_auto_pause_user_notification(
    user_dict: dict,
    break_name: str,
    reason_detail: str,
    queue_name: str = "",
    channels_mode: str = "both"
):
    """Dispatches Email and/or WhatsApp notification to the agent (and fallback recipients) when Auto-Pause triggers."""
    try:
        from backend.main import settings_db, add_system_log
        from backend.services.notification_service import get_tenant_notification_settings, _send_notification_email
        from backend.services.whatsapp_service import send_whatsapp_message

        full_name = str(user_dict.get("full_name") or user_dict.get("name") or f"Dahili {user_dict.get('extension')}").strip()
        ext_s = str(user_dict.get("extension") or "").strip()
        tenant_id = str(user_dict.get("tenant_id") or "tenant-default").strip()
        user_email = str(user_dict.get("email") or "").strip()
        user_phone = str(
            user_dict.get("gsm_number")
            or user_dict.get("mobile_number")
            or user_dict.get("phone")
            or ""
        ).strip()

        now_tr = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
        q_label = queue_name or "Çağrı Merkezi Kuyruğu"
        mode = str(channels_mode or "both").lower()

        cfg = get_tenant_notification_settings(settings_db, tenant_id)
        channels_cfg = settings_db.get("channels", {})

        # 1. WhatsApp Notification
        if mode in ("both", "whatsapp"):
            wa_targets = []
            if user_phone:
                wa_targets.append(user_phone)
            else:
                raw_wa = str(cfg.get("whatsapp_recipients") or cfg.get("recipient_whatsapp_numbers") or "").strip()
                wa_targets = [n.strip() for n in raw_wa.replace(";", ",").split(",") if n.strip()]

            wa_text = (
                f"⚠️ *AIDA OTOMATİK MOLA BİLDİRİMİ*\n\n"
                f"👤 *Temsilci:* {full_name} (Dahili: `{ext_s}`)\n"
                f"📌 *Durum:* {break_name}\n"
                f"🏢 *Kuyruk:* {q_label}\n"
                f"🕒 *Zaman:* {now_tr}\n\n"
                f"📝 *Detay:*\n{reason_detail}\n\n"
                f"▶️ Çağrı almaya devam edebilmek için lütfen AIDA panelinizden *Molayı Bitir (Müsait)* durumuna geçiniz."
            )
            for num in wa_targets:
                clean_num = "".join(ch for ch in str(num) if ch.isdigit())
                if clean_num.startswith("0") and len(clean_num) == 11:
                    clean_num = "90" + clean_num[1:]
                elif len(clean_num) == 10 and clean_num.startswith("5"):
                    clean_num = "90" + clean_num
                if len(clean_num) >= 10:
                    try:
                        await send_whatsapp_message(to_phone=clean_num, text=wa_text)
                    except Exception as e_wa:
                        print(f"[AutoPause WhatsApp Send Error]: {e_wa}")

        # 2. Email Notification
        if mode in ("both", "email"):
            email_targets = []
            if user_email and "@" in user_email:
                email_targets.append(user_email)
            else:
                raw_em = str(cfg.get("email_recipients") or cfg.get("recipient_emails") or "").strip()
                email_targets = [e.strip() for e in raw_em.replace(";", ",").split(",") if e.strip() and "@" in e]

            if email_targets:
                subject = f"⚠️ [AIDA Otomatik Mola] {full_name} ({ext_s}) — {break_name}"
                plain_body = (
                    f"AIDA OTOMATİK MOLA BİLDİRİMİ\n"
                    f"============================\n"
                    f"Temsilci: {full_name} (Dahili: {ext_s})\n"
                    f"Durum: {break_name}\n"
                    f"Kuyruk: {q_label}\n"
                    f"Tarih/Saat: {now_tr}\n\n"
                    f"Açıklama:\n{reason_detail}\n\n"
                    f"Çağrı almaya devam edebilmek için lütfen AIDA panelinizden 'Molayı Bitir (Müsait)' durumuna geçiniz."
                )
                html_body = f"""
                <html>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
                    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                      <div style="background: #1e293b; color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
                        ⚠️ AIDA Otomatik Mola Bildirimi
                      </div>
                      <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
                        <p style="margin-top: 0; color: #0f172a; font-size: 15px;">Sayın <strong>{full_name}</strong> (Dahili: <strong>{ext_s}</strong>),</p>
                        <div style="background: #f1f5f9; border-left: 4px solid #334155; padding: 14px 16px; border-radius: 8px; margin: 16px 0; color: #1e293b; font-weight: 500;">
                          <strong>{break_name}</strong><br/>
                          {reason_detail}
                        </div>
                        <p style="color: #334155; font-size: 13px;">
                          Kuyruktan yeni çağrı almaya devam edebilmek için lütfen AIDA Temsilci Paneliniz üzerinden <strong>"Molayı Bitir (Müsait)"</strong> butonuna tıklayınız.
                        </p>
                        <table style="width: 100%; font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                          <tr>
                            <td><strong>Kuyruk:</strong> {q_label}</td>
                            <td><strong>Zaman (TR):</strong> {now_tr}</td>
                          </tr>
                        </table>
                      </div>
                    </div>
                  </body>
                </html>
                """
                try:
                    await _send_notification_email(cfg, channels_cfg, email_targets, subject, html_body, plain_body)
                except Exception as e_em:
                    print(f"[AutoPause Email Send Error]: {e_em}")

        try:
            add_system_log("AUTO_PAUSE", "WARNING", f"Otomatik Mola Tetiklendi: {full_name} ({ext_s}) -> {break_name} [{q_label}]")
        except Exception:
            pass
    except Exception as e_not:
        print(f"[AutoPause Notification Error]: {e_not}")


async def trigger_agent_auto_pause(
    extension_or_uid: str,
    reason_type: str,
    queue_cfg: dict = None,
    missed_count: int = 1
) -> bool:
    """
    Places the agent into Automatic Break ('Otomatik Mola (Çağrı Kaçırma)' or 'Otomatik Mola (Bağlantı Koptu)'),
    records it in AgentBreakLog, pauses the PJSIP member in Asterisk queues, and sends Email/WhatsApp alert.
    """
    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, extension_or_uid)
    if not user_dict:
        return False

    u_id_str = str(user_dict.get("id") or "").strip()
    u_ext_str = str(user_dict.get("extension") or "").strip()
    full_name = str(user_dict.get("full_name") or user_dict.get("name") or f"Dahili {u_ext_str}").strip()

    # Check if already on break in DB or memory
    mem_state = get_agent_state(user_id=u_id_str, extension=u_ext_str)
    if active_break_row is not None or (mem_state and mem_state.get("status") == "break"):
        return False

    # Do not auto-pause if the agent explicitly logged out and is not logged in
    is_mem_logged_in = bool(mem_state and mem_state.get("is_logged_in"))
    if user_dict.get("_is_logged_out") and not is_mem_logged_in:
        return False
    if not is_mem_logged_in and not user_dict.get("_has_login_today"):
        # For missed_call on a queue member, if they were registered and rang, allow auto-pause;
        # for disconnect, only auto-pause if they had an active session
        if reason_type == "disconnect":
            return False

    # Do not auto-pause if currently in an active talking call
    try:
        from backend.services.ami_manager import get_extension_call_state
        if u_ext_str and get_extension_call_state(u_ext_str) == "busy":
            return False
    except Exception:
        pass

    q_name = str((queue_cfg or {}).get("name") or (queue_cfg or {}).get("extension") or "Kuyruk").strip()
    if reason_type == "missed_call":
        break_name = "Otomatik Mola (Çağrı Kaçırma)"
        reason_detail = (
            f"'{q_name}' kuyruğundan gelen {missed_count} çağrıya üst üste yanıt verilmediği için "
            f"hesabınız otomatik olarak mola durumuna alınmıştır."
        )
    else:
        break_name = "Otomatik Mola (Bağlantı Koptu)"
        grace_s = int((queue_cfg or {}).get("auto_pause_disconnect_grace_sec") or 15)
        reason_detail = (
            f"Web Telefon / SIP telefon bağlantınız koptuğu ve {grace_s} saniye içinde yeniden bağlantı sağlanamadığı için "
            f"hesabınız otomatik olarak mola durumuna alınmıştır."
        )

    now_utc = datetime.datetime.utcnow()
    now_iso = now_utc.isoformat() + "Z"

    brk_obj = {
        "id": "auto_pause",
        "name": break_name,
        "color": AUTO_BREAK_DEFAULT_COLOR,
        "is_auto_break": True,
        "auto_reason": reason_type,
        "max_duration_minutes": 0,
        "daily_quota_minutes": 0,
        "start_time_utc": now_iso,
        "elapsed_seconds": 0
    }

    update_agent_state(
        is_logged_in=True,
        status="break",
        current_break=brk_obj,
        user_id=u_id_str,
        extension=u_ext_str,
        status_since_utc=now_iso
    )

    def _insert_break_db():
        from backend.database.config import SyncSessionLocal
        from backend.database.models import AgentBreakLog
        with SyncSessionLocal() as session:
            session.add(AgentBreakLog(
                tenant_id=str(user_dict.get("tenant_id") or "tenant-default"),
                user_id=u_id_str,
                extension=u_ext_str,
                agent_name=full_name,
                break_name=break_name,
                start_time=now_utc,
                end_time=None,
                duration_seconds=0
            ))
            session.commit()

    try:
        await asyncio.to_thread(_insert_break_db)
    except Exception as e_ins:
        print(f"[AutoPause DB Insert Error]: {e_ins}")

    if u_ext_str:
        await sync_asterisk_queue_pause(u_ext_str, True, reason=break_name)

    notify_enabled = True
    notify_channels = "both"
    if isinstance(queue_cfg, dict):
        if "auto_pause_notify_user" in queue_cfg and queue_cfg.get("auto_pause_notify_user") is not None:
            notify_enabled = bool(queue_cfg.get("auto_pause_notify_user"))
        if queue_cfg.get("auto_pause_notify_channels"):
            notify_channels = str(queue_cfg.get("auto_pause_notify_channels"))

    if notify_enabled:
        asyncio.create_task(
            _send_auto_pause_user_notification(
                user_dict=user_dict,
                break_name=break_name,
                reason_detail=reason_detail,
                queue_name=q_name,
                channels_mode=notify_channels
            )
        )

    print(f"[AutoPause] {full_name} ({u_ext_str}) -> {break_name} (Kuyruk: {q_name})")
    return True


async def handle_agent_missed_call_for_auto_pause(extension: str, queue_ext: str = ""):
    """Called when an agent misses/rejects an inbound call. Evaluates queue auto_pause_missed_enabled rules."""
    ext_s = str(extension or "").strip()
    if not ext_s or len(ext_s) > 6:
        return

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not member_queues or active_break_row is not None:
        return

    # Filter queues with auto_pause_missed_enabled
    enabled_queues = [
        q for q in member_queues
        if bool(q.get("auto_pause_missed_enabled", False))
        and (not queue_ext or str(q.get("extension") or "") == str(queue_ext) or str(q.get("name") or "") == str(queue_ext))
    ]
    if not enabled_queues:
        enabled_queues = [q for q in member_queues if bool(q.get("auto_pause_missed_enabled", False))]

    if not enabled_queues:
        return

    curr_missed = consecutive_missed_calls.get(ext_s, 0) + 1
    consecutive_missed_calls[ext_s] = curr_missed

    # Pick the queue with the lowest threshold that is now satisfied
    target_q = min(enabled_queues, key=lambda q: max(1, int(q.get("auto_pause_missed_count") or 1)))
    threshold = max(1, int(target_q.get("auto_pause_missed_count") or 1))

    if curr_missed >= threshold:
        consecutive_missed_calls[ext_s] = 0
        await trigger_agent_auto_pause(
            extension_or_uid=ext_s,
            reason_type="missed_call",
            queue_cfg=target_q,
            missed_count=curr_missed
        )


async def schedule_agent_disconnect_auto_pause(extension: str):
    """Schedules a grace-period check when a SIP/WebRTC endpoint becomes Unreachable or Removed."""
    ext_s = str(extension or "").strip()
    if not ext_s:
        return

    # Cancel any existing pending task for this extension
    old_task = pending_disconnect_tasks.pop(ext_s, None)
    if old_task and not old_task.done():
        old_task.cancel()

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not member_queues or active_break_row is not None:
        return

    enabled_queues = [q for q in member_queues if bool(q.get("auto_pause_disconnect_enabled", False))]
    if not enabled_queues:
        return

    target_q = min(enabled_queues, key=lambda q: max(3, int(q.get("auto_pause_disconnect_grace_sec") or 15)))
    grace_sec = max(3, int(target_q.get("auto_pause_disconnect_grace_sec") or 15))

    async def _delayed_disconnect_worker():
        try:
            await asyncio.sleep(grace_sec)
            from backend.services.ami_manager import registered_endpoints
            u_id_s = str(user_dict.get("id") or "").strip()
            # If the agent reconnected during the grace period, abort!
            if ext_s in registered_endpoints or (u_id_s and u_id_s in registered_endpoints):
                return
            await trigger_agent_auto_pause(
                extension_or_uid=ext_s,
                reason_type="disconnect",
                queue_cfg=target_q
            )
        except asyncio.CancelledError:
            pass
        except Exception as e_dc:
            print(f"[AutoPause Disconnect Worker Error]: {e_dc}")
        finally:
            pending_disconnect_tasks.pop(ext_s, None)

    pending_disconnect_tasks[ext_s] = asyncio.create_task(_delayed_disconnect_worker())


async def handle_agent_reconnect_auto_pause(extension: str):
    """Cancels pending disconnect timer and optionally auto-unpauses agent if queue is configured for 'auto' reconnect."""
    ext_s = str(extension or "").strip()
    if not ext_s:
        return

    old_task = pending_disconnect_tasks.pop(ext_s, None)
    if old_task and not old_task.done():
        old_task.cancel()

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not active_break_row:
        return

    b_name = str(active_break_row.get("break_name") or "")
    if "bağlantı koptu" not in b_name.lower():
        return

    auto_unpause = any(
        bool(q.get("auto_pause_disconnect_enabled", False))
        and str(q.get("auto_pause_reconnect_mode") or "manual").lower() == "auto"
        for q in member_queues
    )
    if not auto_unpause:
        return

    u_id_str = str(user_dict.get("id") or "").strip()
    now_utc = datetime.datetime.utcnow()

    def _end_auto_break_db():
        from backend.database.config import SyncSessionLocal
        from backend.database.models import AgentBreakLog
        with SyncSessionLocal() as session:
            active_logs = (
                session.query(AgentBreakLog)
                .filter(
                    AgentBreakLog.end_time.is_(None),
                    (AgentBreakLog.extension == ext_s) | (AgentBreakLog.user_id == u_id_str)
                )
                .all()
            )
            for al in active_logs:
                al.end_time = now_utc
                al.duration_seconds = max(0, int((now_utc - al.start_time).total_seconds()))
            session.commit()

    try:
        await asyncio.to_thread(_end_auto_break_db)
        update_agent_state(
            is_logged_in=True,
            status="online",
            current_break=None,
            user_id=u_id_str,
            extension=ext_s,
            status_since_utc=now_utc.isoformat() + "Z"
        )
        await sync_asterisk_queue_pause(ext_s, False, reason="AutoReconnect")
        print(f"[AutoPause] {ext_s} bağlantısı geri geldi -> Otomatik Müsait durumuna döndürüldü.")
    except Exception as e_rec:
        print(f"[AutoPause Reconnect Error]: {e_rec}")


# ============================================================================
# QUEUE AUTO-LOGOUT (OTOMATİK ÇIKIŞ) SCHEDULER ENGINE
# ============================================================================
# Tracks when a queue's auto-logout has already fired for a given local date + time slot
# Key: f"{queue_id}:{local_date}:{slot_key}"
_queue_auto_logout_fired_slots = set()
# Tracks agents who were in an active call when auto-logout triggered so they are logged out right after hangup
# Key: ext_str -> {"queue_cfg": dict, "reason": str, "queued_at_utc": str}
pending_graceful_auto_logouts = {}
# Last auto-logout notification per agent extension/user_id so UI can display banner/toast
last_agent_auto_logout_info = {}


def _parse_hhmm_safe(val_str: str, default_min: int = 1080) -> int:
    try:
        parts = str(val_str or "").strip().split(":")
        if len(parts) >= 2:
            h = max(0, min(23, int(parts[0])))
            m = max(0, min(59, int(parts[1])))
            return h * 60 + m
    except Exception:
        pass
    return default_min


def evaluate_queue_auto_logout_state(queue_cfg: dict, settings_dict: dict = None, now_dt=None) -> dict:
    """
    Evaluates whether a queue's auto-logout schedule is currently at or past its logout time
    (or outside allowed work hours).
    Returns:
      {
        "enabled": bool,
        "mode": "system_work_hours" | "custom_schedule",
        "should_logout_now": bool,
        "is_off_hours": bool,
        "logout_time_hhmm": str,
        "slot_key": str,
        "reason": str,
        "local_date": str,
        "local_time": str,
        "day_key": str,
      }
    """
    if not isinstance(queue_cfg, dict) or not bool(queue_cfg.get("auto_logout_enabled", False)):
        return {
            "enabled": False,
            "mode": str((queue_cfg or {}).get("auto_logout_mode") or "system_work_hours"),
            "should_logout_now": False,
            "is_off_hours": False,
            "logout_time_hhmm": "",
            "slot_key": "",
            "reason": "Otomatik çıkış kapalı",
        }

    from backend.main import settings_db, get_tenant_work_hours_config, evaluate_system_work_hours
    s_db = settings_dict if isinstance(settings_dict, dict) else settings_db
    tenant_id = str(queue_cfg.get("tenant_id") or "tenant-default").strip()
    wh_cfg = get_tenant_work_hours_config(s_db, tenant_id)
    tz_name = str(wh_cfg.get("timezone") or "Europe/Istanbul").strip()
    try:
        from zoneinfo import ZoneInfo
        tz_obj = ZoneInfo(tz_name)
    except Exception:
        tz_obj = datetime.timezone(datetime.timedelta(hours=3))

    local_now = now_dt.astimezone(tz_obj) if now_dt is not None else datetime.datetime.now(tz_obj)
    today_iso = local_now.strftime("%Y-%m-%d")
    cur_hhmm = local_now.strftime("%H:%M")
    cur_min = local_now.hour * 60 + local_now.minute

    day_keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_labels_tr = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    w_idx = local_now.weekday()
    today_key = day_keys[w_idx]
    today_label_tr = day_labels_tr[w_idx]

    mode = str(queue_cfg.get("auto_logout_mode") or "system_work_hours").strip()
    q_name = str(queue_cfg.get("name") or queue_cfg.get("extension") or "Kuyruk").strip()

    if mode == "system_work_hours":
        wh_eval = evaluate_system_work_hours(s_db, tenant_id, now_dt=local_now)
        weekly = wh_cfg.get("weekly_schedule") or {}
        day_cfg = weekly.get(today_key) or {"enabled": w_idx < 5, "start": "09:00", "end": "18:00"}
        end_hhmm = str(day_cfg.get("end") or "18:00").strip()
        start_hhmm = str(day_cfg.get("start") or "09:00").strip()
        end_min = _parse_hhmm_safe(end_hhmm, 1080)
        start_min = _parse_hhmm_safe(start_hhmm, 540)

        # If today is a holiday or closed day or outside work hours (excluding lunch break unless desired)
        state_str = str(wh_eval.get("state") or "")
        is_open = bool(wh_eval.get("is_open", True))

        # Do not log agents out during lunch break; only when shift ends or on closed day / holiday
        if state_str == "lunch":
            return {
                "enabled": True,
                "mode": mode,
                "should_logout_now": False,
                "is_off_hours": False,
                "logout_time_hhmm": end_hhmm,
                "slot_key": "",
                "reason": "Öğle arası (Otomatik çıkış uygulanmaz)",
                "local_date": today_iso,
                "local_time": cur_hhmm,
                "day_key": today_key,
            }

        is_off = not is_open
        # Determine if we reached end of shift today
        reached_shift_end = False
        if not day_cfg.get("enabled", False) or state_str in ("holiday", "closed_day"):
            reached_shift_end = True
            slot_key = f"sys_closed_{today_iso}"
        elif start_min <= end_min:
            if cur_min >= end_min:
                reached_shift_end = True
                slot_key = f"sys_end_{today_iso}_{end_hhmm}"
            else:
                slot_key = ""
        else:
            # Overnight shift
            if not is_open:
                reached_shift_end = True
                slot_key = f"sys_overnight_end_{today_iso}_{end_hhmm}"
            else:
                slot_key = ""

        return {
            "enabled": True,
            "mode": mode,
            "should_logout_now": reached_shift_end,
            "is_off_hours": is_off,
            "logout_time_hhmm": end_hhmm,
            "slot_key": slot_key,
            "reason": f"'{q_name}' kuyruğu mesai bitiş saati ({end_hhmm}) geldiği için otomatik çıkış yapıldı.",
            "local_date": today_iso,
            "local_time": cur_hhmm,
            "day_key": today_key,
            "day_label": today_label_tr,
        }

    # Mode: custom_schedule (Özel Saat ve Gün Ayarı)
    raw_days = queue_cfg.get("auto_logout_days")
    if isinstance(raw_days, str):
        try:
            raw_days = json.loads(raw_days)
        except Exception:
            raw_days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    if not isinstance(raw_days, list):
        raw_days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    active_days = [str(d).strip().lower() for d in raw_days if d]

    custom_sched = queue_cfg.get("auto_logout_custom_schedule")
    if isinstance(custom_sched, str):
        try:
            custom_sched = json.loads(custom_sched)
        except Exception:
            custom_sched = {}
    if not isinstance(custom_sched, dict):
        custom_sched = {}

    default_logout_hhmm = str(queue_cfg.get("auto_logout_time") or "18:00").strip()
    day_override = custom_sched.get(today_key) if isinstance(custom_sched.get(today_key), dict) else {}
    target_hhmm = str(day_override.get("logout_time") or default_logout_hhmm or "18:00").strip()
    start_hhmm = str(day_override.get("start_time") or custom_sched.get("start_time") or "08:00").strip()

    target_min = _parse_hhmm_safe(target_hhmm, 1080)
    start_min = _parse_hhmm_safe(start_hhmm, 480)

    is_day_enabled = today_key in active_days
    if not is_day_enabled:
        return {
            "enabled": True,
            "mode": mode,
            "should_logout_now": False,
            "is_off_hours": True,
            "logout_time_hhmm": target_hhmm,
            "slot_key": "",
            "reason": f"{today_label_tr} günü bu kuyruk için otomatik çıkış kuralı pasif.",
            "local_date": today_iso,
            "local_time": cur_hhmm,
            "day_key": today_key,
            "day_label": today_label_tr,
        }

    # Trigger when current time is >= target_min (and within the post-logout window of the day)
    should_fire = cur_min >= target_min
    is_off_hours = cur_min >= target_min or cur_min < start_min
    slot_key = f"custom_{today_iso}_{target_hhmm}" if should_fire else ""

    return {
        "enabled": True,
        "mode": mode,
        "should_logout_now": should_fire,
        "is_off_hours": is_off_hours,
        "logout_time_hhmm": target_hhmm,
        "slot_key": slot_key,
        "reason": f"'{q_name}' kuyruğu özel otomatik çıkış saati ({target_hhmm}) geldiği için oturum kapatıldı.",
        "local_date": today_iso,
        "local_time": cur_hhmm,
        "day_key": today_key,
        "day_label": today_label_tr,
    }


async def execute_agent_auto_logout(
    extension_or_uid: str,
    queue_cfg: dict,
    reason_text: str,
    force_immediate: bool = False
) -> bool:
    """
    Logs out (or pauses) an agent from the queue/system when the queue's Auto-Logout schedule triggers.
    - Respects `auto_logout_graceful_incall`: if True and agent is currently on a call, defers until hangup.
    - Respects `auto_logout_close_breaks`: closes any open AgentBreakLog so breaks don't run overnight.
    - Respects `auto_logout_action`: 'full_logout' (sets status offline & writes __LOGOUT__) or 'queue_pause'.
    """
    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, extension_or_uid)
    if not user_dict:
        return False

    u_id_str = str(user_dict.get("id") or "").strip()
    u_ext_str = str(user_dict.get("extension") or "").strip()
    full_name = str(user_dict.get("full_name") or user_dict.get("name") or f"Dahili {u_ext_str}").strip()
    q_name = str((queue_cfg or {}).get("name") or (queue_cfg or {}).get("extension") or "Kuyruk").strip()

    mem_state = get_agent_state(user_id=u_id_str, extension=u_ext_str)
    is_mem_logged_in = bool(mem_state and mem_state.get("is_logged_in"))
    if user_dict.get("_is_logged_out") and not is_mem_logged_in and active_break_row is None:
        return False
    if not is_mem_logged_in and not user_dict.get("_has_login_today") and active_break_row is None:
        return False

    graceful_incall = bool((queue_cfg or {}).get("auto_logout_graceful_incall", True))
    if graceful_incall and not force_immediate and u_ext_str:
        try:
            from backend.services.ami_manager import get_extension_call_state
            if get_extension_call_state(u_ext_str) == "busy":
                pending_graceful_auto_logouts[u_ext_str] = {
                    "queue_cfg": dict(queue_cfg or {}),
                    "reason": reason_text,
                    "queued_at_utc": datetime.datetime.utcnow().isoformat() + "Z",
                }
                print(f"[QueueAutoLogout] {full_name} ({u_ext_str}) aktif görüşmede -> Görüşme bitiminde otomatik çıkış yapılacak.")
                return False
        except Exception:
            pass

    pending_graceful_auto_logouts.pop(u_ext_str, None)

    action_mode = str((queue_cfg or {}).get("auto_logout_action") or "full_logout").strip()
    close_breaks = bool((queue_cfg or {}).get("auto_logout_close_breaks", True))
    now_utc = datetime.datetime.utcnow()
    now_iso = now_utc.isoformat() + "Z"

    if action_mode == "queue_pause":
        if u_ext_str:
            await sync_asterisk_queue_pause(u_ext_str, True, reason="AutoLogoutQueuePause")
        info_payload = {
            "timestamp_utc": now_iso,
            "queue_name": q_name,
            "action": "queue_pause",
            "reason": reason_text,
        }
        if u_ext_str:
            last_agent_auto_logout_info[u_ext_str] = info_payload
        if u_id_str:
            last_agent_auto_logout_info[u_id_str] = info_payload
        return True

    # Full Logout: close any open breaks + insert __LOGOUT__ record + set agent state offline
    def _apply_db_logout():
        from backend.database.config import SyncSessionLocal
        from backend.database.models import AgentBreakLog
        with SyncSessionLocal() as session:
            if close_breaks:
                open_logs = (
                    session.query(AgentBreakLog)
                    .filter(
                        AgentBreakLog.end_time.is_(None),
                        (AgentBreakLog.extension == u_ext_str) | (AgentBreakLog.user_id == u_id_str)
                    )
                    .all()
                )
                for ol in open_logs:
                    ol.end_time = now_utc
                    ol.duration_seconds = max(0, int((now_utc - ol.start_time).total_seconds()))

            session.add(AgentBreakLog(
                tenant_id=str(user_dict.get("tenant_id") or "tenant-default"),
                user_id=u_id_str,
                extension=u_ext_str,
                agent_name=full_name,
                break_name="__LOGOUT__",
                start_time=now_utc,
                end_time=now_utc,
                duration_seconds=0,
            ))
            session.commit()

    try:
        await asyncio.to_thread(_apply_db_logout)
    except Exception as e_db_out:
        print(f"[QueueAutoLogout DB Error]: {e_db_out}")

    st_updated = update_agent_state(
        is_logged_in=False,
        status="offline",
        current_break=None,
        user_id=u_id_str,
        extension=u_ext_str,
        status_since_utc=now_iso,
    )
    info_payload = {
        "timestamp_utc": now_iso,
        "queue_name": q_name,
        "action": "full_logout",
        "reason": reason_text,
    }
    st_updated["auto_logout_info"] = info_payload
    if u_ext_str:
        last_agent_auto_logout_info[u_ext_str] = info_payload
        await sync_asterisk_queue_pause(u_ext_str, True, reason="AutoLogout")
    if u_id_str:
        last_agent_auto_logout_info[u_id_str] = info_payload

    try:
        from backend.main import log_event, add_system_log
        add_system_log("QUEUE_AUTO_LOGOUT", "INFO", f"Otomatik Kuyruk Çıkışı: {full_name} ({u_ext_str}) -> {reason_text}")
        asyncio.create_task(log_event(
            user_id=f"{full_name} ({u_ext_str})",
            action="QUEUE_AUTO_LOGOUT",
            module="QueueAutoLogout",
            details={"summary": reason_text, "queue": q_name, "action": action_mode}
        ))
    except Exception:
        pass

    print(f"[QueueAutoLogout] {full_name} ({u_ext_str}) otomatik çıkış yapıldı -> {reason_text}")
    return True


async def process_queue_auto_logout_schedules() -> dict:
    """
    Periodically checks all queues with `auto_logout_enabled=True` and logs out any active/on-break agents
    when the queue's shift end time or custom logout schedule is reached.
    Also flushes any `pending_graceful_auto_logouts` whose calls have ended.
    """
    from backend.database.config import SyncSessionLocal
    from backend.database.models import PBXQueue
    from backend.main import settings_db, load_settings

    s_db = settings_db if isinstance(settings_db, dict) and settings_db.get("users") else load_settings()
    all_groups = s_db.get("subscriber_groups", [])

    # 1. Flush any deferred in-call graceful logouts whose call has finished
    if pending_graceful_auto_logouts:
        from backend.services.ami_manager import get_extension_call_state
        for ext_k, p_info in list(pending_graceful_auto_logouts.items()):
            try:
                if get_extension_call_state(ext_k) != "busy":
                    await execute_agent_auto_logout(
                        extension_or_uid=ext_k,
                        queue_cfg=p_info.get("queue_cfg") or {},
                        reason_text=p_info.get("reason") or "Mesai süresi dolduğu için görüşme sonunda otomatik çıkış yapıldı.",
                        force_immediate=True,
                    )
            except Exception as e_gr:
                print(f"[QueueAutoLogout Graceful Flush Error]: {e_gr}")

    def _load_queues_sync():
        q_list = []
        try:
            with SyncSessionLocal() as session:
                for q in session.query(PBXQueue).all():
                    q_list.append({col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns})
        except Exception:
            pass
        if not q_list:
            q_list = s_db.get("queues", [])
        return q_list

    queues_list = await asyncio.to_thread(_load_queues_sync)
    logged_out_agents = []

    for q in queues_list:
        if not bool(q.get("auto_logout_enabled", False)):
            continue
        eval_res = evaluate_queue_auto_logout_state(q, s_db)
        if not eval_res.get("should_logout_now"):
            continue

        q_id = q.get("id") or q.get("extension") or q.get("name")
        slot_key = eval_res.get("slot_key") or ""
        dedup_token = f"{q_id}:{slot_key}"
        if slot_key and dedup_token in _queue_auto_logout_fired_slots:
            continue

        # Extract all member keys (extensions / user_ids / subscriber groups)
        raw_members = q.get("queueMembers") or q.get("members") or []
        if isinstance(raw_members, str):
            try:
                raw_members = json.loads(raw_members)
            except Exception:
                raw_members = []

        member_keys = set()
        for m in raw_members:
            if isinstance(m, dict) and m.get("is_ai"):
                continue
            m_val = m.get("user_id") or m.get("extension") or m.get("id") if isinstance(m, dict) else m
            s_val = str(m_val or "").strip()
            if not s_val:
                continue
            if s_val.startswith("group_"):
                gid = s_val.replace("group_", "", 1)
                grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                if grp:
                    for gx in (grp.get("extensions") or grp.get("members") or []):
                        if gx:
                            member_keys.add(str(gx).strip())
            else:
                member_keys.add(s_val)

        for mk in member_keys:
            did_logout = await execute_agent_auto_logout(
                extension_or_uid=mk,
                queue_cfg=q,
                reason_text=eval_res.get("reason") or "Mesai sonu otomatik çıkış",
            )
            if did_logout:
                logged_out_agents.append(mk)

        if slot_key:
            _queue_auto_logout_fired_slots.add(dedup_token)
            if len(_queue_auto_logout_fired_slots) > 1000:
                _queue_auto_logout_fired_slots.clear()
                _queue_auto_logout_fired_slots.add(dedup_token)

    return {"logged_out_count": len(logged_out_agents), "agents": logged_out_agents}


