import asyncio
import base64
import datetime
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Body, HTTPException, Request
from sqlalchemy import and_, or_, select, text

from backend.database.config import AsyncSessionLocal
from backend.database.models import (
    AgentBreakLog,
    AgentSessionLog,
    Call,
    FederationConfigOutbox,
    FederationSite,
    FederationSyncQueue,
    QueueSurveyResponse,
)

federation_router = APIRouter(prefix="/api/federation", tags=["Çok-Şubeli Dağıtık Santral (Federation)"])

DEFAULT_MEDIA_SYNC_POLICY: Dict[str, Any] = {
    "sync_recordings": True,
    "compression": "opus",  # opus | mp3 | wav
    "max_kbps": 256,  # 128 | 256 | 512 | 1024 | 0 (unlimited)
    "schedule_mode": "offhours",  # offhours | realtime | manual
    "offhours_start": "19:00",
    "offhours_end": "08:00",
}

_federation_tables_ensured = False
_federation_worker_started = False


def normalize_media_sync_policy(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return dict(DEFAULT_MEDIA_SYNC_POLICY)
    comp = str(raw.get("compression") or "opus").strip().lower()
    if comp not in ("opus", "mp3", "wav"):
        comp = "opus"
    sched = str(raw.get("schedule_mode") or "offhours").strip().lower()
    if sched not in ("offhours", "realtime", "manual"):
        sched = "offhours"
    try:
        kbps = max(0, min(10000, int(raw.get("max_kbps", 256) or 0)))
    except Exception:
        kbps = 256
    return {
        "sync_recordings": bool(raw.get("sync_recordings", True)),
        "compression": comp,
        "max_kbps": kbps,
        "schedule_mode": sched,
        "offhours_start": str(raw.get("offhours_start") or "19:00").strip()[:5],
        "offhours_end": str(raw.get("offhours_end") or "08:00").strip()[:5],
    }


def is_media_sync_window_open(policy: Dict[str, Any], now_tr: Optional[datetime.datetime] = None, force: bool = False) -> bool:
    if not policy.get("sync_recordings", True):
        return False
    if force:
        return True
    mode = str(policy.get("schedule_mode") or "offhours").lower()
    if mode == "realtime":
        return True
    if mode == "manual":
        return False
    now_dt = now_tr or (datetime.datetime.utcnow() + datetime.timedelta(hours=3))
    cur_hm = now_dt.strftime("%H:%M")
    st = str(policy.get("offhours_start") or "19:00")
    en = str(policy.get("offhours_end") or "08:00")
    if st <= en:
        return st <= cur_hm <= en
    # Overnight window (e.g. 19:00 -> 08:00)
    return cur_hm >= st or cur_hm <= en


async def ensure_federation_tables_async(db) -> None:
    global _federation_tables_ensured
    if _federation_tables_ensured:
        return
    ddls = [
        """
        CREATE TABLE IF NOT EXISTS federation_sites (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            site_code VARCHAR NOT NULL UNIQUE,
            site_name VARCHAR NOT NULL,
            role VARCHAR DEFAULT 'edge',
            edge_mode VARCHAR DEFAULT 'active_local',
            extension_range_start VARCHAR DEFAULT '2000',
            extension_range_end VARCHAR DEFAULT '2999',
            local_lan_ip VARCHAR,
            wireguard_ip VARCHAR,
            sip_trunk_port INTEGER DEFAULT 5060,
            pairing_token VARCHAR NOT NULL,
            outbound_primary_trunk VARCHAR,
            outbound_failover_trunk VARCHAR,
            media_sync_policy JSON DEFAULT '{}',
            status VARCHAR DEFAULT 'pairing',
            last_seen_at TIMESTAMP WITHOUT TIME ZONE,
            last_config_version_applied INTEGER DEFAULT 0,
            target_config_version INTEGER DEFAULT 1,
            pending_cdr_count INTEGER DEFAULT 0,
            pending_media_count INTEGER DEFAULT 0,
            pending_media_mb DOUBLE PRECISION DEFAULT 0.0,
            registered_phones_count INTEGER DEFAULT 0,
            active_calls_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS federation_config_outbox (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            site_code VARCHAR NOT NULL,
            config_version INTEGER NOT NULL DEFAULT 1,
            change_summary VARCHAR,
            config_snapshot JSON DEFAULT '{}',
            status VARCHAR DEFAULT 'pending',
            created_by VARCHAR,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
            applied_at TIMESTAMP WITHOUT TIME ZONE
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS federation_sync_queue (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            record_type VARCHAR NOT NULL,
            origin_record_id VARCHAR NOT NULL,
            payload JSON DEFAULT '{}',
            file_path VARCHAR,
            file_sha256 VARCHAR,
            uploaded_bytes INTEGER DEFAULT 0,
            total_bytes INTEGER DEFAULT 0,
            sync_status VARCHAR DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            last_error TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
            synced_at TIMESTAMP WITHOUT TIME ZONE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_fed_outbox_site_ver ON federation_config_outbox (site_code, config_version DESC);",
        "CREATE INDEX IF NOT EXISTS ix_fed_sync_type_status ON federation_sync_queue (record_type, sync_status);",
        "ALTER TABLE calls ADD COLUMN IF NOT EXISTS origin_site_id VARCHAR DEFAULT 'hq';",
        "ALTER TABLE agent_break_logs ADD COLUMN IF NOT EXISTS origin_site_id VARCHAR DEFAULT 'hq';",
        "ALTER TABLE agent_session_logs ADD COLUMN IF NOT EXISTS origin_site_id VARCHAR DEFAULT 'hq';",
        "ALTER TABLE queue_survey_responses ADD COLUMN IF NOT EXISTS origin_site_id VARCHAR DEFAULT 'hq';",
    ]
    for stmt in ddls:
        try:
            await db.execute(text(stmt))
        except Exception:
            pass
    await db.commit()
    _federation_tables_ensured = True


def _extract_tenant_id(request: Request) -> str:
    tid = (
        request.headers.get("X-Tenant-ID")
        or request.headers.get("Tenant-ID")
        or request.query_params.get("tenant_id")
        or "tenant-default"
    ).strip()
    return tid or "tenant-default"


def _get_settings_and_saver():
    import backend.main as bm
    return bm.settings_db, bm.save_settings, bm.RECORDINGS_DIR


def _serialize_site(row: FederationSite) -> Dict[str, Any]:
    now_utc = datetime.datetime.utcnow()
    is_online = False
    if row.last_seen_at:
        age = (now_utc - row.last_seen_at).total_seconds()
        is_online = age <= 90
    eff_status = "online" if is_online else ("pairing" if row.last_seen_at is None else "offline")
    return {
        "id": row.id,
        "tenant_id": row.tenant_id or "tenant-default",
        "site_code": row.site_code,
        "site_name": row.site_name,
        "role": row.role or "edge",
        "edge_mode": row.edge_mode or "active_local",
        "extension_range_start": row.extension_range_start or "2000",
        "extension_range_end": row.extension_range_end or "2999",
        "local_lan_ip": row.local_lan_ip or "",
        "wireguard_ip": row.wireguard_ip or "",
        "sip_trunk_port": int(row.sip_trunk_port or 5060),
        "pairing_token": row.pairing_token,
        "outbound_primary_trunk": row.outbound_primary_trunk or "",
        "outbound_failover_trunk": row.outbound_failover_trunk or "",
        "media_sync_policy": normalize_media_sync_policy(row.media_sync_policy),
        "status": eff_status,
        "last_seen_at": row.last_seen_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.last_seen_at else None,
        "last_config_version_applied": int(row.last_config_version_applied or 0),
        "target_config_version": int(row.target_config_version or 1),
        "config_in_sync": int(row.last_config_version_applied or 0) >= int(row.target_config_version or 1),
        "pending_cdr_count": int(row.pending_cdr_count or 0),
        "pending_media_count": int(row.pending_media_count or 0),
        "pending_media_mb": round(float(row.pending_media_mb or 0.0), 2),
        "registered_phones_count": int(row.registered_phones_count or 0),
        "active_calls_count": int(row.active_calls_count or 0),
        "created_at": row.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if row.created_at else None,
    }


def build_federation_asterisk_snippets(site: FederationSite, hq_wg_ip: str = "10.200.0.10") -> Dict[str, str]:
    """
    Generates Asterisk PJSIP Inter-Site Trunk + Extension Block Routing + Outbound Local Failover Dialplan
    for both HQ and the Branch Edge PBX.
    """
    sc = re.sub(r"[^a-zA-Z0-9_-]", "", str(site.site_code or "site01"))
    edge_ip = str(site.wireguard_ip or site.local_lan_ip or "10.200.1.1").strip()
    port = int(site.sip_trunk_port or 5060)
    ext_s = str(site.extension_range_start or "2000").strip()
    ext_e = str(site.extension_range_end or "2999").strip()
    prefix_digit = ext_s[0] if ext_s and ext_s[0].isdigit() else "2"
    ext_len = max(3, len(ext_s))
    x_pat = "X" * (ext_len - 1)

    primary_trk = str(site.outbound_primary_trunk or "hq_federation_trunk").strip()
    failover_trk = str(site.outbound_failover_trunk or "").strip()

    hq_pjsip = f"""; === MERKEZ (HQ) -> {site.site_name} ({sc}) PJSIP Inter-Site Trunk ===
[fed_{sc}]
type=endpoint
transport=transport-udp
context=from-federation
disallow=all
allow=opus,g722,alaw,ulaw
aors=fed_{sc}
direct_media=no

[fed_{sc}]
type=aor
contact=sip:{edge_ip}:{port}
qualify_frequency=30

[fed_{sc}]
type=identify
endpoint=fed_{sc}
match={edge_ip}
"""

    edge_pjsip = f"""; === ŞUBE ({sc}) -> MERKEZ (HQ) PJSIP Inter-Site Trunk ===
[hq_federation_trunk]
type=endpoint
transport=transport-udp
context=from-federation
disallow=all
allow=opus,g722,alaw,ulaw
aors=hq_federation_trunk
direct_media=no

[hq_federation_trunk]
type=aor
contact=sip:{hq_wg_ip}:{port}
qualify_frequency=30

[hq_federation_trunk]
type=identify
endpoint=hq_federation_trunk
match={hq_wg_ip}
"""

    failover_lines = (
        f" same => n,GotoIf($[\"${{DIALSTATUS}}\"=\"ANSWER\"]?done)\n"
        f" same => n,NoOp(Birincil hat / internet erisilemedi -> Yedek Yerel Hat: {failover_trk})\n"
        f" same => n,Dial(PJSIP/${{EXTEN}}@{failover_trk},60,tT)\n"
        if failover_trk
        else " same => n,NoOp(Yedek yerel dis hat tanimli degil; yalnizca sube ici lokal aramalar aktif)\n"
    )

    edge_dialplan = f"""; === ŞUBE ({sc}) Şube-Arası Dahili & Failover Dış Hat Yönlendirmesi ===
[federation_intersite_{sc}]
; Merkez dahilileri (1XXX) -> WireGuard uzerinden Merkeze
exten => _1XXX,1,NoOp(Merkez dahili aramasi: ${{EXTEN}})
 same => n,Dial(PJSIP/${{EXTEN}}@hq_federation_trunk,45,tT)
 same => n,Playback(all-circuits-busy-now)
 same => n,Hangup()

[branch_outbound_failover_{sc}]
; Dis hat aramasi: Once birincil hat ({primary_trk}), internet/hat koparsa yedek yerel hat ({failover_trk or 'YOK'})
exten => _0XXXXXXXXXX,1,NoOp(Sube dis arama: ${{EXTEN}} | 1. Hat: {primary_trk})
 same => n,Dial(PJSIP/${{EXTEN}}@{primary_trk},45,tT)
{failover_lines} same => n(done),Hangup()
"""

    hq_dialplan = f"""; === MERKEZ (HQ) -> {site.site_name} ({ext_s}-{ext_e}) Dahili Yönlendirmesi ===
[federation_to_{sc}]
exten => _{prefix_digit}{x_pat},1,NoOp({site.site_name} sube dahili aramasi: ${{EXTEN}})
 same => n,Dial(PJSIP/${{EXTEN}}@fed_{sc},45,tT)
 same => n,Hangup()
"""

    return {
        "hq_pjsip": hq_pjsip,
        "edge_pjsip": edge_pjsip,
        "hq_dialplan": hq_dialplan,
        "edge_dialplan": edge_dialplan,
    }


def _compress_audio_for_sync(src_path: str, compression: str) -> Tuple[str, str, bool]:
    """
    Compresses a .wav recording to .opus or .mp3 using ffmpeg if available (~85% size reduction for rural links).
    Returns (path_to_upload, file_ext, is_temp_file).
    """
    comp = str(compression or "opus").lower()
    if comp == "wav" or not os.path.exists(src_path):
        ext = os.path.splitext(src_path)[1].lstrip(".").lower() or "wav"
        return src_path, ext, False

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        ext = os.path.splitext(src_path)[1].lstrip(".").lower() or "wav"
        return src_path, ext, False

    tmp_dir = "/tmp/nornia_fed_media"
    os.makedirs(tmp_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(src_path))[0]
    if comp == "opus":
        out_path = os.path.join(tmp_dir, f"{base_name}.opus")
        cmd = [ffmpeg_bin, "-y", "-i", src_path, "-c:a", "libopus", "-b:a", "24k", "-ac", "1", out_path]
        ext = "opus"
    else:
        out_path = os.path.join(tmp_dir, f"{base_name}.mp3")
        cmd = [ffmpeg_bin, "-y", "-i", src_path, "-c:a", "libmp3lame", "-b:a", "32k", "-ac", "1", out_path]
        ext = "mp3"

    try:
        res = subprocess.run(cmd, capture_output=True, timeout=30)
        if res.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            return out_path, ext, True
    except Exception:
        pass
    ext = os.path.splitext(src_path)[1].lstrip(".").lower() or "wav"
    return src_path, ext, False


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


# ==============================================================================
# NODE CONFIGURATION (STANDALONE / HUB / EDGE)
# ==============================================================================

@federation_router.get("/node-config")
async def get_federation_node_config(request: Request):
    from backend.services.autoprovision_service import detect_server_local_ip

    settings_db, _, _ = _get_settings_and_saver()
    raw = settings_db.get("federation_node") if isinstance(settings_db.get("federation_node"), dict) else {}
    detected_lan = detect_server_local_ip()

    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        pending_meta = 0
        pending_media = 0
        pending_mb = 0.0
        try:
            q_res = await db.execute(
                select(FederationSyncQueue).where(FederationSyncQueue.sync_status != "synced")
            )
            for row in q_res.scalars().all():
                if row.record_type == "recording":
                    pending_media += 1
                    pending_mb += float(row.total_bytes or 0) / (1024.0 * 1024.0)
                else:
                    pending_meta += 1
        except Exception:
            pass

    return {
        "status": "success",
        "node": {
            "role": str(raw.get("role") or "standalone"),
            "site_code": str(raw.get("site_code") or "hq"),
            "site_name": str(raw.get("site_name") or "Genel Merkez"),
            "hq_url": str(raw.get("hq_url") or ""),
            "pairing_token": str(raw.get("pairing_token") or ""),
            "local_lan_ip": str(raw.get("local_lan_ip") or detected_lan),
            "detected_local_ip": detected_lan,
            "wireguard_ip": str(raw.get("wireguard_ip") or ""),
            "last_config_version_applied": int(raw.get("last_config_version_applied") or 0),
            "last_sync_at": raw.get("last_sync_at"),
            "last_sync_error": raw.get("last_sync_error") or "",
            "media_sync_policy": normalize_media_sync_policy(raw.get("media_sync_policy")),
        },
        "local_queue": {
            "pending_meta_count": pending_meta,
            "pending_media_count": pending_media,
            "pending_media_mb": round(pending_mb, 2),
        },
    }


@federation_router.post("/node-config")
async def save_federation_node_config(request: Request, payload: Dict[str, Any] = Body(...)):
    settings_db, save_settings, _ = _get_settings_and_saver()
    cur = settings_db.get("federation_node") if isinstance(settings_db.get("federation_node"), dict) else {}
    role = str(payload.get("role") or cur.get("role") or "standalone").strip().lower()
    if role not in ("standalone", "hub", "edge"):
        role = "standalone"

    updated = {
        "role": role,
        "site_code": re.sub(r"[^a-zA-Z0-9_-]", "", str(payload.get("site_code") or cur.get("site_code") or "hq").strip()) or "hq",
        "site_name": str(payload.get("site_name") or cur.get("site_name") or "Genel Merkez").strip(),
        "hq_url": str(payload.get("hq_url") if "hq_url" in payload else cur.get("hq_url") or "").strip().rstrip("/"),
        "pairing_token": str(payload.get("pairing_token") if "pairing_token" in payload else cur.get("pairing_token") or "").strip(),
        "local_lan_ip": str(payload.get("local_lan_ip") if "local_lan_ip" in payload else cur.get("local_lan_ip") or "").strip(),
        "wireguard_ip": str(payload.get("wireguard_ip") if "wireguard_ip" in payload else cur.get("wireguard_ip") or "").strip(),
        "last_config_version_applied": int(cur.get("last_config_version_applied") or 0),
        "last_sync_at": cur.get("last_sync_at"),
        "last_sync_error": "",
        "media_sync_policy": normalize_media_sync_policy(payload.get("media_sync_policy") or cur.get("media_sync_policy")),
    }
    settings_db["federation_node"] = updated
    save_settings(settings_db)

    if role == "edge":
        start_federation_sync_worker()

    return {"status": "success", "node": updated}


# ==============================================================================
# HUB FLEET MANAGEMENT (SITES + CONFIG OUTBOX + ASTERISK GENERATOR)
# ==============================================================================

@federation_router.get("/sites")
async def list_federation_sites(request: Request):
    tenant_id = _extract_tenant_id(request)
    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        res = await db.execute(select(FederationSite).order_by(FederationSite.id.asc()))
        rows = res.scalars().all()
        sites = [_serialize_site(r) for r in rows]

        outbox_res = await db.execute(
            select(FederationConfigOutbox).order_by(FederationConfigOutbox.created_at.desc()).limit(50)
        )
        outbox_items = [
            {
                "id": o.id,
                "site_code": o.site_code,
                "config_version": o.config_version,
                "change_summary": o.change_summary or "Konfigürasyon Güncellemesi",
                "status": o.status,
                "created_by": o.created_by or "Admin",
                "created_at": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.created_at else None,
                "applied_at": o.applied_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.applied_at else None,
            }
            for o in outbox_res.scalars().all()
        ]

    summary = {
        "total_sites": len(sites),
        "online_sites": sum(1 for s in sites if s["status"] == "online"),
        "offline_sites": sum(1 for s in sites if s["status"] == "offline"),
        "pairing_sites": sum(1 for s in sites if s["status"] == "pairing"),
        "total_pending_cdr": sum(s["pending_cdr_count"] for s in sites),
        "total_pending_media": sum(s["pending_media_count"] for s in sites),
        "total_pending_media_mb": round(sum(s["pending_media_mb"] for s in sites), 2),
    }
    return {"status": "success", "summary": summary, "sites": sites, "outbox": outbox_items}


@federation_router.post("/sites")
async def upsert_federation_site(request: Request, payload: Dict[str, Any] = Body(...)):
    tenant_id = _extract_tenant_id(request)
    site_code = re.sub(r"[^a-zA-Z0-9_-]", "", str(payload.get("site_code") or "").strip()).lower()
    site_name = str(payload.get("site_name") or "").strip()
    if not site_code or not site_name:
        raise HTTPException(status_code=400, detail="Şube Kodu ve Şube Adı zorunludur.")

    edge_mode = str(payload.get("edge_mode") or "active_local").strip().lower()
    if edge_mode not in ("active_local", "srst_failover"):
        edge_mode = "active_local"

    media_policy = normalize_media_sync_policy(payload.get("media_sync_policy"))

    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        res = await db.execute(select(FederationSite).where(FederationSite.site_code == site_code))
        existing = res.scalar_one_or_none()
        if existing:
            existing.site_name = site_name
            existing.edge_mode = edge_mode
            existing.extension_range_start = str(payload.get("extension_range_start") or existing.extension_range_start or "2000").strip()
            existing.extension_range_end = str(payload.get("extension_range_end") or existing.extension_range_end or "2999").strip()
            existing.local_lan_ip = str(payload.get("local_lan_ip") or "").strip()
            existing.wireguard_ip = str(payload.get("wireguard_ip") or "").strip()
            existing.sip_trunk_port = int(payload.get("sip_trunk_port") or 5060)
            existing.outbound_primary_trunk = str(payload.get("outbound_primary_trunk") or "").strip()
            existing.outbound_failover_trunk = str(payload.get("outbound_failover_trunk") or "").strip()
            existing.media_sync_policy = media_policy
            if payload.get("rotate_token") is True:
                existing.pairing_token = f"nfed_{secrets.token_hex(16)}"
            site_row = existing
        else:
            site_row = FederationSite(
                tenant_id=tenant_id,
                site_code=site_code,
                site_name=site_name,
                role="edge",
                edge_mode=edge_mode,
                extension_range_start=str(payload.get("extension_range_start") or "2000").strip(),
                extension_range_end=str(payload.get("extension_range_end") or "2999").strip(),
                local_lan_ip=str(payload.get("local_lan_ip") or "").strip(),
                wireguard_ip=str(payload.get("wireguard_ip") or "").strip(),
                sip_trunk_port=int(payload.get("sip_trunk_port") or 5060),
                pairing_token=f"nfed_{secrets.token_hex(16)}",
                outbound_primary_trunk=str(payload.get("outbound_primary_trunk") or "").strip(),
                outbound_failover_trunk=str(payload.get("outbound_failover_trunk") or "").strip(),
                media_sync_policy=media_policy,
                status="pairing",
                target_config_version=1,
            )
            db.add(site_row)
        await db.commit()
        await db.refresh(site_row)
        serialized = _serialize_site(site_row)

    return {"status": "success", "site": serialized}


@federation_router.delete("/sites/{site_code}")
async def delete_federation_site(site_code: str):
    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        res = await db.execute(select(FederationSite).where(FederationSite.site_code == site_code))
        row = res.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Şube bulunamadı.")
        await db.delete(row)
        await db.commit()
    return {"status": "success", "deleted": site_code}


@federation_router.post("/sites/{site_code}/push-config")
async def push_config_to_federation_site(
    site_code: str,
    request: Request,
    payload: Dict[str, Any] = Body(default={}),
):
    """Şube için yeni sürüm konfigürasyon paketi oluşturup Outbox kuyruğuna alır (offline şube dönünce otomatik çeker)."""
    settings_db, _, _ = _get_settings_and_saver()
    summary_text = str(payload.get("summary") or "Merkezden Şube Konfigürasyon Güncellemesi").strip()

    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        res = await db.execute(select(FederationSite).where(FederationSite.site_code == site_code))
        site = res.scalar_one_or_none()
        if not site:
            raise HTTPException(status_code=404, detail="Şube bulunamadı.")

        new_ver = int(site.target_config_version or 0) + 1
        site.target_config_version = new_ver

        # Filter users falling in this site's extension range (or tagged with site_code)
        try:
            r_start = int(site.extension_range_start or 2000)
            r_end = int(site.extension_range_end or 2999)
        except Exception:
            r_start, r_end = 2000, 2999

        site_users = []
        for u in settings_db.get("users") or []:
            if not isinstance(u, dict):
                continue
            ext_s = str(u.get("extension") or "").strip()
            in_range = ext_s.isdigit() and r_start <= int(ext_s) <= r_end
            if in_range or str(u.get("site_code") or "") == site_code:
                site_users.append({
                    "id": u.get("id"),
                    "full_name": u.get("full_name"),
                    "email": u.get("email"),
                    "extension": ext_s,
                    "role": u.get("role"),
                    "sip_username": u.get("sip_username"),
                    "sip_password": u.get("sip_password"),
                    "sip_devices": u.get("sip_devices"),
                    "is_active": u.get("is_active", True),
                })

        snapshot = {
            "site_code": site.site_code,
            "site_name": site.site_name,
            "edge_mode": site.edge_mode,
            "extension_range": [site.extension_range_start, site.extension_range_end],
            "outbound_primary_trunk": site.outbound_primary_trunk or "",
            "outbound_failover_trunk": site.outbound_failover_trunk or "",
            "media_sync_policy": normalize_media_sync_policy(site.media_sync_policy),
            "breaks": settings_db.get("breaks") or [],
            "users_count": len(site_users),
            "users": site_users,
            "asterisk_snippets": build_federation_asterisk_snippets(site),
        }

        outbox = FederationConfigOutbox(
            tenant_id=site.tenant_id or "tenant-default",
            site_code=site.site_code,
            config_version=new_ver,
            change_summary=summary_text,
            config_snapshot=snapshot,
            status="pending",
            created_by=request.headers.get("X-User-ID") or "admin",
            created_at=datetime.datetime.utcnow(),
        )
        db.add(outbox)
        await db.commit()
        await db.refresh(outbox)
        await db.refresh(site)

    return {
        "status": "success",
        "config_version": new_ver,
        "outbox_id": outbox.id,
        "site": _serialize_site(site),
    }


@federation_router.get("/sites/{site_code}/asterisk-preview")
async def preview_federation_site_asterisk(site_code: str):
    settings_db, _, _ = _get_settings_and_saver()
    hq_node = settings_db.get("federation_node") if isinstance(settings_db.get("federation_node"), dict) else {}
    hq_wg_ip = str(hq_node.get("wireguard_ip") or "10.200.0.10").strip() or "10.200.0.10"

    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        res = await db.execute(select(FederationSite).where(FederationSite.site_code == site_code))
        site = res.scalar_one_or_none()
        if not site:
            raise HTTPException(status_code=404, detail="Şube bulunamadı.")
        snippets = build_federation_asterisk_snippets(site, hq_wg_ip=hq_wg_ip)
    return {"status": "success", "site": _serialize_site(site), "snippets": snippets}


# ==============================================================================
# HUB RECEIVER APIs (AUTHENTICATED BY X-Site-Code + X-Pairing-Token)
# ==============================================================================

async def _authenticate_edge_site(request: Request, db) -> FederationSite:
    sc = str(request.headers.get("X-Site-Code") or "").strip().lower()
    tok = str(request.headers.get("X-Pairing-Token") or "").strip()
    if not sc or not tok:
        raise HTTPException(status_code=401, detail="Eksik şube kimlik başlıkları (X-Site-Code / X-Pairing-Token).")
    await ensure_federation_tables_async(db)
    res = await db.execute(select(FederationSite).where(FederationSite.site_code == sc))
    site = res.scalar_one_or_none()
    if not site or not secrets.compare_digest(str(site.pairing_token or ""), tok):
        raise HTTPException(status_code=403, detail="Geçersiz şube eşleştirme anahtarı.")
    return site


@federation_router.post("/heartbeat")
async def receive_edge_heartbeat(request: Request, payload: Dict[str, Any] = Body(default={})):
    async with AsyncSessionLocal() as db:
        site = await _authenticate_edge_site(request, db)
        site.last_seen_at = datetime.datetime.utcnow()
        site.status = "online"
        if payload.get("local_lan_ip"):
            site.local_lan_ip = str(payload.get("local_lan_ip")).strip()
        if payload.get("wireguard_ip"):
            site.wireguard_ip = str(payload.get("wireguard_ip")).strip()
        site.pending_cdr_count = int(payload.get("pending_cdr_count") or 0)
        site.pending_media_count = int(payload.get("pending_media_count") or 0)
        site.pending_media_mb = float(payload.get("pending_media_mb") or 0.0)
        site.registered_phones_count = int(payload.get("registered_phones_count") or 0)
        site.active_calls_count = int(payload.get("active_calls_count") or 0)
        if payload.get("applied_config_version") is not None:
            site.last_config_version_applied = int(payload.get("applied_config_version") or 0)
        await db.commit()
        await db.refresh(site)

        return {
            "status": "ok",
            "site_code": site.site_code,
            "target_config_version": int(site.target_config_version or 1),
            "has_pending_config": int(site.target_config_version or 1) > int(site.last_config_version_applied or 0),
            "media_sync_policy": normalize_media_sync_policy(site.media_sync_policy),
            "edge_mode": site.edge_mode or "active_local",
        }


@federation_router.get("/config-pull")
async def edge_pull_pending_configs(request: Request, since_version: int = 0):
    async with AsyncSessionLocal() as db:
        site = await _authenticate_edge_site(request, db)
        res = await db.execute(
            select(FederationConfigOutbox)
            .where(
                FederationConfigOutbox.site_code == site.site_code,
                FederationConfigOutbox.config_version > since_version,
            )
            .order_by(FederationConfigOutbox.config_version.asc())
            .limit(20)
        )
        items = [
            {
                "id": o.id,
                "config_version": o.config_version,
                "change_summary": o.change_summary,
                "config_snapshot": o.config_snapshot or {},
            }
            for o in res.scalars().all()
        ]
    return {"status": "ok", "items": items}


@federation_router.post("/config-ack")
async def edge_ack_applied_config(request: Request, payload: Dict[str, Any] = Body(...)):
    applied_ver = int(payload.get("applied_version") or 0)
    async with AsyncSessionLocal() as db:
        site = await _authenticate_edge_site(request, db)
        site.last_config_version_applied = max(int(site.last_config_version_applied or 0), applied_ver)
        site.last_seen_at = datetime.datetime.utcnow()
        res = await db.execute(
            select(FederationConfigOutbox).where(
                FederationConfigOutbox.site_code == site.site_code,
                FederationConfigOutbox.config_version <= applied_ver,
                FederationConfigOutbox.status == "pending",
            )
        )
        now_utc = datetime.datetime.utcnow()
        for o in res.scalars().all():
            o.status = "applied"
            o.applied_at = now_utc
        await db.commit()
    return {"status": "ok", "applied_version": applied_ver}


def _parse_iso_dt(val: Optional[str]) -> Optional[datetime.datetime]:
    if not val:
        return None
    try:
        return datetime.datetime.fromisoformat(str(val).replace("Z", ""))
    except Exception:
        return None


@federation_router.post("/sync/events")
async def receive_edge_synced_events(request: Request, payload: Dict[str, Any] = Body(...)):
    """İnternet yokken şubede biriken CDR, Mola, Oturum ve Anket kayıtlarını çift kayıt yapmadan Merkeze yazar."""
    async with AsyncSessionLocal() as db:
        site = await _authenticate_edge_site(request, db)
        sc = site.site_code
        tid = site.tenant_id or "tenant-default"
        acked_ids: List[str] = []

        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            rtype = str(item.get("record_type") or "").strip().lower()
            origin_id = str(item.get("origin_record_id") or "").strip()
            rec = item.get("payload") if isinstance(item.get("payload"), dict) else {}
            if not origin_id:
                continue

            try:
                if rtype == "call":
                    fed_call_id = f"{sc}:{origin_id}" if not origin_id.startswith(f"{sc}:") else origin_id
                    ex = await db.execute(select(Call).where(Call.id == fed_call_id))
                    c_obj = ex.scalar_one_or_none()
                    if not c_obj:
                        c_obj = Call(
                            id=fed_call_id,
                            tenant_id=tid,
                            caller_number=str(rec.get("caller_number") or ""),
                            callee_number=str(rec.get("callee_number") or ""),
                            status=str(rec.get("status") or "completed"),
                            start_time=_parse_iso_dt(rec.get("start_time")) or datetime.datetime.utcnow(),
                            end_time=_parse_iso_dt(rec.get("end_time")),
                            answered_at=_parse_iso_dt(rec.get("answered_at")),
                            talk_duration=rec.get("talk_duration"),
                            hangup_source=rec.get("hangup_source"),
                            agent_name=rec.get("agent_name"),
                            ended_by=rec.get("ended_by"),
                            trunk_name=rec.get("trunk_name"),
                            summary=rec.get("summary"),
                            agent_topic=rec.get("agent_topic"),
                            agent_notes=rec.get("agent_notes"),
                            sentiment=rec.get("sentiment"),
                            qa_score=rec.get("qa_score"),
                        )
                        db.add(c_obj)
                        await db.flush()
                        await db.execute(
                            text("UPDATE calls SET origin_site_id = :sc WHERE id = :cid"),
                            {"sc": sc, "cid": fed_call_id},
                        )
                    acked_ids.append(origin_id)

                elif rtype == "break":
                    st_dt = _parse_iso_dt(rec.get("start_time")) or datetime.datetime.utcnow()
                    # Idempotency check by extension + start_time + break_name
                    ex = await db.execute(
                        select(AgentBreakLog).where(
                            AgentBreakLog.extension == str(rec.get("extension") or ""),
                            AgentBreakLog.break_name == str(rec.get("break_name") or "Mola"),
                            AgentBreakLog.start_time == st_dt,
                        ).limit(1)
                    )
                    if not ex.scalars().first():
                        b_obj = AgentBreakLog(
                            tenant_id=tid,
                            user_id=str(rec.get("user_id") or ""),
                            extension=str(rec.get("extension") or ""),
                            agent_name=str(rec.get("agent_name") or ""),
                            break_name=str(rec.get("break_name") or "Mola"),
                            start_time=st_dt,
                            end_time=_parse_iso_dt(rec.get("end_time")),
                            duration_seconds=int(rec.get("duration_seconds") or 0),
                        )
                        db.add(b_obj)
                        await db.flush()
                        await db.execute(
                            text("UPDATE agent_break_logs SET origin_site_id = :sc WHERE id = :bid"),
                            {"sc": sc, "bid": b_obj.id},
                        )
                    acked_ids.append(origin_id)

                elif rtype == "session":
                    lg_dt = _parse_iso_dt(rec.get("login_time")) or datetime.datetime.utcnow()
                    ex = await db.execute(
                        select(AgentSessionLog).where(
                            AgentSessionLog.extension == str(rec.get("extension") or ""),
                            AgentSessionLog.login_time == lg_dt,
                        ).limit(1)
                    )
                    if not ex.scalars().first():
                        s_obj = AgentSessionLog(
                            tenant_id=tid,
                            user_id=str(rec.get("user_id") or ""),
                            extension=str(rec.get("extension") or ""),
                            agent_name=str(rec.get("agent_name") or ""),
                            login_time=lg_dt,
                            logout_time=_parse_iso_dt(rec.get("logout_time")),
                            duration_seconds=int(rec.get("duration_seconds") or 0),
                            logout_reason=str(rec.get("logout_reason") or "manual_logout"),
                            disconnect_count=int(rec.get("disconnect_count") or 0),
                            ip_address=str(rec.get("ip_address") or ""),
                        )
                        db.add(s_obj)
                        await db.flush()
                        await db.execute(
                            text("UPDATE agent_session_logs SET origin_site_id = :sc WHERE id = :sid"),
                            {"sc": sc, "sid": s_obj.id},
                        )
                    acked_ids.append(origin_id)

                elif rtype == "survey":
                    fed_cid = f"{sc}:{rec.get('call_id')}" if rec.get("call_id") else None
                    ts_dt = _parse_iso_dt(rec.get("timestamp")) or datetime.datetime.utcnow()
                    q_obj = QueueSurveyResponse(
                        tenant_id=tid,
                        call_id=fed_cid,
                        queue_extension=str(rec.get("queue_extension") or ""),
                        queue_name=str(rec.get("queue_name") or ""),
                        agent_extension=str(rec.get("agent_extension") or ""),
                        agent_name=str(rec.get("agent_name") or ""),
                        caller_number=str(rec.get("caller_number") or ""),
                        score=rec.get("score"),
                        max_score=int(rec.get("max_score") or 5),
                        question_answers=rec.get("question_answers") or [],
                        status=str(rec.get("status") or "completed"),
                        timestamp=ts_dt,
                    )
                    db.add(q_obj)
                    await db.flush()
                    await db.execute(
                        text("UPDATE queue_survey_responses SET origin_site_id = :sc WHERE id = :qid"),
                        {"sc": sc, "qid": q_obj.id},
                    )
                    acked_ids.append(origin_id)
            except Exception as e_item:
                print(f"[Federation Sync Event Warning {sc}/{origin_id}]: {e_item}")

        site.last_seen_at = datetime.datetime.utcnow()
        await db.commit()

    return {"status": "ok", "acked_ids": acked_ids, "count": len(acked_ids)}


@federation_router.post("/sync/media")
async def receive_edge_media_chunk(request: Request, payload: Dict[str, Any] = Body(...)):
    """Şubeden parçalı (resumable chunked) sıkıştırılmış ses kaydı alır, SHA-256 ile doğrular ve Merkeze bağlar."""
    _, _, recordings_dir = _get_settings_and_saver()
    async with AsyncSessionLocal() as db:
        site = await _authenticate_edge_site(request, db)
        sc = site.site_code

        call_id = re.sub(r"[^a-zA-Z0-9_.:-]", "", str(payload.get("call_id") or "").strip())
        file_ext = re.sub(r"[^a-zA-Z0-9]", "", str(payload.get("file_ext") or "opus").strip().lower()) or "opus"
        offset = max(0, int(payload.get("offset") or 0))
        total_bytes = max(0, int(payload.get("total_bytes") or 0))
        expected_sha256 = str(payload.get("sha256") or "").strip().lower()
        chunk_b64 = str(payload.get("chunk_b64") or "")
        is_final = bool(payload.get("is_final", False))

        if not call_id or not chunk_b64:
            raise HTTPException(status_code=400, detail="call_id ve chunk_b64 zorunludur.")

        raw_bytes = base64.b64decode(chunk_b64)
        dest_dir = os.path.join(recordings_dir, "sites", sc)
        os.makedirs(dest_dir, exist_ok=True)
        part_path = os.path.join(dest_dir, f"{call_id}.{file_ext}.part")
        final_path = os.path.join(dest_dir, f"{call_id}.{file_ext}")

        mode = "r+b" if (offset > 0 and os.path.exists(part_path)) else "wb"
        with open(part_path, mode) as f:
            f.seek(offset)
            f.write(raw_bytes)

        written_end = offset + len(raw_bytes)
        if is_final or (total_bytes > 0 and written_end >= total_bytes):
            actual_sha = _sha256_file(part_path)
            if expected_sha256 and actual_sha != expected_sha256:
                raise HTTPException(status_code=409, detail="Ses kaydı SHA-256 bütünlük doğrulaması başarısız.")
            os.replace(part_path, final_path)

            fed_call_id = f"{sc}:{call_id}" if not call_id.startswith(f"{sc}:") else call_id
            ex = await db.execute(select(Call).where(Call.id == fed_call_id))
            c_obj = ex.scalar_one_or_none()
            if c_obj:
                c_obj.recording_path = final_path
            site.last_seen_at = datetime.datetime.utcnow()
            await db.commit()
            return {"status": "completed", "path": final_path, "sha256": actual_sha, "received_bytes": written_end}

        return {"status": "chunk_ok", "received_bytes": written_end}


# ==============================================================================
# EDGE STORE-AND-FORWARD SYNC WORKER
# ==============================================================================

async def run_edge_sync_cycle(force_media: bool = False) -> Dict[str, Any]:
    """Single Edge -> HQ sync pass: enqueue new local records, heartbeat, pull config, push metadata & throttled media."""
    settings_db, save_settings, recordings_dir = _get_settings_and_saver()
    node = settings_db.get("federation_node") if isinstance(settings_db.get("federation_node"), dict) else {}
    if str(node.get("role") or "standalone").lower() != "edge":
        return {"status": "skipped", "reason": "not_edge"}

    hq_url = str(node.get("hq_url") or "").strip().rstrip("/")
    site_code = str(node.get("site_code") or "").strip().lower()
    token = str(node.get("pairing_token") or "").strip()
    if not hq_url or not site_code or not token:
        return {"status": "skipped", "reason": "missing_hq_credentials"}

    headers = {
        "X-Site-Code": site_code,
        "X-Pairing-Token": token,
        "Content-Type": "application/json",
    }

    # 1. Discover & enqueue new completed local calls (last 7 days) not yet queued
    async with AsyncSessionLocal() as db:
        await ensure_federation_tables_async(db)
        since_7d = datetime.datetime.utcnow() - datetime.timedelta(days=7)

        existing_keys = set()
        ex_res = await db.execute(select(FederationSyncQueue.record_type, FederationSyncQueue.origin_record_id))
        for rt, oid in ex_res.all():
            existing_keys.add((rt, oid))

        calls_res = await db.execute(
            select(Call).where(Call.start_time >= since_7d, Call.end_time.is_not(None)).limit(200)
        )
        for c in calls_res.scalars().all():
            cid = str(c.id)
            if ("call", cid) not in existing_keys:
                db.add(FederationSyncQueue(
                    tenant_id=c.tenant_id or "tenant-default",
                    record_type="call",
                    origin_record_id=cid,
                    payload={
                        "caller_number": c.caller_number,
                        "callee_number": c.callee_number,
                        "status": c.status,
                        "start_time": c.start_time.isoformat() if c.start_time else None,
                        "end_time": c.end_time.isoformat() if c.end_time else None,
                        "answered_at": c.answered_at.isoformat() if c.answered_at else None,
                        "talk_duration": c.talk_duration,
                        "hangup_source": c.hangup_source,
                        "agent_name": c.agent_name,
                        "ended_by": c.ended_by,
                        "trunk_name": c.trunk_name,
                        "summary": c.summary,
                        "agent_topic": c.agent_topic,
                        "agent_notes": c.agent_notes,
                        "sentiment": c.sentiment,
                        "qa_score": c.qa_score,
                    },
                    sync_status="pending",
                ))
                existing_keys.add(("call", cid))

            # Queue recording if file exists on local disk
            rec_path = c.recording_path or os.path.join(recordings_dir, f"{cid}.wav")
            if rec_path and os.path.exists(rec_path) and ("recording", cid) not in existing_keys:
                db.add(FederationSyncQueue(
                    tenant_id=c.tenant_id or "tenant-default",
                    record_type="recording",
                    origin_record_id=cid,
                    file_path=rec_path,
                    total_bytes=os.path.getsize(rec_path),
                    sync_status="pending",
                ))
                existing_keys.add(("recording", cid))

        await db.commit()

        # Gather queue counts for heartbeat
        pend_res = await db.execute(
            select(FederationSyncQueue).where(FederationSyncQueue.sync_status != "synced").order_by(FederationSyncQueue.id.asc())
        )
        pend_rows = pend_res.scalars().all()
        pend_meta = [r for r in pend_rows if r.record_type != "recording"]
        pend_media = [r for r in pend_rows if r.record_type == "recording"]
        pend_mb = round(sum(float(r.total_bytes or 0) for r in pend_media) / (1024.0 * 1024.0), 2)

    # 2. Heartbeat with HQ
    policy = normalize_media_sync_policy(node.get("media_sync_policy"))
    synced_meta_cnt = 0
    synced_media_cnt = 0

    try:
        verify_tls = not bool(node.get("allow_self_signed")) and os.getenv("NORNIA_ALLOW_INSECURE_TLS", "0") != "1"
        async with httpx.AsyncClient(timeout=10.0, verify=verify_tls) as client:
            hb_res = await client.post(
                f"{hq_url}/api/federation/heartbeat",
                headers=headers,
                json={
                    "local_lan_ip": node.get("local_lan_ip") or "",
                    "wireguard_ip": node.get("wireguard_ip") or "",
                    "applied_config_version": int(node.get("last_config_version_applied") or 0),
                    "pending_cdr_count": len(pend_meta),
                    "pending_media_count": len(pend_media),
                    "pending_media_mb": pend_mb,
                },
            )
            if hb_res.status_code != 200:
                node["last_sync_error"] = f"Merkez yanıt kodu: HTTP {hb_res.status_code}"
                settings_db["federation_node"] = node
                return {"status": "offline", "http_status": hb_res.status_code}

            hb_data = hb_res.json()
            if isinstance(hb_data.get("media_sync_policy"), dict):
                policy = normalize_media_sync_policy(hb_data["media_sync_policy"])
                node["media_sync_policy"] = policy

            # 3. Pull pending config from HQ if newer version exists
            if hb_data.get("has_pending_config"):
                cur_v = int(node.get("last_config_version_applied") or 0)
                cp_res = await client.get(
                    f"{hq_url}/api/federation/config-pull",
                    params={"since_version": cur_v},
                    headers=headers,
                )
                if cp_res.status_code == 200:
                    cp_items = cp_res.json().get("items") or []
                    max_v = cur_v
                    for item in cp_items:
                        snap = item.get("config_snapshot") or {}
                        if isinstance(snap.get("media_sync_policy"), dict):
                            node["media_sync_policy"] = normalize_media_sync_policy(snap["media_sync_policy"])
                        max_v = max(max_v, int(item.get("config_version") or 0))
                    if max_v > cur_v:
                        node["last_config_version_applied"] = max_v
                        await client.post(
                            f"{hq_url}/api/federation/config-ack",
                            headers=headers,
                            json={"applied_version": max_v},
                        )

            # 4. Priority 1: Flush pending metadata batch (CDR, Breaks, Sessions, Surveys)
            if pend_meta:
                batch = pend_meta[:50]
                ev_res = await client.post(
                    f"{hq_url}/api/federation/sync/events",
                    headers=headers,
                    json={
                        "items": [
                            {
                                "record_type": r.record_type,
                                "origin_record_id": r.origin_record_id,
                                "payload": r.payload or {},
                            }
                            for r in batch
                        ]
                    },
                )
                if ev_res.status_code == 200:
                    acked = set(ev_res.json().get("acked_ids") or [])
                    async with AsyncSessionLocal() as db2:
                        now_u = datetime.datetime.utcnow()
                        for r in batch:
                            if r.origin_record_id in acked:
                                qrow = (await db2.execute(select(FederationSyncQueue).where(FederationSyncQueue.id == r.id))).scalar_one_or_none()
                                if qrow:
                                    qrow.sync_status = "synced"
                                    qrow.synced_at = now_u
                                    synced_meta_cnt += 1
                        await db2.commit()

            # 5. Priority 2: Compressed, bandwidth-throttled, resumable audio recording sync
            if pend_media and is_media_sync_window_open(policy, force=force_media):
                max_kbps = int(policy.get("max_kbps") or 0)
                chunk_size = 262144  # 256 KB chunks for unstable rural links
                for mrow in pend_media[:3]:
                    src = mrow.file_path or ""
                    if not src or not os.path.exists(src):
                        continue
                    up_path, up_ext, is_tmp = _compress_audio_for_sync(src, policy.get("compression", "opus"))
                    try:
                        total_sz = os.path.getsize(up_path)
                        file_sha = _sha256_file(up_path)
                        offset = int(mrow.uploaded_bytes or 0) if mrow.file_sha256 == file_sha else 0
                        with open(up_path, "rb") as fh:
                            fh.seek(offset)
                            while offset < total_sz:
                                t0 = time.monotonic()
                                buf = fh.read(chunk_size)
                                if not buf:
                                    break
                                is_fin = (offset + len(buf)) >= total_sz
                                m_res = await client.post(
                                    f"{hq_url}/api/federation/sync/media",
                                    headers=headers,
                                    json={
                                        "call_id": mrow.origin_record_id,
                                        "file_ext": up_ext,
                                        "offset": offset,
                                        "total_bytes": total_sz,
                                        "sha256": file_sha,
                                        "chunk_b64": base64.b64encode(buf).decode("ascii"),
                                        "is_final": is_fin,
                                    },
                                    timeout=25.0,
                                )
                                if m_res.status_code != 200:
                                    break
                                offset += len(buf)
                                # Bandwidth throttle to protect live VoIP voice quality on rural links
                                if max_kbps > 0 and not is_fin:
                                    target_sec = (len(buf) * 8.0) / (max_kbps * 1000.0)
                                    elapsed = time.monotonic() - t0
                                    if target_sec > elapsed:
                                        await asyncio.sleep(min(5.0, target_sec - elapsed))
                        if offset >= total_sz:
                            async with AsyncSessionLocal() as db3:
                                qrow = (await db3.execute(select(FederationSyncQueue).where(FederationSyncQueue.id == mrow.id))).scalar_one_or_none()
                                if qrow:
                                    qrow.sync_status = "synced"
                                    qrow.uploaded_bytes = total_sz
                                    qrow.total_bytes = total_sz
                                    qrow.file_sha256 = file_sha
                                    qrow.synced_at = datetime.datetime.utcnow()
                                    synced_media_cnt += 1
                                await db3.commit()
                    finally:
                        if is_tmp and os.path.exists(up_path):
                            try:
                                os.remove(up_path)
                            except Exception:
                                pass

        node["last_sync_at"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        node["last_sync_error"] = ""
        settings_db["federation_node"] = node
        save_settings(settings_db)
        return {
            "status": "ok",
            "synced_meta": synced_meta_cnt,
            "synced_media": synced_media_cnt,
        }
    except Exception as e_net:
        node["last_sync_error"] = f"Merkez erişilemiyor (Çevrimdışı modda yerel kayıt devam ediyor): {str(e_net)[:140]}"
        settings_db["federation_node"] = node
        return {"status": "offline", "error": str(e_net)[:140]}


@federation_router.post("/edge/sync-now")
async def trigger_edge_sync_now(payload: Dict[str, Any] = Body(default={})):
    force_media = bool(payload.get("force_media", True))
    res = await run_edge_sync_cycle(force_media=force_media)
    return res


async def _federation_worker_loop():
    await asyncio.sleep(8)
    while True:
        try:
            await run_edge_sync_cycle(force_media=False)
        except Exception as e:
            print(f"[Federation Worker Info]: {e}")
        await asyncio.sleep(20)


def start_federation_sync_worker():
    global _federation_worker_started
    if _federation_worker_started:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_federation_worker_loop())
        _federation_worker_started = True
    except RuntimeError:
        pass
