#!/usr/bin/env python3
"""
Nornia Media Agent — Lightweight sidecar daemon for decoupled Asterisk Media Nodes
(Nornia Spark, Nornia Midgard, and Nornia Odin).

Responsibilities:
1. Watches /var/spool/asterisk/monitor for newly finished call recordings (.wav/.mp3/.opus)
   that have remained stable for >= 3 seconds and uploads them to MinIO/S3 (S3_ENDPOINT).
2. Optionally removes uploaded local spool files after S3 confirmation when
   MEDIA_AGENT_DELETE_AFTER_UPLOAD=1 to keep Asterisk nodes completely stateless.
3. Watches a shared/synced Asterisk config directory (or Redis reload channel when
   REDIS_URL is configured) to execute `asterisk -rx "core reload"` seamlessly.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.object_storage_service import (  # noqa: E402
    ensure_bucket_exists_async,
    is_s3_enabled,
    upload_recording_async,
)

MONITOR_DIR = Path(os.getenv("ASTERISK_MONITOR_DIR", "/var/spool/asterisk/monitor"))
POLL_SECONDS = float(os.getenv("MEDIA_AGENT_POLL_SECONDS", "5"))
STABLE_SECONDS = float(os.getenv("MEDIA_AGENT_STABLE_SECONDS", "3"))
DELETE_AFTER_UPLOAD = os.getenv("MEDIA_AGENT_DELETE_AFTER_UPLOAD", "0") == "1"
UPLOAD_STATE_FILE = Path(os.getenv("MEDIA_AGENT_STATE_FILE", "/tmp/nornia_media_agent_uploaded.json"))


def _load_uploaded_state() -> Dict[str, float]:
    try:
        if UPLOAD_STATE_FILE.exists():
            data = json.loads(UPLOAD_STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {str(k): float(v) for k, v in data.items()}
    except Exception:
        pass
    return {}


def _save_uploaded_state(state: Dict[str, float]) -> None:
    try:
        # Prune entries older than 7 days to keep state file tiny
        cutoff = time.time() - (7 * 86400)
        trimmed = {k: v for k, v in state.items() if v >= cutoff}
        tmp = Path(str(UPLOAD_STATE_FILE) + ".tmp")
        tmp.write_text(json.dumps(trimmed), encoding="utf-8")
        tmp.replace(UPLOAD_STATE_FILE)
    except Exception:
        pass


def _asterisk_reload(cmd: str = "core reload") -> None:
    try:
        subprocess.run(["asterisk", "-rx", cmd], check=False, timeout=5.0)
    except Exception as exc:
        print(f"[MediaAgent] Asterisk reload warning ({cmd}): {exc}", flush=True)


async def _recording_upload_loop() -> None:
    if not is_s3_enabled():
        print("[MediaAgent] S3_ENDPOINT not configured; S3 recording offload idle.", flush=True)
        while True:
            await asyncio.sleep(60)

    await ensure_bucket_exists_async()
    uploaded = _load_uploaded_state()
    print(
        f"[MediaAgent] Watching {MONITOR_DIR} -> S3 bucket "
        f"(delete_after_upload={DELETE_AFTER_UPLOAD})",
        flush=True,
    )

    while True:
        try:
            if MONITOR_DIR.is_dir():
                now = time.time()
                changed = False
                for entry in MONITOR_DIR.iterdir():
                    if not entry.is_file():
                        continue
                    if entry.suffix.lower() not in (".wav", ".mp3", ".opus"):
                        continue
                    if entry.name.startswith("tr_"):
                        # Skip static Turkish system announcement files
                        continue
                    stat = entry.stat()
                    if stat.st_size <= 44:
                        continue
                    if (now - stat.st_mtime) < STABLE_SECONDS:
                        continue
                    sig = f"{entry.name}:{stat.st_size}"
                    if sig in uploaded:
                        continue

                    ctype = "audio/wav" if entry.suffix.lower() == ".wav" else "audio/mpeg"
                    ok, msg = await upload_recording_async(str(entry), entry.name, content_type=ctype)
                    if ok:
                        uploaded[sig] = now
                        changed = True
                        print(f"[MediaAgent] Uploaded {entry.name} ({stat.st_size} B) -> S3", flush=True)
                        if DELETE_AFTER_UPLOAD:
                            try:
                                entry.unlink(missing_ok=True)
                            except Exception:
                                pass
                    else:
                        print(f"[MediaAgent] Upload failed for {entry.name}: {msg}", flush=True)
                if changed:
                    _save_uploaded_state(uploaded)
        except Exception as exc:
            print(f"[MediaAgent] Scan loop warning: {exc}", flush=True)
        await asyncio.sleep(POLL_SECONDS)


async def _redis_reload_listener() -> None:
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url:
        return
    while True:
        pubsub = None
        try:
            import redis.asyncio as aioredis  # type: ignore

            client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.subscribe("nornia:asterisk:reload")
            print("[MediaAgent] Subscribed to nornia:asterisk:reload", flush=True)
            async for msg in pubsub.listen():
                if not isinstance(msg, dict) or msg.get("type") != "message":
                    continue
                cmd = "core reload"
                try:
                    payload = json.loads(msg.get("data") or "{}")
                    cmd = str(payload.get("command") or "core reload")
                except Exception:
                    pass
                print(f"[MediaAgent] Executing cluster reload: {cmd}", flush=True)
                await asyncio.to_thread(_asterisk_reload, cmd)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"[MediaAgent] Redis listener reconnect: {exc}", flush=True)
            await asyncio.sleep(5.0)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.close()
                except Exception:
                    pass


async def main() -> None:
    await asyncio.gather(
        _recording_upload_loop(),
        _redis_reload_listener(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
