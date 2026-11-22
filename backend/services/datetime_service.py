import datetime
import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_SYSTEM_DATETIME: Dict[str, Any] = {
    "timezone": "Europe/Istanbul",
    "utc_offset": "+3",
    "ntp_enabled": True,
    "ntp_server_primary": "pool.ntp.org",
    "ntp_server_secondary": "tr.pool.ntp.org",
    "date_format": "DD.MM.YYYY",
    "time_format": "24",
    "default_language": "Turkish",
    "manual_datetime": "",
}


TIMEZONE_CATALOG: List[Dict[str, str]] = [
    {"id": "Europe/Istanbul", "label": "Türkiye — İstanbul (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Turkey(Ankara)"},
    {"id": "UTC", "label": "UTC — Evrensel Zaman (UTC+00:00)", "utc_offset": "0", "yealink_name": "United Kingdom(London)"},
    {"id": "Europe/London", "label": "Birleşik Krallık — Londra (UTC+00:00)", "utc_offset": "0", "yealink_name": "United Kingdom(London)"},
    {"id": "Europe/Berlin", "label": "Almanya — Berlin (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Germany(Berlin)"},
    {"id": "Europe/Paris", "label": "Fransa — Paris (UTC+01:00)", "utc_offset": "+1", "yealink_name": "France(Paris)"},
    {"id": "Europe/Amsterdam", "label": "Hollanda — Amsterdam (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Netherlands(Amsterdam)"},
    {"id": "Europe/Brussels", "label": "Belçika — Brüksel (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Belgium(Brussels)"},
    {"id": "Europe/Vienna", "label": "Avusturya — Viyana (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Austria(Vienna)"},
    {"id": "Europe/Zurich", "label": "İsviçre — Zürih (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Switzerland(Bern)"},
    {"id": "Europe/Madrid", "label": "İspanya — Madrid (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Spain(Madrid)"},
    {"id": "Europe/Rome", "label": "İtalya — Roma (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Italy(Rome)"},
    {"id": "Europe/Warsaw", "label": "Polonya — Varşova (UTC+01:00)", "utc_offset": "+1", "yealink_name": "Poland(Warsaw)"},
    {"id": "Europe/Athens", "label": "Yunanistan — Atina (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Greece(Athens)"},
    {"id": "Europe/Bucharest", "label": "Romanya — Bükreş (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Romania(Bucharest)"},
    {"id": "Europe/Sofia", "label": "Bulgaristan — Sofya (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Bulgaria(Sofia)"},
    {"id": "Asia/Nicosia", "label": "Kıbrıs — Lefkoşa (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Cyprus(Nicosia)"},
    {"id": "Europe/Kyiv", "label": "Ukrayna — Kiev (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Ukraine(Kiev)"},
    {"id": "Africa/Cairo", "label": "Mısır — Kahire (UTC+02:00)", "utc_offset": "+2", "yealink_name": "Egypt(Cairo)"},
    {"id": "Europe/Moscow", "label": "Rusya — Moskova (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Russia(Moscow)"},
    {"id": "Asia/Riyadh", "label": "Suudi Arabistan — Riyad (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Saudi Arabia(Riyadh)"},
    {"id": "Asia/Qatar", "label": "Katar — Doha (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Qatar(Doha)"},
    {"id": "Asia/Kuwait", "label": "Kuveyt (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Kuwait(Kuwait)"},
    {"id": "Asia/Baghdad", "label": "Irak — Bağdat (UTC+03:00)", "utc_offset": "+3", "yealink_name": "Iraq(Baghdad)"},
    {"id": "Asia/Baku", "label": "Azerbaycan — Bakü (UTC+04:00)", "utc_offset": "+4", "yealink_name": "Azerbaijan(Baku)"},
    {"id": "Asia/Dubai", "label": "BAE — Dubai (UTC+04:00)", "utc_offset": "+4", "yealink_name": "UAE(Dubai)"},
    {"id": "Asia/Tbilisi", "label": "Gürcistan — Tiflis (UTC+04:00)", "utc_offset": "+4", "yealink_name": "Georgia(Tbilisi)"},
    {"id": "Asia/Tashkent", "label": "Özbekistan — Taşkent (UTC+05:00)", "utc_offset": "+5", "yealink_name": "Uzbekistan(Tashkent)"},
    {"id": "Asia/Almaty", "label": "Kazakistan — Almatı (UTC+05:00)", "utc_offset": "+5", "yealink_name": "Kazakhstan(Almaty)"},
    {"id": "Asia/Karachi", "label": "Pakistan — Karaçi (UTC+05:00)", "utc_offset": "+5", "yealink_name": "Pakistan(Islamabad)"},
    {"id": "Asia/Kolkata", "label": "Hindistan — Yeni Delhi (UTC+05:30)", "utc_offset": "+5:30", "yealink_name": "India(Calcutta)"},
    {"id": "Asia/Bangkok", "label": "Tayland — Bangkok (UTC+07:00)", "utc_offset": "+7", "yealink_name": "Thailand(Bangkok)"},
    {"id": "Asia/Singapore", "label": "Singapur (UTC+08:00)", "utc_offset": "+8", "yealink_name": "Singapore(Singapore)"},
    {"id": "Asia/Shanghai", "label": "Çin — Pekin / Şanghay (UTC+08:00)", "utc_offset": "+8", "yealink_name": "China(Beijing)"},
    {"id": "Asia/Tokyo", "label": "Japonya — Tokyo (UTC+09:00)", "utc_offset": "+9", "yealink_name": "Japan(Tokyo)"},
    {"id": "Australia/Sydney", "label": "Avustralya — Sidney (UTC+10:00)", "utc_offset": "+10", "yealink_name": "Australia(Sydney)"},
    {"id": "America/New_York", "label": "ABD — Doğu / New York (UTC-05:00)", "utc_offset": "-5", "yealink_name": "United States-Eastern Time"},
    {"id": "America/Chicago", "label": "ABD — Merkez / Chicago (UTC-06:00)", "utc_offset": "-6", "yealink_name": "United States-Central Time"},
    {"id": "America/Denver", "label": "ABD — Dağ / Denver (UTC-07:00)", "utc_offset": "-7", "yealink_name": "United States-Mountain Time"},
    {"id": "America/Los_Angeles", "label": "ABD — Pasifik / Los Angeles (UTC-08:00)", "utc_offset": "-8", "yealink_name": "United States-Pacific Time"},
    {"id": "America/Toronto", "label": "Kanada — Toronto (UTC-05:00)", "utc_offset": "-5", "yealink_name": "Canada(Toronto)"},
    {"id": "America/Sao_Paulo", "label": "Brezilya — São Paulo (UTC-03:00)", "utc_offset": "-3", "yealink_name": "Brazil(DST)"},
]

SUPPORTED_DATE_FORMATS = ["DD.MM.YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"]
SUPPORTED_LANGUAGES = [
    {"id": "Turkish", "code": "tr", "label": "Türkçe (Varsayılan)"},
    {"id": "English", "code": "en", "label": "English"},
]


def _lookup_tz_meta(tz_id: str) -> Dict[str, str]:
    clean = str(tz_id or "").strip()
    for item in TIMEZONE_CATALOG:
        if item["id"].lower() == clean.lower():
            return item
    return TIMEZONE_CATALOG[0]


def get_system_datetime_config(settings_db: Optional[dict]) -> Dict[str, Any]:
    raw = (settings_db or {}).get("system_datetime") if isinstance(settings_db, dict) else None
    merged = dict(DEFAULT_SYSTEM_DATETIME)
    if isinstance(raw, dict):
        for k in DEFAULT_SYSTEM_DATETIME:
            if k in raw and raw[k] is not None:
                merged[k] = raw[k]
    meta = _lookup_tz_meta(str(merged.get("timezone") or "Europe/Istanbul"))
    merged["timezone"] = meta["id"]
    merged["utc_offset"] = str(merged.get("utc_offset") or meta["utc_offset"]).strip() or meta["utc_offset"]
    merged["yealink_tz_name"] = meta["yealink_name"]
    if str(merged.get("date_format") or "") not in SUPPORTED_DATE_FORMATS:
        merged["date_format"] = "DD.MM.YYYY"
    if str(merged.get("time_format") or "") not in ("24", "12"):
        merged["time_format"] = "24"
    lang_raw = str(merged.get("default_language") or "Turkish").strip()
    merged["default_language"] = "English" if lang_raw.lower() in ("english", "en") else "Turkish"
    merged["ntp_enabled"] = bool(merged.get("ntp_enabled", True))
    merged["ntp_server_primary"] = str(merged.get("ntp_server_primary") or "pool.ntp.org").strip() or "pool.ntp.org"
    merged["ntp_server_secondary"] = str(merged.get("ntp_server_secondary") or "").strip()
    return merged


def _run_cmd(args: List[str], timeout_s: float = 2.0) -> Tuple[bool, str]:
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout_s, check=False)
        out = (proc.stdout or proc.stderr or "").strip()
        return proc.returncode == 0, out
    except Exception as e:
        return False, str(e)


def _read_os_clock_info() -> Dict[str, Any]:
    now_local = datetime.datetime.now().astimezone()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    info: Dict[str, Any] = {
        "os_supported": False,
        "os_timezone": str(now_local.tzinfo or "UTC"),
        "ntp_active": False,
        "ntp_synchronized": False,
        "server_time_iso": now_local.isoformat(),
        "server_time_display": now_local.strftime("%Y-%m-%d %H:%M:%S"),
        "server_utc_iso": now_utc.isoformat(),
        "server_epoch_ms": int(now_utc.timestamp() * 1000),
    }
    if shutil.which("timedatectl"):
        ok, raw = _run_cmd(["timedatectl", "show"], timeout_s=2.0)
        if ok and raw:
            info["os_supported"] = True
            kv = {}
            for line in raw.splitlines():
                if "=" in line:
                    k, _, v = line.partition("=")
                    kv[k.strip()] = v.strip()
            if kv.get("Timezone"):
                info["os_timezone"] = kv["Timezone"]
            info["ntp_active"] = kv.get("NTP", "").lower() == "yes"
            info["ntp_synchronized"] = kv.get("NTPSynchronized", "").lower() == "yes"
    return info


def get_system_datetime_status(settings_db: Optional[dict]) -> Dict[str, Any]:
    cfg = get_system_datetime_config(settings_db)
    os_info = _read_os_clock_info()
    return {
        "status": "success",
        "config": cfg,
        "live": os_info,
        "timezones": TIMEZONE_CATALOG,
        "date_formats": SUPPORTED_DATE_FORMATS,
        "languages": SUPPORTED_LANGUAGES,
    }


def _sanitize_ntp_host(val: str) -> str:
    s = str(val or "").strip()
    if not s:
        return ""
    if not re.match(r"^[a-zA-Z0-9._-]{2,128}$", s):
        return ""
    return s


def apply_system_datetime_settings(payload: Dict[str, Any], settings_db: dict) -> Dict[str, Any]:
    prev = get_system_datetime_config(settings_db)
    tz_in = str(payload.get("timezone") or prev["timezone"]).strip()
    tz_meta = _lookup_tz_meta(tz_in)

    ntp_enabled = bool(payload.get("ntp_enabled", prev["ntp_enabled"]))
    ntp_primary = _sanitize_ntp_host(payload.get("ntp_server_primary", prev["ntp_server_primary"])) or "pool.ntp.org"
    ntp_secondary = _sanitize_ntp_host(payload.get("ntp_server_secondary", prev["ntp_server_secondary"]))
    date_format = str(payload.get("date_format") or prev["date_format"]).strip()
    if date_format not in SUPPORTED_DATE_FORMATS:
        date_format = "DD.MM.YYYY"
    time_format = str(payload.get("time_format") or prev["time_format"]).strip()
    if time_format not in ("24", "12"):
        time_format = "24"
    lang_in = str(payload.get("default_language") or prev["default_language"]).strip()
    default_lang = "English" if lang_in.lower() in ("english", "en") else "Turkish"
    manual_dt = str(payload.get("manual_datetime") or "").strip()

    new_cfg = {
        "timezone": tz_meta["id"],
        "utc_offset": tz_meta["utc_offset"],
        "yealink_tz_name": tz_meta["yealink_name"],
        "ntp_enabled": ntp_enabled,
        "ntp_server_primary": ntp_primary,
        "ntp_server_secondary": ntp_secondary,
        "date_format": date_format,
        "time_format": time_format,
        "default_language": default_lang,
        "manual_datetime": manual_dt if not ntp_enabled else "",
    }
    settings_db["system_datetime"] = new_cfg

    os_notes: List[str] = []
    os_applied = False
    if shutil.which("timedatectl"):
        ok_tz, out_tz = _run_cmd(["timedatectl", "set-timezone", tz_meta["id"]], timeout_s=2.5)
        if ok_tz:
            os_applied = True
            os_notes.append(f"Saat dilimi {tz_meta['id']} olarak uygulandı.")
        elif out_tz:
            os_notes.append(f"Saat dilimi OS uyarısı: {out_tz}")

        if ntp_enabled:
            try:
                conf_dir = "/etc/systemd/timesyncd.conf.d"
                if os.path.isdir("/etc/systemd"):
                    os.makedirs(conf_dir, exist_ok=True)
                    ntp_line = f"NTP={ntp_primary}"
                    fb_line = f"FallbackNTP={ntp_secondary}" if ntp_secondary else "FallbackNTP=time.google.com time.cloudflare.com"
                    with open(os.path.join(conf_dir, "nornia.conf"), "w", encoding="utf-8") as fp:
                        fp.write(f"[Time]\n{ntp_line}\n{fb_line}\n")
                    _run_cmd(["systemctl", "restart", "systemd-timesyncd"], timeout_s=2.5)
            except Exception as e_ntp:
                os_notes.append(f"NTP yapılandırma uyarısı: {e_ntp}")
            ok_ntp, out_ntp = _run_cmd(["timedatectl", "set-ntp", "true"], timeout_s=2.5)
            if ok_ntp:
                os_applied = True
                os_notes.append(f"Otomatik NTP ({ntp_primary}) etkinleştirildi.")
            elif out_ntp:
                os_notes.append(f"NTP uyarısı: {out_ntp}")
        else:
            _run_cmd(["timedatectl", "set-ntp", "false"], timeout_s=2.5)
            if manual_dt:
                # Accept ISO ("2026-11-22T03:15" or "2026-11-22 03:15:00")
                norm_dt = manual_dt.replace("T", " ").strip()
                if len(norm_dt) == 16:
                    norm_dt += ":00"
                if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", norm_dt):
                    ok_tm, out_tm = _run_cmd(["timedatectl", "set-time", norm_dt], timeout_s=2.5)
                    if ok_tm:
                        os_applied = True
                        os_notes.append(f"Manuel saat ({norm_dt}) uygulandı.")
                    elif out_tm:
                        os_notes.append(f"Manuel saat uyarısı: {out_tm}")

    return {
        "status": "success",
        "config": new_cfg,
        "os_applied": os_applied,
        "notes": os_notes,
        "live": _read_os_clock_info(),
        "message": "Sistem tarih, saat dilimi ve bölge ayarları kaydedildi.",
    }


def sync_ntp_now(settings_db: dict) -> Dict[str, Any]:
    cfg = get_system_datetime_config(settings_db)
    notes: List[str] = []
    synced = False
    if shutil.which("chronyc"):
        ok, out = _run_cmd(["chronyc", "makestep"], timeout_s=3.0)
        if ok:
            synced = True
            notes.append(f"chrony makestep: {out or 'OK'}")
    elif shutil.which("systemctl") and shutil.which("timedatectl"):
        _run_cmd(["timedatectl", "set-ntp", "true"], timeout_s=2.5)
        ok, out = _run_cmd(["systemctl", "restart", "systemd-timesyncd"], timeout_s=3.0)
        if ok:
            synced = True
            notes.append("systemd-timesyncd yeniden başlatıldı ve eşitleme tetiklendi.")
        elif out:
            notes.append(out)
    else:
        notes.append("Bu ortamda Linux systemd-timesyncd bulunamadı; ayarlar aktif profilde saklandı.")

    live = _read_os_clock_info()
    return {
        "status": "success",
        "synced": synced or bool(live.get("ntp_synchronized")),
        "notes": notes,
        "config": cfg,
        "live": live,
        "message": "NTP zaman eşitleme isteği tamamlandı." if synced else "Zaman durumu güncellendi.",
    }
