import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text

WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

DEFAULT_SHIFT_CONFIG: Dict[str, Any] = {
    "enabled": True,
    "shift_name": "Standart Gündüz (09:00 - 18:00)",
    "start_time": "09:00",
    "end_time": "18:00",
    "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "planned_break_minutes": 60,
    "tolerance_minutes": 5,
}

SHIFT_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "day_09_18",
        "shift_name": "Standart Gündüz (09:00 - 18:00)",
        "start_time": "09:00",
        "end_time": "18:00",
        "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "planned_break_minutes": 60,
        "tolerance_minutes": 5,
    },
    {
        "id": "early_08_17",
        "shift_name": "Erken Vardiya (08:00 - 17:00)",
        "start_time": "08:00",
        "end_time": "17:00",
        "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "planned_break_minutes": 60,
        "tolerance_minutes": 5,
    },
    {
        "id": "mid_11_20",
        "shift_name": "Öğlen Vardiyası (11:00 - 20:00)",
        "start_time": "11:00",
        "end_time": "20:00",
        "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "planned_break_minutes": 60,
        "tolerance_minutes": 5,
    },
    {
        "id": "evening_14_23",
        "shift_name": "Akşam Vardiyası (14:00 - 23:00)",
        "start_time": "14:00",
        "end_time": "23:00",
        "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
        "planned_break_minutes": 60,
        "tolerance_minutes": 5,
    },
    {
        "id": "night_22_07",
        "shift_name": "Gece Vardiyası (22:00 - 07:00)",
        "start_time": "22:00",
        "end_time": "07:00",
        "work_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "planned_break_minutes": 60,
        "tolerance_minutes": 5,
    },
]


async def ensure_agent_session_table_async(db_session) -> None:
    """Safely creates agent_session_logs table if not present yet."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS agent_session_logs (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR DEFAULT 'tenant-default',
            user_id VARCHAR,
            extension VARCHAR,
            agent_name VARCHAR,
            login_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            logout_time TIMESTAMP WITHOUT TIME ZONE,
            duration_seconds INTEGER DEFAULT 0,
            logout_reason VARCHAR DEFAULT 'active',
            disconnect_count INTEGER DEFAULT 0,
            ip_address VARCHAR
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_agent_session_logs_tenant_login ON agent_session_logs (tenant_id, login_time DESC);",
        "CREATE INDEX IF NOT EXISTS ix_agent_session_logs_ext_open ON agent_session_logs (extension, logout_time);",
    ]
    for stmt in ddl_statements:
        await db_session.execute(text(stmt))
    await db_session.commit()


def _parse_hm(hm_str: str, default_h: int = 9, default_m: int = 0) -> Tuple[int, int]:
    try:
        parts = str(hm_str or "").strip().split(":")
        if len(parts) >= 2:
            h = max(0, min(23, int(parts[0])))
            m = max(0, min(59, int(parts[1])))
            return (h, m)
    except Exception:
        pass
    return (default_h, default_m)


def normalize_shift_config(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return dict(DEFAULT_SHIFT_CONFIG)
    sh, sm = _parse_hm(raw.get("start_time") or "09:00", 9, 0)
    eh, em = _parse_hm(raw.get("end_time") or "18:00", 18, 0)
    start_s = f"{sh:02d}:{sm:02d}"
    end_s = f"{eh:02d}:{em:02d}"
    raw_days = raw.get("work_days")
    if isinstance(raw_days, list) and raw_days:
        work_days = [d for d in raw_days if d in WEEKDAY_KEYS]
        if not work_days:
            work_days = list(DEFAULT_SHIFT_CONFIG["work_days"])
    else:
        work_days = list(DEFAULT_SHIFT_CONFIG["work_days"])
    return {
        "enabled": bool(raw.get("enabled", True)),
        "shift_name": str(raw.get("shift_name") or f"Vardiya ({start_s} - {end_s})").strip(),
        "start_time": start_s,
        "end_time": end_s,
        "work_days": work_days,
        "planned_break_minutes": max(0, min(240, int(raw.get("planned_break_minutes", 60) or 0))),
        "tolerance_minutes": max(0, min(60, int(raw.get("tolerance_minutes", 5) or 0))),
    }


def get_tenant_agent_shifts(settings_db: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
    tid = str(tenant_id or "tenant-default").strip() or "tenant-default"
    all_shifts = settings_db.get("agent_shifts")
    if not isinstance(all_shifts, dict):
        all_shifts = {}
    t_cfg = all_shifts.get(tid) or all_shifts.get("tenant-default") or {}
    if not isinstance(t_cfg, dict):
        t_cfg = {}

    default_shift = normalize_shift_config(t_cfg.get("default_shift"))
    raw_by_ext = t_cfg.get("by_extension") if isinstance(t_cfg.get("by_extension"), dict) else {}
    by_extension: Dict[str, Dict[str, Any]] = {}
    for ext_k, val in raw_by_ext.items():
        ek = str(ext_k or "").strip()
        if ek and isinstance(val, dict):
            by_extension[ek] = normalize_shift_config(val)

    return {
        "default_shift": default_shift,
        "by_extension": by_extension,
        "presets": SHIFT_PRESETS,
    }


def resolve_agent_shift(tenant_shifts: Dict[str, Any], extension: str) -> Dict[str, Any]:
    ek = str(extension or "").strip()
    by_ext = tenant_shifts.get("by_extension") or {}
    if ek and ek in by_ext:
        return by_ext[ek]
    return tenant_shifts.get("default_shift") or dict(DEFAULT_SHIFT_CONFIG)


def compute_shift_span_seconds(start_time: str, end_time: str) -> int:
    sh, sm = _parse_hm(start_time, 9, 0)
    eh, em = _parse_hm(end_time, 18, 0)
    start_min = sh * 60 + sm
    end_min = eh * 60 + em
    if end_min <= start_min:
        end_min += 24 * 60
    return max(3600, (end_min - start_min) * 60)


def evaluate_daily_shift_adherence(
    tr_day_str: str,
    shift_cfg: Dict[str, Any],
    first_login_tr: Optional[datetime.datetime],
    last_logout_tr: Optional[datetime.datetime],
    actual_break_seconds: int,
    now_tr: datetime.datetime,
    has_explicit_logout: bool = False,
) -> Dict[str, Any]:
    """
    Evaluates a single calendar day (TR local time) against the agent's planned shift.
    Returns late_login_minutes, early_logout_minutes, planned_seconds, adherence_pct.
    """
    try:
        day_dt = datetime.datetime.strptime(tr_day_str[:10], "%Y-%m-%d")
    except Exception:
        return {
            "is_scheduled_day": False,
            "planned_seconds": 0,
            "late_login_minutes": 0,
            "early_logout_minutes": 0,
            "over_break_minutes": 0,
            "adherence_pct": 100.0,
        }

    weekday_key = WEEKDAY_KEYS[day_dt.weekday()]
    is_scheduled = bool(shift_cfg.get("enabled", True)) and (
        weekday_key in (shift_cfg.get("work_days") or WEEKDAY_KEYS[:5])
    )
    sh, sm = _parse_hm(shift_cfg.get("start_time", "09:00"), 9, 0)
    eh, em = _parse_hm(shift_cfg.get("end_time", "18:00"), 18, 0)

    planned_start_tr = day_dt.replace(hour=sh, minute=sm, second=0, microsecond=0)
    planned_end_tr = day_dt.replace(hour=eh, minute=em, second=0, microsecond=0)
    if planned_end_tr <= planned_start_tr:
        planned_end_tr += datetime.timedelta(days=1)

    planned_span_sec = max(3600, int((planned_end_tr - planned_start_tr).total_seconds()))
    planned_break_sec = int(shift_cfg.get("planned_break_minutes", 60) or 0) * 60
    tol_sec = int(shift_cfg.get("tolerance_minutes", 5) or 0) * 60

    late_min = 0
    if first_login_tr is not None:
        diff_late = (first_login_tr - planned_start_tr).total_seconds()
        if diff_late > tol_sec:
            late_min = int(round(diff_late / 60.0))

    early_min = 0
    if last_logout_tr is not None:
        # Only count early logout if shift already ended OR agent explicitly logged out before shift end
        shift_already_ended = now_tr >= planned_end_tr
        if shift_already_ended or has_explicit_logout:
            diff_early = (planned_end_tr - last_logout_tr).total_seconds()
            if diff_early > tol_sec:
                early_min = int(round(diff_early / 60.0))

    over_break_sec = max(0, int(actual_break_seconds or 0) - planned_break_sec)
    over_break_min = int(round(over_break_sec / 60.0))

    # Adherence % = (Planned Shift - Deviations) / Planned Shift
    # If shift is still in progress today, scale denominator to elapsed planned shift so far
    if now_tr < planned_end_tr and now_tr > planned_start_tr:
        effective_planned = max(1800, int((now_tr - planned_start_tr).total_seconds()))
    else:
        effective_planned = planned_span_sec

    deviation_sec = (late_min * 60) + (early_min * 60) + over_break_sec
    adherence_pct = round(
        max(0.0, min(100.0, ((effective_planned - deviation_sec) / max(1, effective_planned)) * 100.0)),
        1,
    )

    return {
        "is_scheduled_day": is_scheduled,
        "planned_seconds": planned_span_sec,
        "late_login_minutes": late_min,
        "early_logout_minutes": early_min,
        "over_break_minutes": over_break_min,
        "adherence_pct": adherence_pct,
    }
