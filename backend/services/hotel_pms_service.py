"""
Nornia Enterprise Hotel & PMS (Property Management System) Engine.
Provides:
  - Room Extension Management (Floor, Building, VIP, Family Group, Occupancy, Housekeeping, DND, Outbound Lock)
  - 1-Click & PMS-driven Check-In / Check-Out (Outbound ACL lock, Voicemail purge, Wake-Up cancel, Folio calculation)
  - Housekeeping Dialplan Codes (*71 Clean, *72 Dirty, *73 Maintenance, *74 Inspected)
  - Multilingual AI Wake-Up Call Scheduler (*55 / Reception) with retry & missed-call Reception Red Alarm
  - Room-to-Room Restriction & Call Accounting (Tariffs + Minibar + Folio)
  - PMS Bridges: ElektraWeb REST API, FIAS TCP/IP Protocol (Oracle OPERA / Protel / Fidelio), Open PMS REST API
"""

import asyncio
import datetime
import glob
import math
import os
import re
import secrets
import subprocess
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy import select, desc, or_

from backend.database.config import AsyncSessionLocal
from backend.database.models import (
    HotelRoom,
    HotelWakeupCall,
    HotelCallCharge,
    HotelPmsEventLog,
)


DEFAULT_HOTEL_PMS_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "hotel_name": "Nornia Grand Hotel",
    "reception_extension": "1000",
    "emergency_numbers": ["112", "110", "155", "156", "911"],
    "block_room_to_room": True,
    "auto_lock_outbound_on_checkout": True,
    "auto_clear_voicemail_on_checkout": True,
    "wakeup_retry_minutes": 5,
    "wakeup_max_retries": 2,
    "wakeup_use_ai_tts": True,
    "tariffs": {
        "currency": "TRY",
        "local_per_min": 2.5,
        "gsm_per_min": 5.0,
        "international_per_min": 18.0,
    },
    "pms_provider": "standalone",  # standalone | elektra | fias | open_api
    "elektra": {
        "enabled": False,
        "api_url": "https://api.elektraweb.com",
        "hotel_id": "",
        "api_key": "",
        "webhook_secret": "",
    },
    "fias": {
        "enabled": False,
        "mode": "server",  # server | client
        "host": "0.0.0.0",
        "port": 5008,
        "remote_host": "",
        "remote_port": 5008,
    },
    "open_api_key": "",
}

HOUSEKEEPING_CODE_MAP = {
    "71": ("clean", "Temiz (Hazır)"),
    "72": ("dirty", "Kirli (Temizlik Bekliyor)"),
    "73": ("maintenance", "Arıza / Bakım Gerekli"),
    "74": ("inspected", "Kontrol Edildi (Onaylı)"),
}

HOUSEKEEPING_TO_FIAS_RS = {
    "dirty": "1",
    "clean": "2",
    "inspected": "4",
    "maintenance": "5",
}

FIAS_RS_TO_HOUSEKEEPING = {
    "1": "dirty",
    "2": "clean",
    "3": "clean",
    "4": "inspected",
    "5": "maintenance",
    "6": "maintenance",
}

WAKEUP_VOICE_MAP = {
    "tr": ("tr-TR-EmelNeural", "Günaydın {guest}. Saat {time}. Nornia uyandırma servisinizdir. Harika bir gün dileriz."),
    "en": ("en-US-JennyNeural", "Good morning {guest}. It is {time}. This is your wake up call. Have a wonderful day."),
    "de": ("de-DE-KatjaNeural", "Guten Morgen {guest}. Es ist {time} Uhr. Dies ist Ihr Weckruf. Wir wünschen Ihnen einen schönen Tag."),
    "ru": ("ru-RU-SvetlanaNeural", "Доброе утро {guest}. Сейчас {time}. Это ваш звонок-будильник. Желаем вам прекрасного дня."),
    "ar": ("ar-SA-ZariyahNeural", "صباح الخير {guest}. الساعة الآن {time}. هذه خدمة الإيقاظ الخاصة بك. نتمنى لك يوماً سعيداً."),
    "fr": ("fr-FR-DeniseNeural", "Bonjour {guest}. Il est {time}. Voici votre appel de réveil. Passez une excellente journée."),
}

FIAS_RUNTIME_STATE: Dict[str, Any] = {
    "running": False,
    "connected": False,
    "mode": "server",
    "endpoint": "",
    "peer": "",
    "frames_rx": 0,
    "frames_tx": 0,
    "last_frame": "",
    "last_error": "",
}

_fias_server_obj = None
_fias_active_writer: Optional[asyncio.StreamWriter] = None
_fias_task: Optional[asyncio.Task] = None
_wakeup_worker_task: Optional[asyncio.Task] = None


def _norm_tid(tenant_id: Optional[str]) -> str:
    t = str(tenant_id or "tenant-default").strip()
    return "tenant-default" if t in ("", "default") else t


def _tenant_filter(model_col, tenant_id: str):
    tid = _norm_tid(tenant_id)
    if tid in ("all", "global"):
        return None
    if tid == "tenant-default":
        return or_(model_col.in_(["tenant-default", "default"]), model_col.is_(None))
    return model_col == tid


def get_hotel_pms_config(tenant_id: str = "tenant-default") -> Dict[str, Any]:
    from backend.main import settings_db
    tid = _norm_tid(tenant_id)
    tmap = settings_db.get("tenant_hotel_pms") or {}
    raw = tmap.get(tid)
    if not isinstance(raw, dict):
        raw = (settings_db.get("hotel_pms") or {}) if tid == "tenant-default" else {}
    cfg = {
        **DEFAULT_HOTEL_PMS_CONFIG,
        "tariffs": dict(DEFAULT_HOTEL_PMS_CONFIG["tariffs"]),
        "elektra": dict(DEFAULT_HOTEL_PMS_CONFIG["elektra"]),
        "fias": dict(DEFAULT_HOTEL_PMS_CONFIG["fias"]),
    }
    for k, v in raw.items():
        if k in ("tariffs", "elektra", "fias") and isinstance(v, dict):
            cfg[k].update(v)
        elif v is not None:
            cfg[k] = v
    if not cfg.get("open_api_key"):
        cfg["open_api_key"] = f"npms_{secrets.token_hex(16)}"
    return cfg


def save_hotel_pms_config(payload: Dict[str, Any], tenant_id: str = "tenant-default") -> Dict[str, Any]:
    from backend.main import settings_db, save_settings
    tid = _norm_tid(tenant_id)
    current = get_hotel_pms_config(tid)
    for k, v in (payload or {}).items():
        if k in ("tariffs", "elektra", "fias") and isinstance(v, dict):
            current[k] = {**current.get(k, {}), **v}
        elif k in DEFAULT_HOTEL_PMS_CONFIG:
            current[k] = v
    if not current.get("open_api_key"):
        current["open_api_key"] = f"npms_{secrets.token_hex(16)}"
    settings_db.setdefault("tenant_hotel_pms", {})[tid] = current
    if tid == "tenant-default":
        settings_db["hotel_pms"] = current
    save_settings(settings_db)
    return current


async def _log_hotel_event(
    db,
    tenant_id: str,
    source: str,
    event_type: str,
    room_number: Optional[str],
    details: str,
    status: str = "ok",
):
    db.add(
        HotelPmsEventLog(
            tenant_id=_norm_tid(tenant_id),
            source=source,
            event_type=event_type,
            room_number=room_number,
            details=details,
            status=status,
        )
    )


async def _broadcast_hotel_ws(event_type: str, payload: Dict[str, Any]):
    try:
        from backend.services.websocket_manager import ws_manager
        await ws_manager.broadcast_omnichannel_event({"type": event_type, **payload})
    except Exception:
        pass


def _serialize_room(r: HotelRoom) -> Dict[str, Any]:
    return {
        "id": r.id,
        "tenant_id": r.tenant_id,
        "room_number": r.room_number,
        "extension": r.extension,
        "floor": r.floor or "1",
        "building": r.building or "Ana Bina",
        "room_type": r.room_type or "standard",
        "occupancy_status": r.occupancy_status or "vacant",
        "housekeeping_status": r.housekeeping_status or "clean",
        "guest_name": r.guest_name or "",
        "guest_language": r.guest_language or "tr",
        "guest_vip": bool(r.guest_vip),
        "reservation_code": r.reservation_code or "",
        "family_group": r.family_group or "",
        "dnd_enabled": bool(r.dnd_enabled),
        "outbound_allowed": bool(r.outbound_allowed),
        "checkin_at": r.checkin_at.isoformat() + "Z" if r.checkin_at else None,
        "checkout_at": r.checkout_at.isoformat() + "Z" if r.checkout_at else None,
        "notes": r.notes or "",
    }


def _serialize_wakeup(w: HotelWakeupCall) -> Dict[str, Any]:
    return {
        "id": w.id,
        "room_number": w.room_number,
        "extension": w.extension,
        "scheduled_time": w.scheduled_time,
        "scheduled_date": w.scheduled_date,
        "language": w.language or "tr",
        "guest_name": w.guest_name or "",
        "custom_message": w.custom_message or "",
        "status": w.status,
        "retries": w.retries or 0,
        "max_retries": w.max_retries or 2,
        "last_attempt_at": w.last_attempt_at.isoformat() + "Z" if w.last_attempt_at else None,
        "created_by": w.created_by or "reception",
        "created_at": w.created_at.isoformat() + "Z" if w.created_at else None,
    }


async def list_hotel_rooms(tenant_id: str = "tenant-default") -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as db:
        stmt = select(HotelRoom)
        tf = _tenant_filter(HotelRoom.tenant_id, tenant_id)
        if tf is not None:
            stmt = stmt.where(tf)
        stmt = stmt.order_by(HotelRoom.floor.asc(), HotelRoom.room_number.asc())
        rows = (await db.execute(stmt)).scalars().all()
        return [_serialize_room(r) for r in rows]


async def upsert_hotel_room(data: Dict[str, Any], tenant_id: str = "tenant-default") -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    room_no = str(data.get("room_number") or "").strip()
    ext = str(data.get("extension") or room_no).strip()
    if not room_no:
        raise ValueError("Oda numarası zorunludur.")
    async with AsyncSessionLocal() as db:
        room = None
        if data.get("id"):
            room = await db.get(HotelRoom, int(data["id"]))
        if not room:
            q = await db.execute(
                select(HotelRoom).where(HotelRoom.room_number == room_no, _tenant_filter(HotelRoom.tenant_id, tid))
            )
            room = q.scalar_one_or_none()
        if not room:
            room = HotelRoom(tenant_id=tid, room_number=room_no, extension=ext)
            db.add(room)

        room.room_number = room_no
        room.extension = ext
        room.floor = str(data.get("floor") or room.floor or "1").strip()
        room.building = str(data.get("building") or room.building or "Ana Bina").strip()
        room.room_type = str(data.get("room_type") or room.room_type or "standard").strip()
        if "housekeeping_status" in data and data["housekeeping_status"]:
            room.housekeeping_status = str(data["housekeeping_status"]).strip()
        if "dnd_enabled" in data:
            room.dnd_enabled = bool(data["dnd_enabled"])
        if "outbound_allowed" in data:
            room.outbound_allowed = bool(data["outbound_allowed"])
        if "family_group" in data:
            room.family_group = str(data.get("family_group") or "").strip() or None
        if "notes" in data:
            room.notes = str(data.get("notes") or "").strip() or None
        room.updated_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(room)
        return _serialize_room(room)


async def delete_hotel_room(room_id: int, tenant_id: str = "tenant-default") -> bool:
    async with AsyncSessionLocal() as db:
        room = await db.get(HotelRoom, room_id)
        if not room:
            return False
        await db.delete(room)
        await db.commit()
        return True


def _purge_room_voicemail_sync(extension: str):
    ext_clean = re.sub(r"[^0-9a-zA-Z_-]", "", str(extension or ""))
    if not ext_clean:
        return
    vm_dir = f"/var/spool/asterisk/voicemail/default/{ext_clean}"
    if os.path.isdir(vm_dir):
        for folder in ("INBOX", "Old", "Urgent"):
            target = os.path.join(vm_dir, folder)
            if os.path.isdir(target):
                for fp in glob.glob(os.path.join(target, "msg*")):
                    try:
                        os.remove(fp)
                    except Exception:
                        pass


async def _sync_extension_callerid(extension: str, display_name: str, dnd_flag: Optional[bool] = None):
    """Updates matching SystemUser full_name/DND in settings_db so live calls show Guest Name."""
    try:
        from backend.main import settings_db, save_settings
        changed = False
        for u in (settings_db.get("users") or []):
            if str(u.get("extension") or "").strip() == str(extension).strip():
                u["full_name"] = display_name
                if dnd_flag is not None:
                    u["dnd"] = bool(dnd_flag)
                changed = True
                break
        if changed:
            save_settings(settings_db)
    except Exception:
        pass


async def hotel_checkin_room(
    room_number: str,
    guest_name: str,
    tenant_id: str = "tenant-default",
    guest_language: str = "tr",
    guest_vip: bool = False,
    reservation_code: str = "",
    family_group: str = "",
    outbound_allowed: bool = True,
    source: str = "panel",
) -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    room_no = str(room_number or "").strip()
    g_name = str(guest_name or "").strip() or f"Misafir Oda {room_no}"
    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(HotelRoom).where(
                or_(HotelRoom.room_number == room_no, HotelRoom.extension == room_no),
                _tenant_filter(HotelRoom.tenant_id, tid),
            )
        )
        room = q.scalar_one_or_none()
        if not room:
            room = HotelRoom(tenant_id=tid, room_number=room_no, extension=room_no)
            db.add(room)

        room.occupancy_status = "occupied"
        room.guest_name = g_name
        room.guest_language = (guest_language or "tr").lower()[:5]
        room.guest_vip = bool(guest_vip)
        room.reservation_code = str(reservation_code or "").strip() or None
        room.family_group = str(family_group or "").strip() or None
        room.outbound_allowed = bool(outbound_allowed)
        room.dnd_enabled = False
        room.checkin_at = datetime.datetime.utcnow()
        room.checkout_at = None
        room.updated_at = datetime.datetime.utcnow()

        await _log_hotel_event(
            db,
            tid,
            source,
            "CHECKIN",
            room.room_number,
            f"Check-In: {g_name} (Dil: {room.guest_language.upper()}, Dış Arama: {'Açık' if room.outbound_allowed else 'Kapalı'})",
        )
        await db.commit()
        await db.refresh(room)
        ser = _serialize_room(room)

    await _sync_extension_callerid(room.extension, f"Oda {room.room_number} - {g_name}", dnd_flag=False)
    await _broadcast_hotel_ws("hotel_room_update", {"room": ser})
    return ser


async def get_room_folio_summary(room_number: str, tenant_id: str = "tenant-default", unpaid_only: bool = False) -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    async with AsyncSessionLocal() as db:
        stmt = select(HotelCallCharge).where(
            or_(HotelCallCharge.room_number == str(room_number), HotelCallCharge.extension == str(room_number)),
            _tenant_filter(HotelCallCharge.tenant_id, tid),
        )
        if unpaid_only:
            stmt = stmt.where(HotelCallCharge.posted_to_pms == False)
        stmt = stmt.order_by(desc(HotelCallCharge.call_time))
        charges = (await db.execute(stmt)).scalars().all()
        total = round(sum(float(c.total_cost or 0.0) for c in charges), 2)
        currency = charges[0].currency if charges else (get_hotel_pms_config(tid).get("tariffs") or {}).get("currency", "TRY")
        return {
            "room_number": str(room_number),
            "currency": currency,
            "total_cost": total,
            "charge_count": len(charges),
            "charges": [
                {
                    "id": c.id,
                    "room_number": c.room_number,
                    "called_number": c.called_number,
                    "call_category": c.call_category,
                    "duration_seconds": c.duration_seconds,
                    "billable_minutes": c.billable_minutes,
                    "rate_per_min": c.rate_per_min,
                    "total_cost": c.total_cost,
                    "currency": c.currency,
                    "posted_to_pms": bool(c.posted_to_pms),
                    "call_time": c.call_time.isoformat() + "Z" if c.call_time else None,
                }
                for c in charges[:100]
            ],
        }


async def hotel_checkout_room(
    room_number: str,
    tenant_id: str = "tenant-default",
    source: str = "panel",
) -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    cfg = get_hotel_pms_config(tid)
    room_no = str(room_number or "").strip()

    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(HotelRoom).where(
                or_(HotelRoom.room_number == room_no, HotelRoom.extension == room_no),
                _tenant_filter(HotelRoom.tenant_id, tid),
            )
        )
        room = q.scalar_one_or_none()
        if not room:
            raise ValueError(f"Oda bulunamadı: {room_no}")

        prev_guest = room.guest_name or ""
        prev_res = room.reservation_code or ""

        # Cancel active wake-up calls for this room
        q_wk = await db.execute(
            select(HotelWakeupCall).where(
                HotelWakeupCall.room_number == room.room_number,
                HotelWakeupCall.status.in_(["scheduled", "retry_pending", "ringing"]),
            )
        )
        cancelled_wakeups = 0
        for wk in q_wk.scalars().all():
            wk.status = "cancelled"
            cancelled_wakeups += 1

        # Calculate unpaid folio
        q_ch = await db.execute(
            select(HotelCallCharge).where(
                HotelCallCharge.room_number == room.room_number,
                HotelCallCharge.posted_to_pms == False,
            )
        )
        unpaid = q_ch.scalars().all()
        folio_total = round(sum(float(c.total_cost or 0.0) for c in unpaid), 2)
        for c in unpaid:
            c.posted_to_pms = True

        room.occupancy_status = "vacant"
        room.housekeeping_status = "dirty"
        room.guest_name = None
        room.guest_vip = False
        room.reservation_code = None
        room.family_group = None
        room.dnd_enabled = False
        if cfg.get("auto_lock_outbound_on_checkout", True):
            room.outbound_allowed = False
        room.checkout_at = datetime.datetime.utcnow()
        room.updated_at = datetime.datetime.utcnow()

        await _log_hotel_event(
            db,
            tid,
            source,
            "CHECKOUT",
            room.room_number,
            f"Check-Out: {prev_guest or 'Misafir'} | Dış Arama Kilitlendi | {cancelled_wakeups} uyandırma silindi | Folio: {folio_total} {(cfg.get('tariffs') or {}).get('currency', 'TRY')}",
        )
        await db.commit()
        await db.refresh(room)
        ser = _serialize_room(room)

    if cfg.get("auto_clear_voicemail_on_checkout", True):
        await asyncio.to_thread(_purge_room_voicemail_sync, room.extension)

    await _sync_extension_callerid(room.extension, f"Oda {room.room_number} (Boş)", dnd_flag=False)
    await _broadcast_hotel_ws("hotel_room_update", {"room": ser})

    if folio_total > 0:
        asyncio.create_task(_post_folio_to_external_pms(tid, room.room_number, prev_res, folio_total, "Check-Out Telefon Folio"))

    return {"room": ser, "folio_total": folio_total, "cancelled_wakeups": cancelled_wakeups}


async def hotel_set_housekeeping_status(
    room_or_ext: str,
    status_or_code: str,
    tenant_id: str = "tenant-default",
    source: str = "panel",
) -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    raw = str(status_or_code or "").strip().lower()
    if raw in HOUSEKEEPING_CODE_MAP:
        hk_status, hk_label = HOUSEKEEPING_CODE_MAP[raw]
    elif raw in ("clean", "dirty", "maintenance", "inspected"):
        hk_status = raw
        hk_label = {"clean": "Temiz", "dirty": "Kirli", "maintenance": "Bakım/Arıza", "inspected": "Kontrol Edildi"}[raw]
    else:
        raise ValueError(f"Geçersiz kat hizmetleri kodu: {status_or_code}")

    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(HotelRoom).where(
                or_(HotelRoom.room_number == str(room_or_ext), HotelRoom.extension == str(room_or_ext)),
                _tenant_filter(HotelRoom.tenant_id, tid),
            )
        )
        room = q.scalar_one_or_none()
        if not room:
            raise ValueError(f"Oda/Dahili bulunamadı: {room_or_ext}")
        room.housekeeping_status = hk_status
        room.updated_at = datetime.datetime.utcnow()
        await _log_hotel_event(db, tid, source, "HOUSEKEEPING", room.room_number, f"Oda durumu güncellendi: {hk_label} ({source})")
        await db.commit()
        await db.refresh(room)
        ser = _serialize_room(room)

    await _broadcast_hotel_ws("hotel_room_update", {"room": ser})
    asyncio.create_task(_sync_housekeeping_to_external_pms(tid, room.room_number, hk_status))
    return ser


async def check_hotel_room_call_policy(caller_ext: str, target_number: str, tenant_id: str = "tenant-default") -> Tuple[bool, str]:
    """
    Checks hotel room outbound & room-to-room restrictions.
    Returns (allowed: bool, reason: str). Always allows if hotel_pms is disabled or caller is not a room.
    """
    tid = _norm_tid(tenant_id)
    cfg = get_hotel_pms_config(tid)
    if not cfg.get("enabled"):
        return True, ""

    clean_caller = str(caller_ext or "").strip()
    clean_target = re.sub(r"[^0-9+*#]", "", str(target_number or "").strip())
    if not clean_caller or not clean_target:
        return True, ""

    # Always allow emergency numbers and hotel reception
    emergencies = {str(x).strip() for x in (cfg.get("emergency_numbers") or ["112", "110", "155", "156", "911"])}
    reception = str(cfg.get("reception_extension") or "1000").strip()
    if clean_target in emergencies or clean_target in (reception, "0") or clean_target.startswith("*"):
        return True, ""

    async with AsyncSessionLocal() as db:
        q_c = await db.execute(
            select(HotelRoom).where(HotelRoom.extension == clean_caller, _tenant_filter(HotelRoom.tenant_id, tid))
        )
        caller_room = q_c.scalar_one_or_none()
        if not caller_room:
            return True, ""

        # Check if target is another hotel room
        q_t = await db.execute(
            select(HotelRoom).where(
                or_(HotelRoom.extension == clean_target, HotelRoom.room_number == clean_target),
                _tenant_filter(HotelRoom.tenant_id, tid),
            )
        )
        target_room = q_t.scalar_one_or_none()
        if target_room:
            if target_room.dnd_enabled:
                return False, f"Oda {target_room.room_number} Rahatsız Etmeyin (DND) modunda."
            if cfg.get("block_room_to_room", True):
                same_family = bool(
                    caller_room.family_group
                    and target_room.family_group
                    and caller_room.family_group.strip().lower() == target_room.family_group.strip().lower()
                )
                if not same_family:
                    return False, "Odalar arası doğrudan arama kısıtlıdır. Lütfen resepsiyonu arayın."
            return True, ""

        # Target is external number -> check Check-In / outbound_allowed lock
        if len(clean_target) >= 7:
            if caller_room.occupancy_status != "occupied" or not caller_room.outbound_allowed:
                return False, f"Oda {caller_room.room_number} dış aramalara kilitlidir (Check-In yapılmamış veya yetki kapalı)."
    return True, ""


def classify_call_tariff(called_number: str, tariffs: Dict[str, Any]) -> Tuple[str, float]:
    num = re.sub(r"[^0-9+]", "", str(called_number or ""))
    if num.startswith("00") or (num.startswith("+") and not num.startswith("+90")):
        return "international", float(tariffs.get("international_per_min", 18.0))
    if re.match(r"^(?:\+?90|0)?5\d{9}$", num):
        return "gsm", float(tariffs.get("gsm_per_min", 5.0))
    return "local", float(tariffs.get("local_per_min", 2.5))


async def record_hotel_call_charge(
    extension: str,
    called_number: str,
    duration_seconds: int,
    tenant_id: str = "tenant-default",
) -> Optional[Dict[str, Any]]:
    tid = _norm_tid(tenant_id)
    cfg = get_hotel_pms_config(tid)
    if not cfg.get("enabled") or int(duration_seconds or 0) <= 0:
        return None
    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(HotelRoom).where(HotelRoom.extension == str(extension).strip(), _tenant_filter(HotelRoom.tenant_id, tid))
        )
        room = q.scalar_one_or_none()
        if not room:
            return None
        tariffs = cfg.get("tariffs") or DEFAULT_HOTEL_PMS_CONFIG["tariffs"]
        cat, rate = classify_call_tariff(called_number, tariffs)
        bill_min = max(1, math.ceil(int(duration_seconds) / 60))
        total = round(bill_min * rate, 2)
        currency = str(tariffs.get("currency") or "TRY")
        charge = HotelCallCharge(
            tenant_id=tid,
            room_number=room.room_number,
            extension=room.extension,
            reservation_code=room.reservation_code,
            guest_name=room.guest_name,
            called_number=str(called_number),
            call_category=cat,
            duration_seconds=int(duration_seconds),
            billable_minutes=bill_min,
            rate_per_min=rate,
            total_cost=total,
            currency=currency,
            posted_to_pms=False,
        )
        db.add(charge)
        await _log_hotel_event(
            db,
            tid,
            "phone",
            "CALL_CHARGE",
            room.room_number,
            f"Dış arama ücretlendirildi: {called_number} ({bill_min} dk × {rate} = {total} {currency})",
        )
        await db.commit()
        return {"room_number": room.room_number, "total_cost": total, "currency": currency}


# ==============================================================================
# WAKE-UP CALL ENGINE (Multilingual AI TTS + AMI Originate + Missed Alarm)
# ==============================================================================
async def schedule_hotel_wakeup(
    room_or_ext: str,
    scheduled_time: str,
    scheduled_date: str = "daily",
    language: Optional[str] = None,
    custom_message: str = "",
    created_by: str = "reception",
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    tid = _norm_tid(tenant_id)
    t_str = str(scheduled_time or "").strip()
    if re.match(r"^\d{4}$", t_str):
        t_str = f"{t_str[:2]}:{t_str[2:]}"
    if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", t_str):
        raise ValueError("Geçersiz saat formatı (SS:DD olmalı, örn. 07:30).")

    cfg = get_hotel_pms_config(tid)
    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(HotelRoom).where(
                or_(HotelRoom.room_number == str(room_or_ext), HotelRoom.extension == str(room_or_ext)),
                _tenant_filter(HotelRoom.tenant_id, tid),
            )
        )
        room = q.scalar_one_or_none()
        room_no = room.room_number if room else str(room_or_ext)
        ext = room.extension if room else str(room_or_ext)
        lang = (language or (room.guest_language if room else "tr") or "tr").lower()[:5]
        guest = (room.guest_name if room else "") or ""

        wk = HotelWakeupCall(
            tenant_id=tid,
            room_number=room_no,
            extension=ext,
            scheduled_time=t_str,
            scheduled_date=str(scheduled_date or "daily").strip(),
            language=lang,
            guest_name=guest,
            custom_message=str(custom_message or "").strip() or None,
            status="scheduled",
            retries=0,
            max_retries=int(cfg.get("wakeup_max_retries") or 2),
            created_by=created_by,
        )
        db.add(wk)
        await _log_hotel_event(db, tid, created_by, "WAKEUP", room_no, f"Uyandırma kuruldu: {t_str} ({wk.scheduled_date}, Dil: {lang.upper()})")
        await db.commit()
        await db.refresh(wk)
        return _serialize_wakeup(wk)


async def list_hotel_wakeups(tenant_id: str = "tenant-default") -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as db:
        stmt = select(HotelWakeupCall)
        tf = _tenant_filter(HotelWakeupCall.tenant_id, tenant_id)
        if tf is not None:
            stmt = stmt.where(tf)
        stmt = stmt.order_by(desc(HotelWakeupCall.created_at)).limit(100)
        rows = (await db.execute(stmt)).scalars().all()
        return [_serialize_wakeup(w) for w in rows]


async def cancel_hotel_wakeup(wakeup_id: int) -> bool:
    async with AsyncSessionLocal() as db:
        wk = await db.get(HotelWakeupCall, wakeup_id)
        if not wk:
            return False
        wk.status = "cancelled"
        await db.commit()
        return True


def _synthesize_wakeup_wav_sync(wakeup_id: int, language: str, guest_name: str, time_str: str, custom_msg: str = "") -> str:
    """Generates an 8kHz mono PCM WAV file for Asterisk Playback using edge-tts."""
    voice, tmpl = WAKEUP_VOICE_MAP.get((language or "tr").lower()[:2], WAKEUP_VOICE_MAP["tr"])
    text = custom_msg.strip() if custom_msg else tmpl.format(guest=guest_name or "", time=time_str).replace("  ", " ").strip()
    out_dir = "/var/spool/asterisk/monitor"
    os.makedirs(out_dir, exist_ok=True)
    mp3_path = os.path.join(out_dir, f"hotel_wakeup_{wakeup_id}.mp3")
    wav_path = os.path.join(out_dir, f"hotel_wakeup_{wakeup_id}.wav")
    try:
        subprocess.run(["edge-tts", "--voice", voice, "--text", text, "--write-media", mp3_path], check=True, timeout=15.0)
        subprocess.run(["ffmpeg", "-y", "-i", mp3_path, "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le", wav_path], check=True, timeout=15.0, capture_output=True)
        if os.path.exists(mp3_path):
            os.remove(mp3_path)
        return os.path.join(out_dir, f"hotel_wakeup_{wakeup_id}")
    except Exception as exc:
        print(f"[Hotel Wakeup TTS Warning]: {exc}")
        return "beep"


async def execute_hotel_wakeup_call(wakeup_id: int) -> Dict[str, Any]:
    """Originates an Asterisk AMI wake-up call with personalized multilingual AI voice."""
    async with AsyncSessionLocal() as db:
        wk = await db.get(HotelWakeupCall, wakeup_id)
        if not wk:
            return {"status": "error", "message": "Uyandırma kaydı bulunamadı."}
        cfg = get_hotel_pms_config(wk.tenant_id)
        audio_file = "beep"
        if cfg.get("wakeup_use_ai_tts", True):
            audio_file = await asyncio.to_thread(
                _synthesize_wakeup_wav_sync,
                wk.id,
                wk.language or "tr",
                wk.guest_name or f"Oda {wk.room_number}",
                wk.scheduled_time,
                wk.custom_message or "",
            )
        wk.status = "ringing"
        wk.last_attempt_at = datetime.datetime.utcnow()
        await db.commit()

        originated_ok = False
        try:
            from backend.services.ami_manager import get_ami_manager
            ami = get_ami_manager()
            if ami and getattr(ami, "connected", False):
                res = await ami.send_action({
                    "Action": "Originate",
                    "Channel": f"PJSIP/{wk.extension}",
                    "Application": "Playback",
                    "Data": audio_file,
                    "CallerID": f"Uyandirma Servisi <*55>",
                    "Timeout": "25000",
                    "Async": "true",
                })
                originated_ok = bool(res)
        except Exception as exc:
            print(f"[Hotel Wakeup AMI Originate Warning]: {exc}")

        if originated_ok:
            wk.status = "answered"
            await _log_hotel_event(db, wk.tenant_id, "wakeup", "WAKEUP", wk.room_number, f"Uyandırma çağrısı başlatıldı ({wk.scheduled_time} -> Dahili {wk.extension})")
        else:
            wk.retries = (wk.retries or 0) + 1
            if wk.retries <= (wk.max_retries or 2):
                retry_min = int(cfg.get("wakeup_retry_minutes") or 5)
                wk.status = "retry_pending"
                wk.next_retry_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=retry_min)
                await _log_hotel_event(
                    db, wk.tenant_id, "wakeup", "WAKEUP", wk.room_number,
                    f"Uyandırma yanıtsız (Deneme {wk.retries}/{wk.max_retries}) — {retry_min} dk sonra tekrar aranacak.",
                    status="warning",
                )
            else:
                wk.status = "missed_alarm"
                await _log_hotel_event(
                    db, wk.tenant_id, "wakeup", "WAKEUP_ALARM", wk.room_number,
                    f"RESEPSİYON ALARMI: Oda {wk.room_number} ({wk.guest_name or 'Misafir'}) {wk.scheduled_time} uyandırma çağrısına yanıt vermedi!",
                    status="error",
                )
                await _broadcast_hotel_ws("hotel_wakeup_alarm", {"wakeup": _serialize_wakeup(wk)})
        await db.commit()
        await db.refresh(wk)
        return _serialize_wakeup(wk)


async def _hotel_wakeup_scheduler_loop():
    while True:
        try:
            now_utc = datetime.datetime.utcnow()
            # Local Turkey time UTC+3
            now_local = now_utc + datetime.timedelta(hours=3)
            hhmm = now_local.strftime("%H:%M")
            today_str = now_local.strftime("%Y-%m-%d")

            due_ids: List[int] = []
            async with AsyncSessionLocal() as db:
                q = await db.execute(
                    select(HotelWakeupCall).where(HotelWakeupCall.status.in_(["scheduled", "retry_pending"]))
                )
                for wk in q.scalars().all():
                    if wk.status == "scheduled":
                        if wk.scheduled_time == hhmm and wk.scheduled_date in ("daily", today_str):
                            if not wk.last_attempt_at or (now_utc - wk.last_attempt_at).total_seconds() > 90:
                                due_ids.append(wk.id)
                    elif wk.status == "retry_pending" and wk.next_retry_at and wk.next_retry_at <= now_utc:
                        due_ids.append(wk.id)
            for wid in due_ids:
                asyncio.create_task(execute_hotel_wakeup_call(wid))
        except Exception as exc:
            print(f"[Hotel Wakeup Scheduler Warning]: {exc}")
        await asyncio.sleep(20)


def start_hotel_wakeup_worker():
    global _wakeup_worker_task
    if _wakeup_worker_task is None or _wakeup_worker_task.done():
        _wakeup_worker_task = asyncio.create_task(_hotel_wakeup_scheduler_loop())


# ==============================================================================
# EXTERNAL PMS BRIDGES: ELEKTRAWEB REST & FIAS (OPERA / PROTEL / FIDELIO) TCP/IP
# ==============================================================================
async def _sync_housekeeping_to_external_pms(tenant_id: str, room_number: str, hk_status: str):
    cfg = get_hotel_pms_config(tenant_id)
    elektra = cfg.get("elektra") or {}
    if elektra.get("enabled") and elektra.get("api_url") and elektra.get("api_key"):
        try:
            url = f"{str(elektra['api_url']).rstrip('/')}/api/v1/housekeeping/status"
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    url,
                    headers={"Authorization": f"Bearer {elektra['api_key']}", "X-Hotel-ID": str(elektra.get("hotel_id") or "")},
                    json={"room_number": room_number, "status": hk_status},
                )
        except Exception as exc:
            print(f"[ElektraWeb HK Sync Warning]: {exc}")

    # FIAS RE (Room Equipment / Maid Status) frame
    rs_code = HOUSEKEEPING_TO_FIAS_RS.get(hk_status)
    if rs_code:
        await send_fias_frame(f"RE|RN{room_number}|RS{rs_code}|")


async def _post_folio_to_external_pms(tenant_id: str, room_number: str, res_code: str, amount: float, description: str):
    cfg = get_hotel_pms_config(tenant_id)
    elektra = cfg.get("elektra") or {}
    if elektra.get("enabled") and elektra.get("api_url") and elektra.get("api_key"):
        try:
            url = f"{str(elektra['api_url']).rstrip('/')}/api/v1/folio/post"
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    url,
                    headers={"Authorization": f"Bearer {elektra['api_key']}", "X-Hotel-ID": str(elektra.get("hotel_id") or "")},
                    json={
                        "room_number": room_number,
                        "reservation_code": res_code,
                        "amount": amount,
                        "currency": (cfg.get("tariffs") or {}).get("currency", "TRY"),
                        "description": description,
                    },
                )
        except Exception as exc:
            print(f"[ElektraWeb Folio Post Warning]: {exc}")

    now_local = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    da = now_local.strftime("%y%m%d")
    ti = now_local.strftime("%H%M%S")
    await send_fias_frame(f"PS|RN{room_number}|TA{int(round(amount * 100))}|PT1|DA{da}|TI{ti}|")


def _parse_fias_fields(record: str) -> Tuple[str, Dict[str, str]]:
    parts = [p for p in record.strip().split("|") if p]
    if not parts:
        return "", {}
    rec_type = parts[0].upper()
    fields: Dict[str, str] = {}
    for p in parts[1:]:
        if len(p) >= 2:
            fields[p[:2].upper()] = p[2:]
    return rec_type, fields


async def send_fias_frame(payload: str) -> bool:
    global _fias_active_writer
    if not _fias_active_writer or _fias_active_writer.is_closing():
        return False
    try:
        frame = b"\x02" + payload.encode("utf-8") + b"\x03"
        _fias_active_writer.write(frame)
        await _fias_active_writer.drain()
        FIAS_RUNTIME_STATE["frames_tx"] += 1
        FIAS_RUNTIME_STATE["last_frame"] = f"TX: {payload}"
        return True
    except Exception as exc:
        FIAS_RUNTIME_STATE["last_error"] = str(exc)
        return False


async def _handle_incoming_fias_record(record: str, tenant_id: str = "tenant-default"):
    rec_type, fields = _parse_fias_fields(record)
    if not rec_type:
        return
    FIAS_RUNTIME_STATE["frames_rx"] += 1
    FIAS_RUNTIME_STATE["last_frame"] = f"RX: {record[:120]}"

    now_local = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    da, ti = now_local.strftime("%y%m%d"), now_local.strftime("%H%M%S")

    if rec_type in ("LS", "LA"):
        await send_fias_frame(f"LA|DA{da}|TI{ti}|")
        return

    rn = fields.get("RN", "").strip()
    if rec_type == "GI" and rn:
        guest = fields.get("GN") or f"Misafir {rn}"
        lang = (fields.get("GL") or "TR").lower()[:2]
        vip = bool(fields.get("GV") and fields.get("GV") not in ("0", "N", "NO"))
        res_id = fields.get("G#") or ""
        await hotel_checkin_room(rn, guest, tenant_id=tenant_id, guest_language=lang, guest_vip=vip, reservation_code=res_id, source="fias")
    elif rec_type == "GO" and rn:
        await hotel_checkout_room(rn, tenant_id=tenant_id, source="fias")
    elif rec_type == "GC" and rn:
        guest = fields.get("GN") or ""
        lang = (fields.get("GL") or "TR").lower()[:2]
        if guest:
            await hotel_checkin_room(rn, guest, tenant_id=tenant_id, guest_language=lang, reservation_code=fields.get("G#", ""), source="fias")
    elif rec_type == "RE" and rn and fields.get("RS"):
        hk = FIAS_RS_TO_HOUSEKEEPING.get(fields["RS"], "clean")
        await hotel_set_housekeeping_status(rn, hk, tenant_id=tenant_id, source="fias")
    elif rec_type == "WR" and rn and fields.get("TI"):
        t_raw = fields["TI"][:4]
        if len(t_raw) == 4:
            await schedule_hotel_wakeup(rn, f"{t_raw[:2]}:{t_raw[2:]}", created_by="fias", tenant_id=tenant_id)
            await send_fias_frame(f"WA|RN{rn}|DA{da}|TI{ti}|ASOK|")


async def _handle_fias_stream(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, tenant_id: str = "tenant-default"):
    global _fias_active_writer
    _fias_active_writer = writer
    peer = writer.get_extra_info("peername")
    FIAS_RUNTIME_STATE["connected"] = True
    FIAS_RUNTIME_STATE["peer"] = f"{peer[0]}:{peer[1]}" if peer else ""
    FIAS_RUNTIME_STATE["last_error"] = ""
    buf = b""
    try:
        while True:
            chunk = await reader.read(4096)
            if not chunk:
                break
            buf += chunk
            while b"\x03" in buf:
                frame, buf = buf.split(b"\x03", 1)
                if b"\x02" in frame:
                    frame = frame.split(b"\x02")[-1]
                text = frame.decode("utf-8", errors="ignore").strip()
                if text:
                    await _handle_incoming_fias_record(text, tenant_id=tenant_id)
    except Exception as exc:
        FIAS_RUNTIME_STATE["last_error"] = str(exc)
    finally:
        FIAS_RUNTIME_STATE["connected"] = False
        FIAS_RUNTIME_STATE["peer"] = ""
        if _fias_active_writer is writer:
            _fias_active_writer = None
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def restart_fias_bridge(tenant_id: str = "tenant-default"):
    global _fias_server_obj, _fias_task
    if _fias_task and not _fias_task.done():
        _fias_task.cancel()
        _fias_task = None
    if _fias_server_obj:
        _fias_server_obj.close()
        _fias_server_obj = None
    FIAS_RUNTIME_STATE["running"] = False
    FIAS_RUNTIME_STATE["connected"] = False

    cfg = get_hotel_pms_config(tenant_id)
    fias = cfg.get("fias") or {}
    if not cfg.get("enabled") or not fias.get("enabled"):
        return

    mode = str(fias.get("mode") or "server").lower()
    FIAS_RUNTIME_STATE["mode"] = mode

    if mode == "server":
        host = str(fias.get("host") or "0.0.0.0")
        port = int(fias.get("port") or 5008)
        try:
            _fias_server_obj = await asyncio.start_server(
                lambda r, w: _handle_fias_stream(r, w, tenant_id=tenant_id),
                host,
                port,
            )
            FIAS_RUNTIME_STATE["running"] = True
            FIAS_RUNTIME_STATE["endpoint"] = f"{host}:{port}"
            FIAS_RUNTIME_STATE["last_error"] = ""
            print(f"[Hotel FIAS] TCP Sunucu dinliyor: {host}:{port}")
        except Exception as exc:
            FIAS_RUNTIME_STATE["last_error"] = f"FIAS dinleme hatası: {exc}"
    else:
        r_host = str(fias.get("remote_host") or "").strip()
        r_port = int(fias.get("remote_port") or 5008)
        if not r_host:
            FIAS_RUNTIME_STATE["last_error"] = "Uzak FIAS sunucu IP adresi girilmedi."
            return
        FIAS_RUNTIME_STATE["endpoint"] = f"{r_host}:{r_port}"

        async def _client_loop():
            FIAS_RUNTIME_STATE["running"] = True
            while True:
                try:
                    reader, writer = await asyncio.open_connection(r_host, r_port)
                    now_local = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
                    writer.write(b"\x02" + f"LS|DA{now_local.strftime('%y%m%d')}|TI{now_local.strftime('%H%M%S')}|".encode() + b"\x03")
                    await writer.drain()
                    await _handle_fias_stream(reader, writer, tenant_id=tenant_id)
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    FIAS_RUNTIME_STATE["last_error"] = str(exc)
                await asyncio.sleep(10)
            FIAS_RUNTIME_STATE["running"] = False

        _fias_task = asyncio.create_task(_client_loop())


async def list_hotel_pms_events(tenant_id: str = "tenant-default", limit: int = 40) -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as db:
        stmt = select(HotelPmsEventLog)
        tf = _tenant_filter(HotelPmsEventLog.tenant_id, tenant_id)
        if tf is not None:
            stmt = stmt.where(tf)
        stmt = stmt.order_by(desc(HotelPmsEventLog.created_at)).limit(limit)
        rows = (await db.execute(stmt)).scalars().all()
        return [
            {
                "id": e.id,
                "source": e.source,
                "event_type": e.event_type,
                "room_number": e.room_number,
                "details": e.details,
                "status": e.status,
                "created_at": e.created_at.isoformat() + "Z" if e.created_at else None,
            }
            for e in rows
        ]
