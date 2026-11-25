"""
Nornia PBX — Server & System Services Control Service.

Provides safe, allowlisted management of PBX Linux host services (PM2 & systemd),
live host telemetry (CPU, RAM, Disk, Uptime, Active Calls), service log viewing,
and delayed host Reboot / Poweroff actions with Active Call awareness.
"""

import datetime
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple


# Strict service allowlist — NEVER accepts arbitrary unit/process names from clients.
MANAGED_SERVICES: List[Dict[str, Any]] = [
    {
        "id": "asterisk",
        "name": "Asterisk IP Santral",
        "description": "SIP / PJSIP çağrı yönlendirme, RTP ses akışı ve AMI (5038) çekirdeği",
        "kind": "systemd",
        "unit": "asterisk",
        "category": "pbx",
        "critical": True,
        "allowed_actions": ["start", "stop", "restart", "reload"],
        "stop_warning": "Asterisk durdurulursa tüm aktif telefon görüşmeleri kesilir ve gelen/giden aramalar çalışmaz.",
    },
    {
        "id": "aida-backend",
        "name": "Nornia Backend & AI Motoru",
        "description": "FastAPI API (8000), AudioSocket AI (9092) ve DFKS Sunucusu (5068)",
        "kind": "pm2",
        "unit": "aida-backend",
        "category": "app",
        "critical": True,
        "allowed_actions": ["restart"],
        "stop_warning": "Backend yeniden başlatılırken panel bağlantısı 3–5 saniye kesilir ve otomatik geri gelir.",
    },
    {
        "id": "aida-app",
        "name": "Nornia Web Arayüzü (Next.js)",
        "description": "Yönetici & Temsilci web arayüzü (PM2)",
        "kind": "pm2",
        "unit": "aida-app",
        "category": "app",
        "critical": False,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "Web arayüzü durdurulursa tarayıcıdan panele erişilemez (API çalışmaya devam eder).",
    },
    {
        "id": "postgresql",
        "name": "PostgreSQL Veritabanı",
        "description": "Çağrı kayıtları (CDR), kullanıcılar, rehber ve ayar veritabanı (Port 5444)",
        "kind": "systemd",
        "unit": "postgresql",
        "category": "infra",
        "critical": True,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "Veritabanı durdurulursa oturum açma, çağrı kayıtları ve ayar güncellemeleri çalışmaz.",
    },
    {
        "id": "nginx",
        "name": "Nginx Web & WSS Ters Vekil",
        "description": "HTTP (80) Oto-Provizyon, HTTPS (443) Panel ve WebRTC WSS köprüsü",
        "kind": "systemd",
        "unit": "nginx",
        "category": "infra",
        "critical": True,
        "allowed_actions": ["start", "stop", "restart", "reload"],
        "stop_warning": "Nginx durdurulursa HTTPS web paneline ve WebRTC telefon bağlantısına erişim kesilir.",
    },
    {
        "id": "fail2ban",
        "name": "Fail2Ban Güvenlik Kalkanı",
        "description": "SIP / SSH kaba kuvvet (brute-force) saldırı engelleme servisi",
        "kind": "systemd",
        "unit": "fail2ban",
        "category": "security",
        "critical": False,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "Fail2Ban durdurulursa otomatik IP engelleme geçici olarak devre dışı kalır.",
    },
    {
        "id": "wg-nornia",
        "name": "Nornia Connect WireGuard Tüneli",
        "description": "Merkezi Hub / SIP Edge güvenli WireGuard ağ tüneli (wg-nornia)",
        "kind": "systemd",
        "unit": "wg-quick@wg-nornia",
        "category": "network",
        "critical": False,
        "optional": True,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "WireGuard tüneli durdurulursa uzak şube telefonları (WAN) ve bulut köprüsü kopar.",
    },
    {
        "id": "chrony",
        "name": "NTP Zaman Senkronizasyonu",
        "description": "Sunucu ve IP telefon saat eşitleme servisi (chrony / timesyncd)",
        "kind": "systemd",
        "unit": "chrony",
        "fallback_unit": "systemd-timesyncd",
        "category": "infra",
        "critical": False,
        "optional": True,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "Zaman senkronizasyonu durursa sunucu saati zamanla kayabilir.",
    },
    {
        "id": "ssh",
        "name": "OpenSSH Uzak Konsol Servisi",
        "description": "SSH sunucusu (Uzaktan sistem yönetimi)",
        "kind": "systemd",
        "unit": "ssh",
        "fallback_unit": "sshd",
        "category": "network",
        "critical": False,
        "optional": True,
        "allowed_actions": ["start", "stop", "restart"],
        "stop_warning": "SSH durdurulursa terminal üzerinden SSH bağlantısı açılamaz.",
    },
]

_SERVICE_MAP: Dict[str, Dict[str, Any]] = {s["id"]: s for s in MANAGED_SERVICES}


def _now_tr_str() -> str:
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")


def _is_linux_host() -> bool:
    return platform.system().lower() == "linux"


def _cmd_prefix() -> List[str]:
    """Use `sudo -n` if running non-root on Linux; run directly when already root."""
    if not _is_linux_host():
        return []
    try:
        if os.geteuid() == 0:
            return []
    except Exception:
        pass
    return ["sudo", "-n"]


def _run_cmd(args: List[str], timeout: float = 8.0, use_sudo: bool = False) -> Tuple[int, str, str]:
    full_cmd = (_cmd_prefix() + args) if use_sudo else args
    try:
        res = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        return res.returncode, (res.stdout or "").strip(), (res.stderr or "").strip()
    except FileNotFoundError:
        return 127, "", f"Komut bulunamadı: {args[0]}"
    except subprocess.TimeoutExpired:
        return 124, "", f"Komut zaman aşımına uğradı ({timeout}s)"
    except Exception as exc:
        return 1, "", str(exc)


def _format_uptime(seconds: float) -> str:
    sec = max(0, int(seconds))
    days, rem = divmod(sec, 86400)
    hours, rem = divmod(rem, 3600)
    mins, _ = divmod(rem, 60)
    parts = []
    if days > 0:
        parts.append(f"{days} gün")
    if hours > 0 or days > 0:
        parts.append(f"{hours} saat")
    parts.append(f"{mins} dk")
    return " ".join(parts)


def _read_os_pretty_name() -> str:
    if _is_linux_host() and os.path.isfile("/etc/os-release"):
        try:
            with open("/etc/os-release", "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return f"{platform.system()} {platform.release()}"


def _read_uptime_seconds() -> float:
    if _is_linux_host() and os.path.isfile("/proc/uptime"):
        try:
            with open("/proc/uptime", "r", encoding="utf-8") as f:
                return float(f.read().split()[0])
        except Exception:
            pass
    return 0.0


def _read_memory_info() -> Dict[str, Any]:
    if _is_linux_host() and os.path.isfile("/proc/meminfo"):
        try:
            vals: Dict[str, int] = {}
            with open("/proc/meminfo", "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v_tok = parts[1].strip().split()[0]
                        if v_tok.isdigit():
                            vals[k] = int(v_tok) * 1024  # bytes
            total = vals.get("MemTotal", 0)
            avail = vals.get("MemAvailable", vals.get("MemFree", 0))
            used = max(0, total - avail)
            pct = round((used / total) * 100, 1) if total > 0 else 0.0
            return {
                "total_gb": round(total / (1024 ** 3), 2),
                "used_gb": round(used / (1024 ** 3), 2),
                "percent": pct,
            }
        except Exception:
            pass
    return {"total_gb": 0.0, "used_gb": 0.0, "percent": 0.0}


def _read_disk_info(path: str = "/") -> Dict[str, Any]:
    try:
        du = shutil.disk_usage(path)
        pct = round((du.used / du.total) * 100, 1) if du.total > 0 else 0.0
        return {
            "total_gb": round(du.total / (1024 ** 3), 1),
            "used_gb": round(du.used / (1024 ** 3), 1),
            "free_gb": round(du.free / (1024 ** 3), 1),
            "percent": pct,
        }
    except Exception:
        return {"total_gb": 0.0, "used_gb": 0.0, "free_gb": 0.0, "percent": 0.0}


def _get_pm2_map() -> Dict[str, Dict[str, Any]]:
    pm2_bin = shutil.which("pm2")
    if not pm2_bin:
        return {}
    rc, out, _ = _run_cmd([pm2_bin, "jlist"], timeout=4.0, use_sudo=False)
    if rc != 0 or not out:
        return {}
    try:
        raw = json.loads(out)
        res: Dict[str, Dict[str, Any]] = {}
        for proc in raw if isinstance(raw, list) else []:
            if not isinstance(proc, dict):
                continue
            name = str(proc.get("name") or "").strip()
            if not name:
                continue
            env = proc.get("pm2_env") or {}
            mon = proc.get("monit") or {}
            st_raw = str(env.get("status") or "stopped").lower()
            pm_uptime = env.get("pm_uptime")
            up_str = ""
            if st_raw == "online" and pm_uptime:
                try:
                    up_sec = max(0, (time.time() * 1000 - float(pm_uptime)) / 1000.0)
                    up_str = _format_uptime(up_sec)
                except Exception:
                    pass
            res[name] = {
                "installed": True,
                "active": st_raw == "online",
                "status": "running" if st_raw == "online" else ("errored" if st_raw == "errored" else "stopped"),
                "sub_state": st_raw,
                "pid": int(proc.get("pid") or 0),
                "memory_mb": round(float(mon.get("memory") or 0) / (1024 * 1024), 1),
                "cpu_percent": float(mon.get("cpu") or 0),
                "restarts": int(env.get("restart_time") or 0),
                "uptime": up_str,
            }
        return res
    except Exception:
        return {}


def _inspect_systemd_unit(unit_name: str) -> Dict[str, Any]:
    systemctl_bin = shutil.which("systemctl")
    if not _is_linux_host() or not systemctl_bin:
        return {
            "installed": False,
            "active": False,
            "status": "unavailable",
            "sub_state": "non-linux",
            "pid": 0,
            "memory_mb": 0.0,
            "enabled": False,
            "uptime": "",
        }
    rc, out, _ = _run_cmd(
        [
            systemctl_bin,
            "show",
            unit_name,
            "--no-pager",
            "--property=LoadState,ActiveState,SubState,MainPID,MemoryCurrent,UnitFileState,ActiveEnterTimestampMonotonic",
        ],
        timeout=3.0,
        use_sudo=False,
    )
    props: Dict[str, str] = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            props[k.strip()] = v.strip()

    load_state = props.get("LoadState", "not-found")
    if load_state in ("not-found", ""):
        return {
            "installed": False,
            "active": False,
            "status": "not_installed",
            "sub_state": "not-found",
            "pid": 0,
            "memory_mb": 0.0,
            "enabled": False,
            "uptime": "",
        }

    act_state = props.get("ActiveState", "inactive").lower()
    sub_state = props.get("SubState", "").lower()
    pid = int(props.get("MainPID") or 0) if str(props.get("MainPID") or "").isdigit() else 0
    mem_raw = props.get("MemoryCurrent", "")
    mem_mb = 0.0
    if mem_raw.isdigit():
        mem_i = int(mem_raw)
        if 0 < mem_i < (1 << 60):
            mem_mb = round(mem_i / (1024 * 1024), 1)
    unit_file_state = props.get("UnitFileState", "").lower()

    status_norm = "running" if act_state == "active" else (
        "failed" if act_state == "failed" else (
            "restarting" if act_state in ("activating", "reloading") else "stopped"
        )
    )
    return {
        "installed": True,
        "active": act_state == "active",
        "status": status_norm,
        "sub_state": sub_state or act_state,
        "pid": pid,
        "memory_mb": mem_mb,
        "enabled": unit_file_state in ("enabled", "static", "enabled-runtime"),
        "uptime": "",
    }


def _resolve_effective_unit(svc: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    unit = svc["unit"]
    info = _inspect_systemd_unit(unit)
    if not info.get("installed") and svc.get("fallback_unit"):
        fb_info = _inspect_systemd_unit(svc["fallback_unit"])
        if fb_info.get("installed"):
            return svc["fallback_unit"], fb_info
    return unit, info


def get_server_control_overview(active_calls_count: int = 0) -> Dict[str, Any]:
    """Returns host hardware/OS telemetry + live status of all allowlisted managed services."""
    is_linux = _is_linux_host()
    cpu_cores = os.cpu_count() or 1
    try:
        l1, l5, l15 = os.getloadavg()
        load_avg = [round(l1, 2), round(l5, 2), round(l15, 2)]
        cpu_pct = min(100.0, round((l1 / max(1, cpu_cores)) * 100.0, 1))
    except Exception:
        load_avg = [0.0, 0.0, 0.0]
        cpu_pct = 0.0

    up_sec = _read_uptime_seconds()
    host_info = {
        "hostname": socket.gethostname(),
        "os_name": _read_os_pretty_name(),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "is_linux": is_linux,
        "control_supported": is_linux and bool(shutil.which("systemctl") or shutil.which("pm2")),
        "uptime_seconds": int(up_sec),
        "uptime_human": _format_uptime(up_sec) if up_sec > 0 else "Bilinmiyor",
        "cpu_cores": cpu_cores,
        "cpu_percent": cpu_pct,
        "load_avg": load_avg,
        "memory": _read_memory_info(),
        "disk": _read_disk_info("/"),
        "active_calls_count": int(active_calls_count or 0),
        "server_time_tr": _now_tr_str(),
    }

    pm2_map = _get_pm2_map()
    services_out: List[Dict[str, Any]] = []
    for svc in MANAGED_SERVICES:
        item = {
            "id": svc["id"],
            "name": svc["name"],
            "description": svc["description"],
            "kind": svc["kind"],
            "unit": svc["unit"],
            "category": svc["category"],
            "critical": bool(svc.get("critical", False)),
            "allowed_actions": list(svc.get("allowed_actions") or []),
            "stop_warning": svc.get("stop_warning") or "",
        }
        if svc["kind"] == "pm2":
            p_info = pm2_map.get(svc["unit"])
            if p_info:
                item.update(p_info)
            else:
                item.update({
                    "installed": bool(shutil.which("pm2")),
                    "active": False,
                    "status": "stopped" if shutil.which("pm2") else "unavailable",
                    "sub_state": "not-in-pm2",
                    "pid": 0,
                    "memory_mb": 0.0,
                    "cpu_percent": 0.0,
                    "restarts": 0,
                    "uptime": "",
                })
        else:
            eff_unit, s_info = _resolve_effective_unit(svc)
            item["unit"] = eff_unit
            item.update(s_info)
            if svc.get("optional") and not s_info.get("installed") and is_linux:
                continue
        services_out.append(item)

    return {
        "host": host_info,
        "services": services_out,
    }


def _spawn_delayed_command(args: List[str], delay_seconds: float = 2.0, use_sudo: bool = True) -> None:
    """
    Launches a detached background Python one-liner that sleeps `delay_seconds` and executes `args`
    with shell=False, allowing FastAPI to cleanly flush the HTTP 200 response before restart/reboot.
    """
    full_cmd = (_cmd_prefix() + args) if use_sudo else args
    helper_code = (
        "import time, subprocess, sys; "
        f"time.sleep({float(delay_seconds):.2f}); "
        f"subprocess.run({json.dumps(full_cmd)}, check=False)"
    )
    subprocess.Popen(
        [sys.executable, "-c", helper_code],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        close_fds=True,
    )


def execute_service_action(service_id: str, action: str) -> Dict[str, Any]:
    """Executes an allowlisted action (start/stop/restart/reload) on an allowlisted managed service."""
    svc = _SERVICE_MAP.get(str(service_id or "").strip())
    if not svc:
        raise ValueError("Bilinmeyen veya yönetim dışı servis.")

    act = str(action or "").strip().lower()
    if act not in (svc.get("allowed_actions") or []):
        raise ValueError(f"'{svc['name']}' servisi için '{act}' işlemine izin verilmiyor.")

    if not _is_linux_host():
        raise RuntimeError(
            "Sunucu servis kontrolü yalnızca canlı Linux (Ubuntu) santral sunucusunda çalışır (yerel geliştirme ortamında devre dışı)."
        )

    # 1. PM2 services
    if svc["kind"] == "pm2":
        pm2_bin = shutil.which("pm2")
        if not pm2_bin:
            raise RuntimeError("PM2 ikili dosyası sunucuda bulunamadı.")
        unit = svc["unit"]
        # Self-restart protection: defer aida-backend restart by 1.5s so HTTP 200 reaches browser cleanly!
        if unit == "aida-backend":
            _spawn_delayed_command([pm2_bin, "restart", unit], delay_seconds=1.5, use_sudo=False)
            return {
                "ok": True,
                "delayed": True,
                "service_id": service_id,
                "action": act,
                "message": "Nornia Backend servisi 2 saniye içinde yeniden başlatılıyor; arayüz otomatik olarak tekrar bağlanacak.",
            }
        rc, out, err = _run_cmd([pm2_bin, act, unit], timeout=12.0, use_sudo=False)
        if rc != 0:
            raise RuntimeError(err or out or f"PM2 {act} başarısız (kod: {rc}).")
        return {
            "ok": True,
            "delayed": False,
            "service_id": service_id,
            "action": act,
            "message": f"{svc['name']} servisi için '{act}' işlemi başarıyla tamamlandı.",
            "output": (out or err)[:400],
        }

    # 2. Systemd services
    systemctl_bin = shutil.which("systemctl")
    if not systemctl_bin:
        raise RuntimeError("systemctl komutu sunucuda bulunamadı.")

    eff_unit, _ = _resolve_effective_unit(svc)

    # Special zero-drop reloads for Asterisk & Nginx
    if act == "reload" and service_id == "asterisk":
        ast_bin = shutil.which("asterisk")
        if ast_bin:
            rc, out, err = _run_cmd([ast_bin, "-rx", "core reload"], timeout=10.0, use_sudo=True)
            if rc == 0:
                return {
                    "ok": True,
                    "delayed": False,
                    "service_id": service_id,
                    "action": act,
                    "message": "Asterisk yapılandırması aktif çağrılar kesilmeden yenilendi (core reload).",
                    "output": out[:400],
                }
            raise RuntimeError(err or out or f"Asterisk reload başarısız (kod: {rc}).")

    if act == "reload" and service_id == "nginx":
        nginx_bin = shutil.which("nginx")
        if nginx_bin:
            rc_t, out_t, err_t = _run_cmd([nginx_bin, "-t"], timeout=5.0, use_sudo=True)
            if rc_t != 0:
                raise RuntimeError(f"Nginx yapılandırma testi başarısız, reload iptal edildi: {err_t or out_t}")

    # Defer stopping/restarting Nginx by 1.5s so the HTTP response returns to the browser before proxy restarts!
    if service_id == "nginx" and act in ("stop", "restart"):
        _spawn_delayed_command([systemctl_bin, act, eff_unit], delay_seconds=1.5, use_sudo=True)
        return {
            "ok": True,
            "delayed": True,
            "service_id": service_id,
            "action": act,
            "message": f"Nginx servisi 2 saniye içinde {'yeniden başlatılıyor' if act == 'restart' else 'durduruluyor'}.",
        }

    rc, out, err = _run_cmd([systemctl_bin, act, eff_unit], timeout=20.0, use_sudo=True)
    if rc != 0:
        raise RuntimeError(err or out or f"systemctl {act} {eff_unit} başarısız (kod: {rc}).")

    tr_action = {
        "start": "başlatıldı",
        "stop": "durduruldu",
        "restart": "yeniden başlatıldı",
        "reload": "yenilendi",
    }.get(act, act)
    return {
        "ok": True,
        "delayed": False,
        "service_id": service_id,
        "action": act,
        "message": f"{svc['name']} ({eff_unit}) başarıyla {tr_action}.",
        "output": (out or err)[:400],
    }


def schedule_host_power_action(action: str, delay_seconds: float = 3.0) -> Dict[str, Any]:
    """Schedules a clean delayed Linux host reboot or poweroff (shutdown)."""
    act = str(action or "").strip().lower()
    if act not in ("reboot", "poweroff"):
        raise ValueError("Geçersiz güç komutu. Yalnızca 'reboot' veya 'poweroff' desteklenir.")

    if not _is_linux_host():
        raise RuntimeError(
            "Sunucu yeniden başlatma / kapatma işlemi yalnızca canlı Linux (Ubuntu) santral sunucusunda çalışır."
        )

    systemctl_bin = shutil.which("systemctl")
    shutdown_bin = shutil.which("shutdown")
    if systemctl_bin:
        cmd = [systemctl_bin, "reboot"] if act == "reboot" else [systemctl_bin, "poweroff"]
    elif shutdown_bin:
        cmd = [shutdown_bin, "-r", "now"] if act == "reboot" else [shutdown_bin, "-h", "now"]
    else:
        raise RuntimeError("Sunucuda 'systemctl' veya 'shutdown' komutu bulunamadı.")

    _spawn_delayed_command(cmd, delay_seconds=max(2.0, min(10.0, float(delay_seconds))), use_sudo=True)
    return {
        "ok": True,
        "action": act,
        "delay_seconds": delay_seconds,
        "message": (
            "Sunucu yeniden başlatma komutu verildi. Sistem yaklaşık 3 saniye içinde kapanıp 30–60 saniye içinde tekrar açılacaktır."
            if act == "reboot"
            else "Sunucu kapatma (Power Off) komutu verildi. Sistem yaklaşık 3 saniye içinde güvenli biçimde kapanacaktır."
        ),
    }


def get_service_logs(service_id: str, lines: int = 80) -> Dict[str, Any]:
    """Reads the latest log lines for an allowlisted managed service."""
    svc = _SERVICE_MAP.get(str(service_id or "").strip())
    if not svc:
        raise ValueError("Bilinmeyen veya yönetim dışı servis.")

    safe_lines = max(10, min(300, int(lines or 80)))
    if not _is_linux_host():
        return {
            "service_id": service_id,
            "service_name": svc["name"],
            "unit": svc["unit"],
            "lines": f"[Bilgi] Canlı sistem logları yalnızca Ubuntu Linux sunucusunda kullanılabilir ({platform.system()}).",
        }

    if svc["kind"] == "pm2":
        pm2_bin = shutil.which("pm2")
        if not pm2_bin:
            return {"service_id": service_id, "service_name": svc["name"], "unit": svc["unit"], "lines": "PM2 bulunamadı."}
        rc, out, err = _run_cmd([pm2_bin, "logs", svc["unit"], "--lines", str(safe_lines), "--nostream"], timeout=5.0, use_sudo=False)
        txt = (out + ("\n" + err if err else "")).strip() or "Log kaydı bulunamadı."
        return {"service_id": service_id, "service_name": svc["name"], "unit": svc["unit"], "lines": txt}

    eff_unit, _ = _resolve_effective_unit(svc)
    jctl_bin = shutil.which("journalctl")
    if not jctl_bin:
        return {"service_id": service_id, "service_name": svc["name"], "unit": eff_unit, "lines": "journalctl bulunamadı."}
    rc, out, err = _run_cmd([jctl_bin, "-u", eff_unit, "-n", str(safe_lines), "--no-pager"], timeout=5.0, use_sudo=True)
    txt = (out or err or "Log kaydı bulunamadı.").strip()
    return {"service_id": service_id, "service_name": svc["name"], "unit": eff_unit, "lines": txt}
