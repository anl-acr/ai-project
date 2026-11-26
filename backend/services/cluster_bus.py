"""
Nornia Enterprise AI PBX — Opt-In Cluster Event Bus & Leader Lock (Redis).

Strictly opt-in via REDIS_URL environment variable (used in Nornia Spark,
Nornia Midgard, and Nornia Odin HA deployments). When REDIS_URL is unset,
every helper acts as a zero-overhead no-op so single-server installations
behave identically to standalone mode.
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import threading
import time
from typing import Any, Awaitable, Callable, Dict, Optional

NODE_ID = (
    os.getenv("NORNIA_NODE_ID")
    or f"{socket.gethostname()}-{os.getpid()}"
)

CHANNEL_WS_TRANSCRIPT = "nornia:ws:transcript"
CHANNEL_WS_OMNICHANNEL = "nornia:ws:omnichannel"
CHANNEL_SETTINGS_RELOAD = "nornia:settings:reload"

_subscriber_task: Optional[asyncio.Task] = None
_async_redis_client: Any = None
_sync_redis_client: Any = None
_sync_lock = threading.Lock()


def get_redis_url() -> str:
    return (os.getenv("REDIS_URL") or "").strip()


def is_cluster_enabled() -> bool:
    return bool(get_redis_url())


def _get_sync_redis():
    global _sync_redis_client
    url = get_redis_url()
    if not url:
        return None
    if _sync_redis_client is not None:
        return _sync_redis_client
    with _sync_lock:
        if _sync_redis_client is not None:
            return _sync_redis_client
        try:
            import redis  # type: ignore

            _sync_redis_client = redis.Redis.from_url(
                url,
                socket_connect_timeout=1.5,
                socket_timeout=1.5,
                decode_responses=True,
            )
            return _sync_redis_client
        except Exception:
            return None


async def _get_async_redis():
    global _async_redis_client
    url = get_redis_url()
    if not url:
        return None
    if _async_redis_client is not None:
        return _async_redis_client
    try:
        import redis.asyncio as aioredis  # type: ignore

        _async_redis_client = aioredis.from_url(
            url,
            socket_connect_timeout=1.5,
            socket_timeout=2.0,
            decode_responses=True,
        )
        return _async_redis_client
    except Exception:
        return None


async def ping_redis_async() -> Optional[bool]:
    """
    Returns:
      None  -> REDIS_URL not configured (standalone mode)
      True  -> Redis reachable
      False -> REDIS_URL configured but Redis unreachable
    """
    if not is_cluster_enabled():
        return None
    try:
        client = await _get_async_redis()
        if client is None:
            return False
        res = await asyncio.wait_for(client.ping(), timeout=1.5)
        return bool(res)
    except Exception:
        return False


async def publish_event(channel: str, payload: Dict[str, Any]) -> bool:
    """Publishes a cluster event tagged with NODE_ID so the sender ignores its own echo."""
    if not is_cluster_enabled():
        return False
    try:
        client = await _get_async_redis()
        if client is None:
            return False
        envelope = {
            "origin_node": NODE_ID,
            "ts": time.time(),
            "data": payload,
        }
        await asyncio.wait_for(
            client.publish(channel, json.dumps(envelope, default=str)),
            timeout=1.5,
        )
        return True
    except Exception:
        return False


def publish_settings_invalidation_sync() -> bool:
    """Called synchronously from save_settings() so peer Nornia nodes reload settings_db."""
    if not is_cluster_enabled():
        return False
    try:
        client = _get_sync_redis()
        if client is None:
            return False
        envelope = {
            "origin_node": NODE_ID,
            "ts": time.time(),
            "data": {"action": "reload_settings"},
        }
        client.publish(CHANNEL_SETTINGS_RELOAD, json.dumps(envelope))
        return True
    except Exception:
        return False


async def try_acquire_leader_lock(lock_name: str, ttl_seconds: int = 45) -> bool:
    """
    Distributed leader lock for periodic background jobs (IMAP poller, telemetry,
    retention cleanup, hotel wakeup scheduler).
    - Standalone (no REDIS_URL): always returns True.
    - Cluster (REDIS_URL set): returns True only if this node holds or acquires the lock.
    """
    if not is_cluster_enabled():
        return True
    key = f"nornia:leader:{lock_name}"
    try:
        client = await _get_async_redis()
        if client is None:
            return True
        acquired = await asyncio.wait_for(
            client.set(key, NODE_ID, nx=True, ex=max(5, int(ttl_seconds))),
            timeout=1.5,
        )
        if acquired:
            return True
        owner = await asyncio.wait_for(client.get(key), timeout=1.5)
        if owner == NODE_ID:
            await asyncio.wait_for(
                client.expire(key, max(5, int(ttl_seconds))),
                timeout=1.5,
            )
            return True
        return False
    except Exception:
        # Fail-open only if Redis transiently hiccups so critical timers keep working
        return True


def start_cluster_subscriber(
    on_ws_transcript: Optional[Callable[[str, str, str], Awaitable[None]]] = None,
    on_ws_omnichannel: Optional[Callable[[dict, Optional[str]], Awaitable[None]]] = None,
    on_settings_reload: Optional[Callable[[], Any]] = None,
) -> None:
    """Starts the background Redis Pub/Sub listener when REDIS_URL is configured."""
    global _subscriber_task
    if not is_cluster_enabled():
        return
    if _subscriber_task is not None and not _subscriber_task.done():
        return

    async def _loop():
        while True:
            pubsub = None
            try:
                import redis.asyncio as aioredis  # type: ignore

                sub_client = aioredis.from_url(
                    get_redis_url(),
                    socket_connect_timeout=3.0,
                    decode_responses=True,
                )
                pubsub = sub_client.pubsub()
                await pubsub.subscribe(
                    CHANNEL_WS_TRANSCRIPT,
                    CHANNEL_WS_OMNICHANNEL,
                    CHANNEL_SETTINGS_RELOAD,
                )
                print(f"[ClusterBus] Subscribed to Redis HA channels as node '{NODE_ID}'")
                async for raw_msg in pubsub.listen():
                    if not isinstance(raw_msg, dict) or raw_msg.get("type") != "message":
                        continue
                    channel = str(raw_msg.get("channel") or "")
                    try:
                        envelope = json.loads(raw_msg.get("data") or "{}")
                    except Exception:
                        continue
                    if envelope.get("origin_node") == NODE_ID:
                        continue
                    data = envelope.get("data") if isinstance(envelope.get("data"), dict) else {}

                    if channel == CHANNEL_WS_TRANSCRIPT and on_ws_transcript:
                        await on_ws_transcript(
                            str(data.get("call_id") or ""),
                            str(data.get("speaker") or ""),
                            str(data.get("text") or ""),
                        )
                    elif channel == CHANNEL_WS_OMNICHANNEL and on_ws_omnichannel:
                        ev = data.get("event")
                        if isinstance(ev, dict):
                            await on_ws_omnichannel(ev, data.get("tenant_id"))
                    elif channel == CHANNEL_SETTINGS_RELOAD and on_settings_reload:
                        res = on_settings_reload()
                        if asyncio.iscoroutine(res):
                            await res
            except asyncio.CancelledError:
                break
            except Exception as exc:
                print(f"[ClusterBus] Reconnecting after error: {exc}")
                await asyncio.sleep(3.0)
            finally:
                if pubsub is not None:
                    try:
                        await pubsub.close()
                    except Exception:
                        pass

    try:
        loop = asyncio.get_running_loop()
        _subscriber_task = loop.create_task(_loop())
    except RuntimeError:
        pass
