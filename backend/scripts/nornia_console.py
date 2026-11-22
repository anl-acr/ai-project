#!/usr/bin/env python3
"""
Nornia — Sunucu Fiziksel / VM Konsol (TTY1) Durum Panosu & /etc/issue Üretici
=============================================================================
Sunucu konsolunda (VMware, Proxmox, Hyper-V, iLO/iDRAC, fiziksel ekran) login
ekranının hemen üzerinde canlı IP, Web Kurulum/Panel URL (/setup), Donanım ID
ve servis durumlarını gösterir.

Kullanım:
  - Tek seferlik /etc/issue güncelleme : python3 nornia_console.py --write-issue
  - Sürekli arka plan servisi (daemon) : python3 nornia_console.py --daemon
  - Ekrana yazdırma                    : python3 nornia_console.py --print
"""

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time

PROJECT_ROOT = "/opt/ai-project"
if not os.path.isdir(PROJECT_ROOT):
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

SETTINGS_FILE = os.path.join(PROJECT_ROOT, "backend", "settings.json")
ISSUE_FILE = "/etc/issue"


def _detect_primary_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1.0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        pass
    try:
        cp = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=2, check=False)
        for tok in (cp.stdout or "").split():
            if "." in tok and not tok.startswith("127."):
                return tok
    except Exception:
        pass
    return "DHCP Bekleniyor..."


def _detect_hw_id() -> str:
    try:
        sys.path.insert(0, PROJECT_ROOT)
        from backend.services.hardware_info import get_system_hardware_fingerprint
        fp = get_system_hardware_fingerprint()
        if isinstance(fp, dict):
            return str(fp.get("hardware_id") or fp.get("clean_hw_id") or "HW-UNKNOWN")
        return str(fp or "HW-UNKNOWN")
    except Exception:
        return "HW-UNKNOWN"


def _is_setup_completed() -> bool:
    try:
        if os.path.isfile(SETTINGS_FILE):
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            sw = data.get("setup_wizard")
            if isinstance(sw, dict) and "completed" in sw:
                return bool(sw.get("completed"))
            if len(data.get("users") or []) > 0 or len(data.get("trunks") or []) > 0:
                return True
    except Exception:
        pass
    return False


def _svc_led(unit: str) -> str:
    if not shutil.which("systemctl"):
        return "?"
    cp = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True, timeout=2, check=False)
    return "OK" if (cp.stdout or "").strip() == "active" else "--"


def _port_led(port: int) -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.8)
    try:
        s.connect(("127.0.0.1", port))
        return "OK"
    except Exception:
        return "--"
    finally:
        s.close()


def render_banner() -> str:
    ip = _detect_primary_ip()
    hw_id = _detect_hw_id()
    done = _is_setup_completed()
    if ip.startswith("DHCP"):
        web_url = "Ag baglantisi / IP bekleniyor..."
    else:
        web_url = f"http://{ip}" if done else f"http://{ip}/setup"

    ast = _svc_led("asterisk")
    pg = _svc_led("postgresql")
    ng = _svc_led("nginx")
    api = _port_led(8000)
    ui = _port_led(3000)

    status_str = f"AST:{ast}  PG16:{pg}  API:{api}  UI:{ui}  WEB:{ng}"
    mode_str = "Canli Sistem" if done else "ILK KURULUM BEKLENIYOR (/setup)"

    lines = [
        "",
        "+====================================================================+",
        "|                              N O R N I A                           |",
        "|                     Kurumsal Iletisim Sunucusu                     |",
        "+====================================================================+",
        f"|  Durum           : {mode_str:<47} |",
        f"|  Sunucu LAN IP   : {ip:<47} |",
        f"|  Web Arayuzu     : {web_url:<47} |",
        f"|  Donanim ID (HW) : {hw_id:<47} |",
        f"|  Servisler       : {status_str:<47} |",
        "+--------------------------------------------------------------------+",
        "|  * Ag analizi & IP tanimi icin 'destek' hesabi ile giris yapin.    |",
        "|  * SSH erisimi aktif (Port 22) - Yonetim: 'nornia'                 |",
        "+====================================================================+",
        "",
    ]
    return "\n".join(lines) + "\n"


def write_issue(force_reload_tty: bool = False) -> bool:
    banner = render_banner()
    prev = ""
    try:
        if os.path.isfile(ISSUE_FILE):
            with open(ISSUE_FILE, "r", encoding="utf-8", errors="ignore") as f:
                prev = f.read()
    except Exception:
        pass
    if prev == banner:
        return False
    try:
        tmp = ISSUE_FILE + ".nornia.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(banner)
        os.replace(tmp, ISSUE_FILE)
        if force_reload_tty and shutil.which("agetty"):
            subprocess.run(["agetty", "--reload"], capture_output=True, timeout=3, check=False)
        return True
    except Exception as exc:
        sys.stderr.write(f"[nornia_console] /etc/issue yazilamadi: {exc}\n")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Nornia Console Banner")
    parser.add_argument("--print", dest="do_print", action="store_true")
    parser.add_argument("--write-issue", dest="do_write", action="store_true")
    parser.add_argument("--daemon", dest="do_daemon", action="store_true")
    parser.add_argument("--interval", type=int, default=15)
    args = parser.parse_args()

    if args.do_daemon:
        write_issue(force_reload_tty=True)
        while True:
            time.sleep(max(5, args.interval))
            write_issue(force_reload_tty=True)
    elif args.do_write:
        write_issue(force_reload_tty=True)
        return 0
    else:
        sys.stdout.write(render_banner())
        return 0


if __name__ == "__main__":
    sys.exit(main())
