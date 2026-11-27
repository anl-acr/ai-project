import asyncio
import datetime
import math
import os
import statistics
import struct
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select

from backend.database.config import AsyncSessionLocal
from backend.database.models import Call, PBXQueue, SystemUser

# Default acoustic shouting detection parameters (configurable in Ayarlar -> Dinamik Duygu Yönetimi)
DEFAULT_ACOUSTIC_SHOUT_CONFIG: Dict[str, Any] = {
    "acoustic_shout_enabled": True,
    "acoustic_delta_db": 12.0,          # Müşterinin normal konuşma tabanının kaç dB üstü bağırma sayılır (6-22 dB)
    "acoustic_min_peak_dbfs": -14.0,    # Minimum mutlak ses şiddeti eşiği (-24 .. -4 dBFS)
    "acoustic_min_duration_sec": 2,     # En az kaç saniye ardışık bağırma olmalı (1-6 sn; öksürük/gürültü filtresi)
    "acoustic_alert_sound": True,       # Süpervizör ekranında canlı popup ile birlikte uyarı sesi çalsın mı
}

# Active live acoustic tracking state (in-memory, keyed by call_id)
_LIVE_CALL_STATES: Dict[str, Dict[str, Any]] = {}
_LIVE_ACOUSTIC_ALERTS: Dict[str, Dict[str, Any]] = {}
_MONITOR_TASK: Optional[asyncio.Task] = None


def _norm_tid(tid: Optional[str]) -> str:
    s = str(tid or "tenant-default").strip().lower()
    if s in ("", "default", "tenant-default", "all", "global"):
        return "tenant-default"
    return s


def get_acoustic_shout_config(settings_db: Optional[dict] = None) -> Dict[str, Any]:
    """Reads customer acoustic shout detection thresholds from PBX settings."""
    pbx = {}
    if isinstance(settings_db, dict):
        pbx = settings_db.get("pbx") if isinstance(settings_db.get("pbx"), dict) else {}
    else:
        try:
            from backend.main import settings_db as _global_settings
            pbx = _global_settings.get("pbx") if isinstance(_global_settings.get("pbx"), dict) else {}
        except Exception:
            pbx = {}

    enabled = pbx.get("acoustic_shout_enabled")
    if enabled is None:
        enabled = DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_shout_enabled"]

    try:
        delta_db = float(pbx.get("acoustic_delta_db", DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_delta_db"]))
    except Exception:
        delta_db = DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_delta_db"]
    delta_db = max(5.0, min(25.0, delta_db))

    try:
        min_peak_dbfs = float(pbx.get("acoustic_min_peak_dbfs", DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_min_peak_dbfs"]))
    except Exception:
        min_peak_dbfs = DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_min_peak_dbfs"]
    min_peak_dbfs = max(-28.0, min(-3.0, min_peak_dbfs))

    try:
        min_dur = int(pbx.get("acoustic_min_duration_sec", DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_min_duration_sec"]))
    except Exception:
        min_dur = DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_min_duration_sec"]
    min_dur = max(1, min(8, min_dur))

    alert_sound = pbx.get("acoustic_alert_sound")
    if alert_sound is None:
        alert_sound = DEFAULT_ACOUSTIC_SHOUT_CONFIG["acoustic_alert_sound"]

    return {
        "acoustic_shout_enabled": bool(enabled),
        "acoustic_delta_db": round(delta_db, 1),
        "acoustic_min_peak_dbfs": round(min_peak_dbfs, 1),
        "acoustic_min_duration_sec": min_dur,
        "acoustic_alert_sound": bool(alert_sound),
    }


def _is_outbound_call(caller_number: str, callee_number: str, known_extensions: Optional[Set[str]] = None) -> bool:
    caller_s = str(caller_number or "").strip()
    callee_s = str(callee_number or "").strip()
    caller_digits = "".join(ch for ch in caller_s if ch.isdigit())
    callee_digits = "".join(ch for ch in callee_s if ch.isdigit())
    if known_extensions and caller_s in known_extensions and callee_s not in known_extensions:
        return True
    # Short internal extension dialing an external number
    if caller_digits and len(caller_digits) <= 5 and callee_digits and len(callee_digits) >= 7:
        return True
    return False


def resolve_customer_wav_path(
    call_id: str,
    caller_number: str = "",
    callee_number: str = "",
    known_extensions: Optional[Set[str]] = None,
) -> Tuple[Optional[str], str]:
    """
    Finds the customer-only audio WAV recording for a call.
    Asterisk MixMonitor writes:
      - {call_id}_rx.wav = audio received FROM the initiating channel (Customer on inbound calls)
      - {call_id}_tx.wav = audio transmitted TO the initiating channel (Customer on outbound calls)
    Falls back to combined {call_id}.wav if split channels are not available.
    """
    cid = str(call_id or "").strip()
    if not cid:
        return None, ""

    is_out = _is_outbound_call(caller_number, callee_number, known_extensions)
    preferred_suffixes = (
        [("_tx.wav", "tx_wav"), ("_rx.wav", "rx_wav"), (".wav", "mixed_wav")]
        if is_out
        else [("_rx.wav", "rx_wav"), (".wav", "mixed_wav")]
    )

    search_dirs = [
        "/var/spool/asterisk/monitor",
        "recordings",
        "/opt/ai-project/recordings",
        os.path.join(os.getcwd(), "recordings"),
    ]

    for suffix, src_label in preferred_suffixes:
        fname = f"{cid}{suffix}"
        for base_dir in search_dirs:
            full_path = os.path.join(base_dir, fname)
            try:
                if os.path.isfile(full_path) and os.path.getsize(full_path) > 44:
                    return full_path, src_label
            except Exception:
                continue
    return None, ""


def _parse_wav_header_info(header_bytes: bytes) -> Tuple[int, int, int, int]:
    """
    Parses standard RIFF/WAV header even while MixMonitor is actively streaming to disk
    (where data chunk size may still be 0 or stale).
    Returns (sample_rate, num_channels, bits_per_sample, data_offset).
    """
    sample_rate = 8000
    num_channels = 1
    bits_per_sample = 16
    data_offset = 44

    if len(header_bytes) < 44 or header_bytes[:4] != b"RIFF" or header_bytes[8:12] != b"WAVE":
        return sample_rate, num_channels, bits_per_sample, 0

    pos = 12
    total_len = len(header_bytes)
    while pos + 8 <= total_len:
        chunk_id = header_bytes[pos : pos + 4]
        chunk_size = struct.unpack_from("<I", header_bytes, pos + 4)[0]
        if chunk_id == b"fmt " and pos + 8 + 16 <= total_len:
            _audio_fmt, nch, sr, _br, _ba, bps = struct.unpack_from("<HHIIHH", header_bytes, pos + 8)
            if sr in (8000, 16000, 24000, 32000, 44100, 48000):
                sample_rate = sr
            if nch in (1, 2):
                num_channels = nch
            if bps in (8, 16):
                bits_per_sample = bps
        elif chunk_id == b"data":
            data_offset = pos + 8
            break
        if chunk_size <= 0:
            break
        pos += 8 + chunk_size + (chunk_size % 2)

    return sample_rate, num_channels, bits_per_sample, data_offset


def _compute_window_features(pcm_chunk: bytes, num_channels: int = 1, bits_per_sample: int = 16) -> Tuple[float, float, float]:
    """
    Computes (rms_dbfs, peak_dbfs, hf_ratio) for a raw PCM window.
    hf_ratio = high-frequency 1st-order difference energy ratio (distinguishes tense human shouting
    from low-frequency mic bumps / desk thumps).
    """
    if bits_per_sample != 16 or len(pcm_chunk) < 4:
        return -96.0, -96.0, 0.0

    frame_bytes = 2 * max(1, num_channels)
    usable_len = (len(pcm_chunk) // frame_bytes) * frame_bytes
    if usable_len < frame_bytes * 8:
        return -96.0, -96.0, 0.0

    total_samples = usable_len // 2
    samples = struct.unpack(f"<{total_samples}h", pcm_chunk[:usable_len])
    if num_channels == 2:
        samples = samples[0::2]

    n = len(samples)
    if n < 8:
        return -96.0, -96.0, 0.0

    sum_sq = 0.0
    diff_sq = 0.0
    peak = 0
    prev = samples[0]

    for s in samples:
        a = -s if s < 0 else s
        if a > peak:
            peak = a
        sum_sq += s * s
        d = s - prev
        diff_sq += d * d
        prev = s

    rms = math.sqrt(sum_sq / n)
    if rms < 1.0:
        return -96.0, -96.0, 0.0

    rms_dbfs = 20.0 * math.log10(max(rms, 1.0) / 32768.0)
    peak_dbfs = 20.0 * math.log10(max(float(peak), 1.0) / 32768.0)
    diff_rms = math.sqrt(diff_sq / n)
    hf_ratio = diff_rms / max(rms, 1.0)
    return rms_dbfs, peak_dbfs, hf_ratio


def _create_empty_state(call_id: str, tenant_id: str, source: str = "rx_wav") -> Dict[str, Any]:
    return {
        "call_id": call_id,
        "tenant_id": _norm_tid(tenant_id),
        "source": source,
        "file_path": None,
        "sample_rate": 8000,
        "num_channels": 1,
        "bits_per_sample": 16,
        "byte_offset": 0,
        "sec_index": 0,
        "speech_dbs": [],           # active speech RMS dBFS history (for adaptive baseline)
        "consecutive_shout": 0,
        "in_shout_event": False,
        "shout_count": 0,
        "shout_seconds": 0,
        "timestamps": [],           # start second of each detected shout event
        "peak_dbfs": -96.0,
        "max_rms_dbfs": -96.0,
        "max_delta_db": 0.0,
        "baseline_dbfs": -26.0,
        "last_shout_at": None,
        "last_persisted_shout_seconds": -1,
    }


def _process_pcm_into_state(
    state: Dict[str, Any],
    pcm_bytes: bytes,
    cfg: Dict[str, Any],
    now_iso: Optional[str] = None,
) -> bool:
    """
    Processes newly arrived PCM bytes in 1-second windows (evaluated via 4x250ms sub-frames)
    and updates acoustic state in-place. Returns True if a shout event was detected or extended.
    """
    sr = int(state.get("sample_rate") or 8000)
    nch = int(state.get("num_channels") or 1)
    bps = int(state.get("bits_per_sample") or 16)
    bytes_per_sec = sr * nch * (bps // 8)
    if bytes_per_sec <= 0 or len(pcm_bytes) < bytes_per_sec:
        return False

    delta_thresh = float(cfg.get("acoustic_delta_db", 12.0))
    min_peak_thresh = float(cfg.get("acoustic_min_peak_dbfs", -14.0))
    min_dur_sec = int(cfg.get("acoustic_min_duration_sec", 2))
    triggered_now = False

    n_full_secs = len(pcm_bytes) // bytes_per_sec
    sub_size = bytes_per_sec // 4

    for idx in range(n_full_secs):
        sec_chunk = pcm_bytes[idx * bytes_per_sec : (idx + 1) * bytes_per_sec]
        sec_num = int(state["sec_index"])
        state["sec_index"] = sec_num + 1

        # Evaluate 4 x 250ms sub-frames so a short 250ms silence inside a 1s shout doesn't dilute RMS
        sub_rms_list: List[float] = []
        sub_peak_max = -96.0
        sub_hf_list: List[float] = []
        for sf in range(4):
            sub_chunk = sec_chunk[sf * sub_size : (sf + 1) * sub_size]
            r_db, p_db, hf = _compute_window_features(sub_chunk, num_channels=nch, bits_per_sample=bps)
            if p_db > sub_peak_max:
                sub_peak_max = p_db
            if r_db > -45.0:
                sub_rms_list.append(r_db)
                sub_hf_list.append(hf)

        if not sub_rms_list:
            # Silent second resets consecutive shout counter
            state["consecutive_shout"] = 0
            state["in_shout_event"] = False
            continue

        # Top-2 energetic 250ms sub-frames represent the active vocal loudness of this second
        sub_rms_sorted = sorted(sub_rms_list, reverse=True)
        sec_rms_db = sum(sub_rms_sorted[:2]) / len(sub_rms_sorted[:2])
        sec_hf = max(sub_hf_list) if sub_hf_list else 0.0

        if sub_peak_max > state["peak_dbfs"]:
            state["peak_dbfs"] = round(sub_peak_max, 1)
        if sec_rms_db > state["max_rms_dbfs"]:
            state["max_rms_dbfs"] = round(sec_rms_db, 1)

        # Compute adaptive customer speech baseline BEFORE adding potential shout frame
        speech_hist: List[float] = state["speech_dbs"]
        if len(speech_hist) >= 2:
            raw_med = float(statistics.median(speech_hist))
            baseline_db = max(-36.0, min(-18.0, raw_med))
        else:
            baseline_db = -26.0
        state["baseline_dbfs"] = round(baseline_db, 1)

        delta_db = sec_rms_db - baseline_db
        if delta_db > state["max_delta_db"]:
            state["max_delta_db"] = round(delta_db, 1)

        # Shouting criterion:
        # 1) Above absolute loudness floor (min_peak_dbfs)
        # 2) Contains human vocal high-frequency energy (hf_ratio >= 0.08 filters pure low-freq mic bumps)
        # 3) Either significantly louder than customer's own baseline (+delta_db) OR hard vocal clipping (peak >= -2.5 dBFS)
        is_loud_shout = (
            sec_rms_db >= min_peak_thresh
            and sec_hf >= 0.08
            and (delta_db >= delta_thresh or (sub_peak_max >= -2.5 and sec_rms_db >= (min_peak_thresh - 2.0)))
        )

        # Only feed non-shouting active speech into baseline so prolonged yelling doesn't shift the baseline up
        if not is_loud_shout and len(speech_hist) < 300:
            speech_hist.append(sec_rms_db)

        if is_loud_shout:
            state["consecutive_shout"] = int(state["consecutive_shout"]) + 1
            if state["consecutive_shout"] >= min_dur_sec:
                if not state["in_shout_event"]:
                    state["in_shout_event"] = True
                    state["shout_count"] = int(state["shout_count"]) + 1
                    # Credit all consecutive shout seconds leading into this trigger
                    state["shout_seconds"] = int(state["shout_seconds"]) + int(state["consecutive_shout"])
                    event_start_sec = max(0, sec_num - min_dur_sec + 1)
                    if len(state["timestamps"]) < 50:
                        state["timestamps"].append(event_start_sec)
                else:
                    state["shout_seconds"] = int(state["shout_seconds"]) + 1
                state["last_shout_at"] = now_iso or (datetime.datetime.utcnow().isoformat() + "Z")
                triggered_now = True
        else:
            state["consecutive_shout"] = 0
            state["in_shout_event"] = False

    return triggered_now


def build_acoustic_metrics_summary(state: Dict[str, Any]) -> Dict[str, Any]:
    shout_count = int(state.get("shout_count") or 0)
    shout_seconds = int(state.get("shout_seconds") or 0)
    max_delta = float(state.get("max_delta_db") or 0.0)
    peak_dbfs = float(state.get("peak_dbfs") or -96.0)
    baseline_dbfs = float(state.get("baseline_dbfs") or -26.0)
    shout_detected = shout_count > 0 and shout_seconds > 0

    if shout_detected:
        # 55 base + up to 45 based on count, duration, and dB overshoot
        stress = min(
            100,
            int(round(55 + min(18, shout_count * 6) + min(17, shout_seconds * 2) + min(10, max(0.0, max_delta - 10.0)))),
        )
    else:
        stress = min(35, int(round(max(0.0, max_delta - 4.0) * 3.0)))

    return {
        "shout_detected": shout_detected,
        "shout_count": shout_count,
        "shout_seconds": shout_seconds,
        "peak_dbfs": round(peak_dbfs, 1),
        "baseline_dbfs": round(baseline_dbfs, 1),
        "max_delta_db": round(max_delta, 1),
        "stress_score": stress,
        "timestamps": list(state.get("timestamps") or []),
        "last_shout_at": state.get("last_shout_at"),
        "source": state.get("source") or "rx_wav",
        "analyzed_seconds": int(state.get("sec_index") or 0),
    }


def format_timestamp_mmss(sec: int) -> str:
    s = max(0, int(sec or 0))
    return f"{s // 60:02d}:{s % 60:02d}"


def analyze_wav_customer_shouting(
    wav_path: str,
    cfg: Optional[Dict[str, Any]] = None,
    source_label: str = "rx_wav",
) -> Optional[Dict[str, Any]]:
    """
    Synchronously analyzes a full WAV file (customer channel) and returns acoustic_metrics summary.
    """
    if not wav_path or not os.path.isfile(wav_path):
        return None
    eff_cfg = cfg or get_acoustic_shout_config()
    try:
        file_size = os.path.getsize(wav_path)
        if file_size <= 44:
            return None
        with open(wav_path, "rb") as f:
            hdr = f.read(256)
            sr, nch, bps, data_off = _parse_wav_header_info(hdr)
            state = _create_empty_state("offline", "tenant-default", source=source_label)
            state["sample_rate"] = sr
            state["num_channels"] = nch
            state["bits_per_sample"] = bps
            f.seek(data_off)
            pcm_all = f.read()
        _process_pcm_into_state(state, pcm_all, eff_cfg)
        return build_acoustic_metrics_summary(state)
    except Exception as e:
        print(f"[AcousticShout] Offline WAV analysis error ({wav_path}): {e}")
        return None


async def analyze_completed_call_acoustics(
    call_id: str,
    db_call: Optional[Call] = None,
    settings_db: Optional[dict] = None,
) -> Optional[Dict[str, Any]]:
    """
    Finalizes acoustic metrics for a completed call (using the full customer WAV file on disk).
    Used by call_analyzer.py to feed acoustic shouting evidence into LLM sentiment analysis and DB.
    """
    cfg = get_acoustic_shout_config(settings_db)
    if not cfg.get("acoustic_shout_enabled", True):
        return None

    caller_num = getattr(db_call, "caller_number", "") if db_call else ""
    callee_num = getattr(db_call, "callee_number", "") if db_call else ""
    wav_path, src_lbl = resolve_customer_wav_path(call_id, caller_num, callee_num)
    if not wav_path:
        # Return live state if we tracked one via memory/AudioSocket
        live_st = _LIVE_CALL_STATES.get(str(call_id))
        if live_st:
            return build_acoustic_metrics_summary(live_st)
        return getattr(db_call, "acoustic_metrics", None) if db_call else None

    return await asyncio.to_thread(analyze_wav_customer_shouting, wav_path, cfg, src_lbl)


def _extract_agent_and_queue_for_call(
    call: Call,
    users_list: List[Dict[str, Any]],
    queues_list: List[Dict[str, Any]],
) -> Tuple[str, str, str, str]:
    """
    Resolves (agent_user_id, agent_extension, agent_display_name, preferred_queue_name)
    for a live call using Call columns and live_extension_call_state.
    """
    agent_uid = ""
    agent_ext = ""
    agent_name = str(getattr(call, "agent_name", None) or "").strip()
    preferred_queue = ""

    hsrc = str(getattr(call, "hangup_source", None) or "").strip()
    if hsrc.lower().startswith("queue:"):
        preferred_queue = hsrc.split(":", 1)[1].strip()

    callee_s = str(getattr(call, "callee_number", None) or "").strip()
    caller_s = str(getattr(call, "caller_number", None) or "").strip()

    # Check if callee matches a queue extension/name
    for q in queues_list:
        q_ext = str(q.get("extension") or "").strip()
        q_name = str(q.get("name") or "").strip()
        if callee_s and callee_s in (q_ext, q_name):
            if not preferred_queue:
                preferred_queue = q_name or q_ext

    # Check live_extension_call_state for the active agent extension answering this call_id
    try:
        from backend.main import live_extension_call_state
        for ext_k, st_info in list(live_extension_call_state.items()):
            if isinstance(st_info, dict) and str(st_info.get("call_id") or "").strip() == str(call.id):
                agent_ext = str(ext_k).strip()
                break
    except Exception:
        pass

    # Match user from users_list by agent_ext, callee_s, caller_s, or agent_name
    user_by_ext: Dict[str, Dict[str, Any]] = {}
    user_by_name: Dict[str, Dict[str, Any]] = {}
    for u in users_list:
        u_ext = str(u.get("extension") or "").strip()
        u_name = str(u.get("name") or u.get("full_name") or "").strip()
        if u_ext:
            user_by_ext[u_ext] = u
        if u_name:
            user_by_name[u_name.lower()] = u

    matched_u = None
    if agent_ext and agent_ext in user_by_ext:
        matched_u = user_by_ext[agent_ext]
    elif callee_s in user_by_ext:
        matched_u = user_by_ext[callee_s]
    elif caller_s in user_by_ext:
        matched_u = user_by_ext[caller_s]
    elif agent_name:
        low_an = agent_name.lower()
        if low_an in user_by_name:
            matched_u = user_by_name[low_an]
        else:
            # Handle "Ahmet Yılmaz (1000)" format
            for ext_k, u in user_by_ext.items():
                if f"({ext_k})" in agent_name or ext_k == agent_name:
                    matched_u = u
                    break

    if matched_u:
        agent_uid = str(matched_u.get("id") or "").strip()
        agent_ext = str(matched_u.get("extension") or agent_ext or "").strip()
        agent_name = str(matched_u.get("name") or matched_u.get("full_name") or agent_name or agent_ext).strip()

    return agent_uid, agent_ext, (agent_name or agent_ext or "Temsilci"), preferred_queue


def _resolve_queue_supervisors_for_call(
    agent_uid: str,
    agent_ext: str,
    preferred_queue: str,
    queues_list: List[Dict[str, Any]],
    users_list: List[Dict[str, Any]],
) -> Tuple[List[str], List[str]]:
    """
    Strictly resolves the queue managers (PBXQueue.supervisors) of the queue(s)
    the agent belongs to (plus 'admin' / superadmin as escalation authority).
    Returns (supervisor_keys, matched_queue_names).
    """
    from backend.services.break_approval_service import _extract_id_tokens

    agent_keys = {k for k in (str(agent_uid or "").strip(), str(agent_ext or "").strip()) if k}
    supervisor_keys: Set[str] = {"admin"}
    matched_queues: List[str] = []

    user_key_groups: List[Set[str]] = []
    for u in users_list or []:
        if not isinstance(u, dict):
            continue
        grp = _extract_id_tokens(u)
        if grp:
            user_key_groups.append(grp)
        if str(u.get("role") or "").lower() in ("admin", "superadmin"):
            supervisor_keys.update(grp)

    def _expand_sup(tok: str) -> None:
        t = str(tok or "").strip()
        if not t:
            return
        supervisor_keys.add(t)
        for grp in user_key_groups:
            if t in grp:
                supervisor_keys.update(grp)

    for q in queues_list or []:
        if not isinstance(q, dict):
            continue
        q_name = str(q.get("name") or q.get("extension") or "").strip()
        q_ext = str(q.get("extension") or "").strip()

        members = q.get("queueMembers") or q.get("members") or []
        member_tokens: Set[str] = set()
        for m in members:
            member_tokens.update(_extract_id_tokens(m))

        is_member = bool(agent_keys & member_tokens)
        is_preferred = bool(
            preferred_queue
            and (
                (q_name and q_name.lower() == preferred_queue.lower())
                or (q_ext and q_ext == preferred_queue)
            )
        )
        if not is_member and not is_preferred:
            continue

        if q_name and q_name not in matched_queues:
            matched_queues.append(q_name)

        for s in (q.get("supervisors") or []):
            for tok in _extract_id_tokens(s):
                _expand_sup(tok)

    # Exclude the agent themselves (unless admin testing solo)
    for ak in agent_keys:
        if ak.lower() != "admin":
            supervisor_keys.discard(ak)

    return sorted(supervisor_keys), matched_queues


def get_live_acoustic_alerts(
    tenant_id: str,
    user_id: str = "",
    user_ext: str = "",
    user_role: str = "",
) -> List[Dict[str, Any]]:
    """
    Returns active live acoustic shout alerts visible to the requesting supervisor/admin.
    A queue manager sees ONLY alerts for agents in the queue(s) they manage!
    """
    req_tid = _norm_tid(tenant_id)
    uid_s = str(user_id or "").strip()
    ext_s = str(user_ext or "").strip()
    role_l = str(user_role or "").strip().lower()
    is_admin = role_l in ("admin", "superadmin") or uid_s.lower() == "admin"

    now_utc = datetime.datetime.utcnow()
    out: List[Dict[str, Any]] = []

    for cid, alert in list(_LIVE_ACOUSTIC_ALERTS.items()):
        if not isinstance(alert, dict):
            continue
        if _norm_tid(alert.get("tenant_id")) != req_tid:
            continue

        # Expire stale alerts if call stopped updating for > 20s
        upd_at = alert.get("_updated_at_dt")
        if isinstance(upd_at, datetime.datetime) and (now_utc - upd_at).total_seconds() > 25:
            _LIVE_ACOUSTIC_ALERTS.pop(cid, None)
            continue

        target_sups = set(str(x).strip() for x in (alert.get("target_supervisors") or []) if str(x).strip())
        if not is_admin:
            user_tokens = {k for k in (uid_s, ext_s) if k}
            if not (user_tokens & target_sups):
                continue

        clean = {k: v for k, v in alert.items() if not k.startswith("_")}
        out.append(clean)

    out.sort(key=lambda a: (0 if a.get("severity") == "critical" else 1, -int(a.get("stress_score") or 0)))
    return out


async def _scan_active_calls_once() -> None:
    cfg = get_acoustic_shout_config()
    if not cfg.get("acoustic_shout_enabled", True):
        _LIVE_ACOUSTIC_ALERTS.clear()
        return

    now_utc = datetime.datetime.utcnow()
    cutoff_utc = now_utc - datetime.timedelta(minutes=90)

    async with AsyncSessionLocal() as session:
        stmt_calls = select(Call).where(
            Call.status == "in_progress",
            Call.start_time >= cutoff_utc,
        )
        res_calls = await session.execute(stmt_calls)
        active_calls = list(res_calls.scalars().all())
        active_ids = {str(c.id) for c in active_calls}

        # Prune finished calls from live memory
        for stale_cid in list(_LIVE_CALL_STATES.keys()):
            if stale_cid not in active_ids:
                _LIVE_CALL_STATES.pop(stale_cid, None)
        for stale_cid in list(_LIVE_ACOUSTIC_ALERTS.keys()):
            if stale_cid not in active_ids:
                _LIVE_ACOUSTIC_ALERTS.pop(stale_cid, None)

        if not active_calls:
            return

        # Bulk load queues & users once per tick
        res_q = await session.execute(select(PBXQueue))
        all_queues = [
            {
                "id": q.id,
                "tenant_id": _norm_tid(getattr(q, "tenant_id", None)),
                "extension": q.extension,
                "name": q.name,
                "queueMembers": q.queueMembers or [],
                "supervisors": q.supervisors or [],
            }
            for q in res_q.scalars().all()
        ]

        res_u = await session.execute(select(SystemUser))
        all_users = [
            {
                "id": str(u.id),
                "tenant_id": _norm_tid(getattr(u, "tenant_id", None)),
                "extension": u.extension,
                "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.extension or str(u.id),
                "email": u.email,
                "role": u.role,
            }
            for u in res_u.scalars().all()
        ]
        known_exts = {str(u["extension"]).strip() for u in all_users if u.get("extension")}

        any_db_update = False

        for call in active_calls:
            cid = str(call.id)
            tid = _norm_tid(getattr(call, "tenant_id", None))

            wav_path, src_lbl = resolve_customer_wav_path(
                cid,
                caller_number=str(call.caller_number or ""),
                callee_number=str(call.callee_number or ""),
                known_extensions=known_exts,
            )
            if not wav_path:
                continue

            state = _LIVE_CALL_STATES.get(cid)
            if state is None or state.get("file_path") != wav_path:
                state = _create_empty_state(cid, tid, source=src_lbl)
                state["file_path"] = wav_path
                try:
                    with open(wav_path, "rb") as f_hdr:
                        hdr = f_hdr.read(256)
                    sr, nch, bps, data_off = _parse_wav_header_info(hdr)
                    state["sample_rate"] = sr
                    state["num_channels"] = nch
                    state["bits_per_sample"] = bps
                    state["byte_offset"] = data_off
                except Exception:
                    continue
                _LIVE_CALL_STATES[cid] = state

            sr = int(state.get("sample_rate") or 8000)
            nch = int(state.get("num_channels") or 1)
            bps = int(state.get("bits_per_sample") or 16)
            bytes_per_sec = sr * nch * (bps // 8)
            if bytes_per_sec <= 0:
                continue

            try:
                cur_size = os.path.getsize(wav_path)
            except Exception:
                continue

            unread = cur_size - int(state["byte_offset"])
            if unread >= bytes_per_sec:
                read_len = (unread // bytes_per_sec) * bytes_per_sec
                try:
                    with open(wav_path, "rb") as f_pcm:
                        f_pcm.seek(int(state["byte_offset"]))
                        new_pcm = f_pcm.read(read_len)
                    state["byte_offset"] = int(state["byte_offset"]) + len(new_pcm)
                except Exception:
                    continue
                _process_pcm_into_state(state, new_pcm, cfg, now_iso=now_utc.isoformat() + "Z")

            metrics = build_acoustic_metrics_summary(state)
            if metrics["shout_detected"]:
                tenant_users = [u for u in all_users if u["tenant_id"] == tid]
                tenant_queues = [q for q in all_queues if q["tenant_id"] == tid]
                ag_uid, ag_ext, ag_name, pref_q = _extract_agent_and_queue_for_call(call, tenant_users, tenant_queues)
                target_sups, matched_queues = _resolve_queue_supervisors_for_call(
                    ag_uid, ag_ext, pref_q, tenant_queues, tenant_users
                )
                dur_sec = max(0, int((now_utc - call.start_time.replace(tzinfo=None)).total_seconds())) if call.start_time else 0
                q_lbl = ", ".join(matched_queues) if matched_queues else (pref_q or "")
                severity = "critical" if (metrics["shout_seconds"] >= 4 or metrics["stress_score"] >= 75) else "warning"

                _LIVE_ACOUSTIC_ALERTS[cid] = {
                    "call_id": cid,
                    "tenant_id": tid,
                    "alert_type": "acoustic_shout",
                    "caller_number": call.caller_number,
                    "callee_number": call.callee_number,
                    "agent_name": ag_name,
                    "agent_extension": ag_ext,
                    "queue_name": q_lbl,
                    "target_supervisors": target_sups,
                    "severity": severity,
                    "stress_score": metrics["stress_score"],
                    "shout_count": metrics["shout_count"],
                    "shout_seconds": metrics["shout_seconds"],
                    "peak_dbfs": metrics["peak_dbfs"],
                    "max_delta_db": metrics["max_delta_db"],
                    "timestamps": metrics["timestamps"],
                    "alert_sound": bool(cfg.get("acoustic_alert_sound", True)),
                    "duration_sec": dur_sec,
                    "started_at": call.start_time.isoformat() if call.start_time else now_utc.isoformat(),
                    "_updated_at_dt": now_utc,
                }

                # Persist to DB whenever shout_seconds increases
                if metrics["shout_seconds"] != state.get("last_persisted_shout_seconds"):
                    call.acoustic_metrics = metrics
                    state["last_persisted_shout_seconds"] = metrics["shout_seconds"]
                    any_db_update = True

        if any_db_update:
            await session.commit()


async def _acoustic_shout_monitor_loop() -> None:
    print("[AcousticShout] Canlı müşteri ses şiddeti / bağırma dedektörü başlatıldı (2s tarama).")
    while True:
        try:
            await _scan_active_calls_once()
        except Exception as err:
            print(f"[AcousticShout Monitor Warning]: {err}")
        await asyncio.sleep(2.0)


def start_acoustic_shout_monitor() -> None:
    global _MONITOR_TASK
    if _MONITOR_TASK is not None and not _MONITOR_TASK.done():
        return
    try:
        _MONITOR_TASK = asyncio.create_task(_acoustic_shout_monitor_loop())
    except Exception as e:
        print(f"[AcousticShout Startup Error]: {e}")
