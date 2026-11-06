import re
import copy
import uuid
import time
import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, or_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.database.config import get_db
from backend.database.models import (
    Call,
    Transcript,
    Appointment,
    ChatSession,
    ChatMessage,
    Contact,
    SystemSetting,
    SystemUser,
    PBXQueue,
    EventLog,
)

router = APIRouter(prefix="/api/workspace", tags=["Workspace & Operasyon Zekası"])

# Lightweight in-memory TTL cache for SystemSetting JSON blobs to avoid redundant DB reads
_SETTING_MEM_CACHE: Dict[str, Dict[str, Any]] = {}
_SETTING_CACHE_TTL = 4.0

CRISIS_CRITICAL_KEYWORDS = [
    "şikayet edeceğim",
    "savcılık",
    "tüketici hakem",
    "avukat",
    "rezalet",
    "dolandırıcı",
    "üst yetkili",
    "müdürünüze",
    "müdürü bağla",
    "iptal edin",
    "aboneliğimi iptal",
    "üyeliğimi iptal",
    "yeter artık",
    "berbat",
    "lanet",
]

CRISIS_WARNING_KEYWORDS = [
    "şikayet",
    "iptal",
    "memnun değilim",
    "çok kötü",
    "saçmalık",
    "kapatıyorum",
    "yanlış bilgi",
    "kaç saattir",
    "kimse ilgilenmiyor",
    "bağlayın",
]


def _is_default_tenant(tenant_id: Optional[str]) -> bool:
    return not tenant_id or tenant_id in ("tenant-default", "default")


def _is_global_tenant(tenant_id: Optional[str]) -> bool:
    return tenant_id in ("all", "global")


def _tenant_storage_key(tenant_id: Optional[str]) -> str:
    if _is_default_tenant(tenant_id) or _is_global_tenant(tenant_id):
        return "tenant-default"
    return str(tenant_id).strip()


def _normalize_phone_10(raw: Optional[str]) -> str:
    if not raw:
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def _extract_ctx(request: Request) -> Dict[str, str]:
    tenant_id = (
        request.headers.get("X-Tenant-ID")
        or request.headers.get("Tenant-ID")
        or request.query_params.get("tenant_id")
        or "tenant-default"
    ).strip()
    user_id = (
        request.headers.get("X-User-ID")
        or request.query_params.get("user_id")
        or "admin"
    ).strip()
    extension = (
        request.headers.get("X-User-Extension")
        or request.query_params.get("extension")
        or ""
    ).strip()
    role = (
        request.headers.get("X-User-Role")
        or request.query_params.get("role")
        or "admin"
    ).strip().lower()
    return {
        "tenant_id": tenant_id,
        "tenant_key": _tenant_storage_key(tenant_id),
        "user_id": user_id,
        "extension": extension,
        "role": role,
    }


def _apply_tenant_filter(stmt, model_cls, tenant_id: str):
    if _is_global_tenant(tenant_id):
        return stmt
    col = getattr(model_cls, "tenant_id", None)
    if col is None:
        return stmt
    if _is_default_tenant(tenant_id):
        return stmt.where(or_(col.in_(["tenant-default", "default"]), col.is_(None)))
    return stmt.where(col == tenant_id)


async def _load_json_setting(db: AsyncSession, key: str, default_factory=dict) -> Any:
    now_mono = time.monotonic()
    cached = _SETTING_MEM_CACHE.get(key)
    if cached and (now_mono - cached["ts"]) < _SETTING_CACHE_TTL:
        return copy.deepcopy(cached["val"])

    stmt = select(SystemSetting).where(SystemSetting.key == key)
    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    val = copy.deepcopy(row.value) if (row and row.value is not None) else default_factory()
    _SETTING_MEM_CACHE[key] = {"ts": now_mono, "val": copy.deepcopy(val)}
    return val


async def _save_json_setting(db: AsyncSession, key: str, value: Any) -> None:
    clean_val = copy.deepcopy(value)
    stmt = select(SystemSetting).where(SystemSetting.key == key)
    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    if row:
        row.value = clean_val
        flag_modified(row, "value")
    else:
        db.add(SystemSetting(key=key, value=clean_val))
    await db.commit()
    _SETTING_MEM_CACHE[key] = {"ts": time.monotonic(), "val": copy.deepcopy(clean_val)}


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class Customer360MetaUpdate(BaseModel):
    phone: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    vip: Optional[bool] = None
    company: Optional[str] = None
    tags: Optional[List[str]] = None
    sticky_note: Optional[str] = None


class MissedCallClaimPayload(BaseModel):
    caller_number: str
    status: str  # "claiming" | "reached" | "unreachable" | "scheduled" | "clear"
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    agent_ext: Optional[str] = None
    note: Optional[str] = None


class CallbackCreatePayload(BaseModel):
    customer_phone: str
    customer_name: Optional[str] = ""
    scheduled_at: str  # ISO datetime string
    assigned_user_id: Optional[str] = ""
    assigned_user_name: Optional[str] = ""
    assigned_extension: Optional[str] = ""
    priority: Optional[str] = "normal"  # "normal" | "high" | "urgent"
    note: Optional[str] = ""


class CallbackPatchPayload(BaseModel):
    status: Optional[str] = None  # "pending" | "completed" | "cancelled"
    snooze_minutes: Optional[int] = None
    scheduled_at: Optional[str] = None
    note: Optional[str] = None


class NotificationReadPayload(BaseModel):
    ids: Optional[List[str]] = None
    mark_all: bool = False


# ---------------------------------------------------------------------------
# 1. MÜŞTERİ 360° ÇEKMECESİ (Customer 360 Unified Timeline & CRM Meta)
# ---------------------------------------------------------------------------

@router.get("/customer-360")
async def get_customer_360(
    request: Request,
    phone: str = Query(..., description="Customer phone or identifier"),
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    tenant_id = ctx["tenant_id"]
    tenant_key = ctx["tenant_key"]

    raw_target = (phone or "").strip()
    if not raw_target:
        raise HTTPException(status_code=400, detail="Telefon numarası gereklidir.")

    norm10 = _normalize_phone_10(raw_target)
    search_token = norm10 if len(norm10) >= 7 else raw_target

    # 1. Resolve Contact
    matched_contact = None
    try:
        stmt_c = _apply_tenant_filter(select(Contact), Contact, tenant_id)
        if search_token:
            stmt_c = stmt_c.where(Contact.phone_number.ilike(f"%{search_token}%"))
        res_c = await db.execute(stmt_c.limit(10))
        candidates = res_c.scalars().all()
        for c in candidates:
            if norm10 and _normalize_phone_10(c.phone_number) == norm10:
                matched_contact = c
                break
        if not matched_contact and candidates:
            matched_contact = candidates[0]
    except Exception:
        matched_contact = None

    # 2. Load Custom 360 Meta (VIP, tags, company, sticky_note)
    meta_store_key = f"customer_360_meta::{tenant_key}"
    all_meta = await _load_json_setting(db, meta_store_key, dict)
    if not isinstance(all_meta, dict):
        all_meta = {}
    meta_lookup_key = norm10 or raw_target
    cust_meta = all_meta.get(meta_lookup_key, {})

    # 3. Calls History (up to 35 recent calls)
    stmt_calls = _apply_tenant_filter(select(Call), Call, tenant_id)
    stmt_calls = stmt_calls.where(
        or_(
            Call.caller_number.ilike(f"%{search_token}%"),
            Call.callee_number.ilike(f"%{search_token}%"),
        )
    ).order_by(desc(Call.start_time)).limit(35)
    res_calls = await db.execute(stmt_calls)
    calls = res_calls.scalars().all()

    # 4. Omnichannel Sessions + Recent Messages
    stmt_chat = _apply_tenant_filter(select(ChatSession), ChatSession, tenant_id)
    stmt_chat = stmt_chat.where(
        ChatSession.sender_info.ilike(f"%{search_token}%")
    ).order_by(desc(ChatSession.last_message_time)).limit(15)
    res_chat = await db.execute(stmt_chat)
    chat_sessions = res_chat.scalars().all()

    chat_previews: Dict[str, List[Dict[str, Any]]] = {}
    if chat_sessions:
        sess_ids = [s.id for s in chat_sessions]
        stmt_msgs = (
            select(ChatMessage)
            .where(ChatMessage.session_id.in_(sess_ids))
            .order_by(desc(ChatMessage.timestamp))
            .limit(60)
        )
        res_msgs = await db.execute(stmt_msgs)
        for m in res_msgs.scalars().all():
            bucket = chat_previews.setdefault(m.session_id, [])
            if len(bucket) < 3:
                bucket.append({
                    "sender": m.sender,
                    "direction": m.direction,
                    "text": (m.text or "")[:220],
                    "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                })

    # 5. Appointments
    stmt_app = _apply_tenant_filter(select(Appointment), Appointment, tenant_id)
    stmt_app = stmt_app.where(
        Appointment.customer_phone.ilike(f"%{search_token}%")
    ).order_by(desc(Appointment.appointment_time)).limit(15)
    res_app = await db.execute(stmt_app)
    appointments = res_app.scalars().all()

    # 6. Scheduled Callbacks
    cb_store_key = f"callback_tasks::{tenant_key}"
    all_callbacks = await _load_json_setting(db, cb_store_key, list)
    if not isinstance(all_callbacks, list):
        all_callbacks = []
    matching_callbacks = [
        cb for cb in all_callbacks
        if (norm10 and _normalize_phone_10(cb.get("customer_phone")) == norm10)
        or (raw_target and raw_target in str(cb.get("customer_phone") or ""))
    ]

    # Build Unified Timeline & Stats
    timeline: List[Dict[str, Any]] = []
    answered_count = 0
    missed_count = 0
    total_talk_sec = 0
    qa_scores: List[int] = []
    sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}

    for c in calls:
        st_str = str(c.status or "").lower()
        dur = int(c.talk_duration or 0)
        if dur <= 0 and c.answered_at and c.end_time:
            dur = max(0, int((c.end_time - c.answered_at).total_seconds()))
        is_missed = st_str in ("no_answer", "missed", "busy", "failed", "cancelled", "abandoned") or (st_str != "in_progress" and dur == 0 and not c.answered_at and not c.summary)
        if is_missed:
            missed_count += 1
        else:
            answered_count += 1
        total_talk_sec += dur
        if c.qa_score is not None:
            qa_scores.append(int(c.qa_score))

        sent_raw = str(c.sentiment or "").lower()
        if any(k in sent_raw for k in ("pozitif", "positive", "memnun", "iyi")):
            sentiment_counts["positive"] += 1
        elif any(k in sent_raw for k in ("negatif", "negative", "kızgın", "angry", "gergin")):
            sentiment_counts["negative"] += 1
        else:
            sentiment_counts["neutral"] += 1

        ts_iso = c.start_time.isoformat() if c.start_time else datetime.datetime.utcnow().isoformat()
        timeline.append({
            "id": f"call-{c.id}",
            "type": "call",
            "timestamp": ts_iso,
            "call_id": c.id,
            "caller_number": c.caller_number,
            "callee_number": c.callee_number,
            "status": c.status,
            "is_missed": is_missed,
            "talk_duration": dur,
            "has_recording": bool(c.recording_path),
            "summary": c.summary or "",
            "agent_topic": c.agent_topic or "",
            "agent_notes": c.agent_notes or "",
            "agent_name": c.agent_name or "",
            "sentiment": c.sentiment or "",
            "qa_score": c.qa_score,
        })

    for s in chat_sessions:
        ts_iso = s.last_message_time.isoformat() if s.last_message_time else datetime.datetime.utcnow().isoformat()
        msgs_rev = list(reversed(chat_previews.get(s.id, [])))
        timeline.append({
            "id": f"chat-{s.id}",
            "type": "chat",
            "timestamp": ts_iso,
            "session_id": s.id,
            "channel": s.channel,
            "status": s.status,
            "assigned_agent": s.assigned_agent,
            "assigned_user": s.assigned_user,
            "recipient_info": s.recipient_info,
            "qa_score": s.qa_score,
            "messages": msgs_rev,
        })

    for ap in appointments:
        ts_iso = ap.appointment_time.isoformat() if ap.appointment_time else datetime.datetime.utcnow().isoformat()
        timeline.append({
            "id": f"appt-{ap.id}",
            "type": "appointment",
            "timestamp": ts_iso,
            "appointment_id": ap.id,
            "customer_name": ap.customer_name,
            "status": ap.status,
            "notes": ap.notes or "",
        })

    for cb in matching_callbacks:
        timeline.append({
            "id": f"cb-{cb.get('id')}",
            "type": "callback",
            "timestamp": cb.get("scheduled_at") or cb.get("created_at") or datetime.datetime.utcnow().isoformat(),
            "callback_id": cb.get("id"),
            "scheduled_at": cb.get("scheduled_at"),
            "status": cb.get("status", "pending"),
            "assigned_user_name": cb.get("assigned_user_name") or "",
            "priority": cb.get("priority", "normal"),
            "note": cb.get("note") or "",
        })

    timeline.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)

    dominant_sentiment = "Nötr"
    if sentiment_counts["negative"] > sentiment_counts["positive"] and sentiment_counts["negative"] > 0:
        dominant_sentiment = "Negatif / Hassas"
    elif sentiment_counts["positive"] > 0 and sentiment_counts["positive"] >= sentiment_counts["negative"]:
        dominant_sentiment = "Pozitif"

    display_name = ""
    if matched_contact:
        display_name = f"{matched_contact.first_name or ''} {matched_contact.last_name or ''}".strip()
    elif appointments:
        display_name = appointments[0].customer_name or ""

    return {
        "phone": matched_contact.phone_number if matched_contact else raw_target,
        "normalized_phone": norm10,
        "display_name": display_name,
        "contact": {
            "exists": bool(matched_contact),
            "id": matched_contact.id if matched_contact else None,
            "first_name": matched_contact.first_name if matched_contact else "",
            "last_name": matched_contact.last_name if matched_contact else "",
            "phone_number": matched_contact.phone_number if matched_contact else raw_target,
            "email": matched_contact.email if matched_contact else (cust_meta.get("email") or ""),
        },
        "meta": {
            "vip": bool(cust_meta.get("vip", False)),
            "company": str(cust_meta.get("company") or ""),
            "tags": list(cust_meta.get("tags") or []),
            "sticky_note": str(cust_meta.get("sticky_note") or ""),
            "updated_at": cust_meta.get("updated_at"),
            "updated_by": cust_meta.get("updated_by"),
        },
        "stats": {
            "total_calls": len(calls),
            "answered_calls": answered_count,
            "missed_calls": missed_count,
            "total_talk_seconds": total_talk_sec,
            "avg_qa_score": round(sum(qa_scores) / len(qa_scores), 1) if qa_scores else None,
            "dominant_sentiment": dominant_sentiment,
            "chat_sessions_count": len(chat_sessions),
            "appointments_count": len(appointments),
            "pending_callbacks_count": sum(1 for c in matching_callbacks if c.get("status") == "pending"),
        },
        "timeline": timeline[:60],
    }


@router.post("/customer-360/meta")
async def save_customer_360_meta(
    payload: Customer360MetaUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    tenant_id = ctx["tenant_id"]
    tenant_key = ctx["tenant_key"]

    raw_phone = (payload.phone or "").strip()
    if not raw_phone:
        raise HTTPException(status_code=400, detail="Telefon numarası zorunludur.")

    norm10 = _normalize_phone_10(raw_phone)
    meta_lookup_key = norm10 or raw_phone

    meta_store_key = f"customer_360_meta::{tenant_key}"
    all_meta = await _load_json_setting(db, meta_store_key, dict)
    if not isinstance(all_meta, dict):
        all_meta = {}

    existing = dict(all_meta.get(meta_lookup_key) or {})
    if payload.vip is not None:
        existing["vip"] = bool(payload.vip)
    if payload.company is not None:
        existing["company"] = str(payload.company).strip()
    if payload.tags is not None:
        clean_tags = [str(t).strip() for t in payload.tags if str(t).strip()]
        existing["tags"] = clean_tags[:12]
    if payload.sticky_note is not None:
        existing["sticky_note"] = str(payload.sticky_note).strip()
    if payload.email is not None:
        existing["email"] = str(payload.email).strip()

    existing["updated_at"] = datetime.datetime.utcnow().isoformat()
    existing["updated_by"] = ctx["user_id"]
    all_meta[meta_lookup_key] = existing
    await _save_json_setting(db, meta_store_key, all_meta)

    # Optionally upsert Contact record if first_name provided
    if payload.first_name is not None and payload.first_name.strip():
        try:
            search_tok = norm10 if len(norm10) >= 7 else raw_phone
            stmt_c = _apply_tenant_filter(select(Contact), Contact, tenant_id).where(
                Contact.phone_number.ilike(f"%{search_tok}%")
            )
            res_c = await db.execute(stmt_c.limit(5))
            found_c = res_c.scalars().first()
            if found_c:
                found_c.first_name = payload.first_name.strip()
                if payload.last_name is not None:
                    found_c.last_name = payload.last_name.strip()
                if payload.email is not None and payload.email.strip():
                    found_c.email = payload.email.strip()
            else:
                new_contact_kwargs = {
                    "first_name": payload.first_name.strip(),
                    "last_name": (payload.last_name or "").strip(),
                    "phone_number": raw_phone,
                    "email": payload.email.strip() if (payload.email and payload.email.strip()) else None,
                }
                if hasattr(Contact, "tenant_id"):
                    new_contact_kwargs["tenant_id"] = tenant_key
                db.add(Contact(**new_contact_kwargs))
            await db.commit()
        except Exception:
            await db.rollback()

    return {"status": "ok", "meta": existing}


# ---------------------------------------------------------------------------
# 2. KAYIP ÇAĞRI SAHİPLENME & GERİ ARAMA PLANLAYICI (Callbacks & Claims)
# ---------------------------------------------------------------------------

@router.get("/missed-claims")
async def get_missed_call_claims(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    claim_key = f"missed_call_claims::{ctx['tenant_key']}"
    raw_claims = await _load_json_setting(db, claim_key, dict)
    if not isinstance(raw_claims, dict):
        raw_claims = {}

    now_utc = datetime.datetime.utcnow()
    cleaned: Dict[str, Any] = {}
    mutated = False
    for phone_k, item in raw_claims.items():
        if not isinstance(item, dict):
            mutated = True
            continue
        upd_str = item.get("updated_at")
        age_hours = 0.0
        if upd_str:
            try:
                dt = datetime.datetime.fromisoformat(str(upd_str).replace("Z", ""))
                age_hours = (now_utc - dt).total_seconds() / 3600.0
            except Exception:
                age_hours = 0.0
        # Active "claiming" locks auto-expire after 4 hours; resolved notes expire after 7 days
        if item.get("status") == "claiming" and age_hours > 4.0:
            mutated = True
            continue
        if age_hours > 168.0:
            mutated = True
            continue
        cleaned[phone_k] = item

    if mutated:
        await _save_json_setting(db, claim_key, cleaned)

    return {"claims": cleaned}


@router.post("/missed-claims")
async def set_missed_call_claim(
    payload: MissedCallClaimPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    norm = _normalize_phone_10(payload.caller_number) or payload.caller_number.strip()
    if not norm:
        raise HTTPException(status_code=400, detail="Geçerli numara gereklidir.")

    claim_key = f"missed_call_claims::{ctx['tenant_key']}"
    claims = dict(await _load_json_setting(db, claim_key, dict) or {})

    if payload.status == "clear":
        claims.pop(norm, None)
    else:
        prev = claims.get(norm) or {}
        claims[norm] = {
            "caller_number": payload.caller_number.strip(),
            "normalized_phone": norm,
            "status": payload.status,
            "agent_id": payload.agent_id or ctx["user_id"],
            "agent_name": payload.agent_name or prev.get("agent_name") or "Temsilci",
            "agent_ext": payload.agent_ext or ctx["extension"] or prev.get("agent_ext") or "",
            "note": payload.note if payload.note is not None else prev.get("note", ""),
            "updated_at": datetime.datetime.utcnow().isoformat(),
        }

    await _save_json_setting(db, claim_key, claims)
    return {"status": "ok", "claim": claims.get(norm)}


@router.get("/callbacks")
async def list_scheduled_callbacks(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    scope: str = Query("mine_or_team"),
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    cb_key = f"callback_tasks::{ctx['tenant_key']}"
    items = list(await _load_json_setting(db, cb_key, list) or [])

    role = ctx["role"]
    uid = str(ctx["user_id"] or "")
    ext = str(ctx["extension"] or "")
    is_privileged = role in ("admin", "supervisor", "superadmin", "manager", "sef") or uid == "admin"

    filtered: List[Dict[str, Any]] = []
    now_utc = datetime.datetime.utcnow()
    due_now: List[Dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        if status_filter and status_filter != "all" and item.get("status") != status_filter:
            continue

        assigned_uid = str(item.get("assigned_user_id") or "")
        assigned_ext = str(item.get("assigned_extension") or "")
        is_mine = (
            not assigned_uid
            or (uid and assigned_uid == uid)
            or (ext and assigned_ext == ext)
        )

        if scope == "mine" and not is_mine:
            continue
        if not is_privileged and scope != "all" and not is_mine:
            continue

        filtered.append(item)

        if item.get("status") == "pending" and is_mine:
            sched_str = str(item.get("scheduled_at") or "")
            if sched_str:
                try:
                    dt = datetime.datetime.fromisoformat(sched_str.replace("Z", ""))
                    diff_sec = (dt - now_utc).total_seconds()
                    # Due now or overdue within the last 12 hours
                    if -43200 <= diff_sec <= 60:
                        due_now.append(item)
                except Exception:
                    pass

    filtered.sort(key=lambda x: str(x.get("scheduled_at") or ""))
    return {"callbacks": filtered, "due_now": due_now}


@router.post("/callbacks")
async def create_scheduled_callback(
    payload: CallbackCreatePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    phone = (payload.customer_phone or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Müşteri telefon numarası zorunludur.")

    # Normalize scheduled_at to clean UTC naive ISO string if offset included
    sched_iso = (payload.scheduled_at or "").strip()
    if not sched_iso:
        raise HTTPException(status_code=400, detail="Geri arama tarihi ve saati zorunludur.")
    try:
        parsed_dt = datetime.datetime.fromisoformat(sched_iso.replace("Z", "+00:00"))
        if parsed_dt.tzinfo is not None:
            parsed_dt = parsed_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        sched_clean = parsed_dt.isoformat()
    except Exception:
        sched_clean = sched_iso

    cb_key = f"callback_tasks::{ctx['tenant_key']}"
    items = list(await _load_json_setting(db, cb_key, list) or [])

    new_task = {
        "id": f"cb_{uuid.uuid4().hex[:10]}",
        "customer_phone": phone,
        "customer_name": (payload.customer_name or "").strip(),
        "scheduled_at": sched_clean,
        "assigned_user_id": (payload.assigned_user_id or ctx["user_id"] or "").strip(),
        "assigned_user_name": (payload.assigned_user_name or "").strip(),
        "assigned_extension": (payload.assigned_extension or ctx["extension"] or "").strip(),
        "priority": payload.priority if payload.priority in ("normal", "high", "urgent") else "normal",
        "note": (payload.note or "").strip(),
        "status": "pending",
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    items.append(new_task)
    # Keep last 500 tasks max
    if len(items) > 500:
        items = items[-500:]
    await _save_json_setting(db, cb_key, items)

    # Also mark missed call claim as "scheduled"
    norm = _normalize_phone_10(phone) or phone
    claim_key = f"missed_call_claims::{ctx['tenant_key']}"
    claims = dict(await _load_json_setting(db, claim_key, dict) or {})
    claims[norm] = {
        "caller_number": phone,
        "normalized_phone": norm,
        "status": "scheduled",
        "agent_id": new_task["assigned_user_id"],
        "agent_name": new_task["assigned_user_name"] or "Temsilci",
        "agent_ext": new_task["assigned_extension"],
        "note": new_task["note"] or f"Planlandı: {sched_clean[:16].replace('T', ' ')}",
        "updated_at": datetime.datetime.utcnow().isoformat(),
    }
    await _save_json_setting(db, claim_key, claims)

    return {"status": "ok", "callback": new_task}


@router.patch("/callbacks/{task_id}")
async def update_scheduled_callback(
    task_id: str,
    payload: CallbackPatchPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    cb_key = f"callback_tasks::{ctx['tenant_key']}"
    items = list(await _load_json_setting(db, cb_key, list) or [])

    target = None
    for item in items:
        if isinstance(item, dict) and item.get("id") == task_id:
            target = item
            break

    if not target:
        raise HTTPException(status_code=404, detail="Geri arama görevi bulunamadı.")

    if payload.status:
        target["status"] = payload.status
        if payload.status == "completed":
            target["completed_at"] = datetime.datetime.utcnow().isoformat()
            # Also update missed claim to reached
            norm = _normalize_phone_10(target.get("customer_phone"))
            if norm:
                claim_key = f"missed_call_claims::{ctx['tenant_key']}"
                claims = dict(await _load_json_setting(db, claim_key, dict) or {})
                if norm in claims:
                    claims[norm]["status"] = "reached"
                    claims[norm]["updated_at"] = datetime.datetime.utcnow().isoformat()
                    await _save_json_setting(db, claim_key, claims)

    if payload.snooze_minutes and payload.snooze_minutes > 0:
        new_dt = datetime.datetime.utcnow() + datetime.timedelta(minutes=int(payload.snooze_minutes))
        target["scheduled_at"] = new_dt.isoformat()
        target["status"] = "pending"

    if payload.scheduled_at:
        try:
            parsed_dt = datetime.datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
            if parsed_dt.tzinfo is not None:
                parsed_dt = parsed_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
            target["scheduled_at"] = parsed_dt.isoformat()
        except Exception:
            target["scheduled_at"] = payload.scheduled_at

    if payload.note is not None:
        target["note"] = payload.note.strip()

    await _save_json_setting(db, cb_key, items)
    return {"status": "ok", "callback": target}


@router.delete("/callbacks/{task_id}")
async def delete_scheduled_callback(
    task_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    cb_key = f"callback_tasks::{ctx['tenant_key']}"
    items = list(await _load_json_setting(db, cb_key, list) or [])
    next_items = [it for it in items if isinstance(it, dict) and it.get("id") != task_id]
    if len(next_items) == len(items):
        raise HTTPException(status_code=404, detail="Geri arama görevi bulunamadı.")
    await _save_json_setting(db, cb_key, next_items)
    return {"status": "ok", "deleted_id": task_id}


# ---------------------------------------------------------------------------
# 3. CANLI KRİZ / NEGATİF DUYGU ALARMI (Live Crisis & Negative Sentiment Radar)
# ---------------------------------------------------------------------------

async def _compute_crisis_alerts_internal(db: AsyncSession, tenant_id: str) -> List[Dict[str, Any]]:
    now_utc = datetime.datetime.utcnow()
    cutoff_utc = now_utc - datetime.timedelta(minutes=90)

    stmt_active = _apply_tenant_filter(select(Call), Call, tenant_id).where(
        Call.status == "in_progress",
        Call.start_time >= cutoff_utc,
    )
    res_active = await db.execute(stmt_active)
    active_calls = res_active.scalars().all()
    if not active_calls:
        return []

    call_ids = [c.id for c in active_calls]
    stmt_tr = (
        select(Transcript)
        .where(Transcript.call_id.in_(call_ids))
        .order_by(desc(Transcript.timestamp))
        .limit(120)
    )
    res_tr = await db.execute(stmt_tr)
    by_call: Dict[str, List[Transcript]] = {}
    for tr in res_tr.scalars().all():
        bucket = by_call.setdefault(tr.call_id, [])
        if len(bucket) < 10:
            bucket.append(tr)

    # Resolve contact names in bulk
    stmt_contacts = _apply_tenant_filter(select(Contact), Contact, tenant_id).limit(500)
    res_contacts = await db.execute(stmt_contacts)
    contact_map = {
        _normalize_phone_10(c.phone_number): f"{c.first_name or ''} {c.last_name or ''}".strip()
        for c in res_contacts.scalars().all()
        if c.phone_number
    }

    alerts: List[Dict[str, Any]] = []
    for call in active_calls:
        utts = by_call.get(call.id, [])
        matched_crit: List[str] = []
        matched_warn: List[str] = []
        latest_customer_text = ""

        for t in utts:
            spk = str(t.speaker or "").lower()
            txt_raw = (t.text or "").strip()
            txt_low = txt_raw.lower()
            is_cust = spk not in ("ai", "agent", "supervisor_whisper", "system")
            if is_cust and not latest_customer_text and txt_raw:
                latest_customer_text = txt_raw
            if is_cust:
                for kw in CRISIS_CRITICAL_KEYWORDS:
                    if kw in txt_low and kw not in matched_crit:
                        matched_crit.append(kw)
                for kw in CRISIS_WARNING_KEYWORDS:
                    if kw in txt_low and kw not in matched_warn:
                        matched_warn.append(kw)

        sent_low = str(call.sentiment or "").lower()
        explicit_neg = any(w in sent_low for w in ("negatif", "negative", "kızgın", "angry", "kriz", "gergin"))

        score = len(matched_crit) * 3 + len(matched_warn) * 1 + (2 if explicit_neg else 0)
        if score <= 0:
            continue

        severity = "critical" if (matched_crit or score >= 3) else "warning"
        dur_sec = max(0, int((now_utc - call.start_time.replace(tzinfo=None)).total_seconds())) if call.start_time else 0
        norm_caller = _normalize_phone_10(call.caller_number)
        caller_name = contact_map.get(norm_caller, "")

        alerts.append({
            "call_id": call.id,
            "caller_number": call.caller_number,
            "caller_name": caller_name,
            "callee_number": call.callee_number,
            "agent_name": call.agent_name or "Yapay Zeka / Kuyruk",
            "severity": severity,
            "score": score,
            "matched_keywords": (matched_crit + matched_warn)[:5],
            "latest_customer_text": latest_customer_text[:200],
            "duration_sec": dur_sec,
            "started_at": call.start_time.isoformat() if call.start_time else now_utc.isoformat(),
        })

    alerts.sort(key=lambda a: (0 if a["severity"] == "critical" else 1, -a["score"]))
    return alerts


@router.get("/crisis-alerts")
async def get_live_crisis_alerts(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    alerts = await _compute_crisis_alerts_internal(db, ctx["tenant_id"])
    return {"alerts": alerts, "count": len(alerts)}


# ---------------------------------------------------------------------------
# 4. UYGULAMA İÇİ CANLI BİLDİRİM MERKEZİ (In-App Notification Bell)
# ---------------------------------------------------------------------------

@router.get("/notifications")
async def get_in_app_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    tenant_id = ctx["tenant_id"]
    tenant_key = ctx["tenant_key"]
    uid = str(ctx["user_id"] or "admin")
    ext = str(ctx["extension"] or "")
    role = ctx["role"]
    is_privileged = role in ("admin", "supervisor", "superadmin", "manager", "sef") or uid == "admin"

    now_utc = datetime.datetime.utcnow()

    # Load user's read notification IDs
    read_store_key = f"user_notif_reads::{tenant_key}"
    all_reads = await _load_json_setting(db, read_store_key, dict)
    if not isinstance(all_reads, dict):
        all_reads = {}
    user_read_ids = set(all_reads.get(uid) or [])

    notifications: List[Dict[str, Any]] = []

    # A) Live Crisis Alerts (for privileged / supervisor roles)
    if is_privileged:
        crisis_list = await _compute_crisis_alerts_internal(db, tenant_id)
        for cr in crisis_list:
            nid = f"crisis::{cr['call_id']}"
            if nid in user_read_ids:
                continue
            kw_str = ", ".join(cr["matched_keywords"][:3]) if cr["matched_keywords"] else "Negatif ses/duygu"
            notifications.append({
                "id": nid,
                "category": "crisis",
                "severity": "critical" if cr["severity"] == "critical" else "warning",
                "title": f"Canlı Kriz Alarmı: {cr['caller_name'] or cr['caller_number']}",
                "body": cr["latest_customer_text"] or f"Tespit edilen: {kw_str}",
                "timestamp": cr["started_at"],
                "unread": True,
                "target_tab": "dashboard",
                "phone": cr["caller_number"],
                "call_id": cr["call_id"],
            })

    # B) Scheduled Callbacks (Due now or within 30 mins)
    cb_key = f"callback_tasks::{tenant_key}"
    cb_items = list(await _load_json_setting(db, cb_key, list) or [])
    due_popup_tasks: List[Dict[str, Any]] = []
    for cb in cb_items:
        if not isinstance(cb, dict) or cb.get("status") != "pending":
            continue
        assigned_uid = str(cb.get("assigned_user_id") or "")
        assigned_ext = str(cb.get("assigned_extension") or "")
        is_mine = not assigned_uid or assigned_uid == uid or (ext and assigned_ext == ext)
        if not is_mine and not is_privileged:
            continue
        sched_str = str(cb.get("scheduled_at") or "")
        if not sched_str:
            continue
        try:
            dt = datetime.datetime.fromisoformat(sched_str.replace("Z", ""))
            diff_min = (dt - now_utc).total_seconds() / 60.0
        except Exception:
            continue

        if -720 <= diff_min <= 30:
            nid = f"cb::{cb.get('id')}::{sched_str[:16]}"
            is_due_now = diff_min <= 1.0
            if is_due_now and is_mine and nid not in user_read_ids:
                due_popup_tasks.append(cb)
            if nid in user_read_ids:
                continue
            label_prefix = "Geri Arama Zamanı Geldi!" if is_due_now else f"{max(1, int(round(diff_min)))} dk sonra Geri Arama"
            notifications.append({
                "id": nid,
                "category": "callback",
                "severity": "critical" if is_due_now else "warning",
                "title": f"{label_prefix} — {cb.get('customer_name') or cb.get('customer_phone')}",
                "body": cb.get("note") or f"Numara: {cb.get('customer_phone')}",
                "timestamp": sched_str,
                "unread": True,
                "target_tab": "call-center",
                "target_subtab": "missed",
                "phone": cb.get("customer_phone"),
                "callback_id": cb.get("id"),
            })

    # C) Active Omnichannel Chats Waiting for Human Representative
    stmt_chat = _apply_tenant_filter(select(ChatSession), ChatSession, tenant_id).where(
        ChatSession.status == "active",
        ChatSession.assigned_agent == "human",
    ).order_by(desc(ChatSession.last_message_time)).limit(8)
    res_chat = await db.execute(stmt_chat)
    for cs in res_chat.scalars().all():
        ts_iso = cs.last_message_time.isoformat() if cs.last_message_time else now_utc.isoformat()
        nid = f"chat::{cs.id}::{ts_iso[:16]}"
        if nid in user_read_ids:
            continue
        ch_label = str(cs.channel or "mesaj").upper()
        notifications.append({
            "id": nid,
            "category": "message",
            "severity": "info",
            "title": f"{ch_label} Canlı Temsilci Bekliyor",
            "body": f"Müşteri: {cs.sender_info}",
            "timestamp": ts_iso,
            "unread": True,
            "target_tab": "omnichannel",
            "phone": cs.sender_info,
        })

    # D) Upcoming Appointments (within next 60 mins)
    appt_window_start = now_utc - datetime.timedelta(minutes=15)
    appt_window_end = now_utc + datetime.timedelta(minutes=60)
    stmt_ap = _apply_tenant_filter(select(Appointment), Appointment, tenant_id).where(
        Appointment.status == "confirmed",
        Appointment.appointment_time >= appt_window_start,
        Appointment.appointment_time <= appt_window_end,
    ).order_by(Appointment.appointment_time).limit(6)
    res_ap = await db.execute(stmt_ap)
    for ap in res_ap.scalars().all():
        ts_iso = ap.appointment_time.isoformat() if ap.appointment_time else now_utc.isoformat()
        nid = f"appt::{ap.id}"
        if nid in user_read_ids:
            continue
        notifications.append({
            "id": nid,
            "category": "appointment",
            "severity": "info",
            "title": f"Yaklaşan Randevu: {ap.customer_name}",
            "body": f"Tel: {ap.customer_phone}" + (f" • {ap.notes}" if ap.notes else ""),
            "timestamp": ts_iso,
            "unread": True,
            "target_tab": "appointments",
            "phone": ap.customer_phone,
        })

    # E) Recent Unclaimed Missed Calls (last 6 hours)
    claim_key = f"missed_call_claims::{tenant_key}"
    claims_map = dict(await _load_json_setting(db, claim_key, dict) or {})
    missed_cutoff = now_utc - datetime.timedelta(hours=6)
    stmt_missed = _apply_tenant_filter(select(Call), Call, tenant_id).where(
        Call.start_time >= missed_cutoff,
        Call.status.in_(["no_answer", "missed", "busy", "failed", "cancelled", "abandoned"]),
    ).order_by(desc(Call.start_time)).limit(10)
    res_missed = await db.execute(stmt_missed)
    seen_missed_phones = set()
    for mc in res_missed.scalars().all():
        norm_p = _normalize_phone_10(mc.caller_number) or mc.caller_number
        if norm_p in seen_missed_phones:
            continue
        claim_entry = claims_map.get(norm_p)
        if claim_entry and claim_entry.get("status") in ("reached", "scheduled"):
            continue
        seen_missed_phones.add(norm_p)
        ts_iso = mc.start_time.isoformat() if mc.start_time else now_utc.isoformat()
        nid = f"missed::{mc.id}"
        if nid in user_read_ids:
            continue
        notifications.append({
            "id": nid,
            "category": "call",
            "severity": "warning",
            "title": f"Geri Dönüş Bekleyen Cevapsız Çağrı",
            "body": f"Arayan: {mc.caller_number}" + (f" ({claim_entry.get('agent_name')} inceliyor)" if claim_entry else ""),
            "timestamp": ts_iso,
            "unread": True,
            "target_tab": "call-center",
            "target_subtab": "missed",
            "phone": mc.caller_number,
        })
        if len(seen_missed_phones) >= 5:
            break

    # F) System Critical Events for Admins (last 12 hours)
    if is_privileged:
        ev_cutoff = now_utc - datetime.timedelta(hours=12)
        stmt_ev = (
            select(EventLog)
            .where(
                EventLog.timestamp >= ev_cutoff,
                EventLog.action.in_(["TRUNK_DISCONNECTED", "LICENSE_WARNING", "SERVICE_ERROR", "PROCESS_ERROR"]),
            )
            .order_by(desc(EventLog.timestamp))
            .limit(5)
        )
        res_ev = await db.execute(stmt_ev)
        for ev in res_ev.scalars().all():
            ts_iso = ev.timestamp.isoformat() if ev.timestamp else now_utc.isoformat()
            nid = f"sys::{ev.id}"
            if nid in user_read_ids:
                continue
            notifications.append({
                "id": nid,
                "category": "system",
                "severity": "critical",
                "title": f"Sistem Uyarısı: {ev.action}",
                "body": (ev.details or ev.module or "")[:160],
                "timestamp": ts_iso,
                "unread": True,
                "target_tab": "settings",
            })

    # Sort: unread & critical first, then timestamp desc
    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    notifications.sort(
        key=lambda n: (
            0 if n.get("unread") else 1,
            sev_rank.get(n.get("severity"), 2),
        )
    )

    unread_count = sum(1 for n in notifications if n.get("unread"))
    return {
        "notifications": notifications[:40],
        "unread_count": unread_count,
        "due_callbacks": due_popup_tasks[:3],
    }


@router.post("/notifications/read")
async def mark_notifications_read(
    payload: NotificationReadPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    uid = str(ctx["user_id"] or "admin")
    read_store_key = f"user_notif_reads::{ctx['tenant_key']}"
    all_reads = dict(await _load_json_setting(db, read_store_key, dict) or {})
    current_list = list(all_reads.get(uid) or [])
    current_set = set(current_list)

    if payload.ids:
        for i in payload.ids:
            if i and i not in current_set:
                current_list.append(i)
                current_set.add(i)

    # Cap stored read IDs per user at 300 to stay compact
    if len(current_list) > 300:
        current_list = current_list[-300:]

    all_reads[uid] = current_list
    await _save_json_setting(db, read_store_key, all_reads)
    return {"status": "ok", "read_count": len(current_list)}


# ---------------------------------------------------------------------------
# 5. ÖZELLEŞTİRİLEBİLİR ÖZET EKRANI VERİ PAKETİ (Dashboard Widgets Summary)
# ---------------------------------------------------------------------------

@router.get("/dashboard-widgets-summary")
async def get_dashboard_widgets_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ctx = _extract_ctx(request)
    tenant_id = ctx["tenant_id"]
    tenant_key = ctx["tenant_key"]

    # Turkey UTC+3 start of today
    now_utc = datetime.datetime.utcnow()
    tr_now = now_utc + datetime.timedelta(hours=3)
    tr_midnight = tr_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = tr_midnight - datetime.timedelta(hours=3)

    # 1. Today's Call Breakdown & Top Callers
    stmt_today_calls = _apply_tenant_filter(select(Call), Call, tenant_id).where(
        Call.start_time >= today_start_utc
    ).order_by(desc(Call.start_time)).limit(250)
    res_tc = await db.execute(stmt_today_calls)
    today_calls = res_tc.scalars().all()

    caller_freq: Dict[str, int] = {}
    missed_today = 0
    ai_handled_today = 0
    for c in today_calls:
        st_str = str(c.status or "").lower()
        if st_str in ("no_answer", "missed", "busy", "failed", "cancelled", "abandoned"):
            missed_today += 1
        ag = str(c.agent_name or "").lower()
        if not ag or "ai" in ag or "asistan" in ag or "bot" in ag:
            ai_handled_today += 1
        cn = str(c.caller_number or "").strip()
        if cn and cn != "s":
            caller_freq[cn] = caller_freq.get(cn, 0) + 1

    top_callers = [
        {"caller_number": num, "count": cnt}
        for num, cnt in sorted(caller_freq.items(), key=lambda kv: kv[1], reverse=True)[:5]
    ]

    # 2. Queues Summary
    stmt_q = _apply_tenant_filter(select(PBXQueue), PBXQueue, tenant_id).limit(12)
    res_q = await db.execute(stmt_q)
    queues_summary = []
    for q in res_q.scalars().all():
        members = q.members if isinstance(q.members, list) else []
        queues_summary.append({
            "id": q.id,
            "name": q.name,
            "extension": q.extension,
            "strategy": q.strategy,
            "member_count": len(members),
        })

    # 3. Today's Appointments
    tomorrow_start_utc = today_start_utc + datetime.timedelta(days=1)
    stmt_ap = _apply_tenant_filter(select(Appointment), Appointment, tenant_id).where(
        Appointment.appointment_time >= today_start_utc,
        Appointment.appointment_time < tomorrow_start_utc,
    ).order_by(Appointment.appointment_time).limit(8)
    res_ap = await db.execute(stmt_ap)
    today_appointments = [
        {
            "id": a.id,
            "customer_name": a.customer_name,
            "customer_phone": a.customer_phone,
            "appointment_time": a.appointment_time.isoformat() if a.appointment_time else None,
            "status": a.status,
            "notes": a.notes or "",
        }
        for a in res_ap.scalars().all()
    ]

    # 4. Pending Callbacks count & next 5
    cb_key = f"callback_tasks::{tenant_key}"
    cb_items = list(await _load_json_setting(db, cb_key, list) or [])
    pending_cbs = [
        c for c in cb_items
        if isinstance(c, dict) and c.get("status") == "pending"
    ]
    pending_cbs.sort(key=lambda x: str(x.get("scheduled_at") or ""))

    return {
        "today_stats": {
            "total_calls": len(today_calls),
            "missed_calls": missed_today,
            "ai_handled_calls": ai_handled_today,
            "answered_rate": round(((len(today_calls) - missed_today) / len(today_calls)) * 100, 1) if today_calls else 100.0,
        },
        "top_callers_today": top_callers,
        "queues_summary": queues_summary,
        "today_appointments": today_appointments,
        "upcoming_callbacks": pending_cbs[:6],
        "pending_callbacks_total": len(pending_cbs),
    }
