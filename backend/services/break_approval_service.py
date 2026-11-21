import datetime
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import text, select
from backend.database.models import BreakApprovalRequest


async def ensure_break_approval_table_async(db_session) -> None:
    """Safely ensures break_approval_requests table exists in PostgreSQL."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS break_approval_requests (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            agent_user_id VARCHAR NOT NULL,
            agent_extension VARCHAR,
            agent_name VARCHAR,
            break_id VARCHAR,
            break_name VARCHAR NOT NULL,
            break_color VARCHAR DEFAULT '#f59e0b',
            reason_type VARCHAR NOT NULL DEFAULT 'daily_quota_exceeded',
            limit_detail TEXT,
            agent_note TEXT,
            queue_name VARCHAR,
            target_supervisors JSON DEFAULT '[]',
            status VARCHAR NOT NULL DEFAULT 'pending',
            approved_extra_minutes INTEGER DEFAULT 0,
            reviewer_user_id VARCHAR,
            reviewer_name VARCHAR,
            reviewer_note TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            resolved_at TIMESTAMP WITHOUT TIME ZONE,
            expires_at TIMESTAMP WITHOUT TIME ZONE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_break_approval_tenant_status ON break_approval_requests (tenant_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_break_approval_agent ON break_approval_requests (agent_user_id, agent_extension);",
    ]
    for stmt in ddl_statements:
        await db_session.execute(text(stmt))
    await db_session.commit()


def _extract_id_tokens(item: Any) -> Set[str]:
    tokens: Set[str] = set()
    if item is None:
        return tokens
    if isinstance(item, dict):
        for k in ("id", "user_id", "extension", "email", "username"):
            v = item.get(k)
            if v is not None and str(v).strip():
                tokens.add(str(v).strip())
    else:
        s = str(item).strip()
        if s:
            tokens.add(s)
    return tokens


def resolve_target_supervisors_for_agent(
    agent_user_id: str,
    agent_extension: str,
    queues_list: List[Dict[str, Any]],
    users_list: List[Dict[str, Any]],
    preferred_queue_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Finds all queue supervisors & managers responsible for this agent.
    Always includes 'admin' as fallback/escalation authority.
    Returns { 'supervisor_keys': [...], 'matched_queues': [...] }.
    """
    agent_keys = {k for k in (str(agent_user_id or "").strip(), str(agent_extension or "").strip()) if k}
    supervisor_keys: Set[str] = {"admin"}
    matched_queues: List[str] = []
    matched_queue_ids: Set[str] = set()

    # Build quick lookup from user id/ext -> all keys of that user so supervisor matching works by id OR extension
    user_key_groups: List[Set[str]] = []
    for u in users_list or []:
        if not isinstance(u, dict):
            continue
        grp = _extract_id_tokens(u)
        if grp:
            user_key_groups.append(grp)

    def expand_supervisor_token(tok: str) -> None:
        t = str(tok or "").strip()
        if not t:
            return
        supervisor_keys.add(t)
        for grp in user_key_groups:
            if t in grp:
                supervisor_keys.update(grp)

    # 1. Queue-level supervisors (PBXQueue.supervisors)
    for q in queues_list or []:
        if not isinstance(q, dict):
            continue
        q_name = str(q.get("name") or q.get("extension") or "").strip()
        q_ext = str(q.get("extension") or "").strip()
        q_id = str(q.get("id") or "").strip()

        members = q.get("queueMembers") or q.get("members") or []
        member_tokens: Set[str] = set()
        for m in members:
            member_tokens.update(_extract_id_tokens(m))

        is_member = bool(agent_keys & member_tokens)
        is_preferred = bool(
            preferred_queue_name
            and q_name
            and q_name.lower() == str(preferred_queue_name).strip().lower()
        )
        if not is_member and not is_preferred:
            continue

        if q_name:
            matched_queues.append(q_name)
        for qk in (q_id, q_ext, q_name):
            if qk:
                matched_queue_ids.add(qk)

        raw_sups = q.get("supervisors") or []
        for s in raw_sups:
            for tok in _extract_id_tokens(s):
                expand_supervisor_token(tok)

    # 2. User-level supervisor scopes (managed_users / managed_queues)
    for u in users_list or []:
        if not isinstance(u, dict):
            continue
        u_role = str(u.get("role") or "").lower()
        u_tokens = _extract_id_tokens(u)
        if not u_tokens or (agent_keys & u_tokens):
            # Agent cannot approve their own break request (unless admin testing solo)
            continue

        if u_role in ("admin", "superadmin"):
            supervisor_keys.update(u_tokens)
            continue

        managed_u = {str(x).strip() for x in (u.get("managed_users") or []) if str(x).strip()}
        managed_q = {str(x).strip() for x in (u.get("managed_queues") or []) if str(x).strip()}

        if (agent_keys & managed_u) or (matched_queue_ids & managed_q):
            supervisor_keys.update(u_tokens)

    # Remove the requesting agent's own non-admin keys so they don't see an approve popup for themselves
    for ak in agent_keys:
        if ak.lower() != "admin":
            supervisor_keys.discard(ak)

    return {
        "supervisor_keys": sorted(supervisor_keys),
        "matched_queues": matched_queues,
    }


def is_user_authorized_reviewer(
    reviewer_user_id: str,
    reviewer_extension: str,
    reviewer_role: str,
    request_row: BreakApprovalRequest,
    roles_list: List[Dict[str, Any]],
) -> bool:
    uid = str(reviewer_user_id or "").strip()
    ext = str(reviewer_extension or "").strip()
    role = str(reviewer_role or "").strip().lower()

    if uid.lower() == "admin" or role in ("admin", "superadmin"):
        return True

    # Agent cannot approve their own request
    if (uid and uid == str(request_row.agent_user_id or "").strip()) or (
        ext and ext == str(request_row.agent_extension or "").strip()
    ):
        return False

    targets = set(str(x).strip() for x in (request_row.target_supervisors or []) if str(x).strip())
    if (uid and uid in targets) or (ext and ext in targets):
        return True

    # Also allow any supervisor role with explicit supervisor:agent_status / supervisor:access permission
    for r in roles_list or []:
        if isinstance(r, dict) and str(r.get("role_code") or "").lower() == role:
            perms = r.get("permissions") or []
            if "*" in perms or "supervisor:agent_status" in perms or "supervisor:access" in perms:
                return True
    return False


async def expire_stale_pending_requests(db_session) -> int:
    now_utc = datetime.datetime.utcnow()
    try:
        res = await db_session.execute(
            select(BreakApprovalRequest).where(
                BreakApprovalRequest.status == "pending",
                BreakApprovalRequest.expires_at.is_not(None),
                BreakApprovalRequest.expires_at < now_utc,
            )
        )
        rows = res.scalars().all()
        if not rows:
            return 0
        for row in rows:
            row.status = "expired"
            row.resolved_at = now_utc
        await db_session.commit()
        return len(rows)
    except Exception:
        return 0


def serialize_break_approval_request(row: BreakApprovalRequest) -> Dict[str, Any]:
    now_utc = datetime.datetime.utcnow()
    remaining_sec = 0
    if row.status == "pending" and row.expires_at:
        remaining_sec = max(0, int((row.expires_at - now_utc).total_seconds()))

    return {
        "id": row.id,
        "tenant_id": row.tenant_id or "tenant-default",
        "agent_user_id": row.agent_user_id,
        "agent_extension": row.agent_extension or "",
        "agent_name": row.agent_name or row.agent_extension or row.agent_user_id,
        "break_id": row.break_id,
        "break_name": row.break_name,
        "break_color": row.break_color or "#f59e0b",
        "reason_type": row.reason_type or "daily_quota_exceeded",
        "limit_detail": row.limit_detail or "",
        "agent_note": row.agent_note or "",
        "queue_name": row.queue_name or "",
        "target_supervisors": row.target_supervisors or [],
        "status": row.status,
        "approved_extra_minutes": int(row.approved_extra_minutes or 0),
        "reviewer_user_id": row.reviewer_user_id,
        "reviewer_name": row.reviewer_name,
        "reviewer_note": row.reviewer_note or "",
        "created_at": row.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.created_at else None,
        "resolved_at": row.resolved_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.resolved_at else None,
        "expires_at": row.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.expires_at else None,
        "remaining_seconds": remaining_sec,
    }
