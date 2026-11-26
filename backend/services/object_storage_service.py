"""
Nornia Enterprise AI PBX — Opt-In S3 / MinIO Object Storage Service.

Zero external SDK dependency: uses pure-Python AWS Signature V4 over httpx.
Strictly opt-in via S3_ENDPOINT environment variable (used in Nornia Spark,
Nornia Midgard, and Nornia Odin HA deployments). When S3_ENDPOINT is unset,
all methods return cleanly without touching the network.
"""

from __future__ import annotations

import datetime
import hashlib
import hmac
import os
from typing import Dict, Optional, Tuple
from urllib.parse import quote, urlparse

import httpx


def get_s3_config() -> Dict[str, str]:
    endpoint = (os.getenv("S3_ENDPOINT") or "").strip().rstrip("/")
    return {
        "endpoint": endpoint,
        "access_key": (os.getenv("S3_ACCESS_KEY") or "").strip(),
        "secret_key": (os.getenv("S3_SECRET_KEY") or "").strip(),
        "bucket": (os.getenv("S3_BUCKET") or "nornia-recordings").strip(),
        "region": (os.getenv("S3_REGION") or "us-east-1").strip(),
        "prefix": (os.getenv("S3_PREFIX") or "recordings").strip().strip("/"),
        "verify_tls": (os.getenv("S3_VERIFY_TLS") or "1").strip(),
    }


def is_s3_enabled() -> bool:
    cfg = get_s3_config()
    return bool(cfg["endpoint"] and cfg["access_key"] and cfg["secret_key"])


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _sign_v4(
    method: str,
    url: str,
    access_key: str,
    secret_key: str,
    region: str,
    payload: bytes = b"",
    extra_headers: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    parsed = urlparse(url)
    host = parsed.netloc
    canonical_uri = quote(parsed.path or "/", safe="/-_.~")
    canonical_query = parsed.query or ""

    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(payload).hexdigest()

    headers: Dict[str, str] = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if extra_headers:
        for k, v in extra_headers.items():
            headers[k.lower()] = str(v)

    sorted_keys = sorted(headers.keys())
    canonical_headers = "".join(f"{k}:{headers[k].strip()}\n" for k in sorted_keys)
    signed_headers = ";".join(sorted_keys)

    canonical_request = "\n".join([
        method.upper(),
        canonical_uri,
        canonical_query,
        canonical_headers,
        signed_headers,
        payload_hash,
    ])
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])

    k_date = _hmac_sha256(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _hmac_sha256(k_date, region)
    k_service = _hmac_sha256(k_region, "s3")
    k_signing = _hmac_sha256(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    authorization = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    out = {k: v for k, v in headers.items() if k != "host"}
    out["Authorization"] = authorization
    return out


def _build_object_url(object_name: str, cfg: Dict[str, str]) -> str:
    clean_name = os.path.basename(object_name).lstrip("/")
    key = f"{cfg['prefix']}/{clean_name}" if cfg["prefix"] else clean_name
    return f"{cfg['endpoint']}/{cfg['bucket']}/{key}"


async def ensure_bucket_exists_async() -> bool:
    if not is_s3_enabled():
        return False
    cfg = get_s3_config()
    bucket_url = f"{cfg['endpoint']}/{cfg['bucket']}"
    verify = cfg["verify_tls"] != "0"
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=verify) as client:
            h_head = _sign_v4("HEAD", bucket_url, cfg["access_key"], cfg["secret_key"], cfg["region"])
            r_head = await client.head(bucket_url, headers=h_head)
            if r_head.status_code in (200, 301, 403):
                return True
            h_put = _sign_v4("PUT", bucket_url, cfg["access_key"], cfg["secret_key"], cfg["region"])
            r_put = await client.put(bucket_url, headers=h_put)
            return r_put.status_code in (200, 201, 409)
    except Exception:
        return False


async def upload_recording_async(
    local_path: str,
    object_name: Optional[str] = None,
    content_type: str = "audio/wav",
) -> Tuple[bool, str]:
    """Uploads a local recording file to MinIO/S3. Returns (ok, message)."""
    if not is_s3_enabled():
        return False, "s3_disabled"
    if not local_path or not os.path.isfile(local_path) or os.path.getsize(local_path) <= 0:
        return False, "file_missing_or_empty"

    cfg = get_s3_config()
    obj_name = object_name or os.path.basename(local_path)
    url = _build_object_url(obj_name, cfg)
    verify = cfg["verify_tls"] != "0"

    try:
        with open(local_path, "rb") as f:
            data = f.read()
        headers = _sign_v4(
            "PUT",
            url,
            cfg["access_key"],
            cfg["secret_key"],
            cfg["region"],
            payload=data,
            extra_headers={"content-type": content_type},
        )
        async with httpx.AsyncClient(timeout=30.0, verify=verify) as client:
            res = await client.put(url, content=data, headers=headers)
            if res.status_code in (200, 201, 204):
                return True, url
            if res.status_code == 404:
                await ensure_bucket_exists_async()
                res2 = await client.put(url, content=data, headers=headers)
                if res2.status_code in (200, 201, 204):
                    return True, url
                return False, f"http_{res2.status_code}"
            return False, f"http_{res.status_code}"
    except Exception as exc:
        return False, str(exc)


async def fetch_recording_bytes_async(object_name: str) -> Optional[bytes]:
    """Downloads a recording object from MinIO/S3 on demand for browser playback."""
    if not is_s3_enabled():
        return None
    cfg = get_s3_config()
    url = _build_object_url(object_name, cfg)
    verify = cfg["verify_tls"] != "0"
    try:
        headers = _sign_v4("GET", url, cfg["access_key"], cfg["secret_key"], cfg["region"])
        async with httpx.AsyncClient(timeout=20.0, verify=verify) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200 and res.content:
                return res.content
    except Exception:
        pass
    return None


async def check_s3_health_async() -> Optional[bool]:
    if not is_s3_enabled():
        return None
    cfg = get_s3_config()
    url = f"{cfg['endpoint']}/{cfg['bucket']}"
    verify = cfg["verify_tls"] != "0"
    try:
        headers = _sign_v4("HEAD", url, cfg["access_key"], cfg["secret_key"], cfg["region"])
        async with httpx.AsyncClient(timeout=2.5, verify=verify) as client:
            res = await client.head(url, headers=headers)
            return res.status_code in (200, 404, 403)
    except Exception:
        return False
