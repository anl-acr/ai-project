"""
Nornia Enterprise Hotel & PMS FastAPI Router.
Covers Room Board, Check-In/Check-Out, Housekeeping, AI Multilingual Wake-Up Calls,
Call Accounting/Folio, Asterisk Dialplan Feature Codes (*55, *56, *71-*74),
ElektraWeb Webhook, FIAS TCP Status, and Open PMS REST API.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from backend.services.hotel_pms_service import (
    FIAS_RUNTIME_STATE,
    cancel_hotel_wakeup,
    execute_hotel_wakeup_call,
    get_hotel_pms_config,
    get_room_folio_summary,
    hotel_checkin_room,
    hotel_checkout_room,
    hotel_set_housekeeping_status,
    list_hotel_pms_events,
    list_hotel_rooms,
    list_hotel_wakeups,
    record_hotel_call_charge,
    restart_fias_bridge,
    save_hotel_pms_config,
    schedule_hotel_wakeup,
    upsert_hotel_room,
    delete_hotel_room,
)
from backend.database.config import AsyncSessionLocal
from backend.database.models import HotelCallCharge, HotelRoom
from sqlalchemy import select, or_

router = APIRouter(tags=["Hotel & PMS"])


def _extract_tenant(request: Request) -> str:
    auth_u = getattr(request.state, "auth_user", None)
    if isinstance(auth_u, dict) and auth_u.get("tid"):
        return str(auth_u["tid"])
    return (
        request.headers.get("X-Tenant-ID")
        or request.headers.get("Tenant-ID")
        or request.query_params.get("tenant_id")
        or "tenant-default"
    )


def _verify_pms_api_key(request: Request, tenant_id: str):
    """Allows either authenticated panel session OR valid X-PMS-API-Key header for external PMS webhooks."""
    if getattr(request.state, "auth_user", None):
        return True
    cfg = get_hotel_pms_config(tenant_id)
    expected = str(cfg.get("open_api_key") or "").strip()
    elektra_sec = str((cfg.get("elektra") or {}).get("webhook_secret") or "").strip()
    provided = (
        request.headers.get("X-PMS-API-Key")
        or request.headers.get("X-Elektra-Secret")
        or request.query_params.get("api_key")
        or ""
    ).strip()
    if provided and provided in {k for k in (expected, elektra_sec) if k}:
        return True
    raise HTTPException(status_code=401, detail="Geçersiz PMS API anahtarı (X-PMS-API-Key).")


class HotelRoomSchema(BaseModel):
    id: Optional[int] = None
    room_number: str
    extension: Optional[str] = None
    floor: str = "1"
    building: str = "Ana Bina"
    room_type: str = "standard"
    housekeeping_status: Optional[str] = "clean"
    family_group: Optional[str] = ""
    dnd_enabled: Optional[bool] = False
    outbound_allowed: Optional[bool] = False
    notes: Optional[str] = ""


class HotelCheckinSchema(BaseModel):
    guest_name: str
    guest_language: str = "tr"
    guest_vip: bool = False
    reservation_code: Optional[str] = ""
    family_group: Optional[str] = ""
    outbound_allowed: bool = True


class HotelHousekeepingSchema(BaseModel):
    status: str  # clean | dirty | maintenance | inspected | 71 | 72 | 73 | 74


class HotelWakeupSchema(BaseModel):
    room_number: str
    scheduled_time: str  # HH:MM or HHMM
    scheduled_date: str = "daily"
    language: Optional[str] = None
    custom_message: Optional[str] = ""


class HotelManualChargeSchema(BaseModel):
    room_number: str
    description: str
    category: str = "minibar"
    amount: float


@router.get("/api/hotel/config")
async def api_get_hotel_config(request: Request):
    tid = _extract_tenant(request)
    cfg = get_hotel_pms_config(tid)
    return {**cfg, "fias_runtime": FIAS_RUNTIME_STATE}


@router.post("/api/hotel/config")
async def api_save_hotel_config(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    saved = save_hotel_pms_config(payload, tenant_id=tid)
    await restart_fias_bridge(tenant_id=tid)
    return {"status": "success", "config": saved, "fias_runtime": FIAS_RUNTIME_STATE, "message": "Otel & PMS ayarları kaydedildi."}


@router.get("/api/hotel/rooms")
async def api_list_hotel_rooms(request: Request):
    return await list_hotel_rooms(tenant_id=_extract_tenant(request))


@router.post("/api/hotel/rooms")
async def api_upsert_hotel_room(request: Request, payload: HotelRoomSchema):
    try:
        room = await upsert_hotel_room(payload.model_dump(), tenant_id=_extract_tenant(request))
        return {"status": "success", "room": room}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.delete("/api/hotel/rooms/{room_id}")
async def api_delete_hotel_room(request: Request, room_id: int):
    ok = await delete_hotel_room(room_id, tenant_id=_extract_tenant(request))
    if not ok:
        raise HTTPException(status_code=404, detail="Oda bulunamadı.")
    return {"status": "success"}


@router.post("/api/hotel/rooms/{room_number}/checkin")
async def api_hotel_checkin(request: Request, room_number: str, payload: HotelCheckinSchema):
    room = await hotel_checkin_room(
        room_number=room_number,
        guest_name=payload.guest_name,
        tenant_id=_extract_tenant(request),
        guest_language=payload.guest_language,
        guest_vip=payload.guest_vip,
        reservation_code=payload.reservation_code or "",
        family_group=payload.family_group or "",
        outbound_allowed=payload.outbound_allowed,
        source="panel",
    )
    return {"status": "success", "room": room, "message": f"Oda {room['room_number']} Check-In tamamlandı."}


@router.post("/api/hotel/rooms/{room_number}/checkout")
async def api_hotel_checkout(request: Request, room_number: str):
    try:
        res = await hotel_checkout_room(room_number=room_number, tenant_id=_extract_tenant(request), source="panel")
        return {"status": "success", **res, "message": f"Oda {room_number} Check-Out tamamlandı."}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.post("/api/hotel/rooms/{room_number}/housekeeping")
async def api_hotel_housekeeping(request: Request, room_number: str, payload: HotelHousekeepingSchema):
    try:
        room = await hotel_set_housekeeping_status(
            room_or_ext=room_number,
            status_or_code=payload.status,
            tenant_id=_extract_tenant(request),
            source="panel",
        )
        return {"status": "success", "room": room}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/api/hotel/rooms/{room_number}/folio")
async def api_hotel_folio(request: Request, room_number: str, unpaid_only: bool = False):
    return await get_room_folio_summary(room_number, tenant_id=_extract_tenant(request), unpaid_only=unpaid_only)


@router.post("/api/hotel/charges/manual")
async def api_hotel_manual_charge(request: Request, payload: HotelManualChargeSchema):
    tid = _extract_tenant(request)
    cfg = get_hotel_pms_config(tid)
    currency = (cfg.get("tariffs") or {}).get("currency", "TRY")
    async with AsyncSessionLocal() as db:
        q = await db.execute(select(HotelRoom).where(HotelRoom.room_number == str(payload.room_number).strip()))
        room = q.scalar_one_or_none()
        charge = HotelCallCharge(
            tenant_id=tid,
            room_number=str(payload.room_number).strip(),
            extension=room.extension if room else str(payload.room_number).strip(),
            reservation_code=room.reservation_code if room else None,
            guest_name=room.guest_name if room else None,
            called_number=payload.description[:120],
            call_category=payload.category or "minibar",
            duration_seconds=0,
            billable_minutes=0,
            rate_per_min=float(payload.amount),
            total_cost=round(float(payload.amount), 2),
            currency=currency,
            posted_to_pms=False,
        )
        db.add(charge)
        await db.commit()
    return {"status": "success", "message": f"Oda {payload.room_number} hesabına {payload.amount} {currency} işlendi."}


@router.get("/api/hotel/wakeups")
async def api_list_hotel_wakeups(request: Request):
    return await list_hotel_wakeups(tenant_id=_extract_tenant(request))


@router.post("/api/hotel/wakeups")
async def api_create_hotel_wakeup(request: Request, payload: HotelWakeupSchema):
    try:
        wk = await schedule_hotel_wakeup(
            room_or_ext=payload.room_number,
            scheduled_time=payload.scheduled_time,
            scheduled_date=payload.scheduled_date,
            language=payload.language,
            custom_message=payload.custom_message or "",
            created_by="reception",
            tenant_id=_extract_tenant(request),
        )
        return {"status": "success", "wakeup": wk}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.delete("/api/hotel/wakeups/{wakeup_id}")
async def api_cancel_hotel_wakeup(wakeup_id: int):
    ok = await cancel_hotel_wakeup(wakeup_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Uyandırma kaydı bulunamadı.")
    return {"status": "success"}


@router.post("/api/hotel/wakeups/{wakeup_id}/trigger")
async def api_trigger_hotel_wakeup_now(wakeup_id: int):
    res = await execute_hotel_wakeup_call(wakeup_id)
    return {"status": "success", "wakeup": res}


@router.get("/api/hotel/events")
async def api_list_hotel_events(request: Request, limit: int = 40):
    return await list_hotel_pms_events(tenant_id=_extract_tenant(request), limit=limit)


@router.get("/api/hotel/fias/status")
async def api_fias_status():
    return FIAS_RUNTIME_STATE


# ==============================================================================
# ASTERISK LOOPBACK DIALPLAN HOOKS (*71-*74 Housekeeping, *55/*56 Wake-Up)
# ==============================================================================
@router.get("/api/hotel/dialplan/housekeeping", response_class=PlainTextResponse)
async def api_dialplan_housekeeping(ext: str = "", code: str = "71"):
    try:
        await hotel_set_housekeeping_status(ext, code, source="phone")
        return "OK"
    except Exception:
        return "ERR"


@router.get("/api/hotel/dialplan/wakeup", response_class=PlainTextResponse)
async def api_dialplan_wakeup(ext: str = "", time: str = ""):
    try:
        await schedule_hotel_wakeup(ext, time, scheduled_date="daily", created_by="phone")
        return "OK"
    except Exception:
        return "ERR"


@router.get("/api/hotel/dialplan/wakeup-cancel", response_class=PlainTextResponse)
async def api_dialplan_wakeup_cancel(ext: str = ""):
    try:
        async with AsyncSessionLocal() as db:
            from backend.database.models import HotelWakeupCall
            q = await db.execute(
                select(HotelWakeupCall).where(
                    or_(HotelWakeupCall.extension == str(ext), HotelWakeupCall.room_number == str(ext)),
                    HotelWakeupCall.status.in_(["scheduled", "retry_pending"]),
                )
            )
            for wk in q.scalars().all():
                wk.status = "cancelled"
            await db.commit()
        return "OK"
    except Exception:
        return "ERR"


# ==============================================================================
# EXTERNAL OPEN PMS & ELEKTRAWEB REST API
# ==============================================================================
@router.post("/api/pms/checkin")
async def api_open_pms_checkin(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    room_no = str(payload.get("room_number") or payload.get("room") or "").strip()
    if not room_no:
        raise HTTPException(status_code=400, detail="room_number zorunludur.")
    room = await hotel_checkin_room(
        room_number=room_no,
        guest_name=str(payload.get("guest_name") or f"Misafir {room_no}"),
        tenant_id=tid,
        guest_language=str(payload.get("guest_language") or payload.get("language") or "tr"),
        guest_vip=bool(payload.get("guest_vip") or payload.get("vip")),
        reservation_code=str(payload.get("reservation_code") or payload.get("res_id") or ""),
        family_group=str(payload.get("family_group") or ""),
        outbound_allowed=bool(payload.get("outbound_allowed", True)),
        source="api",
    )
    return {"status": "success", "room": room}


@router.post("/api/pms/checkout")
async def api_open_pms_checkout(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    room_no = str(payload.get("room_number") or payload.get("room") or "").strip()
    if not room_no:
        raise HTTPException(status_code=400, detail="room_number zorunludur.")
    res = await hotel_checkout_room(room_number=room_no, tenant_id=tid, source="api")
    return {"status": "success", **res}


@router.post("/api/pms/housekeeping")
async def api_open_pms_housekeeping(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    room_no = str(payload.get("room_number") or payload.get("room") or "").strip()
    st = str(payload.get("status") or "clean").strip()
    room = await hotel_set_housekeeping_status(room_no, st, tenant_id=tid, source="api")
    return {"status": "success", "room": room}


@router.post("/api/pms/wakeup")
async def api_open_pms_wakeup(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    wk = await schedule_hotel_wakeup(
        room_or_ext=str(payload.get("room_number") or payload.get("room") or ""),
        scheduled_time=str(payload.get("time") or payload.get("scheduled_time") or ""),
        scheduled_date=str(payload.get("date") or payload.get("scheduled_date") or "daily"),
        language=payload.get("language"),
        created_by="api",
        tenant_id=tid,
    )
    return {"status": "success", "wakeup": wk}


@router.get("/api/pms/folio/{room_number}")
async def api_open_pms_folio(request: Request, room_number: str):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    return await get_room_folio_summary(room_number, tenant_id=tid)


@router.post("/api/pms/elektra/webhook")
async def api_elektra_webhook(request: Request, payload: Dict[str, Any]):
    tid = _extract_tenant(request)
    _verify_pms_api_key(request, tid)
    ev = str(payload.get("event") or payload.get("type") or "").strip().lower()
    room_no = str(payload.get("room_number") or payload.get("roomNo") or payload.get("room") or "").strip()
    if not room_no:
        return {"status": "ignored", "reason": "missing_room_number"}

    if ev in ("checkin", "check_in", "guest_in"):
        room = await hotel_checkin_room(
            room_number=room_no,
            guest_name=str(payload.get("guest_name") or payload.get("guestName") or f"Misafir {room_no}"),
            tenant_id=tid,
            guest_language=str(payload.get("language") or payload.get("nationality") or "tr"),
            guest_vip=bool(payload.get("vip")),
            reservation_code=str(payload.get("reservation_id") or payload.get("resId") or ""),
            source="elektra",
        )
        return {"status": "success", "action": "checkin", "room": room}
    if ev in ("checkout", "check_out", "guest_out"):
        res = await hotel_checkout_room(room_number=room_no, tenant_id=tid, source="elektra")
        return {"status": "success", "action": "checkout", **res}
    if ev in ("housekeeping", "room_status"):
        st = str(payload.get("status") or payload.get("roomStatus") or "clean")
        room = await hotel_set_housekeeping_status(room_no, st, tenant_id=tid, source="elektra")
        return {"status": "success", "action": "housekeeping", "room": room}
    return {"status": "ignored", "event": ev}
